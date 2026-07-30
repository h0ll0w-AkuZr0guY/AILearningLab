---
id: "langgraph-01-04"
track: "langgraph"
title: "START、END 与静态边：入口、终止、fan-out 和 join"
depth: "deep"
exampleLanguage: "python"
readingMinutes: 32
sourceMinutes: 43
practiceMinutes: 70
reviewMinutes: 15
---

## 官方入口

title: "LangGraph Graph API · START node / END node / Normal edges"
url: "https://docs.langchain.com/oss/python/langgraph/graph-api#start-node"

START 表示把用户输入发送给首批节点的虚拟入口，END 表示终止目标。普通 edge 固定连接下一节点；一个节点有多个 outgoing edges 时，目标节点在下一 super-step 并行执行。

## 真实源码

repo: "langchain-ai/langgraph"
file: "libs/langgraph/langgraph/graph/state.py"
symbol: "CompiledStateGraph.attach_edge"
language: "python"
url: "https://github.com/langchain-ai/langgraph/blob/30c4d58db86455128e42ddec96b1ba53c553ba22/libs/langgraph/langgraph/graph/state.py#L1537-L1562"

### 逐段讲解

- `constants.py` 把 START/END 定义为 interned `__start__`/`__end__` 字符串，它们是保留地址，不能用作普通 node name。
- compile 会为 START 创建输入 `EphemeralValue` 和隐藏 PregelNode，使输入能通过与普通 channel 相同的触发协议进入首批节点。
- END 没有对应业务 PregelNode；attach_edge 遇到 end==END 时不写目标 trigger。当前分支没有后续 signal，消息耗尽后 loop 自然 done。
- 普通边通过源 node writer 写 `_CHANNEL_BRANCH_TO:<target>`。目标 node 在 attach_node 时已订阅自己的 branch channel。
- 多起点 edge 使用 NamedBarrierValue 收集 source names，目标只有在 expected set 全部到达后才触发。
- `defer=True` 目标使用 AfterFinish barrier，使执行时机推迟到图将结束的阶段，不能和普通 join 混为一谈。

### 源码节选

```python
def attach_edge(self, starts: str | Sequence[str], end: str) -> None:
    if isinstance(starts, str):
        # 普通 A → B：
        # A 完成后向 B 的 branch trigger channel 写一个信号。
        # END 不是真正需要触发的 PregelNode，所以不创建写入。
        if end != END:
            self.nodes[starts].writers.append(
                ChannelWrite(
                    (ChannelWriteEntry(_CHANNEL_BRANCH_TO.format(end), None),)
                )
            )

    elif end != END:
        # [A, B] → C 是 join，不是两条普通边。
        channel_name = f"join:{'+'.join(starts)}:{end}"

        # barrier 记录已经到达的上游名称，收齐 set(starts) 才可用。
        if self.builder.nodes[end].defer:
            self.channels[channel_name] = NamedBarrierValueAfterFinish(
                str, set(starts)
            )
        else:
            self.channels[channel_name] = NamedBarrierValue(str, set(starts))

        self.nodes[end].triggers.append(channel_name)
        for start in starts:
            self.nodes[start].writers.append(
                ChannelWrite((ChannelWriteEntry(channel_name, start),))
            )
```

## 导读

START 和 END 看起来像两个节点，实际是编译协议中的哨兵。START 把一次 invoke 的输入写入专用临时 channel，并触发入口节点；END 不执行函数，也不保存业务 State，它表示该控制分支不再产生下一节点信号。

静态 A → B 不是“调用 B”。A 的 task 在本轮结束时写入 B 的 trigger channel，B 在下一 super-step 被 Plan 选中。因此即使 A/B 都是同步函数，边仍跨越一次 barrier。

fan-out 与 join 必须分开建模。A 同时连向 B/C 会让 B/C 在下一轮并行；若 D 要等二者，则用 `add_edge([B, C], D)` 建 barrier。简单地分别 `B→D`、`C→D` 可能让 D 触发两次，语义完全不同。

## 分章正文

### 为什么入口和终点不用普通业务节点

kicker: "01 · SENTINELS"

