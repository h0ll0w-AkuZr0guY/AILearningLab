---
lesson: "langchain-01-12"
track: "langchain"
decision: "读完最小核心正文后，学习者仍难以追踪 callable 归一化、顺序组合、batch 失败过滤与 stream 缓冲如何共享同一 Runnable 合同，因此用 flow 展示一组输入穿过这些阶段。"
---

## 视觉实验

### 让一组输入穿过最小组合核心

id: "langchain-01-12-mini-core-flow"
kind: "flow"
placement: "chapter:3"
summary: "逐步观察普通 callable 如何变成 Runnable、多个步骤如何串联、失败输入如何保位，以及 stream 何时必须等待完整结果。"
caption: "蓝色表示仍在处理的输入，红色表示已记录但不再进入后续步骤的失败；视觉只表达协议归一化、顺序数据流和失败索引，不替代 LangChain 的 callback、并发、序列化和 provider 批处理保证，验证入口是固定 commit 的 RunnableSequence 与上游测试。"
actionLabel: "推进组合与失败保位"

#### 步骤

- 归一化 | `__or__` 把普通 callable 交给 `coerce_to_runnable`，未知对象在组合边界立即失败。
- 顺序组合 | 第一阶段输出成为第二阶段输入，sequence 保持每一步的 child 执行边界。
- batch 分层 | 当前仍成功的输入批量进入下一阶段，组件级 batch 优化发生在阶段之间，而不是只对最终结果 map。
- 失败保位 | 中间失败从后续成功输入集合中移除，同时用原索引和异常映射把失败插回最终列表。
- stream 边界 | 支持 transform 的步骤可以逐块透传；不支持的步骤必须先缓冲，视觉以静止阶段显示两种边界。

#### 观察重点

- 单步前预测第二个输入失败后下一阶段会收到哪些输入，以及最终异常应回到哪一格。
- 用 `07_minilangchain.py` 的 batch/stream/失败断言和固定 `base.py`、`test_runnable.py` 行区间验证：保位不等于回滚，逐块输出也不等于所有步骤都能实时透传。
