---
id: "langchain-02-02"
track: "langchain"
title: "BaseChatModel 输入归一化"
depth: "deep"
exampleLanguage: "python"
readingMinutes: 25
sourceMinutes: 8
practiceMinutes: 10
reviewMinutes: 2
visualIndex: "../visuals/langchain-02-02.md"
---

## 官方入口

title: "LangChain Models · Invoke"
url: "https://docs.langchain.com/oss/python/langchain/models#invoke"

官方章节说明 chat model 的 `invoke()` 可以接受单条消息、消息列表、字典格式和消息对象，并返回 `AIMessage`。这个入口描述的是公开输入合同；真正把多种表示变成 `PromptValue` 和 `BaseMessage` 的内部步骤仍需回到源码核对。

补充入口：[BaseChatModel reference](https://reference.langchain.com/python/langchain-core/language_models/chat_models/BaseChatModel) 说明自定义模型必须实现 `_generate`，并把 `invoke`、`ainvoke`、`stream` 和 `batch` 放在同一 Runnable 族中。参考页按类路径定位，没有另一个比类页更稳定的内部转换子锚点。

## 真实源码

repo: "langchain-ai/langchain"
file: "libs/core/langchain_core/language_models/chat_models.py"
symbol: "BaseChatModel._convert_input / BaseChatModel.invoke"
language: "python"
url: "https://github.com/langchain-ai/langchain/blob/c318abed446e7d1a0e872a6967b9b17bc6f4761c/libs/core/langchain_core/language_models/chat_models.py#L449-L487"

### 其他固定证据

- 消息列表通过 `convert_to_messages` 逐项调用 `_convert_to_message`：[utils.py#L706-L783](https://github.com/langchain-ai/langchain/blob/c318abed446e7d1a0e872a6967b9b17bc6f4761c/libs/core/langchain_core/messages/utils.py#L706-L783)、[utils.py#L786-L803](https://github.com/langchain-ai/langchain/blob/c318abed446e7d1a0e872a6967b9b17bc6f4761c/libs/core/langchain_core/messages/utils.py#L786-L803)。
- `invoke` 把规范化后的 PromptValue 放入 `generate_prompt`，再投影出第一条 generation 的 message：[chat_models.py#L462-L487](https://github.com/langchain-ai/langchain/blob/c318abed446e7d1a0e872a6967b9b17bc6f4761c/libs/core/langchain_core/language_models/chat_models.py#L462-L487)。
- ChatModel 的公开表格列出允许的输入表示与统一输出：[chat_models.py#L272-L318](https://github.com/langchain-ai/langchain/blob/c318abed446e7d1a0e872a6967b9b17bc6f4761c/libs/core/langchain_core/language_models/chat_models.py#L272-L318)。
- 消息转换的上游测试覆盖图片、PDF、消息字典和非法 content 等边界：[test_base.py#L659-L848](https://github.com/langchain-ai/langchain/blob/c318abed446e7d1a0e872a6967b9b17bc6f4761c/libs/core/tests/unit_tests/language_models/chat_models/test_base.py#L659-L848)、[test_base.py#L980-L1011](https://github.com/langchain-ai/langchain/blob/c318abed446e7d1a0e872a6967b9b17bc6f4761c/libs/core/tests/unit_tests/language_models/chat_models/test_base.py#L980-L1011)。

### 逐段讲解

- 已经是 `PromptValue` 的输入直接复用；字符串包装成 `StringPromptValue`；序列被当作消息表示转换成 `ChatPromptValue`。
- 消息序列的每一个元素可以是 `BaseMessage`、`("role", content)` 元组、带 `role/content` 的字典或字符串 shorthand。
- `invoke` 不把 provider-specific payload 直接交给 `_generate`，而是先把输入变成 `PromptValue`，再调用 `generate_prompt`。
- 转换失败发生在网络请求之前，这使“输入合同错误”和“供应商拒绝请求”成为两种可区分的诊断。

### 源码节选

```python
def _convert_input(self, model_input: LanguageModelInput) -> PromptValue:
    if isinstance(model_input, PromptValue):
        return model_input
    if isinstance(model_input, str):
        return StringPromptValue(text=model_input)
    if isinstance(model_input, Sequence):
        return ChatPromptValue(messages=convert_to_messages(model_input))
    raise ValueError(
        f"Invalid input type {type(model_input)}. "
        "Must be a PromptValue, str, or list of BaseMessages."
    )

def invoke(self, input, config=None, *, stop=None, **kwargs):
    config = ensure_config(config)
    return cast(
        "AIMessage",
        cast("ChatGeneration", self.generate_prompt(
            [self._convert_input(input)], stop=stop, **kwargs
        ).generations[0][0]).message,
    )
```

节选省略 callback、metadata、run id 和异步实现。它只保留“先规范化、后生成、最后投影”的边界；生产模型还要负责回调、缓存、流式和 provider 参数。

## 导读

### 同一个 invoke 为什么要接受这么多形状

`model.invoke("hello")`、`model.invoke([("human", "hello")])` 和 `model.invoke([HumanMessage("hello")])` 对调用者很方便，但 provider adapter 通常只希望收到规范的消息数组。输入归一化像机场安检：先把不同外观的行李贴成统一标签，再交给后面的登机流程。若把转换留给每个 provider，OpenAI、Anthropic 和 fake model 会产生不同的错误时机和 role 解释。

本课的心智模型是 `raw input → PromptValue → messages → ChatResult → AIMessage`，只聚焦箭头左侧。下一课解释箭头右侧 provider 如何产出 `ChatResult`；前一课已经讲过 Message 的角色和 content blocks，因此本课不重复定义消息语义。

## 分章正文

### 从可观察现象建立问题

kicker: "01 · OBSERVE"

一个 fake model 可以记录它最终收到的消息：

```python
model.invoke("hi")
# provider 看到 [HumanMessage(content="hi")]

model.invoke([{"role": "system", "content": "be brief"}, {"role": "user", "content": "hi"}])
# provider 看到两个 BaseMessage
```

如果把整数传给 `invoke`，错误应在 fake provider 被调用前发生。这个时间顺序比异常类名更能帮助排查真实服务。

#### 本章结论

公开输入可以多形，provider 边界必须单形。

### 建立数据模型与不变量

kicker: "02 · MODEL"

定义三个层次：

```text
LanguageModelInput = str | PromptValue | Sequence[MessageLikeRepresentation]
PromptValue = StringPromptValue | ChatPromptValue
ChatPromptValue.messages = list[BaseMessage]
```

不变量如下：

1. 字符串 shorthand 等价于一个 human message，而不是任意 provider 的纯文本旁路。
2. 消息列表顺序保持不变，role 和 content 不在归一化时被重排。
3. 字典至少需要 `role`/`content` 或等价的 `type`/`content` 结构；缺字段应失败。
4. `PromptValue` 是 provider 无关的中间表示，真正的消息序列由 `to_messages()` 产生。

#### 本章结论

输入归一化的产物是可检查的中间对象，它把类型分派与 provider 请求分开。

### 沿真实源码走一遍主路径

kicker: "03 · SOURCE"

`BaseChatModel._convert_input` 先判断 PromptValue、字符串和 Sequence。Sequence 分支调用 `convert_to_messages`；后者对每一项调用 `_convert_to_message`，再把结果包装成 ChatPromptValue。`invoke` 随后把 PromptValue 放进 `generate_prompt`，取第一条 ChatGeneration 的 message。

因此源码中存在两个不同的“列表”：调用者给的任意消息表示列表，以及 provider generator 收到的 `list[BaseMessage]`。把两者混为一谈会漏掉 role shorthand、字典校验和序列顺序的证据。

#### 本章结论

`invoke` 的第一条主路径是转换，不是网络调用；源码中的 `generate_prompt` 只接收已规范化的 PromptValue。

### 补齐失败路径与边界

kicker: "04 · FAILURE"

- 非 PromptValue、非字符串、非序列输入触发 `ValueError`。
- 形如 `("human",)` 的短元组无法拆出 content，触发消息转换错误。
- 缺少 `role`/`type` 或 `content` 的字典触发 `ValueError`，不会让 provider 自己猜字段。
- 某些 content block 能被标准消息类承接，但 provider 是否支持它是后续适配层边界。

`Sequence` 是 Python 抽象，因此自定义序列类型可能进入转换分支。教学实现不要用“列表才允许”去替代源码合同；应说明自己收窄了哪一层。

#### 本章结论

输入错误要在归一化边界失败；能被 LangChain 表示不等于所有 provider 都能发送。

### 从教学实现走向工程取舍

kicker: "05 · ENGINEERING"

教学版本可以只接受字符串和 `(role, content)` 元组，直接构造自己的 `Message`；它清楚但会丢失 PromptValue、序列化 envelope、content blocks 和标准错误码。生产代码应优先让 BaseChatModel 处理公开输入，再在 provider adapter 中负责格式映射。

如果业务已保存规范消息对象，直接传 `BaseMessage` 列表能减少重复转换；如果边界来自 JSON，则先校验 schema 再调用模型，避免把用户输入错误和模型错误混在重试逻辑中。

调试时最好把三份证据并排记录：进入 `invoke` 的原始类型、归一化后的 PromptValue 类型，以及 provider adapter 最终收到的消息数组。只打印最终错误通常看不出是字典字段缺失、role 映射错误，还是 provider 不接受某种 content block。对于多模态输入，还要记录 content block 的类型和来源，不要把一段可序列化的 Python dict 误认为已经满足供应商 API 的 schema。这样既能复现本地转换，也能在切换 provider 时确认差异确实发生在 adapter 边界。

#### 本章结论

归一化层越靠近统一入口，错误越可解释；provider 层越专注 payload，替换成本越低。

还要注意顺序和所有权。`convert_to_messages` 返回的是新的消息列表，但其中的 message content 可能仍然引用调用者提供的结构化对象；adapter 不应在发送前就地修改原始输入，否则同一段对话再次重试时可能出现难以追踪的差异。对于带附件的 content block，归一化只负责把表示放进标准消息，上传、编码、大小限制和区域权限属于 provider 适配层。把这些责任分开，才能让失败测试准确回答“哪一步拒绝了输入”。

## 核心机制

- `_convert_input` 将三类公开输入映射到两类 PromptValue。
- `convert_to_messages` 保留顺序，并把每项表示转换成 BaseMessage。
- `invoke` 只把规范化 PromptValue交给 `generate_prompt`，最后投影一个 AIMessage。
- 可表示的消息与 provider 能发送的 content block 是两个合同，不能从前者推出后者。

## 常见误区

- 认为字符串输入绕过消息系统，因而忽略它会被解释为 human message。
- 认为消息字典只要有 `content` 就够，忽略 `role/type` 是选择具体消息类的依据。
- 看到 `invoke` 返回 AIMessage，就以为 provider 直接返回了 AIMessage，忽略中间的 PromptValue、ChatGeneration 和 ChatResult。
- 用 provider 的错误响应测试输入校验，导致网络和鉴权噪声掩盖本地可复现的转换错误。

## 实现变体

### 变体 A：先构造标准消息

useWhen: "边界输入来自内部 Python 代码，已经能构造 BaseMessage。"
tradeoff: "类型和 role 更明确；调用者需要依赖 LangChain message classes。"

#### 代码

```python
messages = [
    {"role": "system", "content": "be concise"},
    {"role": "user", "content": "hello"},
]
```

### 变体 B：接收兼容表示后统一转换

useWhen: "边界来自配置、HTTP JSON 或 prompt template。"
tradeoff: "调用方便；必须严格检查缺字段、错误 role 和 content block 能力。"

#### 代码

```python
def to_message(item):
    if isinstance(item, tuple) and len(item) == 2:
        return {"role": item[0], "content": item[1]}
    if isinstance(item, dict) and {"role", "content"} <= item.keys():
        return item
    raise ValueError("message must have role and content")
```

## 可运行示例

```python
from dataclasses import dataclass


@dataclass(frozen=True)
class Message:
    role: str
    content: str


def convert_message(value: object) -> Message:
    if isinstance(value, Message):
        return value
    if isinstance(value, str):
        return Message("human", value)
    if isinstance(value, tuple):
        if len(value) != 2:
            raise ValueError("tuple message must be (role, content)")
        return Message(str(value[0]), str(value[1]))
    if isinstance(value, dict):
        role = value.get("role", value.get("type"))
        if role is None or "content" not in value:
            raise ValueError("message dict needs role/type and content")
        return Message(str(role), str(value["content"] or ""))
    raise TypeError(f"unsupported message: {type(value).__name__}")


def normalize(value: object) -> list[Message]:
    if isinstance(value, str):
        return [convert_message(value)]
    if isinstance(value, list):
        return [convert_message(item) for item in value]
    raise ValueError("input must be str or list of messages")


assert normalize("hello") == [Message("human", "hello")]
assert normalize([("system", "brief"), {"role": "user", "content": "hi"}])[1].role == "user"

for bad in (42, [("user",)], [{"content": "missing role"}]):
    try:
        normalize(bad)
    except (TypeError, ValueError):
        pass
    else:
        raise AssertionError("非法输入必须在 provider 之前失败")

print("input normalization: ok")
```

示例模拟的是 `_convert_input` 和 `convert_to_messages` 的合同，不模拟 Pydantic、PromptValue、content blocks 或 provider payload。它因此只能证明形状归一化和失败时机。

## 搭积木复现

### 积木 1：定义不可变 Message

让 Message 保存 role/content，先断言顺序和空 content 行为。

### 积木 2：加入字符串 shorthand

把裸字符串转换为 human message，验证它没有绕过消息模型。

### 积木 3：加入 tuple 分支

支持 `(role, content)`，对长度不为二的序列保留失败断言。

### 积木 4：加入 dict 分支

支持 role/type 二选一，并拒绝缺 content 的字典。

### 积木 5：包装成 PromptValue

把消息列表包装成 ChatPromptValue 的概念对象，确保 provider 只接收规范消息。

### 积木 6：对照上游

阅读固定 commit 的 `_convert_input` 和 `_convert_to_message`，标出教学版本省略的 Serializable envelope、content block、错误码和 PromptValue 分派。

## 自检

### 问题

为什么 `BaseChatModel.invoke` 不直接把输入交给 provider 的 `_generate`？当字典缺少 `role` 时，应该由哪一层报告错误？

### 站内答案

结论：`invoke` 先将多形输入归一化为 PromptValue 和 BaseMessage 列表，再调用 `generate_prompt`；缺少 `role/type` 或 `content` 的字典应由消息转换层在网络请求前报告。机制：`_convert_input` 对 PromptValue、字符串、Sequence 分派，Sequence 进入 `convert_to_messages`，每一项由 `_convert_to_message` 选择消息类型并校验字段。源码证据是固定 commit 的 `chat_models.py#L449-L487` 与 `messages/utils.py#L706-L803`。验证方法：运行示例的字符串、tuple、dict 正常断言，随后传入整数、短 tuple 和缺 role 字典，确认 fake provider 没有被调用。工程取舍：集中归一化让所有 provider 共享输入合同，provider adapter 可专注 payload；若业务直接接受任意 JSON，仍应在边界增加 schema 和 content block 能力校验。适用边界：被 LangChain 表示的 multimodal content 仍可能被某个 provider 拒绝，不能把“成功转换”为“发送成功”。

## 更新日志

<!-- PR 前署名门禁通过后追加本批人类 × AI 记录。 -->

### 本批署名确认与输入归一化深化

at: "2026-08-08T20:35:41+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "Codex Desktop · gpt-5.6-luna"
summary: "补齐 BaseChatModel 对字符串、PromptValue、消息列表与字典输入的归一化和失败边界，加入固定源码证据、失败断言和 flow 视觉。"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/44"
