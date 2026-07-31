---
lesson: "python-08-01"
track: "python"
decision: "本课的学习障碍集中在 ready deque、scheduled timer heap 与轮次快照的同时变化。使用可单步 playground 展示回调何时进入本轮、何时被推迟到下一轮。"
---

## 视觉实验

### 推进一次 _run_once，观察三类队列如何换位

id: "python-08-01-main"
kind: "playground"
placement: "example"
component: "python-08-01/event-loop-turn"
summary: "同时展示 ready deque、timer heap 与 next-turn 区域，让到期 timer、当前轮快照和回调内新建任务的边界变得可观察。"
caption: "队列卡片表达相对归属与轮次边界，不表达真实等待时长；_run_once 的选择器等待、取消清理和 ready 快照仍以 CPython 源码为准。"
actionLabel: "推进事件循环"

#### 步骤

- call_soon 追加 ready… | call_soon 追加 ready，call_later/call_at 进入 scheduled heap。
- loop.time 使用 monot… | loop.time 使用 monotonic clock，避免系统时间跳变影响 deadline。
- 取消 timer 通常先标记 | 取消 timer 通常先标记，达到比例阈值再批量整理堆。
- 一个 callback 的同步执行时… | 一个 callback 的同步执行时间直接阻塞整条 loop。

#### 观察重点

- 推进前先预测下一步会改变任务、队列、取消与结构化并发中的哪一项，并指出至少一个必须保持不变的条件。
- 视觉省略了平台、实现和版本分支；涉及 CPython 私有细节时，回到本课官方入口、源码路径与运行示例复核。
