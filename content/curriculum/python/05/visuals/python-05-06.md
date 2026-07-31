---
lesson: "python-05-06"
track: "python"
decision: "本课的学习障碍集中在异常传播、控制流与资源清理。读完文字后仍需同时追踪“ExceptionGroup、except* 与并发多失败”中的多项变化，因此用关系图把相邻正文的真实机制拆成可单步核对的状态。"
---

## 视觉实验

### 沿关系逐点追踪“ExceptionGroup、except* 与并发多失败”

id: "python-05-06-main"
kind: "graph"
placement: "mechanisms"
summary: "把本课核心机制中的真实状态与约束按步骤展开，使学习者能观察“ExceptionGroup、except* 与并发多失败”中先发生什么、后发生什么，以及哪一个不变量不能被视觉过渡掩盖。"
caption: "当前高亮表示对象、名称、类型或依赖之间的关系；步骤文字直接取自本课核心机制。动画不表示 CPython 的真实耗时、内存比例或跨版本私有布局，最终以官方入口、源码节选与可运行断言为证据。"
actionLabel: "推进关系追踪"

#### 步骤

- ExceptionGroup 只能包… | ExceptionGroup 只能包含 Exception 子类；BaseExceptionGroup 可容纳取消、退出等 BaseException。
- subgroup(predicate… | subgroup(predicate) 保留匹配叶子及其必要父组结构；split 同时返回匹配和其余部分。
- except 与 except* 不… | except 与 except* 不能混用在同一个 try，except* 中不能 return/break/continue。
- 裸异常若被匹配 except* | 裸异常若被匹配 except*，会临时包装为空消息的组，保持处理器变量类型一致。

#### 观察重点

- 推进前先预测下一步会改变异常传播、控制流与资源清理中的哪一项，并指出至少一个必须保持不变的条件。
- 视觉省略了平台、实现和版本分支；涉及 CPython 私有细节时，回到本课官方入口、源码路径与运行示例复核。
