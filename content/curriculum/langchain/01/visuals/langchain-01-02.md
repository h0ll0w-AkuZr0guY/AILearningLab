---
lesson: "langchain-01-02"
track: "langchain"
decision: "BaseMessage 的 content、type、additional_kwargs 与 response_metadata 外形相近但生命周期不同，用状态分层能直观看见错误写入如何污染下一轮。"
---

## 视觉实验

### 拆开消息信封的四个责任区

id: "langchain-01-02-message-invariants"
kind: "state"
placement: "chapter:1"
summary: "选择每个阶段，观察模型载荷、序列化身份、provider 私有字段和响应观测数据各自应该流向哪里。"
caption: "只有 content 进入下一轮语义上下文；response_metadata 留在观测侧。把 token usage 写进 content 会造成上下文污染。"
actionLabel: "检查字段生命周期"

#### 步骤

- 构造输入 | type=human 与 content 建立可发送消息，两个 metadata 字典保持独立默认值。
- Provider 适配 | additional_kwargs 只由对应 adapter 解释，不把未知字段拼入正文。
- 收到响应 | response_metadata 与 usage_metadata 记录模型、用量和 headers，content 保存模型语义输出。
- 持久化重放 | 完整结构按 schema version 保存，text 投影只供显示，不能替代原始 blocks。

#### 观察重点

- 预测哪些字段会被重新发送给模型，哪些字段只能进入日志或计费。
- 修改一条消息 metadata，再确认另一条消息不变，以验证 default factory 与输入复制。
