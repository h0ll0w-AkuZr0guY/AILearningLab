---
id: "langchain-01-06"
track: "langchain"
title: "batch 与 stream"
depth: "deep"
visualIndex: "../visuals/langchain-01-06.md"
exampleLanguage: "python"
readingMinutes: 25
sourceMinutes: 8
practiceMinutes: 10
reviewMinutes: 2
---

## 官方入口

title: "LangChain Models · Invocation"
url: "https://docs.langchain.com/oss/python/langchain/models#invocation"

官方章节把 `invoke`、`stream` 和 `batch` 分成三种不同的调用形态：单次调用返回完整结果，流式调用逐步产生 chunk，批量调用处理一组相互独立的输入。该页还明确说明 LangChain 的 `batch` 默认是客户端并行，不等于 provider 自己提供的 batch API；`batch_as_completed` 的结果可能乱序，必须依靠输入索引重建顺序。本文以 `langchain-core` v1.4.8 对应的源码提交为边界，不把某个 provider 的批量计费或 token 合并能力泛化到 Runnable 层。

## 真实源码

repo: "langchain-ai/langchain"
file: "libs/core/langchain_core/runnables/base.py"
symbol: "Runnable.batch / Runnable.batch_as_completed / Runnable.stream"
language: "python"
url: "https://github.com/langchain-ai/langchain/blob/725489f135458c37c668919b0d08652ebd04f131/libs/core/langchain_core/runnables/base.py#L919-L1052"

### 逐段讲解

- `batch` 先把一份 config 展开成与输入等长的配置列表，再在多输入时用 executor 并行调用 `invoke`；因此返回列表仍按输入顺序排列。
- `max_concurrency` 通过 `get_executor_for_config` 限制并行度；默认实现适合 IO-bound Runnable，能够真正批量请求的子类应覆盖它。
- `batch_as_completed` 为每个输入提交 future，在 `FIRST_COMPLETED` 条件下产出 `(index, output)`；完成顺序和输入顺序是两种不同的序。
- `return_exceptions` 把单个失败变成结果槽里的异常对象，但它不会把失败变成成功，也不会回滚其他已经开始的调用。
- 基类 `stream` 只 `yield self.invoke(...)` 一次；只有子类实现了 chunk 生产，流式 API 才有比完整结果更早的可观察输出。

### 源码节选

```python
def batch(self, inputs, config=None, *, return_exceptions=False, **kwargs):
    if not inputs:
        return []
    configs = get_config_list(config, len(inputs))

    def invoke(input_, config):
        if return_exceptions:
            try:
                return self.invoke(input_, config, **kwargs)
            except Exception as e:
                return e
        return self.invoke(input_, config, **kwargs)

    if len(inputs) == 1:
        return [invoke(inputs[0], configs[0])]
    with get_executor_for_config(configs[0]) as executor:
        return list(executor.map(invoke, inputs, configs))

def batch_as_completed(self, inputs, config=None, *, return_exceptions=False, **kwargs):
    configs = get_config_list(config, len(inputs))
    # future 完成就产出，但 index 仍回指原输入位置。
    ...
```

节选保留了输入为空、单输入、并行、异常槽和索引回指，省略了类型重载、异步版本与 executor 的实现。因而它不能证明 provider 一定支持服务端批量，也不能据此推断取消已经运行的远程请求。

## 导读

“我有十个问题，想快一点处理”看起来只需要把 `invoke` 放进循环。问题在于三个观察目标容易混在一起：批量关心的是一组任务的完成契约，流式关心的是一个结果的中间可见性，`batch_as_completed` 关心的是吞吐和首个结果之间的取舍。如果把它们都当成“返回一个列表”，就会丢掉顺序、背压和失败定位。

本课建立一个可计算模型：输入索引 `i` 是身份，结果序列位置是交付顺序，chunk 序列是单个结果的增量表示。`batch` 应保持 `output[i]` 对应 `input[i]`；`batch_as_completed` 允许按完成时间交付，但必须返回 `i`；`stream` 只有在子类能产出中间 chunk 时才降低首字节等待。三者是同一 Runnable 合同的不同观察面。

本课紧接 `langchain-01-05` 的单次 `invoke`，只扩展执行形态，不讨论 provider 的真实 token batching。后续的 config 与 callback 课程再解释这些调用如何携带追踪和资源上限；这里先把输入、顺序和失败槽说清楚。

## 分章正文

### 从等待时间看出调用形态

kicker: "01 · OBSERVE"

假设三个输入分别耗时 0.30、0.05、0.10 秒。顺序循环约需 0.45 秒；并行批处理接近最慢任务的 0.30 秒；按完成时间消费时，第二个输入可以在 0.05 秒附近先被展示。三个数字回答的是不同问题：总完成时间、返回顺序和首个可见结果不能互相替代。

