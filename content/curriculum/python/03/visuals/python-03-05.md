---
lesson: "python-03-05"
track: "python"
decision: "本课的学习障碍集中在函数对象、调用帧、闭包与参数绑定。读完文字后仍需同时追踪“late binding 与默认参数早绑定”中的多项变化，因此用对照实验把相邻正文的真实机制拆成可单步核对的状态。"
---

## 视觉实验

### 切换条件并比较“late binding 与默认参数早绑定”

id: "python-03-05-main"
kind: "playground"
placement: "example"
summary: "把本课核心机制中的真实状态与约束按步骤展开，使学习者能观察“late binding 与默认参数早绑定”中先发生什么、后发生什么，以及哪一个不变量不能被视觉过渡掩盖。"
caption: "当前高亮表示条件变化前后的可观察行为差异；步骤文字直接取自本课核心机制。动画不表示 CPython 的真实耗时、内存比例或跨版本私有布局，最终以官方入口、源码节选与可运行断言为证据。"
actionLabel: "切换对照条件"

#### 步骤

- late binding 路径 | late binding 路径：循环变量成为 cell，所有 closure 保存相同 cell 身份。
- 默认参数路径 | 默认参数路径：定义函数时求值，结果分别保存在每个函数对象的 __defaults__。
- factory 路径 | factory 路径：每次外层调用创建独立 frame/cell。
- functools.partial … | functools.partial 也能提前固定实参，但返回对象的反射表面与普通函数不同。

#### 观察重点

- 推进前先预测下一步会改变函数对象、调用帧、闭包与参数绑定中的哪一项，并指出至少一个必须保持不变的条件。
- 视觉省略了平台、实现和版本分支；涉及 CPython 私有细节时，回到本课官方入口、源码路径与运行示例复核。
