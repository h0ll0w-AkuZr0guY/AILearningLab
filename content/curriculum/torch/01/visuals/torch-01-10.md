---
lesson: "torch-01-10"
track: "torch"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 沿时间线推演「clone、contiguous 与 to：显式物化、所有权和设备迁移」

id: "torch-01-10-main"
kind: "flow"
placement: "chapter:3"
summary: "前四课关注如何借用同一 Storage；这一课讨论何时有理由结束借用。`clone`总是创建独立数据，`contiguous`仅在目标布局不满足时复制，`to`在 dtype/device 等目标已匹配且未强制 copy 时可以返回原 Tensor。它们的输出值可能相同，所有权、布局、传输与 autograd 身份却不同。"
caption: "箭头表达本课讨论的因果与执行顺序，不承诺真实墙钟时长；并行、失败和回退分支仍以源码与可运行实验为准。"
actionLabel: "播放执行流程"

#### 步骤

- clone 产生独立 Storage | clone 产生独立 Storage 并按指定 memory format 复制逻辑值。
- contiguous 已满足目标格式 | contiguous 已满足目标格式时返回 self，否则 clone。
- to 根据 device、dtype | to 根据 device、dtype、layout 和 copy 参数选择别名或转换/传输。
- 数据独立不等于 detach | 数据独立不等于 detach；梯度路径需单独设计。
- materialization 测试 | materialization 测试至少覆盖对象、Storage、值、布局和设备五层证据。

#### 观察重点

- 把每个 non-contiguous Tensor 都立即 contiguous。
- 假定 to 总是新建 Tensor，或假定 non_blocking 必然异步完成。
