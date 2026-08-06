---
lesson: "typescript-12-06"
track: "typescript"
decision: "学习者读完正文后仍难以在脑中同时追踪源文本、AST、Symbol、Type 与 Diagnostic 如何沿阶段转换，因此用静止默认 flow 把每一步的输入、输出和失败门槛并排呈现；精确结论仍回到源码行区间和示例断言。"
---

## 视觉实验

### 让一段源码穿过 mini-checker 管线

id: "typescript-12-06-main"
kind: "flow"
placement: "chapter:3"
summary: "把 parse、bind、check、report 的离散产物放在同一条可单步回看的路径上，帮助学习者看见每个阶段新增了什么证据以及失败会在哪个门槛停下。"
caption: "节点表示阶段产物，箭头表示数据交接；图中 grammar 和 Type 覆盖范围是教学缩减，必须用 v5.9.3 源码与可运行示例验证真实边界。"
actionLabel: "推进 checker 阶段"

#### 步骤

- 输入源码 | input.ts 保存 type alias、变量声明和表达式，所有后续 span 都从这份文本计算。
- 解析节点 | parse 产出带 start/length 的 SourceFile/statement 节点；语法失败停在 parse，不生成 semantic 结论。
- 绑定身份 | bind 把 User、user 等声明放入 type/value Symbol 表；重复声明在这一阶段产生 bind diagnostic。
- 检查关系 | check 沿 Symbol 找到 Type，比较注解与表达式；类型不匹配或属性不存在成为 semantic diagnostic。
- 报告结果 | report 按 stage 聚合并格式化 Diagnostic；有 span 显示文件位置，无位置错误显示 <config>，不丢失失败原因。

#### 观察重点

- 每次推进前预测新增的是节点、Symbol、Type 关系还是 Diagnostic；阶段完成但诊断为空不等于前一阶段没有运行。
- 用示例的缺分号、重复声明、类型不匹配和 detached diagnostic 对照图中的门槛；mini flow 省略了 host、默认库、模块解析和增量缓存。
