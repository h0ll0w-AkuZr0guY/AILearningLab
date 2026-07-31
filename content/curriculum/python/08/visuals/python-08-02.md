---
lesson: "python-08-02"
track: "python"
decision: "本课的学习障碍集中在任务、队列、取消与结构化并发。读完文字后仍需同时追踪“coroutine、Future、Task 与驱动关系”中的多项变化，因此用顺序流程把相邻正文的真实机制拆成可单步核对的状态。"
---

## 视觉实验

### 让输入穿过“coroutine、Future、Task 与驱动关系”

id: "python-08-02-main"
kind: "flow"
placement: "mechanisms"
summary: "把本课核心机制中的真实状态与约束按步骤展开，使学习者能观察“coroutine、Future、Task 与驱动关系”中先发生什么、后发生什么，以及哪一个不变量不能被视觉过渡掩盖。"
caption: "当前高亮表示输入沿处理阶段的推进次序；步骤文字直接取自本课核心机制。动画不表示 CPython 的真实耗时、内存比例或跨版本私有布局，最终以官方入口、源码节选与可运行断言为证据。"
actionLabel: "播放处理流程"

#### 步骤

- await coroutine 会由… | await coroutine 会由当前 Task 直接驱动嵌套 continuation，不必显式 create_task。
- create_task 产生并发兄弟… | create_task 产生并发兄弟；直接 await 保持顺序调用。
- Future.set_result/… | Future.set_result/set_exception 只能执行一次。
- Task 同时是 Future | Task 同时是 Future，因此可 await、加 callback、查询 exception。

#### 观察重点

- 推进前先预测下一步会改变任务、队列、取消与结构化并发中的哪一项，并指出至少一个必须保持不变的条件。
- 视觉省略了平台、实现和版本分支；涉及 CPython 私有细节时，回到本课官方入口、源码路径与运行示例复核。
