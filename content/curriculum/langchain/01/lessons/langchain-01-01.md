---
id: "langchain-01-01"
track: "langchain"
title: "消息角色与 content blocks"
depth: "deep"
visualIndex: "../visuals/langchain-01-01.md"
exampleLanguage: "python"
readingMinutes: 25
sourceMinutes: 8
practiceMinutes: 10
reviewMinutes: 2
---

## 官方入口

title: "LangChain Messages · Message content"
url: "https://docs.langchain.com/oss/python/langchain/messages#message-content"

该章节规定 chat model 接收的是消息序列，`content` 可以是字符串、provider-native block 列表或标准 content blocks；标准块是跨 provider 的读取表示，并不承诺任意 provider 都能发送任意块。

## 真实源码

repo: "langchain-ai/langchain"
file: "libs/core/langchain_core/messages/base.py"
symbol: "BaseMessage.content_blocks"
language: "python"
url: "https://github.com/langchain-ai/langchain/blob/01d8481ae3d457ec3751cbb0331ea3a4b720fa90/libs/core/langchain_core/messages/base.py#L93-L203"

### 逐段讲解

- `content` 保留宽松的 wire payload，先让各 provider 的旧格式能进入系统。
- `type` 是可序列化的消息身份，不可用 Python 类名替代。
- `content_blocks` 将字符串提升为 text block，未知字典先放进 `non_standard`。
- 多个 translator 再按 provider 元数据解释旧格式；解释失败时保留原值，避免悄悄丢掉模型输出。

### 源码节选

```python
class BaseMessage(Serializable):
    content: str | list[str | dict[Any, Any]]
    additional_kwargs: dict[Any, Any] = Field(default_factory=dict)
    response_metadata: dict[Any, Any] = Field(default_factory=dict)
    type: str
    name: str | None = None
    id: str | None = Field(default=None, coerce_numbers_to_str=True)

    @property
    def content_blocks(self) -> list[types.ContentBlock]:
        # 字符串是历史兼容的 text block；空字符串不伪造一个块。
        content = [self.content] if isinstance(self.content, str) and self.content else self.content
        blocks: list[types.ContentBlock] = []
        for item in content:
            if isinstance(item, str):
                blocks.append({"type": "text", "text": item})
            elif isinstance(item, dict) and item.get("type") in types.KNOWN_BLOCK_TYPES:
                blocks.append(cast("types.ContentBlock", item))
            elif isinstance(item, dict):
                blocks.append({"type": "non_standard", "value": item})
        for parsing_step in [
            _convert_v0_multimodal_input_to_v1,
            _convert_to_v1_from_chat_completions_input,
            _convert_to_v1_from_anthropic_input,
        ]:
            blocks = parsing_step(blocks)
        return blocks
```

## 导读

把对话存成 `list[str]` 很快会失真。一个用户上传图片、模型给出带引用的回答、工具返回一段 JSON 时，文本表面仍可拼接，谁说了什么、哪一段可送给模型、哪一段只供应用渲染却已经丢失。消息对象像网络协议中的信封：内容是货物，角色、标识和元数据决定货物应被谁、以什么规则解释。

本课把“角色”和“内容形状”合在一节，因为它们共同决定请求能否安全跨越 provider。下一课专讲 BaseMessage 的不变量；这里先建立最小可观察合同：角色不是文案，content block 也不是任意 JSON。

## 分章正文

### 字符串为什么不够

kicker: "01 · OBSERVE"

`"系统：...\n用户：看这张图"` 让模型看起来理解角色，其实应用只是在模拟一种 provider 的序列化。工具结果、assistant 的 tool call 与用户文本被压成同一种字符后，重放、审计和调用关联都需要脆弱的正则恢复。真正的边界在结构化序列，而非提示词里出现了几个前缀。

#### 本章结论

消息是带语义标签的事件；拼接字符串只能保存显示，不足以保存协议。

### 角色是路由约束

kicker: "02 · MODEL"

常见角色为 system、user、assistant、tool。system 放置高优先级指令，user 表示外部意图，assistant 承载生成与 tool call，tool 必须用 `tool_call_id` 回指请求。角色的含义由具体模型 API 决定，框架不能把未知 `operator` 擅自映射为 user。那样虽能调用，却把权限边界变成了隐式猜测。

同一段文字换角色会改变行为。例如“删除数据库”作为 user 是请求，作为 tool result 可能是执行回执，作为 system 则可能成为系统约束。测试应断言 role，而非只断言最终文本。

#### 本章结论

角色是可验证的调用语义，不能靠内容开头的自然语言推断。

### block 是有类型的载荷

kicker: "03 · SOURCE"

纯文本可写成字符串；图像、音频、文件、reasoning、citation 和 tool call 则需要 block。LangChain 允许 provider-native 字典进入 `content`，随后以 `content_blocks` 给学习者标准视图。标准视图方便跨模型处理，但发送前仍应查看目标 provider 的能力与大小限制。

最重要的反例是把图片 URL 塞进文本：模型可能把它当字符而非图片。另一个反例是把 provider 私有 reasoning 当普通 text 转发，可能泄露不该展示的字段。渲染层应按 block type 白名单处理，而不是把任意字典直接插入 HTML。

#### 本章结论

block 的 `type` 决定解释器；相同 JSON 外形并不保证相同模态语义。

### 兼容转换为何保守

kicker: "04 · FAILURE"

源码先把未知块标为 `non_standard`，再运行转换器。这是一条重要的失败策略：宁可让调用者看到不能标准化的值，也不要把未知字段删掉后声称得到标准消息。转换器依赖 `response_metadata` 等上下文，因此脱离来源复制 content 后，后续解析可能不同。

