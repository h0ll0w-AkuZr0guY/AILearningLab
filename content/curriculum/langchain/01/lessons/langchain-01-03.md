---
id: "langchain-01-03"
track: "langchain"
title: "ChatModel 输入输出"
depth: "deep"
visualIndex: "../visuals/langchain-01-03.md"
exampleLanguage: "python"
readingMinutes: 25
sourceMinutes: 8
practiceMinutes: 10
reviewMinutes: 2
---

## 官方入口

title: "LangChain Models · Invocation"
url: "https://docs.langchain.com/oss/python/langchain/models#invocation"

该章节明确列出 chat model 的三类合法调用输入：单个字符串、消息字典序列和 Message 对象序列；同步 `invoke` 返回完整 `AIMessage`。它没有保证不同 provider 接受完全相同的模型参数、模态或停止词语义，这些差异仍由具体集成负责。

## 真实源码

repo: "langchain-ai/langchain"
file: "libs/core/langchain_core/language_models/chat_models.py"
symbol: "BaseChatModel._convert_input / BaseChatModel.invoke"
language: "python"
url: "https://github.com/langchain-ai/langchain/blob/725489f135458c37c668919b0d08652ebd04f131/libs/core/langchain_core/language_models/chat_models.py#L272-L319"

### 逐段讲解

- `_convert_input` 先识别已经规范化的 `PromptValue`，避免重复转换。
- 字符串被包装成 `StringPromptValue`；消息序列经 `convert_to_messages` 形成 `ChatPromptValue`。
- 非法输入在真正发起网络请求前抛 `ValueError`，因此适配错误与 provider 故障可以分开观察。
- `invoke` 用 `ensure_config` 归一化追踪配置，经 `generate_prompt` 进入批量生成主路径，最后从第一组 `ChatGeneration` 中取出 `AIMessage`。

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

def invoke(self, input, config=None, *, stop=None, **kwargs) -> AIMessage:
    # 配置先规范化，随后把单次调用复用到批量生成实现。
    config = ensure_config(config)
    generation = self.generate_prompt(
        [self._convert_input(input)],
        stop=stop,
        callbacks=config.get("callbacks"),
        tags=config.get("tags"),
        metadata=config.get("metadata"),
        run_name=config.get("run_name"),
        run_id=config.pop("run_id", None),
        **kwargs,
    ).generations[0][0]
    return generation.message
