---
lesson: "python-08-04"
track: "python"
decision: "本课的学习障碍集中在任务、队列、取消与结构化并发。读完文字后仍需同时追踪“取消请求、CancelledError、cancelling 与 uncancel”中的多项变化，因此用状态机把相邻正文的真实机制拆成可单步核对的状态。"
---

## 视觉实验

### 推进状态并观察“取消请求、CancelledError、cancelling 与 uncancel”

id: "python-08-04-main"
kind: "state"
placement: "mechanisms"
summary: "把本课核心机制中的真实状态与约束按步骤展开，使学习者能观察“取消请求、CancelledError、cancelling 与 uncancel”中先发生什么、后发生什么，以及哪一个不变量不能被视觉过渡掩盖。"
caption: "当前高亮表示对象或执行状态的离散迁移；步骤文字直接取自本课核心机制。动画不表示 CPython 的真实耗时、内存比例或跨版本私有布局，最终以官方入口、源码节选与可运行断言为证据。"
actionLabel: "播放状态迁移"

#### 步骤

- cancel(msg) 是幂等意图但… | cancel(msg) 是幂等意图但多次调用会增加 cancelling count。
- cancelled() 只有 cor… | cancelled() 只有 coroutine 最终传播 CancelledError 才为真。
- cleanup 后 bare rai… | cleanup 后 bare raise 保持结构化并发合同。
- await 被取消 Task 会把取… | await 被取消 Task 会把取消传播给其当前等待 Future。

#### 观察重点

- 推进前先预测下一步会改变任务、队列、取消与结构化并发中的哪一项，并指出至少一个必须保持不变的条件。
- 视觉省略了平台、实现和版本分支；涉及 CPython 私有细节时，回到本课官方入口、源码路径与运行示例复核。
