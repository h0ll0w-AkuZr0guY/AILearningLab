---
id: "langchain-01-08"
track: "langchain"
title: "callback 事件"
depth: "deep"
visualIndex: "../visuals/langchain-01-08.md"
exampleLanguage: "python"
readingMinutes: 25
sourceMinutes: 8
practiceMinutes: 10
reviewMinutes: 2
---

## 官方入口

title: "LangChain Models · Invocation config"
url: "https://docs.langchain.com/oss/python/langchain/models#invocation-config"

官方章节把 callbacks 作为 `RunnableConfig` 中的运行期观察与响应机制，并把 tags、metadata 一起列为追踪与调试入口。Runnable 参考页进一步列出 `astream_events` 的生命周期事件。本文使用 LangChain commit `725489f135458c37c668919b0d08652ebd04f131` 的 callback 与 Runnable 源码，解释 start、end、error、父子 run 和 handler 策略，不把 callback 当成事务回滚或业务事件总线。

## 真实源码

repo: "langchain-ai/langchain"
file: "libs/core/langchain_core/runnables/base.py"
symbol: "Runnable._call_with_config"
language: "python"
url: "https://github.com/langchain-ai/langchain/blob/725489f135458c37c668919b0d08652ebd04f131/libs/core/langchain_core/runnables/base.py#L2256-L2303"

### 逐段讲解

- `_call_with_config` 先 `ensure_config`，再从 config 创建 callback manager，并以当前输入、run name 和 run id 发出 `on_chain_start`。
- 它通过 `run_manager.get_child()` 为内部调用建立子 callback 配置，因此组合 Runnable 能形成可回溯的调用树。
- 正常返回时调用 `on_chain_end(output)`；异常捕获后调用 `on_chain_error(e)`，随后原异常继续抛出给业务调用者。
- `BaseCallbackHandler` 的 mixin 为 chain、LLM、tool、retriever 和 agent 提供不同事件入口，handler 可以用 ignore 属性选择不接收某类事件。
- `raise_error` 与 `run_inline` 是 handler 的执行策略，不能被理解成“业务错误是否已经处理”或“事件是否一定同步完成”。

### 源码节选

```python
config = ensure_config(config)
callback_manager = get_callback_manager_for_config(config)
run_manager = callback_manager.on_chain_start(
    serialized,
    input_,
    run_type=run_type,
    name=config.get("run_name") or self.get_name(),
    run_id=config.pop("run_id", None),
)
try:
    child_config = patch_config(config, callbacks=run_manager.get_child())
    with set_config_context(child_config) as context:
        output = context.run(call_func_with_variable_args, func, input_, config, run_manager)
except BaseException as e:
    run_manager.on_chain_error(e)
    raise
else:
    run_manager.on_chain_end(output)
    return output
```

节选只保留一个同步 chain 的生命周期，省略异步 manager、LLM/tool 专用回调、并行任务协调和事件过滤器。它证明的是通知时序与父子上下文，不证明外部副作用已提交或 callback handler 一定不失败。

## 导读

在一个组合管道中，最终输出是 42 还不够。调试者还想知道谁把字符串解析成整数、哪一步耗时最长、失败发生在哪个子节点、同一请求是否被重复执行。把这些信息写进业务函数会让计算和观察纠缠；完全依赖 print 又无法关联并发和嵌套。

callback 是一条旁路：主路径处理值，事件路径记录因果。一个 run 至少有开始、成功结束或错误结束三种终点；子 run 通过 parent id 连接到父 run。这个模型允许观测失败，但不改变失败本身的语义。回调“看到”一次写库不等于写库“可以回滚”，事件完成也不等于业务请求完成。

本课承接 `langchain-01-07` 的 config，专讲 config 中的 callbacks 如何转成生命周期事件；下一课才讨论序列化和可信边界。事件命名和字段格式可能随版本演化，所以代码要针对当前固定版本与官方 reference 编写。

## 分章正文

### 从一次无日志的失败进入

kicker: "01 · OBSERVE"

管道 `strip → parse → double` 在 `parse("oops")` 处失败。没有 callback 时调用者只拿到 `ValueError`，却不知道 strip 是否已经完成、double 是否启动、失败属于哪一次请求。生产排障需要一组能对齐输入、节点和时间的事实。

#### 本章结论

callback 的最小价值是把控制流边界变成可查询的因果记录。

### 建立 run 状态机

kicker: "02 · MODEL"

每个 run 可以表示为 `Created → Running → Succeeded` 或 `Created → Running → Failed`。`on_chain_start` 只发生一次，成功路径必须有 `on_chain_end`，失败路径必须有 `on_chain_error`；一个 run 不能同时成功和失败。子 run 的 parent id 指向创建它的父 run，但每个子 run 有自己的 id。

#### 代码