应用需要区分三件事：可发送、可标准读取、可安全展示。某 provider-native PDF block 可能可发送却不能被另一个 provider 消费；某 reasoning block 可以读取却不适合日志；某 tool result 可展示摘要却不应重新交给模型。每一步都要写显式适配器。

#### 本章结论

标准化是有条件的信息变换，未知值应保真而非静默降级。

### 生产中的最小边界

kicker: "05 · ENGINEERING"

小项目可直接构造 `HumanMessage`；多 provider 产品应在入口校验允许角色、block schema、URL 来源、文件体积和 tool call 关联，再由单个 adapter 负责 provider 映射。持久化时保存原始 message、版本和脱敏后的展示副本，避免以后无法重放。

变体一是只允许文本，接口小而可靠，代价是丢掉多模态能力。变体二是保留原生块并延迟转换，兼容性好，代价是每个消费者都必须面对未知值。变体三是只存标准块，查询方便，但升级 translator 时需做迁移和回归测试。

#### 本章结论

协议边界越靠近输入处越便宜；把格式兼容散落在业务节点会放大安全和维护成本。

### 用可观察证据验证消息没有失真

kicker: "06 · VERIFY"

消息层的测试不能只问“模型最后有没有回答”。模型可能在角色丢失后仍猜出正确答案，也可能在图片被当成 URL 文本后凭文件名猜中内容。更可靠的证据来自发送前后的结构快照。发送前记录消息数量、角色序列、每条消息的 block type、tool_call_id 是否成对以及脱敏后的长度；adapter 转换后记录目标 provider 的角色和模态种类；返回后检查原生块、标准块与显示投影之间的包含关系。

例如构造一条 HumanMessage，其中依次包含 text、image 和未知 `citation_v2`。第一条断言验证 `content_blocks` 中仍有三个信息单元，未知块以 `non_standard` 保留；第二条断言验证 UI 投影不会把未知字典当 HTML；第三条断言让不支持 citation 的目标 adapter 明确失败。这样能够区分“信息仍在但当前不能发送”和“信息在框架里已经丢失”。前者可以通过增加适配器解决，后者往往无法恢复。

工具对话还需要一条图不变量：每个 ToolMessage 的 `tool_call_id` 必须能指向此前某个 AIMessage.tool_calls，且同一结果不能被不同调用重复认领。检查时按消息顺序维护待完成调用集合，遇到 AI tool call 就加入，遇到 ToolMessage 就消费；最终剩余集合表示尚未返回的工具，找不到 id 则是孤立结果。这个小状态机比搜索文本中的 `call_` 稳定，因为 id 是协议字段，工具输出正文可能恰好包含类似字符。

日志也有信息边界。生产环境通常不应记录完整用户文本、图片 URL 签名或工具结果。可以记录 `roles=["system","human","ai","tool"]`、`block_types=["text","image"]`、字节长度、脱敏 trace id 和 schema version。故障排查需要原文时，使用受权限控制、带保留期限的审计存储，而非把内容复制到普通 metrics。可观察性越强不代表收集越多，关键是记录能证明合同的最小证据。

#### 本章结论

消息正确性的证据是角色、块类型和调用关联在转换前后保持；模型碰巧答对不能替代协议级断言。

## 核心机制

- 消息序列保存轮次、角色与 payload 的边界。
- `content` 接受历史与原生表示，`content_blocks` 提供标准观察面。
- 未知 block 保持 `non_standard`，避免信息损失。
- tool result 通过调用标识与 assistant 的请求关联。

## 常见误区

- 用字符串前缀代替 role，重放时无法可靠恢复权限语义。
- 认为标准 block 自动意味着目标模型支持该模态。
- 把任意 provider-native JSON 原样渲染，形成注入或隐私泄露。

## 实现变体

### 变体 A：只接受文本消息

useWhen: "客服、分类等明确没有多模态和工具的流程。"
tradeoff: "输入验证极简单；迁移到图像、文件或工具时需要改变接口。"

### 变体 B：保存原生块加标准投影

useWhen: "需要多 provider 回放、审计或持续升级的产品。"
tradeoff: "信息保真；存储、脱敏和消费者适配更复杂。"

## 可运行示例

```python
from dataclasses import dataclass, field
@dataclass(frozen=True)
class Message:
    role: str; content: str | list[dict]; metadata: dict = field(default_factory=dict)
def to_wire(m: Message) -> dict:
    if m.role not in {"system", "user", "assistant", "tool"}: raise ValueError("未知角色")
    return {"role": m.role, "content": m.content}
assert to_wire(Message("user", [{"type":"text","text":"看图"}]))["role"] == "user"
```

## 搭积木复现

### 积木 1：定义 role 与 content

用不可变数据类保存两者，先拒绝未知角色，验证协议失败可见。

### 积木 2：加入文本 block

把字符串映射为 text block，断言显示文本与发送载荷一致。

### 积木 3：加入图像 block

要求 `url` 和 type，测试错误 URL 不会被当成普通文本。

### 积木 4：加入 tool 关联

为 tool 消息保存 call id，断言孤立结果被拒绝。

### 积木 5：实现保守转换

未知块标记为 non-standard，并记录原始字典供人工适配。

## 自检

### 问题

为什么把所有 block `json.dumps` 成 user 文本会破坏工具调用审计？如何写一个失败测试？

### 站内答案

结论是它丢失了角色和调用关联。机制上，assistant 的 tool call 与 tool result 需要同一 id；文本化后 id 只剩偶然可解析的字符。源码以 `type`、`additional_kwargs` 和 translator 保存解释上下文。测试构造一个没有 call id 的 tool block，适配器必须抛 `ValueError`，再断言日志中没有把它当 user 文本发送。工程上，保留原始块与安全展示副本；只有纯文本、无工具的流程才可以选择简化模型。
