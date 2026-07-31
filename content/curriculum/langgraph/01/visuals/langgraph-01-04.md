---
lesson: "langgraph-01-04"
track: "langgraph"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 展开「START、END 与静态边：入口、终止、fan-out 和 join」的节点与依赖

id: "langgraph-01-04-main"
kind: "graph"
placement: "chapter:2"
summary: "START 和 END 看起来像两个节点，实际是编译协议中的哨兵。START 把一次 invoke 的输入写入专用临时 channel，并触发入口节点；END 不执行函数，也不保存业务 State，它表示该控制分支不再产生下一节点信号。"
caption: "节点和连线表示依赖关系与当前可观察阶段；真实图中的条件边、并行合并、失败与重放必须回到源码逐项核对。"
actionLabel: "推进节点状态"

#### 步骤

- START 是保留的 start 控 | START 是保留的 `__start__` 控制地址。
- compile 为 START 创建 | compile 为 START 创建 EphemeralValue 输入 channel 与隐藏 PregelNode。
- 入口 edge 把 START 输入 | 入口 edge 把 START 输入信号连接到首批 node trigger。
- END 是保留的 end 终止目标， | END 是保留的 `__end__` 终止目标，没有普通业务 actor。
- 普通静态 edge 让源节点 wri | 普通静态 edge 让源节点 writer 发布目标 branch trigger。

#### 观察重点

- 给 START/END 添加业务函数或业务 State。
- 认为 A→B 会在同一调用栈或同一 super-step 执行。
