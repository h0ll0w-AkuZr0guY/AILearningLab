---
id: "langchain-01-12"
track: "langchain"
title: "最小核心复现"
depth: "deep"
exampleLanguage: "python"
readingMinutes: 25
sourceMinutes: 8
practiceMinutes: 10
reviewMinutes: 2
visualIndex: "../visuals/langchain-01-12.md"
---

## 官方入口

title: "LangChain Core Reference · RunnableSequence"
url: "https://reference.langchain.com/python/langchain-core/runnables/base/RunnableSequence"

这是 LangChain 官方 API reference 的 `RunnableSequence` 类页面，页面使用路径级定位并列出 `invoke`、`ainvoke`、`batch`、`abatch` 和流式方法；它没有一个稳定且独立于生成器的中文子章节，因此正文同时给出固定源码与上游测试行区间。官方类说明把 `RunnableSequence` 定义为前一步输出连接后一步输入的组合原语，并指出 sequence 自动继承同步、异步、batch 能力。本文不重写 provider 或 Agent，只把前十一课的接口合同压缩成一个可测试的 mini-LangChain。

## 真实源码

repo: "langchain-ai/langchain"
file: "libs/core/langchain_core/runnables/base.py"
symbol: "coerce_to_runnable / RunnableSequence / RunnableSequence.invoke / RunnableSequence.batch"
language: "python"
url: "https://github.com/langchain-ai/langchain/blob/725489f135458c37c668919b0d08652ebd04f131/libs/core/langchain_core/runnables/base.py#L3063-L3124"

### 其他固定证据

