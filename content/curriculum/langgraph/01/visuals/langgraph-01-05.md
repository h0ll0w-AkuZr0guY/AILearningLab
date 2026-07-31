---
lesson: "langgraph-01-05"
track: "langgraph"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 逐帧对比「节点执行契约：Runnable、同步/异步、返回更新与副作用」的状态边界

id: "langgraph-01-05-main"
kind: "state"
placement: "chapter:2"
summary: "LangGraph node 的最小合同是“读取当前 State snapshot，返回 partial update”。它可以是普通函数、async function、Runnable 或子图。框架会把 callable 适配为 Runnable，再在执行时按签名注入 config/runtime，并把返回值解释为 State update 与控制命令。"
caption: "左右状态卡只压缩本课的前态、现态与不变量；对象身份、生命周期或队列结论仍要用正文中的代码和源码分支验证。"
actionLabel: "播放状态变化"

#### 步骤

- addnode 从函数名/Runna | add_node 从函数名/Runnable name 推断稳定节点名称，或接受显式名称。
- coercetorunnable 把 | coerce_to_runnable 把 callable、generator、async callable 或 Runnable 统一适配。
- RunnableCallable 检 | RunnableCallable 检查函数签名，记录可注入 config/runtime 参数。
- invoke 要求同步入口 | invoke 要求同步入口；ainvoke 优先 async，无 async 时可回退 sync。
- trace wrapper 为节点创 | trace wrapper 为节点创建 callback run，并传播 child config。

#### 观察重点

- 在 node 中原地修改 State list/dict。
- 每次返回完整 State，造成无所有权字段的隐式写入。
