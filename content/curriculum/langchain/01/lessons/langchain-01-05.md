---
id: "langchain-01-05"
track: "langchain"
title: "Runnable invoke"
depth: "deep"
visualIndex: "../visuals/langchain-01-05.md"
exampleLanguage: "python"
readingMinutes: 25
sourceMinutes: 8
practiceMinutes: 10
reviewMinutes: 2
---

## 官方入口

title: "LangChain Core Reference · Runnables"
url: "https://reference.langchain.com/python/langchain-core/runnables"

官方参考把 Runnable 定义为可调用、批处理、流式、变换和组合的工作单元。`invoke(input, config)` 只承诺把一个输入转换为一个输出；并发、流式粒度、重试和副作用幂等性仍由具体实现与包装器决定。

## 真实源码

repo: "langchain-ai/langchain"
file: "libs/core/langchain_core/runnables/base.py"
symbol: "RunnableSequence.invoke"
language: "python"
url: "https://github.com/langchain-ai/langchain/blob/725489f135458c37c668919b0d08652ebd04f131/libs/core/langchain_core/runnables/base.py#L3209-L3249"

### 逐段讲解

- `ensure_config` 先建立统一配置，callback manager 由该配置派生。
- 根运行在执行步骤前触发 `on_chain_start`，每个步骤获得独立 child callback。
- 上一步输出按顺序成为下一步输入；额外 kwargs 只传给第一步，避免意外污染后续接口。
- 任一步抛错都会触发根运行 `on_chain_error` 并继续抛出；全部成功才发送 `on_chain_end` 并返回最终输出。

### 源码节选

```python
def invoke(self, input, config=None, **kwargs):
    config = ensure_config(config)
    callback_manager = get_callback_manager_for_config(config)
    run_manager = callback_manager.on_chain_start(
        None,
        input,
        name=config.get("run_name") or self.get_name(),
        run_id=config.pop("run_id", None),
    )
    value = input
    try:
        for index, step in enumerate(self.steps):
            # 每个步骤得到自己的追踪子树，但继承同一次根调用配置。
            config = patch_config(
                config,
                callbacks=run_manager.get_child(f"seq:step:{index + 1}"),
            )
            with set_config_context(config) as context:
                if index == 0:
                    value = context.run(step.invoke, value, config, **kwargs)
                else:
                    value = context.run(step.invoke, value, config)
    except BaseException as error:
        run_manager.on_chain_error(error)
        raise
    else:
        run_manager.on_chain_end(value)
        return value
```

## 导读

`a | b | c` 看起来像把三个函数接起来，真正的 Runnable 合同还包含配置传播、追踪父子关系、同步异步入口、错误终止与类型边界。缺少这些合同，教学版管道能算出正确答案，却无法解释生产中的“哪一步失败、谁应该重试、超时是否取消、同一个 trace 为什么断开”。

最有用的心智模型是变电站：业务值沿主电缆从一步流向下一步，config 像控制与测量线路，随调用传播但不属于业务值。callback 观察每个站点，错误会切断后续路径并汇报根运行。把 config 混进输入字典，就像把电表读数焊进货物，组合时很快发生字段冲突。

本课只讲单输入的顺序 invoke。batch、stream、config 细节和 callback 事件在后续课程展开；这里先建立可组合的最小执行器，并能证明一次失败不会继续运行后面的步骤。

## 分章正文

### 普通函数为何还需要 Runnable

kicker: "01 · OBSERVE"

两个函数当然可以写成 `parse(fetch(x))`。问题在于每个组件很快会拥有不同调用习惯：模型要 callbacks，检索器支持 batch，解析器可能有 async 版本，部署系统还需要输入 schema 和图结构。如果组合层只认识 Python callable，所有横切能力都要在业务函数外重复包装。

Runnable 给每个工作单元同一组操作名：invoke、ainvoke、batch、stream，以及 config、schema 和组合。统一接口并不消除组件差异；它提供一个能表达差异的公共位置。比如 RunnableLambda 默认 batch 可用线程池复用 invoke，真正支持批量 API 的模型则可覆盖它减少网络往返。

单次 invoke 的最小不变量是：恰好接收一个业务输入；成功返回一个业务输出；失败抛出而不伪造正常值；观测配置不改变业务语义。满足这些条件后，组件才能安全进入序列或并行图。

