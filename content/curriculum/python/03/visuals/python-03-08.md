---
lesson: "python-03-08"
track: "python"
decision: "本课的学习障碍集中在函数对象、调用帧、闭包与参数绑定。读完文字后仍需同时追踪“functools.wraps、__wrapped__ 与签名保真”中的多项变化，因此用顺序流程把相邻正文的真实机制拆成可单步核对的状态。"
---

## 视觉实验

### 让输入穿过“functools.wraps、__wrapped__ 与签名保真”

id: "python-03-08-main"
kind: "flow"
placement: "mechanisms"
summary: "把本课核心机制中的真实状态与约束按步骤展开，使学习者能观察“functools.wraps、__wrapped__ 与签名保真”中先发生什么、后发生什么，以及哪一个不变量不能被视觉过渡掩盖。"
caption: "当前高亮表示输入沿处理阶段的推进次序；步骤文字直接取自本课核心机制。动画不表示 CPython 的真实耗时、内存比例或跨版本私有布局，最终以官方入口、源码节选与可运行断言为证据。"
actionLabel: "播放处理流程"

#### 步骤

- WRAPPER_ASSIGNMENT… | WRAPPER_ASSIGNMENTS 默认复制 module、name、qualname、doc、annotations、type params 等。
- WRAPPER_UPDATES 默认… | WRAPPER_UPDATES 默认更新 wrapper.__dict__，保留装饰器自身状态同时继承被包装元数据。
- __wrapped__ 形成可递归链… | __wrapped__ 形成可递归链，并允许工具选择是否 follow_wrapped。
- wraps 只处理运行时反射 | wraps 只处理运行时反射；静态类型和真实调用校验仍需相应签名设计。

#### 观察重点

- 推进前先预测下一步会改变函数对象、调用帧、闭包与参数绑定中的哪一项，并指出至少一个必须保持不变的条件。
- 视觉省略了平台、实现和版本分支；涉及 CPython 私有细节时，回到本课官方入口、源码路径与运行示例复核。
