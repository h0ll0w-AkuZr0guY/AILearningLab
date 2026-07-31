---
lesson: "langchain-01-01"
track: "langchain"
decision: "角色、原生 content 与标准 content_blocks 同时存在，单靠文字难以追踪一次消息从调用协议到显示投影的信息保留与损失。"
---

## 视觉实验

### 让多模态消息穿过三层解释器

id: "langchain-01-01-message-envelope"
kind: "flow"
placement: "chapter:3"
summary: "逐步观察同一条用户消息从角色信封、provider 原生块到标准块投影；未知块保留为 non_standard，而不是静默消失。"
caption: "蓝色路径表示可发送载荷，紫色路径表示跨 provider 的标准观察面。最终 UI 文本只是投影，不能拿它重建原消息。"
actionLabel: "推进消息转换"

#### 步骤

- 原始信封 | HumanMessage 保存 role=user、图片原生块、文本块和 provider 元数据。
- 标准化块 | text 与 image 被识别，未知 citation_v2 被包进 non_standard 并保留原字典。
- 显示投影 | UI 只取可展示文本与图片摘要，tool 或 reasoning 数据仍留在完整消息中。
- 跨模型发送 | 目标 adapter 检查支持的块，拒绝无法安全映射的原生字段而非伪装成文本。

#### 观察重点

- 推进前先预测 role、块数量和 UI 文本中哪一项必须保持，哪一项允许减少。
- 对照 `BaseMessage.content_blocks` 与示例中的未知块断言，验证 non_standard 是保真失败策略。
