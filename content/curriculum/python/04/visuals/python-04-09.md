---
lesson: "python-04-09"
track: "python"
decision: "本课的学习障碍集中在迭代协议、暂停帧与生成器状态。读完文字后仍需同时追踪“awaitable 与 __await__ 迭代协议”中的多项变化，因此用顺序流程把相邻正文的真实机制拆成可单步核对的状态。"
---

## 视觉实验

### 让输入穿过“awaitable 与 __await__ 迭代协议”

id: "python-04-09-main"
kind: "flow"
placement: "mechanisms"
summary: "把本课核心机制中的真实状态与约束按步骤展开，使学习者能观察“awaitable 与 __await__ 迭代协议”中先发生什么、后发生什么，以及哪一个不变量不能被视觉过渡掩盖。"
caption: "当前高亮表示输入沿处理阶段的推进次序；步骤文字直接取自本课核心机制。动画不表示 CPython 的真实耗时、内存比例或跨版本私有布局，最终以官方入口、源码节选与可运行断言为证据。"
actionLabel: "播放处理流程"

#### 步骤

- __await__ 每次调用应返回符… | __await__ 每次调用应返回符合 iterator 协议的对象，常见写法是内部生成器的 __await__。
- Future.__await__ 未… | Future.__await__ 未完成时向事件循环 yield 自身，完成后返回 result 或抛保存的异常。
- coroutine.send/thr… | coroutine.send/throw/close 与 generator 对应，但 coroutine 不能直接普通迭代。
- 已完成的 native corout… | 已完成的 native coroutine 不能再次 await，否则 RuntimeError。

#### 观察重点

- 推进前先预测下一步会改变迭代协议、暂停帧与生成器状态中的哪一项，并指出至少一个必须保持不变的条件。
- 视觉省略了平台、实现和版本分支；涉及 CPython 私有细节时，回到本课官方入口、源码路径与运行示例复核。
