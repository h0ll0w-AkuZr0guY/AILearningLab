---
id: "langchain-01-11"
track: "langchain"
title: "同步异步双接口"
depth: "deep"
exampleLanguage: "python"
readingMinutes: 25
sourceMinutes: 8
practiceMinutes: 10
reviewMinutes: 2
visualIndex: "../visuals/langchain-01-11.md"
---

## 官方入口

title: "LangChain Models · Invocation"
url: "https://docs.langchain.com/oss/python/langchain/models#invocation"

官方 invocation 章节把 `invoke`、`stream` 和 `batch` 放在同一个模型接口下；其中 `invoke` 产出完整结果，`stream` 产出逐块结果，`batch` 处理相互独立的输入。Runnable API reference 进一步规定了 `ainvoke`、`abatch` 和 `astream` 的异步对应关系。本文以 LangChain commit `725489f135458c37c668919b0d08652ebd04f131` 为版本边界，专门解释同步入口、异步入口和两者的组合，不把“有 `async def`”误读为所有代码都已经非阻塞。

## 真实源码

repo: "langchain-ai/langchain"
file: "libs/core/langchain_core/runnables/base.py"
symbol: "Runnable.invoke / Runnable.ainvoke / RunnableLambda._ainvoke"
language: "python"
url: "https://github.com/langchain-ai/langchain/blob/725489f135458c37c668919b0d08652ebd04f131/libs/core/langchain_core/runnables/base.py#L873-L917"

### 其他固定证据

