---
lesson: "langgraph-01-07"
track: "langgraph"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 沿时间线推演「可重放执行：checkpoint、pending writes 与恢复边界」

id: "langgraph-01-07-main"
kind: "flow"
placement: "chapter:3"
summary: "“从 checkpoint 恢复”常被想象成读出一份 state，然后从下一节点继续。并行 super-step 会暴露这个模型的空洞：A 和 B 同时运行，A 完成，B 失败；barrier 尚未通过，所以还没有包含两者合并结果的完整下一快照。若只保存 step 边界，恢复必须重跑 A 与 B。"
caption: "箭头表达本课讨论的因果与执行顺序，不承诺真实墙钟时长；并行、失败和回退分支仍以源码与可运行实验为准。"
actionLabel: "播放执行流程"

#### 步骤

- 每个 task 完成时可用 putw | 每个 task 完成时可用 put_writes 保存 task_id、channel、value。
- pending write 绑定当前 | pending write 绑定当前起始 checkpoint，不是新的完整 StateSnapshot。
- 失败 super-step 恢复时重 | 失败 super-step 恢复时重建相同任务，成功 writes 被复用，失败任务重跑。
- 所有任务完成后才通过 reducer | 所有任务完成后才通过 reducer 合并并提交下一 step checkpoint。
- task identity 区分同一 | task identity 区分同一节点的多次并行调用，不能退化成节点名缓存。

#### 观察重点

- 宣称 pending writes 提供 exactly-once 节点执行。
- 用 node name 代替 task id，fan-out 结果交叉复用。
