---
lesson: "python-10-07"
track: "python"
decision: "本课的学习障碍集中在从源码到字节码再到解释器执行。读完文字后仍需同时追踪“assembler、jump fixup、exception table 与 code object”中的多项变化，因此用结构格把相邻正文的真实机制拆成可单步核对的状态。"
---

## 视觉实验

### 展开结构并定位“assembler、jump fixup、exception table 与 code object”

id: "python-10-07-main"
kind: "tensor"
placement: "mechanisms"
summary: "把本课核心机制中的真实状态与约束按步骤展开，使学习者能观察“assembler、jump fixup、exception table 与 code object”中先发生什么、后发生什么，以及哪一个不变量不能被视觉过渡掩盖。"
caption: "当前高亮表示内存槽位、表项或执行结构的相对布局；步骤文字直接取自本课核心机制。动画不表示 CPython 的真实耗时、内存比例或跨版本私有布局，最终以官方入口、源码节选与可运行断言为证据。"
actionLabel: "展开结构变化"

#### 步骤

- 常量、名称和 localsplus … | 常量、名称和 localsplus 通过表索引压缩到 oparg。
- line table 用紧凑编码表达… | line table 用紧凑编码表达 instruction range 到源码位置的变化。
- exception table 编码… | exception table 编码 start、length、target、stack depth 等字段，并按执行偏移查找。
- co_stacksize 来自 CF… | co_stacksize 来自 CFG 数据流最大值，直接决定 frame value stack 容量。
- marshal/pyc 可序列化 c… | marshal/pyc 可序列化 code object，但内部格式随 Python 版本变化，不是长期协议。

#### 观察重点

- 推进前先预测下一步会改变从源码到字节码再到解释器执行中的哪一项，并指出至少一个必须保持不变的条件。
- 视觉省略了平台、实现和版本分支；涉及 CPython 私有细节时，回到本课官方入口、源码路径与运行示例复核。
