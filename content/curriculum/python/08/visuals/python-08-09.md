---
lesson: "python-08-09"
track: "python"
decision: "本课的学习障碍集中在任务、队列、取消与结构化并发。读完文字后仍需同时追踪“Semaphore、Queue 背压、join 与 shutdown”中的多项变化，因此用顺序流程把相邻正文的真实机制拆成可单步核对的状态。"
---

## 视觉实验

### 让输入穿过“Semaphore、Queue 背压、join 与 shutdown”

id: "python-08-09-main"
kind: "flow"
placement: "mechanisms"
summary: "把本课核心机制中的真实状态与约束按步骤展开，使学习者能观察“Semaphore、Queue 背压、join 与 shutdown”中先发生什么、后发生什么，以及哪一个不变量不能被视觉过渡掩盖。"
caption: "当前高亮表示输入沿处理阶段的推进次序；步骤文字直接取自本课核心机制。动画不表示 CPython 的真实耗时、内存比例或跨版本私有布局，最终以官方入口、源码节选与可运行断言为证据。"
actionLabel: "播放处理流程"

#### 步骤

- asyncio Queue/Sema… | asyncio Queue/Semaphore 只用于同一 event loop，不是线程安全容器。
- Semaphore cancella… | Semaphore cancellation 要归还尚未消费或已分配 token。
- Queue maxsize=0 表示… | Queue maxsize=0 表示无界，不具备内存背压。
- sentinel 终止与 shutd… | sentinel 终止与 shutdown API 的多消费者传播语义不同。

#### 观察重点

- 推进前先预测下一步会改变任务、队列、取消与结构化并发中的哪一项，并指出至少一个必须保持不变的条件。
- 视觉省略了平台、实现和版本分支；涉及 CPython 私有细节时，回到本课官方入口、源码路径与运行示例复核。
