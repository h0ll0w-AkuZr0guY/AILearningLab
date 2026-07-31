---
lesson: "langgraph-01-09"
track: "langgraph"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 展开「拓扑验证与迁移：孤立节点、循环和 interrupt 兼容」的节点与依赖

id: "langgraph-01-09-main"
kind: "graph"
placement: "chapter:2"
summary: "编译通过回答的是“这张新图在自身定义中是否自洽”。线上迁移还要回答“昨天保存的执行地址和数据，今天的代码是否仍能解释”。两者像编译一个新版数据库客户端与读取旧表：类型检查成功，并不代表列重命名、枚举收紧和存量数据都安全。"
caption: "节点和连线表示依赖关系与当前可观察阶段；真实图中的条件边、并行合并、失败与重放必须回到源码逐项核对。"
actionLabel: "推进节点状态"

#### 步骤

- validate 收集静态 sour | validate 收集静态 sources/targets，检查未知节点和 START 入口。
- 条件分支的 Literal、path | 条件分支的 Literal、path_map 与 ends 提高可静态验证范围。
- 编译时 interrupt 节点必须 | 编译时 interrupt 节点必须存在，但历史 interrupt 合同不在检查范围。
- 最新部署图会解释现有线程，运行不会自 | 最新部署图会解释现有线程，运行不会自动钉住旧代码版本。
- interrupted thread | interrupted thread 的 next/task node name 是持久执行地址。

#### 观察重点

- compile 成功就宣布历史线程兼容。
- 直接重命名被 interrupt 或 next 引用的节点。