```python
events = [
    ("start", "root", None),
    ("start", "parse", "root"),
    ("error", "parse", "root"),
]
assert events[-1][0] == "error"
assert all(event[1] != "double" for event in events)
```

#### 本章结论

事件记录的核心是不变量：一次 run 一个终态，父子 id 可形成树，失败节点之后的控制流不应伪造结束。

### 沿 `_call_with_config` 走主路径

kicker: "03 · SOURCE"

源码把 callback manager 从 config 中取出，再发出 chain start。执行函数前，`patch_config` 把 `run_manager.get_child()` 放进子配置，深层 Runnable 因而能继续产生子事件。函数正常返回时 end 事件带 output；异常路径调用 error 后原异常重新抛出。

#### 本章结论

主路径和事件路径由同一执行包装器连接：事件描述控制流，返回值仍由主路径决定。

### 失败、取消与 handler 错误

kicker: "04 · FAILURE"

当业务函数抛错，callback 先收到 error，调用者再收到原错。handler 本身也可能失败：`raise_error=False` 的默认策略避免一个观察器异常阻塞主业务，但这会让日志缺失；`raise_error=True` 则需要把观测系统视为关键依赖。取消、超时和线程退出必须另外测试，因为 callback 的 error 记录不代表底层资源已停止。

#### 本章结论

业务错误、观察错误和资源取消是三条不同的故障链，不能用一个事件代替它们。

### 事件类型与过滤边界

kicker: "05 · EVENT"

chain、LLM、chat model、tool 和 retriever 的事件接口不同。只关心模型 token 时，handler 可以忽略 chain；只关心链路时，不能把每个 token 当一次业务请求。`astream_events` 的过滤字段按 name、type、tag 缩小观察范围，但过滤会减少证据，不能拿过滤后的结果证明没有发生未显示的事件。

#### 本章结论

事件类型是观察视角，过滤器改变可见集合，不改变执行本身。

### 组合、并发与采样

kicker: "06 · ENGINEERING"

顺序链的事件可按 start/end 栈还原；并发分支不能只按时间排序判断父子，必须依赖 run id 和 parent id。高并发下记录完整输入输出会造成隐私和成本压力，实际 handler 应记录低基数 tags、耗时、异常类型、输入输出大小和 trace id；完整正文放进受限审计存储，并设置保留期。

采样率、批量 flush 和异步队列会提高吞吐，却可能在进程崩溃时丢失尾部事件。需要取舍时，优先保证错误、开始/结束计数和关联 id，再决定是否记录完整 payload。

#### 本章结论

可观测性要同时满足因果、隐私和成本，事件越多不等于证据越强。

### 用 handler 断言控制流

kicker: "07 · VERIFY"

测试用 fake handler 收集事件，不启动真实模型。正常用例断言 `start → end`，失败用例断言 `start → error` 且后续节点没有 start；嵌套用例断言 child 的 parent id 正确；handler 抛错用例明确选择忽略或传播。这样可把 callback 契约与具体日志系统解耦。

#### 本章结论

callback 的验证对象是事件序列、身份和失败策略，最终业务字符串只是另一条断言。

## 核心机制

- `_call_with_config` 为 Runnable 创建 start、end/error 生命周期。
- `get_child` 让组合调用形成父子 run 树。
- handler 的事件类型和 ignore 属性决定观察面。
- callback 是旁路证据，不能替代事务、取消或资源回收协议。

### 事件序列如何帮助定位问题

一条 callback 记录应该回答三个问题：哪个运行开始了，哪个运行产生了结果，哪个运行以什么异常结束。`run_id` 标识一次具体尝试，`parent_run_id` 说明它由谁触发，事件类型则描述生命周期位置。把这三类信息合在一起，才能在并发请求交错输出时恢复树状路径。仅凭日志出现的先后顺序无法判断关系，因为兄弟节点可能并行执行，网络传输也可能让结束事件晚于另一个节点的开始事件。

正常路径通常是父节点 start、子节点 start、子节点 end、父节点 end；失败路径会在最靠近异常的位置出现 error，并沿着调用边界决定是否继续向上报告。这个序列不是事务提交证明，也不能证明模型供应商已经完成计费或外部写入。它只描述 Runnable 观察到的控制流。若业务需要“写库成功后才发通知”，应使用业务层的提交状态和幂等键，不能把 `on_chain_end` 当作提交钩子。

handler 的 `raise_error` 和 `run_inline` 体现了工程取舍。测试 handler 可以选择让观察故障立即失败，从而暴露事件契约；生产上报器往往选择隔离故障，避免监控系统阻断用户请求，但必须记录队列满、序列化失败和进程退出时的丢失窗口。事件设计还要主动脱敏，给每条记录设置大小边界，并为重试保留稳定的运行身份。这样 callback 才能成为可检索的诊断证据，而不会变成新的安全或可靠性故障源。

## 常见误区

