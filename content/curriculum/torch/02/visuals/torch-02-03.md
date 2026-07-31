---
lesson: "torch-02-03"
track: "torch"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 逐帧对比「boolean mask」的状态边界

id: "torch-02-03-main"
kind: "state"
placement: "chapter:2"
summary: "布尔 mask 像筛子，却不只是逐元素 if。`x[mask]`把满足条件的元素压成一维或保留未被 mask 消费的尾维；输出长度依赖实际 True 数。它天然是动态 shape，也就无法像 slice 那样由固定 stride 表示为 view。"
caption: "左右状态卡只压缩本课的前态、现态与不变量；对象身份、生命周期或队列结论仍要用正文中的代码和源码分支验证。"
actionLabel: "播放状态变化"

#### 步骤

- Bool/Byte mask 逻辑上 | Bool/Byte mask 逻辑上展开为 long 坐标。
- 输出形状由 True 数与未消费的尾 | 输出形状由 True 数与未消费的尾维决定。
- 读取 materialize，赋值对 | 读取 materialize，赋值对原 tensor scatter。
- 数据相关长度会向后传播到编译、拼批与 | 数据相关长度会向后传播到编译、拼批与通信。
- mask 的 rank 是索引合同的 | mask 的 rank 是索引合同的一部分，True 数是运行时输出维。

#### 观察重点

- 将 mask 当作可随意广播的普通算子输入。
- 假定 `x[mask]`保持原 rank。
