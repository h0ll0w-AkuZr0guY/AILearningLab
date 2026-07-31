---
lesson: "python-04-05"
track: "python"
decision: "本课的学习障碍集中在迭代协议、暂停帧与生成器状态。读完文字后仍需同时追踪“send 注入值与生成器预激”中的多项变化，因此用状态机把相邻正文的真实机制拆成可单步核对的状态。"
---

## 视觉实验

### 推进状态并观察“send 注入值与生成器预激”

id: "python-04-05-main"
kind: "state"
placement: "mechanisms"
summary: "把本课核心机制中的真实状态与约束按步骤展开，使学习者能观察“send 注入值与生成器预激”中先发生什么、后发生什么，以及哪一个不变量不能被视觉过渡掩盖。"
caption: "当前高亮表示对象或执行状态的离散迁移；步骤文字直接取自本课核心机制。动画不表示 CPython 的真实耗时、内存比例或跨版本私有布局，最终以官方入口、源码节选与可运行断言为证据。"
actionLabel: "播放状态迁移"

#### 步骤

- value = yield outg… | value = yield outgoing：首次交出 outgoing，下一次 resume 才给 value 赋值。
- next(gen) 是 send(N… | next(gen) 是 send(None) 的便利入口。
- send 返回的是生成器下一次 yi… | send 返回的是生成器下一次 yield 的 outward value，而非刚送进去的值。
- 生成器 return 后 send … | 生成器 return 后 send 同样抛 StopIteration，返回值位于异常 value。

#### 观察重点

- 推进前先预测下一步会改变迭代协议、暂停帧与生成器状态中的哪一项，并指出至少一个必须保持不变的条件。
- 视觉省略了平台、实现和版本分支；涉及 CPython 私有细节时，回到本课官方入口、源码路径与运行示例复核。