```

## 导读

很多人把 ChatModel 理解成“字符串进去，字符串出来”的函数。这个心智模型在最小聊天框中勉强可用，一旦加入系统消息、工具调用、图片或用量统计便会出错。真实合同更像机场安检：入口可以接收几种便捷包装，安检后统一成 PromptValue；出口也不是一段裸文本，而是一封包含内容、工具请求、用量和 provider 元数据的 AIMessage。

本课只处理一次完整调用的边界。流式 chunk、批量并发和 config 继承分别留给后续专题，因为它们改变时间与调度语义。当前目标是能在不接任何真实模型的情况下，手写输入归一化、输出信封和失败分类，并准确预测 provider adapter 看见的对象。

## 分章正文

### 三种入口为何收敛到一个 PromptValue

kicker: "01 · OBSERVE"

调用 `model.invoke("你好")` 很方便，但字符串没有显式 role；传 `[("system", "..."), ("human", "...")]` 又需要把二元组转成真实 Message；PromptTemplate 则直接产生 `ChatPromptValue`。如果每个 provider 各自处理这三种输入，角色别名、空消息和多模态块会在不同集成中产生不同结果。

LangChain 把归一化放在 BaseChatModel：字符串保留为 `StringPromptValue`，消息序列经统一转换器变为 `ChatPromptValue`，已经完成模板渲染的 PromptValue 原样通过。这里“统一”指内部观察面统一，不表示 wire payload 已经相同。OpenAI、Anthropic 和本地模型仍会在自己的 adapter 中把 Message 转成各自请求体。

最小失败实验是传入整数 `42`。可靠实现应在网络请求前报输入类型错误，调用计费、重试和 provider 日志都不应发生。若 adapter 到发送阶段才发现类型错误，应用会把程序缺陷误判成外部服务故障。

#### 本章结论

便捷输入只存在于公开边界；越过 `_convert_input` 后，框架主路径只处理可枚举的 PromptValue。

### 输入语义不等于 Python 外形

kicker: "02 · MODEL"

`Sequence` 的范围很宽，字符串本身也是序列，因此源码必须先判断 `str`。判断顺序一旦反转，`"hi"` 可能被当成两个消息元素。类似地，消息字典需要 `role` 与 `content`，二元组需要角色和模板文本，BaseMessage 则已经携带类型。它们外形都可迭代，语义却不同。

真正的不变量有三条。第一，消息顺序必须保持，因为模型按上下文顺序解释角色。第二，role 和内容块不能在转换中丢失。第三，输入归一化不得偷偷执行 provider I/O。可以把它写成方程：

`normalize(input) -> PromptValue`，且 `messages(normalize(x))` 保持 `x` 的角色顺序与可发送载荷。

字符串快捷方式适合单轮纯文本；多轮、系统指令、工具与多模态应显式传 Message。把一段包含“system:”前缀的字符串当系统消息，实际 role 仍可能是 human。文字长得像协议并不会自动获得协议权限。

#### 本章结论

输入类型决定解释器；自然语言前缀、可迭代外形和最终打印文本都不能替代结构化角色。

### invoke 如何复用 generate_prompt

kicker: "03 · SOURCE"

源码没有为单次调用另写一套 provider 请求逻辑。`invoke` 把一个 PromptValue 放进长度为一的列表，交给 `generate_prompt`，再从 `generations[0][0]` 取第一条候选消息。这种设计让 callback、缓存、批量结果和 provider 实现共用一条主路径。

二维索引不是随意包装：外层对应每个输入 prompt，内层对应该 prompt 的候选 generation。公开 `invoke` 只返回单次输入的首个 ChatGeneration.message，因此调用者拿到 AIMessage。若 provider 生成多个候选，想保留全部候选就不能只依赖 invoke 的简化出口。

config 中的 callbacks、tags、metadata、run_name 与 run_id 被拆给生成路径。它们用于观测与运行身份，不应混进 prompt content。`run_id` 使用 `pop` 也提醒我们 config 在调用链中会被规范化和派生；业务代码不应把传入字典当不可变审计记录。

#### 本章结论

`invoke` 是对统一生成引擎的单输入、首候选投影；AIMessage 是投影结果，完整批量容器仍存在于更底层。

### 区分四类失败

kicker: "04 · FAILURE"

第一类是输入归一化失败，例如整数、缺少 role 的字典或无效消息元素，应在本地立即失败。第二类是模板绑定失败，例如变量缺失，发生在模型之前。第三类是 provider 请求失败，包括认证、限流、超时和服务端错误。第四类是响应解析失败，例如 provider 返回了 adapter 不认识的工具块。

这四类错误的重试策略不同。输入和模板错误重试不会改变结果；429、部分 5xx 和短暂网络错误可以按幂等边界重试；响应解析错误要保存脱敏原始响应并升级 adapter。若把所有异常包成“模型失败”，监控会误导，自动重试也可能放大费用。

`stop` 也是边界条件。不同 provider 对停止词数量、匹配位置和流式截断支持可能不同。框架传递参数并不意味着跨模型结果完全一致。测试可验证参数被送入假 adapter，但不能仅凭本地单测声称 provider 语义一致。

#### 本章结论

错误分类应沿“归一化、模板、传输、解析”四道边界记录；只对可能随时间恢复的外部失败重试。

### 输出信封与生产验收

kicker: "05 · ENGINEERING"

AIMessage 的 `text` 适合显示，`content_blocks` 适合读取标准块，`tool_calls` 交给工具执行器，`usage_metadata` 用于成本和限额，`response_metadata` 用于诊断。生产代码应按用途选择字段，而非统一 `str(response)`。`str` 是调试表示，版本升级后格式可能变化，也会把元数据意外写进 UI。

可测试的 adapter 可以完全不访问模型。先实现 FakeChatModel：记录收到的 PromptValue，返回固定 AIMessage；随后用字符串、消息列表和 PromptValue 三组等价输入断言归一化结果；再传非法整数，断言调用计数仍为零。这样测试的是框架边界而非模型随机输出。

设计变体一是在应用入口只接受 `list[BaseMessage]`，牺牲便捷但协议最清楚。变体二是保留 LangChain 的宽入口，在边缘层记录原始输入类型和规范化摘要，适合交互式产品。无论哪种，安全日志只记录角色、块类型、长度和 trace id，用户正文需脱敏或受控存储。

#### 本章结论

ChatModel 的可维护性来自输入与输出都保持结构；文本只是结构中的一个投影。

## 核心机制

- 三种公开输入先收敛为 PromptValue，再进入 provider 生成主路径。
- 单次 invoke 复用批量容器，并返回首个 ChatGeneration 的 AIMessage。
- config 承载观测与运行控制，不应污染消息正文。
- 输入、模板、传输和解析失败具有不同证据与重试策略。

## 常见误区

- 用 `"system: ..."` 字符串代替 SystemMessage，误以为模型会自动获得系统角色。
- 对任意异常统一重试，导致确定性的模板错误反复计费。
- 只读取 `response.content` 并假设一定是字符串，丢失多模态和工具块。

## 实现变体

### 变体 A：严格 Message-only 边界

useWhen: "后端服务、可审计 Agent 或所有调用都已由统一会话层构造。"
tradeoff: "角色与模态合同清晰；一次性纯文本调用需要额外包装。"

### 变体 B：宽输入加显式规范化日志

useWhen: "Notebook、教学工具和需要兼顾快速调用的 SDK。"
tradeoff: "调用方便；必须测试每类输入并避免把敏感正文写入日志。"

## 可运行示例

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class PromptValue:
    messages: tuple[tuple[str, str], ...]

def normalize(value) -> PromptValue:
    if isinstance(value, PromptValue):
        return value
    if isinstance(value, str):
        return PromptValue((("human", value),))
    if isinstance(value, list):
        rows = tuple((str(role), str(content)) for role, content in value)
        if any(role not in {"system", "human", "ai", "tool"} for role, _ in rows):
            raise ValueError("未知消息角色")
        return PromptValue(rows)
    raise ValueError(f"非法输入类型: {type(value).__name__}")

class FakeChatModel:
    calls = 0
    def invoke(self, value):
        prompt = normalize(value)
        self.calls += 1
        return {"type": "ai", "text": f"收到 {len(prompt.messages)} 条消息"}

model = FakeChatModel()
assert model.invoke("你好")["text"] == "收到 1 条消息"
assert model.invoke([("system", "简短回答"), ("human", "1+1")])["text"] == "收到 2 条消息"
try:
    model.invoke(42)
except ValueError:
    pass
assert model.calls == 2  # 非法输入没有越过本地边界
```

