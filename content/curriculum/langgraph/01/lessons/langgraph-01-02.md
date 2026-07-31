---
id: "langgraph-01-02"
track: "langgraph"
title: "StateGraph Builder 与 compile：从 schema 到 CompiledStateGraph"
depth: "deep"
visualIndex: "../visuals/langgraph-01-02.md"
exampleLanguage: "python"
readingMinutes: 33
sourceMinutes: 59
practiceMinutes: 83
reviewMinutes: 15
---

## 官方入口

title: "LangGraph Graph API · Compiling your graph"
url: "https://docs.langchain.com/oss/python/langgraph/graph-api#compiling-your-graph"

Graph 必须 compile 后才能运行。compile 会验证结构，并在同一边界接收 checkpointer、cache、store、interrupt 与 debug 等运行参数；结果是实现 Runnable 接口的 CompiledStateGraph。

## 真实源码

repo: "langchain-ai/langgraph"
file: "libs/langgraph/langgraph/graph/state.py"
symbol: "StateGraph.compile"
language: "python"
url: "https://github.com/langchain-ai/langgraph/blob/30c4d58db86455128e42ddec96b1ba53c553ba22/libs/langgraph/langgraph/graph/state.py#L1164-L1388"

### 逐段讲解

- 源码版本固定到 langgraph 1.2.9、commit `30c4d58`。签名中 checkpointer、store、cache、interrupt 和 transformer 都属于运行时能力，不是 builder 上的普通业务 state。
- `self.validate()` 先检查入口、节点引用、边目标和 interrupt 节点；静态校验无法证明循环一定终止，也无法证明节点返回正确 dict。
- `output_channels` 按 output schema 过滤公开返回；`stream_channels` 从完整 State channel 中排除 managed value，两者解决不同 API 表面。
- `CompiledStateGraph` 继承 `Pregel`。它初始化时 `nodes={}`，随后通过 `attach_node/edge/branch` 把高层声明编译成 channel、trigger、writer 和 Runnable。
- `START` 会成为 `EphemeralValue(input_schema)` 输入 channel。END 则没有同构业务 actor，这个差异会在第四课展开。
- 返回前再次 `compiled.validate()`，说明源码生成结构也有自己的不变量；compile 不是简单地把 `compiled=True`。

### 源码节选

```python
def compile(
    self,
    checkpointer: Checkpointer = None,
    *,
    cache: BaseCache | None = None,
    store: BaseStore | None = None,
    interrupt_before: All | list[str] | None = None,
    interrupt_after: All | list[str] | None = None,
    debug: bool = False,
    name: str | None = None,
    transformers: Sequence[Callable[..., Any]] | None = None,
) -> CompiledStateGraph:
    # 1. 规范化持久化依赖，并校验 interrupt 引用的节点。
    checkpointer = ensure_valid_checkpointer(checkpointer)
    self.validate(interrupt=[...])

    # 2. 从 output schema 和完整 state schema 计算公开输出/stream channel。
    output_channels = [...]
    stream_channels = [...]

    # 3. 创建真正的 Pregel 子类。START 输入是一个临时 channel。
    compiled = CompiledStateGraph(
        builder=self,
        nodes={},
        channels={
            **self.channels,
            **self.managed,
            START: EphemeralValue(self.input_schema),
        },
        input_channels=START,
        output_channels=output_channels,
        stream_channels=stream_channels,
        checkpointer=checkpointer,
        store=store,
        cache=cache,
        auto_validate=False,
        debug=debug,
        name=name or "LangGraph",
    )

    # 4. 把声明对象逐项降级为 Pregel node/channel/writer/trigger。
    compiled.attach_node(START, None)
    for key, node in self.nodes.items():
        compiled.attach_node(key, node)
    for start, end in self.edges:
        compiled.attach_edge(start, end)
    for starts, end in self.waiting_edges:
        compiled.attach_edge(starts, end)
    for start, branches in self.branches.items():
        for branch_name, branch in branches.items():
            compiled.attach_branch(start, branch_name, branch)

    # 5. 校验生成后的运行时图并返回。
    return compiled.validate()
```

## 导读

