---
lesson: "python-03-06"
track: "python"
decision: "本课的学习障碍集中在函数对象、调用帧、闭包与参数绑定。读完文字后仍需同时追踪“参数绑定：positional-only、keyword-only、*args 与 **kwargs”中的多项变化，因此用对照实验把相邻正文的真实机制拆成可单步核对的状态。"
---

## 视觉实验

### 切换条件并比较“参数绑定：positional-only、keyword-only、*args 与 **kwargs”

id: "python-03-06-main"
kind: "playground"
placement: "example"
summary: "把本课核心机制中的真实状态与约束按步骤展开，使学习者能观察“参数绑定：positional-only、keyword-only、*args 与 **kwargs”中先发生什么、后发生什么，以及哪一个不变量不能被视觉过渡掩盖。"
caption: "当前高亮表示条件变化前后的可观察行为差异；步骤文字直接取自本课核心机制。动画不表示 CPython 的真实耗时、内存比例或跨版本私有布局，最终以官方入口、源码节选与可运行断言为证据。"
actionLabel: "切换对照条件"

#### 步骤

- "/" 之前参数只能按位置传递 | "/" 之前参数只能按位置传递，允许 **kwargs 中出现同名业务键而不冲突。
- "*" 之后参数只能按关键字传递 | "*" 之后参数只能按关键字传递，使调用意图稳定且便于扩展。
- *args 总是 tuple | *args 总是 tuple，**kwargs 为新 dict，只接收未被正式参数消费的实参。
- defaults 在绑定缺失参数时填… | defaults 在绑定缺失参数时填入；Signature.bind 后需 apply_defaults 才会显式出现在 mapping。

#### 观察重点

- 推进前先预测下一步会改变函数对象、调用帧、闭包与参数绑定中的哪一项，并指出至少一个必须保持不变的条件。
- 视觉省略了平台、实现和版本分支；涉及 CPython 私有细节时，回到本课官方入口、源码路径与运行示例复核。
