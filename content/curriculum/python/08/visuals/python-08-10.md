---
lesson: "python-08-10"
track: "python"
decision: "本课的学习障碍集中在任务、队列、取消与结构化并发。读完文字后仍需同时追踪“to_thread、run_in_executor、ContextVar 与 GIL”中的多项变化，因此用状态机把相邻正文的真实机制拆成可单步核对的状态。"
---

## 视觉实验

### 推进状态并观察“to_thread、run_in_executor、ContextVar 与 GIL”

id: "python-08-10-main"
kind: "state"
placement: "mechanisms"
summary: "把本课核心机制中的真实状态与约束按步骤展开，使学习者能观察“to_thread、run_in_executor、ContextVar 与 GIL”中先发生什么、后发生什么，以及哪一个不变量不能被视觉过渡掩盖。"
caption: "当前高亮表示对象或执行状态的离散迁移；步骤文字直接取自本课核心机制。动画不表示 CPython 的真实耗时、内存比例或跨版本私有布局，最终以官方入口、源码节选与可运行断言为证据。"
actionLabel: "播放状态迁移"

#### 步骤

- to_thread 调用发生在 aw… | to_thread 调用发生在 await/schedule 后，不在函数调用表达式当场。
- 线程池过小会排队 | 线程池过小会排队，过大造成上下文切换与下游过载。
- ProcessPool 参数/结果需… | ProcessPool 参数/结果需可序列化，入口需 __main__ guard。
- ContextVar copy 不等… | ContextVar copy 不等于普通 threading.local 复制。

#### 观察重点

- 推进前先预测下一步会改变任务、队列、取消与结构化并发中的哪一项，并指出至少一个必须保持不变的条件。
- 视觉省略了平台、实现和版本分支；涉及 CPython 私有细节时，回到本课官方入口、源码路径与运行示例复核。