`StateGraph` 是可变 builder：开发者逐步加入 schema、node、edge 和 branch。`CompiledStateGraph` 是某一时刻的可执行快照：包含 Pregel actors、channels、触发器、写入器以及持久化/缓存依赖。把两者分开，相当于编译器分开 AST 与 executable plan。

compile 的核心工作不是把 Python 变成机器码，而是“降低抽象层级”。State 字段变成 channel；节点函数变成 Runnable + input mapper + ChannelWrite；静态边变成目标节点触发 channel；多起点边变成 barrier channel；条件分支变成动态写入。

这个边界提供三种工程收益：提前拒绝部分结构错误；冻结一份能被并发调用的执行计划；把 checkpointer/store/cache/interrupt 组合到统一运行时。代价是 builder 之后的修改不会进入已有 compiled graph，部署时必须管理图版本。


## 分章正文

### Builder 是声明，CompiledGraph 是执行计划

kicker: "01 · TWO REPRESENTATIONS"

builder 需要适合编辑：节点按名字存入 dict，边保留为集合，branch 保留路由函数，schema 保存 Python 类型。它追求可读和可验证，不必直接满足高效调度。

运行时需要适合执行：根据 channel 版本找到活跃节点，读取投影后的输入，调用 Runnable，把 partial update 写入 channel，并产生下一步 trigger。若每一轮都重新解释高层 schema 和 edge，复杂度和错误面都会增加。

compile 正是二者的翻译层。它保留 `builder` 引用用于 JSON Schema 和图可视化，但调度依赖编译后的 `nodes/channels`。

#### 本章结论

“为什么要 compile”应回答数据结构和运行合同如何变化，而不是只说“框架要求调用”。

### 编译期只能证明结构不变量

kicker: "02 · VALIDATION"

`StateGraph.validate()` 会要求至少有一条从 START 出发的入口，检查 edge/branch 目标是否存在，并验证 interrupt 节点。`add_edge` 本身也拒绝以 END 为起点或以 START 为终点。

它无法证明 node 必定返回 dict、conditional route 只返回声明目标、reducer 满足结合律、循环最终停止或副作用幂等。这些属于运行时检查、类型测试和故障演练。

成熟的课程要把“compile 通过”视为结构证据，而非正确性证书。测试矩阵仍需覆盖无效返回、冲突写入、异常、超时和迁移。

#### 代码

```python
def validate_graph(nodes, edges):
    if not any(start == "__start__" for start, _ in edges):
        raise ValueError("graph needs an entrypoint")

    valid_sources = set(nodes) | {"__start__"}
    valid_targets = set(nodes) | {"__end__"}

    for start, end in edges:
        if start not in valid_sources:
            raise ValueError(f"unknown edge source: {start}")
        if end not in valid_targets:
            raise ValueError(f"unknown edge target: {end}")
```

#### 本章结论

结构验证缩小错误空间，却不能替代语义和故障测试。

### State 字段为何会变成 channel

kicker: "03 · SCHEMA LOWERING"

每个 State key 都有 value type、update type 和 reducer。默认覆盖语义可用 LastValue 表达，`Annotated[list, operator.add]` 则可编译为聚合 channel。节点不直接提交完整 State，而是向一个或多个 channel 发送 update。

input_schema 和 output_schema 是完整 State 的投影。输入可以只暴露 user_input，内部节点仍可写 OverallState 中已注册的字段；输出再过滤掉内部过程字段。

managed value 与普通 channel 不同，它由 runtime 计算或注入，例如剩余步数。compile 在计算 stream/output 表面时排除它，避免把调度状态误当业务持久数据。

#### 本章结论

Schema 不只是静态类型；它决定运行时 channel 和 reducer 合同。

### attach_node 组合读取、执行和写入

kicker: "04 · NODE LOWERING"

`attach_node` 为节点选择 input channels，必要时把 dict 映射为 Pydantic/dataclass schema，然后把用户函数作为 `bound` Runnable 放进 PregelNode。

节点返回值先经过 `_get_updates`。dict 只保留已声明 output key；Command 会拆出 update 和 control；错误类型会触发 `InvalidUpdateError`。接着 ChannelWrite 把数据写到 State channels。

每个普通节点还有 `_CHANNEL_BRANCH_TO:<node>` 触发 channel。静态边和条件分支都通过向这类 channel 写入空信号来激活下一节点。

#### 本章结论

