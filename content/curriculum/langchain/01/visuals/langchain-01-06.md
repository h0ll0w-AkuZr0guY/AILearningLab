---
lesson: "langchain-01-06"
track: "langchain"
decision: "读完顺序与并行章节后，学习者仍难以同时追踪输入身份、完成次序和 chunk 聚合，因此用可单步的执行流把三条时间线并置。"
---

## 视觉实验

### 推进 batch 的身份与完成顺序

id: "langchain-01-06-batch-stream-flow"
kind: "flow"
placement: "chapter:3"
summary: "并置稳定 batch、完成即交付和单输入 stream，观察同一输入在不同调用形态下如何保持身份或产生增量结果。"
caption: "编号表示输入身份，实线位置表示交付次序，chunk 只表示单个结果的增量；是否真的由 provider 合并请求仍须回到 Runnable 源码和示例断言。"
actionLabel: "推进 batch 与 stream"

#### 步骤

- 建立输入 | 输入 0、1、2 带着稳定 index 进入执行器，配置按输入复制。
- 并行运行 | 任务 1 先结束，但稳定 batch 仍把它写回结果槽 1。
- 完成交付 | `batch_as_completed` 先产生 `(1, value)`，完成次序暂时不同于输入次序。
- 重新对齐 | 消费者按 index 写回，结果列表恢复 `[output0, output1, output2]`。
- 合并 chunk | 单个 stream 产生三个可结合 chunk，聚合值与 invoke 的完整结果一致。

#### 观察重点

- 单步前先预测哪个量会变化：交付次序可以变化，index 与最终槽位必须保持。
- 视觉没有展示 provider 服务器端批处理、真实网络取消或多模态 chunk 规则，这些边界要用源码和运行实验核对。
