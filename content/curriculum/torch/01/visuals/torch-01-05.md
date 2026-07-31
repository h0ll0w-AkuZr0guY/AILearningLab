---
lesson: "torch-01-05"
track: "torch"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 沿时间线推演「view、reshape 与 flatten：零拷贝兼容条件和复制回退」

id: "torch-01-05-main"
kind: "flow"
placement: "chapter:3"
summary: "view、reshape、flatten 都能改变 shape，差别藏在复制合同。`view`要求新 shape 可用同一 Storage 与一组新 stride 表达，不满足就报错；`reshape`优先 view，不行就复制；`flatten`在展平维度不需要改变时可能返回原对象，在兼容时返回 view，其他情况复制。只看输出 shape 无法判断所有权。"
caption: "箭头表达本课讨论的因果与执行顺序，不承诺真实墙钟时长；并行、失败和回退分支仍以源码与可运行实验为准。"
actionLabel: "播放执行流程"

#### 步骤

- infersize 检查 numel | infer_size 检查 numel 守恒并解析一个 -1 维。
- computeStride 按连续子 | computeStride 按连续子空间 chunk 判断目标 shape 能否沿用 Storage。
- view 失败即报错，成功通过 al | view 失败即报错，成功通过 alias_with_sizes_and_strides 共享数据。
- reshape 先尝试 alias， | reshape 先尝试 alias，不兼容时 clone contiguous 后再建立目标 view。
- flatten 只合并指定区间，并可 | flatten 只合并指定区间，并可能返回原对象、view 或 copy。

#### 观察重点

- 认为 numel 相同就总能 view。
- 依赖 reshape 永远零拷贝或永远复制。
