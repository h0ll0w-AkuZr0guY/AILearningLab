---
lesson: "python-09-02"
track: "python"
decision: "本课的学习障碍集中在数据布局、复杂度、性能与诊断证据。读完文字后仍需同时追踪“list、deque 与紧凑/分块存储取舍”中的多项变化，因此用结构格把相邻正文的真实机制拆成可单步核对的状态。"
---

## 视觉实验

### 展开结构并定位“list、deque 与紧凑/分块存储取舍”

id: "python-09-02-main"
kind: "tensor"
placement: "mechanisms"
summary: "把本课核心机制中的真实状态与约束按步骤展开，使学习者能观察“list、deque 与紧凑/分块存储取舍”中先发生什么、后发生什么，以及哪一个不变量不能被视觉过渡掩盖。"
caption: "当前高亮表示内存槽位、表项或执行结构的相对布局；步骤文字直接取自本课核心机制。动画不表示 CPython 的真实耗时、内存比例或跨版本私有布局，最终以官方入口、源码节选与可运行断言为证据。"
actionLabel: "展开结构变化"

#### 步骤

- list capacity 与 le… | list capacity 与 len 分离，sys.getsizeof 可观察阶梯增长。
- 切片创建新 list 并增加元素引用… | 切片创建新 list 并增加元素引用，不复制元素本体。
- deque maxlen 在满时自动… | deque maxlen 在满时自动从另一端淘汰。
- queue.Queue/asynci… | queue.Queue/asyncio.Queue 是同步协议，不等于裸 deque。

#### 观察重点

- 推进前先预测下一步会改变数据布局、复杂度、性能与诊断证据中的哪一项，并指出至少一个必须保持不变的条件。
- 视觉省略了平台、实现和版本分支；涉及 CPython 私有细节时，回到本课官方入口、源码路径与运行示例复核。