#### 本章结论

先写下调用者要优化的量，再选择 `batch`、`batch_as_completed` 或 `stream`；“更快”没有脱离交付契约的独立含义。

### 建立索引与顺序不变量

kicker: "02 · MODEL"

把输入写成 `[(0, a), (1, b), (2, c)]`。`batch` 的输出必须是 `[f(a), f(b), f(c)]`，即使 b 先完成；`batch_as_completed` 可以输出 `(1, f(b)), (2, f(c)), (0, f(a))`。如果 UI 直接把后者追加到原列表，用户会误以为结果顺序改变了输入语义。

#### 代码

```python
completed = [(1, "B"), (2, "C"), (0, "A")]
ordered = [None] * 3
for index, value in completed:
    ordered[index] = value
assert ordered == ["A", "B", "C"]
assert [value for _, value in completed] != ordered
```

#### 本章结论

输入索引是 `batch_as_completed` 的关联键；完成顺序不能承担身份。

### 沿 Runnable 源码走一遍

kicker: "03 · SOURCE"

源码先用 `get_config_list` 把一份配置复制到每个输入，再定义一个局部 `invoke` 函数处理 `return_exceptions`。多输入时 `executor.map` 保持 map 的输入次序，所以 `batch` 有并行执行却仍按输入顺序交付。`batch_as_completed` 则把索引一起提交，在 `FIRST_COMPLETED` 循环中弹出已完成 future。基类 `stream` 仅调用一次 `invoke`，这解释了为什么一个普通 Runnable 的“stream”可能只有一个完整值。

#### 本章结论

顺序保证来自 `executor.map` 的收集方式，乱序交付来自 future 完成事件，流式能力来自子类的 `stream/transform` 实现。

### 处理异常、空输入与限流

kicker: "04 · FAILURE"

空输入直接返回空列表，不会虚构一次调用。默认 `return_exceptions=False` 时某个 invoke 抛错会使批量收集抛出异常；打开它后，该输入的位置放入异常对象，其他成功结果保留。生产代码必须同时记录输入索引和异常类型，不能用 `str(exception)` 覆盖原始结果类型。

`max_concurrency` 是并行度上限，不是 provider 速率限制的完整实现。它能限制本地同时启动的 Runnable 数，但不能替代令牌桶、重试退避、请求超时和供应商配额；过大的 batch 仍可能占住内存。

#### 本章结论

批量失败是逐项或整体的交付策略，限流是资源策略；两者必须分别测试。

### stream 的 chunk 合并合同

kicker: "05 · STREAM"

对文本流，学习者可以把 `AIMessageChunk` 逐个相加恢复完整消息；这依赖 chunk 的类型与加法合同。对 JSON、tool call 或多模态块，不能直接字符串拼接，必须按 block id、字段和结束状态聚合。默认 `Runnable.stream` 只产生一个最终值，因此只有明确支持 `transform` 或 provider streaming 的实现才应把 UI 做成增量渲染。

#### 本章结论

流式 UI 的正确性来自可结合的 chunk 合并规则；“打印得更早”不等于“可以随意拼接”。

### 两种实现变体的边界

kicker: "06 · ENGINEERING"

变体一是 `batch` 后按输入顺序渲染，适合需要稳定表格、批量评测和可重复 diff 的场景。变体二是 `batch_as_completed` 后按索引写回，适合长短任务混合且希望尽快展示部分结果的场景。第三种常见组合是单输入 `stream`，适合聊天界面，但它需要处理用户离开页面、消费者变慢和半成品撤回。

#### 本章结论

固定顺序便于可比性，完成顺序便于响应性，chunk 流便于低首字节延迟；选择由下游消费合同决定。

### 用断言验证时间与身份

kicker: "07 · VERIFY"

测试不应只比较最终字符串。至少应断言：`batch` 的结果长度与输入长度相同；每个位置仍对应同一输入；`batch_as_completed` 的 index 集合恰好是 `range(n)`；失败输入不会伪装成成功值；stream 聚合后等于 invoke 的完整结果。若测试依赖线程实际完成的先后，应给 fake runnable 注入事件，而不是靠睡眠碰运气。

#### 本章结论

批量测试验证身份和异常归属，流式测试验证 chunk 序列与最终聚合；延迟只作为观测数据，不作为唯一正确性断言。

## 核心机制

- `batch` 默认并行 invoke，但按输入顺序收集结果。
- `batch_as_completed` 按完成顺序产出 `(index, result)`，索引是稳定身份。
- `stream` 的默认实现只产生一次 invoke 结果，真实增量需要子类覆盖。
- `return_exceptions`、`max_concurrency` 与 provider 级批量/限流属于不同层次的合同。

