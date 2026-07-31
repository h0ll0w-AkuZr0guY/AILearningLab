---
lesson: "langgraph-02-01"
track: "langgraph"
decision: "读完文字后学习者仍难以同时看见外部输入、内部字段与输出投影的交接边界；状态分层图能把同一字段何时出现、何时不可见固定为可逐步检查的对象变化。"
---

## 视觉实验

### 让一次请求穿过三个 State 视图

id: "langgraph-02-01-schema"
kind: "state"
placement: "chapter:4"
summary: "逐步展示 ticket_id 从输入进入内部 State、intent 被 node 写入、answer 才进入输出投影，避免把 API 请求误当作完整持久化状态。"
caption: "色块仅表示字段可见性，不表示 Python 在运行时自动校验类型；字段如何注册为 channel 应回到 state.py 与本课断言核验。"
actionLabel: "推进 State 投影"

#### 步骤

- 外部输入 | 输入只含 ticket_id，内部 intent 与 answer 仍不可由调用者注入。
- 内部更新 | 分类 node 返回 intent 的 partial update，原 ticket_id 保留在内部 State。
- 输出投影 | answer 写入后只向调用方暴露指定输出字段，临时依赖不进入 checkpoint。

#### 观察重点

- 预测每步哪些字段可读、哪些字段仍不应由 API 提供。
- 把投影图与完整 state 复制造成的隐式写入区分开。
