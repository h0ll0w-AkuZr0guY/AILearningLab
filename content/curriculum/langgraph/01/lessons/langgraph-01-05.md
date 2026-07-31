---
id: "langgraph-01-05"
track: "langgraph"
title: "节点执行契约：Runnable、同步/异步、返回更新与副作用"
depth: "deep"
visualIndex: "../visuals/langgraph-01-05.md"
exampleLanguage: "python"
readingMinutes: 35
sourceMinutes: 55
practiceMinutes: 90
reviewMinutes: 15
---

## 官方入口

title: "LangGraph Graph API · Nodes"
url: "https://docs.langchain.com/oss/python/langgraph/graph-api#nodes"

节点可以是同步或异步 Python 函数，接收 state，并可按签名接收 RunnableConfig 与 Runtime。函数在内部被转换为 RunnableLambda，从而获得同步/异步、batch、tracing 与配置注入能力。

## 真实源码

repo: "langchain-ai/langgraph"
file: "libs/langgraph/langgraph/_internal/_runnable.py"
symbol: "RunnableCallable.invoke / RunnableCallable.ainvoke"
language: "python"
url: "https://github.com/langchain-ai/langgraph/blob/30c4d58db86455128e42ddec96b1ba53c553ba22/libs/langgraph/langgraph/_internal/_runnable.py#L278-L526"

### 逐段讲解

- `StateGraph.add_node` 会调用 `coerce_to_runnable(action, name, trace=True)`，因此节点名、同步/异步能力和 tracing 从注册时就固定在 StateNodeSpec。
- `RunnableCallable.__init__` 读取签名，只对受支持的参数名和类型注解做注入。把第二个参数随便命名为 db 并不会自动获得 store。
- `invoke` 没有 sync func 时明确报错；`ainvoke` 没有 async func 时回退到 sync invoke。反方向不成立，所以纯 async node 不能通过 graph.invoke 运行。
- 在 async graph 中执行同步 node 可能阻塞 event loop 或依赖执行器策略；不能因为框架提供 ainvoke 就假设任意同步 I/O 自动非阻塞。
- trace=True 时 RunnableCallable 建立 callback run、patch child config，并在异常/完成时通知 tracer；节点稳定命名直接影响可观测性。
- 节点返回值随后由 CompiledStateGraph.attach_node 的 `_get_updates` 过滤/校验，Runnable 适配与 State update 提取是两个相邻但不同阶段。

### 源码节选

```python
class RunnableCallable(Runnable):
    def __init__(self, func=None, afunc=None, *, name=None, trace=True, ...):
        self.func = func
        self.afunc = afunc

        # 根据参数名与类型注解记录可注入的 config/runtime/store/writer 等。
        self.func_accepts = {}
        params = inspect.signature(func or afunc).parameters
        for kw, typ, runtime_key, default in KWARGS_CONFIG_KEYS:
            parameter = params.get(kw)
            if parameter is None or parameter.kind not in VALID_KINDS:
                continue
            if typ != (ANY_TYPE,) and parameter.annotation not in typ:
                continue
            self.func_accepts[kw] = (runtime_key, default)

    def invoke(self, input, config=None, **kwargs):
        if self.func is None:
            raise TypeError(
                "No synchronous function provided; use ainvoke/astream"
            )
        config = ensure_config(config)
        kwargs = self._inject_from_config_and_runtime(config, kwargs)
        return self.func(input, **kwargs)

    async def ainvoke(self, input, config=None, **kwargs):
        # 只有 async 实现时原生 await；否则退回同步 invoke。
        if not self.afunc:
            return self.invoke(input, config)
        config = ensure_config(config)
        kwargs = self._inject_from_config_and_runtime(config, kwargs)
        return await self.afunc(input, **kwargs)


def coerce_to_runnable(thing, *, name, trace):
    if isinstance(thing, Runnable):
        return thing
    if is_async_generator(thing) or inspect.isgeneratorfunction(thing):
        return RunnableLambda(thing, name=name)
    if callable(thing):
        # 对象同时有同步 __call__ 和 async __call__ 时会分别登记入口。
        return RunnableCallable(func=thing, afunc=..., name=name, trace=trace)
    raise TypeError("Expected a Runnable, callable or mapping")
```