一个用户 node 在运行时是 read mapper → Runnable → update/control writer 的组合。

### 单边与 join 会编译成不同 channel

kicker: "05 · EDGE LOWERING"

A → B 的静态边会给 A 增加 writer，向 B 的 branch trigger channel 写入信号。B 订阅该 channel，所以只有上一步 A 完成并提交写入后才会被 Plan 选中。

`add_edge([A, B], C)` 表示 join。compile 创建 `NamedBarrierValue`，A/B 各写入自己的名称，C 只有在 barrier 收齐集合后才触发。

这解释了为什么“B 和 C 都指向 D”与 `add_edge([B, C], D)` 语义不同。前者可能让 D 分别触发，后者要求同一轮/协议中的全部上游完成。

#### 本章结论

边不是一条可视化线；它会选择具体的信号与 barrier 语义。

### checkpointer、store 与 cache 为什么在 compile 注入

kicker: "06 · RUNTIME DEPENDENCIES"

checkpointer 保存 thread 内执行快照，store 提供跨 thread 的长期数据访问，cache 根据节点输入复用任务结果。三者生命周期和一致性合同不同，不能互相替代。

把它们放在 compile 边界，使同一 graph definition 可以编译成测试版、内存版或生产版。节点通过 Runtime 获取依赖，不需要把数据库对象写进 State。

interrupt_before/after 也在这里绑定，因为暂停点属于可执行计划。修改 interrupt 集合通常意味着新 compiled graph，而非修改某个请求 State。

#### 本章结论

compile 是把纯拓扑与部署策略组合起来的装配边界。

### 编译后修改 builder 为什么危险

kicker: "07 · IMMUTABILITY"

`add_node` 在 builder 已编译后会警告：新增节点不会反映到已有 compiled graph。因为 attach 已生成 nodes、channels 和 triggers，自动增量同步容易制造半更新计划。

正确做法是把 builder 构造封装成纯函数，每次部署创建新 builder 并 compile。测试不要复用被多 case 修改的全局 builder。

持久线程还会引用节点名称和 channel schema。新编译计划能加载旧 checkpoint，不代表任意拓扑变化都安全；中断中的线程尤其不能丢失即将执行的节点。

#### 本章结论

CompiledGraph 是版本化执行计划；修改 builder 后应重新编译并做迁移评估。

### 如何证明自己的 mini compile 真正工作

kicker: "08 · VERIFICATION"

不要只断言 `compile()` 返回对象。检查生成计划：START input channel、每个 node 的 subscriptions、每条 edge 的 writer、join barrier 的 expected set、公开 output keys。

加入负例：缺 START、未知 target、重复 node、END 作为 source、START 作为 target、节点返回未声明字段。明确哪些在 build、compile 或 run 阶段失败。

最后运行 builder 与 compiled plan 的隔离测试：compile 后修改 builder，新计划前后结果应不同，旧 compiled graph 必须保持原执行结构。

#### 本章结论

编译器测试既要验证生成结构，也要运行一条端到端时间线。

### 把一张两节点图逐字段映射到运行时

kicker: "09 · COMPILATION MAP"

以 `START→normalize→score→END` 为例。builder 的 `nodes` 保存两个 StateNodeSpec，`edges` 保存三条声明边；State schema 中 text、normalized、score 各产生一个 channel。compile 另外创建 START EphemeralValue，并把它设为 input_channels。

attach_node(normalize) 让该 PregelNode 订阅自己的 branch trigger，读取 input schema 对应 channels，通过 mapper 组装 state，执行 Runnable 后由 `_get_updates` 提取 normalized。它的 writers 还会发布 score 的 trigger，因为存在 normalize→score。

attach_node(score) 读取 barrier 后包含 normalized 的新快照，发布 score update。score→END 不会创建 END actor 或目标 trigger；score 完成后没有任何新消息，下一次 Plan 为空并正常结束。

若 output schema 只有 score，调用者只得到 score；text 和 normalized 仍留在内部 channel/checkpoint。若把 normalize→score 改成条件 branch，compile 会把 route runnable 和动态 writes 挂到 normalize，而非生成固定 writer。

手工完成这张映射表后，再阅读源码会发现 `compile` 的多数分支都在处理同一翻译任务的变体：不同 schema mapper、等待多源的 barrier、Command/Send 控制包、defer 节点、error handler，以及 checkpointer/store/cache 的装配。

