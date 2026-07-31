---
lesson: "python-02-05"
track: "python"
decision: "本课的学习障碍集中在属性查找、描述符优先级与方法绑定。读完文字后仍需同时追踪“函数 descriptor、绑定方法与 self 注入”中的多项变化，因此用顺序流程把相邻正文的真实机制拆成可单步核对的状态。"
---

## 视觉实验

### 让输入穿过“函数 descriptor、绑定方法与 self 注入”

id: "python-02-05-main"
kind: "flow"
placement: "mechanisms"
summary: "把本课核心机制中的真实状态与约束按步骤展开，使学习者能观察“函数 descriptor、绑定方法与 self 注入”中先发生什么、后发生什么，以及哪一个不变量不能被视觉过渡掩盖。"
caption: "当前高亮表示输入沿处理阶段的推进次序；步骤文字直接取自本课核心机制。动画不表示 CPython 的真实耗时、内存比例或跨版本私有布局，最终以官方入口、源码节选与可运行断言为证据。"
actionLabel: "播放处理流程"

#### 步骤

- C.__dict__["method… | C.__dict__["method"] 是 function；C.method 通常仍是 function，因为 __get__(None, C) 返回自身。
- obj.method 是 metho… | obj.method 是 method 对象，obj.method.__self__ is obj，obj.method.__func__ is C.__dict__["method"]。
- 每次属性读取可以创建新的 metho… | 每次属性读取可以创建新的 method 包装对象，因此 obj.method is obj.method 通常为 False。
- method 调用走 vectorc… | method 调用走 vectorcall 等优化路径，但语义上等价于 function(instance, *args, **kwargs)。

#### 观察重点

- 推进前先预测下一步会改变属性查找、描述符优先级与方法绑定中的哪一项，并指出至少一个必须保持不变的条件。
- 视觉省略了平台、实现和版本分支；涉及 CPython 私有细节时，回到本课官方入口、源码路径与运行示例复核。
