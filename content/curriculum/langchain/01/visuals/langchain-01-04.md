---
lesson: "langchain-01-04"
track: "langchain"
decision: "模板绑定包含变量环境合并、节点递归展开与用户数据不二次求值，交互式切换能直接暴露 str.replace 的错误心智模型。"
---

## 视觉实验

### 切换模板节点，看一次绑定如何发生

id: "langchain-01-04-binding-playground"
kind: "playground"
placement: "chapter:3"
summary: "在 required、partial、history placeholder 与带花括号的用户输入之间切换，观察输出消息的角色、数量和文本。"
caption: "模板节点才解释占位符；用户值进入叶子后保持数据身份。history 展开多条 Message，而不是压成一条 human 字符串。"
actionLabel: "切换绑定场景"

#### 步骤

- 缺失 required | question 未提供时，渲染在模型调用前列出缺失变量，输出消息数为零。
- 合并 partial | product 由预绑定环境提供，当前调用只补 question，system 与 human 各生成一条。
- 展开 history | placeholder 把 ai 与 tool 两条历史插入固定位置，并保留 tool_call_id。
- 保留花括号 | 用户输入含 {secret} 时只替换外层 {question}，内层字符不再次执行。
- 拒绝坏历史 | history 是 JSON 字符串而非消息列表时立即失败，不用 str(history) 掩盖协议错误。

#### 观察重点

- 比较 history placeholder 与普通 `{history}` 文本变量的消息数量和角色差异。
- 每次切换后回到可运行示例，核对角色数组和 `{unknown}` 保真断言。