再向下追踪一次失败路径：节点返回字符串时，Runnable 本身可以正常结束，但 attach_node 生成的 `_get_updates` 无法把它解释为 channel writes，于是抛 InvalidUpdateError；若节点写入拼错的字段，更新过滤或类型测试应尽早暴露。由此可以把错误定位为“用户函数执行失败”“返回协议失败”“reducer 合并失败”三类，而非统一归因于 compile。

编译产物还应带版本证据。生产部署可记录 graph name、代码 commit、State schema version、checkpointer serializer version 和节点清单摘要；恢复旧 thread 时先选择兼容 compiled plan，再加载 checkpoint。只保存一张 Mermaid 图片无法回答运行时到底使用哪份计划。

最后比较“编译时参数”和“调用时参数”：checkpointer、store、cache 与 interrupt 集合决定执行计划具备哪些基础设施；thread_id、tags、recursion_limit 和 context 则随 invoke config 变化。把前者藏在每次请求配置里会产生不可预测的运行时差异，把后者硬编码进 compiled graph 又会破坏多租户与测试隔离。

#### 本章结论

能从声明图预测 nodes、channels、triggers 和 writers，才算真正掌握 compile，而非记住调用顺序。

## 核心机制

- StateGraph 保存可编辑的 nodes、edges、branches、schemas 与 reducer。
- compile 先规范化 checkpointer，再执行 builder 结构验证。
- State schema 被降低为普通 channels 与 managed values。
- input/output schema 决定外部调用和返回投影，不等同于内部完整 State。
- CompiledStateGraph 继承 Pregel，因此天然提供 invoke、stream、batch 和 async API。
- attach_node 构造 mapper、PregelNode、Runnable bound 和 ChannelWrite。
- attach_edge 把单边变成目标 trigger，把多起点 join 变成 NamedBarrierValue。
- attach_branch 把路由结果映射为动态 channel writes 或 Send task。
- checkpointer/store/cache/interrupt 在 compile 边界绑定到执行计划。
- 返回前对生成后的 compiled graph 再做运行时结构验证。

## 常见误区

- 认为 compile 只是设置一个布尔值。
- compile 通过后就不写节点返回值和 reducer 测试。
- 把 output schema 当作节点只能写入的完整字段集合。
- 混淆 checkpointer、store 和 cache 的一致性语义。
- 编译后继续修改 builder，并期待旧 graph 自动更新。
- 把 join 画成两条普通边，忽略 barrier 语义。
- 把数据库连接放进 State，而非通过 Runtime 注入。
- 部署新 graph definition 时忽略中断线程和旧 checkpoint。

## 实现变体

### 每次请求重新 build + compile

useWhen: "教学、极小动态图，且构建成本可忽略。"
tradeoff: "定义灵活；重复验证和生成计划增加延迟，也更难固定部署版本。"

### 进程启动时 compile 一次

useWhen: "绝大多数固定拓扑生产服务。"
tradeoff: "调用快且版本明确；按租户变化应放到 Runtime/State，不能偷偷改 builder。"

### 按 graph version 缓存多个 compiled plan

useWhen: "需要灰度、迁移旧 thread 或并行维护版本。"
tradeoff: "恢复兼容更强；版本路由、资源释放和 observability 标签更复杂。"

## 可运行示例

