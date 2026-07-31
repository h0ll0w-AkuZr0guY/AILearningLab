---
lesson: "torch-01-04"
track: "torch"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 把「Stride 地址代数与连续性：从索引公式到 memory_format」落到可见张量

id: "torch-01-04-main"
kind: "tensor"
placement: "chapter:2"
summary: "stride 是把多维坐标压到一维 Storage 的系数。它与线性代数中的基向量很像：每个维度前进一步，相当于在物理元素序号上加一个固定向量。理解这个地址代数后，transpose、slice、expand、diagonal 和 view 的行为都能手算，而不再靠记 API。"
caption: "格子按阶段追踪 shape、数值、stride、storage 或计算边界；精确结论必须继续用维度、数值和断言验证。"
actionLabel: "播放张量变化"

#### 步骤

- strided Tensor 使用  | strided Tensor 使用 storage_offset 加索引与 stride 点积得到元素地址。
- 默认 contiguous stri | 默认 contiguous stride 从最后一维开始按 size 累乘生成。
- permute/transpose  | permute/transpose 同步置换 sizes 与 strides，不移动 Storage。
- slice 可增加 storageo | slice 可增加 storage_offset、放大 stride 并形成地址洞。
- channelslast 是 str | channels_last 是 strided layout 下另一种连续 memory format。

#### 观察重点

- 把 stride 当字节数，重复乘或漏乘 element_size。
- 认为非 contiguous 就不是 view、不能计算或一定很慢。
