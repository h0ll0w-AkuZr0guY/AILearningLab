---
lesson: "langgraph-02-04"
track: "langgraph"
decision: "append 与 replace 都可能面对 list，文字难以让学习者比较同一组 writes 的状态差异；可切换的状态序列把当前快照、事件历史和并发冲突分开呈现。"
---

## 视觉实验

### 比较同一写入在两种字段合同下的结果

id: "langgraph-02-04-merge-choice"
kind: "state"
placement: "chapter:2"
summary: "用 status 与 audit_events 并列展示单 writer 覆盖、事件追加，以及两个 status writer 触发错误而非随机胜出。"
caption: "视觉只呈现默认 LastValue 与简单追加模型；Overwite 的版本兼容和生产事务边界必须回到正文、源码与测试。"
actionLabel: "推进字段写入"

#### 步骤

- 单一当前值 | answer node 写 approved，status 从 pending 替换为 approved。
- 历史增量 | 两个 event delta 依次进入 audit_events，已有事件仍保留。
- 并发覆盖 | 两个 node 同轮写 status，LastValue 拒绝选择赢家并暴露冲突。

#### 观察重点

- 在查看容器类型前，先判断字段是当前事实还是历史事实。
- 预测为何空列表写入累计字段不必然代表清空。