```python
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

Node = Callable[[dict[str, Any]], dict[str, Any]]
START, END = "__start__", "__end__"


@dataclass
class NodePlan:
    name: str
    run: Node
    subscribes: set[str] = field(default_factory=set)
    publishes: set[str] = field(default_factory=set)


@dataclass(frozen=True)
class CompiledPlan:
    nodes: dict[str, NodePlan]
    state_keys: frozenset[str]
    input_keys: frozenset[str]
    output_keys: frozenset[str]


class MiniStateGraph:
    def __init__(
        self,
        state_keys: set[str],
        *,
        input_keys: set[str],
        output_keys: set[str],
    ):
        self.state_keys = state_keys
        self.input_keys = input_keys
        self.output_keys = output_keys
        self.nodes: dict[str, Node] = {}
        self.edges: list[tuple[str, str]] = []

    def add_node(self, name: str, node: Node) -> "MiniStateGraph":
        if name in {START, END} or name in self.nodes:
            raise ValueError(f"invalid or duplicate node: {name}")
        self.nodes[name] = node
        return self

    def add_edge(self, start: str, end: str) -> "MiniStateGraph":
        self.edges.append((start, end))
        return self

    def validate(self) -> None:
        if not any(start == START for start, _ in self.edges):
            raise ValueError("graph must have an entrypoint")
        for start, end in self.edges:
            if start not in self.nodes and start != START:
                raise ValueError(f"unknown source: {start}")
            if end not in self.nodes and end != END:
                raise ValueError(f"unknown target: {end}")

    def compile(self) -> CompiledPlan:
        self.validate()
        plans = {
            name: NodePlan(name=name, run=node)
            for name, node in self.nodes.items()
        }

        # START 不是业务节点；它只把输入投递给首批节点。
        for start, end in self.edges:
            trigger = START if start == START else f"branch:{start}->{end}"
            if end != END:
                plans[end].subscribes.add(trigger)
            if start != START and end != END:
                plans[start].publishes.add(trigger)

        # 用新集合冻结公开 schema；后续修改 builder 不影响该 plan。
        return CompiledPlan(
            nodes=plans,
            state_keys=frozenset(self.state_keys),
            input_keys=frozenset(self.input_keys),
            output_keys=frozenset(self.output_keys),
        )


def normalize(state: dict[str, Any]) -> dict[str, Any]:
    return {"text": state["text"].strip().lower()}


builder = MiniStateGraph(
    {"text", "internal_score"},
    input_keys={"text"},
    output_keys={"text"},
)
builder.add_node("normalize", normalize)
builder.add_edge(START, "normalize").add_edge("normalize", END)

plan_v1 = builder.compile()
assert plan_v1.nodes["normalize"].subscribes == {START}
assert plan_v1.output_keys == {"text"}

# 编译后修改 builder，只会影响下一份计划。
builder.add_node("unused", lambda state: {})
plan_v2 = builder.compile()
assert "unused" not in plan_v1.nodes
assert "unused" in plan_v2.nodes
```

## 搭积木复现

### 积木 1：定义 builder 表示

只保存 nodes、edges、state/input/output schema，不要让它直接承担运行状态。

### 积木 2：实现结构验证

覆盖缺入口、未知节点、保留名冲突和非法 END/START 方向。

### 积木 3：生成 NodePlan

把函数包装为包含 subscriptions 与 publications 的运行计划。

### 积木 4：编译普通边

为目标生成 trigger，为源生成 writer；END 只终止，不创建普通 node。

### 积木 5：加入 schema 投影

区分内部完整 state、调用 input 和公开 output。

### 积木 6：加入 join barrier

把多起点边编译为 expected set，只有全部到齐才触发目标。

### 积木 7：冻结计划

compile 后修改 builder，旧 plan 的 nodes/edges/schema 不得变化。

### 积木 8：对照上游 attach_*

逐项映射到 StateGraph.compile、CompiledStateGraph.attach_node/edge/branch。

## 自检

### 问题

给定 OverallState={input, normalized, score, trace}、InputState={input}、OutputState={score}，节点 normalize 返回 normalized 和 trace。请沿 StateGraph.compile 解释这四个字段如何进入 channel、节点为何能写 InputState 之外的字段、invoke 最终为何只返回 score，以及编译后新增 edge 为什么不会改变旧 graph。

### 站内答案

compile 会收集 OverallState 及节点引用过的 schema，把四个普通字段建立为内部 channels；InputState 只决定 START 输入 channel 接受和向首节点投影哪些字段，并不把内部可写集合缩小到 input。attach_node 的 `_get_updates` 以完整 builder channels 作为普通节点 output_keys，因此 normalize 可以发布 normalized/trace。OutputState 用于计算 `output_channels`，invoke 结束只从 score channel 组装公开返回，内部 normalized/trace 仍可参与调度和 checkpoint。compile 已把当时的 edges 翻译成 PregelNode writers、target triggers 或 barrier channels；旧 CompiledStateGraph 持有这份生成结构，之后 builder.add_edge 只修改声明对象，必须重新 compile 才能进入新运行计划。
