---
lesson: "python-10-09"
track: "python"
decision: "本课的学习障碍集中在从源码到字节码再到解释器执行。读完文字后仍需同时追踪“vectorcall：参数数组、关键字名称与绑定”中的多项变化，因此用结构格把相邻正文的真实机制拆成可单步核对的状态。"
---

## 视觉实验

### 展开结构并定位“vectorcall：参数数组、关键字名称与绑定”

id: "python-10-09-main"
kind: "tensor"
placement: "mechanisms"
summary: "把本课核心机制中的真实状态与约束按步骤展开，使学习者能观察“vectorcall：参数数组、关键字名称与绑定”中先发生什么、后发生什么，以及哪一个不变量不能被视觉过渡掩盖。"
caption: "当前高亮表示内存槽位、表项或执行结构的相对布局；步骤文字直接取自本课核心机制。动画不表示 CPython 的真实耗时、内存比例或跨版本私有布局，最终以官方入口、源码节选与可运行断言为证据。"
actionLabel: "展开结构变化"

#### 步骤

- nargsf 的低位/标志组合通过 … | nargsf 的低位/标志组合通过 PyVectorcall_NARGS 解码，不能直接当整数使用。
- PY_VECTORCALL_ARGU… | PY_VECTORCALL_ARGUMENTS_OFFSET 允许 callee 临时使用 args[-1] scratch slot，前提是恢复原值。
- bound method fast … | bound method fast path 可把 self 放进参数数组，避免创建临时 method object 或 tuple。
- 重新赋值 type.__call__… | 重新赋值 type.__call__ 可能改变 vectorcall 支持，缓存 callable 能力时必须遵循类型版本机制。
- vectorcall 不替 call… | vectorcall 不替 callee 自动做 recursion control；需要递归保护的实现自行进入/离开检查。

#### 观察重点

- 推进前先预测下一步会改变从源码到字节码再到解释器执行中的哪一项，并指出至少一个必须保持不变的条件。
- 视觉省略了平台、实现和版本分支；涉及 CPython 私有细节时，回到本课官方入口、源码路径与运行示例复核。
