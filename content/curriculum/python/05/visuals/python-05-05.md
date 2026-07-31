---
lesson: "python-05-05"
track: "python"
decision: "本课的学习障碍集中在异常传播、控制流与资源清理。读完文字后仍需同时追踪“try/except/else/finally 的控制流矩阵”中的多项变化，因此用对照实验把相邻正文的真实机制拆成可单步核对的状态。"
---

## 视觉实验

### 切换条件并比较“try/except/else/finally 的控制流矩阵”

id: "python-05-05-main"
kind: "playground"
placement: "example"
component: "python-05-05/try-flow-matrix"
summary: "把本课核心机制中的真实状态与约束按步骤展开，使学习者能观察“try/except/else/finally 的控制流矩阵”中先发生什么、后发生什么，以及哪一个不变量不能被视觉过渡掩盖。"
caption: "当前高亮表示条件变化前后的可观察行为差异；步骤文字直接取自本课核心机制。动画不表示 CPython 的真实耗时、内存比例或跨版本私有布局，最终以官方入口、源码节选与可运行断言为证据。"
actionLabel: "切换对照条件"

#### 步骤

- 正常完成 | try 正常完成时跳过 except，进入 else；finally 最后仍然执行。
- 匹配异常 | try 抛出的异常被 except 匹配，执行处理器并跳过 else，随后进入 finally。
- return 或 break | try 内产生非局部跳转时不会执行 else；finally 在真正离开前获得执行机会。
- 未匹配异常 | 异常绕过当前 except 和 else，finally 执行后继续向外传播，除非 finally 覆盖它。

#### 观察重点

- 推进前先预测下一步会改变异常传播、控制流与资源清理中的哪一项，并指出至少一个必须保持不变的条件。
- 视觉省略了平台、实现和版本分支；涉及 CPython 私有细节时，回到本课官方入口、源码路径与运行示例复核。