## 导读

LangGraph node 的最小合同是“读取当前 State snapshot，返回 partial update”。它可以是普通函数、async function、Runnable 或子图。框架会把 callable 适配为 Runnable，再在执行时按签名注入 config/runtime，并把返回值解释为 State update 与控制命令。

把 State 视为只读输入非常重要。原地 mutation 没有清晰的 write set，可能绕过 reducer、污染并行兄弟的 snapshot，也让 checkpoint/trace 无法准确记录变化。返回 `{"field": new_value}` 才能进入 channel update 协议。

副作用需要再分一层：可重算纯函数、可安全重试的幂等查询、有成本但可重试的模型调用、不可逆命令。节点合同要为后两类加入 timeout、retry、idempotency key、outbox 或人工确认，不能把所有错误都交给框架默认重试。


## 分章正文

### State 输入是本轮快照，不是你的私有工作区

kicker: "01 · INPUT CONTRACT"

默认节点接收 graph state schema；指定 `input_schema` 可只投影部分字段。无论哪种，输入代表本 super-step 开始时可见 State。

节点可以创建局部对象、调用模型和工具，但跨节点事实必须通过 update 返回。把临时 client、callback 或巨大原始响应写入 State 会扩大 checkpoint 并泄漏权限。

输入 schema 是读取合同，完整 graph channels 决定可写字段。节点可返回其输入投影之外、但已在 OverallState 注册的 key。

#### 本章结论

读集合由 node input schema 控制，写集合由 graph State channels 控制。

### state、config 与 runtime 如何注入

kicker: "02 · SIGNATURE"

第一个位置参数通常是 state。`config: RunnableConfig` 暴露 tags、metadata、callbacks、recursion_limit 和 configurable；`runtime: Runtime[Context]` 暴露 context、store、stream_writer、execution_info 等。

注入依赖参数名和受支持的类型注解。错误注解可能产生 warning 或缺失注入。业务函数应显式声明类型，让 API、IDE 与运行时约定一致。

tenant、model provider 等不可持久依赖放 context；thread_id 属于 config/execution_info；需要参与 reducer 和 checkpoint 的事实才放 State。

#### 代码

```python
from dataclasses import dataclass
from typing_extensions import TypedDict
from langchain_core.runnables import RunnableConfig
from langgraph.runtime import Runtime

class State(TypedDict):
    query: str
    answer: str

@dataclass
class Context:
    model_name: str

async def answer_node(
    state: State,
    config: RunnableConfig,
    runtime: Runtime[Context],
) -> dict[str, str]:
    thread_id = runtime.execution_info.thread_id
    model_name = runtime.context.model_name
    return {"answer": f"{thread_id}/{model_name}: {state['query']}"}
```

#### 本章结论

State、config、runtime 是三种生命周期，不要用一个万能 dict 代替。

### 返回 partial update，而非完整复制或原地修改

kicker: "03 · OUTPUT CONTRACT"

节点只返回它更新的字段，runtime 用每个 channel 的 reducer 与旧值合并。完整复制 State 会把未拥有字段也声明为写入，增加并行冲突和 schema 演进风险。

返回普通 dict 时，attach_node 只保留已注册 output_keys；返回错误类型会抛 `InvalidUpdateError`。悄悄拼写错字段可能被过滤或造成意外，因此类型检查与单元测试仍必要。

Command 可以同时携带 update 与 goto，Send 可以创建动态 task。它们改变控制流，不应被当成普通 dict reducer 的语法糖。

#### 本章结论

partial update 是显式 write set，也是 reducer、trace 和并发冲突检测的输入。

### 为什么原地 append 会破坏 super-step 语义

kicker: "04 · MUTATION"

若 state["messages"] 是 list，节点执行 `append` 后再返回同一对象，另一个并行节点可能通过共享引用看到变化，尽管 barrier 尚未提交。

即使当前实现碰巧重建了 schema 对象，依赖这种隐式复制也很脆弱。正确写法是返回新增 message，让 Messages reducer 按 ID 合并；或返回新 list，由明确 reducer 决定 replace/append。

测试可冻结或深拷贝输入，在节点后比较 before；开发期发现 mutation 就失败。大型对象则用只读 domain type 和 mutation API 隔离。

