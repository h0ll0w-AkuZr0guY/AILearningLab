---
lesson: "python-06-05"
track: "python"
decision: "本课的学习障碍集中在导入查找、模块缓存与构建管线。读完文字后仍需同时追踪“ModuleSpec、create_module 与 exec_module”中的多项变化，因此用状态机把相邻正文的真实机制拆成可单步核对的状态。"
---

## 视觉实验

### 推进状态并观察“ModuleSpec、create_module 与 exec_module”

id: "python-06-05-main"
kind: "state"
placement: "mechanisms"
summary: "把本课核心机制中的真实状态与约束按步骤展开，使学习者能观察“ModuleSpec、create_module 与 exec_module”中先发生什么、后发生什么，以及哪一个不变量不能被视觉过渡掩盖。"
caption: "当前高亮表示对象或执行状态的离散迁移；步骤文字直接取自本课核心机制。动画不表示 CPython 的真实耗时、内存比例或跨版本私有布局，最终以官方入口、源码节选与可运行断言为证据。"
actionLabel: "播放状态迁移"

#### 步骤

- submodule_search_l… | submodule_search_locations 为 None 表示普通模块，为序列表示包，namespace package 可由多路径组成。
- module_from_spec 调… | module_from_spec 调 create_module 并设置 __spec__、__loader__、__package__ 等属性。
- exec_module 运行时对象已… | exec_module 运行时对象已在 sys.modules，可支持递归导入。
- loader_state 可传递 f… | loader_state 可传递 finder 计算出的不可公开加载数据。

#### 观察重点

- 推进前先预测下一步会改变导入查找、模块缓存与构建管线中的哪一项，并指出至少一个必须保持不变的条件。
- 视觉省略了平台、实现和版本分支；涉及 CPython 私有细节时，回到本课官方入口、源码路径与运行示例复核。
