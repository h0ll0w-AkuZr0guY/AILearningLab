---
id: "python-02-05"
track: "python"
title: "对象形状演化：__slots__、weakref、copy 与生命周期边界"
depth: "deep"
visualIndex: "../visuals/python-02-05.md"
exampleLanguage: "python"
readingMinutes: 44
sourceMinutes: 22
practiceMinutes: 30
reviewMinutes: 14
---

## 官方入口

title: "Python 3.14 数据模型 · object.__slots__"
url: "https://docs.python.org/3.14/reference/datamodel.html#object.__slots__"

官方文档说明，`__slots__` 为声明的实例变量预留空间，并默认阻止自动创建 `__dict__` 与 `__weakref__`；若需要弱引用，必须显式声明 `'__weakref__'` 或从父类继承该能力。[weakref 文档](https://docs.python.org/3.14/library/weakref.html) 说明弱引用不会保持对象存活，[copy 文档](https://docs.python.org/3.14/library/copy.html) 区分 shallow 与 deep copy 并用 memo 处理递归对象。版本边界为 Python 3.14 / CPython v3.14.6。

## 真实源码

repo: "python/cpython"
file: "Objects/typeobject.c / Objects/weakrefobject.c / Lib/copy.py"
symbol: "type_new_slots / type_new_slots_impl / _deepcopy_tuple / _reconstruct"
language: "c / python"
url: "https://github.com/python/cpython/blob/v3.14.6/Objects/typeobject.c#L4086-L4179"

### 逐段讲解

- `type_new_slots`（typeobject.c L4155-L4179）先计算父类是否已有 dict 或 weakref 偏移；未声明 slots 的情况才请求自动添加两者，声明 slots 时转入专门处理。
- `type_new_slots_impl`（L4125-L4150）拒绝可变长内建类型的非空 slots，收集、复制 slot 名称后处理次级基类带来的 dict/weakref 布局。
- weakrefobject.c L10-L20 明确 free-threaded 构建中 weakref、本体和弱引用链表的可变状态需要保护，说明弱引用回调不是无成本的“自动清理钩子”。
- copy.py L13-L40 说明 shallow copy 放入相同子对象，deep copy 递归复制并用已复制对象表避免循环；L181-L208 展示 tuple 与 method 的具体 dispatch，L228-L271 在重建后写入 dict 与 slot state。

### 源码节选

```c
// Objects/typeobject.c，CPython v3.14.6
ctx->may_add_dict = (ctx->base->tp_dictoffset == 0);
ctx->may_add_weak = (ctx->base->tp_weaklistoffset == 0 &&
                     ctx->base->tp_itemsize == 0);
if (ctx->slots == NULL) {
    if (ctx->may_add_dict) ctx->add_dict++;
    if (ctx->may_add_weak) ctx->add_weak++;
} else if (type_new_slots_impl(ctx, dict) < 0) {
    return -1;
}
if (ctx->nslot > 0 && ctx->base->tp_itemsize != 0) {
    PyErr_Format(PyExc_TypeError,
                 "nonempty __slots__ not supported for subtype of '%s'",
                 ctx->base->tp_name);
    return -1;
}
PyObject *new_slots = type_new_copy_slots(ctx, dict);
if (new_slots == NULL)
    return -1;
Py_XSETREF(ctx->slots, new_slots);
ctx->nslot = PyTuple_GET_SIZE(new_slots);
type_new_slots_bases(ctx);
return 0;
```

`Lib/copy.py` 的 CPython v3.14.6 语义摘要：shallow copy 新建外壳并装入相同子对象；deep copy 用 `memo[id(original)] = clone` 递归复制并避免循环。它是补充解释，不与上面的 C 源码节选竞争解析入口。

删减说明：省略 slot 名称冲突、ABI 偏移计算和 copy 对所有内建类型的分派表；保留“类创建时决定对象形状”“弱引用不拥有对象”“深拷贝用 memo 保留图拓扑”的核心证据。

## 导读

给类写上 `__slots__ = ("x", "y")` 后，许多人只记住“省内存”，随后在运行时加缓存字段、订阅弱引用或深拷贝循环对象时才发现对象形状已经是 API 的一部分。slots 把字段名变成类创建时安装的 descriptor，也改变动态扩展、序列化、弱引用和继承的边界；它并未替代所有权设计。

学习者读完文字后仍看不见的，是实例是否有字典、弱引用是否握住对象、浅拷贝和深拷贝的边怎样指向。状态图把对象、子对象、copy 产物与 weakref 分开，逐步显示强边、弱边和 memo；图只是对象图教学模型，最终以示例的收集与身份断言为准。

此课将 slots、weakref、copy 合并，是因为三者共同回答“对象有哪些可存字段、谁让它活着、复制后哪些边保留”。终结器、引用计数与循环 GC 的运行时细节已在模块 01 建立，本课只引用它们来界定 API 生命周期。

## 分章正文

### `__slots__` 改变的可观察行为

kicker: "01 · OBSERVE"

```python
class Point:
    __slots__ = ("x", "y")
    def __init__(self, x, y): self.x, self.y = x, y

p = Point(1, 2)
assert not hasattr(p, "__dict__")
try:
    p.label = "origin"
except AttributeError:
    pass
else:
    raise AssertionError("未声明的字段不应被接受")
```

这里不是实例“被冻结”，而是只有声明的实例存储位置可写；`p.x` 仍可从 1 改为 3。类字典中会出现为 x/y 创建的 member descriptor，因而 slots 本身也连接到上一课的 descriptor 优先级。把 `Point.x = 0` 作为“默认值”会覆盖该类属性名称而破坏 slot descriptor，不应当这样设置默认实例值；应在 `__init__` 或工厂中赋值。

子类是重要反例：如果子类没有再定义 `__slots__`，它通常会重新获得 `__dict__` 与 `__weakref__`。因此“父类 slots 了，整条继承链就紧凑”不成立，必须检查实际子类声明。

#### 本章结论

slots 限定的是实例可存属性集合并在类级创建 descriptor；它不使值不可变，也不会自动约束未声明 slots 的子类。

### 对象形状、父类与多继承模型

kicker: "02 · MODEL"

一个普通 Python 实例可用“对象头 + 属性存储”理解；slots 类把某些属性位置在类型创建时固定下来。官方文档不承诺具体字节布局，也不要求每个解释器使用相同的内部表示，所以课程不把对象大小、slot 偏移或“slots 一定快多少”写成断言。可观察契约是：声明名可读写，未声明名在没有字典时抛 `AttributeError`，声明 `'__dict__'` 可恢复动态字段，声明 `'__weakref__'` 可恢复弱引用能力。

继承时父类 slots 可被子类使用；若父类没有 slots，子类实例本来就可得到字典，子类再写 slots 只能新增固定名，不能移除已继承的字典能力。多个带实际 slot 布局的父类通常不能随意多继承，官方文档要求最多一个父类提供属性创建的 slots，冲突会以 `TypeError` 暴露。这与上一课的 C3 是否能逻辑线性化是两道独立检查。

```python
class Flexible:
    __slots__ = ("x", "__dict__", "__weakref__")
```

`Flexible` 是显式选择：固定核心字段，同时允许插件字段和弱引用。它并非“最佳组合”，而是用更多存储与更宽 API 换兼容性。

#### 本章结论

slots 是类创建时的对象形状契约；字典、弱引用与多继承布局都必须在继承设计中显式选择。

### 从 `type_new_slots` 读创建期决策

kicker: "03 · SOURCE"

typeobject.c L4157-L4162 先清零添加标记，再根据主要基类的 `tp_dictoffset` 和 `tp_weaklistoffset` 计算是否可以添加 dict/weakref。L4164-L4171 的无 slots 分支尝试自动提供能力；L4172-L4177 的有 slots 分支调用 `type_new_slots_impl`。这表明 slots 的语义在 `class` 创建时由 type 构造流程确定，而不是 `__init__` 每次运行才决定。

`type_new_slots_impl` L4127-L4132 对可变长内建类型的非空 slots 抛 `TypeError`，L4139-L4149 复制 slots 并检查次级基类。源码没有给出“slots 必然节省 N 字节”这类语言承诺，反而显示布局取决于父类、dict、weakref 和类型实现。面对 C 扩展类型、metaclass 或替换解释器，应以公开文档和实测功能为准，不从 CPython 偏移推导可移植设计。

slots 名生成的 descriptor 会走 object.c 的 data descriptor 路径，意味着直接塞入同名 `__dict__` 也不能取代 slot 值。若类同时拥有字典与 slot，同名冲突是设计错误，不应依赖“哪一个恰好获胜”。

#### 本章结论

CPython 在 type 创建阶段统一决定 slots、dict 与 weakref 能力；性能和字节布局不是跨实现契约，字段可达性才是。

### weakref 的所有权与回调失败

kicker: "04 · FAILURE"

弱引用像一张写有对象地址的便签，而不是把对象装进盒子的手。`r = weakref.ref(obj)` 后 `r()` 在对象活着时返回对象，最后一个强引用消失后返回 `None`；若先把 `alive = r()` 保存下来，`alive` 又成为新的强引用，测试就不会收集。示例会在 `del obj` 后 `gc.collect()`，再断言弱值字典的键消失。

slots-only 类默认不能被弱引用。遗漏 `'__weakref__'` 时 `weakref.ref(obj)` 抛 `TypeError`，这是一项 API 兼容性失败，而不是垃圾回收随机性。对象一旦要被 GUI 回调、缓存、观察者系统或 identity map 弱持有，应在初版类型设计中加入该 slot；事后改动 slots 可能影响序列化和 `__class__` 赋值兼容性。

弱引用 callback 也不应做复杂工作。回调执行时目标已不可安全使用，异常会打印到 stderr 而不能可靠传播给业务调用者；线程、解释器关闭和对象终结顺序都使“在 callback 里关闭资源”脆弱。资源应由显式 `close()`、context manager 或所有者协议管理，weakref 只用于缓存和观察关系。

#### 本章结论

弱引用不拥有目标且可能随时失效；slots 类若要支持它必须预留 `__weakref__`，资源释放不应依赖弱引用回调。

### shallow、deep 与对象图拓扑

kicker: "05 · MODEL"

`copy.copy(parent)` 创建新的外层对象，却把其成员边仍指向原来的子对象。若 `parent.items` 是 list，两个 parent 的 `items is` 为真，修改 list 会同时可见。`copy.deepcopy(parent)` 递归复制可复制子对象，并用 memo 记录 `id(original) -> clone`，所以共享子对象在拷贝后仍共享同一个新对象，环也不会无限递归。

```python
shared = []
graph = [shared, shared]
clone = copy.deepcopy(graph)
assert clone[0] is clone[1]
assert clone[0] is not shared
```

这一断言揭示 deep copy 目标是保留对象图关系，而不是“把每一条路径都复制一次”。copy.py L34-L40 正是用表避免递归并允许用户类控制复制；L235-L252 在创建新对象后把 state 和 slotstate 填回。若对象含文件、锁、socket、线程或数据库连接，盲目 deep copy 通常没有业务意义，应明确拒绝、重新连接或复制不可变配置。

#### 本章结论

shallow 复制外壳而共享子对象；deep copy 用 memo 复制图并保留共享与环，不能替代资源生命周期设计。

### 自定义复制与演化边界

kicker: "06 · ENGINEERING"

业务类若有缓存、锁或外部句柄，应写 `__copy__` 和 `__deepcopy__(memo)` 明确哪些状态共享、哪些重建、哪些禁止。例如配置对象可以深拷贝可变字典而共享不可变 schema；数据库会话则应抛 `copy.Error`，要求调用者新建会话。自定义 `__deepcopy__` 必须先把新对象登记进 memo，再递归子字段，否则环重新出现。

slots 使反射式复制更需谨慎。只调用 `vars(obj)` 会遗漏 slot 值；依赖 copy 模块的默认机制或显式列出 slots 更可靠。类增加新 slot 后，`__getstate__`、`__setstate__`、pickle、dataclass 导出和旧数据迁移都要重新审计。对象形状演化不是内部重构，持久化和插件可能已经把字段当成协议。

可变默认值同样是对象图问题。把 `items = []` 写在类属性会让所有实例共享列表；slots 不能修复这个错误，应在构造时新建。把该列表 deep copy 只会在复制时断开共享，无法补救原先不正确的所有权。

#### 本章结论

复制协议要声明状态和资源的所有权；slots 演化会影响序列化与反射，新增字段必须作为兼容性变更测试。

### 工程选择与性能证据

kicker: "07 · ENGINEERING"

选择 slots 的合理理由是大量同构对象、固定字段、禁止拼写错误的动态属性，且团队接受更窄的继承与扩展边界。选择普通字典的合理理由是插件、ORM、调试元数据、动态 schema 或向后兼容字段；不用为了猜测微小内存收益而过早收窄 API。测量要比较真实对象数量、访问模式、总内存和开发成本，不能从单个 `sys.getsizeof` 结果外推整个进程。

弱缓存用 `WeakValueDictionary` 只在“缓存不拥有值”时正确。如果缓存的命中逻辑隐含值必须永久存在，它会在 GC 后产生间歇性 miss，应改用强缓存和明确淘汰策略。copy 则应被视为语义操作而非性能快捷键：外层 clone、子对象共享、深复制的峰值内存和资源可复制性都要写入 API 合同。

free-threaded CPython 的 weakref 源码开头要求保护多份可变状态，也提醒我们不要把字典复合操作、weak cache 检查和对象创建误当全局原子。跨线程共享缓存需要锁或并发容器，并在真正目标解释器上测试。

#### 本章结论

slots、weak cache 和 copy 的选择来自形状、所有权与并发合同；性能结论必须来自目标负载测量。

### 六步对象图复现

kicker: "08 · BUILD"

第一步实现只含 `x` 的 slots 类并捕获动态赋值 `AttributeError`。第二步加入 `__dict__`，比较动态字段恢复。第三步分别创建无 `__weakref__` 与有该 slot 的对象，验证前者 weakref 失败、后者可被 `WeakValueDictionary` 收集。第四步创建一个共享 list 的父对象，验证 shallow copy 共享边。第五步 `deepcopy` 同一对象图，验证新图仍保留共享关系而与旧图断开。第六步为含环的节点实施自定义 deepcopy，并先登记 memo。

每一步都回读 [type_new_slots L4086-L4179](https://github.com/python/cpython/blob/v3.14.6/Objects/typeobject.c#L4086-L4179)、[weakref 的并发状态注释](https://github.com/python/cpython/blob/v3.14.6/Objects/weakrefobject.c#L10-L20) 和 [copy.py 的图语义](https://github.com/python/cpython/blob/v3.14.6/Lib/copy.py#L13-L49)。真实示例包含正常与失败断言，避免只观察一次偶然的垃圾回收时机。

#### 本章结论

从字段可写性、弱引用存活、浅复制共享、深复制拓扑到循环 memo，六步实验覆盖对象形状的完整边界。

### 验收与版本边界

kicker: "09 · VERIFY"

运行 `python examples/python/06_slots_weakref_copy.py`。通过条件是：slots 类拒绝未声明字段；声明 `__weakref__` 的类可被弱引用且失去强引用后缓存清空；shallow copy 共享嵌套列表；deep copy 既分离原列表又保持 clone 内部共享；无 weakref slot 的类抛 `TypeError`。显式 `gc.collect()` 仅让测试可重复，不代表业务代码应手动驱动生命周期。

升级 Python 时复核 `__slots__`、weakref、copy 官方文档，并重新固定 `type_new_slots`、weakrefobject 和 copy.py 行。课程不承诺各构建的对象字节数、收集具体时刻或 slot 内存偏移；可观察的字段、弱所有权和复制拓扑是验收标准。

#### 本章结论

通过运行断言验证形状与边关系，不能用对象大小或某次 GC 时序替代；版本升级同时审查语言协议和实现证据。

## 核心机制

- `__slots__` 在类创建时安装字段协议，并默认阻止自动创建实例字典和 weakref 支持。
- 声明 `'__dict__'` 或 `'__weakref__'` 是显式兼容性选择；未声明 slots 的子类可重新获得动态字段。
- weakref 不持有目标，`r()` 可返回 `None`；回调不适合承担资源关闭。
- shallow copy 保留到子对象的边，deep copy 用 memo 复制对象图并保留共享与环。
- slots、复制和弱缓存都改变外部可观察行为，属于对象 API 演化而非纯内存优化。

## 常见误区

- 以为 slots 让对象不可变；声明字段仍可重新赋值。
- 以为所有 slots 子类都没有 `__dict__`；未声明 slots 的子类通常会有。
- 以为弱引用会替你可靠关闭资源；它只是不拥有对象，回调时机和错误不适合业务事务。
- 以为 deep copy 把每个引用路径独立复制；memo 会保留共享关系并处理环。
- 只用 `vars(obj)` 复制状态；slots-only 对象可没有字典，导致字段遗漏。

## 实现变体

### 变体 A：严格 slots 值对象

useWhen: "对象数量大、字段固定、插件和运行时附加状态不被允许。"
tradeoff: "获得：更窄的形状和拼写错误防护；牺牲：动态扩展、部分继承与工具反射需要额外设计。"

#### 代码

```python
class Coordinate:
    __slots__ = ("x", "y")
    def __init__(self, x, y):
        self.x, self.y = x, y
```

### 变体 B：可扩展且可弱持有的对象

useWhen: "核心字段固定，但需要插件元数据、观察者或弱缓存。"
tradeoff: "获得：动态字段与 weakref 兼容；牺牲：额外存储及更宽的 API 边界。"

#### 代码

```python
class ExtensibleNode:
    __slots__ = ("key", "__dict__", "__weakref__")
    def __init__(self, key): self.key = key
```

## 可运行示例

```python
import copy
import gc
import weakref

class Slotted:
    __slots__ = ("items", "__weakref__")
    def __init__(self, items): self.items = items

obj = Slotted(["a"])
assert not hasattr(obj, "__dict__")
ref = weakref.ref(obj)
shallow = copy.copy(obj)
deep = copy.deepcopy(obj)
assert shallow.items is obj.items
assert deep.items == obj.items and deep.items is not obj.items
cache = weakref.WeakValueDictionary(); cache["obj"] = obj
del obj; gc.collect()
assert ref() is None and "obj" not in cache

class NoWeak:
    __slots__ = ("x",)
try:
    weakref.ref(NoWeak())
    raise AssertionError("缺少 __weakref__ 应失败")
except TypeError:
    pass
print("python-02-05 assertions passed")
```

## 搭积木复现

### 积木 1：声明固定字段

建立 `Coordinate.__slots__`，写入 x/y，再尝试未声明字段并捕获 `AttributeError`。这验证的是字段契约，不测字节数。

### 积木 2：比较有无 `__dict__`

在第二个类声明 `"__dict__"`，验证该类可附加调试标签。明确这是选择宽 API，而非无代价开关。

### 积木 3：验证 weakref 能力

对缺少和包含 `"__weakref__"` 的 slots 类分别调用 `weakref.ref`，捕获前者 `TypeError`。

### 积木 4：构造弱值缓存收集案例

将对象放进 `WeakValueDictionary`，删除唯一强引用并收集，再断言键消失；避免持有 `ref()` 的返回值。

### 积木 5：比较 shallow 与 deep

让 slots 对象持有 list，断言 `copy.copy` 共享 list、`deepcopy` 新建 list。随后用 `[shared, shared]` 验证 deep copy 保留新图的共享。

### 积木 6：对照源码并加入资源边界

把 dict/weakref 决策对照 type_new_slots，把 memo 对照 copy.py；为文件或锁等资源类型写出拒绝复制或显式重建的合同，不以 weakref callback 关闭它们。

## 自检

### 问题

一个 slots-only 类为什么可能在 `weakref.ref(obj)` 处抛 `TypeError`？`deepcopy([shared, shared])` 为什么应满足 `clone[0] is clone[1]`，却不应满足 `clone[0] is shared`？

### 站内答案

结论：slots 默认没有 weakref 存储位置；若类及其父类未提供 `'__weakref__'`，创建弱引用会抛 `TypeError`，应在类型 API 中显式声明该 slot。`deepcopy` 维护 original id 到 clone 的 memo，第一次复制 `shared` 后，第二条边复用同一 clone，所以 `clone[0] is clone[1]`；该 clone 是新对象，故不与原 `shared` 同一。源码证据是 [type_new_slots](https://github.com/python/cpython/blob/v3.14.6/Objects/typeobject.c#L4155-L4179) 与 [copy.py 的 memo 说明](https://github.com/python/cpython/blob/v3.14.6/Lib/copy.py#L13-L40)。可运行示例验证 weak cache、shallow/deep 及失败断言。工程上，资源要显式管理，copy 和 weakref 只表达对象图与所有权，不能取代关闭协议。

## 更新日志

### 模块 02 对象形状与生命周期边界深度重建

at: "2026-08-02T12:00:00+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "WorkBuddy · DeepSeek-V4-Flash"
summary: "新增专家课：固定 CPython v3.14.6 slots、weakref 与 copy 源码，补足九章正文、六步对象图复现、严格/可扩展形状变体、弱引用与复制失败断言和对象关系视觉。"
