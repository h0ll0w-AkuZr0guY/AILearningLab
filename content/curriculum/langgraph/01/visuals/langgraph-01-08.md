---
lesson: "langgraph-01-08"
track: "langgraph"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 沿时间线推演「确定性：reducer 顺序、任务排序与外部 I/O」

id: "langgraph-01-08-main"
kind: "flow"
placement: "chapter:3"
summary: "确定性经常被简化成“同样输入得到同样输出”。对 Agent 工作流，更有用的目标分三层：同一 super-step 的并发 writes 以稳定顺序归并；同一已暂停运行恢复时复用已记录的非确定结果；不同全新运行允许模型、网络和时间给出不同结果。把三层混在一起，团队会对“可重放”做出超出框架能力的承诺。"
caption: "箭头表达本课讨论的因果与执行顺序，不承诺真实墙钟时长；并行、失败和回退分支仍以源码与可运行实验为准。"
actionLabel: "播放执行流程"

#### 步骤

- applywrites 按 task | apply_writes 按 task.path 稳定排序，隔离实际完成时钟。
- 排序后的 writes 先按 cha | 排序后的 writes 先按 channel 分组，再交给各 channel reducer。
- channel versions 与 | channel versions 与 versions_seen 决定哪些更新触发下一 super-step。
- 结合律影响分批归并，交换律影响重排， | 结合律影响分批归并，交换律影响重排，幂等性影响重复写。
- Functional API 用持久 | Functional API 用持久 task 结果让同一 run 恢复时复用非确定观察。

#### 观察重点

- 把稳定 reducer 顺序夸大成整个 Agent 输出确定。
- 让 reducer 读取当前时间、随机数或可变全局变量。