#### 本章结论

节点纯度至少要求不修改输入 State；外部 I/O 是否纯净是另一条轴。

### 四种调用组合怎样失败

kicker: "05 · SYNC / ASYNC"

sync node + graph.invoke 是直接路径；sync node + graph.ainvoke 可以回退到同步入口，但若 node 做阻塞 I/O，可能拖住 event loop，具体执行策略要验证。

async node + graph.ainvoke 是原生路径；async-only node + graph.invoke 会因为没有同步函数报 TypeError，而不是自动新建 event loop。

对网络、stream、可取消等待优先 async。对短 CPU 纯计算可 sync；长 CPU 工作应放进进程/任务系统，不要假设 `async def` 会并行执行 CPU。

#### 要点

- 接口形态必须与宿主调用方式配套。
- async 提供协作式等待，不提供 CPU 并行。
- 同步函数不能在进程内被安全强制取消。

#### 本章结论

选择 sync/async 依据等待与取消需求，而非个人语法偏好。

### retry、timeout 与错误分类放在哪里

kicker: "06 · ERROR POLICY"

`add_node` 可配置 retry_policy、cache_policy、error_handler 和 timeout。网络抖动、429、临时数据库错误适合有限重试；输入无效、权限拒绝和确定性代码 bug 不应重试。

当前源码明确：节点 wall-clock/idle timeout 只支持 async node，sync node 无法在进程内安全取消。宿主 deadline 仍要覆盖整个 graph。

error handler 可以把失败转换为 State update 和后续路径，但不要吞掉原始 cause、task/node identity 和 retry history。

#### 本章结论

节点策略应按错误语义配置，默认“所有异常重试三次”会放大成本和副作用。

### 把不可逆动作变成可重放协议

kicker: "07 · SIDE EFFECT"

查询类副作用可用 request id、cache 和 timeout；命令类副作用如 send/charge 必须用业务 operation_id 去重。operation_id 应来自稳定业务标识，而非每次重试随机生成。

事务性 outbox 节点只在数据库事务中记录 intent；独立 dispatcher 发送并回写结果。图 State 保存 outbox_id 和 status，恢复时查询事实，不直接猜测远端是否成功。

模型调用介于两者之间：通常可重试但有成本和非确定性。可持久化 prompt/model/version/request hash 和结果，恢复优先复用已确认输出。

#### 本章结论

节点不是副作用隔离箱；可靠性来自明确的提交、去重和查询协议。

### 节点测试要脱离整张图

kicker: "08 · NODE TEST"

把 node 当普通函数测试：给定最小 State 和 fake Runtime，断言只读了允许字段、返回准确 update、没有原地 mutation。

为 async node 用可控 fake client 覆盖成功、timeout、cancel、retryable 和 permanent error。不要在单元测试直接请求真实模型。

再做 compiled graph 集成测试，验证 input projection、update reducer、trace node name 和调用 API 矩阵。单元与运行时测试各自证明不同合同。

#### 本章结论

节点先作为纯合同测试，再放进 Pregel 时间线；两层都需要。

### 为每个字段和外部动作指定唯一所有者

kicker: "09 · OWNERSHIP"

节点设计前先做 ownership matrix：字段由谁创建、谁可更新、reducer 是 replace 还是 aggregate、是否进入 checkpoint、是否包含敏感数据、版本迁移由谁负责。没有所有者的共享字段很快会成为多个节点互相覆盖的隐式总线。

例如 `messages` 可由模型、工具和人工节点共同写，因此必须用消息 ID reducer；`risk_score` 应由风险节点单写，用 LastValue；`audit_events` 可追加但要有去重 ID；`db_client` 不属于任何 State writer，而由 Runtime Context 提供。

外部动作也要有所有者。generate_email 只产出内容，schedule_email 只创建 outbox intent，dispatcher 只负责发送，reconcile 节点查询并把外部确认写回 State。拆开后每个失败窗口都能被命名和测试。

节点越大，局部变量和副作用越多，checkpoint 能选择的恢复粒度越粗。拆分也有成本：更多 super-step、序列化和 trace。应在“需要独立重试/审批/观测的边界”拆，而非把每个函数都变成 node。

