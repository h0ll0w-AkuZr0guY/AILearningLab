---
id: "python-01-02"
track: "python"
title: "身份、相等与哈希：is/id 的地址语义与 __eq__/__hash__ 契约"
depth: "deep"
visualIndex: "../visuals/python-01-02.md"
exampleLanguage: "python"
readingMinutes: 30
sourceMinutes: 20
practiceMinutes: 30
reviewMinutes: 10
---

## 官方入口

title: "Python 3.14 · 数据模型：__eq__ / __hash__ / __lt__；CPython Objects/object.c do_richcompare"
url: "https://docs.python.org/3.14/reference/datamodel.html#object.__eq__"

[Python 数据模型 · __eq__ / __hash__](https://docs.python.org/3.14/reference/datamodel.html#object.__eq__) 声明比较方法的三条规则：`a == b` 默认调用 `a.__eq__(b)`，若返回 `NotImplemented` 则尝试 `b.__eq__(a)`；`__hash__` 必须与 `__eq__` 一致（`a == b ⇒ hash(a) == hash(b)`，否则 dict 查找会错位）；自定义 `__eq__` 而未自定义 `__hash__` 时 CPython 自动置 `__hash__ = None`（对象不可哈希）。CPython 源码 `do_richcompare`（Objects/object.c L1046）精确实现这三次尝试逻辑。本课采用 CPython v3.14.6。

## 真实源码

repo: "python/cpython"
file: "Objects/object.c"
symbol: "do_richcompare / PyObject_RichCompareBool / PyObject_Hash"
language: "c"
url: "https://github.com/python/cpython/blob/v3.14.6/Objects/object.c#L1046-L1167"

### 逐段讲解

- `do_richcompare`（L1046-1090）：三次尝试——先看 `w->ob_type->tp_richcompare`（右操作数的类型负责比较），失败或返回 `NotImplemented` 则试 `v->ob_type->tp_richcompare`（左操作数的类型）；如果操作符不是 `==` 或 `!=`，还会尝试反向比较（w 的类型对 swap 后的操作符再试一次）。
- `PyObject_RichCompareBool`（L1119-1147）：把 `PyObject_RichCompare` 的返回对象转成 C 的 0/1/-1，非 `Py_True`/`Py_False`/`NotImplemented` 时抛出 `TypeError`。
- `PyObject_Hash`（L1139-1167）：先查 `tp->tp_hash` slot，若为 NULL 且类型是 `PyBaseObject_Type`（即 `object` 子类未覆盖 `__hash__`），返回内存地址的哈希（`_Py_HashPointer`）；若 `tp_hash` 存在但与 `__eq__` 自定义不同步，`type.__new__` 阶段已将 `tp_hash` 设为 `PyObject_HashNotImplemented`。
- `_Py_HashPointer`：`(Py_uhash_t)v >> 4` 右移 4 位去堆对齐噪声——因为 `id()` 返回的地址末 3-4 位通常为 0（对齐要求）。

### 源码节选

```c
static PyObject *
do_richcompare(PyThreadState *tstate, PyObject *v, PyObject *w, int op)
{
    richcmpfunc f;
    PyObject *res;
    int checked_reverse_op = 0;

    // 尝试 1：w（右操作数）的类型负责比较
    if ((f = Py_TYPE(w)->tp_richcompare) != NULL) {
        res = f(w, v, op);
        if (res != Py_NotImplemented) return res;
    }
    // 尝试 2：v（左操作数）的类型负责比较
    if ((f = Py_TYPE(v)->tp_richcompare) != NULL) {
        res = f(v, w, op);
        if (res != Py_NotImplemented) return res;
    }
    // 尝试 3：反向比较（!= 和 == 是对称的，不需要反转 op）
    if (!checked_reverse_op && (f = Py_TYPE(w)->tp_richcompare) != NULL) {
        res = f(w, v, _Py_SwappedOp[op]);       // < ↔ >, ≤ ↔ ≥
        if (res != Py_NotImplemented) return res;
    }
    // 三项都失败 → ==/!= 回退到身份比较，其他抛 TypeError
    ...
}
int
PyObject_RichCompareBool(PyObject *v, PyObject *w, int op)
{
    ...
    PyObject *res = PyObject_RichCompare(v, w, op);
    if (res == Py_True) return 1;
    if (res == Py_False) return 0;
    if (res == Py_NotImplemented) { ... }
    PyErr_Format(PyExc_TypeError, "...returned %.200s", Py_TYPE(res)->tp_name);
    ...
}
```

删减说明：省略了回溯错误信息与 `_Py_SwappedOp` 数组定义；保留的是三次尝试顺序与 `tp_richcompare` slot 的分派语义。`v` 和 `w` 分别对应 Python 表达式 `v op w` 的左右操作数。

## 导读

`a == b` 不是简单的「比较值」：CPython 先让 `b` 的类型决定怎么比，如果不认识 `a` 的类型就轮到 `a` 自己的类型比，还不行就反转 `<` 和 `>` 的方向再问一遍。这三层分派是 Python 运算符重载不需要注册的根本原因，也是 `3 == 3.0` 能返回 `True` 的幕后机制——`float.__eq__` 认识 `int`，所以 `tp_richcompare(3.0, 3, EQ)` 直接返回 `True`，不需要 `int.__eq__` 出场。

先建立反例：`class A: pass; d = {A(): 1}` 正常；但定义 `class B: def __eq__(self, o): return True` 后 `B()` 无法放入 dict——因为 `__eq__` 自定义了而 `__hash__` 被自动设为 `None`，`B()` 不可哈希。更隐蔽的反例：`hash((1, [2]))` 抛 `TypeError`，因为 tuple 的哈希递归调用元素的哈希，而 list 不可哈希。看懂 `do_richcompare` 的三次尝试和 `PyObject_Hash` 的 `tp_hash` slot，才能真正理解 dict key 为什么要求 `__eq__` + `__hash__` 联动。

本课与前课关系：python-01-01 讲了 `ob_type` 如何指向类型对象的 slot 表，本课的 `tp_richcompare` 和 `tp_hash` 正是那个 slot 表中的两个函数指针——`ob_type` 是「怎么找到」，本课是「找到之后怎么用」。

## 分章正文

### `is` 就是指针比较，`==` 绕了一大圈

kicker: "01 · OBSERVE"

`a is b` 只做一件事：比较两个 `PyObject*` 值——`(PyObject*)a == (PyObject*)b`。`a == b` 则调用 `PyObject_RichCompare(a, b, Py_EQ)`，进入 `do_richcompare` 的三次尝试。性能差约 20-50 倍（取决于类型路径）。

关键推论：`a is b ⇒ a == b` 只在 `a` 和 `b` 指向同一对象且该类型没有用自定义 `__eq__` 覆盖默认行为时才成立。`float('nan') is float('nan')` 为 False（不是同一对象），`float('nan') == float('nan')` 也为 False（IEEE 754 NaN 不等于任何值，包括自身）——这就是身份比较与值比较的典型分离。

#### 本章结论

`is` = 指针相等（O(1)）；`==` = do_richcompare 三次尝试（O(1)-O(n)，取决于类型 slot 实现）。

### do_richcompare 的三次尝试：让右操作数先发言

kicker: "02 · MODEL"

`a op b` 的比较遵循以下顺序：

1. `b.__op__(a)` — 右操作数的 `tp_richcompare(b, a, op)`
2. `a.__op__(b)` — 左操作数的 `tp_richcompare(a, b, op)`
3. `b.__rop__(a)` — 反转 op 后的右操作数（仅 `< > <= >=`）

关键：**右操作数先于左操作数**。这使子类能覆盖父类的比较行为：`class MyInt(int): ...` 的 `MyInt(3) == 3` 先让 `int.__eq__` 处理（因为 `3` 是右操作数），如果 `int` 不认识 `MyInt`，才轮到 `MyInt.__eq__`。这就是 `NotImplemented` 作为「我不认识这个类型，请对方试」的信号的作用——它不是异常，是协议。

#### 本章结论

三次尝试 = w.tp_richcompare → v.tp_richcompare → swap + w.tp_richcompare；NotImplemented 表示「请对方接管」。

### 哈希：__eq__ 与 __hash__ 的联动

kicker: "03 · SOURCE"

`PyObject_Hash`（L1139-1167）调用 `tp->tp_hash(v)`。对于 `object` 子类：
- 未自定义 `__eq__` 且未自定义 `__hash__`：`tp_hash = _Py_HashPointer`（返回 `id(v) >> 4` 作为哈希值）。
- 自定义了 `__eq__` 但未自定义 `__hash__`：`tp_hash` 在 `type.__new__` 时被显式设为 `PyObject_HashNotImplemented`——`hash(obj)` 抛 `TypeError: unhashable type`。
- 同时自定义了两者：`tp_hash` 指向用户定义的 `__hash__`。

dict 的查找流程：`hash(key)` → 找到 bucket → `key == existing_key` 逐个比较。如果 `a == b` 但 `hash(a) != hash(b)`，查找必然 miss——CPython 不修正哈希，直接依赖用户遵守契约。可变集合的另一个陷阱：对象放入 dict 后修改使其 `hash()` 值变化，原 bucket 中找不到了——这叫「幽灵 key」。

#### 本章结论

`__eq__` 自定义 → `__hash__` 自动 None（不可哈希）；dict 查找 = hash 定位 + eq 确认，两者必须一致。

### 四种失败：NaN、可变 key、类型不匹配与 missing hash

kicker: "04 · FAILURE"

1. **NaN 传染**：`float('nan') != float('nan')`，因此用新建 NaN 查询由另一个 NaN 建立的 key 通常失败；但 dict 也有同一对象身份快速路径，不能把它简化成“NaN key 永远不可检索”。工程上仍应避免把 NaN 当业务键，或先规范化成明确的哨兵和值语义。
2. **可变 key 幽灵化**：`d = {[1,2]: 'value'}` 直接抛 TypeError（list 不可哈希）；但 `d = {(1, [2])}` 同样失败——tuple 递归哈希时碰到不可哈希的元素。
3. **类型不匹配的回退**：`3 == '3'` 返回 `False`（int 和 str 互不认识对方的类型，三次尝试全部返回 NotImplemented → do_richcompare 的 fallback 分支对 `==`/`!=` 回退到身份比较）。
4. **`__eq__` 返回非 bool**：`class X: def __eq__(self, o): return 42` 会触发 `PyObject_RichCompareBool` 的 TypeError。

#### 本章结论

NaN 破坏 dict 检索、可变 key 被禁止、类型不匹配回退到身份比较、__eq__ 必须返回 bool。

### 运算符重载的工程取舍

kicker: "05 · ENGINEERING"

`do_richcompare` 的多分派是 Python 灵活性的代价，但一次 `==` 不一定会调用两边：左操作数若给出明确结果即可结束，只有 `NotImplemented` 或子类优先规则才继续尝试。高性能场景中的优化策略：
- **提前做身份快速通道**：如果 `v is w` 且操作是 `==` 或 `!=`，直接返回（CPython 本身不优化此路径，但用户代码可以）。
- **`__eq__` 返回 `NotImplemented` vs 返回 `False`**：前者让解释器尝试反向比较，后者提前终止——自定义类混用时要注意。
- **先量测再优化**：类型与对象布局是解释器内部策略；热点比较先用 profile 定位，再选择更合适的数据模型或算法，不能依赖某个 slot 调度细节或假设所有比较会被同一种 cache 优化。

#### 本章结论

三次尝试是设计取舍；提前身份检查可跳过重载路径；NotImplemented ≠ False。

### 怎么验证：ctypes 观测 is 路径与 type(x).__hash__ 联动

kicker: "06 · VERIFY"

验证 `is` 是地址比较：`def same(a, b): return id(a) == id(b)` 等价于 `a is b`（小整数例外因小整数池，参见 python-01-04）。验证 `__eq__` 与 `__hash__` 联动：`class B: def __eq__(s,o): return True` 后 `hash(B())` 抛 TypeError。验证 dict 的哈希查找不变量：`d = {1: 'a'}; d[1.0] = 'b'` 后 key `1` 和 `1.0` 哈希相同且相等，实际只保留一个 entry。本课示例用 ctypes 直接观测 `is` 路径与自定义类的 `__hash__` 自动置 None。

#### 本章结论

用 id 验证 is 语义、用自定义 __eq__ 验证 hash 置 None、用 dict 验证 hash+eq 联动不变量。

### hash 与 eq 契约的字典不变性

kicker: "07 · ENGINEERING"

dict/set 查找依赖 hash + eq 两步：先用 hash 定位候选 bucket（O(1) 期望），再用 `__eq__` 在桶内确认（最坏 O(n) 但 hash 分布好时实际 O(1)）。**不变量：a == b ⇒ hash(a) == hash(b)**。违反此契约导致 dict「查找错位」：插入时按 `hash(a)` 入桶，查找时按 `hash(b)` 找不同桶，找不到。

CPython 3.14 的 dict 在 hash 冲突时使用「开放定址 + 二次探查」算法（perturb / 5*i + 1 + perturb 的扰动），每个 bucket 状态有 unused/used/dummy 三种。dummy 状态是删除后留下的「墓碑」——不指向真实数据但仍参与探查，避开放址链断裂。

陷阱：自定义 `__eq__` 后若忘记同步 `__hash__`，类创建语义会使 `__hash__ = None`，对象不可做 dict key。它体现的是值相等与散列的一致性合同，不应理解为“解释器在运行中随意改写类”。

#### 本章结论

hash+eq 契约是 dict 不变量；冲突走二次探查；自定义 __eq__ 必须同步 __hash__。

### 可变对象的 hash 陷阱与幽灵 key

kicker: "08 · FAILURE"

`d = { [1,2]: 'a' }` 抛 TypeError（list 不可哈希），但 `d = {}; k = [1,2]; d[k] = 'a'; k.append(3)` 不报错——list 哈希时 `hash(k)` 是某个固定值（基于 list 长度 + 元素 id），dict 不感知后续修改。当 `d.get(k)` 或 `del d[k]` 时，新的 list 哈希值可能不同，找不到 entry——k 成为「幽灵 key」：dict 中仍存在但无法用任何引用访问。

`WeakKeyDictionary` 是该陷阱的工业级解法：用弱引用做 key，key 被回收时自动从 dict 移除。但 `WeakKeyDictionary` 要求 key 可哈希 + 可弱引用——list 不支持（list 是 mutable atomic，未注册 weakref）。

#### 本章结论

可变对象作 key 会产生幽灵；用 id() 而非可变对象作 key；或用 WeakKeyDictionary 配合不可变 key。

## 核心机制

- `is` = `(PyObject*)a == (PyObject*)b`（指针相等），O(1)。
- `==` = `do_richcompare` 三次尝试（w→v→swap+w），走 `tp_richcompare` slot。
- `hash()` = `tp_hash` slot；未覆写的 object 身份哈希由当前实现生成，不把具体指针混合算法当作 Python 合同。
- `__eq__` 自定义 → `__hash__` 自动 None（不可哈希）。
- dict 查找 = hash(key) 定位 + `__eq__` 确认；hash 值变化后 key 幽灵化。
- NotImplemented 是「不认识你的类型，请对方接管」的协议信号，不是异常。

## 常见误区

- 以为 `is` 可以替代 `==` 做值比较；`is` 只比身份，`257 is 257` 可能返回 False。
- 以为自定义 `__eq__` 后 `hash()` 仍可用；CPython 自动置 `__hash__ = None`。
- 以为 `==` 的左右对称是解释器保证的；实际上 `tp_richcompare` 只尝试左右和反向三项。
- 把可变对象放入 dict 再修改；修改后的 key 被幽灵化，只能 `gc.collect()` 后释放。
- 以为 `3 == '3'` 会抛出异常；三次尝试全部 NotImplemented 后对 `==` 回退到身份比较返回 False。

## 实现变体

### 变体 A：默认身份哈希（object 的 __hash__）

useWhen: "不可变且无自定义 __eq__ 的简单类，默认行为已足够。"
tradeoff: "获得：自动可哈希、无需代码；牺牲：哈希基于 id，同值不同实例的哈希不同。"

#### 代码

```python
class Point:
    def __init__(self, x, y): self.x, self.y = x, y
p1 = Point(1, 2)
assert hash(p1) == hash(p1)          # 同一实例同 hash
p2 = Point(1, 2)
assert hash(p1) != hash(p2)          # 不同实例不同 hash（默认身份哈希）
```

### 变体 B：值哈希（自定义 __eq__ + __hash__）

useWhen: "需要按值比较（如坐标类），可放入 set/dict。"
tradeoff: "获得：同值即相等、可哈希；牺牲：必须保证 __eq__ 中用到的字段在对象生命周期中不变。"

#### 代码

```python
class Point:
    def __init__(self, x, y): self._x, self._y = x, y
    def __eq__(self, o): return self._x == o._x and self._y == o._y
    def __hash__(self): return hash((self._x, self._y))
s = {Point(1, 2), Point(1, 2)}
assert len(s) == 1                  # 同值去重
```

## 可运行示例

```python
import ctypes, sys

# python-01-01 的头部工具
class PyObjectHead(ctypes.Structure):
    _fields_ = [("ob_refcnt", ctypes.c_ssize_t), ("ob_type", ctypes.c_void_p)]

# ---- 断言 1：is = id 相等 ----
a = [1, 2]; b = a; c = [1, 2]
assert (a is b) and (a is not c)
assert (a is b) == (id(a) == id(b))

# ---- 断言 2：== 走 tp_richcompare（3 == 3.0）----
assert 3 == 3.0 and 3.0 == 3         # float 认识 int，双向通过

# ---- 断言 3：NotImplemented 语义 ----
class OnlyRight:                     # 只接受右操作数比较
    def __eq__(self, o): return NotImplemented if type(o) is not OnlyRight else True
class OnlyLeft:                      # 只接受左操作数比较
    def __eq__(self, o): return True if isinstance(o, OnlyRight) else NotImplemented
assert OnlyRight() == OnlyLeft()     # 右返回 NotImplemented，左接管

# ---- 断言 4：__eq__ 自定义 → __hash__ 自动 None ----
class HasEq:
    def __eq__(self, o): return True
try:
    hash(HasEq())
    assert False, "应抛 TypeError"
except TypeError:
    pass                             # 不可哈希

# ---- 断言 5：dict key 的 hash+eq 联动 ----
d = {}
d[1] = 'a'
d[1.0] = 'b'                         # hash(1) == hash(1.0) 且 1 == 1.0
assert len(d) == 1 and d[1] == 'b'   # 1 和 1.0 是同一个 dict entry

# ---- 断言 6：NaN 破坏 dict 检索 ----
nan_dict = {float('nan'): 'value'}
assert float('nan') not in nan_dict  # hash 定位成功但 == 永远 False
```

## 搭积木复现

### 积木 1：实现身份比较（is 语义）

实现 `is_same(a, b) = (id(a) == id(b))`，用 list 和 int 的引用/值场景断言。

### 积木 2：实现富比较三次尝试模型

模拟 `do_richcompare`：尝试右/左/swap 三次，失败时对 `==` 回退身份比较。

### 积木 3：实现 __eq__ 与 __hash__ 联动

实现类装饰器：若 `__eq__` 被定义且无 `__hash__`，自动设 `__hash__ = None`。

### 积木 4：实现 dict key 查找模型

用 `hash(key)` + `bucket[key]` + `is/==` 三重模拟 dict 查找；验证 NaN key 幽灵化。

### 积木 5：对照上游源码

对照 Objects/object.c v3.14.6：`do_richcompare`（L1046-1090）、`PyObject_RichCompareBool`（L1119-1147）、`PyObject_Hash`（L1139-1167）；说明本课省略的 `_Py_SwappedOp` 数组与 traceback 错误信息——生产实现在三次尝试全失败后对 `==`/`!=` 回退到身份比较，并在 `PyObject_RichCompareBool` 中对非布尔结果抛 TypeError。

### 积木 6：把可变 key 变成回归失败

实现一个故意违反契约的类：先用稳定字段计算 `__hash__`，放进 dict 后再修改该字段。观察 `key in mapping` 与遍历结果可能互相矛盾，然后删除这个设计并改用冻结 dataclass 或身份哈希。这里的目标不是背诵“不要可变”，而是亲手证明 dict 的探测位置由旧 hash 决定，值相等无法挽回已经选错的 bucket。

### 跨实现边界：只依赖语言契约，不依赖 slot 次序

kicker: "09 · BOUNDARY"

语言层承诺的是 `is` 比较身份、相等对象必须具有相等 hash、`NotImplemented` 允许解释器选择后续回退；它没有承诺某个实现一定有 `do_richcompare`，更没有承诺“右操作数先于左操作数”会以同一段 C 代码发生。CPython v3.14.6 的三次 slot 尝试很适合解释真实调试现象，PyPy 或未来 CPython 可以采用不同的内部组织，只要可观察的比较合同保持。

工程代码因而应测试可观察合同：相同值 key 覆盖、不同值 key 并存、没有 hash 的可变值对象抛 `TypeError`，以及 `NotImplemented` 触发对方实现或最终的默认结果。把 `_Py_SwappedOp` 的分派顺序写进业务断言，会把一次源码阅读错误地升级成兼容性依赖。

#### 本章结论

源码调用链用于解释和定位；跨实现 API 只能依赖数据模型声明的身份、相等与 hash 不变量。

## 自检

### 问题

`d = {1: 'int', True: 'bool'}` 后 `d[1]` 返回什么？解释 `hash(1)` 与 `hash(True)` 的关系、`1 == True` 的真假，以及 `is` 在这三者中的角色。为什么 `<class 'bool'>` 是 `<class 'int'>` 的子类？这与 dict 查找有何关系？

### 站内答案

结论：`d[1]` 返回 `'bool'`，因为 `True` 是 `int` 的子类且 `hash(1) == hash(True)`、`1 == True`（`bool` 的 `__eq__` 继承自 `int`），`d[True] = 'bool'` 覆盖了 `d[1] = 'int'`。机制：`bool` 继承 `int.__hash__` 和 `int.__eq__`，所以 `hash(True) == hash(1) == 1` 且 `True == 1`；dict 插入时先算 hash 再逐 bucket 用 `==` 比较，遇到相等 key 时替换 value。`True is 1` 为 False（不是同一对象），但 dict 不关心 `is`。源码证据：`do_richcompare`（Objects/object.c L1046）展示 CPython 的 slot 回退，内置 bool/int 的语言语义保证这组值相等。可运行验证：`d = {1: 'int', True: 'bool'}; print(d[1])` 输出 `bool`；`hash(1) == hash(True)` 为 True；`1 == True` 为 True；`1 is True` 为 False。工程取舍：bool 作为 int 子类允许 `True + True == 2`，也使整数与布尔混作 key 时失去区分；代码中应避免混用。实现边界在于 slot 调用和哈希混合方式，值语义本身不依赖 CPython。

## 更新日志

### 署名纠正：Python PR #26/#27 的真实运行身份

at: "2026-08-02T19:48:47+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "OpenAI Codex · GPT-5.6 Luna"
summary: "纠正本课在 Python PR #26/#27 中误用的历史自动化署名；正文、源码证据、示例、视觉与原有日志均保持不变，并补充 PR 前运行身份确认门禁。"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/28"
commit: "47616c9"

### 按深度协议全面重写

at: "2026-08-01T21:15:00+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "WorkBuddy · DeepSeek-V4-Flash"
summary: "按深度课程协议全面重写：基于 CPython v3.14.6 Objects/object.c（8594736f）的 do_richcompare/PyObject_Hash，增加分章正文（三次尝试、哈希联动、NaN/可变key四种失败）、真实源码节选、可运行示例与视觉索引。旧版为 foundation 短文。"
