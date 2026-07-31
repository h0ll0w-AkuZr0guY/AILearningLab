---
lesson: "python-10-06"
track: "python"
decision: "本课的学习障碍集中在从源码到字节码再到解释器执行。读完文字后仍需同时追踪“compiler unit、basic block 与 CFG”中的多项变化，因此用关系图把相邻正文的真实机制拆成可单步核对的状态。"
---

## 视觉实验

### 沿关系逐点追踪“compiler unit、basic block 与 CFG”

id: "python-10-06-main"
kind: "graph"
placement: "mechanisms"
summary: "把本课核心机制中的真实状态与约束按步骤展开，使学习者能观察“compiler unit、basic block 与 CFG”中先发生什么、后发生什么，以及哪一个不变量不能被视觉过渡掩盖。"
caption: "当前高亮表示对象、名称、类型或依赖之间的关系；步骤文字直接取自本课核心机制。动画不表示 CPython 的真实耗时、内存比例或跨版本私有布局，最终以官方入口、源码节选与可运行断言为证据。"
actionLabel: "推进关系追踪"

#### 步骤

- VISIT 宏/visitor 按 … | VISIT 宏/visitor 按 AST 类型分派；表达式通常约定把一个结果压栈，语句约定保持入口栈平衡。
- jump target 先用 blo… | jump target 先用 block identity 表示，避免提前猜测字节偏移。
- 常量 key 要处理 1 与 Tru… | 常量 key 要处理 1 与 True、-0.0 与 0.0 等“相等但类型/位模式不同”的边界。
- 异常处理引入隐式边和 handler… | 异常处理引入隐式边和 handler 栈深度，不能只看显式 jump。
- CFG optimizer 必须保持… | CFG optimizer 必须保持 traceback 行号、异常语义和可观测指令行为，而非只追求更短。

#### 观察重点

- 推进前先预测下一步会改变从源码到字节码再到解释器执行中的哪一项，并指出至少一个必须保持不变的条件。
- 视觉省略了平台、实现和版本分支；涉及 CPython 私有细节时，回到本课官方入口、源码路径与运行示例复核。
