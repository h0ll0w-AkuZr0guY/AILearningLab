---
lesson: "python-10-04"
track: "python"
decision: "本课的学习障碍集中在从源码到字节码再到解释器执行。读完文字后仍需同时追踪“ASDL、AST 节点与源码位置”中的多项变化，因此用关系图把相邻正文的真实机制拆成可单步核对的状态。"
---

## 视觉实验

### 沿关系逐点追踪“ASDL、AST 节点与源码位置”

id: "python-10-04-main"
kind: "graph"
placement: "mechanisms"
summary: "把本课核心机制中的真实状态与约束按步骤展开，使学习者能观察“ASDL、AST 节点与源码位置”中先发生什么、后发生什么，以及哪一个不变量不能被视觉过渡掩盖。"
caption: "当前高亮表示对象、名称、类型或依赖之间的关系；步骤文字直接取自本课核心机制。动画不表示 CPython 的真实耗时、内存比例或跨版本私有布局，最终以官方入口、源码节选与可运行断言为证据。"
actionLabel: "推进关系追踪"

#### 步骤

- stmt*、expr* 在 C 层通… | stmt*、expr* 在 C 层通常映射为 asdl_seq，并由 arena 持有。
- ctx 区分 Name/Attrib… | ctx 区分 Name/Attribute/Subscript 被 Load、Store 或 Del，后续决定读写 opcode。
- ast.Load 等 singlet… | ast.Load 等 singleton operator 节点复用对象，修改它可能影响同一树的其他位置。
- ast.fix_missing_lo… | ast.fix_missing_locations 只能从父节点补近似位置，无法恢复真实 token 边界。
- compile(ast_obj | compile(ast_obj, ...) 会先验证字段和上下文，不是任意拼装节点都能进入 codegen。

#### 观察重点

- 推进前先预测下一步会改变从源码到字节码再到解释器执行中的哪一项，并指出至少一个必须保持不变的条件。
- 视觉省略了平台、实现和版本分支；涉及 CPython 私有细节时，回到本课官方入口、源码路径与运行示例复核。
