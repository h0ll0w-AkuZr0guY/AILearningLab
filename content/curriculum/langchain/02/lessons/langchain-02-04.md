---
id: "langchain-02-04"
track: "langchain"
title: "stream、batch 与自动流式"
depth: "deep"
exampleLanguage: "python"
readingMinutes: 25
sourceMinutes: 10
practiceMinutes: 10
reviewMinutes: 5
visualIndex: "../visuals/langchain-02-04.md"
---

## 官方入口

title: "LangChain Models · Stream and Batch"
url: "https://docs.langchain.com/oss/python/langchain/models#stream"

官方 Models 章节把 `invoke`、`stream`、`batch` 和 `batch_as_completed` 分成不同使用合同：`stream` 产出 chunks，`batch` 默认并行独立请求并保持输入顺序，`batch_as_completed` 产出带输入索引的完成结果。文档也说明 chat model 可以在整体应用进入流式模式时自动走内部流式路径，但这不等于每个中间 Runnable 都能立即产生 chunk。

补充入口：[Models · Batch](https://docs.langchain.com/oss/python/langchain/models#batch) 与 [Models · Invocation](https://docs.langchain.com/oss/python/langchain/models#invocation)。它们描述公开行为；是否有 provider 原生 batch、是否回退到线程池和何时缓冲，仍以固定源码为准。

## 真实源码

repo: "langchain-ai/langchain"
file: "libs/core/langchain_core/language_models/chat_models.py"
symbol: "BaseChatModel._streaming_disabled / _generate_with_cache / _stream / _astream"
language: "python"
url: "https://github.com/langchain-ai/langchain/blob/c318abed446e7d1a0e872a6967b9b17bc6f4761c/libs/core/langchain_core/language_models/chat_models.py#L513-L535"

### 其他固定证据

- Runnable 的默认 `batch` 使用线程池，`return_exceptions` 决定失败是抛出还是保留在结果中：[runnables/base.py#L919-L967](https://github.com/langchain-ai/langchain/blob/c318abed446e7d1a0e872a6967b9b17bc6f4761c/libs/core/langchain_core/runnables/base.py#L919-L967)。
- Runnable 的默认 `batch_as_completed` 返回 `(index, result)`，完成顺序可以不同：[runnables/base.py#L989-L1052](https://github.com/langchain-ai/langchain/blob/c318abed446e7d1a0e872a6967b9b17bc6f4761c/libs/core/langchain_core/runnables/base.py#L989-L1052)。
- Runnable 默认 `stream` 只调用一次 `invoke`，默认 `transform` 会先缓冲输入：[runnables/base.py#L1182-L1201](https://github.com/langchain-ai/langchain/blob/c318abed446e7d1a0e872a6967b9b17bc6f4761c/libs/core/langchain_core/runnables/base.py#L1182-L1201)、[runnables/base.py#L1748-L1785](https://github.com/langchain-ai/langchain/blob/c318abed446e7d1a0e872a6967b9b17bc6f4761c/libs/core/langchain_core/runnables/base.py#L1748-L1785)。
- BaseChatModel 的测试验证 `_astream`/`_stream` 回退和 `disable_streaming` 分支：[test_base.py#L238-L357](https://github.com/langchain-ai/langchain/blob/c318abed446e7d1a0e872a6967b9b17bc6f4761c/libs/core/tests/unit_tests/language_models/chat_models/test_base.py#L238-L357)、[test_base.py#L533-L640](https://github.com/langchain-ai/langchain/blob/c318abed446e7d1a0e872a6967b9b17bc6f4761c/libs/core/tests/unit_tests/language_models/chat_models/test_base.py#L533-L640)。

### 逐段讲解

- `Runnable.batch` 的默认语义是并发调用 `invoke`，适合 IO-bound 组件；能使用 provider 原生批处理的子类可以覆盖它。
- `batch_as_completed` 故意暴露完成顺序，同时携带原输入索引；这两个维度不能互相替代。
- `Runnable.stream` 默认只产生一次完整结果；真正逐块输出必须由子类覆盖 `stream`/`_stream` 或实现 transform 链。
- BaseChatModel 用 `disable_streaming`、callback handler、`stream` 参数和 `_stream` 是否实现共同决定是否走流式；自动流式最后仍要汇合成正常 ChatResult。

### 源码节选

```python
def batch(self, inputs, config=None, *, return_exceptions=False, **kwargs):
    configs = get_config_list(config, len(inputs))
    def invoke(input_, config):
        if return_exceptions:
            try:
                return self.invoke(input_, config, **kwargs)
            except Exception as e:
                return e
        return self.invoke(input_, config, **kwargs)
    with get_executor_for_config(configs[0]) as executor:
        return list(executor.map(invoke, inputs, configs))

def stream(self, input, config=None, **kwargs):
    yield self.invoke(input, config, **kwargs)

def transform(self, input, config=None, **kwargs):
    # default implementation buffers input, then calls stream
    ...
```

`BaseChatModel._generate_with_cache` 还会在 callback 触发整体流式时读取 `_stream`，累积 chunks，再通过 `generate_from_stream` 形成 ChatResult。示例只复现分派状态，不声称能模拟 callback v2 或 provider 原生 batch。

## 导读

### “支持 stream”到底承诺了什么

一个模型暴露 `stream()` 只说明调用者可以迭代某种输出；它没有自动承诺首块立即到达、所有中间步骤都能增量处理，或 provider 使用了原生 batch API。默认 Runnable 的 `stream` 可以把完整 `invoke` 结果包成一个元素，默认 transform 还可能先把上游输入缓冲完。

把三个轴分开更容易调试：时间轴看 chunk 是否逐步出现；并发轴看多个独立输入是否并行；策略轴看整体 callback 是否让 `invoke` 内部采用 streaming。它们都可能作用于同一个 ChatModel，却由不同分支控制。

## 分章正文

### 从可观察现象建立问题

kicker: "01 · OBSERVE"

对一个 fake model：

```text
invoke("a")             → 一个完整 Message
stream("a")             → [chunk-a, chunk-b, ...] 或 [完整 Message]
batch(["a", "b"])       → [result-a, result-b]
batch_as_completed(...) → (index, result) 按完成时间到达
```

即使 `batch_as_completed` 先返回索引 1，`batch` 仍应把结果放回输入索引 1 的位置。若中间 Runnable 没有 transform，整体流式可能在它之后才重新开始产生块。

#### 本章结论

流式是块的合同，batch 是输入集合的合同，完成顺序与结果顺序必须分别记录。

### 建立数据模型与不变量

kicker: "02 · MODEL"

定义：

```text
Stream = Iterator[Chunk]
Batch = list[Input] → list[Output]
AsCompleted = list[Input] → Iterator[(original_index, Output | Exception)]
```

不变量：

1. `batch` 输出位置与输入位置一致，除非调用者明确使用 as-completed 接口。
2. `batch_as_completed` 的 index 是重建输入对应关系的唯一证据，不能只按到达顺序 append。
3. 默认 `stream` 至少产生一次结果，但逐块实时性需要具体实现或 transform 证据。
4. `return_exceptions=True` 改变的是失败的返回形式，不会回滚已经发生的外部副作用。

#### 本章结论

先写清输出索引和失败所有权，才能讨论“更快”或“更实时”。

### 沿真实源码走一遍主路径

kicker: "03 · SOURCE"

Runnable 的默认 batch 通过 executor.map 运行 `invoke`，因此 IO-bound 组件可以获得并发；子类若有 provider 原生 batch 可覆盖这一入口。BaseChatModel 的 `_generate_with_cache` 在 explicit stream、callback 触发的 implicit stream 与普通 `_generate` 间分派。`disable_streaming=True` 或 tool calling 规则命中时，stream 会退回 invoke。

`transform` 的默认实现收集输入块，再调用 stream；这解释了“链有 astream，但首个 token 很晚”的常见现象：上游或中间步骤可能先缓冲。

#### 本章结论

LangChain 的统一入口提供回退合同，真实实时性要沿具体 override 和 transform 路径检查。

### 补齐失败路径与边界

kicker: "04 · FAILURE"

- `_stream` 未实现时，模型不能凭空提供 provider 原生 chunk；应走 invoke 回退或暴露明确限制。
- `disable_streaming="tool_calling"` 且调用带 tools 时，流式被禁用，以免工具调用 chunk 不完整。
- batch 中一个输入失败时，默认传播异常；`return_exceptions=True` 才把异常放回对应位置。
- as-completed 的完成顺序不稳定，测试不能硬编码线程调度顺序，只能核对索引集合和结果映射。

线程池、网络限流和 provider 的批量 endpoint 都可能改变吞吐。没有基准和固定输入，不能从“并发”推导具体性能倍数。

#### 本章结论

回退路径是接口合同的一部分；性能和实时性必须以执行路径和实验数据为证据。

### 从教学实现走向工程取舍

kicker: "05 · ENGINEERING"

教学实现可以用列表和顺序循环模拟 stream/batch，重点检查状态和索引。生产代码需要考虑 `max_concurrency`、取消、超时、速率限制、provider 原生 batch、chunk 合并和 callback 脱敏。

当结果必须按输入顺序保存到数据库时使用 `batch`；当用户界面希望先显示完成的结果时使用 `batch_as_completed`，同时把 index 带到写入层。需要首块低延迟时，审查每个中间 Runnable 的 transform，而不要只看最外层方法名。

测量流式时至少记录首块时间、最后一块时间、块数和完整拼接结果；测量 batch 时记录输入索引、并发上限、成功/失败数量和外部副作用次数。这样可以区分“输出更早”与“总耗时更短”，也能发现失败被重试后是否产生重复写入。测试中使用短字符串和 fake provider 只能验证控制流，不应把它们转换成真实网络吞吐结论。

#### 本章结论

入口的选择应由可观察交付需求决定：顺序、首块延迟、并发上限和失败恢复各自有不同证据。

## 核心机制

- 默认 batch 是 executor 并发 invoke，provider 原生批量需子类显式覆盖。
- batch 与 as-completed 的区别是结果顺序与完成顺序的合同，不是一个更快一个更慢的简单别名。
- 默认 stream 可以只产生一个完整结果，transform 默认缓冲。
- BaseChatModel 的 streaming disabled 条件可让显式 stream、callback 触发的 stream 回退到 invoke。

## 常见误区

- 看到 `stream()` 就断言一定逐 token 输出。
- 把 `batch_as_completed` 的到达顺序直接当数据库结果顺序。
- 认为 `return_exceptions=True` 会撤销失败请求之前的外部副作用。
- 没有固定 provider、输入规模和并发上限就写“批处理快 N 倍”。

## 实现变体

### 变体 A：统一回退实现

useWhen: "模型没有 provider 原生 batch/stream，先保证 Runnable 合同和可测试性。"
tradeoff: "实现简单、行为可预测；实时性和吞吐受 invoke/线程池回退限制。"

#### 代码

```python
class FallbackModel:
    def invoke(self, value):
        return value.upper()

    def stream(self, value):
        yield self.invoke(value)

    def batch(self, values):
        return [self.invoke(value) for value in values]
```

### 变体 B：provider 能力覆盖

useWhen: "provider 有真实 stream 或 batch endpoint，且已用测试固定结果语义。"
tradeoff: "吞吐/首块延迟更好；要维护 provider-specific 参数、取消和错误映射。"

#### 代码

```python
class NativeModel(FallbackModel):
    def stream(self, value):
        for token in self.invoke(value).split():
            yield token
```

## 可运行示例

```python
from time import sleep


class FakeModel:
    def invoke(self, value: str) -> str:
        if value == "bad":
            raise ValueError("fake failure")
        return value.upper()

    def stream(self, value: str):
        result = self.invoke(value)
        for token in result:
            yield token

    def batch(self, values: list[str], return_exceptions: bool = False):
        outputs = []
        for value in values:
            try:
                outputs.append(self.invoke(value))
            except Exception as error:
                if not return_exceptions:
                    raise
                outputs.append(error)
        return outputs

    def batch_as_completed(self, values: list[str]):
        # Deliberately emit reverse order to expose index semantics.
        for index in reversed(range(len(values))):
            try:
                yield index, self.invoke(values[index])
            except Exception as error:
                yield index, error


model = FakeModel()
assert list(model.stream("ok")) == list("OK")
assert model.batch(["a", "b"]) == ["A", "B"]

failed = model.batch(["a", "bad", "c"], return_exceptions=True)
assert failed[0] == "A" and isinstance(failed[1], ValueError) and failed[2] == "C"

completed = list(model.batch_as_completed(["a", "b"]))
assert [index for index, _ in completed] == [1, 0]
assert {index: value for index, value in completed} == {0: "A", 1: "B"}

try:
    model.batch(["a", "bad"])
except ValueError:
    pass
else:
    raise AssertionError("默认 batch 必须传播失败")

print("stream and batch contracts: ok")
```

示例用确定性的逆序完成模拟 as-completed，不声称真实线程池会固定逆序；真实系统的关键是携带 index，而非某一种调度顺序。

## 搭积木复现

### 积木 1：实现单次 invoke

先让 fake model 对一个字符串返回一个完整结果，并测试失败输入。

### 积木 2：实现单块 stream

先把完整结果作为一个 chunk，再说明这对应 Runnable 默认回退，不是 token streaming。

### 积木 3：实现真实 chunk stream

按字符或 token 拆分结果，写断言验证拼接后等于 invoke。

### 积木 4：实现 batch 保位

按输入顺序收集结果；开启 return_exceptions 后保留失败索引。

### 积木 5：实现 as-completed

返回 `(index, result)`，刻意改变完成顺序，再通过字典重建原顺序。

### 积木 6：对照回退分支

阅读固定 commit 的 `Runnable.stream`、`Runnable.transform`、`BaseChatModel._streaming_disabled` 与测试，记录 `_astream` 复用同步实现时的线程/执行器成本。

## 自检

### 问题

为什么 `batch_as_completed` 必须返回输入索引？为什么最外层有 `astream` 仍不能保证首个 chunk 低延迟？

### 站内答案

结论：as-completed 的完成顺序可以与输入顺序不同，索引是把结果映射回原输入的唯一证据；首个 chunk 是否低延迟取决于具体 `_stream`/`_astream` 和中间 Runnable 的 transform，而不是最外层方法名。机制：默认 `Runnable.batch_as_completed` 在线程池 future 完成时 yield `(i, out)`；默认 `stream` 只 yield 一次 invoke 结果，默认 `transform` 会先收集输入再调用 stream；BaseChatModel 还会按 `disable_streaming`、tools、callback 和 `_stream` 能力选择回退。源码证据是固定 commit 的 `runnables/base.py#L919-L967`、`#L989-L1052`、`#L1182-L1201`、`#L1748-L1785` 与 `chat_models.py#L513-L535`。验证方法：运行示例检查 `batch` 保位、as-completed 索引和 stream 拼接；在真实链中逐个替换中间 Runnable，记录首块时间与是否实现 transform。工程取舍：统一回退简化适配和测试，provider 原生覆盖可改善吞吐/延迟但增加维护边界；任何性能结论都要固定输入、provider、并发和版本。适用边界：流式 chunks 不是自动回滚机制，batch 失败也不撤销已发出的外部请求。

## 更新日志

<!-- PR 前署名门禁通过后追加本批人类 × AI 记录。 -->

### 本批署名确认与执行模式深化

at: "2026-08-08T20:35:41+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "Codex Desktop · gpt-5.6-luna"
summary: "补齐显式与隐式流式、线程池 batch、as-completed 索引和 transform 缓冲回退，加入固定源码证据、失败断言和 flow 视觉。"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/44"
commit: "479d1622eb25722e57f76e0fa371f628b12e2ded"
