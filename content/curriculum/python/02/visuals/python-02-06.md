---
lesson: "python-02-06"
track: "python"
decision: "本课的学习障碍集中在属性查找、描述符优先级与方法绑定。读完文字后仍需同时追踪“classmethod 与 staticmethod descriptor”中的多项变化，因此用对照实验把相邻正文的真实机制拆成可单步核对的状态。"
---

## 视觉实验

### 切换条件并比较“classmethod 与 staticmethod descriptor”

id: "python-02-06-main"
kind: "playground"
placement: "example"
summary: "把本课核心机制中的真实状态与约束按步骤展开，使学习者能观察“classmethod 与 staticmethod descriptor”中先发生什么、后发生什么，以及哪一个不变量不能被视觉过渡掩盖。"
caption: "当前高亮表示条件变化前后的可观察行为差异；步骤文字直接取自本课核心机制。动画不表示 CPython 的真实耗时、内存比例或跨版本私有布局，最终以官方入口、源码节选与可运行断言为证据。"
actionLabel: "切换对照条件"

#### 步骤

- 装饰器在类体执行时接收 functi… | 装饰器在类体执行时接收 function，返回 staticmethod/classmethod 包装对象。
- classmethod.__get_… | classmethod.__get__ 产生以 owner 为 __self__ 的绑定方法。
- 通过子类访问 inherited c… | 通过子类访问 inherited classmethod 时 owner 是子类，实现虚拟构造器。
- 包装对象的 __wrapped__、… | 包装对象的 __wrapped__、元数据传播和装饰器组合顺序会影响反射工具。

#### 观察重点

- 推进前先预测下一步会改变属性查找、描述符优先级与方法绑定中的哪一项，并指出至少一个必须保持不变的条件。
- 视觉省略了平台、实现和版本分支；涉及 CPython 私有细节时，回到本课官方入口、源码路径与运行示例复核。
