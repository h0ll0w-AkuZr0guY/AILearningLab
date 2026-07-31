---
lesson: "python-07-05"
track: "python"
decision: "本课的学习障碍集中在类型关系、泛型解算与分支收窄。读完文字后仍需同时追踪“ABC 名义子类型、register 与 __subclasshook__”中的多项变化，因此用关系图把相邻正文的真实机制拆成可单步核对的状态。"
---

## 视觉实验

### 沿关系逐点追踪“ABC 名义子类型、register 与 __subclasshook__”

id: "python-07-05-main"
kind: "graph"
placement: "mechanisms"
summary: "把本课核心机制中的真实状态与约束按步骤展开，使学习者能观察“ABC 名义子类型、register 与 __subclasshook__”中先发生什么、后发生什么，以及哪一个不变量不能被视觉过渡掩盖。"
caption: "当前高亮表示对象、名称、类型或依赖之间的关系；步骤文字直接取自本课核心机制。动画不表示 CPython 的真实耗时、内存比例或跨版本私有布局，最终以官方入口、源码节选与可运行断言为证据。"
actionLabel: "推进关系追踪"

#### 步骤

- abstractmethod 可与 … | abstractmethod 可与 property/classmethod 组合，装饰器顺序有要求。
- register 返回被注册类 | register 返回被注册类，可作装饰器。
- 虚拟子类的 MRO 不包含 ABC | 虚拟子类的 MRO 不包含 ABC，super 不会进入 ABC 实现。
- get_cache_token 可观… | get_cache_token 可观察虚拟注册缓存失效。

#### 观察重点

- 推进前先预测下一步会改变类型关系、泛型解算与分支收窄中的哪一项，并指出至少一个必须保持不变的条件。
- 视觉省略了平台、实现和版本分支；涉及 CPython 私有细节时，回到本课官方入口、源码路径与运行示例复核。
