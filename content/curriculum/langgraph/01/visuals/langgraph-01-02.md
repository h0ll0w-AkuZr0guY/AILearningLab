---
lesson: "langgraph-01-02"
track: "langgraph"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 沿时间线推演「StateGraph Builder 与 compile：从 schema 到 CompiledStateGraph」

id: "langgraph-01-02-main"
kind: "flow"
placement: "chapter:3"
summary: "`StateGraph` 是可变 builder：开发者逐步加入 schema、node、edge 和 branch。`CompiledStateGraph` 是某一时刻的可执行快照：包含 Pregel actors、channels、触发器、写入器以及持久化/缓存依赖。把两者分开，相当于编译器分开 AST 与 executable plan。"
caption: "箭头表达本课讨论的因果与执行顺序，不承诺真实墙钟时长；并行、失败和回退分支仍以源码与可运行实验为准。"
actionLabel: "播放执行流程"

#### 步骤

- StateGraph 保存可编辑的  | StateGraph 保存可编辑的 nodes、edges、branches、schemas 与 reducer。
- compile 先规范化 check | compile 先规范化 checkpointer，再执行 builder 结构验证。
- State schema 被降低为普 | State schema 被降低为普通 channels 与 managed values。
- input/output schem | input/output schema 决定外部调用和返回投影，不等同于内部完整 State。
- CompiledStateGraph | CompiledStateGraph 继承 Pregel，因此天然提供 invoke、stream、batch 和 async API。

#### 观察重点

- 认为 compile 只是设置一个布尔值。
- compile 通过后就不写节点返回值和 reducer 测试。
