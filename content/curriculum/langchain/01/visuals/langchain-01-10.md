---
lesson: "langchain-01-10"
track: "langchain"
decision: "读完错误分类后，学习者仍难以观察错误来源、重试层级和外部副作用如何共同决定下一步，因此用 state flow 并置 transport、parser、auth 与取消分支。"
---

## 视觉实验

### 推进错误分类与恢复边界

id: "langchain-01-10-error-flow"
kind: "flow"
placement: "chapter:4"
summary: "注入 timeout、解析失败、401 和已写入后的失败，观察哪些路径允许有限恢复，哪些路径必须停止并保留资源证据。"
caption: "蓝色表示当前控制流，红色表示错误类别，绿色只表示解析或幂等验证通过；视觉不承诺网络请求可取消或副作用自动回滚，结论以 exceptions.py、Runnable 包装器和失败注入为准。"
actionLabel: "推进错误恢复"

#### 步骤

- 请求超时 | transport 错误进入有限重试，尝试次数和幂等键同时被记录。
- 输出到达 | malformed JSON 变成 OutputParserException，进入有上限的 repair 分支。
- 权限拒绝 | 401 直接 fail fast，不重复发送同一确定性错误。
- 副作用存在 | 解析前已有写入，流程停止并进入 reconcile/补偿，而不是假设回滚。
- 通过验证 | 只有 schema 解析与幂等资源断言同时通过，结果才进入业务动作。

#### 观察重点

- 单步前预测下一动作由错误类别和副作用状态共同决定，不能只看异常字符串。
- 视觉省略真实 HTTP 状态映射、checkpoint 和后台取消细节，需回到官方连接韧性文档和可运行测试。