- 看到 `on_chain_end` 就认定外部副作用已提交；它只说明该 Runnable 返回了输出。
- 按时间戳而非 parent/run id 重建并发调用树。
- 为了方便把用户原文、密钥和完整 tool output 作为 metadata 上报。
- handler 丢事件时仍用“没有日志”证明“没有执行”。

## 实现变体

### 变体 A：同步内存 handler

useWhen: "单元测试和本地调试需要直接断言事件顺序时。"
tradeoff: "证据即时且实现简单；会增加主路径延迟，不能代表生产异步传输。"

#### 代码

```python
class Recorder:
    def __init__(self):
        self.events = []
    def start(self, name, parent=None):
        self.events.append(("start", name, parent))
    def end(self, name):
        self.events.append(("end", name))
    def error(self, name, exc):
        self.events.append(("error", name, type(exc).__name__))

r = Recorder()
r.start("root"); r.start("parse", "root"); r.error("parse", ValueError())
assert r.events[-1] == ("error", "parse", "ValueError")
```

### 变体 B：异步队列 handler

useWhen: "生产服务需要把事件批量发送到观测后端，并尽量降低业务线程阻塞时。"
tradeoff: "吞吐和隔离更好；要处理队列满、进程退出、重试和尾部丢失。"

#### 代码

```python
from collections import deque

queue = deque(maxlen=2)
def emit(event):
    if len(queue) == queue.maxlen:
        return False
    queue.append(event)
    return True

assert emit("start") and emit("end")
assert not emit("extra")
assert list(queue) == ["start", "end"]
```

## 可运行示例

```python
class Recorder:
    def __init__(self):
        self.events = []
    def start(self, name, parent=None):
        self.events.append(("start", name, parent))
    def end(self, name):
        self.events.append(("end", name))
    def error(self, name, exc):
        self.events.append(("error", name, type(exc).__name__))

def invoke(name, fn, recorder, parent=None):
    run_id = f"{parent or 'root'}:{name}"
    recorder.start(name, parent)
    try:
        value = fn()
    except Exception as error:
        recorder.error(name, error)
        raise
    else:
        recorder.end(name)
        return value

recorder = Recorder()
result = invoke("root", lambda: invoke("parse", lambda: 21, recorder, "root") * 2, recorder)
assert result == 42
assert recorder.events == [
    ("start", "root", None),
    ("start", "parse", "root"),
    ("end", "parse"),
    ("end", "root"),
]

failed = Recorder()
try:
    invoke("root", lambda: invoke("parse", lambda: int("oops"), failed, "root"), failed)
except ValueError:
    pass
else:
    raise AssertionError("expected parse failure")
assert failed.events[-1] == ("error", "root", "ValueError")
assert all(event[1] != "double" for event in failed.events)
```

示例用同步 recorder 模拟 callback manager，正常路径验证父子顺序，失败路径验证 error 事件和异常继续向上抛出。它没有模拟异步 handler、网络丢失和生产采样。

## 搭积木复现

### 积木 1：定义三种终态

先为 start、end、error 建立事件结构，禁止一个 run 同时有两个终态。

### 积木 2：包住单步 invoke

成功时记录 end，失败时记录 error 后重新抛出，断言调用者仍能捕获原异常。

### 积木 3：加入 parent id

调用子步骤时传入父 id，断言事件可以重建一棵树，而非只有平面日志。

### 积木 4：加入过滤器

按 tag 或 name 过滤事件，再断言过滤只改变可见集合，不改变函数的实际调用数。

### 积木 5：注入 handler 故障

分别测试 raise_error=False/True，记录观测丢失与业务失败的不同结果。

## 自检

### 问题

一个 Runnable 抛出 `ValueError` 后，为什么 callback 记录 `on_chain_error` 不能证明数据库写入已回滚？怎样写测试把两个事实分开？

### 站内答案

结论是 callback 只观察执行包装器的控制流，不能赋予外部系统事务能力。机制上，`_call_with_config` 的异常分支先调用 `run_manager.on_chain_error(e)`，再重新抛出；源码没有数据库事务、补偿或回滚操作。测试用计数型 fake store：第一步成功写入并递增计数，第二步抛 ValueError；事件断言要求出现 root/child 的 error，资源断言要求计数保持已写入状态，随后再用幂等键或显式事务 fake 验证另一种设计才会回滚。工程上应把 trace、业务提交记录和补偿状态分别记录；只有底层存储提供原子事务并由业务显式包围时，才可把回滚写进验收标准。

## 更新日志

### 建立 callback 生命周期、父子 run 与失败观察课程

at: "2026-08-02T20:41:41+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "Codex · gpt-5.6-luna"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/31"
commit: "f54f99b04b070443bb7b097ffe9f0bcac85f753c"
summary: "新增 callback 的 start、end、error、父子追踪与 handler 取舍课程，配套源码证据、示例和 flow 视觉索引。"
