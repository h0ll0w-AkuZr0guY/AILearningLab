---
id: "langchain-01-04"
track: "langchain"
title: "Prompt 变量绑定"
depth: "deep"
visualIndex: "../visuals/langchain-01-04.md"
exampleLanguage: "python"
readingMinutes: 25
sourceMinutes: 8
practiceMinutes: 10
reviewMinutes: 2
---

## 官方入口

title: "LangChain Prompt templates · ChatPromptTemplate"
url: "https://reference.langchain.com/python/langchain-core/prompts/chat/ChatPromptTemplate"

官方参考把 ChatPromptTemplate 定义为生成消息序列的模板，并明确 `invoke` 的结果是 `ChatPromptValue`。变量绑定负责生成消息内容和插入历史消息，不负责转义任意目标语言，也不自动保证提示词免受注入。

## 真实源码

repo: "langchain-ai/langchain"
file: "libs/core/langchain_core/prompts/chat.py"
symbol: "ChatPromptTemplate.format_messages"
language: "python"
url: "https://github.com/langchain-ai/langchain/blob/725489f135458c37c668919b0d08652ebd04f131/libs/core/langchain_core/prompts/chat.py#L1233-L1264"

### 逐段讲解

- `_merge_partial_and_user_variables` 先把预绑定变量与当前调用变量合并，用户缺失值在渲染前暴露。
- 固定的 `BaseMessage` 直接追加，不对其中花括号做二次格式化。
- MessagePromptTemplate 与嵌套 ChatPromptTemplate 递归执行 `format_messages`，一次模板项可以展开成多条消息。
- 未知模板节点抛 `ValueError`，避免把任意对象静默转成字符串。

### 源码节选

```python
def format_messages(self, **kwargs: Any) -> list[BaseMessage]:
    # partial 变量先与本次变量形成同一个显式环境。
    kwargs = self._merge_partial_and_user_variables(**kwargs)
    result = []
    for message_template in self.messages:
        if isinstance(message_template, BaseMessage):
            # 已经是消息的节点保持原样，花括号不会再次展开。
            result.extend([message_template])
        elif isinstance(
            message_template,
            (BaseMessagePromptTemplate, BaseChatPromptTemplate),
        ):
            message = message_template.format_messages(**kwargs)
            # placeholder 或嵌套模板可能一次产生多条消息。
            result.extend(message)
        else:
            raise ValueError(f"Unexpected input: {message_template}")
    return result
```

## 导读

模板最危险的误解是“把字符串里的 `{name}` 替换掉”。真实 Prompt 模板同时处理变量环境、消息角色、历史占位符和可组合节点。若只用 `str.replace`，用户输入中的花括号可能被二次解释，历史消息会被压成文本，缺失变量要到模型收到畸形请求后才暴露。

可以把模板想成一个小型编译器。模板定义是语法树，变量字典是环境，`format_messages` 是求值器，输出是带 role 的消息列表。求值器只在模板节点上解释占位符，用户数据进入叶子后不再被当作模板重新执行。这条“代码与数据分离”原则同时决定正确性与安全性。

本课聚焦一次绑定。动态示例选择、模板版本管理和长上下文裁剪属于更高层策略。学完后应能手写一个不会二次展开、能插入消息历史、能报告缺失变量的最小 ChatPromptTemplate。

## 分章正文

### 替换字符串为何不等于绑定变量

kicker: "01 · OBSERVE"

假设模板是 `"请总结 {text}"`，用户正文是 `"报告中出现 {secret}"`。正确结果应保留用户的花括号：`"请总结 报告中出现 {secret}"`。若实现先替换 text，再对结果再次 format，`{secret}` 会被误当成第二阶段变量；轻则抛错，重则读取不该暴露的环境值。

消息角色同样无法靠拼接恢复。`("system", "规则：{policy}")` 与 `("human", "{question}")` 必须渲染成两条 Message。把它们连成一条字符串，会让 provider 只看到一个 role。模板输出的第一验收项应是消息类型和顺序，文本快照只是第二验收项。

因此绑定具有一次性：模板语法被解释一次，变量值作为数据注入，不进入新的模板求值。若确实需要多阶段模板，必须显式定义两个模板对象、两套变量白名单和中间结果审计，不能依赖偶然的重复 format。

