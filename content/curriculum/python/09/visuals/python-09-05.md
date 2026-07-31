---
lesson: "python-09-05"
track: "python"
decision: "本课的学习障碍集中在数据布局、复杂度、性能与诊断证据。读完文字后仍需同时追踪“cProfile、pstats 与确定性调用图”中的多项变化，因此用关系图把相邻正文的真实机制拆成可单步核对的状态。"
---

## 视觉实验

### 沿关系逐点追踪“cProfile、pstats 与确定性调用图”

id: "python-09-05-main"
kind: "graph"
placement: "mechanisms"
summary: "把本课核心机制中的真实状态与约束按步骤展开，使学习者能观察“cProfile、pstats 与确定性调用图”中先发生什么、后发生什么，以及哪一个不变量不能被视觉过渡掩盖。"
caption: "当前高亮表示对象、名称、类型或依赖之间的关系；步骤文字直接取自本课核心机制。动画不表示 CPython 的真实耗时、内存比例或跨版本私有布局，最终以官方入口、源码节选与可运行断言为证据。"
actionLabel: "推进关系追踪"

#### 步骤

- 按 cumulative 排序找昂贵… | 按 cumulative 排序找昂贵调用树，按 tottime 找自身 CPU 热点。
- print_callers/prin… | print_callers/print_callees 判断热点来自谁、扩散到哪。
- dump_stats 保存原始 pr… | dump_stats 保存原始 profile，可脱离生产进程分析。
- 内建/C 函数粒度与 Python … | 内建/C 函数粒度与 Python 函数不同，时间边界需理解。

#### 观察重点

- 推进前先预测下一步会改变数据布局、复杂度、性能与诊断证据中的哪一项，并指出至少一个必须保持不变的条件。
- 视觉省略了平台、实现和版本分支；涉及 CPython 私有细节时，回到本课官方入口、源码路径与运行示例复核。