若 START 是普通 node，就需要一个用户函数、State 输入和执行 task；而入口真正要做的只是把 invoke input 交给 channel 系统。虚拟哨兵可以让条件入口、多个入口和 checkpoint 统一处理。

若 END 是普通 node，每条结束路径还会多一次无意义 task，并要决定它的输入、返回和 checkpoint。终止更自然的定义是没有后续 trigger，下一轮 Plan 得到空 task 集。

哨兵名称保留也能在 compile 阶段拒绝非法拓扑，例如 END 作为起点、START 作为终点或用户节点占用保留名。

#### 本章结论

START/END 是控制协议地址，不应承载 prompt、I/O 或业务字段。

### START 如何把 invoke input 变成第一条消息

kicker: "02 · ENTRY"

CompiledStateGraph 的 `input_channels=START`，START channel 类型是 `EphemeralValue(input_schema)`。一次输入只服务当前执行轮次，不像持久聚合 channel 那样跨步累积。

入口可用 `add_edge(START, "node_a")` 固定，也可对 START 添加 conditional branch，让输入先路由到不同首节点。无论哪种，用户 node 都从下一调度步骤开始。

多个普通 `START→A`、`START→B` 表示两个入口并行 fan-out。它不等价于按列表顺序调用 A 再 B。

#### 本章结论

入口边决定首批活跃 actor，START 自身不会消费一轮业务计算。

### 到达 END 与整个图完成不是同一句话

kicker: "03 · END"

某分支写向 END 只表示该分支没有后续节点。若同一 super-step 还有另一个并行分支产生后续 trigger，图会继续。

整个 Pregel loop 在 Plan 无法准备任何 task 时才 done。由此可见 END 不是全局 `process.exit()`，也不会主动取消兄弟任务。

若业务要求任一分支命中条件后立即取消其他工作，需要显式 control/cancellation 协议，而不是只把 route 返回 END。

#### 本章结论

END 终止一条控制路径；全图停机由所有消息耗尽决定。

### A → B 为何至少跨一个 super-step

kicker: "04 · STATIC EDGE"

A 在本轮 Execution 中返回 update。A 的 writers 同时产生 state writes 和 B trigger write。二者在 Update barrier 一并提交。

下一轮 Plan 看到 B trigger channel version 更新，才物化 B task。B 读取的是包含 A update 的新 State snapshot。

这种设计避免 B 直接嵌套在 A 调用栈中，给 checkpoint、stream 和 interrupt_before(B) 留出稳定边界。

#### 本章结论

边是“提交后激活”，不是同步函数调用。

### 多个 outgoing edges 怎样形成并行分支

kicker: "05 · FAN-OUT"

A 同时 `add_edge(A, B)` 和 `add_edge(A, C)` 时，A writers 会向两个 branch channels 写信号。barrier 后 B/C 都在下一轮 Plan 中被选中。

B/C 读取同一个包含 A update 的快照，互相看不到本轮写入。它们若更新同一 LastValue key，Update 会因冲突失败；若要聚合必须为该 key 声明 reducer。

并行是否提高性能取决于 node 类型、async I/O、线程池和模型限流。图语义只声明可并发，不保证下层资源真的并行。

#### 本章结论

fan-out 同时引入并发机会与多写者 reducer 合同。

### NamedBarrierValue 如何表达“全部到齐”

kicker: "06 · JOIN"

`add_edge([B, C], D)` 创建 expected={B,C} 的 barrier channel。B/C 完成时各写自己的 node name，channel 收齐集合后才成为 available 并触发 D。

如果 B 通过条件路由根本不会执行，而 barrier 仍期待 B，D 将永远等待。因此静态 join 的上游集合必须和真实控制路径一致；动态 map-reduce 常用 Send/reducer 或专门聚合协议。

循环中的 barrier 还要在消费后重置到下一轮。自己复现时若只用永久 set，第二轮会因旧到达记录立即放行。

#### 本章结论

join 是带轮次生命周期的集合 barrier，不是“画两条线到 D”。

### 静态边可以构成循环，但必须有退出边

kicker: "07 · CYCLES"

A→B→A 是合法拓扑。每次节点 update 会在下一 super-step 激活对方，直到某个条件 branch 选择 END 或不再产生消息。

