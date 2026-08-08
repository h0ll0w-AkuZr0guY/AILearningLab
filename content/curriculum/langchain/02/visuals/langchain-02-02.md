---
lesson: "langchain-02-02"
track: "langchain"
decision: "文字解释了多种输入表示，但仍难以同步观察它们何时变成 PromptValue 与 BaseMessage 列表，因此用 flow 把归一化和失败边界固定成五步。"
---

## 视觉实验

### 让多形输入进入统一消息通道

id: "langchain-02-02-input-normalization"
kind: "flow"
placement: "chapter:3"
summary: "把字符串、PromptValue、消息 tuple 和字典逐步归一化为 provider 可消费的规范消息，并把字段错误放在网络请求前。"
caption: "图中不表示 provider 是否接受某种 multimodal content；它只表达 `BaseChatModel._convert_input` 与 `convert_to_messages` 的形状转换，验证入口是固定 commit 的 `chat_models.py#L449-L487` 与 `messages/utils.py#L706-L803`。"
actionLabel: "推进输入归一化"

#### 步骤

- 原始输入 | 输入可以是裸字符串、PromptValue 或消息表示序列。
- 类型分派 | `_convert_input` 选择 StringPromptValue、复用 PromptValue 或进入消息转换分支。
- 单项转换 | tuple、dict、BaseMessage 和字符串 shorthand 被转成 BaseMessage。
- 结构校验 | 缺少 role/type 或 content 的字典在 provider 调用前失败。
- 统一交付 | ChatPromptValue 带着有序 BaseMessage 列表进入 `generate_prompt`。

#### 观察重点

- 推进前预测：哪一种输入会进入 `convert_to_messages`，哪一种会被直接复用。
- 用示例的非法整数、短 tuple 和缺 role 字典验证失败位置，而不是等待真实 API 报错。