- `RunnableLambda` 的双实现说明与构造合同：[base.py#L4691-L4735](https://github.com/langchain-ai/langchain/blob/725489f135458c37c668919b0d08652ebd04f131/libs/core/langchain_core/runnables/base.py#L4691-L4735)。
- `_ainvoke` 选择 `afunc`，没有时用 `run_in_executor` 包住同步函数：[base.py#L5189-L5240](https://github.com/langchain-ai/langchain/blob/725489f135458c37c668919b0d08652ebd04f131/libs/core/langchain_core/runnables/base.py#L5189-L5240)。
- 只有 `func` 的 `RunnableLambda` 仍可 `astream`，异步测试验证同步函数会被桥接：[test_runnable.py#L4178-L4209](https://github.com/langchain-ai/langchain/blob/725489f135458c37c668919b0d08652ebd04f131/libs/core/tests/unit_tests/runnables/test_runnable.py#L4178-L4209)。

### 逐段讲解

- 抽象 `Runnable.invoke` 是单输入同步合同，`Runnable.ainvoke` 是异步合同；默认异步实现把同步 `invoke` 放进 executor。
- `RunnableLambda` 若同时收到 `func` 和 `afunc`，同步路径调用 `func`，异步路径调用 `afunc`；只有 `func` 时异步路径才退回线程池。
- `RunnableLambda` 的同步 `invoke` 遇到只有协程函数的实例会抛 `TypeError`，它不会偷偷启动一个新的事件循环。
- 异步路径如果返回另一个 Runnable，会继续用 `await output.ainvoke(...)`，并递减 `recursion_limit`，因此“返回 Runnable”仍然属于同一执行合同。

### 源码节选

```python
@abstractmethod
def invoke(
    self,
    input: Input,
    config: RunnableConfig | None = None,
    **kwargs: Any,
) -> Output:
    """Transform a single input into an output."""

async def ainvoke(
    self,
    input: Input,
    config: RunnableConfig | None = None,
    **kwargs: Any,
) -> Output:
    """Transform a single input into an output asynchronously."""
    return await run_in_executor(config, self.invoke, input, config, **kwargs)

def batch(
    self,
    inputs: list[Input],
    config: RunnableConfig | list[RunnableConfig] | None = None,
    *,
    return_exceptions: bool = False,
    **kwargs: Any | None,
) -> list[Output]:
    """Default implementation runs invoke in parallel."""
    if not inputs:
        return []
    configs = get_config_list(config, len(inputs))

    def invoke(input_: Input, config: RunnableConfig) -> Output | Exception:
        if return_exceptions:
            try:
                return self.invoke(input_, config, **kwargs)
            except Exception as error:
                return error
        return self.invoke(input_, config, **kwargs)

async def _ainvoke(
    self,
    value: Input,
    run_manager: AsyncCallbackManagerForChainRun,
    config: RunnableConfig,
    **kwargs: Any,
) -> Output:
    if hasattr(self, "afunc"):
        afunc = self.afunc
    else:
        async def f(*args, **kwargs):
            return await run_in_executor(config, func, *args, **kwargs)
        afunc = f
    output = await acall_func_with_variable_args(afunc, value, config, run_manager, **kwargs)
```

节选保留分派和 executor 边界，省略 callback 配置、生成器收集、递归子 Runnable 与类型注解。它能证明默认回退的方向，不能证明任意同步函数都可被即时取消，也不能替代 provider 对原生异步客户端的实现。

## 导读

一个步骤用 `def` 写成，另一个步骤用 `async def` 写成。把它们都叫作“Runnable”以后，调用者希望下面四件事同时成立：同步代码能调用、异步代码能等待、组合后的链仍能保持顺序、错误仍能回到原调用者。真正容易错的地方在于：接口统一了，执行载体却没有统一。同步函数可能运行在线程池，原生协程在事件循环里运行，二者的阻塞、取消和资源释放边界不同。

本课的心智模型是“双入口、一个结果合同、两条执行路径”。`invoke` 负责当前调用栈内完成一个结果；`ainvoke` 负责把结果交给 await。只有当 Runnable 自己提供 `afunc` 时，异步入口才能沿着原生异步逻辑走；默认回退只是把同步逻辑搬到 executor。

前十课已经分别建立消息、Prompt、Runnable 组合、callback、序列化和错误分类。本课补上这些积木之间的同步/异步边界；下一课把接口、组合、batch、stream 和失败保位收缩成一个可运行的 mini-LangChain，避免重复再讲 provider 或 Agent loop。

## 分章正文

### 从同一个结果看出两条路径

kicker: "01 · OBSERVE"

先看一个只做加法的函数。`step.invoke(3)` 直接返回 `4`；`await step.ainvoke(3)` 也返回 `4`。结果相等只说明值合同相等，不能说明线程、事件循环、callback 或取消语义相等。把同步函数放进异步入口时，调用仍可能占用一个线程直到函数返回。

#### 本章结论

同步与异步入口可以共享输出合同，但必须单独验收执行载体和失败边界。

### 建立双接口模型

kicker: "02 · MODEL"

把一个步骤写成：

```text
Runnable[I, O] = invoke(I, config) -> O
                 ainvoke(I, config) -> Awaitable[O]
```

若只有同步实现，`ainvoke` 需要一个桥接策略 `sync(I) -> executor -> O`；若有原生异步实现，`ainvoke` 直接等待 `async(I) -> O`。不变量有三个：同一输入在没有外部非确定因素时遵守相同结果合同；异常不会因为换入口而变成成功；配置、callback 和子步骤沿当前执行上下文传递。

#### 代码

```python
import asyncio

def sync_step(value: int) -> int:
    return value + 1

async def async_step(value: int) -> int:
    await asyncio.sleep(0)
    return value + 1

assert sync_step(3) == 4
assert asyncio.run(async_step(3)) == 4
```

#### 本章结论

`async def` 代表可等待的协议，不能单独证明函数内部没有同步阻塞；接口选择和实现选择必须分开描述。

### 沿 Runnable 与 RunnableLambda 走主路径

kicker: "03 · SOURCE"

抽象层的 `Runnable.ainvoke` 默认调用 `run_in_executor(config, self.invoke, ...)`。这让只实现 `invoke` 的 Runnable 也能进入异步组合，但代价是它仍然执行同步代码。`RunnableLambda` 在 `_ainvoke` 里先检查是否存在 `afunc`；存在时使用异步函数，没有时构造一个调用同步 `func` 的协程并交给 executor。同步 `invoke` 则在没有 `func` 时直接报“不能同步调用协程函数”。

这条路径解释了两个看似矛盾的现象：只有同步函数的 Runnable 可以 `await`，但它没有因此获得原生异步 I/O；只有异步函数的 Runnable 可以 `await`，但不能用同步 `invoke` 反向调用。

#### 本章结论

LangChain 的双接口是显式分派：`afunc` 优先，缺失时才由同步实现回退到线程池。

### 失败路径：桥接不等于取消

kicker: "04 · FAILURE"

把 coroutine-only 的 `RunnableLambda` 交给 `invoke`，源码会拒绝，因为同步调用无法凭空等待协程。把普通同步阻塞函数交给 `ainvoke`，默认实现可以让事件循环继续处理其他任务，但被搬进线程的函数本身不会因为调用方取消 await 就自动回滚。若函数持有锁、写文件或调用外部服务，必须自己设计超时、幂等和资源清理。

另一个失败是混用错误类型：同步函数抛出的 `ValueError` 应该仍是 `ValueError`，原生异步函数抛出的异常也应由 await 的调用者看见。包装层可以记录 callback，却不能把失败变成成功。

#### 本章结论

异步入口解决等待方式，不能替应用解决阻塞函数的可取消性、外部副作用和资源回收。

### 资源、并发与组合边界

kicker: "05 · RESOURCE"

在组合链中，`RunnableSequence.ainvoke` 逐步等待前一步，再把输出交给后一步；这保证值顺序，却不会把串行依赖变成并行。批量接口才会对相互独立的输入并发处理。只有同步 `func` 的 batch 可能使用线程池；有原生 `abatch` 或 provider 批量 API 的实现可以覆盖默认策略。`max_concurrency` 控制并行度，避免把线程、连接或供应商限流额度一次性耗尽。

对一个原生异步 provider，优先使用 `afunc` 或覆盖 `ainvoke`，让连接池和取消语义由异步客户端管理。对纯 CPU 计算，线程池通常不等于并行加速；对已有同步 SDK，则先评估线程安全和重复调用，再决定是否接受默认回退。

#### 本章结论

串行组合保持依赖顺序，batch 才承担独立输入的并发；并发上限属于资源合同而非装饰参数。

### 两种实现如何共同成为一个接口

kicker: "06 · ENGINEERING"

变体 A 只提供同步 `func`。优点是实现简单、同步测试直接，异步调用可复用公共路径；缺点是阻塞 I/O 被占用在线程中，无法享受原生 async client 的连接和取消能力。

变体 B 同时提供 `func` 与 `afunc`。优点是同步调用者和异步调用者各走适合的资源模型；缺点是两份实现可能发生行为漂移，必须用相同输入、错误和边界表做合同测试。若两个实现都访问外部系统，还要比较超时、重试、幂等和观测字段，而不只比较返回值。

#### 本章结论

双实现增加维护成本，却能把同步兼容性和异步资源效率同时纳入显式测试。

## 核心机制

- `Runnable.ainvoke` 的默认实现把同步 `invoke` 交给 executor，形成兼容层而非原生异步层。
- `RunnableLambda` 有 `afunc` 时走原生异步函数，没有时才桥接同步 `func`。
- coroutine-only Runnable 的同步入口明确失败；失败类型穿过 callback 包装回到调用者。
- `RunnableSequence` 按依赖顺序等待，独立输入的并发由 `batch/abatch` 与 `max_concurrency` 控制。

## 常见误区

- 看到 `await` 就认为内部没有阻塞；只有同步函数的默认回退仍运行同步代码。
- 用 `invoke` 调用 coroutine-only Runnable，期待框架替自己运行事件循环。
- 把取消 await 当成撤销线程中的文件写入或网络副作用。
- 为了“异步”同时维护两份未对齐的重试和幂等策略，只比较最终字符串。

## 实现变体

### 变体 A：同步函数兼容双入口

useWhen: "已有稳定同步 SDK，步骤短、线程安全且暂时没有原生 async 客户端时。"
tradeoff: "改造成本低；异步调用仍受同步函数、线程池容量和取消边界约束。"

#### 代码

```python
from langchain_core.runnables import RunnableLambda

step = RunnableLambda(lambda value: value + 1)
assert step.invoke(3) == 4
# 官方默认会让 ainvoke 通过同步实现完成。
```

### 变体 B：同步与原生异步并列

useWhen: "同步调用者和异步服务都重要，且 provider 提供可靠的异步客户端。"
tradeoff: "资源模型更清晰；需要用同一组合同测试防止 func 与 afunc 漂移。"

#### 代码

```python
from langchain_core.runnables import RunnableLambda

def add_one(value: int) -> int:
    return value + 1

async def add_one_async(value: int) -> int:
    return value + 1

step = RunnableLambda(add_one, afunc=add_one_async)
assert step.invoke(3) == 4
```

## 可运行示例

```python
import asyncio
from collections.abc import Awaitable, Callable


class DualRunnable:
    def __init__(
        self,
        sync: Callable[[int], int] | None = None,
        async_fn: Callable[[int], Awaitable[int]] | None = None,
    ) -> None:
        self.sync = sync
        self.async_fn = async_fn

    def invoke(self, value: int) -> int:
        if self.sync is None:
            raise TypeError("同步入口不能调用 coroutine-only 步骤")
        return self.sync(value)

    async def ainvoke(self, value: int) -> int:
        if self.async_fn is not None:
            return await self.async_fn(value)
        if self.sync is None:
            raise TypeError("步骤没有可执行实现")
        return await asyncio.to_thread(self.sync, value)


async def native_double(value: int) -> int:
    await asyncio.sleep(0)
    return value * 2


async def main() -> None:
    both = DualRunnable(lambda value: value + 1, native_double)
    assert both.invoke(3) == 4
    assert await both.ainvoke(3) == 6

    sync_only = DualRunnable(lambda value: value + 1)
    assert await sync_only.ainvoke(3) == 4

    async_only = DualRunnable(async_fn=native_double)
    try:
        async_only.invoke(3)
    except TypeError:
        pass
    else:
        raise AssertionError("coroutine-only 步骤必须拒绝同步入口")

    def fail(_: int) -> int:
        raise ValueError("bad input")

    try:
        await DualRunnable(fail).ainvoke(1)
    except ValueError as error:
        assert str(error) == "bad input"
    else:
        raise AssertionError("异常不能被异步桥接吞掉")


asyncio.run(main())
print("sync/async contract: ok")
```

示例用 `asyncio.to_thread` 模拟默认 executor 回退，用 `async_fn` 模拟 `RunnableLambda(func=..., afunc=...)`。它验证正常结果、coroutine-only 的失败和异常传播，没有伪造真实 provider 的网络、连接池或取消语义。

## 搭积木复现

### 积木 1：固定输入到输出的合同

先让同步函数和异步函数都接收 `int` 并返回 `int`，用同一组输入断言结果合同。

### 积木 2：实现同步入口

保存可选的 `sync` 函数；不存在时在 `invoke` 立即抛错，避免偷偷创建事件循环。

### 积木 3：加入同步到异步的桥接

只有 `sync` 时用线程执行它，断言 `await` 能得到结果，同时把这条路径标记为阻塞函数的兼容层。

### 积木 4：加入原生 async 实现

提供 `async_fn` 并让 `ainvoke` 优先选择它，再让同步入口仍只调用 `sync`，避免把协程对象当普通结果。

### 积木 5：组合两个步骤

同步链逐步调用 `invoke`，异步链逐步 `await ainvoke`；断言第二步看到的是第一步的输出。

### 积木 6：注入失败并验收资源边界

分别让同步和异步步骤抛 `ValueError`，断言错误抵达调用者；再把一个外部写入计数器放在步骤内部，说明取消等待不等于撤销已发生的写入。

## 自检

### 问题

为什么只有同步 `func` 的 Runnable 也能 `await ainvoke()`，而只有异步函数的 Runnable 却不能 `invoke()`？如果一个同步步骤写入数据库后，调用者取消了 `await`，应该如何描述结果合同？

### 站内答案

结论：前者是同步实现到异步入口的兼容回退，后者缺少同步可调用实现；取消 await 也不能自动宣称数据库写入被撤销。机制：`Runnable.ainvoke` 默认调用 `run_in_executor`，`RunnableLambda._ainvoke` 在没有 `afunc` 时再次构造这个桥接；同步 `RunnableLambda.invoke` 在没有 `func` 时直接抛出 `TypeError`。源码证据是固定 commit 的 `base.py` 第 873–917、5189–5240、5290–5343 行，测试还用同步函数验证了 `astream` 的异步兼容路径。验证方法：对 sync-only 步骤运行 `asyncio.run(step.ainvoke(...))`，对 async-only 步骤断言 `invoke` 抛 `TypeError`，对写入计数器在取消或超时后重新读取资源状态。工程取舍：已有同步 SDK 可以先接受线程池回退，但应限制并发、确认线程安全并记录超时；关键副作用应使用幂等键、事务或补偿，而不是依赖任务取消。适用边界：原生异步 provider、可取消 I/O 和高并发服务应提供 `afunc` 或覆盖 `ainvoke`；纯计算、短同步步骤可以使用兼容层，但不能把它宣传成原生非阻塞。

## 更新日志

### 深化同步异步双接口与资源边界

at: "2026-08-03T22:15:00+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "Codex Desktop · gpt-5.6-luna"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/36"
commit: "725e703517950658b2ad864c973e3da63b2ddda6"
summary: "补齐 invoke/ainvoke 的分派模型、线程池回退、原生异步、失败与取消边界，并加入双路径示例和 flow 视觉索引。"
