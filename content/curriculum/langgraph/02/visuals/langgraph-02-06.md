---
lesson: "langgraph-02-06"
track: "langgraph"
decision: "文字可以说明同 ID 替换，却很难同时看见列表位置保持、内容变化与未知删除失败；状态实验把这三项读数并置。"
---

## 视觉实验

### 推进一段可修订的对话

id: "langgraph-02-06-message-identity"
kind: "state"
placement: "chapter:2"
summary: "以 u1 与 a1 的 ID、位置和内容作为读数，观察新增、同 ID 修订与未知删除的不同结果。"
caption: "列表与 ID 是可验证的教学状态；真实消息反序列化与 RemoveMessage 行为应回到 message.py 和本课断言复核。"
actionLabel: "推进消息合并"

#### 步骤

- 初始对话 | u1 与 a1 各占一个位置，a1 的内容为运输中。
- 同 ID 修订 | 新 a1 替换原位置内容为已签收，u1 与列表长度保持不变。
- 未知删除 | 请求删除 ghost，流程显示失败而不静默改变历史。

#### 观察重点

- 推进前预测修订 a1 是否会在列表末尾再出现一条消息。
- 用可运行示例区分删除已有 ID 与删除未知 ID 的断言。
