---
lesson: "langgraph-01-10"
track: "langgraph"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 逐帧对比「递归限制、停机条件与生产保护」的状态边界

id: "langgraph-01-10-main"
kind: "state"
placement: "chapter:2"
summary: "循环是 LangGraph 的核心能力，也是最容易把资源耗尽伪装成“Agent 在思考”的地方。recursion_limit 提供硬护栏：一次 invoke/stream 的 super-step 超过预算而没有停机，就抛 GraphRecursionError。它类似保险丝，只负责在电流失控时切断，不会替电路设计正确工作状态。"
caption: "左右状态卡只压缩本课的前态、现态与不变量；对象身份、生命周期或队列结论仍要用正文中的代码和源码分支验证。"
actionLabel: "播放状态变化"

#### 步骤

- recursionlimit 约束一 | recursion_limit 约束一次执行的最大 super-step 数，配置位于 config 顶层。
- 达到上限且未命中停机条件时，loop | 达到上限且未命中停机条件时，loop.status 变为 out_of_steps。
- Pregel.stream/astr | Pregel.stream/astream 在退出阶段抛 GraphRecursionError，而非返回业务成功。
- RemainingSteps 由 s | RemainingSteps 由 stop - step 动态计算，是运行时 managed value。
- 业务成功、业务失败和无进展应由显式  | 业务成功、业务失败和无进展应由显式 State 与路由表达。

#### 观察重点

- 把 GraphRecursionError 当作 Python 递归栈溢出。
- 把 recursion_limit 放进 config.configurable。