## 常见误区

- 看到 batch 就以为请求合并成了一次 provider API 调用；默认实现只是本地并行。
- 把 `batch_as_completed` 的产出顺序当成输入顺序，导致结果错配。
- 把结构化 chunk 用字符串累加，丢失 tool call 或多模态字段的边界。
- 用延迟排序代替索引关联；相同延迟下会产生非确定性。

## 实现变体

### 变体 A：稳定顺序批处理

useWhen: "批量评测、离线导出和结果必须与输入表逐行对齐时。"
tradeoff: "收集端容易推理；最短任务要等待最长任务后统一交付。"

#### 代码

```python
def stable_batch(fn, inputs):
    return [fn(item) for item in inputs]

assert stable_batch(lambda x: x.upper(), ["a", "b"]) == ["A", "B"]
```

### 变体 B：完成即交付并写回

useWhen: "任务耗时差异大，界面希望尽早展示已完成结果时。"
tradeoff: "首个结果更早；消费者必须保存 index，且要处理部分失败和取消。"

#### 代码

```python
def collect_as_completed(completed, size):
    result = [None] * size
    errors = {}
    for index, value in completed:
        if isinstance(value, Exception):
            errors[index] = value
        else:
            result[index] = value
    return result, errors

values, errors = collect_as_completed([(1, "B"), (0, "A")], 2)
assert values == ["A", "B"] and errors == {}
```

## 可运行示例

```python
from concurrent.futures import ThreadPoolExecutor, as_completed
import time

def work(item):
    delay, value = item
    time.sleep(delay)
    if value == "bad":
        raise ValueError("bad input")
    return value.upper()

inputs = [(0.03, "slow"), (0.01, "fast"), (0.02, "bad")]

with ThreadPoolExecutor(max_workers=3) as pool:
    futures = {pool.submit(work, item): index for index, item in enumerate(inputs)}
    completed = []
    for future in as_completed(futures):
        index = futures[future]
        try:
            completed.append((index, future.result()))
        except Exception as error:
            completed.append((index, error))

assert {index for index, _ in completed} == {0, 1, 2}
ordered = [None] * len(inputs)
for index, value in completed:
    ordered[index] = value
assert ordered[0] == "SLOW"
assert ordered[1] == "FAST"
assert isinstance(ordered[2], ValueError)

try:
    work((0, "bad"))
except ValueError as error:
    assert str(error) == "bad input"
else:
    raise AssertionError("failure path was not exercised")
```

这段示例只模拟 Runnable 的默认并行语义，不模拟 provider 的服务端 batch；正常断言验证索引和顺序，失败断言验证异常仍归属于原输入。

## 搭积木复现

### 积木 1：定义带索引的输入

为每个输入生成稳定 index，先证明输入数量和 index 集合一致。

### 积木 2：实现稳定顺序 batch

并发执行后按原列表收集，加入重复输入和空输入断言。

### 积木 3：实现完成即交付

用 future 完成事件产出 `(index, value)`，故意让短任务先完成，断言产出顺序和输入顺序不同。

### 积木 4：加入失败槽

分别运行抛异常和 `return_exceptions=True` 两种模式，断言失败没有覆盖其他 index。

### 积木 5：加入流式聚合

让一个输入产生三个字符串 chunk，测试增量显示与最终拼接一致；再让一个 chunk 类型错误，明确拒绝静默拼接。

## 自检

### 问题

为什么 `batch_as_completed` 必须返回输入索引？如果只返回完成值，怎样构造一个必然会错配的失败测试？

### 站内答案

结论是索引承担输入身份，完成顺序只承担交付时机。机制上，源码为每个输入提交 future，并在完成时返回 `(i, out)`；`batch` 通过 `executor.map` 保持输入顺序，而 `batch_as_completed` 明确放弃这一顺序。源码证据是 `base.py` 的 `get_config_list`、`enumerate(zip(...))` 和 `yield done.pop().result()` 路径。验证时让输入 0 睡眠更久、输入 1 立即返回，然后把没有索引的完成值按输入顺序写回；断言输入 0 的预期值与收到的第一个值不相等，测试即可稳定暴露错配。工程上，结果应保存 index、状态、异常和耗时；适用边界是所有并行结果都必须回到原请求时，不能用完成序列位置代替 index。

## 更新日志

### 建立 batch、完成即交付与 stream 的执行契约

at: "2026-08-02T20:41:41+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "Codex · gpt-5.6-luna"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/31"
commit: "f54f99b04b070443bb7b097ffe9f0bcac85f753c"
summary: "新增 batch、batch_as_completed 与 stream 的顺序、失败和 chunk 合并课程，配套源码证据、示例和 flow 视觉索引。"