#### 本章结论

变量绑定是模板节点对数据环境的一次求值；绑定后的用户数据不能自动升级为新的模板代码。

### required、partial 与 optional 三类变量

kicker: "02 · MODEL"

required 变量必须由本次调用提供，缺失时应立即列出变量名。partial 变量在模板构造或派生时预先绑定，例如产品名、固定语言或时间提供器；调用者无需重复传递，但最终求值环境仍应可观察。optional 常用于 `MessagesPlaceholder(optional=True)`，缺失时展开为空消息列表，而非字符串 `"None"`。

三者可以用集合描述：`required = input_variables - partial_variables - optional_variables`。调用前验证 required 子集存在，调用后验证所有 placeholder 都已消费。多余变量如何处理要显式选择：严格服务可拒绝未知键，探索式 Notebook 可允许它们但记录告警。

partial 并不等于安全常量。若它绑定的是可调用对象，如当前时间，每次格式化可能得到不同值；若它来自租户配置，还需防止跨租户复用缓存模板。测试应区分构造时值和调用时值，并给动态 partial 注入可控时钟。

#### 本章结论

变量类别描述“由谁、何时提供”；它们共同组成一次求值环境，不能用默认空字符串掩盖缺失。

### format_messages 的递归展开

kicker: "03 · SOURCE"

ChatPromptTemplate 的 `messages` 并非只有字符串模板。固定 BaseMessage 直接进入结果；MessagePromptTemplate 产生一条消息；MessagesPlaceholder 可展开历史列表；嵌套 ChatPromptTemplate 还能展开一个子序列。源码使用 `extend` 而非 `append`，正是因为一个节点可能产生多条消息。

固定 BaseMessage 不再格式化是重要边界。若固定消息内容包含 `{version}`，它仍是普通字符；想绑定变量必须创建对应 PromptTemplate。这样模板语法只存在于声明为模板的节点，不会扫描所有消息。未知节点抛错也比 `str(node)` 更安全，因为字符串化可能把对象地址、密钥或调试表示送给模型。

历史 placeholder 还要校验输入是消息列表。把数据库 JSON 字符串直接作为 history 会破坏 role。可靠适配器先反序列化、验证 type 和 tool_call_id，再交给 placeholder；模板只负责排列，不承担数据库迁移。

#### 本章结论

消息模板是一棵可展开树；节点类型决定是否求值以及展开为几条消息。

### 注入、转义与上下文边界

kicker: "04 · FAILURE"

模板变量绑定可以防止意外二次展开，却不能让模型忽略恶意文本。用户写“忽略系统规则”仍会作为 human 内容到达模型。Prompt injection 是模型解释优先级与外部数据可信度问题，需要角色隔离、工具权限、数据标记和输出验证；`format` 转义只能解决字符串语法问题。

另一个边界是模板格式。f-string、mustache 与 jinja2 的语法和安全面不同。不要让不可信用户上传可执行模板；即使框架提供受限环境，也应把模板编辑视为代码发布，经过审核、版本化与测试。普通用户只能填变量，不应选择过滤器或表达式。

长历史也不会由绑定自动裁剪。MessagesPlaceholder 展开一千条消息，模型可能因上下文超限失败。裁剪属于调用前策略，应基于 token、角色成对关系和 tool call 完整性，不能简单取最后 N 个字典后留下孤立 ToolMessage。

#### 本章结论

绑定解决语法与结构，权限、注入防护和上下文预算仍需独立的产品边界。

### 模板作为可测试构件

kicker: "05 · ENGINEERING"

高价值测试不调用模型。给定变量后断言：消息条数、角色顺序、关键文本、历史插入位置、缺失变量异常和用户花括号保真。若模板决定工具使用，还应快照系统消息中的工具政策，但避免对全部文案做脆弱快照。

生产模板应有稳定 id、版本、变量 schema 和变更说明。日志记录模板版本与变量长度，不记录敏感原文。灰度发布时同一业务请求只选择一个模板版本，避免重试过程中版本漂移。缓存键应包含模板版本、规范化变量与模型配置；只按用户问题缓存会把不同 system policy 混为一谈。

