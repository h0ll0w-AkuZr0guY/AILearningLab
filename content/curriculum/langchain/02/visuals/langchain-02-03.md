---
lesson: "langchain-02-03"
track: "langchain"
decision: "读完源码主路径后仍难以同时看见 provider 的 ChatResult、第一条 generation 与调用者 AIMessage 之间的投影关系，因此用 flow 展示容器汇合和 metadata 所有权。"
---

## 视觉实验

### 让 ChatResult 汇合成调用者消息

id: "langchain-02-03-chat-result-projection"
kind: "flow"
placement: "chapter:3"
summary: "观察 `_generate` 返回的候选容器如何经过缓存/流式/普通路径汇合，再投影出第一条 message 和响应 metadata。"
caption: "视觉省略真实缓存、callback 和 provider payload，只表达核心容器转换；验证入口是固定 commit 的 `chat_result.py#L10-L39`、`chat_models.py#L1955-L2037`。"
actionLabel: "推进 ChatResult 投影"

#### 步骤

- 规范消息 | `invoke` 已把输入变成 provider 可消费的有序 BaseMessage 列表。
- Provider 生成 | `_generate` 返回一个或多个 ChatGeneration，并可附加自由 `llm_output`。
- 路径汇合 | 普通 `_generate`、收集后的 stream 或 cache hit 都被收束为 ChatResult。
- 元数据合并 | 核心为 generation.message 补 response metadata，并按源码顺序合并可用的 llm_output。
- 公共投影 | `invoke` 读取第一条 generation 的 message，调用者看到 AIMessage 而非原始容器。

#### 观察重点

- 先预测第二个 generation 会不会出现在普通 invoke 返回值中；回到源码检查第一条投影边界。
- 用示例验证自由 metadata 可见但不等于稳定业务 schema，并注入 empty generation 失败。
