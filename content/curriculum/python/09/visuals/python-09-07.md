---
lesson: "python-09-07"
track: "python"
decision: "本课的学习障碍集中在数据布局、复杂度、性能与诊断证据。读完文字后仍需同时追踪“tracemalloc 快照、对象存活与 RSS 分离”中的多项变化，因此用结构格把相邻正文的真实机制拆成可单步核对的状态。"
---

## 视觉实验

### 展开结构并定位“tracemalloc 快照、对象存活与 RSS 分离”

id: "python-09-07-main"
kind: "tensor"
placement: "mechanisms"
summary: "把本课核心机制中的真实状态与约束按步骤展开，使学习者能观察“tracemalloc 快照、对象存活与 RSS 分离”中先发生什么、后发生什么，以及哪一个不变量不能被视觉过渡掩盖。"
caption: "当前高亮表示内存槽位、表项或执行结构的相对布局；步骤文字直接取自本课核心机制。动画不表示 CPython 的真实耗时、内存比例或跨版本私有布局，最终以官方入口、源码节选与可运行断言为证据。"
actionLabel: "展开结构变化"

#### 步骤

- Snapshot.compare_t… | Snapshot.compare_to 按 lineno/traceback 统计 size_diff/count_diff。
- 过滤 importlib/trace… | 过滤 importlib/tracemalloc 噪声后再排名。
- get_traced_memory … | get_traced_memory 区分 current/peak，reset_peak 只重置峰值。
- domain 允许 C 扩展标记其他… | domain 允许 C 扩展标记其他 allocator 范围。

#### 观察重点

- 推进前先预测下一步会改变数据布局、复杂度、性能与诊断证据中的哪一项，并指出至少一个必须保持不变的条件。
- 视觉省略了平台、实现和版本分支；涉及 CPython 私有细节时，回到本课官方入口、源码路径与运行示例复核。
