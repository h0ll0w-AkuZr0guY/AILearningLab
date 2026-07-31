---
lesson: "python-06-06"
track: "python"
decision: "本课的学习障碍集中在导入查找、模块缓存与构建管线。读完文字后仍需同时追踪“普通包、__path__ 与 namespace package”中的多项变化，因此用顺序流程把相邻正文的真实机制拆成可单步核对的状态。"
---

## 视觉实验

### 让输入穿过“普通包、__path__ 与 namespace package”

id: "python-06-06-main"
kind: "flow"
placement: "mechanisms"
summary: "把本课核心机制中的真实状态与约束按步骤展开，使学习者能观察“普通包、__path__ 与 namespace package”中先发生什么、后发生什么，以及哪一个不变量不能被视觉过渡掩盖。"
caption: "当前高亮表示输入沿处理阶段的推进次序；步骤文字直接取自本课核心机制。动画不表示 CPython 的真实耗时、内存比例或跨版本私有布局，最终以官方入口、源码节选与可运行断言为证据。"
actionLabel: "播放处理流程"

#### 步骤

- spec.submodule_sea… | spec.submodule_search_locations 非 None 即表示 package。
- 普通包先执行 __init__.py… | 普通包先执行 __init__.py，再开始子模块加载。
- namespace path 会在父… | namespace path 会在父搜索路径变化时动态重算。
- importlib.resource… | importlib.resources 应替代拼接 __file__ 读取包资源。

#### 观察重点

- 推进前先预测下一步会改变导入查找、模块缓存与构建管线中的哪一项，并指出至少一个必须保持不变的条件。
- 视觉省略了平台、实现和版本分支；涉及 CPython 私有细节时，回到本课官方入口、源码路径与运行示例复核。