- `|` 运算符把 Runnable-like 对象交给 `coerce_to_runnable`：[base.py#L648-L667](https://github.com/langchain-ai/langchain/blob/725489f135458c37c668919b0d08652ebd04f131/libs/core/langchain_core/runnables/base.py#L648-L667)。
- callable、generator 和 dict 的归一化分派：[base.py#L6611-L6652](https://github.com/langchain-ai/langchain/blob/725489f135458c37c668919b0d08652ebd04f131/libs/core/langchain_core/runnables/base.py#L6611-L6652)。
- sequence 的同步主路径与每步 child callback：[base.py#L3417-L3451](https://github.com/langchain-ai/langchain/blob/725489f135458c37c668919b0d08652ebd04f131/libs/core/langchain_core/runnables/base.py#L3417-L3451)。
- sequence 的 batch 逐步传递与 `return_exceptions` 保位：[base.py#L3493-L3619](https://github.com/langchain-ai/langchain/blob/725489f135458c37c668919b0d08652ebd04f131/libs/core/langchain_core/runnables/base.py#L3493-L3619)。
- 上游测试验证失败输入被后续步骤过滤、最终结果仍按原输入顺序重组：[test_runnable.py#L4251-L4335](https://github.com/langchain-ai/langchain/blob/725489f135458c37c668919b0d08652ebd04f131/libs/core/tests/unit_tests/runnables/test_runnable.py#L4251-L4335)。

### 逐段讲解

- `__or__` 不直接保存一个 Python callable，而是先把它归一化成 Runnable；因此后续组合可以统一调用 `invoke`、`batch` 和流式入口。
- `RunnableSequence` 在构造时固定 `first`、`middle`、`last`，同步主路径按顺序调用，每一步的 callback 是上一步运行的 child。
- batch 不是简单地对最终结果做 `map`：sequence 会让每个组件批量处理当前输入，然后把下一组件的输入重新组织起来。
- `return_exceptions=True` 时失败输入被记录在原索引映射中，后续步骤只处理仍成功的输入，最后把异常插回原位置。

### 源码节选

```python
def __or__(
    self,
    other: Runnable[Output, Other] | Callable[[Output], Other],
) -> RunnableSerializable[Input, Any]:
    """Runnable "or" operator."""
    return RunnableSequence(self, coerce_to_runnable(other))

def coerce_to_runnable(thing: RunnableLike[Input, Output]) -> Runnable[Input, Any]:
    """Coerce a Runnable-like object into a Runnable."""
    if isinstance(thing, Runnable):
        return thing
    if is_async_generator(thing) or inspect.isgeneratorfunction(thing):
        return RunnableGenerator(thing)
    if callable(thing):
        return RunnableLambda(thing)
    if isinstance(thing, dict):
        return RunnableParallel(thing)
    raise TypeError("Expected a Runnable, callable or dict.")

class RunnableSequence(RunnableSerializable[Input, Output]):
    """Sequence of `Runnable` objects, where the output of one is the input of the next.

    Any `RunnableSequence` automatically supports sync, async, batch.
    """

for step in self.steps:
    input_ = step.invoke(input_, config)
return input_
```

节选只保留归一化和顺序传递的主干，省略 Pydantic schema、callback manager、异步 batch、stream transform 和配置合并。mini 实现因此只证明数据流和失败保位，不能替代 LangChain 对追踪、并发、序列化和 provider 批量优化的生产保证。

## 导读

`prompt | model | parser` 看起来像 Python 运算符把几个对象串起来，实际需要回答更具体的问题：普通函数为什么能出现在链里？一个输入如何依次穿过每一步？batch 中第二个输入失败时，第三步是否还会看到它？如果只写一个 `for` 循环，很多值合同还能工作，但 Runnable 的异步、stream、callback 和异常保位都会丢失。

本课采用“先定义协议，再搭组合器”的心智模型。最小核心只有五块：可调用的 `invoke`/`ainvoke` 协议、把 callable 归一化为 Runnable、按顺序组合、对独立输入批处理、对输出流逐块转换。失败路径不是附加功能，它决定 batch 是否能在继续处理其他输入的同时保留原位置。

它是模块 01 的收束课。前面课程沿真实 LangChain 源码分别解释了消息、模型、Prompt、invoke、batch、config、callback、序列化和错误；本课把这些局部合同拼成可运行模型，后续模块可以在它上面加入 provider、tool 和 Agent，而无需把 Runnable 重新解释一遍。

## 分章正文

### 从管线现象进入

kicker: "01 · OBSERVE"

设有两个步骤：`strip` 去空格，`parse` 把文本转整数。组合后输入 `" 21 "` 得到 `21`；输入 `"oops"` 在 `parse` 处失败，后面的 `double` 不应启动。这个现象已经包含顺序、类型转换和失败短路三个合同。

#### 本章结论

一个可组合核心首先要让每一步的输入、输出和失败位置可观察。

### 定义 Runnable 的最小数据模型

kicker: "02 · MODEL"

把步骤建模为 `Step(name, invoke, ainvoke)`，把链建模为有序数组 `steps`。对单输入，不变量是 `steps[i+1]` 只接收 `steps[i]` 成功后的输出；对 batch，输出列表索引仍对应输入索引；对 stream，块只能从已到达的输入产生，不能伪造尚未得到的值。

```python
class Step:
    def __init__(self, invoke, ainvoke=None):
        self.invoke_fn = invoke
        self.ainvoke_fn = ainvoke

    def invoke(self, value):
        return self.invoke_fn(value)

    async def ainvoke(self, value):
        if self.ainvoke_fn is not None:
            return await self.ainvoke_fn(value)
        return self.invoke_fn(value)
```

这个模型故意没有 config、callback 和 schema；它只保留能预测值流的最小状态。完整 LangChain 则在同一接口上加入 RunnableConfig、callback manager 和类型 schema。

#### 本章结论

最小实现的核心是不变量，不是类名；生产实现的额外状态必须能回指到某个真实合同。

### 从 callable 到 sequence

kicker: "03 · COMPOSE"

LangChain 的 `|` 运算符先调用 `coerce_to_runnable`：已有 Runnable 原样返回，callable 变成 `RunnableLambda`，生成器变成 `RunnableGenerator`，dict 变成 `RunnableParallel`。这一步让后续组合不必为每种对象写一套调用代码。

mini 实现可以只支持 callable 和已有 Step：

```python
def coerce(value):
    if isinstance(value, Step):
        return value
    if callable(value):
        return Step(value)
    raise TypeError("需要 Step 或 callable")

class Sequence:
    def __init__(self, *steps):
        self.steps = tuple(coerce(step) for step in steps)

    def invoke(self, value):
        for step in self.steps:
            value = step.invoke(value)
        return value
```

它只复现 `coerce_to_runnable` 的一部分，却保留了 `RunnableSequence` 的关键数据流：输入只沿有序步骤向前移动。

#### 本章结论

组合器的第一职责是归一化输入，第二职责才是调用；归一化失败应在建链或首次调用时可见。

### 加入 async、batch 和 stream

kicker: "04 · MULTI"

单输入 async 路径逐步 await 每个步骤。batch 处理一组互相独立的输入，默认输出按输入顺序返回；`batch_as_completed` 才把完成顺序暴露给调用者。stream 则是另一种合同：组件实现 `transform` 时可以让块继续穿过链，组件缺少 transform 时会先缓冲输入。

因此“异步”“批量”“流式”不是同一个开关。一个步骤可能支持 `ainvoke` 却只在最后一次性输出，也可能支持 `stream` 却不提供 provider 原生 batch。

#### 本章结论

每种入口都有自己的可观察合同：await 关心等待，batch 关心索引，stream 关心块和缓冲边界。

### 失败输入如何保持位置

kicker: "05 · FAILURE"

对 `batch(["ok", "bad", "fine"], return_exceptions=True)`，第一步若让中间输入失败，后续步骤只接收 `ok` 和 `fine`，但最终列表仍应是 `[result0, error1, result2]`。LangChain 的 sequence 用失败索引集合追踪剩余输入，结束时按原配置顺序把异常插回去。若 `return_exceptions=False`，遇到异常则向调用者抛出，不承诺其他输入的外部副作用已经撤销。

测试不能只断言列表长度，还要检查失败输入没有进入后续步骤，成功输入没有被错误重排。

#### 本章结论

batch 的错误语义同时包含“谁失败”和“谁继续”，原索引是恢复结果含义的必要证据。

### 从教学核心走向工程实现

kicker: "06 · ENGINEERING"

变体 A 是协议优先：先实现 `Step`、`Sequence` 和失败保位，再逐步加入 async、stream 和 callback。它适合教学、单元测试和没有第三方依赖的实验，边界透明但功能有限。

变体 B 是组合优先：直接使用官方 `RunnableLambda`、`RunnableSequence` 和 `RunnableParallel`，把自定义逻辑放进 Runnable。它能立即获得追踪、schema、配置传播和生态兼容，却需要理解线程池回退、异步实现、序列化和 provider 的覆盖点。

真实工程还要决定 batch 是否应覆盖为 provider 原生批量 API、stream 是否会被某个 blocking transform 截断、失败输入是否允许重试，以及 callback 观察是否需要脱敏。mini 核心不能替这些决策背书。

#### 本章结论

最小实现用来验证不变量，官方组合器用来承接生产能力；两者之间的差距必须在代码和文档中标出来。

## 核心机制

- `coerce_to_runnable` 把 Runnable、callable、generator 和 dict 归一化到不同 Runnable 实现。
- `RunnableSequence` 依次把前一步输出交给后一步，并为每步建立 child callback 上下文。
- sequence 的 batch 按组件逐步处理，失败输入可以被过滤，最后按原索引重组。
- stream 依赖 `transform/atransform`；没有 transform 的步骤会先缓冲，不能承诺首块立即到达。

## 常见误区

- 认为 `|` 只是语法糖，忽略 callable、generator 和 dict 会进入不同的 Runnable 包装器。
- 把 batch 当成并行 map 后直接丢弃输入索引，导致失败和完成顺序混淆。
- 看到链支持 `astream` 就认为每一个中间步骤都能增量处理，忽略 blocking transform 的缓冲。
- 用 mini 核心的返回值证明生产版的 callback、schema、配置和 provider 优化已经存在。

## 实现变体

### 变体 A：协议优先的 mini 核心

useWhen: "需要教学、离线单测或先验证值流和失败不变量时。"
tradeoff: "依赖少、边界透明；没有真实 callback、schema、配置传播和 provider batch 优化。"

#### 代码

```python
class Step:
    def __init__(self, function):
        self.function = function

    def invoke(self, value):
        return self.function(value)

pipeline = Step(str.strip)
assert pipeline.invoke(" x ") == "x"
```

### 变体 B：官方 Runnable 组合

useWhen: "需要接入 LangChain tracing、RunnableConfig、schema 或 provider 集成时。"
tradeoff: "获得生态能力和统一入口；需要接受真实实现的异步、线程池、callback 与版本边界。"

#### 代码

```python
from langchain_core.runnables import RunnableLambda

pipeline = RunnableLambda(str.strip) | RunnableLambda(int)
assert pipeline.invoke(" 21 ") == 21
assert pipeline.batch([" 1 ", " 2 "]) == [1, 2]
```

## 可运行示例

```python
import asyncio
from collections.abc import Awaitable, Callable, Iterable


class Step:
    def __init__(
        self,
        function: Callable[[object], object],
        async_function: Callable[[object], Awaitable[object]] | None = None,
    ) -> None:
        self.function = function
        self.async_function = async_function

    def invoke(self, value: object) -> object:
        return self.function(value)

    async def ainvoke(self, value: object) -> object:
        if self.async_function is not None:
            return await self.async_function(value)
        return self.function(value)

    def stream(self, value: object) -> Iterable[object]:
        yield self.invoke(value)


class Sequence:
    def __init__(self, *steps: Step | Callable[[object], object]) -> None:
        self.steps = tuple(
            step if isinstance(step, Step) else Step(step) for step in steps
        )

    def invoke(self, value: object) -> object:
        for step in self.steps:
            value = step.invoke(value)
        return value

    async def ainvoke(self, value: object) -> object:
        for step in self.steps:
            value = await step.ainvoke(value)
        return value

    def batch(
        self, values: list[object], return_exceptions: bool = False
    ) -> list[object]:
        outputs: list[object] = []
        for value in values:
            try:
                outputs.append(self.invoke(value))
            except Exception as error:
                if not return_exceptions:
                    raise
                outputs.append(error)
        return outputs

    def stream(self, value: object) -> Iterable[object]:
        yield self.invoke(value)


async def async_add_one(value: object) -> object:
    await asyncio.sleep(0)
    return int(value) + 1


pipeline = Sequence(
    Step(str.strip),
    Step(int, async_add_one),
    Step(lambda value: int(value) * 2),
)
assert pipeline.invoke(" 20 ") == 40
assert asyncio.run(pipeline.ainvoke(" 20 ")) == 42
assert pipeline.batch([" 1 ", " 2 "]) == [2, 4]
assert list(pipeline.stream(" 3 ")) == [6]

failed = pipeline.batch([" 4 ", "oops", " 5 "], return_exceptions=True)
assert failed[0] == 8 and isinstance(failed[1], ValueError) and failed[2] == 10

try:
    pipeline.batch([" 4 ", "oops"])
except ValueError:
    pass
else:
    raise AssertionError("默认 batch 必须传播第一个失败")

print("mini LangChain core: ok")
```

示例用最小 `Step`/`Sequence` 重现真实源码中的值流、双入口、batch 错误保位和 stream 入口。它特意把 batch 实现为可读的顺序版本，省略线程池、`max_concurrency`、callback、schema、`return_exceptions` 的跨步骤过滤优化和 provider 原生 batch；这些差异正是搭积木后必须回到上游源码核对的内容。

## 搭积木复现

### 积木 1：定义最小 Step

让 Step 保存一个函数并提供 `invoke`，先断言成功值和异常不会被吞掉。

### 积木 2：加入 async 入口

为 Step 增加 `ainvoke`；有原生异步函数就等待它，否则先复用同步函数，并记录这只是教学回退。

### 积木 3：实现 callable 归一化

让 Sequence 接受 Step 或普通 callable，拒绝整数等未知对象，映射 `coerce_to_runnable` 的失败分支。

### 积木 4：实现有序组合

逐步把输出交给下一步，注入中间失败并断言后续步骤没有启动。

### 积木 5：实现 batch 与失败保位

对每个输入保留原索引；`return_exceptions=True` 时继续处理其他输入，最终把异常插回原位置。

### 积木 6：实现 stream，再对照上游

先提供单块 stream，随后阅读 `RunnableSequence._transform` 和 `RunnableLambda._transform`，标出真实实现何时能逐块流动、何时必须缓冲。

## 自检

### 问题

为什么 `RunnableSequence.batch()` 不能简单地把每个输入完整跑完后再拼接结果？当第二个输入在中间步骤失败、并且 `return_exceptions=True` 时，真实实现需要保留哪些信息？

### 站内答案

结论：完整逐输入执行虽然能得到值，却失去组件级 batch 优化、失败输入过滤和 callback 的逐步归属；真实实现必须保留原输入索引、当前仍成功的输入、失败异常和每个 root run 的上下文。机制：`RunnableSequence.batch` 按组件循环，把当前成功输入批量交给下一步；失败索引放进 `failed_inputs_map`，后续步骤只处理剩余输入，最后按 `configs` 的原顺序将异常插回。源码证据是固定 commit 的 `base.py` 第 3493–3619 行；上游测试第 4251–4335 行明确断言失败输入被后续步骤过滤、成功输入的输出仍保持原位置。验证方法：用 `["ok", "bad", "fine"]` 注入只在第二输入失败的步骤，检查第二步收到的列表不含 `bad`，最终结果的第二格仍是异常；再用 `return_exceptions=False` 断言异常向上抛出。工程取舍：教学实现可先用顺序循环保持清晰，生产实现应使用组件的 batch/abatch、`max_concurrency`、callback 和 provider 原生批处理；失败输入若已经产生外部副作用，保位不等于回滚，仍要用幂等或补偿。适用边界：独立输入适合 batch；有依赖的步骤仍需顺序组合，首块实时性还要由 transform 能力单独验证。

## 更新日志

### 深化最小核心复现与组合失败保位

at: "2026-08-03T22:15:00+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "Codex Desktop · gpt-5.6-luna"
summary: "补齐 callable 归一化、顺序组合、batch 失败保位、stream 缓冲边界，并加入可运行 mini 核心和 flow 视觉索引。"
