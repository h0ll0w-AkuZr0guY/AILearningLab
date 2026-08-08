---
lesson: "langchain-02-04"
track: "langchain"
decision: "文字分别解释 stream、batch 和自动流式，但学习者仍容易把时间顺序、输入并发和回退分派混为一个开关，因此用 flow 展示三条证据轴的汇合。"
---

## 视觉实验

### 让模型选择 stream、batch 或回退

id: "langchain-02-04-execution-modes"
kind: "flow"
placement: "chapter:3"
summary: "观察显式 stream、batch、as-completed 和 callback 触发的隐式流式分别在哪里改变输出时间与索引，而不是把它们当成速度标签。"
caption: "步骤表达固定源码的默认回退和索引合同，不承诺任何 provider 的真实吞吐或首 token 延迟；验证入口是 `runnables/base.py#L919-L967`、`#L989-L1052`、`#L1182-L1201` 与 `chat_models.py#L513-L535`。"
actionLabel: "推进执行模式"

#### 步骤

- 单次调用 | `invoke` 请求一个完整结果；默认 Runnable stream 可能只把它包成一个元素。
- 分块路径 | provider 实现 `_stream` 或 transform 时，输出可以逐块到达并在末端重新聚合。
- 顺序批处理 | `batch` 并行独立输入，但输出位置与输入列表保持一致。
- 完成即返 | `batch_as_completed` 先返回完成的 `(index, result)`，到达顺序可以不同。
- 强制回退 | `disable_streaming`、tool calling 条件或未实现 stream 时，流式请求回到 invoke/缓存主路径。

#### 观察重点

- 推进前预测：as-completed 的第二个结果如何回填原列表，以及默认 stream 是否真的拆出多个 chunk。
- 用示例的失败保位、逆序完成和单块/多块 stream 断言可观察合同，不写未经基准验证的性能结论。
