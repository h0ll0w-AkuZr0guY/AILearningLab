---
lesson: "python-05-09"
track: "python"
decision: "本课的学习障碍集中在异常传播、控制流与资源清理。读完文字后仍需同时追踪“async with、取消与可靠异步清理”中的多项变化，因此用顺序流程把相邻正文的真实机制拆成可单步核对的状态。"
---

## 视觉实验

### 让输入穿过“async with、取消与可靠异步清理”

id: "python-05-09-main"
kind: "flow"
placement: "mechanisms"
summary: "把本课核心机制中的真实状态与约束按步骤展开，使学习者能观察“async with、取消与可靠异步清理”中先发生什么、后发生什么，以及哪一个不变量不能被视觉过渡掩盖。"
caption: "当前高亮表示输入沿处理阶段的推进次序；步骤文字直接取自本课核心机制。动画不表示 CPython 的真实耗时、内存比例或跨版本私有布局，最终以官方入口、源码节选与可运行断言为证据。"
actionLabel: "播放处理流程"

#### 步骤

- async with EXPR as… | async with EXPR as value 依次 await __aenter__、运行 body、await __aexit__。
- __aexit__ 收到 Cance… | __aexit__ 收到 CancelledError 时也可清理，但通常应返回 False 让取消继续传播。
- AsyncExitStack 同一栈… | AsyncExitStack 同一栈可登记同步与异步退出回调并按 LIFO await。
- 清理失败可能替换原业务异常 | 清理失败可能替换原业务异常；关键系统可用 notes/ExceptionGroup 保存两个失败。

#### 观察重点

- 推进前先预测下一步会改变异常传播、控制流与资源清理中的哪一项，并指出至少一个必须保持不变的条件。
- 视觉省略了平台、实现和版本分支；涉及 CPython 私有细节时，回到本课官方入口、源码路径与运行示例复核。