ownership matrix 还应记录读权限。包含 PII 的字段不能因为进入共享 State 就对所有节点可见；可通过 input_schema 投影、子图私有 State、最小化 context 和工具授权缩小表面。可恢复性从来不能以无边界共享敏感数据为代价。

#### 本章结论

节点边界由状态与副作用所有权决定，而非代码行数或组织架构。

## 核心机制

- add_node 从函数名/Runnable name 推断稳定节点名称，或接受显式名称。
- coerce_to_runnable 把 callable、generator、async callable 或 Runnable 统一适配。
- RunnableCallable 检查函数签名，记录可注入 config/runtime 参数。
- invoke 要求同步入口；ainvoke 优先 async，无 async 时可回退 sync。
- trace wrapper 为节点创建 callback run，并传播 child config。
- node input mapper 从声明的 input channels 构建 dict/dataclass/Pydantic 输入。
- 节点返回 dict/Command 后由 `_get_updates` 提取已注册 State writes。
- ChannelWrite 把 partial updates 和 control packets 分开发布。
- retry/cache/timeout/error handler 保存在 StateNodeSpec/PregelNode。
- 外部副作用一致性仍由幂等键、outbox 或业务事务保证。

## 常见误区

- 在 node 中原地修改 State list/dict。
- 每次返回完整 State，造成无所有权字段的隐式写入。
- 把 config、runtime context 和业务 State 混在一起。
- 纯 async node 却从同步 graph.invoke 调用。
- sync node 做阻塞网络 I/O，并以为 ainvoke 自动非阻塞。
- 对权限错误、校验错误和代码 bug 统一自动重试。
- 每次重试生成新幂等键，让去重失效。
- 只做整图端到端测试，节点错误难以定位。

## 实现变体

### 纯函数节点

useWhen: "解析、校验、路由特征或确定性转换。"
tradeoff: "最易测试和重放；真实 Agent 仍需要在边界接模型/工具。"

### 原生 async I/O 节点

useWhen: "模型、HTTP、数据库或 stream 需要并发、timeout 和取消。"
tradeoff: "资源利用更好；必须正确传播取消、关闭 client 和限制并发。"

### 命令节点 + outbox

useWhen: "邮件、支付、发布等不可逆外部动作。"
tradeoff: "恢复语义可靠；多出 intent、dispatcher、状态查询和补偿流程。"

## 可运行示例

```python
from __future__ import annotations

import asyncio
import inspect
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable

State = dict[str, Any]
Update = dict[str, Any]
SyncNode = Callable[[State, "Runtime"], Update]
AsyncNode = Callable[[State, "Runtime"], Awaitable[Update]]


@dataclass(frozen=True)
class Runtime:
    thread_id: str
    tenant_id: str


@dataclass
class Outbox:
    """用 operation_id 把至少一次节点执行收敛为一次业务 intent。"""

    events: dict[str, dict[str, Any]] = field(default_factory=dict)

    def put_once(self, operation_id: str, payload: dict[str, Any]) -> str:
        self.events.setdefault(
            operation_id,
            {"payload": dict(payload), "status": "pending"},
        )
        return operation_id


class RunnableNode:
    def __init__(
        self,
        name: str,
        func: SyncNode | AsyncNode,
        *,
        allowed_updates: set[str],
    ):
        self.name = name
        self.func = func
        self.allowed_updates = allowed_updates
        self.is_async = inspect.iscoroutinefunction(func)

    def _validate(self, before: State, after_input: State, update: Any) -> Update:
        if before != after_input:
            raise RuntimeError(f"{self.name} 原地修改了输入 State")
        if not isinstance(update, dict):
            raise TypeError(f"{self.name} 必须返回 dict update")
        unknown = set(update) - self.allowed_updates
        if unknown:
            raise KeyError(f"{self.name} 写入未声明字段: {unknown}")
        return update

    def invoke(self, state: State, runtime: Runtime) -> Update:
        if self.is_async:
            raise TypeError(f"{self.name} 只有 async 入口，请使用 ainvoke")
        before = dict(state)
        update = self.func(state, runtime)
        return self._validate(before, state, update)

    async def ainvoke(self, state: State, runtime: Runtime) -> Update:
        before = dict(state)
        if self.is_async:
            update = await self.func(state, runtime)
        else:
            # 教学版直接调用；生产中阻塞 I/O 应改写为原生 async。
            update = self.func(state, runtime)
        return self._validate(before, state, update)


outbox = Outbox()


def normalize(state: State, runtime: Runtime) -> Update:
    return {"normalized": state["query"].strip().lower()}


async def fetch_profile(state: State, runtime: Runtime) -> Update:
    await asyncio.sleep(0)  # 让出事件循环；测试中替换为 fake client。
    return {"profile": {"tenant": runtime.tenant_id, "tier": "pro"}}


def schedule_email(state: State, runtime: Runtime) -> Update:
    operation_id = f"{runtime.thread_id}:welcome-email"
    outbox_id = outbox.put_once(
        operation_id,
        {"to": state["email"], "template": "welcome"},
    )
    return {"outbox_id": outbox_id}


async def main() -> None:
    runtime = Runtime(thread_id="thread-7", tenant_id="acme")
    state = {"query": " Refund ", "email": "dev@example.com"}

    normalize_node = RunnableNode(
        "normalize", normalize, allowed_updates={"normalized"}
    )
    profile_node = RunnableNode(
        "fetch_profile", fetch_profile, allowed_updates={"profile"}
    )
    email_node = RunnableNode(
        "schedule_email", schedule_email, allowed_updates={"outbox_id"}
    )

    state.update(normalize_node.invoke(dict(state), runtime))
    state.update(await profile_node.ainvoke(dict(state), runtime))
    state.update(email_node.invoke(dict(state), runtime))

    # 模拟恢复后重复执行，outbox 仍只有一个 intent。
    state.update(email_node.invoke(dict(state), runtime))
    assert list(outbox.events) == ["thread-7:welcome-email"]
    assert state["normalized"] == "refund"


asyncio.run(main())
```

