---
lesson: "python-07-01"
track: "python"
decision: "本课的学习障碍集中在类型关系、泛型解算与分支收窄。读完文字后仍需同时追踪“注解求值：3.14 lazy scopes、annotationlib 与 future”中的多项变化，因此用顺序流程把相邻正文的真实机制拆成可单步核对的状态。"
---

## 视觉实验

### 让输入穿过“注解求值：3.14 lazy scopes、annotationlib 与 future”

id: "python-07-01-main"
kind: "flow"
placement: "mechanisms"
summary: "把本课核心机制中的真实状态与约束按步骤展开，使学习者能观察“注解求值：3.14 lazy scopes、annotationlib 与 future”中先发生什么、后发生什么，以及哪一个不变量不能被视觉过渡掩盖。"
caption: "当前高亮表示输入沿处理阶段的推进次序；步骤文字直接取自本课核心机制。动画不表示 CPython 的真实耗时、内存比例或跨版本私有布局，最终以官方入口、源码节选与可运行断言为证据。"
actionLabel: "播放处理流程"

#### 步骤

- annotation scope 能… | annotation scope 能访问包围作用域和类 namespace，但其惰性值可能在更晚时刻失败。
- typing.get_type_hi… | typing.get_type_hints 会解析 forward references，并可合并类 MRO 注解、剥离部分 Annotated 元数据。
- __annotations__ 是运… | __annotations__ 是运行时元数据，不会改变赋值与调用语义。
- 插件读取注解必须考虑导入副作用、任意… | 插件读取注解必须考虑导入副作用、任意表达式与不可信代码。

#### 观察重点

- 推进前先预测下一步会改变类型关系、泛型解算与分支收窄中的哪一项，并指出至少一个必须保持不变的条件。
- 视觉省略了平台、实现和版本分支；涉及 CPython 私有细节时，回到本课官方入口、源码路径与运行示例复核。