纯静态闭环没有状态条件可以切断，最终通常撞 recursion_limit。编译器允许环，是因为有意义的 Agent loop 依赖运行时 State 才能决定结束。

设计时把循环头、循环不变量、进度度量和退出条件写出来。只有“模型说结束”而无 schema 约束或步数保护的环很难生产化。

#### 本章结论

合法拓扑不保证可停机；循环正确性要用进度度量证明。

### 用 step trace 验证 fan-out/join，而非只看最终值

kicker: "08 · TOPOLOGY TEST"

测试 trace 应明确：step0 START，step1 A，step2 B/C，step3 D。若 D 出现在 step2，说明实现泄漏本轮写入；若出现两次，说明把 join 错写成两条普通边。

让 B/C 交换完成顺序，D 的启动 step 不变。再让一个分支失败，D 必须不执行；恢复后 barrier 只在两者有效写入到齐时开放。

加入一条 B→END 分支，证明它不会全局取消 C→D 路径。这个反例能消除“END 是立即停止”的错误模型。

#### 本章结论

拓扑测试的主要断言是节点出现在哪一轮、出现几次以及为何被触发。

## 核心机制

- START 是保留的 `__start__` 控制地址。
- compile 为 START 创建 EphemeralValue 输入 channel 与隐藏 PregelNode。
- 入口 edge 把 START 输入信号连接到首批 node trigger。
- END 是保留的 `__end__` 终止目标，没有普通业务 actor。
- 普通静态 edge 让源节点 writer 发布目标 branch trigger。
- 多个 outgoing edges 在下一 super-step 激活多个目标形成 fan-out。
- 并行节点更新同一 key 时由该 key 的 channel/reducer 决定合法性。
- 多起点 edge 创建 NamedBarrierValue，并以 source name 作为到达信号。
- 某路径到 END 不会取消仍有消息的其他路径。
- 全图在下一轮没有可选 task 时正常 done。

## 常见误区

- 给 START/END 添加业务函数或业务 State。
- 认为 A→B 会在同一调用栈或同一 super-step 执行。
- 认为任一节点到 END 就立即终止全部并行分支。
- 把 B→D、C→D 当成可靠 join，导致 D 运行两次。
- 静态 barrier 等待一个条件路径中不会执行的节点。
- fan-out 多节点写 LastValue key，却没有 reducer。
- 把可并发拓扑误当成底层资源必然并行。
- 建立纯静态闭环，没有业务退出条件。

## 实现变体

### 普通静态边

useWhen: "下一节点固定，只有一个源即可触发。"
tradeoff: "最易读、最易测试；无法根据 State 动态选择路径。"

### 多 outgoing fan-out + 显式 join

useWhen: "多个独立分支可并行，后续必须等待全部结果。"
tradeoff: "并发结构清晰；需要 reducer、错误传播和 barrier 完整性。"

### Conditional edge / Command / Send

useWhen: "目标、分支数量或 map 输入由运行时 State 决定。"
tradeoff: "表达力强；静态图、类型注解、join 与可测试性更复杂，后续路由模块详讲。"

## 可运行示例

