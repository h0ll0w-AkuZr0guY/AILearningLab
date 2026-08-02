---
id: "python-01-05"
track: "python"
title: "列表与元组内部：PyListObject 的 over-allocate 与 PyTupleObject 的不可变性"
depth: "deep"
visualIndex: "../visuals/python-01-05.md"
exampleLanguage: "python"
readingMinutes: 32
sourceMinutes: 22
practiceMinutes: 26
reviewMinutes: 10
---

## 官方入口

title: "Python 3.14 C API · PyListObject / PyTupleObject 的序列布局"
url: "https://docs.python.org/3.14/c-api/list.html#c.PyListObject"

[list C API](https://docs.python.org/3.14/c-api/list.html#c.PyListObject) 与 [tuple C API](https://docs.python.org/3.14/c-api/tuple.html#c.PyTupleObject) 区分可变与不可变序列的公开操作；固定 tag 源码补充 `PyListObject` 的 `ob_item` / `allocated` 和 `PyTupleObject` 的变长尾部元素数组。`ob_size` 是逻辑元素数，list 的 `allocated` 是可用槽位数，二者分离才有超额分配。版本边界 CPython v3.14.6。

## 真实源码

repo: "python/cpython"
file: "Include/cpython/listobject.h / Objects/listobject.c / Objects/tupleobject.c"
symbol: "PyListObject / list_resize / _PyList_AppendTakeRefListResize / tuple_alloc"
language: "c"
url: "https://github.com/python/cpython/blob/v3.14.6/Objects/listobject.c#L108-L141"

### 逐段讲解

- `PyListObject`（listobject.h L5-L21）：`ob_size` 是元素个数，`ob_item` 是 `PyObject**` 数组，`allocated` 是数组容量，并明确声明 `0 <= ob_size <= allocated`。指针数组的容量与元素个数解耦是 over-allocation 的物理基础。
- `list_resize`（listobject.c L108-L141）：当 `newsize` 落在 `allocated/2..allocated` 时，只改 `Py_SIZE(self)`；否则计算新容量。v3.14.6 还将容量向四槽对齐，并在一次增长远大于预留余量时放弃额外预留。
- `_PyList_AppendTakeRefListResize`（L520-L529）：先让 `list_resize` 确保容量，再把新元素以 release-store 写入 `ob_item[len]`。错误路径会 DECREF 尚未接管的 `newitem`。
- `tuple_alloc`（tupleobject.c L36-L59）：按 size 检查溢出、尝试 free list，最后用 `PyObject_GC_NewVar` 获得一次性变长对象空间；tuple 没有 `allocated` 余量和 append 路径。

### 源码节选

```c
// listobject.h + listobject.c（v3.14.6，保留容量决策）
typedef struct {
    PyObject_VAR_HEAD              // ob_refcnt + ob_type + ob_size
    PyObject **ob_item;            // 元素指针数组
    Py_ssize_t allocated;          // ob_item 的实际分配容量
} PyListObject;

// list_resize：预留尚够时不触碰 allocator
if (allocated >= newsize && newsize >= (allocated >> 1)) {
    Py_SIZE(self) = newsize;       // 缩容或微调，不重分配
    return 0;
}
// 温和增长，并向四个指针槽对齐
new_allocated = ((size_t)newsize + (newsize >> 3) + 6) & ~(size_t)3;
if (newsize - Py_SIZE(self) > (Py_ssize_t)(new_allocated - newsize))
    new_allocated = ((size_t)newsize + 3) & ~(size_t)3;
if (newsize == 0)
    new_allocated = 0;

// tupleobject.c：固定长度对象一次性分配
if ((size_t)size > ((size_t)PY_SSIZE_T_MAX -
                    (sizeof(PyTupleObject) - sizeof(PyObject *))) /
                   sizeof(PyObject *)) {
    return (PyTupleObject *)PyErr_NoMemory();
}
PyTupleObject *result = PyObject_GC_NewVar(PyTupleObject, &PyTuple_Type, size);
```

删减说明：省略了 `list_ass_slice` 的批量操作与 `list_sort` 的 Timsort 实现；保留的是 over-allocate 公式与 list_resize 的「half-to-allocated」不变区间判定。

## 导读

`lst = [1,2,3]` 在 C 层不是简单的数组：`PyListObject` 的 `ob_item` 指向 `PyObject*` 数组，这些指针分别指向 `PyLongObject(1)`、`PyLongObject(2)`、`PyLongObject(3)`。list 本身保存的是指针和容量。tuple 也保存 `PyObject*` 槽，但其尾部槽随 tuple 对象一次分配，长度确定后没有 list 那样可替换的容量数组。这一布局差异决定了二者的扩容成本与可变性。

反例：`lst = []; lst.append(42); lst.append(43)` 中，第一次追加会请求能容纳若干元素的数组，第二次通常可直接复用容量；具体容量应由当前构建实测。`t = (42, 43)` 在创建时分配固定长度的元素槽，后续无法用 Python 级赋值改变槽位。不要把某个版本、平台上的对象字节数或所谓“紧凑 tuple 优化”写成跨版本事实。

## 分章正文

### list 是 PyObject* 数组，不是值容器

kicker: "01 · OBSERVE"

`lst = [None, 1, "hi"]` 的三个元素——`None`、`int`、`str`——在内存中不是连续存储的值，而是三个 `PyObject*` 指针。list 只负责持有这些指针并维护 INCREF/DECREF。`del lst[1]` 时 C 层做三件事：`DECREF(lst->ob_item[1])`、把 `ob_item[2]` 前移一位、`ob_size--`。O(n) 的删除成本来自指针移动而非值拷贝；插入同理，先 `realloc` 扩容、再 `memmove` 后移指针。

#### 本章结论

list = PyObject* 数组 + 引用计数管理；插入/删除是 O(n) 的指针移动。

### over-allocate：为什么 `lst.append` 不是每次分配

kicker: "02 · MODEL"

v3.14.6 的 `list_resize` 先计算候选容量 `((newsize + (newsize >> 3) + 6) & ~3)`，即约为 `n + n/8 + 6` 后向下对齐到 4 的倍数；当一次批量增长已经接近这段预留空间时，它改用 `((newsize + 3) & ~3)`，避免留下无意义的空槽。第一个 append 在常见 64 位构建上通常得到 4 个槽，但这是源码策略与平台对象大小共同产生的观测，不是语言承诺。该策略使连续 append 保持摊还 O(1)，却不等于每次 append 都没有 realloc。

当 `allocated >= newsize` 且 `newsize >= allocated / 2` 时，源码直接保留现有数组；这段半容量区间避免 append/pop 交替时的反复分配。越过区间才重新计算容量，因此实验应观察跃迁位置而非把“空 list 是 56 字节”锁死为断言。

#### 本章结论

增长候选容量约为 n + n/8 + 6 后按 4 槽对齐，批量增长另有分支；半容量区间避免容量抖动。

### tuple 的单次分配与不可变性

kicker: "03 · SOURCE"

`PyTupleObject` 在头部末尾声明 `ob_item[1]`，实际分配使用 `PyObject_GC_NewVar` 按 `ob_size` 延展该对象的尾部存储。它不是 list 那样“对象 + 可替换指针数组”的两层布局：tuple 的元素槽与对象一并创建，长度确定后没有 `allocated` 余量。

不可变性来自类型暴露的操作集合：tuple 没有允许项目赋值的序列或映射 slot，Python 层的 `t[i] = value` 因而失败。不要把“不可变”误读成“元素递归不可变”，也不要把类型对象的可变性标志和实例元素赋值混在一起。`tuple_alloc` 的溢出检查与对象分配路径才是本课应回读的源码证据。

#### 本章结论

tuple 的元素槽与对象一次分配；不可变来自不暴露项目赋值接口；对象大小仍是版本和平台相关观测。

### list↔tuple 浅拷贝与 id 复用

kicker: "04 · FAILURE"

`tuple(lst)` 和 `list(tup)` 都是 O(n) 的浅拷贝——INCREF 每个元素、分配新数组。陷阱：
1. **浅拷贝**：`t = ([1],); tuple(t)` 内部的 list 仍在原引用——修改原 list 会影响 tuple 内部元素（值可变，只是 tuple 本身不可变）。
2. **tuple 单元素语法**：`(42)` 是带括号的 int，`(42,)` 才是 tuple——初学者易错。
3. **id 复用**：list 释放后 `ob_item` 数组被 free，地址可能被后续 list 复用——`id([]) == id([])` 同一表达式内通常相等（CPython 复用 freed pointer），但跨生命周期不保证。

#### 本章结论

list↔tuple 转换是浅拷贝 O(n)；tuple 单元素需要尾逗号；id 跨生命周期不保证唯一。

### 实战诊断：sizeof 与 over-allocate 的可观察信号

kicker: "05 · ENGINEERING"

`sys.getsizeof` 是诊断 over-allocate 行为的第一工具：
- `sys.getsizeof([])` 给出当前解释器中空 list 的对象大小。
- append 后记录每个 `(len(items), sys.getsizeof(items))`，可看到容量耗尽时的阶梯。
- `sys.getsizeof((0,))` 与同长度 list 的差异反映两种布局，但绝对值受指针宽度、构建选项和版本影响。
- 用 `[0] * n` 构造出的容量策略可能不同于逐个 append；不要从一个构造路径外推另一个路径。

理解这些数字是性能调优的基线——例如「用 list comprehension 预分配」与「反复 `append`」的差异可以从 allocated 增长曲线看出。

#### 本章结论

`sys.getsizeof` 暴露当前构建中的容量阶梯；先比较变化关系，再把它对应回源码分支。

### 怎么验证：完整对照示例

kicker: "06 · VERIFY"

本课示例断言：append 容量阶梯、list/tuple 的相对对象大小、浅拷贝的内部元素可变性、单元素 tuple 尾逗号、半容量区间的 resize 行为。运行 `python examples/python/05_sequences.py` 的正常与失败断言全部通过，即代表本课的可运行契约达成。

#### 本章结论

sizeof 暴露 over-allocate 的阶梯；tuple 与 list 的相对大小须在当前平台测量；运行示例 = 契约证据。

### 预分配、批量构造与 API 选择

kicker: "07 · ENGINEERING"

`append` 的摊还常数时间不等于每一次 append 都便宜。容量刚好耗尽时，`list_resize` 要申请新数组并移动指针；元素对象本身没有被深拷贝，但长列表上的指针迁移、缓存失效与 allocator 压力仍会出现在延迟尾部。已知最终长度时，`[None] * n` 后按索引写入、一次性 `list(iterable)`、或让生产者直接产生 tuple，往往比把所有输入逐个 append 更可预测。选择前要先测量真实输入大小和峰值内存，不能只因“预分配更快”而写出难维护的索引代码。

tuple 的工程收益也不是“总比 list 快”。它适合记录的字段数固定、需要作为 hashable key、或希望 API 明确禁止结构修改的场合；若包含 list、dict 等不可 hash 元素，整个 tuple 仍不可 hash。把可变集合强行转 tuple 会让调用者每次修改都新建对象，可能增加分配量。对需要队首弹出的工作队列，`collections.deque` 的分块结构更合适；这正是后续性能课单列它的原因。

另一个容易漏掉的失败路径是并发构建。当前 CPython 的普通构建受 GIL 保护，但源码仍为 free-threaded 情况准备了共享数组处理和 release-store。业务层不能把一次 `append` 当成跨实现的复合事务：多步“检查长度再 append”仍需以锁、队列或单线程所有权表达原子边界。本课的 `ob_size` / `allocated` 模型解释容量，不替代并发正确性模型。

#### 本章结论

list 的增长策略解决的是连续追加的摊还代价；当长度、并发与所有权边界不同，应选择批量构造、tuple、deque 或显式同步，而不是盲目依赖 append。

### 用实验读容量，而不猜平台字节数

kicker: "08 · VERIFY"

`sys.getsizeof` 适合观察同一解释器、同一平台内列表的相对增长点，却不能替你读出 C 结构的每个字段。它包含对象本体和当前数组占用，受指针宽度、调试构建、allocator 与版本影响；把某个结果例如“空 list 一定是 56 字节”写成测试，会让课件在 32 位、debug 或未来版本中失效。更可靠的实验记录 `(len(items), sys.getsizeof(items))` 序列，只断言容量不足时大小会跃迁、在半容量区间内 pop 通常不会立即缩小。

用 `tracemalloc` 时还要区分“Python 分配追踪到的内存”和进程 RSS。一个大 list 的 `ob_item` 数组可以收缩，但它引用的对象、free list 或操作系统页未必同步归还给系统；RSS 没降不能单独证明 list_resize 出错。反过来，列表长度增长也不代表每次都触发 `realloc`。把这两个读数与源码的 `allocated` 条件对照，才能避免只看一个图表就做容量结论。

完整示例刻意包含一个失败断言：`hash([1, 2])` 抛 `TypeError`。这是 API 设计上“可变容器不能按值做稳定 hash”的结果，和 list 的 allocated 数字无关；把两者分开，才能解释为什么 tuple 有时可作 key，而内部含 list 时仍不能 hash。

#### 本章结论

容量实验应验证变化关系与源码分支，不锁死单个平台的字节常量；内存诊断还要把对象大小、追踪分配与 RSS 分成三种不同证据。

## 核心机制

- list = PyVarObject + ob_item 指针数组 + allocated 容量，over-allocate 扩容。
- tuple = PyVarObject + 变长尾部的 ob_item 槽，一次分配；没有 list 的 allocated 余量。
- list 扩容的 v3.14.6 候选值约为 n + n/8 + 6 并按 4 槽对齐；批量增长与半容量缩容另有分支。
- list↔tuple 浅拷贝 O(n)；INCREF 每个元素；id 跨生命周期可复用。
- sys.getsizeof 暴露 allocated，是诊断 list 性能的工具。

## 常见误区

- 以为 list 存值是连续存储的；实际存储 PyObject* 指针，list 本身只持有引用。
- 以为 tuple 不可变意味着元素值不可变；tuple 不可变的是引用，元素对象自身可被修改（如 `t[0].append(...)`）。
- 把 `(42)` 当 tuple；无尾逗号是带括号表达式，`type((42))` 是 `int`。
- 以为 list append 每次都分配；不变区间内 `ob_size` 直接修改，无 realloc。
- 以为 `id()` 在整个进程生命周期内唯一；`id([])` 同一表达式两次可相等（freed pointer 复用），跨调用不保证。

## 实现变体

### 变体 A：list（可变、over-allocate）

useWhen: "需要动态增删、顺序遍历、随机访问的场景。"
tradeoff: "获得：摊还 O(1) append、O(1) 索引、O(n) insert/delete；牺牲：每个元素 8 字节指针 + 引用计数维护 + realloc 抖动。"

#### 代码

```python
# list 是动态指针数组
lst = [1, 2, 3]
lst.append(4)                      # 摊还 O(1)
lst.insert(0, 0)                   # O(n) 移动指针
```

### 变体 B：tuple（不可变、固定槽位）

useWhen: "异构记录、dict key、函数多返回值、不变序列。"
tradeoff: "获得：固定槽位、明确的不可变 API、元素都可 hash 时可作 key；牺牲：不能修改、需重建来变化。"

#### 代码

```python
# tuple 一次分配 + 不可变
point = (10, 20)                   # dict key 友好
rgb = (255, 128, 0)                # 异构打包
```

## 可运行示例

```python
import sys

# 断言 1：over-allocate 公式（4→8→9→16→...）
def list_growth():
    sizes, lst = [], []
    for i in range(20):
        lst.append(i)
        sizes.append((len(lst), sys.getsizeof(lst)))
    return sizes
growth = list_growth()
assert growth[0][1] == growth[3][1]              # 0-3 同容量（allocated=4 起步）
assert growth[4][1] > growth[3][1]               # 第 5 个 append 触发扩容（4→8）
assert growth[8][1] > growth[7][1]               # 第 9 个 append 触发扩容（8→9）

# 断言 2：当前构建中 tuple 的对象开销更小
assert sys.getsizeof(tuple(range(100))) < sys.getsizeof(list(range(100)))

# 断言 3：浅拷贝——内部可变元素仍可变
inner = [42]
t = (inner,)
inner.append(43)
assert len(t[0]) == 2                             # tuple 内部 list 被修改

# 断言 4：单元素 tuple 尾逗号
assert type((42,)) is tuple
assert type((42)) is int                          # 无逗号 = 普通表达式

# 断言 5：不变区间——append/pop 不触发 realloc
lst = [0] * 8                                     # 精确容量由构造路径和当前构建决定
before = sys.getsizeof(lst)
lst.pop()                                         # 8→7 仍在不变区间
after = sys.getsizeof(lst)
assert before == after                            # ob_size 变化但 allocated 不变

# 断言 6：list 不可 hash、tuple 可 hash
try:
    hash([1, 2, 3])
    assert False, "list 应该不可 hash"
except TypeError:
    pass
assert hash((1, 2, 3)) == hash((1, 2, 3))         # tuple 可 hash 且等值同 hash
```

## 搭积木复现

### 积木 1：实现 PyListObject 的 ob_item+allocated 模型

用 Python class 模拟：`self._items = []` 存 `PyObject*` 引用，`self._size` 记录逻辑长度，`self._allocated` 记录物理容量。append 时 `_size < _allocated` 直接写；否则扩容。

```python
class MiniList:
    def __init__(self):
        self._items = []            # 元素指针数组（Python list 本身已 over-allocate）
        self._size = 0
        self._allocated = 0
```

### 积木 2：实现 list_resize 的候选容量与缩容边界

按 v3.14.6 的主分支先计算 `(new_size + (new_size >> 3) + 6) & ~3`；一次增长大到足以吃掉预留空间时，用 `(new_size + 3) & ~3`。`new_size >= _allocated // 2` 的缩小时只改逻辑长度。

```python
def _resize(self, new_size):
    if new_size < 0:
        raise ValueError("size must be non-negative")
    if new_size < self._allocated // 2 or new_size > self._allocated:
        candidate = (new_size + (new_size >> 3) + 6) & ~3
        if new_size - self._size > candidate - new_size:
            candidate = (new_size + 3) & ~3
        self._allocated = candidate
        self._items.extend([None] * (self._allocated - len(self._items)))
    self._size = new_size
```

### 积木 3：实现 PyTupleObject 的一次分配（尾部槽位模拟）

用 `bytes` 模拟定长存储：`data = bytearray(n * 8)`；构造时一次性分配，写入 8 字节定长槽；无 `_allocated` 字段。

```python
class MiniTuple:
    def __init__(self, items):
        self._data = tuple(items)   # Python tuple 本身已单次分配
    def __getitem__(self, i): return self._data[i]
```

### 积木 4：实现 list↔tuple 浅拷贝

`MiniTuple(MiniList)` 时 INCREF 每个元素（Python 引用语义自然完成），分配新 `bytes` 存储；不递归拷贝内部可变对象——浅拷贝。

```python
def list_to_tuple(lst): return MiniTuple([x for x in lst])  # 浅拷贝
```

### 积木 5：对照上游源码 listobject.h + listobject.c v3.14.6

把 `MiniList._resize` 的扩容点与 `Objects/listobject.c` `list_resize` [L108-L141](https://github.com/python/cpython/blob/v3.14.6/Objects/listobject.c#L108-L141) 一一对应：`newsize >> 3` 对应 n/8，`& ~3` 对应 4 槽对齐，大增长分支避免过度预留，半容量比较决定能否原地保留数组。验证：本课示例的正常与失败断言都通过。

### 积木 6：加入大增量与失败边界

让 `MiniList` 一次 extend 远大于当前容量，复现 v3.14.6 中“增长距离已接近预留余量就不额外 over-allocate”的分支；再传入负长度并断言抛出 `ValueError`。这一步说明扩容公式不是只有一条算式：它还要避免批量追加后留下无意义的空槽，并在输入非法时不破坏原有容量。

## 自检

### 问题

`a = [1,2,3]; b = a; a.append(4); print(b)` 输出什么？解释 `a is b` 为 True 与 list 可变性的关系。为什么 `t = (1, [2], 3); t[1].append(4)` 能成功但 `t[1] = [5]` 失败？

### 站内答案

结论：`b` 输出 `[1,2,3,4]`——`a` 和 `b` 指向同一个 `PyListObject`（`a is b`），`append` 修改的是该对象的 `ob_item` 数组。tuple 的 `t[1]` 不可被重新赋值（`__setitem__` 无 slot）但 `t[1]` 指向的 list 对象可以调用自己的 `append`——tuple 不可变的是引用数组，不是引用目标。源码证据：PyListObject 结构（[listobject.h L9-13](https://github.com/python/cpython/blob/v3.14.6/Include/cpython/listobject.h#L5-L30)）、PyTupleObject 结构（[tupleobject.h L20-25](https://github.com/python/cpython/blob/v3.14.6/Include/cpython/tupleobject.h#L20-L25)）。可运行验证：本课示例断言 3、6。

## 更新日志

### 署名纠正：Python PR #26/#27 的真实运行身份

at: "2026-08-02T19:48:47+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "OpenAI Codex · GPT-5.6 Luna"
summary: "纠正本课在 Python PR #26/#27 中误用的历史自动化署名；正文、源码证据、示例、视觉与原有日志均保持不变，并补充 PR 前运行身份确认门禁。"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/28"
commit: "47616c9"

### 按深度协议全面重写

at: "2026-08-01T22:30:00+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "WorkBuddy · DeepSeek-V4-Flash"
summary: "按深度课程协议重写并补足 CJK 至 2800+：扩展正文与搭积木复现，6 断言覆盖容量阶梯、tuple 的相对布局、浅拷贝、不变区间与 hash；源码解释固定在 CPython v3.14.6，避免把平台字节数和旧扩容公式写成语言契约；时间预算合计仍为 estimatedMinutes 90。"
