---
id: "python-02-04"
track: "python"
title: "C3 MRO 与 super：协作继承的线性化和一次调用合同"
depth: "deep"
visualIndex: "../visuals/python-02-04.md"
exampleLanguage: "python"
readingMinutes: 44
sourceMinutes: 24
practiceMinutes: 30
reviewMinutes: 12
---

## 官方入口

title: "Python 3.14 内建函数 · super"
url: "https://docs.python.org/3.14/library/functions.html#super"

官方文档将 `super()` 定义为按方法解析顺序访问父类或兄弟类属性的代理，而非“直接父类”的别名；其零参数形式在编译期提供的 `__class__` cell 和当前方法第一个参数上工作。[`type.mro`](https://docs.python.org/3.14/reference/datamodel.html#type.mro) 的结果存入 `__mro__`，允许元类定制。版本边界是 Python 3.14 / CPython v3.14.6；本课只讨论普通类的 C3，元类自定义 MRO 必须单独审核。

## 真实源码

repo: "python/cpython"
file: "Objects/typeobject.c"
symbol: "pmerge / mro_implementation_unlocked / super_getattro / supercheck"
language: "c"
url: "https://github.com/python/cpython/blob/v3.14.6/Objects/typeobject.c#L3260-L3414"

### 逐段讲解

- `pmerge`（typeobject.c L3260-L3326）维护每个待合并序列的当前位置，只能选择“没有出现在任何其它序列尾部”的候选头。
- L3297-L3313 选中候选后，把它追加到线性化并在所有出现于头部的位置前进；若仍有非空序列但没有可选候选，L3318-L3320 报 MRO 错误。
- `mro_implementation_unlocked`（L3330-L3414）把每个直接基类的既有 MRO 与直接 bases 元组同时交给 merge，故既保持父类内部顺序，也保持子类写下的基类局部顺序。
- `super_getattro`（L11932-L11944）把属性读取交给 `do_super_lookup`；`supercheck`（L11947-L12005）确认实例或类与起点类型兼容。super 是带起点、对象和对象实际类型的代理。

### 源码节选

```c
// Objects/typeobject.c，CPython v3.14.6 的 C3 merge 核心
candidate = PyTuple_GET_ITEM(cur_tuple, remain[i]);
for (j = 0; j < to_merge_size; j++) {
    if (tail_contains(to_merge[j], remain[j], candidate))
        goto skip;              // 候选在别人的尾部，暂时不能选
}
PyList_Append(acc, candidate);
for (j = 0; j < to_merge_size; j++) {
    if (PyTuple_GET_ITEM(to_merge[j], remain[j]) == candidate)
        remain[j]++;
}
goto again;
skip: ;
}
if (empty_cnt != to_merge_size) {
    set_mro_error(to_merge, to_merge_size, remain);
    res = -1;
}
PyMem_Free(remain);
return res;
```

删减说明：省略类型锁、内存申请和类型缓存；保留 C3 的候选规则、无法线性化的失败分支和 super 的代理入口。它们足以解释菱形继承与协作调用，不把 `super` 错讲为父类对象。

## 导读

多继承最大的风险常常不是“调用了错误的方法”，而是每个 mixin 都写了直接父类名，导致一个兄弟类被跳过或一个初始化被执行两次。C3 将继承图压成一个满足局部顺序与单调性的线性序列；`super()` 从这条序列的某个动态位置继续，不承诺哪个具体父类固定在下一站。

学习者读完一串 `__mro__` 名称后仍看不见的，是一次 merge 为什么拒绝某个候选，以及 `super(Cache, service)` 从哪里起跳。图视觉用可推进的列表头和尾约束呈现选取过程，同时标出协作调用的轨迹；真实结果仍由本课代码和固定源码验证。

此课将 C3 与 `super` 合并，是因为前者决定后者的路线。对象布局和 slots 的多继承限制则留到下一课，避免把“逻辑可线性化”和“物理 slot 布局允许”混成同一问题。

## 分章正文

### 菱形继承的可观察调用顺序

kicker: "01 · OBSERVE"

```python
class Root:
    def chain(self): return ["Root"]
class Left(Root):
    def chain(self): return ["Left"] + super().chain()
class Right(Root):
    def chain(self): return ["Right"] + super().chain()
class Leaf(Left, Right):
    def chain(self): return ["Leaf"] + super().chain()

assert Leaf.__mro__ == (Leaf, Left, Right, Root, object)
assert Leaf().chain() == ["Leaf", "Left", "Right", "Root"]
```

`Root` 只出现一次，因为 C3 在线性化里去重，同时保持 `Leaf(Left, Right)` 的局部左到右顺序和 `Left`、`Right` 各自对 `Root` 的先后约束。若 `Left.chain` 写成 `Root.chain(self)`，它会跳过 `Right`，协作链立即断裂。

#### 本章结论

菱形继承依赖一条全局 MRO，让每个合作方法调用一次 `super()`，才能既不漏兄弟也不重复祖先。

### C3 的两个不变量

kicker: "02 · MODEL"

C3 要同时满足局部优先顺序和单调性。局部优先顺序指 `class Leaf(Left, Right)` 中 Left 必须在 Right 前；单调性指一个父类已有的 MRO 相对顺序不能被子类颠倒。计算 `L(C)` 时，取 `C` 加上 `merge(L(B1), L(B2), ..., [B1, B2, ...])`。

merge 的规则很具体：从各列表头尝试候选；若候选出现在任一其他列表的尾部，就暂不能选，因为选它会破坏那个列表中仍在它前面的类；选择一个不在任何尾部的头后，从所有相同头中删除它。所有列表清空即成功，仍有元素却没有候选即约束矛盾。

例如 `Leaf(Left, Right)` 要合并 `[Left, Root, object]`、`[Right, Root, object]` 与 `[Left, Right]`。先选 Left，随后 Right，接着 Root，最后 object。候选 Root 在第二条尾部时暂不可选，正是它不能抢在 Right 前的理由。

#### 本章结论

C3 不是简单深度优先或广度优先；它用“候选不得出现在任何尾部”守住父类顺序和子类局部顺序。

这个规则还给出了可复现的沟通语言：设计评审中不必说“这条继承看着怪”，可以准确指出某候选位于哪一条约束序列的尾部，因此此刻不可选择。

### CPython 如何实现 merge

kicker: "03 · SOURCE"

typeobject.c L3266-L3268 的 `remain` 记录每个序列当前未合并的头。L3297 读第一个候选，L3298-L3302 用 `tail_contains` 排除出现在另一个尾部的候选。通过检查后 L3303 追加，L3307-L3313 同时推进所有相等头。算法不靠名字或“左边优先”的捷径，它只使用输入序列给出的约束；注释也说明在有多个合法候选时，最早直接父类的 MRO 决定选择。

L3379-L3400 构建 merge 输入：每个直接基类的 `__mro__` 加上新类声明的 bases 元组。最后 L3408-L3411 调 `pmerge`。所以 Python 在 class 语句执行时就能报告不可线性化，而不是等你第一次调用方法才随机选择路径。

现实代码还可能使用 metaclass 覆盖 `type.mro()`，此时 `__mro__` 的来源不再是本段默认实现。框架若依赖多继承，应该显式检查最终 `cls.__mro__`，而非凭图形直觉假设 C3 必然适用。

#### 本章结论

CPython 用父类 MRO 加直接 bases 作为 merge 输入，创建类时就检测矛盾；元类能改变结果，必须从最终 `__mro__` 取证。

### `super` 的动态起点与失败路径

kicker: "04 · FAILURE"

`super()` 并不表示“调用我写在括号左边的父类”。`super(Left, leaf).chain` 会在 `type(leaf).__mro__` 中找到 Left 后，从它后面继续，因此得到 Right 的实现。`super(Leaf, leaf)` 则从 Left 开始。相同的 `super(Left, obj)` 在不同实际对象类型上可能走不同路径，这正是协作继承能被子类扩展的原因。

零参数 `super()` 只在正常定义于类体的方法中可靠：编译器需要提供 `__class__` cell，运行时还要拿到第一个局部参数。嵌套函数、静态方法或把函数搬出类体后，可能没有需要的信息并报 `RuntimeError`。显式两参数形式更适合元编程和需要说明起点的复杂代码。

另一个失败是签名不一致。若某 mixin 的 `__init__` 不接收或不传递剩余关键字，它可能吞掉或拒绝其他 mixin 所需参数。协作方法的合同是“每层做自己的工作，接受共享协议的参数，并恰好一次调用 super”，不是只在自己看到的父类上凑巧运行。

#### 本章结论

super 是从动态 MRO 某起点继续的代理；协作链还需要统一签名和恰好一次的继续调用合同。

### 不可线性化的真实诊断

kicker: "05 · VERIFY"

```python
class X: pass
class Y: pass
class A(X, Y): pass
class B(Y, X): pass
# class Bad(A, B): pass  # TypeError: cannot create a consistent MRO
```

`A` 要求 X 在 Y 前，`B` 要求 Y 在 X 前。合并开始时 X 和 Y 分别都在另一条序列的尾部，没有任何合法候选；typeobject.c L3318 走 `set_mro_error`。这不是 Python “不支持复杂继承”，而是这组局部顺序无法同时满足。

诊断步骤先打印所有相关父类的 `__mro__`，再列出声明 bases 顺序，按 merge 规则手推第一个卡住的候选。不要以交换一行类定义的试错替代理解，因为换序会改变公开 API、`super` 路线与初始化顺序。若两个 mixin 的先后确实无语义，组合改为显式委托通常比牺牲可读性地修补继承图更稳。

#### 本章结论

不可线性化是相互矛盾的顺序约束，源码在 class 创建时报告；解决方案先澄清语义，再决定重排或组合。

### 继承与组合的工程取舍

kicker: "06 · ENGINEERING"

mixins 适合横切、无或少状态、可协作的方法增强，例如日志、序列化钩子或权限检查。每个 mixin 都要文档化它要求的 `super` 合同、数据属性和方法签名。带大量构造状态、外部资源或相互独立生命周期的组件，组合往往更可靠：主对象显式持有 `cache`、`tracer`、`transport`，依赖流和测试替身一目了然。

禁止在协作链中调用明确的父类名，除非你就是要切断 MRO 且在 API 中写清楚。明确调用适合封闭的单继承祖先实现复用，未必适合开放的 mixin 链。对初始化而言，`object.__init__` 不接受额外参数，因此最末端通常需要由一个根类统一消费或验证剩余关键字。

性能不是选择继承的主理由。属性缓存、方法分派和 C3 本身都有成本，但真正的维护成本常来自不可见的调用顺序。先让 MRO 与行为测试清晰，再在真实工作负载上测量。

#### 本章结论

协作多继承需要可写下来的 super 合同；状态和资源复杂时，组合比依赖隐含 MRO 更易维护。

### 六步手写 C3 与协作链

kicker: "07 · BUILD"

第一步建立 Root、Left、Right、Leaf 并打印 `Leaf.__mro__`。第二步列出三条 merge 输入，第三步依规则选择 Left，第四步说明 Root 为什么暂时在 Right 的尾部，随后选择 Right 和 Root。第五步为每个 `chain` 添加一次 `super().chain()`，断言调用日志每类恰好一次。第六步构造 A/B 反序例，捕获 `TypeError`。

再以 `super(Left, Leaf()).chain()` 作为附加实验，验证起点在 Left 之后，结果从 Right 开始。将手写步骤分别对应到 [pmerge L3260-L3326](https://github.com/python/cpython/blob/v3.14.6/Objects/typeobject.c#L3260-L3326)、[MRO 输入构造 L3379-L3414](https://github.com/python/cpython/blob/v3.14.6/Objects/typeobject.c#L3379-L3414) 与 [super_getattro](https://github.com/python/cpython/blob/v3.14.6/Objects/typeobject.c#L11932-L12005)。

#### 本章结论

通过手推、运行日志和源码三重对照，C3 与 super 的“动态继续”可以被验证，而非背成菱形口诀。

### 验收与版本边界

kicker: "08 · VERIFY"

运行 `python examples/python/05_c3_super.py`。通过条件：Leaf 的 MRO 与四层调用日志相同；`super(Left, leaf)` 从 Right 开始；反序继承定义确实抛 `TypeError`；每个协作实现仅进入一次。示例用 `exec` 创建坏类，避免模块导入时直接中止。

升级 Python 时复核 `super`、`type.mro` 官方文档和 typeobject.c 的 `pmerge` / `super_getattro` 固定 tag。课程不承诺 C 栈、缓存和 method object 的性能数值；C3 顺序约束和可观察 super 路线才是稳定教学结论。

#### 本章结论

验收同时覆盖成功线性化、动态 super 起点和创建期矛盾；源码链接随版本重新固定。

## 核心机制

- C3 合并父类 MRO 与直接 bases，维护局部优先顺序和单调性。
- 一个候选若出现在任何其它未消费序列的尾部，就不能被选。
- `super` 保存起点类型、对象与实际对象类型，沿动态 MRO 在起点之后查找。
- 协作方法必须接受共享调用合同、完成局部工作并恰好调用一次 `super()`。
- MRO 冲突在类创建时以 `TypeError` 暴露；元类定制 MRO 时须检查最终结果。

## 常见误区

- 把 super 当成“直接父类”；它走的是实际对象类型的 MRO 后继。
- 以为左侧基类必然永远赢；它还必须满足其他父类已有顺序。
- mixin 直接点名某个父类；这样常跳过协作链的兄弟类。
- 只在一个类里测试初始化；多继承的合同要验证每层恰好一次与所有参数流。

## 实现变体

### 变体 A：协作式无状态 mixin

useWhen: "横切行为共享同一签名，且每层能够无副作用地继续调用。"
tradeoff: "获得：可插拔叠加和子类扩展；牺牲：签名与 super 合同必须全员遵守。"

#### 代码

```python
class Logged:
    def run(self, **kw):
        return ["log"] + super().run(**kw)
```

### 变体 B：显式组合

useWhen: "组件有独立资源、复杂构造参数或必须独立替换。"
tradeoff: "获得：依赖路径显式、测试替身直接；牺牲：调用处多一层转发。"

#### 代码

```python
class Service:
    def __init__(self, cache, tracer):
        self.cache, self.tracer = cache, tracer
    def run(self, key):
        self.tracer.record(key)
        return self.cache.get(key)
```

## 可运行示例

```python
class Root:
    def chain(self): return ["Root"]
class Left(Root):
    def chain(self): return ["Left"] + super().chain()
class Right(Root):
    def chain(self): return ["Right"] + super().chain()
class Leaf(Left, Right):
    def chain(self): return ["Leaf"] + super().chain()

leaf = Leaf()
assert [c.__name__ for c in Leaf.__mro__] == ["Leaf", "Left", "Right", "Root", "object"]
assert leaf.chain() == ["Leaf", "Left", "Right", "Root"]
assert super(Left, leaf).chain() == ["Right", "Root"]
try:
    exec("class X: pass\nclass Y: pass\nclass A(X,Y): pass\nclass B(Y,X): pass\nclass Bad(A,B): pass")
    raise AssertionError("反序约束应无法线性化")
except TypeError:
    pass
print("python-02-04 assertions passed")
```

## 搭积木复现

### 积木 1：打印每个父类的 MRO

建立 Root、Left、Right，记录各自 `__mro__`，不要从图形直觉直接猜 Leaf 的结果。

### 积木 2：列出三条 merge 输入

写出 `L(Left)`、`L(Right)` 与 `[Left, Right]`，为每条序列保留可移动的头索引。

### 积木 3：手选合法候选

先选 Left；检查 Root 位于 Right 序列尾部而暂时不可选；再选 Right、Root、object。

### 积木 4：把线性化变成调用链

每层 `chain` 记录自身后只调用一次 `super().chain()`，断言 Root 没有重复或漏掉。

### 积木 5：验证动态起点

比较 `super(Leaf, leaf)` 与 `super(Left, leaf)` 的结果，说明后者不调用 Left 本身。

### 积木 6：构造矛盾并对照源码

让 A 要求 X 在 Y 前、B 要求 Y 在 X 前，捕获 class 创建 `TypeError`；回读 `pmerge` 的尾部检查与错误分支。

## 自检

### 问题

在 `class D(B, C)` 中，为什么 `super(B, D()).m()` 不能被解释为“调用 B 的父类 m”？C3 在什么条件下会拒绝创建一个类？

### 站内答案

结论：`super(B, D())` 以 B 为起点，在 `type(D()).__mro__` 中从 B 后面继续，所以它调用的是该动态线性化中的后继，可能是 C，也可能是别的类，取决于 D 的完整继承图。C3 拒绝创建类的条件是所有当前候选头都出现在其他未消费序列的尾部，意味着父类顺序约束互相矛盾。源码证据是 [pmerge L3297-L3320](https://github.com/python/cpython/blob/v3.14.6/Objects/typeobject.c#L3297-L3320) 和 [super_getattro L11932-L11944](https://github.com/python/cpython/blob/v3.14.6/Objects/typeobject.c#L11932-L11944)。可运行示例验证动态起点和 X/Y 反序冲突。工程上，协作 mixin 应统一参数并恰好一次调用 super；资源复杂时优先组合。

## 更新日志

### 署名纠正：Python PR #26/#27 的真实运行身份

at: "2026-08-02T19:48:47+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "OpenAI Codex · GPT-5.6 Luna"
summary: "纠正本课在 Python PR #26/#27 中误用的历史自动化署名；正文、源码证据、示例、视觉与原有日志均保持不变，并补充 PR 前运行身份确认门禁。"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/28"

### 模块 02 C3 与协作继承深度重建

at: "2026-08-02T12:00:00+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "WorkBuddy · DeepSeek-V4-Flash"
summary: "新增专家课：固定 CPython v3.14.6 C3 merge 与 super 查找源码，补足八章正文、六步手推复现、协作/组合取舍、线性化失败断言和 MRO 图视觉。"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/26"
