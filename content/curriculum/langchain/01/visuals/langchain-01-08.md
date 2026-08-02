---
lesson: "langchain-01-08"
track: "langchain"
decision: "读完 callback 章节后，学习者仍难以在并发与嵌套中追踪 start、end、error 与 parent id 的因果顺序，因此用静止可单步 flow 展示事件树。"
---

## 视觉实验

### 观察一次 Runnable 的 callback 生命周期

id: "langchain-01-08-callback-flow"
kind: "flow"
placement: "chapter:3"
summary: "推进 root、parse 和 double 的 start/end/error 事件，观察父子 run id 如何保持因果，以及失败后哪些节点不会启动。"
caption: "主线值流与事件旁路同时显示；on_chain_error 只证明控制流失败，不表示数据库或其他外部副作用已经回滚，结论需回到 _call_with_config 和 fake store 断言。"
actionLabel: "推进 callback 生命周期"

#### 步骤

- 根开始 | callback manager 为 root 发出 start，建立当前 run id。
- 子开始 | parse 使用 child manager 发出 start，parent id 指回 root。
- 子成功 | parse 发出 end，业务值继续流向 double，事件树保持嵌套。
- 注入失败 | parse 发出 error，异常继续抛出，double 不会产生 start。
- 根结束 | 只有全链成功才发出 root end；失败路径保留 error 作为终态。

#### 观察重点

- 单步前预测终态和 parent id，不能用时间先后替代身份关系。
- 视觉不展示异步队列丢失、handler 自身异常和外部事务，这些必须用对应测试验证。
