---
id: "python-02-03"
track: "python"
title: "函数绑定：method、classmethod、staticmethod 与 __set_name__"
depth: "deep"
visualIndex: "../visuals/python-02-03.md"
exampleLanguage: "python"
readingMinutes: 36
sourceMinutes: 18
practiceMinutes: 26
reviewMinutes: 10
---

## 官方入口

title: "Python 3.14 数据模型 · 实例方法、静态方法与类方法"
url: "https://docs.python.org/3.14/reference/datamodel.html#instance-methods"

官方文档说明，类中的用户函数经由实例读取时会产生 method object，`method.__self__` 指向实例，`method.__func__` 指向原函数；`classmethod` 绑定类，`staticmethod` 返回包裹的对象而不再转换。[描述器指南的函数与方法章节](https://docs.python.org/3.14/howto/descriptor.html#functions-and-methods) 给出这三者由 descriptor 协议实现的统一解释。版本边界为 Python 3.14 / CPython v3.14.6。

## 真实源码

repo: "python/cpython"
file: "Objects/funcobject.c / Objects/typeobject.c"
symbol: "func_descr_get / type_new_set_names"
language: "c"
url: "https://github.com/python/cpython/blob/v3.14.6/Objects/funcobject.c#L1192-L1198"

### 逐段讲解

- `func_descr_get`（funcobject.c L1192-L1198）在 `obj == NULL` 或类访问时返回函数自身；实例访问则 `PyMethod_New(func, obj)`，创建持有函数与接收者的 bound method。
- 这段函数是用户函数作为 non-data descriptor 的底层证据，因此实例字典可遮蔽同名普通方法。
- `type_new_set_names`（typeobject.c L11523-L11564）复制新类字典，遍历每一项并查 `__set_name__`；找到后以 `(owner, key)` 调用。异常会附加字段与类名上下文。
- `__set_name__` 是类创建阶段的一次通知，不会因运行时 `setattr(C, "x", descriptor)` 自动补发。

### 源码节选

```c
// Objects/funcobject.c，CPython v3.14.6
static PyObject *
func_descr_get(PyObject *func, PyObject *obj, PyObject *type)
{
    if (obj == Py_None || obj == NULL) {
        return Py_NewRef(func);       // C.f：未绑定的函数对象
    }
    return PyMethod_New(func, obj);   // c.f：函数 + c
}

// Objects/typeobject.c：类创建时通知 descriptor
set_name = _PyObject_LookupSpecial(value, &_Py_ID(__set_name__));
if (set_name == NULL) {
    if (PyErr_Occurred())
        goto error;
    continue;
}
res = PyObject_CallFunctionObjArgs(set_name, type, key, NULL);
Py_DECREF(set_name);
if (res == NULL) {
    _PyErr_FormatNote("Error calling __set_name__ on '%s'",
                      Py_TYPE(value)->tp_name);
    goto error;
}
Py_DECREF(res);
```

删减说明：省略 `PyMethodObject` 的分配、vectorcall 与错误注释；它们不改变“类访问返回原函数、实例访问绑定接收者”的协议。classmethod/staticmethod 的完整 C 类型实现未逐行展开，官方入口约束其公开行为。

## 导读

`Worker.run` 和 `Worker().run` 看起来像同一个名字，运行时却不是同一个对象。前者是类字典里的函数，后者是携带 `__self__` 的绑定方法；调用时解释器因而知道该把哪个对象放到第一个位置。若把 `self` 看成调用语法自动“注入”的关键字，反射、回调和 monkey patch 都会难以推理。

学习者读完文字仍看不见的，是同一类字典项在“经类读取”和“经实例读取”时怎样产生不同接收者。流程视觉显式显示函数、实例、类和最终调用参数，帮助观察绑定发生在读取期，而不是函数体开始时。

本课把函数绑定和 `__set_name__` 合在一起，是因为它们都发生在类变量被解释为协议对象的关键边界：前者在读取期，后者在类创建期。它们的生命周期不同，绝不能误认为 `__set_name__` 每次读取都会运行。

## 分章正文

### 从两个 `id` 开始观察

kicker: "01 · OBSERVE"

```python
class Counter:
    def add(self, n): return n + 1

c = Counter()
assert Counter.add is Counter.__dict__["add"]
bound = c.add
assert bound.__self__ is c
assert bound.__func__ is Counter.add
assert bound(4) == 5
```

`Counter.add` 的类访问传给 `func_descr_get` 的对象为空，于是返回函数本身；`c.add` 传入实例，于是新建 method object。每次读取 `c.add` 可以得到不同的 method 对象身份，因而不应该用 `c.add is c.add` 写功能断言；应比较 `__self__`、`__func__` 或调用效果。

#### 本章结论

绑定是属性读取产生的对象关系，method 保存原函数与接收者；它不是函数定义时永久修改函数签名。

### 三种接收者模型

kicker: "02 · MODEL"

普通函数从实例读取，得到 `method(function, instance)`，调用等价于 `function(instance, *args, **kwargs)`。`@classmethod` 从类或实例读取，得到 `method(function, class)`，调用等价于 `function(class, *args, **kwargs)`。`@staticmethod` 不绑定任何接收者，返回包裹的可调用对象，调用参数原样传递。

```python
class Build:
    def instance(self, x): return (self, x)
    @classmethod
    def from_text(cls, text): return (cls, text)
    @staticmethod
    def normalize(text): return text.strip().lower()
```

三者的选择由需要的上下文决定。实例方法处理某个对象的状态；类方法做替代构造、子类可覆盖的工厂或类级策略；静态方法只是把与类语义相关的纯函数放在命名空间里。把所有工具函数都写成 staticmethod 会失去模块函数更容易复用和测试的优势。

#### 本章结论

普通方法绑定实例，类方法绑定动态访问到的类，静态方法不绑定；装饰器改变的是读取协议而非普通参数规则。

### 源码路径与非数据遮蔽

kicker: "03 · SOURCE"

funcobject.c L1194 的分支直接对应 `C.f`：没有实例就返回新引用的 `func`。L1197 的 `PyMethod_New(func, obj)` 对应 `c.f`，因此 method 的 `__func__` 与 `__self__` 可以被公开检查。属性读取主路径在上一课已证明 non-data descriptor 位于实例字典之后；用户函数具有 getter 却不提供设置槽，所以 `c.__dict__["add"] = lambda n: n` 可以遮蔽 `Counter.add`。这可用于每实例注入策略，但会让调试和类型推导变得困难。

`classmethod` 与 `staticmethod` 也都是类字典中的 wrapper descriptor。类方法的绑定目标是实际访问的 class，故 `Child.from_text(...)` 里的 `cls` 是 `Child`，让替代构造保持多态。静态方法故意阻止函数转换成 method，适合不需要 `self` 或 `cls` 的逻辑。

不要把 C 源码的 `PyMethod_New` 误解为所有 Python 可调用对象都这样绑定。任意对象可以自行实现 `__get__`；内建函数、C 扩展、元类属性和 `super` 各有具体实现。本课仅固定用户定义函数的证据。

#### 本章结论

用户函数的 `func_descr_get` 创建 bound method，且因其 non-data 身份可被实例同名项遮蔽；其他 callable 必须按其自身协议分析。

### `__set_name__` 是创建期，不是访问期

kicker: "04 · FAILURE"

```python
class Field:
    def __set_name__(self, owner, name):
        self.owner, self.name = owner, name

class Model:
    code = Field()  # type 创建 Model 时调用一次

late = Field()
Model.late = late  # 不会自动调用 late.__set_name__
```

typeobject.c 的 `type_new_set_names` 遍历的是新类型的字典，发生在类对象已经被组装的创建流程里。事后赋值没有再次运行 type_new，故 `late.name` 未初始化。框架若支持动态字段，必须明确调用 `late.__set_name__(Model, "late")`，或使用注册 API 负责该工作；不能把“后来第一次读取时会补上”当契约。

一个 descriptor 若同一实例被绑定到同一个类的两个名字，`__set_name__` 会被调用两次，最后存的单一 `name` 可能只剩后一个。想支持别名时，应保存多个名字或为每个字段创建独立 descriptor；这属于 API 设计而非解释器 bug。

#### 本章结论

`__set_name__` 按类字典条目在类创建时调用；动态挂载和别名需要框架显式定义通知与状态策略。

### 回调、偏函数与生命周期

kicker: "05 · ENGINEERING"

把 `c.handle` 放入长寿命事件总线，会让 bound method 持有 `c`，事件总线又持有 method，因而间接延长 `c` 的生命周期。若订阅者需要可回收，选择 `weakref.WeakMethod` 或显式取消订阅；不能仅凭“函数本身没有状态”推断实例会释放。下一节的 weakref 课程会验证这一所有权关系。

若你只需要固定一部分参数，`functools.partial` 表达“参数预填充”比人为创建临时对象方法更直接。若确实需要调用时从对象取最新策略，传入一个普通函数和显式对象参数更清晰。选择的核心是调用者是否应该拥有接收者、接收者能否变更及谁负责解绑。

classmethod 的工厂要返回 `cls(...)` 而非写死基类名，才能让子类得到自身实例；static factory 若不依赖继承则可以放模块层。把 `@classmethod` 当“任何不用 self 的方法”会误导继承用户。

#### 本章结论

绑定方法既携带调用便利，也携带强引用所有权；工厂使用 classmethod 的价值在于让 `cls` 保持多态。

### 实现与测试的两种变体

kicker: "06 · ENGINEERING"

第一种变体是普通实例方法加依赖显式参数，适合可替换策略和纯业务逻辑：调用方清楚看见 `service` 从哪里来，测试可传入替身。第二种是 classmethod 替代构造，适合解析、反序列化和子类注册：它把“创建哪个类型”交给动态 `cls`，测试要覆盖子类返回类型。

静态方法适用于能从输入完全决定输出、仍因领域命名而放在类内的工具；它无需在 mock 中构造实例。若工具只与一个模块有关，把它移到模块层通常更少耦合。无论哪个变体，避免保存裸 `C.f` 后误以为可以 `callback()` 调用：类读取的普通函数没有自动 `self`，会产生缺少位置参数的 `TypeError`。

#### 本章结论

方法形式应表达上下文和所有权；测试应分别验证绑定对象、动态类和无接收者调用三条契约。

### 构建一个最小字段注册器

kicker: "07 · BUILD"

先让 `Field.__set_name__` 记录公开名；再让它在 `__get__` 中返回 `obj.__dict__["_" + name]`，`__set__` 做验证。随后建立两个 Model 实例，确保值存在各自对象上。第三步把普通函数放进类字典，比较 `Model.fn` 与 `m.fn.__func__`。第四步加入 classmethod 和 staticmethod，记录它们各自的接收者。

第五步在类创建后动态挂载新 Field，故意不通知并捕获失败；第六步显式调用 `__set_name__` 再验证成功。把这六步回读到 [funcobject.c L1192-L1198](https://github.com/python/cpython/blob/v3.14.6/Objects/funcobject.c#L1192-L1198) 与 [typeobject.c L11523-L11564](https://github.com/python/cpython/blob/v3.14.6/Objects/typeobject.c#L11523-L11564)，分清读取期绑定和创建期通知。

#### 本章结论

一个小注册器能同时演示 class variable 的两种生命周期：类型创建时接名，实例读取时绑定或取值。

### 运行验收与版本边界

kicker: "08 · VERIFY"

运行 `python examples/python/04_method_binding.py`。通过条件包括：普通 method 的 `__self__` 与 `__func__`，子类 classmethod 收到子类，staticmethod 没有隐式接收者，实例字典遮蔽普通方法，动态 descriptor 在显式 `__set_name__` 前不可用。失败断言覆盖把裸函数当无参回调调用的 `TypeError`。

升级时复验数据模型中的 instance/class/static method 描述、descriptor guide 和上述两个固定源码链接。method 对象的优化、缓存和地址不是本课契约；可观察的绑定接收者与 `__set_name__` 生命周期才是。

#### 本章结论

验收检查接收者和失败边界，不检查对象身份或内部缓存；版本升级要重新固定源代码证据。

## 核心机制

- 用户函数是 non-data descriptor：类读取返回函数，实例读取创建保存函数和实例的 bound method。
- `method.__self__` 是绑定接收者，`method.__func__` 是原函数；方法对象身份不应作为稳定语义。
- classmethod 绑定动态 class，staticmethod 不绑定接收者。
- `__set_name__` 在类创建期按类字典条目调用，不会因后期 `setattr` 自动重放。
- 绑定方法被存入回调容器时会持有实例，取消订阅或弱引用策略属于生命周期设计。

## 常见误区

- 把 `C.f` 与 `C().f` 当成相同对象；前者无实例接收者，后者有 `__self__`。
- 以为 `@staticmethod` 更“面向对象”；若不依赖类命名空间，模块函数往往更简单。
- 运行时挂字段后等待 `__set_name__` 自动触发；必须显式通知或使用注册 API。
- 把裸 `C.f` 传给无参回调；它仍需要第一个 `self` 参数。

## 实现变体

### 变体 A：实例方法与显式依赖

useWhen: "逻辑依赖一个可替换对象状态，调用方应看见该对象。"
tradeoff: "获得：状态边界明确、替身易注入；牺牲：调用处需要持有实例。"

#### 代码

```python
class Formatter:
    def render(self, value): return f"<{value}>"

def send(formatter, value):
    return formatter.render(value)
```

### 变体 B：多态替代构造

useWhen: "解析输入后需要创建调用该工厂的实际子类。"
tradeoff: "获得：继承时保留返回类型；牺牲：子类构造器必须遵守工厂所需合同。"

#### 代码

```python
class Token:
    @classmethod
    def parse(cls, text):
        return cls(text.strip())
    def __init__(self, text): self.text = text
```

## 可运行示例

```python
class Token:
    def __init__(self, text): self.text = text
    def show(self): return self.text
    @classmethod
    def parse(cls, text): return cls(text.strip())
    @staticmethod
    def normalize(text): return text.strip().lower()

class ChildToken(Token): pass

t = Token("ok")
assert t.show.__self__ is t and t.show.__func__ is Token.show
assert isinstance(ChildToken.parse(" x "), ChildToken)
assert Token.normalize(" X ") == "x"
t.show = lambda: "shadow"
assert t.show() == "shadow"
try:
    Token.show()
    raise AssertionError("裸函数缺少 self 应失败")
except TypeError:
    pass
print("python-02-03 assertions passed")
```

## 搭积木复现

### 积木 1：读取类字典的原函数

比较 `vars(Token)["show"]`、`Token.show` 与 `Token("x").show`，记录只有最后一个携带实例接收者。

### 积木 2：手写绑定等价式

保存 `bound = t.show`，断言 `bound(*args) == bound.__func__(bound.__self__, *args)`，不比较两个连续读取的 method 身份。

### 积木 3：对比 classmethod 与 staticmethod

从子类调用 `parse` 并断言产物类型；调用 `normalize` 并确认参数列表没有注入实例或类。

### 积木 4：验证函数的 non-data 遮蔽

给 `t.show` 赋 lambda，断言该实例改变而另一个实例仍使用类函数。这是 descriptor 优先级在方法上的具体结果。

### 积木 5：实现并初始化 Field

用 `__set_name__` 生成私有名，验证两个对象各有值；不要把实例值放到 Field 本身。

### 积木 6：动态挂载的失败与修复

`Token.extra = Field()` 后先观察未初始化，再显式调用 `Token.extra.__set_name__(Token, "extra")`。把创建期调用对照 typeobject.c 的 `type_new_set_names`。

## 自检

### 问题

为何 `C().f(1)` 可理解为 `C.f(C(), 1)`，但 `C.f` 自身并不自动携带某个实例？`C.dynamic = D()` 后 `D.__set_name__` 为什么不自动执行？

### 站内答案

结论：经实例读取用户函数时，`func_descr_get` 在 [funcobject.c L1192-L1198](https://github.com/python/cpython/blob/v3.14.6/Objects/funcobject.c#L1192-L1198) 调用 `PyMethod_New(func, obj)`，因此返回对象把原函数与该实例组合；经类读取时传入空对象，函数本身被返回，无法凭空选择实例。动态赋值不走新类创建流程，而 `__set_name__` 的遍历只发生在 [type_new_set_names](https://github.com/python/cpython/blob/v3.14.6/Objects/typeobject.c#L11523-L11564)，故必须显式通知。可运行示例验证 bound method、子类 classmethod、staticmethod、遮蔽和裸函数失败。工程上，回调注册还要考虑 bound method 对实例的强引用。

## 更新日志

### 署名纠正：Python PR #26/#27 的真实运行身份

at: "2026-08-02T19:48:47+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "OpenAI Codex · GPT-5.6 Luna"
summary: "纠正本课在 Python PR #26/#27 中误用的历史自动化署名；正文、源码证据、示例、视觉与原有日志均保持不变，并补充 PR 前运行身份确认门禁。"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/28"
commit: "47616c9"

### 模块 02 函数绑定与创建期通知深度重建

at: "2026-08-02T12:00:00+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "WorkBuddy · DeepSeek-V4-Flash"
summary: "新增困难课：固定 CPython v3.14.6 函数描述器与 type_new_set_names 源码，补足八章正文、六步复现、实例/类/静态方法变体、动态字段失败断言和绑定流程视觉。"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/26"
