---
lesson: "python-03-04"
track: "python"
decision: "本课的学习障碍集中在函数对象、调用帧、闭包与参数绑定。读完文字后仍需同时追踪“closure cell、cellvars 与 freevars”中的多项变化，因此用关系图把相邻正文的真实机制拆成可单步核对的状态。"
---

## 视觉实验

### 沿关系逐点追踪“closure cell、cellvars 与 freevars”

id: "python-03-04-main"
kind: "graph"
placement: "mechanisms"
summary: "把本课核心机制中的真实状态与约束按步骤展开，使学习者能观察“closure cell、cellvars 与 freevars”中先发生什么、后发生什么，以及哪一个不变量不能被视觉过渡掩盖。"
caption: "当前高亮表示对象、名称、类型或依赖之间的关系；步骤文字直接取自本课核心机制。动画不表示 CPython 的真实耗时、内存比例或跨版本私有布局，最终以官方入口、源码节选与可运行断言为证据。"
actionLabel: "推进关系追踪"

#### 步骤

- MAKE_CELL/COPY_FRE… | MAKE_CELL/COPY_FREE_VARS 等指令准备 cell 环境，LOAD_DEREF/STORE_DEREF 读取或修改绑定。
- cell 保存对象引用 | cell 保存对象引用，不执行深拷贝，因此捕获可变对象仍有别名语义。
- nonlocal 在编译期要求找到已… | nonlocal 在编译期要求找到已有外层绑定，不能凭空创建。
- 删除 cell 绑定后读取可产生 N… | 删除 cell 绑定后读取可产生 NameError/空 cell 状态，cell 对象本身仍可存在。

#### 观察重点

- 推进前先预测下一步会改变函数对象、调用帧、闭包与参数绑定中的哪一项，并指出至少一个必须保持不变的条件。
- 视觉省略了平台、实现和版本分支；涉及 CPython 私有细节时，回到本课官方入口、源码路径与运行示例复核。
