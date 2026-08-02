---
id: "python-01-04"
track: "python"
title: "小整数池与 interned 字符串：CPython 的静态对象缓存"
depth: "deep"
visualIndex: "../visuals/python-01-04.md"
exampleLanguage: "python"
readingMinutes: 30
sourceMinutes: 18
practiceMinutes: 30
reviewMinutes: 12
---

## 官方入口

title: "Python 3.14 · sys.intern：手动驻留的对象身份边界"
url: "https://docs.python.org/3.14/library/sys.html#sys.intern"

[`sys.intern`](https://docs.python.org/3.14/library/sys.html#sys.intern) 提供了唯一可依赖的 Python 层入口：驻留一个字符串后，后续对相同值调用它会返回同一对象，适合高频字典 key 的查找优化。小整数池、编译器常量折叠和自动驻留都是 CPython 实现策略；尤其不能根据某个字面量 `is` 的结果推断语言规则。版本边界 CPython v3.14.6。

## 真实源码

repo: "python/cpython"
file: "Objects/longobject.c / Objects/unicodeobject.c"
symbol: "get_small_int / _PyUnicode_InternInPlace"
language: "c"
url: "https://github.com/python/cpython/blob/v3.14.6/Objects/longobject.c#L36-L65"

### 逐段讲解

- `get_small_int`（longobject.c L59-L63）：先断言值在实现的 small-int 范围内，再从 `_PyLong_SMALL_INTS` 返回静态对象；范围本身没有 Python 语言保证。
- `_PyUnicode_InternInPlace`（unicodeobject.c L16179-L16189）：公开入口把当前解释器和待处理指针交给内部驻留逻辑；它不是“只允许 ASCII 标识符”的语言规则。
- interned dict（unicodeobject.c L16072-L16159）：先走可重试的查找路径，必要时加锁，把等值字符串归一到同一个对象；free-threaded 与普通构建的锁策略不同。
- 编译期常量折叠可能让两个字面量共享对象，但这是编译器优化，必须用 `==` 比较字符串内容、用 `sys.intern()` 获得明确的身份复用。

### 源码节选

```c
// Objects/longobject.c（v3.14.6）
#define IS_SMALL_INT(ival) _PY_IS_SMALL_INT(ival)

static PyObject *
get_small_int(sdigit ival)
{
    assert(IS_SMALL_INT(ival));
    return (PyObject *)&_PyLong_SMALL_INTS[_PY_NSMALLNEGINTS + ival];
}

static PyLongObject *
maybe_small_long(PyLongObject *v)
{
    if (v && _PyLong_IsCompact(v)) {
        stwodigits ival = medium_value(v);
        if (IS_SMALL_INT(ival)) {
            _Py_DECREF_INT(v);
            return (PyLongObject *)get_small_int((sdigit)ival);
        }
    }
    return v;
}
```

删减说明：省略了 `_PyLong_SMALL_INTS` 的静态初始化、长整数分配以及 unicode 的完整锁与错误路径；保留的是 small-int 的真实索引路径与“计算后结果也可归一回静态对象”的 `maybe_small_long` 分支。

## 导读

`a = 42; b = 42; a is b` 返回 `True`，但 `a = 257; b = 257; a is b` 返回 `False`。这个面试高频题的答案不在 Python 语法而在 CPython 的小整数池——解释器启动时预分配了 [-5, 256] 的 262 个 `PyLongObject`，每次使用这些整数值都返回同一个对象。字符串同理：编译期折叠的常量或运行时 interned 的标识符共享内存。这是 C 层「对象复用」的静态优化，不是 Python 语言规范承诺的语义。

反例：两个模块中都定义 `CONST = 1000`，它们 `is` 为 False——因为 1000 不在小整数池范围；但如果两个模块都 `import CONST from config`，它们 `is` 为 True——因为 `from import` 绑定到同一个模块属性（INCREF 而非重新创建）。

## 分章正文

### 小整数池：[-5, 256] 永不释放

kicker: "01 · OBSERVE"

不要把 `for` 循环里的 `is` 写成断言。CPython v3.14.6 确实有由 `_PY_NSMALLNEGINTS` 与 `_PY_NSMALLPOSINTS` 决定的静态整数集合，典型构建常见 `-5..256`，但范围、常量折叠和内存复用都不是 Python 规范。真正稳健的实验只断言 `a == b`；如果要观察本版本的对象池，记录 `a is b` 并把它标成实现观测。

#### 本章结论

[-5, 256] 的整数是静态单例；超出范围的整数每次创建新对象。

### 字符串驻留：什么时候自动发生

kicker: "02 · MODEL"

CPython 会在编译和运行期间复用一些字符串对象，例如同一代码块里的字面量可能被折叠，解释器也会为内部名称维护驻留表。但“哪些字符串恰好共享”没有 Python 语言层保证；不要用字符集、长度或某一段字节码生成方式推导自动驻留规则。

唯一可由用户代码主动请求的入口是 `sys.intern()`：它返回驻留后的字符串，让等值字符串在同一解释器中复用同一个对象。对来自 JSON、网络或用户输入的文本，显式调用才是可读、可测且可审计的选择；对普通短生命周期文本，驻留反而可能延长生命周期并增加常驻内存。

#### 本章结论

`sys.intern` 是唯一显式的驻留合同；字面量共享与任何“标识符形态”启发式都只能作为版本相关观察。

### 预分配 vs 即时分配的性能取舍

kicker: "03 · PERFORMANCE"

当前 CPython 源码把一段小整数作为预建对象，避免这段热点区间反复分配；范围是实现选择，不是 Python 语义。浮点数没有同样的值缓存合同，业务代码不能把对象复用当作性能前提。

字符串驻留表同样用内存换查找和分配成本。传统带 GIL 的构建会在相关路径受 GIL 约束；free-threaded 构建则需要内部同步。两种构建都说明同一件事：高并发热路径里反复 `sys.intern()` 需要基准测试，不能凭“共享对象”推断它一定更快。

#### 本章结论

内存换速度；小整数池固定 7KB 开销，字符串驻留按需增加。

### id() 被复用的陷阱

kicker: "04 · FAILURE"

`a = 257; id_a = id(a); del a; b = 257; id(b)` 可能等于 `id_a`——因为 257 不在小整数池，对象被释放后内存地址被 `b` 的新分配复用。**`id()` 不承诺唯一性跨生命周期**。小整数池之所以 `id(256)` 永不变化，正是因为对象永不释放。

另一个陷阱是把 `is` 实验倒推成规则：`"hello" is "hello"` 在某个代码块内为真，只能说明编译器或解释器此刻复用了对象。要验证自己的意图，应写 `sys.intern(left) is sys.intern(right)`，而不是依赖是否“像标识符”。CPython 的不朽对象与引用计数优化也属于实现细节；它们解释了观察到的计数，却不授权业务代码用 `is` 比较整数或文本内容。

#### 本章结论

id 值可复用；显式 `sys.intern` 才表达驻留意图；不朽对象优化不改变值比较规则。

### intern 字典的内部结构与并发代价

kicker: "05 · ENGINEERING"

`PyUnicode_InternInPlace` 的实现核心是 `interned` dict（CPython 解释器单例），结构与普通 dict 一致但有特殊规则：key 与 value 都是字符串对象本身（同一指针），查找走 `PyDict_GetItemWithError`。新字符串被 `PyDict_SetDefault` 加入；已存在则不增引用计数（避免循环）。

并发代价来自共享的解释器内部状态：带 GIL 的构建会在相关路径受 GIL 约束，free-threaded 构建则需要内部同步。生产环境不应为了赌自动折叠而改写代码；先用 profile 证明某一有限词表高频且长寿命，再让该词表在一个明确的归一化入口调用 `sys.intern()`，并比较内存、吞吐和锁竞争。

#### 本章结论

intern 表是解释器内部机制；显式 intern 才是应用代码可表达的意图；是否值得驻留要测量内存和并发代价。

### 怎么验证

kicker: "06 · VERIFY"

在当前 CPython 构建中，可用两个独立 `int("256")` 的身份实验观察小整数缓存，用两个独立 `int("257")` 的身份实验观察缓存边界；这两者都是实现观测。真正可跨相同 CPython 解释器验证的契约是：`sys.intern(left) is sys.intern(right)`，其中 `left == right`。示例还用运行时构造对象演示 `id()` 可在对象死亡后复用，不把某一次是否复用写成断言。

#### 本章结论

用独立构造观察小整数缓存；用 `sys.intern` 验证显式驻留；把自动复用保留为不可依赖的实验现象。

### 版本边界：把身份现象降级为可观察实验

kicker: "07 · BOUNDARY"

最危险的写法是把 `256 is 256`、`"name" is "name"` 当成业务条件。它偶然通过时，读者会误以为相等值共享地址；一旦换成运行时拼接、换成另一解释器、换成不同编译单元或未来版本，条件的意义就消失。数据模型只承诺不可变对象**可以**被复用，不承诺一定复用；字符串、整数和 enum 的值相等一律使用 `==`。

`sys.intern()` 的工程价值也应受内存预算约束。它对大量重复、长寿命、常被作为字典 key 的字符串有利，因为同一对象可使身份快速路径与哈希缓存更容易命中；对一次性用户输入或无限 key 空间却可能延长对象生命周期。更稳妥的顺序是先用 profile 证明重复字符串确实占用热点，再限定可 intern 的词表和生命周期，而不是在每个解析点机械调用。

这也解释了为什么本课把小整数池和字符串驻留放在一起：两者都展示“值语义不变，实例是否复用是实现选择”。它们不能被合并为“`is` 比较技巧”，因为一个是解释器静态对象路径，一个是按值归一的字符串表，内存所有权、并发和诊断手段不同。

还有一个工程边界常被忽略：驻留只能减少**相同文本对象**的重复，并不能替代输入规范化。`"User-42"`、`"user-42"` 和带不同 Unicode 归一形式的两段文本，可能在业务语义上应被视为同一个 key，也可能必须保持不同；这是领域规则，应在驻留之前由明确的大小写、编码和合法性策略决定。反过来，先把不受限的用户输入全部 intern，再拿 `is` 当权限、路由或缓存键判断，会把内存所有权和安全语义混在一起。正确的数据流是：验证输入 → 规范化为业务 key → 用 `==` 表达值相等 → 仅在有限且被 profile 证明的热词表上显式驻留。这样即使换成 PyPy、换成 free-threaded CPython，业务结果仍由值语义保持稳定。

#### 本章结论

把 `is` 用于单例、哨兵和明确的对象身份；把缓存命中与内存收益当作可测的 CPython 工程事实，而非语言语义。

## 核心机制
- 当前 CPython 对一段小整数使用预建对象；准确范围属于固定源码版本的实现事实。
- 字符串驻留由解释器内部使用；`sys.intern` 是 Python 层的显式入口。
- 小整数池之外的对象id可复用。
- 编译期常量折叠共享同一代码块中的相同字面量。

## 常见误区
- 以为相等的小对象都 `is` 为 True；对象复用与其范围都不是值相等的规则。
- 以为 `id()` 是「全局唯一标识符」；已释放对象的地址可被新分配复用。
- 以为字符串 `is` 相等代表性能优化；不可靠，应用 `==` 比较值。

## 实现变体

### 变体 A：默认行为（只用 `==` 表达值语义）
### 变体 B：手动 intern（`sys.intern` 归一有限词表）

## 可运行示例

```python
import sys

# 断言 1：当前 CPython 的小整数缓存边界（实现观测）
a, b = int("256"), int("256"); assert a is b
c, d = int("257"), int("257"); assert c is not d

# 断言 2：sys.intern 是显式、可读的驻留入口
s1 = sys.intern("hello " + "world")
s2 = sys.intern("".join(["hello", " world"]))
assert s1 is s2

# 断言 3：id 可复用
x = 9999; idx = id(x); del x; y = 9999
# id(y) 可能 == idx（不承诺，但在同一线程短生命周期内大概率复用）
```

## 搭积木复现

### 积木 1：实现小整数池查找

实现 `small_int(ival)` —— ival 在 [-5,256] 内返回池中对象；否则创建新对象。

### 积木 2：实现 intern 字典

实现 `_interned = {}`，只有调用者显式传入时才放入；已存在则返回池中值。

### 积木 3：实现 id 复用检测

创建→释放→再创建大整数，检查 id 是否可能复用。

### 积木 4：实现编译期折叠模拟

同一作用域内相同字符串字面量共享对象引用。

### 积木 5：对照上游源码

对照 longobject.c `_PY_NSMALLPOSINTS` 与 unicodeobject.c `PyUnicode_InternInPlace` v3.14.6。

### 积木 6：把优化限定在一份可测词表

从一批重复 token 中选出有限词表，先统计唯一值数与总字符数，再只对命中的长寿命 key 调用 `sys.intern()`。用 `is` 验证同词被归一，用 `==` 验证未命中的值语义不变；最后清楚写下这个示例不证明自动驻留规则，也不替代真实内存 profile。

## 自检

### 问题

`a = "hello"; b = "hello"; c = "".join(["h", "e", "l", "l", "o"])`。分别判断 `a is b`、`a is c`、`a == c` 的返回值，解释每个判断背后的机制。

### 站内答案

结论：`a == c` 必为 True，因为字符序列相等；`a is b` 与 `a is c` 都不能成为业务契约，前者在当前代码块通常因常量复用为 True，后者通常为 False。若需要身份归一，应改写为 `sys.intern(a) is sys.intern(c)`。源码证据：固定版本的 unicodeobject.c 展示内部驻留入口，但只有 `sys.intern` 为 Python 层的显式 API。

## 更新日志

### 署名纠正：Python PR #26/#27 的真实运行身份

at: "2026-08-02T19:48:47+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "OpenAI Codex · GPT-5.6 Luna"
summary: "纠正本课在 Python PR #26/#27 中误用的历史自动化署名；正文、源码证据、示例、视觉与原有日志均保持不变，并补充 PR 前运行身份确认门禁。"

### 按深度协议全面重写

at: "2026-08-01T21:45:00+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "WorkBuddy · DeepSeek-V4-Flash"
summary: "按深度课程协议全面重写：基于 CPython v3.14.6 小整数池与 intern 源码，说明实现观察与 `sys.intern` 的 API 边界、id 复用和并发代价，并补齐独立可运行示例与视觉索引。"
