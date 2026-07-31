---
lesson: "python-06-11"
track: "python"
decision: "本课的学习障碍集中在导入查找、模块缓存与构建管线。读完文字后仍需同时追踪“pyproject、build frontend/backend 与 wheel”中的多项变化，因此用顺序流程把相邻正文的真实机制拆成可单步核对的状态。"
---

## 视觉实验

### 让输入穿过“pyproject、build frontend/backend 与 wheel”

id: "python-06-11-main"
kind: "flow"
placement: "mechanisms"
summary: "把本课核心机制中的真实状态与约束按步骤展开，使学习者能观察“pyproject、build frontend/backend 与 wheel”中先发生什么、后发生什么，以及哪一个不变量不能被视觉过渡掩盖。"
caption: "当前高亮表示输入沿处理阶段的推进次序；步骤文字直接取自本课核心机制。动画不表示 CPython 的真实耗时、内存比例或跨版本私有布局，最终以官方入口、源码节选与可运行断言为证据。"
actionLabel: "播放处理流程"

#### 步骤

- frontend 调 get_req… | frontend 调 get_requires_for_build_*、prepare_metadata_for_build_wheel、build_wheel 等 hooks。
- distribution name … | distribution name 用于索引安装，import package name 可以不同。
- wheel 安装主要解包文件并按 .… | wheel 安装主要解包文件并按 .data scheme 放置，同时验证 RECORD。
- src layout 减少在仓库根目… | src layout 减少在仓库根目录意外导入未安装源码的问题。

#### 观察重点

- 推进前先预测下一步会改变导入查找、模块缓存与构建管线中的哪一项，并指出至少一个必须保持不变的条件。
- 视觉省略了平台、实现和版本分支；涉及 CPython 私有细节时，回到本课官方入口、源码路径与运行示例复核。
