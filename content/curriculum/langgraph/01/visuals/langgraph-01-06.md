---
lesson: "langgraph-01-06"
track: "langgraph"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 逐帧对比「状态快照与执行元数据：values、tasks、next 与 config」的状态边界

id: "langgraph-01-06-main"
kind: "state"
placement: "chapter:2"
summary: "第一次调用 graph.get_state 时，最容易把返回值当成“一个更漂亮的 state dict”。这个理解会把恢复问题压扁。StateSnapshot 同时回答三类问题：业务已经知道什么，运行时准备执行什么，以及这份观察属于哪条线程的哪个历史坐标。三类字段拥有不同所有者和演进节奏。"
caption: "左右状态卡只压缩本课的前态、现态与不变量；对象身份、生命周期或队列结论仍要用正文中的代码和源码分支验证。"
actionLabel: "播放状态变化"

#### 步骤

- StateSnapshot 描述 s | StateSnapshot 描述 step 开始边界，values 与 next 在时间线上相隔一次调度。
- values 是 channel 的 | values 是 channel 的公开值，调度内部版本与触发器不属于业务 State。
- next 是节点名摘要，tasks  | next 是节点名摘要，tasks 是带身份、错误、中断和子图状态的执行单元。
- threadid 选择线程，chec | thread_id 选择线程，checkpoint_id 选择历史坐标，checkpoint_ns 隔离嵌套图。
- metadata.source 区分 | metadata.source 区分 input、loop、update，metadata.writes 解释快照来历。

#### 观察重点

- 把 snapshot.values 当成完整 checkpoint 底层结构并手工改写。
- 把 next 当作刚执行完成的节点，故障时间线整体错一轮。