## 搭积木复现

### 积木 1：定义输入与 partial update

节点接收 State snapshot，只声明自己拥有的 allowed update keys。

### 积木 2：检测原地 mutation

运行前后比较输入；分别复现 list.append 和返回新 list 的差异。

### 积木 3：实现 sync invoke

纯 async callable 从同步入口必须明确失败，禁止偷偷创建 event loop。

### 积木 4：实现 async ainvoke

原生 await async node；sync fallback 只允许短计算，并在文档标明阻塞边界。

### 积木 5：注入 Runtime

把 tenant/client/store 从 State 移出，按函数签名注入测试替身。

### 积木 6：校验返回 update

拒绝非 dict、未知字段和完整 State 误写，保留清晰错误。

### 积木 7：加入 outbox

用稳定 operation_id 写一次 intent，模拟恢复重复调用并断言未重复。

### 积木 8：覆盖调用矩阵

测试 sync/sync、sync/async、async/async 和 async/sync 失败四种组合。

## 自检

### 问题

一个 async 节点接收 messages、RunnableConfig 和 Runtime[Context]，调用模型后直接 `state["messages"].append(reply)`，随后发送邮件并返回完整 state。请指出至少六个合同问题，并给出可恢复、可测试的重构路径。

### 站内答案

问题包括：一，原地 append 修改输入快照，可能让并行兄弟提前观察写入；二，返回完整 state 把节点不拥有的字段也声明为 writes，增加 reducer 冲突；三，messages 应通过 add_messages 等 reducer 返回新增/替换消息；四，模型、tenant/client 等依赖应从 Runtime Context 注入，thread/trace 配置来自 RunnableConfig，不应混进业务 State；五，模型调用需要原生 async、timeout、取消、错误分类和有限重试；六，发送邮件是不可逆命令，模型结果提交与邮件发送之间存在崩溃窗口；七，直接在同一节点混合生成与发送让单元测试和恢复粒度过大；八，完整原始响应或密钥不得进入 checkpoint。重构为 generate_reply async 节点，只读 messages 并返回 `{"messages": [reply], "email_intent": ...}`；随后 schedule_email 节点以 thread_id+业务操作构造稳定 operation_id，在事务性 outbox 中 put_once，返回 outbox_id/status；dispatcher 负责真实发送。用 fake model 控制成功、timeout、cancel 和 permanent error，用输入快照断言无 mutation，并重复执行 schedule_email 证明幂等。
