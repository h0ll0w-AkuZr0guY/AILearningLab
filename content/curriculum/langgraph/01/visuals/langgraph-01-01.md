---
lesson: "langgraph-01-01"
track: "langgraph"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 展开「函数链为何不足：显式图、状态机与执行日志边界」的节点与依赖

id: "langgraph-01-01-main"
kind: "graph"
placement: "chapter:2"
summary: "函数链适合拓扑固定、每步只执行一次、失败后整体重试的短流程。Agent 工作流通常会循环调用模型与工具，按状态选择路径，并在外部审批、限流或长时间 I/O 前暂停。把这些规则埋在递归函数和 if/else 中，代码当然能跑，但运行时无法回答“现在停在哪、下一步是谁、哪些结果已经持久化、恢复后哪些副作用不能再做”。"
caption: "节点和连线表示依赖关系与当前可观察阶段；真实图中的条件边、并行合并、失败与重放必须回到源码逐项核对。"
actionLabel: "推进节点状态"

#### 步骤

- StateGraph 负责声明，Co | StateGraph 负责声明，CompiledStateGraph/Pregel 负责运行。
- 节点订阅 channel | 节点订阅 channel；被更新 channel 决定下一 super-step 的活跃节点。
- 同一 super-step 的节点读 | 同一 super-step 的节点读取同一旧快照，写入在 barrier 后统一可见。
- 边会被编译为 channel 写入与 | 边会被编译为 channel 写入与 trigger，不等同于运行时扫描邻接表。
- 业务 State 与 runtime | 业务 State 与 runtime context 使用不同生命周期和序列化合同。

#### 观察重点

- 把 LangGraph 当成只会画图的函数链包装器。
- 把模型、连接池、密钥和锁写进可持久化 State。
