---
lesson: "langgraph-02-09"
track: "langgraph"
decision: "文字无法同时呈现 v1 checkpoint、纯转换、v2 新快照和无法映射值的停机点，因此使用版本流程图。"
---

## 视觉实验

### 把 v1 checkpoint 迁移到 v2

id: "langgraph-02-09-schema-drain"
kind: "flow"
placement: "chapter:2"
summary: "展示旧字段 customer_name/status 如何生成新 customer/payment，以及未知状态为何必须转入人工复核。"
caption: "字段转换是可运行教学数据；生产中的存储扫描、节点兼容和保留期仍应以兼容文档与迁移演练为准。"
actionLabel: "推进 schema 迁移"

#### 步骤

- 旧版本快照 | v1 持有 customer_name 与 paid 状态，仍可能在 interrupt 后恢复。
- 纯结构转换 | 迁移函数复制输入并生成 customer/payment 与 schema_version=2。
- 无法映射停止 | maybe 不被猜测为业务结论，而是产生可复核失败。

#### 观察重点

- 预测迁移后 v1 输入中的 customer_name 是否会被原地删除。
- 对照示例的异常分支，说明何时能安全删除旧字段。
