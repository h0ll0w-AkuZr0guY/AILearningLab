---
lesson: "langchain-01-05"
track: "langchain"
decision: "RunnableSequence 同时传递业务值和追踪配置，失败又会截断后续控制流；双通道时间线比静态代码更容易看清因果。"
---

## 视觉实验

### 观察一次 invoke 的值流与追踪树

id: "langchain-01-05-invoke-trace"
kind: "flow"
placement: "chapter:3"
summary: "推进 strip、parse、double 三步，业务值在主路径变化，每一步同时产生独立 child run；切到失败步骤时后续节点不启动。"
caption: "实线是业务值，观测文字是 callback 子运行。错误只终止控制流，不回滚此前已经发生的外部副作用。"
actionLabel: "推进 Runnable 序列"

#### 步骤

- 建立根运行 | ensure_config 归一化配置，root run 记录原始输入与序列名称。
- 执行第一步 | strip 得到字符串 21，并创建 seq:step:1 子追踪；额外 kwargs 只在这里进入。
- 执行第二步 | parse 把字符串变成整数，seq:step:2 继承 tags 与 metadata。
- 完成第三步 | double 输出 42，子运行结束后根运行才触发 on_chain_end。
- 注入解析错误 | parse 抛 ValueError，根运行记录 on_chain_error，double 从未启动。

#### 观察重点

- 分别记录每一步的业务值类型与 child run 名称，避免把 config 看成业务输入。
- 在失败场景中检查已完成步骤的副作用是否仍存在，并据此决定局部重试或幂等键。