变体一是严格 dataclass/Pydantic 输入，适合稳定服务，缺点是改变量要升级 schema。变体二是字典加运行时校验，适合实验，缺点是错误更晚。二者都应把模板定义与用户数据分开存储，并在模型调用前允许打印脱敏的消息结构。

#### 本章结论

Prompt 的质量首先是可重复的消息结构，其次才是自然语言措辞；结构可在零模型成本下完整测试。

## 核心机制

- partial 与本次变量先合并成显式环境，再递归求值消息节点。
- 固定 Message 保持原样，模板节点才解释占位符。
- 一个节点可展开多条消息，因此顺序和 role 是一等测试对象。
- 绑定不自动解决 prompt injection、上下文裁剪和模板发布权限。

## 常见误区

- 对绑定后的结果再次 `.format`，把用户花括号误当模板代码。
- 用空字符串填补 required 变量，让错误以低质量回答的形式延迟出现。
- 认为 MessagesPlaceholder 会自动修复数据库里的坏消息或裁剪 token。

## 实现变体

### 变体 A：类型化输入模板

useWhen: "面向生产的固定任务，如客服分类、结构化抽取与审计报告。"
tradeoff: "变量契约和 IDE 支持强；文案结构变化需要同步升级类型。"

### 变体 B：字典环境加严格运行时校验

useWhen: "研究、A/B 实验或模板变化频繁的内部平台。"
tradeoff: "调整快；需要额外的未知键、缺失键和模板版本监控。"

## 可运行示例

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class MessageTemplate:
    role: str
    text: str

class MiniChatPrompt:
    def __init__(self, nodes, partial=None):
        self.nodes = nodes
        self.partial = dict(partial or {})

    def format_messages(self, **values):
        env = self.partial | values
        result = []
        for node in self.nodes:
            if isinstance(node, tuple) and node[0] == "history":
                history = env.get(node[1], [])
                if not isinstance(history, list):
                    raise ValueError("history 必须是消息列表")
                result.extend(history)
            else:
                missing = [name for name in fields(node.text) if name not in env]
                if missing:
                    raise KeyError(f"缺失变量: {missing}")
                result.append({"role": node.role, "content": node.text.format_map(env)})
        return result

def fields(template):
    import string
    return [name for _, name, _, _ in string.Formatter().parse(template) if name]

prompt = MiniChatPrompt([
    MessageTemplate("system", "你是 {product} 的审阅员"),
    ("history", "history"),
    MessageTemplate("human", "审阅：{text}"),
], partial={"product": "AILearningLab"})

messages = prompt.format_messages(
    history=[{"role": "ai", "content": "请提供文本"}],
    text="保留用户输入里的 {unknown}",
)
assert [m["role"] for m in messages] == ["system", "ai", "human"]
assert messages[-1]["content"].endswith("{unknown}")  # 没有二次展开
```

## 搭积木复现

### 积木 1：声明消息模板节点

节点同时保存 role 与模板文本，测试输出顺序而不只测试拼接字符串。

### 积木 2：提取并校验 required 变量

格式化之前收集字段名，缺失时一次列全，拒绝默认空字符串。

### 积木 3：加入 partial 环境

先合并 partial 与调用值，明确冲突时调用值是否允许覆盖，并为该规则写断言。

### 积木 4：实现 history placeholder

只接受消息列表，原样展开到固定位置；用错误字符串证明校验有效。

### 积木 5：验证代码与数据分离

让用户值含 `{unknown}`，断言绑定后原样保留，确保没有第二次模板求值。

## 自检

### 问题

为什么 `MessagesPlaceholder("history")` 不能替换成 `("human", "{history}")`？如何证明两者在多轮工具对话中产生不同协议？

### 站内答案

结论是 placeholder 展开结构化消息序列，字符串变量只把 history 的显示表示塞进一条 human 消息。机制证据在 `format_messages` 的递归 `extend`：子模板可产生多条 BaseMessage，角色与 tool_call_id 均保留。测试构造 AIMessage(tool call) 和对应 ToolMessage 两条历史；placeholder 输出应保持 ai、tool 两个 role 和关联 id，而字符串版本只剩一个 human 文本。工程上，多轮和工具历史必须结构化插入；仅把一段不可执行的聊天摘录作为用户资料时，才适合放入普通文本变量，并明确标注其数据边界。
