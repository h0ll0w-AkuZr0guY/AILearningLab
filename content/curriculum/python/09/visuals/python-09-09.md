---
lesson: "python-09-09"
track: "python"
decision: "本课的学习障碍集中在数据布局、复杂度、性能与诊断证据。读完文字后仍需同时追踪“GIL、释放点、free-threading 与线程安全”中的多项变化，因此用状态机把相邻正文的真实机制拆成可单步核对的状态。"
---

## 视觉实验

### 推进状态并观察“GIL、释放点、free-threading 与线程安全”

id: "python-09-09-main"
kind: "state"
placement: "mechanisms"
summary: "把本课核心机制中的真实状态与约束按步骤展开，使学习者能观察“GIL、释放点、free-threading 与线程安全”中先发生什么、后发生什么，以及哪一个不变量不能被视觉过渡掩盖。"
caption: "当前高亮表示对象或执行状态的离散迁移；步骤文字直接取自本课核心机制。动画不表示 CPython 的真实耗时、内存比例或跨版本私有布局，最终以官方入口、源码节选与可运行断言为证据。"
actionLabel: "播放状态迁移"

#### 步骤

- sys._is_gil_enable… | sys._is_gil_enabled 检查运行态，sysconfig Py_GIL_DISABLED 检查构建能力。
- NumPy/压缩/加密等 C 代码可… | NumPy/压缩/加密等 C 代码可能释放 GIL并行，需看具体 API。
- 内建类型内部锁是实现保护 | 内建类型内部锁是实现保护，不是多步骤业务事务。
- 锁、Queue、immutable … | 锁、Queue、immutable snapshot 仍是跨构建可移植同步合同。

#### 观察重点

- 推进前先预测下一步会改变数据布局、复杂度、性能与诊断证据中的哪一项，并指出至少一个必须保持不变的条件。
- 视觉省略了平台、实现和版本分支；涉及 CPython 私有细节时，回到本课官方入口、源码路径与运行示例复核。
