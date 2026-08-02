---
id: "python-01-01"
track: "python"
title: "PyObject 头部与 ob_type：CPython 对象模型的共同入口"
depth: "deep"
visualIndex: "../visuals/python-01-01.md"
exampleLanguage: "python"
readingMinutes: 32
sourceMinutes: 20
practiceMinutes: 28
reviewMinutes: 10
---

## 官方入口

title: "CPython 3.14 · Include/object.h PyObject / PyVarObject 结构体"
url: "https://github.com/python/cpython/blob/v3.14.6/Include/object.h#L45-L175"

[Include/object.h](https://github.com/python/cpython/blob/v3.14.6/Include/object.h#L45-L175) 定义所有 Python 对象的共同头部：`PyObject` 结构体包含 `ob_refcnt`（引用计数）与 `ob_type`（类型指针）两个字段；`PyVarObject` 在此基础上增加 `ob_size`（元素数量）。这是 C 层「任何对象指针都能先被当作 PyObject* 读取头部信息」的布局契约——`PyObject_HEAD` 宏展开为 `PyObject ob_base` 作为结构体首字段，C 标准保证首字段地址与结构体地址相同，从而允许安全的向上转型。本课采用 CPython v3.14.6（2026-07 发布）为版本边界；`main` 分支的调试扩展字段（如 `_ob_next`/`_ob_prev`）不纳入本课主契约。

## 真实源码

repo: "python/cpython"
file: "Include/object.h"
symbol: "PyObject / PyVarObject / Py_TYPE / Py_SET_TYPE"
language: "c"
url: "https://github.com/python/cpython/blob/v3.14.6/Include/object.h#L107-L177"

### 逐段讲解

- `PyObject`（object.h L110-L175）：普通 GIL 构建把引用计数及其标志装入首个机器字，随后是 `PyTypeObject *ob_type`；free-threaded 构建改为线程归属、局部/共享计数与 mutex 等字段，再保留类型指针。共同点是 `ob_type` 仍由 C API 的 `Py_TYPE()` 读取，具体偏移不是 Python 层 API。
- `PyObject_HEAD`（L73）与 `PyObject_VAR_HEAD`（L103）：具体对象把共同头部作为首个成员，变长对象再附加 `ob_size`。旧的 `Py_TRACE_REFS` 专用头部布局并不属于本课的 v3.14.6 主证据。
- `PyVarObject`（L169-172）：在 `PyObject` 尾部追加 `ob_size`，使 `list`、`tuple`、`bytes` 等变长对象共享同样的头部扩展方式；`Py_SIZE` 宏从 `PyVarObject*` 读取 `ob_size`。
- `Py_TYPE`（L270）：`_PyObject_CAST(ob)->ob_type`——标准读取；`Py_SET_TYPE`（L301）直接写入 `ob_type`，文档明确只允许在初始化或底层类型扩展中使用。

### 源码节选

```c
/* PyObject_HEAD defines the initial segment of every PyObject. */
#define PyObject_HEAD                   PyObject ob_base;

// Kept for backward compatibility. It was needed by Py_TRACE_REFS build.
#define _PyObject_EXTRA_INIT

/* PyObject_VAR_HEAD defines the initial segment of all variable-size
 * container objects. These end with a declaration of an array with 1
 * element, but enough space is malloc'ed so that the array actually
 * has room for ob_size elements.
 */
#define PyObject_VAR_HEAD      PyVarObject ob_base;
#define Py_INVALID_SIZE (Py_ssize_t)-1

typedef struct {
    PyObject ob_base;
    Py_ssize_t ob_size; /* Number of items in variable part */
} PyVarObject;

static inline PyTypeObject*
_Py_TYPE(PyObject *ob)
{
    return ob->ob_type;
}
```

删减说明：节选省略了字节序下的字段顺序与 free-threaded 的全部状态字段；保留“共同头部、构建分支、类型指针”三件能解释 Python 行为的事实。真实扩展应使用 `Py_TYPE`、`Py_SET_TYPE` 等 C API，而不是复制这段布局。

## 导读

Python 的一次名称绑定会让某个对象获得或失去一个引用；若表达式产生新对象，C API 的新引用通常从计数 1 开始，而 `42` 这类常量也可能直接复用解释器已有对象。无论对象如何取得，它都有共同头部：引用状态服务于生命周期，`ob_type` 指向类型对象。理解这一层，才能解释 `type()` 是运行时查询，也才能把 `id()` 的 CPython 地址观察与语言层身份合同分开。

先建立反例：同一代码块的 `42` 或 `257` 字面量可能被编译器复用，因此 `is` 的结果不适合演示缓存边界。使用两个独立 `int("257")` 调用才能在当前 CPython 观察到不同对象。`is` 比较的是对象身份；相等值是否复用由解释器的创建策略决定。共同头部里的 `ob_type` 是进入类型实现的入口，却不授权应用代码依赖某一数值的身份。

本课是 Python 路线模块 01 的地基。后续 python-01-02 讲身份/相等/哈希如何依赖 `ob_type` 分派，python-01-03 讲 `ob_refcnt` 如何驱动引用计数与 GC。

## 分章正文

### 为什么 `type(42)` 不需要查表

kicker: "01 · OBSERVE"

`type(42)` 返回 `<class 'int'>`，但 CPython 没有一张“值 → 类型”映射表。共同头部保存类型指针，普通非 limited C API 构建中的 `Py_TYPE(x)` 内联读取 `ob_type`；limited API 则允许它表现为函数调用。无论哪条 C 路径，Python 层看到的都是同一个类型对象。这里刻意不写“第几个字节”：free-threaded、调试、32 位和未来构建的布局都可能不同。

这解释了类型识别为何从对象本身开始，但不要把它误写成“属性访问零开销”。`x.method()` 仍要经过类型与实例字典、MRO、descriptor、缓存等路径；`ob_type` 只是这些路径的起点。它适合解释 C 层如何选择一个类型实现，不适合替代属性查找和方法绑定的完整模型，后续属性模块会继续展开。

#### 本章结论

`type()` 从对象关联的类型信息取得结果；`ob_type` 是 CPython 对象模型的重要入口，但属性查找还需经过 MRO 和 descriptor。

### 三层布局：PyObject、PyVarObject 与具体类型

kicker: "02 · MODEL"

所有 Python 对象共享三层布局：

1. **共同头部**：普通 GIL 64 位构建通常以一个机器字保存引用状态、再保存类型指针；free-threaded 的头部更大。
2. **变长头部** PyVarObject：在 PyObject 基础上追加 `ob_size`。它是元素数而不必是字节数；`list`、`tuple`、`bytes` 等容器都有此字段。
3. **类型专属体**：`PyLongObject` 追加 `ob_digit` 数组（大整数存储），`PyListObject` 追加 `ob_item` 指针数组和 `allocated` 容量。

关键不变量：**PyObject 必须是结构体的第一个字段**。C 标准 §6.7.2.1.15 保证「指向结构体首字段的指针可以安全转换回结构体指针」——这是 `(PyLongObject*)pyobj_ptr` 合法性的唯一依据。如果共同头部不在偏移 0，整个对象模型就会崩溃。

#### 代码

```python
import ctypes, sys

# 只在普通 CPython GIL 构建中观察两个基础字段
class PyObjectHead(ctypes.Structure):
    _fields_ = [
        ("ob_refcnt", ctypes.c_ssize_t),
        ("ob_type",   ctypes.c_void_p),
    ]

def peek_refcnt(obj):
    head = PyObjectHead.from_address(id(obj))
    return head.ob_refcnt

x = [42]
before = peek_refcnt(x)
y = x                          # 增加一个引用
after = peek_refcnt(x)
assert after == before + 1     # 普通 list 的引用计数确实递增了
```

#### 本章结论

三层布局将头部信息与类型专属体分离；对象大小与字段偏移必须以当前构建和公开 C API 为准。

### ob_refcnt：不朽对象、共享引用计数与调试扩展

kicker: "03 · SOURCE"

在普通 GIL 构建中，首个机器字兼容地暴露 `ob_refcnt` 与相关标志；在 free-threaded 构建中，源码改用局部引用、共享原子引用、对象 mutex 与线程归属字段。两者都说明：扩展不能把 `ob_refcnt` 当作可写的通用整数，更不能把 `ctypes` 读到的字段偏移写进跨构建的应用逻辑。

不朽对象是另一个版本边界。CPython 可把静态或热点对象标为不朽，从而绕开部分常规计数路径；哪些对象采用该优化、`sys.getrefcount()` 显示的数值以及优化怎样编码，都不属于 Python 语言合同。诊断时只可观察“这个对象在此构建的引用计数变化是否符合预期”，而不能断言某个大常数或枚举一张永远有效的对象名单。

#### 本章结论

引用状态随 GIL/free-threaded 构建及不朽优化而变；只用公开 C API 管理引用，不写死内部计数表示。

### ob_type 指针：怎么找到加法的实现

kicker: "04 · TYPE"

`PyLong_Type` 是一个 `PyTypeObject` 实例，数值操作通过类型相关的 slot 进入实现。当解释器执行 `a + b` 时，实际 C 调用会随操作数类型、特化字节码、构建选项与 `NotImplemented` 回退而变化；把它画成固定的四行栈帧会掩盖这些边界。可用的简化模型是：

1. `Py_TYPE(a)->tp_as_number->nb_add(a, b)`
2. 如果 `a` 的类型不支持加法，`nb_add` 返回 `Py_NotImplemented`
3. 解释器检查 `b` 的 `tp_as_number->nb_add` 按参数顺序再试一次（反向分派）
4. 两次都返回 `NotImplemented` 时抛出 `TypeError`

这个间接层是 Python 运算符重载**不需要注册**的根本原因：每个类型对象自带操作表，解释器只在运行时通过 `ob_type` 查找。内部类型（C 写的 `int`/`list`/`dict`）直接通过 `tp_as_*` 槽调用；用户自定义类的运算符通过 `tp_as_*` 指向 Python 层的 `__add__` 方法（通过 descriptor 协议包装）。

#### 本章结论

ob_type 指向类型对象；slot 参与运算符分派，属性行为还要经过 MRO、字典与 descriptor。

### 为什么不要随意改写 ob_type

kicker: "05 · FAILURE"

`Py_SET_TYPE(obj, new_type)` 是 C API 的低层工具，应只在对象初始化或受控运行时实现里使用；`ctypes` 并不是安全使用场景。业务代码改写 `ob_type` 会导致三重失败：

1. **GC 追踪丢失**：类型对象决定对象是否纳入 GC 追踪。把不带 GC head 的对象的 `ob_type` 改成带 GC 的类型，内存布局不匹配，GC 遍历时读到野指针。
2. **slot 表断裂**：同一个对象的属性访问、迭代、运算符突然指向另一个类型的 slot 表——例如把 `list` 的 `ob_type` 改成 `dict` 类型，`len()` 仍能工作（都走 `tp_as_mapping`），但 `append` 会崩溃。
3. **释放时类型不匹配**：`Py_DECREF` 触发的 `tp_dealloc` 按 `ob_type` 分发；改过 `ob_type` 的对象可能被错误类型的 dealloc 释放，产生 double-free 或内存泄漏。

`Py_SET_SIZE`、`Py_SET_REFCNT` 也有各自的 C API 前置条件；它们不能从 Python 层绕过对象生命周期。

#### 本章结论

ob_type 是只读字段（通过 Py_TYPE 读取）；Py_SET_TYPE 仅限初始化与底层扩展。

### 从 C 头到 Python 行为的证据链

kicker: "06 · VERIFY"

三条可验证的证据链：

1. **CPython 地址观察**：`ctypes.cast(id(x), ctypes.py_object).value is x` 为真，说明当前解释器把 `id` 表示为对象地址；这不是跨实现的承诺。
2. **普通 GIL 构建的布局实验**：用两个字段的 ctypes 结构读取 list 的类型指针，并与 `id(type(x))` 比较；实验前检查 `sys.implementation.name == "cpython"`，不把偏移推广到 free-threaded 或其他实现。
3. **语言层对照**：无论内部是否不朽，`x is None`、`type(x)`、`x == y` 都必须由语言合同解释；`getrefcount` 只用于同一构建内的诊断。

#### 本章结论

本机构建中可观察到地址与类型指针；语言层应依赖身份、类型和相等合同，而非内部计数值。

### 构建边界：GIL、free-threaded 与 limited API

kicker: "07 · PLATFORM"

CPython 3.14.6 已同时维护普通 GIL 与 free-threaded 的对象头定义，后者为对象归属、原子共享引用和同步增加了状态。再加上 32/64 位、字节序、调试器与 stable ABI，`sizeof(PyObject)` 和 `ob_type` 的偏移都不能作为扩展的持久协议。需要跨版本发布的 C 扩展应优先选择 limited API/Stable ABI 能提供的函数，而不是直接解引用内部结构。

失败路径因此很具体：把本机 ctypes 偏移搬到 ARM、PyPy 或 free-threaded CPython，轻则读到错误字段，重则破坏对象内存；直接写 `id(obj)` 指向的内存还会跳过引用计数、GC 与同步协议。学习实验可以读取当前普通构建的结构，生产代码只能使用公开 API。

#### 本章结论

构建方式会改变对象头；ctypes 观察只服务当前普通构建，生产扩展使用 C API/Stable ABI，绝不从 Python 写对象头。

## 核心机制

- PyObject 是共同头部：引用状态与类型指针；字段布局依构建而变。
- PyVarObject 追加 ob_size，供变长对象（list/tuple/bytes）使用。
- 具体对象把共同头部放在首部；扩展以 `PyObject_HEAD` 表达该约束。
- ob_type 指向 PyTypeObject，slot 参与运算符分派；属性还涉及 MRO 与 descriptor。
- 不朽是 CPython 优化，不能通过 Python 代码的固定 refcount 值判断。
- 不能从 Python 改写对象头；并发与引用同步由解释器实现。
- Py_SET_TYPE 仅限初始化与底层扩展；Py_TYPE 是标准读取入口。

## 常见误区

- 以为 `is` 比较的是「值相等」；`is` 比较的是 `PyObject*` 指针地址。
- 以为 Python 有「变量装盒子」模型；CPython 是「名称绑定到 PyObject*」。
- 以为 `type()` 查的是继承树；它直接读 ob_type 字段（O(1) 指针解引用）。
- 用 `id()` 返回值当「唯一标识」跨生命周期使用；已释放的对象地址可能被复用。

## 实现变体

### 变体 A：语言层单例（身份合同）

useWhen: "需要表达缺失值或哨兵，例如 None；用 is 比较该单例。"
tradeoff: "获得：清晰的身份语义；牺牲：不暴露、不依赖其内部引用计数或对象头布局。"

#### 代码

```python
missing = None
assert missing is None
assert missing != "None"
```

### 变体 B：动态分配对象（完整引用计数）

useWhen: "用户代码创建的大多数对象。"
tradeoff: "获得：按需分配/释放，灵活；牺牲：每次赋值、传参都走 INCREF/DECREF 热路径。"

#### 代码

```python
x = [1, 2, 3]           # 创建时 ob_refcnt = 1
y = x                   # INCREF → ob_refcnt = 2
del y                   # DECREF → ob_refcnt = 1
del x                   # DECREF → ob_refcnt = 0 → dealloc
```

## 可运行示例

```python
import ctypes, sys

class PyObjectHead(ctypes.Structure):
    _fields_ = [("ob_refcnt", ctypes.c_ssize_t), ("ob_type", ctypes.c_void_p)]

def peek_refcnt(obj):
    return PyObjectHead.from_address(id(obj)).ob_refcnt

def peek_type_addr(obj):
    return PyObjectHead.from_address(id(obj)).ob_type

# ---- 断言 1：普通对象的引用计数在赋值时递增 ----
a = [42]
r1 = peek_refcnt(a)
b = a
r2 = peek_refcnt(a)
assert r2 == r1 + 1

# ---- 断言 2：id() 返回 PyObject* 地址 ----
x = [1, 2]
assert ctypes.cast(id(x), ctypes.py_object).value is x

# ---- 断言 3：当前普通构建中的 ob_type 观察 ----
t = type(x)
assert peek_type_addr(x) == id(t)               # ob_type 确实指向类型对象

# ---- 断言 4：身份合同不依赖内部计数 ----
assert None is None and None != "None"

# ---- 断言 5：ctypes 布局与 C 头对应 ----
# 此实验只覆盖普通 GIL 64 位构建的两个字段视图
head_size = ctypes.sizeof(PyObjectHead)
assert head_size == ctypes.sizeof(ctypes.c_ssize_t) + ctypes.sizeof(ctypes.c_void_p)
```

## 搭积木复现

### 积木 1：用 ctypes 读取 PyObject 头部

实现 `peek_refcnt` 与 `peek_type_addr`，断言赋值后引用计数递增、ob_type 指向正确的类型对象。

### 积木 2：验证 id() = 地址

用 `ctypes.cast(id(obj), ...)` 证明 `id()` 返回的就是 `PyObject*` 值；两个不同的对象有不同 id。

### 积木 3：区分单例身份与不朽优化

用 `x is None` 验证语言层哨兵身份；只记录 `sys.getrefcount` 的本机观测，不以大常数断言不朽实现。

### 积木 4：验证 type() 走 ob_type

多次创建同类型的不同实例，断言它们的 `peek_type_addr` 都相等（指向同一个 `PyTypeObject` 全局实例）。

### 积木 5：对照上游源码

对照 `Include/object.h` v3.14.6：普通与 free-threaded `PyObject` 定义、`PyVarObject`、`Py_TYPE` 与 `Py_SET_TYPE`。列出本课刻意不固定的内容：字节序、计数表示、对象锁、调试选项与 Stable ABI 的函数边界。

### 积木 6：写出 ABI 边界测试

把 `ctypes` 观察包进 `if sys.implementation.name == "cpython"` 守卫；在 PyPy、Jython 或 CPython 的不同构建选项下只断言语言层的 `type`、`is` 与 `id` 合同，不把某个偏移量当成可移植 API。这样既能用地址实验证明本课的 CPython 模型，也不会把实现细节误写成 Python 规范。

## 自检

### 问题

`a = [1, 2, 3]; b = a` 后，分别解释 `id(a)` 和 `id(b)` 为什么相等、`type(a)` 和 `type(b)` 从哪里获取、`sys.getrefcount(a)` 为什么比 1 大至少 1。再用 ctypes 验证你的解释。

### 站内答案

结论：`id(a) == id(b)` 因为两个名称绑定同一对象；`type(a)` 和 `type(b)` 都得到该对象关联的类型；`sys.getrefcount(a)` 会因 `a`、`b` 与函数传参而高于单一持有者的观察值。CPython C API 用 `PyObject_HEAD` 表达共同头部，用 `Py_TYPE` 读取类型；普通 GIL 构建可用 ctypes 做受限的地址和字段实验。工程边界是：不朽优化、对象头大小、字段偏移、引用计数表现和地址表示都会随构建与实现变化。业务代码用 `is` 判断哨兵、用 `==` 判断值；扩展代码使用公开 C API，而不直接改写对象内存。

## 更新日志

### 署名纠正：Python PR #26/#27 的真实运行身份

at: "2026-08-02T19:48:47+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "OpenAI Codex · GPT-5.6 Luna"
summary: "纠正本课在 Python PR #26/#27 中误用的历史自动化署名；正文、源码证据、示例、视觉与原有日志均保持不变，并补充 PR 前运行身份确认门禁。"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/28"
commit: "47616c9"

### 按深度协议全面重写

at: "2026-08-01T21:00:00+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "WorkBuddy · DeepSeek-V4-Flash"
summary: "按深度课程协议全面重写：基于 CPython v3.14.6 Include/object.h（8594736f）重建 PyObject/PyVarObject、Py_TYPE 和 ABI 边界；正文、源码节选、ctypes 实验和视觉都区分普通 GIL、free-threaded 与 Stable ABI，避免把 16 字节布局或不朽计数写成跨构建合同。"
