---
id: "python-02-02"
track: "python"
title: "Descriptor 优先级：data、non-data 与 property 的遮蔽规则"
depth: "deep"
visualIndex: "../visuals/python-02-02.md"
exampleLanguage: "python"
readingMinutes: 42
sourceMinutes: 22
practiceMinutes: 26
reviewMinutes: 10
---

## 官方入口

title: "Python 3.14 Descriptor Guide · 描述器调用与优先级"
url: "https://docs.python.org/3.14/howto/descriptor.html#overview-of-descriptor-invocation"

官方描述器指南将定义 `__get__`、`__set__` 或 `__delete__` 的类变量称为 descriptor，并规定 data descriptor 优先于实例字典，而只有 `__get__` 的 non-data descriptor 可被实例字典遮蔽。[`__set_name__`](https://docs.python.org/3.14/howto/descriptor.html#automatic-name-notification) 在类创建期自动通知声明位置。版本边界是 Python 3.14 / CPython v3.14.6；“data”的 Python 协议解释以官方文档为准，底层槽位判定以固定 tag 源码为证。

## 真实源码

repo: "python/cpython"
file: "Objects/object.c / Objects/descrobject.c"
symbol: "_PyObject_GenericGetAttrWithDict / PyDescr_IsData / property_descr_get / property_descr_set"
language: "c"
url: "https://github.com/python/cpython/blob/v3.14.6/Objects/object.c#L1841-L1916"

### 逐段讲解

- object.c L1841-L1854 先在类型 MRO 中取 `descr`，读其 `tp_descr_get`；`f != NULL && PyDescr_IsData(descr)` 时，在实例存储前调用 getter。
- descrobject.c L1029-L1032 的 `PyDescr_IsData` 只检查 descriptor 类型是否具有 `tp_descr_set`。这包括设置器会抛错的只读 property。
- object.c L1886-L1901 只有 data 分支未返回时才查实例值；L1903-L1916 再调用 non-data descriptor 的 getter 或返回普通类对象。
- property 的 `property_descr_get`（L1661-L1694）在实例读取时调用 `fget`；`property_descr_set`（L1697 起）即使没有 setter 也负责构造 `AttributeError`，使 property 仍具有数据描述器的写入槽。

### 源码节选

```c
// Objects/descrobject.c，CPython v3.14.6
int
PyDescr_IsData(PyObject *ob)
{
    return Py_TYPE(ob)->tp_descr_set != NULL;
}

// Objects/object.c：data descriptor 在 dict 之前
if (descr != NULL) {
    f = Py_TYPE(descr)->tp_descr_get;
    if (f != NULL && PyDescr_IsData(descr))
        res = f(descr, obj, (PyObject *)Py_TYPE(obj));
}
if (dict != NULL) {
    Py_INCREF(dict);
    int rc = PyDict_GetItemRef(dict, name, &res);
    Py_DECREF(dict);
    if (res != NULL)
        goto done;
}
// 之后才调用 non-data 的 f(descr, obj, type)
```

删减说明：省略 `property` 的 docstring、setter/deleter 复制构造及错误消息格式；保留的是判定 data 的 C 槽、调用时机以及无 setter 的失败语义。

## 导读

`obj.__dict__["name"] = "手工值"` 后 `obj.name` 仍可能没有变化。这不是字典写入失败，而是点号读取先把同名 data descriptor 当作一段可执行协议。把“类属性永远被实例属性覆盖”当规则，会让 property 校验、字段映射和 ORM 数据加载显得不可预测。

学习者读完优先级文字后仍看不见的，是两个同名格子为何会在同一步由不同候选赢得。状态视觉把类字典的 descriptor、实例存储与返回值拆开，逐步切换 data 和 non-data；观察目标是顺序，绝非把解释器画成一个真实内存图。

本课聚焦“谁先得到读取权”。下一节解释函数为什么也是 non-data descriptor 并生成绑定方法；本课只用它作为优先级的一个实例，不重复其绑定细节。

## 分章正文

### 同名字段为何看似失效

kicker: "01 · OBSERVE"

```python
class Celsius:
    @property
    def value(self):
        return 20

c = Celsius()
c.__dict__["value"] = 999
assert c.value == 20
assert c.__dict__["value"] == 999
```

两条断言同时为真并不矛盾。`__dict__` 的读写是对存储容器的直接操作，`c.value` 是完整属性解析。`property` 作为类中的对象有 getter 与 C 层设置槽，被判为 data descriptor，于是读取在字典前结束。直接字典写入留下了一个永远不会经由点号赢得读取的 shadow 值；这正是生产代码应避免绕过受控字段的原因。

若把 property 换成只有 `__get__` 的自定义 descriptor，实例字典便先赢。这个差异不是“property 更特殊”，而是 data/non-data 这一个协议分界。

#### 本章结论

点号访问和直接操作 `__dict__` 是两条不同路径；data descriptor 可以压过同名实例项。

### 用协议定义 data 与 non-data

kicker: "02 · MODEL"

描述器通常作为类变量出现。它定义 `__get__` 时可以重写读取，定义 `__set__` 或 `__delete__` 时还可以控制写入或删除。教学上可写成：

```python
class NonData:
    def __get__(self, obj, owner=None): ...

class Data:
    def __get__(self, obj, owner=None): ...
    def __set__(self, obj, value): ...
```

`Data` 的实例读取优先于 `obj.__dict__`，`NonData` 则在字典之后。只读 data descriptor 并不需要真的成功写入：提供一个 `__set__` 并抛 `AttributeError` 就足够。这不是漏洞，而是把“这个名字的写入也必须由协议决定”表达出来。官方指南明确给出这种实现方式，CPython 的 `property_descr_set` 则是标准库内建的同类证据。

descriptor 放进实例字典时不会自动获得这份权力。解释器在类型 MRO 中找到的类属性才会触发这套调用协议；`obj.__dict__["d"] = SomeDescriptor()` 只是把普通对象存成字段。

#### 本章结论

data 的关键是读写槽均由 descriptor 类型参与，哪怕写入总是拒绝；实例里保存的 descriptor 对象不会自动被调用。

### 从 C 槽理解优先级

kicker: "03 · SOURCE"

很多教学代码写 `hasattr(type(descr), "__set__")` 来近似判定，但 CPython 真正检查的是 `Py_TYPE(descr)->tp_descr_set`。descrobject.c L1029 的三行实现短，却把“对象定义了 Python 名称”与“其类型已安装描述器设置槽”区分开。对用户代码，遵循公开协议即可；对源码解释，应以 C 槽而不是一个看起来相似的 `hasattr` 作为事实来源。

object.c 的顺序可直接手推。L1841 在 MRO 取类项；L1846 得到 getter；L1847 如果它是 data 就在 L1848 调用并跳到 `done`。只有没有 data 的情形才进 L1856 之后的实例存储分支。L1903 的第二次 `f(descr, obj, type)` 专门留给 non-data。因而同一个 descriptor 的 `__get__` 并非总在同一时刻执行，时机由是否拥有设置槽决定。

property 也澄清了常见误解。没有 `@x.setter` 的 property 在赋值时抛 `AttributeError`，并没有退化成 non-data；它仍让 property 对象的设置路径掌控同名字段，防止实例字典静默越过只读承诺。

#### 本章结论

源码先按类型槽判定 data，再决定是否读取实例存储；只读 property 的拒绝写入本身维持了 data 优先级。

### `property`、缓存与遮蔽的失败边界

kicker: "04 · FAILURE"

把昂贵计算写成普通 `@property` 意味着每次读取都可能再次计算；把结果塞进同名 `__dict__` 不会缓存它，因为 property 是 data descriptor。正确选择之一是把缓存放到不同的私有名，例如 `_total_cache`，并在修改依赖字段时失效。另一种是 `functools.cached_property`，它的设计是 non-data descriptor：首读把结果写入实例字典，后续由字典遮蔽 descriptor。这个机制适合稳定、可失效的实例计算，不适合每次读取都必须验证的字段。

写验证型 descriptor 时也不要直接 `setattr(obj, self.name, value)`，这会再次触发同一个 descriptor 并递归。应写到私有存储名，如 `obj.__dict__["_" + self.name]`，或通过 `object.__setattr__` 设置该私有名。若对象是 slots-only，descriptor 必须使用已声明的私有 slot，不能假定字典存在。

最后，`vars(C)["field"]` 用于拿到未触发的 descriptor 本体；`C.field` 会以 `obj is None` 的类访问形式调用 `__get__`，具体返回 descriptor 本身、默认值或另一个对象由实现决定。框架注册字段时应选择前者，避免无意执行协议。

#### 本章结论

property 不会被同名缓存字典遮蔽；缓存、私有存储和类级反射都要刻意选择不触发或触发协议的入口。

### 以字段校验器建模数据所有权

kicker: "05 · ENGINEERING"

一个 `PositiveInt` descriptor 可把“这个字段必须是正整数”集中在类型声明处，而不是散落在每个业务方法。它在 `__set_name__` 记住公开名和私有名，`__set__` 验证，`__get__` 读取私有值。这样 `order.quantity = -1` 的失败发生在写边界，读取者不会看到不合法中间状态。

代价是调试与序列化更复杂：`vars(order)` 显示的是 `_quantity` 而非 `quantity`，而字段的公开行为藏在类字典。团队需要把这个映射纳入日志、迁移和 schema 工具；否则会出现“JSON 少了字段”或复制时漏掉私有状态的事故。简单数据载体若没有跨调用点的验证需求，使用 dataclass 的普通字段更直接。

不要在 descriptor 对象本身存每个实例的值。类变量只创建一份 descriptor，若写 `self.value = value`，所有实例会互相覆盖。值必须存入 `obj` 或由 `WeakKeyDictionary` 等按实例隔离的容器管理，后者又带来 weakref 支持和并发边界。

#### 本章结论

descriptor 适合集中跨实例字段协议，私有存储名要被工具链理解；共享 descriptor 本体不能保存单个实例状态。

### 两个变体的适用界线

kicker: "06 · ENGINEERING"

验证型 data descriptor 适合金额、单位、权限等每次写都不可绕过的领域不变量。它获得集中校验和一致错误，牺牲的是反射、序列化和调试复杂度。非数据的惰性缓存适合不可变输入导出的昂贵派生值，它获得“计算一次后像普通实例字段一样快”的路径，牺牲的是必须有清晰失效策略。

在多线程或 free-threaded CPython 上，描述器的多步逻辑不是自动事务。`if cache missing: compute; store` 可能被并发执行两次；若计算有副作用或缓存必须单次构造，使用锁、单飞请求或外部事务表达该边界。课程不能因普通 CPython 构建的 GIL 观测而承诺上述复合操作跨实现原子。

同名遮蔽还影响 API 演化：把普通类属性改成 property 会让已有实例字典中的同名值失去读取权；把 property 改成普通字段则可能暴露过去的 shadow 值。迁移前需要扫描持久化数据、提供版本化加载逻辑并写回归测试。

#### 本章结论

选择 data 或 non-data 的本质是选择谁拥有同名字段的最终解释权，同时也选择缓存、迁移和并发责任。

### 搭积木验证优先级表

kicker: "07 · BUILD"

先制作 `Data` 和 `NonData`，让两者都记录 `__get__` 调用；再在同一实例字典写入同名值。运行时 data 的日志出现且返回 descriptor 值，non-data 的日志不出现且返回实例值。然后添加只读 `property`，尝试赋值，确认得到 `AttributeError` 而非静默创建实例项。

这一组实验仅验证公开协议。把 `vars(Class)[name]` 与 `getattr(Class, name)` 的结果并排打印，才可看见“类字典中的原对象”和“类访问触发后的返回值”不同。最后回读 object.c L1841-L1916，将每一条观察映射到 data、dict、non-data 三个源码区段。

#### 本章结论

同名实验必须同时观察类字典、实例字典和点号结果；只看最终字符串无法证明优先级。

### 验收与升级检查

kicker: "08 · VERIFY"

执行 `python examples/python/03_descriptors.py`。正常断言覆盖 data 压过实例值、non-data 被实例值压过、只读 property 拒绝赋值、`__set_name__` 记录私有名和每实例状态隔离；失败断言覆盖负整数写入。验收不依赖 CPython 的地址、缓存或对象大小。

升级 Python 时，先复核 Descriptor Guide 的优先级、property 行为与 `__set_name__` 时机，再把 object.c 和 descrobject.c 链接固定到新 tag。若加入 metaclass、`type.__getattribute__` 或 C 扩展自定义 slot，本课模型只可作为起点，必须分别复验其属性路径。

#### 本章结论

通过条件是同名值在三种协议下给出不同且可预测的结果；版本升级同时复核官方协议和固定源码行。

## 核心机制

- descriptor 作为类变量定义 `__get__`、`__set__` 或 `__delete__`，点号读取会在类树解析中调用它。
- data descriptor 在实例存储前运行；non-data descriptor 在实例存储后运行。
- CPython v3.14.6 用 `tp_descr_set` 判定 data，`PyDescr_IsData` 的定义在 descrobject.c L1029-L1032。
- property 即使没有 setter 也通过设置路径拒绝写入，保持 data descriptor 的优先级。
- `__set_name__` 在类创建时接收 owner 与公开名；后期动态挂载要人工通知或改用显式注册。

## 常见误区

- 以为实例字典一定覆盖所有类属性；data descriptor 是明确反例。
- 以为只读 property 因为不能设置而是 non-data；它会在设置路径抛错，仍优先于字典。
- 在 descriptor 自身保存 `self.value`；一个类变量 descriptor 会被所有实例共享。
- 用 `C.field` 读取未触发的 descriptor 本体；应使用 `vars(C)["field"]` 进行类字典反射。

## 实现变体

### 变体 A：验证型 data descriptor

useWhen: "每次写入都需要集中验证，且公开字段不允许被实例字典绕过。"
tradeoff: "获得：单点不变量和一致异常；牺牲：私有存储、序列化和工具支持都更复杂。"

#### 代码

```python
class PositiveInt:
    def __set_name__(self, owner, name): self.key = "_" + name
    def __get__(self, obj, owner=None): return self if obj is None else getattr(obj, self.key)
    def __set__(self, obj, value):
        if type(value) is not int or value <= 0: raise ValueError("positive int required")
        setattr(obj, self.key, value)
```

### 变体 B：非数据惰性缓存

useWhen: "值由稳定输入导出、重复计算昂贵，且缓存失效策略明确。"
tradeoff: "获得：首读计算、后续实例字典直取；牺牲：同名实例值能遮蔽它，过期处理需要额外设计。"

#### 代码

```python
class Lazy:
    def __init__(self, build): self.build = build
    def __get__(self, obj, owner=None):
        if obj is None: return self
        value = self.build(obj)
        obj.__dict__[self.build.__name__] = value
        return value
```

## 可运行示例

```python
class DataField:
    def __get__(self, obj, owner=None): return "data" if obj is not None else self
    def __set__(self, obj, value): raise AttributeError("read-only")

class NonDataField:
    def __get__(self, obj, owner=None): return "non-data" if obj is not None else self

class Sample:
    data = DataField()
    non_data = NonDataField()
    @property
    def locked(self): return "locked"

s = Sample()
s.__dict__.update(data="instance-data", non_data="instance-non-data", locked="shadow")
assert s.data == "data"
assert s.non_data == "instance-non-data"
assert s.locked == "locked"
try:
    s.locked = "new"
    raise AssertionError("只读 property 应拒绝写入")
except AttributeError:
    pass
print("python-02-02 assertions passed")
```

## 搭积木复现

### 积木 1：定义只含 `__get__` 的 non-data descriptor

让 `NonDataField.__get__` 返回可辨认标记。先在实例字典写入同名键，验证点号返回实例值而 getter 未获胜。

### 积木 2：加入 `__set__` 形成 data descriptor

给相同设计添加 `__set__`，即使它只抛 `AttributeError`。再写同名实例键，验证点号改为返回 descriptor 值。

### 积木 3：直接检查三份状态

同时输出 `vars(Sample)`、`vars(s)` 和 `s.data`。类字典保留 descriptor，实例字典保留 shadow，点号路径按优先级选值。

### 积木 4：实现 `__set_name__` 的私有名映射

创建 `PositiveInt`，在 `__set_name__` 生成 `_quantity`，把值存到对象而非 descriptor。为两个实例写不同数量，确认没有相互覆盖。

### 积木 5：加入校验与 slots 边界

拒绝 `0`、负数和 `bool`，并注意 slots-only 对象若没有声明私有 slot，就不能假定 `__dict__` 可用。该布局边界在第 05 节继续展开。

### 积木 6：对照固定源码

逐项回读 [object.c L1841-L1916](https://github.com/python/cpython/blob/v3.14.6/Objects/object.c#L1841-L1916)、[PyDescr_IsData](https://github.com/python/cpython/blob/v3.14.6/Objects/descrobject.c#L1029-L1032) 与 [property 读取/写入](https://github.com/python/cpython/blob/v3.14.6/Objects/descrobject.c#L1661-L1730)。验证模型顺序与 C 槽、property 失败路径一致。

## 自检

### 问题

一个类有 `field = D()`，其中 `D` 只实现 `__get__`；实例随后执行 `obj.__dict__["field"] = "cache"`。点号结果是什么？若 `D` 再实现一个永远抛 `AttributeError` 的 `__set__`，点号结果又是什么，为什么？

### 站内答案

结论：只有 `__get__` 时，`obj.field` 返回 `"cache"`，因为 `D` 是 non-data descriptor，实例字典在它之前被读取。添加会抛错的 `__set__` 后，`obj.field` 会调用 `D.__get__`，因为它已是 data descriptor；写入能力是否成功不决定读取优先级，设置槽存在才决定。源码证据：object.c 先在 L1846-L1854 判 data，实例值在 L1886-L1901，non-data getter 在 L1903-L1909；`PyDescr_IsData` 只检测 `tp_descr_set`。可运行验证见 `examples/python/03_descriptors.py` 的 `data`、`non_data` 和 `locked` 断言。工程上，缓存描述器要有明确失效方案，验证字段要把值放进每个对象的私有存储。

## 更新日志

### 署名纠正：Python PR #26/#27 的真实运行身份

at: "2026-08-02T19:48:47+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "OpenAI Codex · GPT-5.6 Luna"
summary: "纠正本课在 Python PR #26/#27 中误用的历史自动化署名；正文、源码证据、示例、视觉与原有日志均保持不变，并补充 PR 前运行身份确认门禁。"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/28"
commit: "47616c9"

### 模块 02 描述器优先级深度重建

at: "2026-08-02T12:00:00+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "WorkBuddy · DeepSeek-V4-Flash"
summary: "新增专家课：以 CPython v3.14.6 的 data 槽判定与 property 实现为证据，补足八章正文、六步复现、字段验证与惰性缓存变体、正常与失败断言和优先级状态视觉。"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/26"
