---
lesson: "langgraph-02-08"
track: "langgraph"
decision: "文字很难显露 shallow copy 的嵌套别名，因此用状态图同时显示共享列表污染与返回 update 后的独立状态。"
---

## 视觉实验

### 比较共享列表与 partial update

id: "langgraph-02-08-alias-boundary"
kind: "state"
placement: "chapter:1"
summary: "用旧 state、node 输入和新 update 三个对象展示浅复制污染为何绕开逻辑快照，以及正确写法的隔离边界。"
caption: "对象引用与事件 ID 是教学读数；真实 super-step 隔离仍应回到 runtime 文档和本课 Python 反例验证。"
actionLabel: "推进别名对比"

#### 步骤

- 共享嵌套列表 | state 与 shallow copy 指向同一个 events 列表。
- 原地追加污染 | node 输入 append 后，旧 state 也出现 e1，读取方提前看见写入。
- 返回独立更新 | node 返回新 event，由 reducer 生成 after，clean state 保持 e0。

#### 观察重点

- 预测只复制最外层 dict 是否会隔离 events。
- 用示例的 clean 断言核对更新前 state 是否真正未变。