#### 本章结论

Runnable 的价值在统一执行协议，使组合器能处理值、配置与生命周期，而不必了解每个组件的内部类。

### 两条通道：业务值与运行配置

kicker: "02 · MODEL"

业务值可以是字符串、消息、Document 列表或结构化对象，它沿序列逐步改变。RunnableConfig 则携带 callbacks、tags、metadata、run_name、max_concurrency 等运行信息。config 会被继承和补丁式派生，但不应成为下一步的业务输入。

如果函数确实需要租户 id、权限或数据库连接，应判断它属于业务语义还是运行环境。影响输出且需要测试重放的租户策略通常应放显式 input/context；纯追踪标签放 metadata；敏感连接对象通过受控 runtime context 注入。把所有东西塞进 config 会让输入 schema 失真，也会让脱离 LangChain 的单元测试难以运行。

序列中的类型合同是 `A -> B -> C`。第一步输出类型必须满足第二步输入。Python 运行时可能到深处才报错，因此生产链应结合类型标注、JSON schema 和边界校验。一个返回 `{"text": ...}` 的解析器不能直接接收 AIMessage，除非先有明确的投影步骤。

#### 本章结论

业务值回答“计算什么”，config 回答“怎样观察与控制这次计算”；组合设计要让两条通道都显式。

### 顺序执行与追踪树

kicker: "03 · SOURCE"

RunnableSequence 的源码先创建根 run，再为每一步生成 `seq:step:n` 子 callback。值变量 `input_` 被每一步覆盖，因此序列天然是左到右的数据依赖。只有第一步收到调用者传给序列的额外 kwargs，后续步骤只得到前一步输出与 config，避免一个模型专用参数误传给解析器。

`set_config_context` 让被调用步骤及其内部子调用能取得当前配置。它解决深层组件不便逐层手传 callback 的问题，同时也带来边界：后台线程、进程或脱离上下文创建的任务不一定自动继承。异步和并发代码要通过官方 Runnable 接口传播，不能假设全局变量能保持 trace。

根 run 只在全部步骤成功后 `on_chain_end`。这意味着观察系统可以从父子关系重建整条调用路径：根失败时定位最后一个未完成 child，而不是只看一条扁平日志。

#### 本章结论

序列的执行结构同时是一棵追踪树；步骤顺序决定值依赖，callback 子树决定因果定位。

### 异常、重试与副作用

kicker: "04 · FAILURE"

任一步抛错，RunnableSequence 记录根错误并重新抛出，后续步骤不会执行。它不会自动回滚已经发生的副作用。若第一步已写数据库，第二步调用模型超时，简单重试整条链可能重复写入。框架的执行终止语义与业务事务语义必须分开设计。

重试应尽量包在最小的瞬态失败步骤上。官方 RunnableRetry 示例也建议对模型等易受网络影响的局部组件使用 `with_retry`，而非无差别重试整个含副作用链。每个外部写入需要业务幂等键，或采用“准备、提交”协议；仅有 trace id 不代表 exactly-once。

取消和超时也需要底层组件配合。上层超时返回不代表 provider 请求、线程或外部写入已经停止。测试不只断言调用者收到 TimeoutError，还要观察下游任务状态和资源释放。无法取消的组件应标注“超时后结果被忽略”，并限制并发避免幽灵工作堆积。

#### 本章结论

异常会切断控制流，却不会抹去先前副作用；重试、幂等与补偿必须围绕真实副作用边界设计。

### 组合、调试与发布标准

kicker: "05 · ENGINEERING"

组合前为每个 Runnable 写四项合同：输入 schema、输出 schema、可能异常、外部副作用。随后用 Fake step 记录调用次序和 config，证明正常路径 A→B→C、B 失败时 C 未运行、每一步获得同一业务 trace 的子观察上下文。这个测试比调用真实模型稳定，也能定位组合器缺陷。

变体一是普通函数组合，依赖少、性能直接，适合纯计算小程序。变体二是 RunnableSequence，获得批量、异步、流式和追踪生态，代价是要理解 config 与默认实现。变体三是显式工作流图，适合分支、恢复和持久化状态；若流程只是固定直线，图会增加心智负担。