## 搭积木复现

### 积木 1：定义 PromptValue

只保存有序消息元组，先把“归一化之后必须保持顺序”写成断言。

### 积木 2：加入字符串快捷入口

把字符串显式提升为 human 消息，用 system 前缀反例证明文字不能改变 role。

### 积木 3：加入消息序列转换

校验每个元素的 role 与 content，非法元素在 Fake provider 调用前失败。

### 积木 4：返回结构化 AIMessage

至少区分 text、tool_calls 和 usage，不用一个字符串承载全部输出。

### 积木 5：记录四段失败位置

分别构造 normalize、template、transport、parse 错误，为每类错误断言不同错误码与重试策略。

## 自检

### 问题

为什么 `invoke("system: 只回答数字")` 与 `invoke([SystemMessage(...), HumanMessage(...)])` 不等价？怎样用 FakeChatModel 证明问题在 provider 请求之前已经确定？

### 站内答案

结论是字符串快捷入口只携带文本，归一化后通常成为单条 human 输入；显式 Message 序列则保存两个角色。机制证据在 `_convert_input`：字符串进入 `StringPromptValue`，序列进入 `ChatPromptValue(messages=convert_to_messages(...))`。FakeChatModel 记录规范化后的消息角色即可验证，无需真实模型：前者得到一个 human，后者得到 system 与 human。工程上，单轮无权限差异的问答可用字符串；涉及系统约束、多轮、工具和多模态时必须使用结构化消息，并对 role 顺序写合同测试。
