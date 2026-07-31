---
lesson: "python-04-03"
track: "python"
decision: "本课的学习障碍集中在迭代协议、暂停帧与生成器状态。读完文字后仍需同时追踪“生成器函数、惰性启动与对象状态”中的多项变化，因此用状态机把相邻正文的真实机制拆成可单步核对的状态。"
---

## 视觉实验

### 推进状态并观察“生成器函数、惰性启动与对象状态”

id: "python-04-03-main"
kind: "state"
placement: "mechanisms"
summary: "把本课核心机制中的真实状态与约束按步骤展开，使学习者能观察“生成器函数、惰性启动与对象状态”中先发生什么、后发生什么，以及哪一个不变量不能被视觉过渡掩盖。"
caption: "当前高亮表示对象或执行状态的离散迁移；步骤文字直接取自本课核心机制。动画不表示 CPython 的真实耗时、内存比例或跨版本私有布局，最终以官方入口、源码节选与可运行断言为证据。"
actionLabel: "播放状态迁移"

#### 步骤

- 调用 generator funct… | 调用 generator function 创建对象并保存初始 frame，不执行用户代码。
- next(gen) 等价于 gen.… | next(gen) 等价于 gen.send(None)，首次恢复从函数入口开始。
- yield value 将 valu… | yield value 将 value 交给调用者并保存恢复位置；下一次恢复后 yield 表达式结果为 None 或 send 的值。
- 正常 return、未处理异常或 c… | 正常 return、未处理异常或 close 都会进入 CLOSED，后续 next 只抛 StopIteration。

#### 观察重点

- 推进前先预测下一步会改变迭代协议、暂停帧与生成器状态中的哪一项，并指出至少一个必须保持不变的条件。
- 视觉省略了平台、实现和版本分支；涉及 CPython 私有细节时，回到本课官方入口、源码路径与运行示例复核。
