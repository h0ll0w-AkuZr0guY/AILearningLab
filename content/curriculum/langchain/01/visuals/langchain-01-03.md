---
lesson: "langchain-01-03"
track: "langchain"
decision: "三种公开输入在不同路径上收敛为 PromptValue，再经 generate_prompt 返回 AIMessage；流程和分支同时存在，适合用双阶段图展示。"
---

## 视觉实验

### 从三种入口收敛到一个生成主路径

id: "langchain-01-03-normalization"
kind: "graph"
placement: "chapter:3"
summary: "依次激活字符串、Message 序列与 PromptValue 三条支路，观察它们如何在 provider 请求前收敛，同时保留不同角色语义。"
caption: "收敛发生在内部 PromptValue 层；目标 provider 的 wire payload 仍由各自 adapter 决定。非法整数在图的入口侧终止。"
actionLabel: "切换输入支路"

#### 步骤

- 字符串入口 | 字符串先被识别，形成 StringPromptValue，避免被 Sequence 分支逐字符拆开。
- 消息序列 | 二元组与 Message 经 convert_to_messages 保留顺序和 role，形成 ChatPromptValue。
- 已渲染模板 | PromptValue 原样通过，不重复绑定变量或重新解释用户花括号。
- 单次生成 | 长度为一的 prompt 列表进入 generate_prompt，invoke 取 generations[0][0].message。
- 非法输入 | 整数在本地抛 ValueError，provider 调用计数保持不变。

#### 观察重点

- 注意字符串判断为何必须位于 Sequence 之前。
- 把图中每条边与 `_convert_input` 的一个真实分支对应，再用 FakeChatModel 验证没有网络副作用。