上线指标至少包括每步耗时、错误类别、重试次数、输入输出尺寸与取消后仍运行的任务数。metadata 只放低基数标签，用户 id、完整问题和文档正文不应成为普通指标 label。调试时从根 run 进入失败 child，再结合业务幂等键核对外部系统。

#### 本章结论

选择组合抽象取决于控制流复杂度；直线用序列，分支和恢复用图，纯本地小计算可保留普通函数。

## 核心机制

- Runnable 统一单次调用及其批量、异步、流式和组合扩展点。
- RunnableSequence 让业务值顺序流动，并为每步派生追踪子上下文。
- 任一步失败会终止后续步骤、记录根错误并重新抛出。
- 执行器不自动回滚副作用，重试必须服从幂等与事务边界。

## 常见误区

- 把 config 当万能业务字典，导致 schema、缓存与重放都无法解释。
- 给整条含写操作的链加自动重试，制造重复订单或重复消息。
- 只看最终输出正确，不断言步骤次序、失败停止和 callback 因果。

## 实现变体

### 变体 A：普通函数管道

useWhen: "纯本地、无异步与观测要求、只有两三个稳定步骤的计算。"
tradeoff: "依赖和开销最小；批量、追踪、重试与 schema 需要自行实现。"

### 变体 B：RunnableSequence

useWhen: "模型、检索、解析等组件需要统一 invoke、批量和追踪能力。"
tradeoff: "组合与观测一致；要管理 config 传播、默认并发和副作用边界。"

## 可运行示例

```python
from dataclasses import dataclass, field

@dataclass
class Trace:
    events: list[str] = field(default_factory=list)

class Runnable:
    def __init__(self, name, fn):
        self.name, self.fn = name, fn

    def invoke(self, value, config):
        trace = config["trace"]
        trace.events.append(f"start:{self.name}")
        try:
            result = self.fn(value)
        except Exception:
            trace.events.append(f"error:{self.name}")
            raise
        trace.events.append(f"end:{self.name}")
        return result

class Sequence:
    def __init__(self, *steps):
        self.steps = steps

    def invoke(self, value, config=None):
        config = config or {"trace": Trace()}
        for step in self.steps:
            value = step.invoke(value, config)
        return value

trace = Trace()
pipeline = Sequence(
    Runnable("strip", str.strip),
    Runnable("parse", int),
    Runnable("double", lambda x: x * 2),
)
assert pipeline.invoke(" 21 ", {"trace": trace}) == 42
assert trace.events == [
    "start:strip", "end:strip",
    "start:parse", "end:parse",
    "start:double", "end:double",
]

failed = Trace()
try:
    pipeline.invoke("oops", {"trace": failed})
except ValueError:
    pass
assert "start:double" not in failed.events
```

## 搭积木复现

### 积木 1：定义单步 invoke

每个步骤只接收一个业务输入和一份 config，先测试同步成功路径。

### 积木 2：实现顺序值传递

循环覆盖当前值，用不同输入输出类型证明后一步确实收到前一步结果。

### 积木 3：加入父子追踪

为根调用和每个步骤记录 start/end，断言事件形成完整嵌套顺序。

### 积木 4：实现失败短路

中间步骤抛错后记录 error、重新抛出，并断言后续步骤从未启动。

### 积木 5：标注副作用与重试边界

给一个步骤加入计数写操作，演示重试整条链会重复写，再用幂等键或局部重试修复。

## 自检

### 问题

一个 `保存请求 | 调用模型 | 解析结果` 的序列在模型超时后为什么不能安全地无脑重试整条链？应把哪些证据写进测试与追踪？

### 站内答案

结论是 RunnableSequence 只保证异常后停止后续控制流，不回滚已经成功的“保存请求”。整链重试会再次执行第一步，若没有业务幂等键便产生重复记录。源码证据是 `for step in self.steps` 逐步覆盖值，异常分支只调用 `on_chain_error` 后重新抛出，没有事务回滚。测试使用计数型 Fake store：第一次保存后让模型失败，再执行重试，断言无幂等时计数为二；修复后按 request key upsert，计数保持一。追踪要记录根 run、失败 child、幂等键和每步副作用状态。只有整条链纯计算或所有写入都具备可证明的幂等/补偿协议时，整链重试才安全。
