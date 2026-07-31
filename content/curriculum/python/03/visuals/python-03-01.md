---
lesson: "python-03-01"
track: "python"
decision: "本课的学习障碍集中在函数对象、调用帧、闭包与参数绑定。读完文字后仍需同时追踪“函数对象：code、globals、defaults 与 closure”中的多项变化，因此用关系图把相邻正文的真实机制拆成可单步核对的状态。"
---

## 视觉实验

### 沿关系逐点追踪“函数对象：code、globals、defaults 与 closure”

id: "python-03-01-main"
kind: "graph"
placement: "mechanisms"
summary: "把本课核心机制中的真实状态与约束按步骤展开，使学习者能观察“函数对象：code、globals、defaults 与 closure”中先发生什么、后发生什么，以及哪一个不变量不能被视觉过渡掩盖。"
caption: "当前高亮表示对象、名称、类型或依赖之间的关系；步骤文字直接取自本课核心机制。动画不表示 CPython 的真实耗时、内存比例或跨版本私有布局，最终以官方入口、源码节选与可运行断言为证据。"
actionLabel: "推进关系追踪"

#### 步骤

- __code__ 保存指令、常量和名… | __code__ 保存指令、常量和名称表，不持有模块运行上下文。
- __globals__ 指向定义函数… | __globals__ 指向定义函数的模块字典，而非调用者模块。
- __defaults__ 只保存末尾… | __defaults__ 只保存末尾位置参数默认值，__kwdefaults__ 保存关键字专用默认值。
- __closure__ 与 code… | __closure__ 与 code.co_freevars 按位置对应，每个元素是可共享、可变绑定的 cell。

#### 观察重点

- 推进前先预测下一步会改变函数对象、调用帧、闭包与参数绑定中的哪一项，并指出至少一个必须保持不变的条件。
- 视觉省略了平台、实现和版本分支；涉及 CPython 私有细节时，回到本课官方入口、源码路径与运行示例复核。
