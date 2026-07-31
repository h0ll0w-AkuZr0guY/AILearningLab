---
lesson: "python-05-03"
track: "python"
decision: "本课的学习障碍集中在异常传播、控制流与资源清理。读完文字后仍需同时追踪“raise、bare raise 与 traceback 保真”中的多项变化，因此用状态机把相邻正文的真实机制拆成可单步核对的状态。"
---

## 视觉实验

### 推进状态并观察“raise、bare raise 与 traceback 保真”

id: "python-05-03-main"
kind: "state"
placement: "mechanisms"
summary: "把本课核心机制中的真实状态与约束按步骤展开，使学习者能观察“raise、bare raise 与 traceback 保真”中先发生什么、后发生什么，以及哪一个不变量不能被视觉过渡掩盖。"
caption: "当前高亮表示对象或执行状态的离散迁移；步骤文字直接取自本课核心机制。动画不表示 CPython 的真实耗时、内存比例或跨版本私有布局，最终以官方入口、源码节选与可运行断言为证据。"
actionLabel: "播放状态迁移"

#### 步骤

- raise 只能在活动异常处理上下文… | raise 只能在活动异常处理上下文重抛，否则 RuntimeError。
- raise SomeError 会按… | raise SomeError 会按无参构造异常实例，通常显式实例更清楚。
- exc.with_traceback… | exc.with_traceback(tb) 返回同一个异常对象并设置 traceback。
- traceback 保真应通过测试 … | traceback 保真应通过测试 stack frame names，而不只断言异常类型。

#### 观察重点

- 推进前先预测下一步会改变异常传播、控制流与资源清理中的哪一项，并指出至少一个必须保持不变的条件。
- 视觉省略了平台、实现和版本分支；涉及 CPython 私有细节时，回到本课官方入口、源码路径与运行示例复核。
