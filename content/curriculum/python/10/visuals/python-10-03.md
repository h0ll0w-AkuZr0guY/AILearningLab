---
lesson: "python-10-03"
track: "python"
decision: "本课的学习障碍集中在从源码到字节码再到解释器执行。读完文字后仍需同时追踪“PEG parser：回溯、memo、cut 与错误规则”中的多项变化，因此用顺序流程把相邻正文的真实机制拆成可单步核对的状态。"
---

## 视觉实验

### 让输入穿过“PEG parser：回溯、memo、cut 与错误规则”

id: "python-10-03-main"
kind: "flow"
placement: "mechanisms"
summary: "把本课核心机制中的真实状态与约束按步骤展开，使学习者能观察“PEG parser：回溯、memo、cut 与错误规则”中先发生什么、后发生什么，以及哪一个不变量不能被视觉过渡掩盖。"
caption: "当前高亮表示输入沿处理阶段的推进次序；步骤文字直接取自本课核心机制。动画不表示 CPython 的真实耗时、内存比例或跨版本私有布局，最终以官方入口、源码节选与可运行断言为证据。"
actionLabel: "播放处理流程"

#### 步骤

- &e 和 | &e 和 !e 分别做正/负 lookahead，只检查而不消费 token。
- ~ cut 提交当前 alterna… | ~ cut 提交当前 alternative；它会影响接受路径和错误位置，应谨慎放置。
- &&e eager parse 在失… | &&e eager parse 在失败时立即抛 SyntaxError，适合语法必须出现的部分。
- grammar action 用捕获… | grammar action 用捕获值和 EXTRA 宏构造带范围的 AST 节点。
- soft keyword 用双引号表… | soft keyword 用双引号表示，只在该语法上下文匹配；普通 keyword 用单引号。

#### 观察重点

- 推进前先预测下一步会改变从源码到字节码再到解释器执行中的哪一项，并指出至少一个必须保持不变的条件。
- 视觉省略了平台、实现和版本分支；涉及 CPython 私有细节时，回到本课官方入口、源码路径与运行示例复核。