```python
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Callable

START, END = "__start__", "__end__"
Node = Callable[[dict[str, Any]], dict[str, Any]]


@dataclass
class Barrier:
    expected: frozenset[str]
    arrived: set[str] = field(default_factory=set)

    def update(self, source: str) -> bool:
        self.arrived.add(source)
        if self.arrived == self.expected:
            self.arrived.clear()  # 下一轮 join 必须重新收齐。
            return True
        return False


class TopologyRuntime:
    def __init__(self):
        self.nodes: dict[str, Node] = {}
        self.outgoing: dict[str, list[str]] = defaultdict(list)
        self.joins: dict[str, tuple[str, Barrier]] = {}
        self.trace: list[tuple[int, list[str]]] = []

    def add_node(self, name: str, node: Node) -> None:
        if name in {START, END}:
            raise ValueError("保留名称不能作为业务节点")
        self.nodes[name] = node

    def add_edge(self, start: str, end: str) -> None:
        self.outgoing[start].append(end)

    def add_join(self, starts: set[str], end: str) -> None:
        channel = "join:" + "+".join(sorted(starts)) + ":" + end
        self.joins[channel] = (end, Barrier(frozenset(starts)))
        for start in starts:
            self.outgoing[start].append(channel)

    def run(self, state: dict[str, Any]) -> dict[str, Any]:
        active = [target for target in self.outgoing[START] if target != END]
        step = 0

        while active:
            snapshot = dict(state)
            self.trace.append((step, sorted(active)))
            writes: list[tuple[str, dict[str, Any]]] = []

            for name in active:
                writes.append((name, self.nodes[name](dict(snapshot))))

            # 教学版假定各节点写不同 key；Reducer 在下一模块实现。
            for _name, update in writes:
                overlap = state.keys() & update.keys()
                if overlap:
                    raise ValueError(f"缺少 reducer 的并行覆盖：{overlap}")
                state.update(update)

            next_active: list[str] = []
            for source, _update in writes:
                for target in self.outgoing[source]:
                    if target == END:
                        continue
                    if target in self.joins:
                        end, barrier = self.joins[target]
                        if barrier.update(source):
                            next_active.append(end)
                    else:
                        next_active.append(target)

            active = next_active
            step += 1
            if step > 10:
                raise RuntimeError("out_of_steps")

        return state


runtime = TopologyRuntime()
runtime.add_node("extract", lambda s: {"query": s["input"].strip()})
runtime.add_node("retrieve", lambda s: {"documents": [s["query"] + ":doc"]})
runtime.add_node("profile", lambda s: {"profile": "standard"})
runtime.add_node(
    "answer",
    lambda s: {"answer": f"{s['profile']} -> {s['documents'][0]}"},
)

runtime.add_edge(START, "extract")
runtime.add_edge("extract", "retrieve")
runtime.add_edge("extract", "profile")          # fan-out
runtime.add_join({"retrieve", "profile"}, "answer")
runtime.add_edge("answer", END)

result = runtime.run({"input": "refund"})
assert result["answer"] == "standard -> refund:doc"
assert runtime.trace == [
    (0, ["extract"]),
    (1, ["profile", "retrieve"]),
    (2, ["answer"]),
]
```

## 搭积木复现

### 积木 1：定义保留哨兵

拒绝业务节点占用 START/END，并限制非法 edge 方向。

### 积木 2：实现 START 投递

把 invoke input 作为首轮 snapshot，通过 outgoing START 选择入口。

### 积木 3：编译普通边

源完成后只产生目标 trigger，目标必须到下一轮才运行。

### 积木 4：实现 fan-out

同一源可写多个 target trigger，让目标共享下一轮旧快照。

### 积木 5：检测并行写冲突

无 reducer 时两个并行节点写同一 key 必须报错。

### 积木 6：实现可重置 barrier

记录 expected/arrived，收齐后触发并清空，为下一循环轮次准备。

### 积木 7：实现 END 路径

END 不产生 task；保留其他仍有 trigger 的并行路径。

### 积木 8：断言 step trace

验证 extract → [retrieve,profile] → answer 的轮次与单次执行。

## 自检

### 问题

图为 START→A，A 同时指向 B 和 C；B→END，C→D→END。另一个版本把 B/C 都连到 D。请分别推演 super-step、D 执行次数与全图结束时机，并说明如何把第二个版本改成真正的 join。

### 站内答案

第一版首轮执行 A，下一轮 B/C 并行；B 到 END 只让 B 分支不再产生 trigger，C 完成后仍会在下一轮激活 D，D 再到 END，之后 Plan 无 task 才全图 done，所以 END 不会取消 C/D。第二版若分别使用普通 B→D 和 C→D，两条源写入都可能触发 D；具体运行时会按触发 channel 产生执行，不能把它当“天然等待全部”，在循环或不同到达轮次下尤其可能多次运行。真正 join 应使用 `add_edge(["B", "C"], "D")`，compile 创建 expected={B,C} 的 NamedBarrierValue，二者各写 source name，收齐后才激活一次 D。若 B 可能条件性跳过，则这个静态 barrier 会悬挂，应重新设计动态聚合或保证所有 expected 分支实际执行。
