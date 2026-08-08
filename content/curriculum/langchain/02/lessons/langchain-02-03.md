---
id: "langchain-02-03"
track: "langchain"
title: "_generate、ChatResult 与响应元数据"
depth: "deep"
exampleLanguage: "python"
readingMinutes: 25
sourceMinutes: 10
practiceMinutes: 10
reviewMinutes: 5
visualIndex: "../visuals/langchain-02-03.md"
---

## 官方入口

title: "ChatResult reference"
url: "https://reference.langchain.com/python/langchain-core/outputs/chat_result/ChatResult"

这是 LangChain 官方 reference 的 `ChatResult` 类页。它明确说明 `ChatResult` 是 chat model 单次生成的内部容器，`generations` 可以容纳多个候选，`llm_output` 是 provider-specific 的自由字典；标准 Runnable 调用最终通常暴露 `AIMessage`。该页面按类路径定位，字段说明承担本课的公开数据模型，内部投影顺序以固定源码为准。

补充入口：[BaseChatModel · custom chat model](https://reference.langchain.com/python/langchain-core/language_models/chat_models/BaseChatModel) 规定自定义模型必须实现 `_generate`，返回 ChatResult；[Models · Invoke](https://docs.langchain.com/oss/python/langchain/models#invoke) 说明调用者看到的是完整 `AIMessage`。

## 真实源码

repo: "langchain-ai/langchain"
file: "libs/core/langchain_core/language_models/chat_models.py"
symbol: "BaseChatModel._generate_with_cache / BaseChatModel._generate / BaseChatModel.invoke"
language: "python"
url: "https://github.com/langchain-ai/langchain/blob/c318abed446e7d1a0e872a6967b9b17bc6f4761c/libs/core/langchain_core/language_models/chat_models.py#L1880-L2014"

### 其他固定证据

- `ChatResult` 的字段和 provider-specific 边界：[chat_result.py#L10-L39](https://github.com/langchain-ai/langchain/blob/c318abed446e7d1a0e872a6967b9b17bc6f4761c/libs/core/langchain_core/outputs/chat_result.py#L10-L39)。
- `_generate` 是 provider adapter 必须实现的抽象方法：[chat_models.py#L2196-L2214](https://github.com/langchain-ai/langchain/blob/c318abed446e7d1a0e872a6967b9b17bc6f4761c/libs/core/langchain_core/language_models/chat_models.py#L2196-L2214)。
- `_generate_with_cache` 在显式流式、隐式流式和普通 `_generate` 之间分派，并把 generation metadata 合并回消息：[chat_models.py#L1955-L2037](https://github.com/langchain-ai/langchain/blob/c318abed446e7d1a0e872a6967b9b17bc6f4761c/libs/core/langchain_core/language_models/chat_models.py#L1955-L2037)。
- `ChatGeneration` 把结构化 message 与文本属性放在同一个 generation 中：[chat_generation.py#L17-L45](https://github.com/langchain-ai/langchain/blob/c318abed446e7d1a0e872a6967b9b17bc6f4761c/libs/core/langchain_core/outputs/chat_generation.py#L17-L45)。

### 逐段讲解

- provider 的 `_generate` 面对的是规范化后的消息列表，返回 `ChatResult`，而不是直接返回字符串或最终 `AIMessage`。
- `ChatResult.generations` 是候选集合；普通 `invoke` 取第一条 generation 的 message 作为调用结果。
- `llm_output` 允许 provider 携带自由字段，但它的 key 与稳定性不由核心层统一保证。
- `_generate_with_cache` 在流式或普通路径结束后，为每条 generation 的 message 补 `response_metadata`，必要时合并 `llm_output`。

### 源码节选

```python
class ChatResult(BaseModel):
    generations: list[ChatGeneration]
    llm_output: dict[str, Any] | None = None

@abstractmethod
def _generate(
    self,
    messages: list[BaseMessage],
    stop: list[str] | None = None,
    run_manager: CallbackManagerForLLMRun | None = None,
    **kwargs: Any,
) -> ChatResult:
    """Generate the result."""

# normal path inside _generate_with_cache
result = self._generate(messages, stop=stop, **kwargs)
for idx, generation in enumerate(result.generations):
    generation.message.response_metadata = _gen_info_and_msg_metadata(generation)
if len(result.generations) == 1 and result.llm_output is not None:
    result.generations[0].message.response_metadata = {
        **result.llm_output,
        **result.generations[0].message.response_metadata,
    }
return result
```

节选省略缓存命中、callback、v2 streaming 和 output version 分支。生产实现还必须正确处理 message id、token usage、缓存 key 和 provider 的多个 generation；本课只追踪容器到最终消息的投影。

## 导读

### provider 返回什么，调用者看到什么

一个供应商可能返回文本、finish reason、token usage、请求 id 和多个候选。LangChain 不能把这些字段全部硬编码进核心接口，于是让 provider 在 `_generate` 中返回 `ChatResult`，核心层再把其中的 `ChatGeneration.message` 投影为 `AIMessage`，把能识别的 metadata 归并到标准位置。

这类似仓库的入库单：`ChatResult` 是内部验收单，`AIMessage` 是业务层拿到的货物，`llm_output` 是供应商附带的自由备注。备注可以审计，但业务不能把某个 provider 的备注 key 当成跨 provider 标准。

本课承接上一课的输入归一化，下一课追踪同一个 `_generate` 如何与 stream、batch 和自动流式路径交织。它不讲输出 parser 或 tool loop。

## 分章正文

### 从可观察现象建立问题

kicker: "01 · OBSERVE"

用一个 fake adapter 记录四个值：输入 messages、生成文本、`llm_output` 和调用者最终拿到的类型。你会看到：adapter 产出 ChatResult，调用者的 `invoke` 结果却是 AIMessage；`llm_output` 是否出现在 `response_metadata` 取决于核心层合并逻辑，而不是 adapter 直接修改返回类型。

#### 本章结论

统一调用接口可以隐藏内部容器，但不能抹掉 provider 元数据的所有权和稳定性边界。

### 建立数据模型与不变量

kicker: "02 · MODEL"

```text
ChatResult
├─ generations: [ChatGeneration, ...]
│  └─ message: BaseMessage / AIMessage
└─ llm_output: dict | None
```

不变量：

1. 每个 generation 都要有结构化 message，不能只保存裸文本。
2. `generations` 的顺序表达候选顺序；`invoke` 的标准投影通常选择第一个。
3. `llm_output` 只能被当作 provider-specific 扩展，业务层要优先使用标准化 message metadata。
4. 元数据合并不能覆盖更具体的 generation/message metadata；固定源码中的后写字典决定优先级。

#### 本章结论

ChatResult 同时保存候选和扩展信息，AIMessage 是它面向 Runnable 调用者的投影。

### 沿真实源码走一遍主路径

kicker: "03 · SOURCE"

主路径可以写成：

```text
BaseChatModel.invoke
  → generate_prompt
    → generate
      → _generate_with_cache
        → _generate (provider override)
        → metadata merge
  → generations[0][0].message
```

如果当前 callback 触发了隐式流式，`_generate_with_cache` 先收集 chunks 并用 `generate_from_stream` 形成 ChatResult；普通路径才直接进入 `_generate`。因此“实现了 `_generate`”不等于所有调用都会无条件直达它。

#### 本章结论

`_generate` 是 provider 的必实现点，`_generate_with_cache` 是核心层把不同执行路径收束为 ChatResult 的汇合点。

### 补齐失败路径与版本边界

kicker: "04 · FAILURE"

- provider adapter 若把非 ChatResult 返回值交给核心，类型和后续 generation 访问会失败；应在 adapter 测试中尽早发现。
- `generations` 允许多个候选，但普通 `invoke` 只投影第一条；需要 n-best 的调用者应使用更底层的 generate 结果或 callback 证据。
- `llm_output` 的 key 可能随 provider 与版本变化，不能用它作为跨 provider 计费合同。
- 缓存命中、流式收集和普通 `_generate` 都要产生可合并的 generation；不能只测试无缓存的 happy path。

本课不宣称任意 provider 的 metadata 都会被核心自动标准化。标准字段只有在 provider adapter 明确写入 AIMessage 或核心可识别的结构时才可依赖。

#### 本章结论

错误语义的关键是保住结构化 generation；自由元数据要以“可选、可变、需核验”对待。

### 从教学实现走向工程取舍

kicker: "05 · ENGINEERING"

教学 adapter 可以直接返回一个 ChatGeneration 和一个小字典，帮助学习者看清投影。生产 adapter 则要对齐 provider 的 tool call、usage、finish reason、response id、stream chunk 合并和 retry/caching 语义。

若业务只需要文本，使用 `invoke` 得到 AIMessage 更简单；若要比较多个候选、审计 provider 原始回包或实现自定义 rerank，需要保留 ChatResult/LLMResult 级证据。二者不能仅凭返回类型互换。

实际排查时要区分三种时间点：provider 生成结果的时间、核心层补写 metadata 的时间，以及 callback 收到 LLMResult 的时间。缓存命中可能绕过网络，却仍要让调用链看见一致的 message；流式路径可能先产生 chunks，再在收束阶段得到完整的 ChatResult。若把 provider 原始响应、ChatResult 和 AIMessage 全部序列化到一个日志字段中，后续很难判断某个 usage 数值来自 provider、核心合并还是业务加工。因此日志应保留来源标签，业务表则只挑选有明确合同的标准字段。

#### 本章结论

核心容器解决跨 provider 的结构合同，业务选择仍应由可观测性、候选数和稳定字段需求决定。

这条边界也决定了测试的粒度。adapter 单测应断言收到的规范消息、返回的 ChatResult 结构和 provider 扩展；core 集成测试应断言第一条 generation 的投影、metadata 合并和 stream/cache 汇合；业务测试则只断言自己依赖的标准 AIMessage 字段。若三层都只检查最终文本，候选丢失、usage 覆盖或缓存路径的回归会一直隐藏到生产日志里。

## 核心机制

- `_generate` 把统一消息列表交给 provider adapter，并要求返回 ChatResult。
- ChatResult 用 ChatGeneration 保存结构化 message，用 llm_output 携带非标准 provider 信息。
- 核心执行器会把普通、流式和缓存路径收束成 ChatResult，再把第一条 message 投影给 invoke。
- metadata 合并有所有权边界：标准 message metadata 可消费，自由 `llm_output` 仍需按 provider 核验。

## 常见误区

- 以为 provider 可以直接返回字符串，忽略 `_generate` 的 ChatResult 合同。
- 以为 `llm_output` 中的 `token_usage`、`finish_reason` 等 key 在所有 provider 上都稳定。
- 以为 `invoke` 返回 AIMessage 就意味着内部没有候选列表或缓存/流式汇合。
- 只测试普通 `_generate`，没有测试 stream 收集和 cache hit 后的 metadata。

## 实现变体

### 变体 A：核心投影型 adapter

useWhen: "业务只需要标准 AIMessage，并希望 provider 差异留在 adapter 内。"
tradeoff: "调用代码简单；多候选和 provider 自由字段需要额外观测入口。"

#### 代码

```python
def _generate(self, messages):
    message = AIMessage(content="ok", response_metadata={"finish_reason": "stop"})
    return ChatResult(generations=[ChatGeneration(message=message)])
```

### 变体 B：保留候选与 provider 扩展

useWhen: "需要审计原始响应、比较候选或记录 provider usage。"
tradeoff: "证据完整；业务必须识别哪些扩展字段有版本承诺。"

#### 代码

```python
return ChatResult(
    generations=[first, second],
    llm_output={"provider_request_id": "opaque", "usage": {"input": 3}},
)
```

## 可运行示例

```python
from dataclasses import dataclass, field


@dataclass
class Message:
    content: str
    response_metadata: dict[str, object] = field(default_factory=dict)


@dataclass
class Generation:
    message: Message


@dataclass
class ChatResult:
    generations: list[Generation]
    llm_output: dict[str, object] | None = None


class Adapter:
    def _generate(self, messages: list[str]) -> ChatResult:
        return ChatResult(
            generations=[Generation(Message(f"echo: {messages[0]}"))],
            llm_output={"provider": "fake", "usage": {"input": len(messages[0])}},
        )

    def invoke(self, text: str) -> Message:
        result = self._generate([text])
        if not result.generations:
            raise ValueError("provider returned no generations")
        message = result.generations[0].message
        if result.llm_output:
            message.response_metadata = {
                **result.llm_output,
                **message.response_metadata,
            }
        return message


answer = Adapter().invoke("hello")
assert answer.content == "echo: hello"
assert answer.response_metadata["provider"] == "fake"
assert answer.response_metadata["usage"] == {"input": 5}

try:
    Adapter()._generate([]).generations[0]
except (IndexError, ValueError):
    pass

print("ChatResult projection: ok")
```

示例使用显式的 empty-generation 防线来展示 adapter 合同，省略真实 callback、cache、chunk merge 和 Pydantic validation。它不证明 provider 的自由字段会在未来版本继续使用同样 key。

## 搭积木复现

### 积木 1：定义 Message

为消息增加 content 与 response_metadata，先断言标准字段和扩展字段分开。

### 积木 2：定义 Generation

让 generation 只保存 Message，避免把 provider 原始 dict 直接当作最终输出。

### 积木 3：定义 ChatResult

加入 generations 列表和可选 llm_output，断言多个候选的顺序不会被丢弃。

### 积木 4：实现 `_generate`

写一个 fake adapter，把输入 messages 转成 ChatResult，并注入 usage 扩展。

### 积木 5：实现 invoke 投影

选第一条 generation，把自由字段和 message metadata按固定优先级合并，再返回 Message。

### 积木 6：对照真实汇合点

阅读固定 commit 的 `_generate_with_cache`，分别标出普通 `_generate`、`generate_from_stream`、cache hit 和 metadata merge 的位置。

## 自检

### 问题

为什么 `_generate` 返回 `ChatResult`，而 `invoke` 却返回 `AIMessage`？`llm_output` 适合直接作为业务数据库 schema 吗？

### 站内答案

结论：ChatResult 是 provider adapter 与核心执行器之间的内部容器，invoke 取第一条 ChatGeneration 的 message 投影为 AIMessage；llm_output 是自由扩展，不适合未经版本和 provider 核验就成为业务数据库的稳定 schema。机制：核心路径在 `_generate_with_cache` 中汇合普通、流式和缓存结果，为 generation.message 补 metadata，只有一条 generation 且有 llm_output 时才合并，再由 invoke 读取 `generations[0][0].message`。源码证据是固定 commit 的 `chat_models.py#L1955-L2037`、`#L2196-L2214` 和 `chat_result.py#L10-L39`。验证方法：运行示例检查 AIMessage/Message 内容与 response_metadata，再加入第二个 generation 验证只投影第一条；为 llm_output 改名或删除字段，确认业务代码不能依赖不存在的标准合同。工程取舍：保留 ChatResult 便于候选、审计和 provider usage；只使用 invoke 则更简单，但多候选需回到更底层 API。适用边界：本课只固定 2026-08-08 对应的 source commit，核心内部投影可能在后续版本改变，业务应依赖官方稳定字段和自己的 adapter contract。

## 更新日志

<!-- PR 前署名门禁通过后追加本批人类 × AI 记录。 -->

### 本批署名确认与 ChatResult 深化

at: "2026-08-08T20:35:41+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "Codex Desktop · gpt-5.6-luna"
summary: "补齐 _generate 到 ChatResult、AIMessage 和响应元数据的投影与缓存边界，加入固定源码证据、失败断言和 flow 视觉。"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/44"
commit: "479d1622eb25722e57f76e0fa371f628b12e2ded"
