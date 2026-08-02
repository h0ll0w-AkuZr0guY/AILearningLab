---
id: "python-02-01"
track: "python"
title: "属性读取主路径：实例、类、__getattribute__ 与 __getattr__"
depth: "deep"
visualIndex: "../visuals/python-02-01.md"
exampleLanguage: "python"
readingMinutes: 40
sourceMinutes: 22
practiceMinutes: 28
reviewMinutes: 10
---

## 官方入口

title: "Python 3.14 数据模型 · object.__getattribute__ 与 object.__getattr__"
url: "https://docs.python.org/3.14/reference/datamodel.html#object.__getattribute__"

官方协议把 `obj.name` 的总入口定义为 `__getattribute__`，它无条件参与实例属性访问；只有该路径以 `AttributeError` 失败时，`__getattr__` 才有机会提供回退值。[`__getattr__`](https://docs.python.org/3.14/reference/datamodel.html#object.__getattr__) 不是“每次读取后都会执行的监听器”。本课的版本边界是 Python 3.14 与 CPython v3.14.6：解析顺序属于语言可观察语义，实例字典可能是 managed dict 或 inline values 则是 CPython 内部实现。

## 真实源码

repo: "python/cpython"
file: "Objects/object.c / Objects/typeobject.c"
symbol: "_PyObject_GenericGetAttrWithDict / _Py_slot_tp_getattr_hook"
language: "c"
url: "https://github.com/python/cpython/blob/v3.14.6/Objects/object.c#L1809-L1928"

### 逐段讲解

- `_PyObject_GenericGetAttrWithDict`（object.c L1818-L1854）先取对象类型，再在 MRO 中寻找同名类属性；若该属性有 `tp_descr_get` 且 `PyDescr_IsData` 为真，立刻调用它。
- 同一函数（L1856-L1901）随后读取实例存储。v3.14.6 会分别处理 inline values、managed dict 与传统字典指针；这些分支不能简化成“每个实例总有 `__dict__`”。
- L1903-L1916 只在实例存储未命中后调用非数据描述器的 `__get__`，否则原样返回类属性；L1918-L1924 才构造 `AttributeError`。
- `_Py_slot_tp_getattr_hook`（typeobject.c L10382-L10429）以 suppress 模式运行泛型查找；结果为空且没有异常时才调用 `__getattr__`。自定义 `__getattribute__` 抛出的 `AttributeError` 同样可触发这个回退。

### 源码节选

```c
// Objects/object.c，CPython v3.14.6
_PyType_LookupStackRefAndVersion(tp, name, &cref.ref);
descr = PyStackRef_AsPyObjectBorrow(cref.ref);
if (descr != NULL) {
    f = Py_TYPE(descr)->tp_descr_get;
    if (f != NULL && PyDescr_IsData(descr))
        return f(descr, obj, (PyObject *)Py_TYPE(obj));
}
// 这里才读取 inline values、managed dict 或传统实例字典
if (dict != NULL && PyDict_GetItemRef(dict, name, &res) >= 0 && res != NULL)
    goto done;
if (f != NULL)
    res = f(descr, obj, (PyObject *)Py_TYPE(obj));
else if (descr != NULL)
    res = PyStackRef_AsPyObjectSteal(cref.ref);
if (res == NULL && !suppress) {
    PyErr_Format(PyExc_AttributeError,
                 "'%.100s' object has no attribute '%U'",
                 tp->tp_name, name);
    _PyObject_SetAttributeErrorContext(obj, name);
}
```

删减说明：省略类型缓存、free-threaded 的原子读取和错误上下文的辅助函数；它们影响性能与诊断，不改变本课需要手推的优先级。描述器的细分留给下一课，方法绑定留给第 03 节。

## 导读

把 `user.name` 想成“从一个对象里拿字段”会在代理、ORM、延迟加载和调试钩子上立刻失效。它是一条确定的解析流水线：先由 `__getattribute__` 接管，再依次检查类树中更高优先级的协议、实例存储与普通类属性，最后才考虑 `__getattr__`。

学习者读完一段文字后仍看不见的，是同一个名字在每一站是否已被消费、何时会从“没有结果”变成异常。这里使用流程视觉，让每一步的候选值、异常和回退条件可逐帧观察；它不是对源码的替代，证据仍应回到本课示例和 object.c 的行区间。

本课只建立属性读取主链，因而把 data descriptor 的精确定义拆到下一节，把函数如何生成 bound method 拆到第 03 节。这样可以避免把四种机制塞进一个“魔法查找”的口号里。

## 分章正文

### `obj.name` 的可观察现象

kicker: "01 · OBSERVE"

```python
class Profile:
    role = "class-default"
    def __init__(self):
        self.role = "instance-value"
    def __getattr__(self, name):
        return f"missing:{name}"

p = Profile()
assert p.role == "instance-value"
assert p.unknown == "missing:unknown"
```

第一个读取没有调用 `__getattr__`，因为实例存储已经给出了 `role`。第二个读取没有得到实例项或类树项，正常路径构造 `AttributeError`，调度器再把异常转换为 `__getattr__(p, "unknown")` 的机会。若 `__getattr__` 自己也抛 `AttributeError`，调用者才真正看见“属性不存在”。

`p.__dict__` 的存在也只能说明这个类在当前布局下暴露了字典，不能证明任意对象都如此。后续的 `__slots__` 课会给出没有实例字典的反例。

#### 本章结论

属性读取先尝试正常查找；`__getattr__` 仅消费正常查找失败得到的 `AttributeError`。

### 建立四层候选模型

kicker: "02 · MODEL"

对默认 `object.__getattribute__`，可以用下面的教学模型推演。它省略 CPython 的储存优化，却保留可观察优先级：

1. 在 `type(obj).__mro__` 中找 `name`；若得到 data descriptor，调用其 `__get__`。
2. 查实例存储；有值就返回。
3. 若类树项是 non-data descriptor，调用其 `__get__`；若是普通值，返回它。
4. 所有候选都缺席时抛 `AttributeError`；外层才可能调用 `__getattr__`。

“在类树中查找”不等于只看当前类。它包含父类并遵守 MRO，因此同名父类字段可能在实例字段之前或之后生效，取决于它是否带有数据描述器协议。这里的第四步必须是异常而非 `None`，因为 `None` 完全可以是一个合法属性值。

#### 代码

```python
_MISSING = object()

def class_lookup(cls, name):
    for base in cls.__mro__:
        if name in base.__dict__:
            return base.__dict__[name]
    return _MISSING
```

#### 本章结论

解析链里的“找不到”是独立状态，不能用 `None` 代替；类树搜索按 MRO，而实例存储只处于中间优先级。

### 沿 CPython 泛型路径走一遍

kicker: "03 · SOURCE"

object.c L1841 调用 `_PyType_LookupStackRefAndVersion`，其语义正是按类型 MRO 查同名类属性。拿到 `descr` 后，L1846 读取类型槽 `tp_descr_get`，L1847 用 `PyDescr_IsData(descr)` 判定是否优先。这里不调用 Python 层的 `hasattr(descr, "__set__")`，而是查 C 类型槽；下一课会说明这一区别为何会影响只读 property。

L1856 以后才接触对象自己的属性存储。普通构建和 free-threaded 构建的读取细节不同，源码也允许 inline values 而不是立即物化字典，因此 `vars(obj)` 只能当诊断工具，不能成为框架的唯一持久化假设。L1903 处理 non-data descriptor，L1912 原样交还普通类值，这两条分支解释了函数、`classmethod` 等为何能在下一课改变读取结果。

泛型函数本身不会直接跑 `__getattr__`。typeobject.c L10412 先以 suppress=1 调用它，若空结果且没有挂起异常，L10416 才 `call_attribute(self, getattr, name)`。这也是“`__getattr__` 被调用”与“字典没这个 key”之间隔着整条类树和描述器路径的源码证据。

#### 本章结论

CPython 的实现在实例存储之前已经完成了类树查找和 data descriptor 判定；`__getattr__` 位于泛型查找外层的失败调度器。

### 重写 `__getattribute__` 时的递归失败

kicker: "04 · FAILURE"

下面的写法会递归，因为 `self.audit` 本身也是一次属性读取，再次进入同一个方法：

```python
class BadTrace:
    def __getattribute__(self, name):
        self.audit.append(name)  # 再次读取 self.audit
        return getattr(self, name)  # 又回到 __getattribute__
```

正确的桥是 `object.__getattribute__(self, name)`，或者在特定继承设计中使用 `super().__getattribute__(name)`。前者明确跳到 object 的默认实现，后者依赖 MRO，适合多个协作 mixin 都要参与拦截的场景。二者都不能写成 `getattr(self, name)`，后者仍从当前对象入口开始。

另一个边界是特殊方法。`len(obj)`、运算符和很多解释器隐式调用会在类型上查 special method，以维持协议一致性；官方文档明确指出这类隐式查找可能绕过实例的 `__getattribute__`。因此用访问日志框架推断“所有行为都被记录”会漏掉 `len`、`iter` 等路径。

#### 本章结论

`__getattribute__` 内部必须显式跳到基类实现；它也不是拦截全部特殊方法调用的万能探针。

### 用日志定位缺失字段

kicker: "05 · VERIFY"

生产诊断先区分三个问题：字段确实缺失、字段存在但 descriptor 抛错、字段存在且被自定义 `__getattribute__` 改写。最小日志应记录 `name`、入口是否返回、异常类别，而不能把整个对象 `repr` 放进钩子，因为 `repr` 可能再次读取属性或暴露敏感数据。

`hasattr(obj, name)` 也不是“对象是否有物理字段”的检测工具。它实质上访问属性并吞掉 `AttributeError`，于是会触发 property、`__getattr__`、网络代理甚至执行计算。需要查看普通实例存储时用 `vars(obj)`，但面对 slots 或自定义存储仍可能失败；需要查看类声明时用 `vars(type(obj))` 和 MRO 逐层检查。

完整示例将 `__getattribute__` 调用顺序记录进专用 list，并让一个不存在的字段走 `__getattr__`。它也刻意包含 `BadTrace` 的 `RecursionError` 断言，避免“只要重写就能观测”的错误自信。

#### 本章结论

排障必须区分入口改写、descriptor 异常与真实缺失；`hasattr` 会执行查找，不应代替结构检查。

### 两种工程实现的取舍

kicker: "06 · ENGINEERING"

大量字段的延迟计算更适合以明确的 `@property`、自定义 descriptor 或缓存方法表达，而不是在通用 `__getattribute__` 内写一长串名字分支。通用拦截会让 IDE、序列化、调试器和性能分析工具每次读取都承受额外逻辑，也很难保证对私有字段、异常和递归路径的一致处理。

当目标是兼容旧字段名，`__getattr__` 是较窄的适配器：只有当前模型找不到字段才执行，且可以发出 deprecation warning。它不能实现“字段存在时也要转换”的需求；那类需求应选择 property 或 descriptor。做远程代理时更要设置明确白名单和超时，避免一次拼写错误触发不可控 I/O。

性能优化也应从度量开始。CPython 会利用类型版本和属性缓存，任意运行时修改类字典、重写入口或动态生成类型都可能降低命中率；课程不把缓存命中率或纳秒数写成跨版本承诺。先用真实负载 profiling，再决定缓存、slots 或更明确的 API 是否值得。

#### 本章结论

`__getattr__` 适合缺失字段回退，`__getattribute__` 只适合必须控制总入口的基础设施；常规业务字段宜用更窄的协议。

### 从模型实现回读源码

kicker: "07 · BUILD"

在搭积木复现中，先写 `class_lookup`，再把实例字典、data/non-data 标记和失败信号拆成独立步骤。该模型故意不用 `getattr` 实现自身，否则会把解释器已经完成的查找递归引回来。完成后将每个步骤标记回 object.c L1841、L1847、L1888、L1903 和 L1919，检查教学模型没有颠倒顺序。

模型中把实例存储表示成一个 Python dict，只是为了显式呈现状态；真实 CPython 在 L1856-L1884 可以使用 inline values、managed dict 或传统指针。这个差异说明模型验证的是协议优先级，而不是伪造某个对象布局。遇到 slots、metaclass 或 `type.__getattribute__` 时，应回到真实类型路径，不把此模型硬套过去。

#### 本章结论

教学实现的价值在于可手推优先级；它不等同于 CPython 的内存布局或元类属性查找实现。

### 验收标准与版本边界

kicker: "08 · VERIFY"

运行 `python examples/python/02_attribute_lookup.py`。通过条件是：实例字段覆盖普通类字段；类字段可在实例缺席时返回；缺失字段走 `__getattr__`；显式用 `object.__getattribute__` 的拦截器不递归；错误实现确实引发 `RecursionError`。这些断言检验语言层契约，不依赖某台机器的对象地址或字典内存大小。

若课程升级到未来 Python 版本，应先重验官方 `object.__getattribute__`、`object.__getattr__` 文档和 object.c 的泛型路径。只要官方优先级仍存在，课程结论仍可沿用；inline values、锁、缓存和辅助函数行号都属于需要重新固定的实现证据。

#### 本章结论

验收依据是可观察返回值、异常和调用顺序；实现行号必须随 CPython tag 重新核对。

## 核心机制

- `obj.name` 首先进入 `__getattribute__`；默认入口在类树、实例存储、non-data descriptor 与普通类属性之间完成选择。
- 泛型路径的可观察优先级是 data descriptor、实例存储、non-data descriptor、普通类属性、`AttributeError`。
- `__getattr__` 是失败回退，只在正常路径或自定义入口以 `AttributeError` 结束时调用。
- 实例是否暴露 `__dict__` 是布局问题；`__slots__` 或 CPython managed storage 都会改变诊断方式。
- 重写总入口要通过 `object.__getattribute__` 或协作式 `super()` 取值，避免再次从自身入口递归。

## 常见误区

- 以为 `__getattr__` 会在任何读取后运行；已有实例、类或 descriptor 值时它不会运行。
- 在 `__getattribute__` 内写 `getattr(self, name)`；这会重新进入同一入口并递归。
- 把 `hasattr` 当无副作用的字段探测；它会执行完整属性查找并吞掉 `AttributeError`。
- 把 `obj.__dict__` 当每个实例必有的事实；slots 和自定义布局可以让它不存在。

## 实现变体

### 变体 A：仅用 `__getattr__` 做兼容别名

useWhen: "旧 API 只有在字段缺失时才需要映射到新字段，且没有副作用。"
tradeoff: "获得：不干扰现有属性与描述器；牺牲：不能改写已经存在的字段。"

#### 代码

```python
class Settings:
    timeout_seconds = 3
    def __getattr__(self, name):
        if name == "timeout":
            return self.timeout_seconds
        raise AttributeError(name)
```

### 变体 B：受限的 `__getattribute__` 审计

useWhen: "基础设施必须记录少量读取，并能严格避开递归与敏感值。"
tradeoff: "获得：覆盖正常读取入口；牺牲：实现复杂、特殊方法未必经过该入口、每次访问有成本。"

#### 代码

```python
class Audited:
    def __init__(self):
        object.__setattr__(self, "_reads", [])
    def __getattribute__(self, name):
        if name != "_reads":
            object.__getattribute__(self, "_reads").append(name)
        return object.__getattribute__(self, name)
```

## 可运行示例

```python
class TraceProfile:
    plan = "class-plan"
    def __init__(self):
        object.__setattr__(self, "_reads", [])
        self.plan = "instance-plan"
    def __getattribute__(self, name):
        if name != "_reads":
            object.__getattribute__(self, "_reads").append(name)
        return object.__getattribute__(self, name)
    def __getattr__(self, name):
        if name == "legacy_plan":
            return self.plan
        raise AttributeError(name)

p = TraceProfile()
assert p.plan == "instance-plan"
assert p.legacy_plan == "instance-plan"
assert "plan" in p._reads and "legacy_plan" in p._reads
try:
    p.unknown
    raise AssertionError("未知字段应失败")
except AttributeError:
    pass

class BadTrace:
    def __getattribute__(self, name):
        return getattr(self, name)

try:
    BadTrace().x
    raise AssertionError("递归入口应失败")
except RecursionError:
    pass
print("python-02-01 assertions passed")
```

## 搭积木复现

### 积木 1：表示“未命中”而非伪造 `None`

建立 `_MISSING = object()`，让类树查询在不存在时返回它。这样属性值本来就是 `None` 时，模型仍能区分“命中 `None`”和“没有字段”。

### 积木 2：按 MRO 扫描类字典

遍历 `cls.__mro__`，检查每一层 `base.__dict__`。这对应 object.c L1841 的类型查找，而不是只读取 `cls.__dict__`。

### 积木 3：先接 data descriptor

给模型值加 `is_data` 与 `get` 协议；若类树项是 data descriptor，立即返回其结果。此步骤对应 object.c L1846-L1854，必须发生在实例字典前。

### 积木 4：再查实例存储和 non-data 值

只有上一步未消费名字才查 `instance_store`；随后才调用 non-data descriptor 或返回普通类值。用同名字段分别验证两个分支。

### 积木 5：把失败显式表达为 `AttributeError`

全部候选缺席时抛 `AttributeError(name)`，外层包装器再调用 fallback。不要让模型直接返回字符串回退值，否则会掩盖 `__getattr__` 的真实位置。

### 积木 6：对照 v3.14.6 并加入递归失败

逐项对照 [object.c L1809-L1928](https://github.com/python/cpython/blob/v3.14.6/Objects/object.c#L1809-L1928) 与 [typeobject.c L10382-L10429](https://github.com/python/cpython/blob/v3.14.6/Objects/typeobject.c#L10382-L10429)。再运行示例中的 `BadTrace`，确认用 `getattr(self, name)` 会失败，教学模型没有掩盖入口递归。

## 自检

### 问题

`class C: x = 1; def __getattr__(self, name): return 2`，执行 `C().x` 与 `C().y` 各得到什么？若把 `__getattribute__` 写成 `return getattr(self, name)`，失败发生在哪个环节？

### 站内答案

结论：`C().x` 得到 `1`，因为类树普通属性在实例存储未命中后被返回，`__getattr__` 不参与；`C().y` 得到 `2`，因为正常路径没有任何候选并抛出 `AttributeError`，外层调用回退。`return getattr(self, name)` 会从同一对象重新发起属性读取，立即再次进入 `__getattribute__`，直到 `RecursionError`。源码证据是泛型路径的类项与实例项处理 [object.c L1841-L1916](https://github.com/python/cpython/blob/v3.14.6/Objects/object.c#L1841-L1916)，以及失败后调用回退的 [typeobject.c L10412-L10425](https://github.com/python/cpython/blob/v3.14.6/Objects/typeobject.c#L10412-L10425)。可运行验证见本课例子的 `plan`、`legacy_plan` 和 `BadTrace` 三组断言。工程上，兼容别名优先使用 `__getattr__`；只有基础设施确实需要总入口时才受限地重写 `__getattribute__`。

## 更新日志

### 模块 02 属性读取主路径深度重建

at: "2026-08-02T12:00:00+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "WorkBuddy · DeepSeek-V4-Flash"
summary: "新增专家课：以 CPython v3.14.6 的 GenericGetAttr 与 getattr hook 为证据，补足八章正文、六步复现、两种工程变体、正常与递归失败断言和属性解析流程视觉。"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/26"
