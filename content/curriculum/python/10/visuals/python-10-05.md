---
lesson: "python-10-05"
track: "python"
decision: "本课的学习障碍集中在从源码到字节码再到解释器执行。读完文字后仍需同时追踪“symbol table：local、global、free 与 cell”中的多项变化，因此用关系图把相邻正文的真实机制拆成可单步核对的状态。"
---

## 视觉实验

### 沿关系逐点追踪“symbol table：local、global、free 与 cell”

id: "python-10-05-main"
kind: "graph"
placement: "mechanisms"
summary: "把本课核心机制中的真实状态与约束按步骤展开，使学习者能观察“symbol table：local、global、free 与 cell”中先发生什么、后发生什么，以及哪一个不变量不能被视觉过渡掩盖。"
caption: "当前高亮表示对象、名称、类型或依赖之间的关系；步骤文字直接取自本课核心机制。动画不表示 CPython 的真实耗时、内存比例或跨版本私有布局，最终以官方入口、源码节选与可运行断言为证据。"
actionLabel: "推进关系追踪"

#### 步骤

- DEF_PARAM 与其他 loca… | DEF_PARAM 与其他 local binding 冲突规则在收集阶段即可报 SyntaxError。
- global/nonlocal 必须… | global/nonlocal 必须先于同 block 对该名称的使用或绑定声明。
- FREE_CLASS 让方法访问的 … | FREE_CLASS 让方法访问的 free variable 与类 namespace 同名绑定正确共存。
- __class__ cell 由使用… | __class__ cell 由使用 zero-argument super 或 __class__ 的方法触发并由 class 构造阶段填充。
- CO_OPTIMIZED/CO_NE… | CO_OPTIMIZED/CO_NEWLOCALS 与符号分类共同决定 frame 的 locals 表示和访问指令。

#### 观察重点

- 推进前先预测下一步会改变从源码到字节码再到解释器执行中的哪一项，并指出至少一个必须保持不变的条件。
- 视觉省略了平台、实现和版本分支；涉及 CPython 私有细节时，回到本课官方入口、源码路径与运行示例复核。
