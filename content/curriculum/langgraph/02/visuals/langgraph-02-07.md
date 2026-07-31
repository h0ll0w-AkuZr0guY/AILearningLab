---
lesson: "langgraph-02-07"
track: "langgraph"
decision: "文字难以同时呈现旧 checkpoint 保留、新 checkpoint 分叉和 as_node 改变的下一步，因此用状态流程把版本与 next 绑定展示。"
---

## 视觉实验

### 让人工批准从 checkpoint 分叉

id: "langgraph-02-07-checkpoint-branch"
kind: "flow"
placement: "chapter:2"
summary: "显示 c1 的暂停状态、review 身份的人工 update 与 c2 的 ship 下一步，避免把 update 理解成原地覆盖。"
caption: "checkpoint ID、approved 与 next 是可验证教学读数；真实持久化与调度应回到 Persistence 文档和本课断言。"
actionLabel: "推进状态迁移"

#### 步骤

- 暂停快照 | c1 保存 approved=false 与 next=review，历史尚可读取。
- 人工写入 | update 经 reducer 写入 approved=true，并声明 as_node=review。
- 新版本继续 | c2 指向 c1，旧值保留，next 变为 ship。

#### 观察重点

- 预测 c1 的 approved 在创建 c2 后会不会随之改变。
- 对照示例中的 expected checkpoint 检查，找出并发编辑失败的位置。
