---
lesson: "langgraph-01-03"
track: "langgraph"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 展开「Pregel super-step：Plan、Execute、Update 与 BSP barrier」的节点与依赖

id: "langgraph-01-03-main"
kind: "playground"
placement: "chapter:2"
summary: "super-step 是理解 LangGraph 并发语义的核心单位。同一轮被选中的节点都从轮次开始时的 channel 快照读取，执行产生的 writes 暂存在任务中。无论一个节点比兄弟快多少，它的结果都不会在当前轮被另一个兄弟读取；所有选中任务结束后，Update barrier 才统一归并。"
caption: "节点和连线表示依赖关系与当前可观察阶段；真实图中的条件边、并行合并、失败与重放必须回到源码逐项核对。"
actionLabel: "推进节点状态"
component: "langgraph-01-03/pregel-superstep"

#### 步骤

- START/input channe | START/input channel 在第一轮触发入口 actor。
- Plan 比较 channelver | Plan 比较 channel_versions 与 node versions_seen，选择有新消息的 actor。
- 同一 node 可由多个 Send  | 同一 node 可由多个 Send 形成多个独立 PUSH tasks。
- Execution 并发运行本轮 t | Execution 并发运行本轮 tasks，并把结果暂存为 task writes。
- 本轮 writes 在 aftert | 本轮 writes 在 after_tick 前对所有节点不可见。

#### 观察重点

- 把 super-step 解释成“每个节点执行一次”。
- 认为并发兄弟能立即读取先完成节点的写入。
