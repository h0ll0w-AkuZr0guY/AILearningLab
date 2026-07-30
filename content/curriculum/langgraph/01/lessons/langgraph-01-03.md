---
id: "langgraph-01-03"
track: "langgraph"
title: "Pregel super-step：Plan、Execute、Update 与 BSP barrier"
depth: "deep"
exampleLanguage: "python"
readingMinutes: 36
sourceMinutes: 59
practiceMinutes: 90
reviewMinutes: 15
---

## 官方入口

title: "LangGraph runtime · Overview"
url: "https://docs.langchain.com/oss/python/langgraph/pregel#overview"

Pregel 按 Bulk Synchronous Parallel 模型运行。每一步先 Plan 选出 actor，再并发 Execute；本轮写入对其他 actor 不可见，全部完成后才在 Update 阶段应用 channel updates。

## 真实源码

repo: "langchain-ai/langgraph"
file: "libs/langgraph/langgraph/pregel/_loop.py"
symbol: "PregelLoop.tick / PregelLoop.after_tick"
language: "python"
url: "https://github.com/langchain-ai/langgraph/blob/30c4d58db86455128e42ddec96b1ba53c553ba22/libs/langgraph/langgraph/pregel/_loop.py#L599-L706"

### 逐段讲解

- `tick()` 对应 Plan，并准备 Execution 所需 task；真正执行由 PregelRunner 完成，循环随后调用 `after_tick()` 进入 Update。
- `prepare_next_tasks` 不只看抽象边，而是比较 checkpoint 中每个节点已见 channel version、updated_channels、PUSH task 和 pending writes。
- 同一轮任务执行时把 writes 收集在 task 上；只有 `after_tick → apply_writes` 才改变 channel，可见性 barrier 因此落在数据结构上。
- 恢复时 `_reapply_writes_to_succeeded_nodes` 复用本轮已成功任务的写入，失败或 interrupt task 仍可重做。更完整语义会在持久化模块展开。
- `not self.tasks` 才是调度停机；`out_of_steps` 是保护失败。两者不能在产品状态上都写成 completed。
- Update 后立即生成 checkpoint，并在正确边界检查 interrupt_after，保证暂停点对应稳定快照。

### 源码节选

```python
def tick(self) -> bool:
    # Plan 前先检查最大 super-step；超限是运行时失败，不是业务成功。
    if self.step > self.stop:
        self.status = "out_of_steps"
        return False

    # 根据 checkpoint、channel versions、pending writes 和 trigger
    # 物化本轮 PregelExecutableTask。
    self.tasks = prepare_next_tasks(
        self.checkpoint,
        self.checkpoint_pending_writes,
        self.nodes,
        self.channels,
        self.managed,
        self.config,
        self.step,
        self.stop,
        for_execution=True,
        updated_channels=self.updated_channels,
        retry_policy=self.retry_policy,
        cache_policy=self.cache_policy,
        ...,
    )

    if not self.tasks:
        self.status = "done"
        return False

    # 恢复时可把已经成功任务的 pending writes 重新挂回，
    # 避免与失败兄弟一起无条件重做。
    if not self.is_replaying and self.checkpoint_pending_writes:
        self._reapply_writes_to_succeeded_nodes(self.tasks)

    if should_interrupt(...):
        self.status = "interrupt_before"
        raise GraphInterrupt()

    return True


def after_tick(self) -> None:
    # Update barrier：收集本轮所有 task writes 后统一归并。
    self.updated_channels = apply_writes(
        self.checkpoint,
        self.channels,
        self.tasks.values(),
        self.checkpointer_get_next_version,
        self.trigger_to_nodes,
    )
    self.checkpoint_pending_writes.clear()
    self.is_replaying = False
    self._put_checkpoint({"source": "loop"})

    if should_interrupt(...):
        self.status = "interrupt_after"
        raise GraphInterrupt()
```

## 导读

super-step 是理解 LangGraph 并发语义的核心单位。同一轮被选中的节点都从轮次开始时的 channel 快照读取，执行产生的 writes 暂存在任务中。无论一个节点比兄弟快多少，它的结果都不会在当前轮被另一个兄弟读取；所有选中任务结束后，Update barrier 才统一归并。

这与普通 `asyncio.as_completed` 的流式依赖不同。Pregel 可以并发执行任务，却故意延迟可见性，以换取可推演的轮次语义、确定性 reducer 顺序、稳定 checkpoint 和故障恢复边界。

Plan 并非遍历所有 edge。运行时维护 channel versions 和每个节点 `versions_seen`，只有订阅的 channel 自上次执行后更新，节点才会被激活。循环、静态边、条件分支和 Send 最终都转成 channel/trigger 或 PUSH task。

## 分章正文

### Bulk Synchronous Parallel 的三个承诺

kicker: "01 · BSP"

Plan 决定“本轮谁运行”；Execution 保证选中任务在同一逻辑轮次执行；Update 把所有写入一次性提交。逻辑同步不要求 CPU 真正同时开始，也不承诺完成时间相等。

关键承诺是 snapshot isolation：本轮 actor 看不到兄弟本轮产生的 update。下一步节点只会读取 barrier 后的新快照。

这让执行时间线可以写成 S0 → Tasks(S0) → Writes → S1，而不是由每个 await 完成顺序产生无数中间状态。

#### 本章结论

super-step 是可见性和恢复边界，不只是“循环执行一次”。

### Plan 如何从 channel version 选择节点

kicker: "02 · PLAN"

每个 channel 有版本，checkpoint 记录当前 `channel_versions`；每个 node 记录 `versions_seen`。某订阅 channel 的当前版本高于节点已见版本，说明出现新消息，节点可进入下一轮。

第一轮由 START input channel 激活入口节点。静态 edge 在上一步写入目标 trigger channel，条件分支写入选中目标的 branch channel，Send 则创建 PUSH task。

Plan 还需要重建 task path、retry/cache policy、runtime context 和 read mapper。相同 node 名可能因多个 Send 输入产生多个独立 task，因此 node 与 task 不是一对一。

#### 本章结论

调度依据是未消费的 channel 更新与 task，而非按邻接表无条件走边。

### 并发执行不等于共享可变 State

kicker: "03 · EXECUTE"

runner 可以用线程或 asyncio 并发执行本轮任务。每个任务从 channel snapshot 组装自己的 node input，返回 partial update 或 Command，再转换为 writes。

如果两个节点原地修改同一个 Python list，即使 channel barrier 存在，也会通过对象别名泄漏本轮写入，破坏快照隔离。因此节点应把 State 当只读输入，返回新 update。

同步函数在 async 调用中可能通过执行器运行，但取消和 timeout 不能安全终止正在执行的同步 Python 代码。需要强超时边界的 I/O 节点应提供原生 async 实现。

#### 本章结论

Pregel 隔离的是 channel 提交，不会魔法般复制你传入的每个可变对象。

### apply_writes 为什么先排序再调用 reducer

kicker: "04 · UPDATE"

上游 `apply_writes` 先按 task path 的稳定前缀排序，再按 channel 分组 writes。随后每个 channel 自己的 `update(vals)` 决定覆盖、追加、聚合或报冲突。

LastValue 通常要求一轮最多一个更新；BinaryOperatorAggregate 依次应用 reducer；Topic 可收集多个值。运行时排序提供稳定输入序列，但 reducer 若不满足适当的代数性质，拓扑变化仍可能改变结果。

成功更新的 channel 获得新 version，并加入 `updated_channels`。下一轮 Plan 只需查这组 channel 能触发哪些 nodes。

#### 代码

```python
# 反例：字符串拼接不是交换的。
def concat(current: str, update: str) -> str:
    return current + update

# 并行节点分别写 "A"、"B"。框架会稳定排序 task，
# 但一旦 task path 或 fan-out 结构改变，结果可能从 "AB" 变成 "BA"。
# 若业务只关心集合，应使用 set union 或显式排序后的结构。
```

#### 本章结论

确定任务排序能复现当前计划，不代表任意 reducer 都对并行拓扑变化稳定。

### 为什么快节点不能提前唤醒下游

kicker: "05 · BARRIER"

假设 retrieve 和 profile 在同一轮并行，answer 依赖二者。retrieve 先结束时，它的 writes 仍停在 task buffer；answer 不会在兄弟 profile 结束前启动。

after_tick 将二者写入 channel 后，下一轮 Plan 才观察 updated channel。若 answer 使用显式 join barrier，还必须收齐两个上游信号。

这个语义提高可预测性，却会让最慢兄弟决定轮次延迟。若需要某分支先到先处理，应建更细的流式拓扑或独立 worker，而不是期待 barrier 自动消失。

#### 本章结论

super-step 的尾延迟由该轮最慢必需任务决定，这是确定性换来的成本。

### 同一轮一个任务失败后发生什么

kicker: "06 · FAILURE"

Execution 阶段可在某任务失败时终止本轮。已成功兄弟的 writes 可以作为 pending writes 写入 checkpoint；恢复时重新挂回，而失败任务按 retry policy 重做。

这比“整轮全部重做”减少成本，但外部副作用仍需幂等。任务已调用模型或 API，却在结果写入 checkpoint 前崩溃，恢复无法知道远端动作是否发生。

错误处理节点、重试和超时属于 task policy；业务补偿属于图或外部事务。两者不要用一个笼统 catch-all 混合。

#### 本章结论

运行时能保存任务写入进度，却不能替外部系统提供原子提交。

### done、out_of_steps、interrupt 与 cancelled 不同

kicker: "07 · HALTING"

没有 task 可准备时 status=done，代表消息耗尽、所有 actor inactive。达到 stop 时 status=out_of_steps，说明运行保护触发，通常应向调用者暴露 `GraphRecursionError`。

interrupt_before/after 是可恢复暂停，checkpoint 中应能继续；cancelled 是外部请求停止，是否保存部分结果取决于宿主协议。

产品状态必须保留这些区别。把所有情况都映射成“已结束”会让监控、重试和用户体验失真。

#### 本章结论

停机原因是运行合同的一部分，不只是 while 循环返回 False。

### 用虚拟 scheduler 证明轮次语义

kicker: "08 · TESTING"

测试建立两个并行节点 left/right，让 left 立即完成，right 受 deferred gate 控制。断言 gate 释放前下游未启动，且 right 在本轮看不到 left 的 update。

交换完成顺序，barrier 后 State 应相同；若 reducer 对顺序敏感，测试应明确记录期望 task path 排序。

再覆盖一个任务失败、一个成功的恢复：成功 writes 不应重复执行纯任务，外部副作用节点则必须通过 idempotency key 验证重复调用安全。

#### 本章结论

super-step 测试要控制完成顺序和可见性，不能靠 sleep 猜并发。

### 一次完整 super-step 的可观察时间线

kicker: "09 · TIMELINE"

轮次开始时 checkpoint 已固定 channel values 与 versions。Plan 读取这些版本并生成 task identity、path、trigger、input 和 policy；debug stream 此时可以发出 tasks 事件，但业务 State 尚未变化。

Runner 启动任务后，每个节点产生 writes、error、interrupt 或 return。成功完成只代表任务 buffer 有结果；values stream 要等 apply_writes 更新了对应 output channel 才能宣告新快照。

Update 会消费本轮读取过的 channels、按 channel 归并 writes、递增版本、标记 updated_channels，并在可能的最后一轮调用 channel.finish。随后清理 pending writes、保存 checkpoint，再检查 interrupt_after。

因此 trace 中 node end、updates stream、values stream 和 checkpoint event 可能处于同一轮的不同位置。调试时必须先问观测的是 task 完成、partial update 还是已提交 State，不能把时间戳接近的事件视作同一语义。

如果要计算节点延迟、super-step barrier 等待和端到端延迟，应分别打点 task start/end、最后一个任务结束、apply_writes 完成与 checkpoint 持久化完成。只用 graph.invoke 总耗时会把模型、队列、reducer、序列化和存储混在一起。

#### 本章结论

把事件放回 Plan/Execute/Update 位置，才能正确解释 stream、checkpoint 与节点日志。

## 核心机制

- START/input channel 在第一轮触发入口 actor。
- Plan 比较 channel_versions 与 node versions_seen，选择有新消息的 actor。
- 同一 node 可由多个 Send 形成多个独立 PUSH tasks。
- Execution 并发运行本轮 tasks，并把结果暂存为 task writes。
- 本轮 writes 在 after_tick 前对所有节点不可见。
- apply_writes 先稳定排序 task，再按 channel 分组更新。
- channel.update 实现覆盖、追加、聚合、barrier 或冲突检测。
- 成功更新的 channel 递增版本，并驱动下一轮 trigger。
- 无 task 表示正常 done，超过 stop 表示 out_of_steps。
- Update 后 checkpoint 把稳定快照与 interrupt_after 对齐。

## 常见误区

- 把 super-step 解释成“每个节点执行一次”。
- 认为并发兄弟能立即读取先完成节点的写入。
- 在节点内原地修改共享 list/dict，绕过 channel barrier。
- 用 `as_completed` 风格直觉解释 BSP 更新可见性。
- 并行 reducer 非结合/非交换，却不写顺序测试。
- 把 out_of_steps 当成业务成功结束。
- 认为成功 task 的 pending writes 等同于外部副作用 exactly once。
- 用真实 sleep 测试轮次，造成偶发失败。

## 实现变体

### 严格 BSP super-step

useWhen: "需要可推演快照、稳定 reducer、checkpoint 与恢复。"
tradeoff: "语义清楚；受最慢任务 barrier 影响，细粒度流式反馈要另建通道。"

### 事件驱动逐结果推进

useWhen: "下游能独立消费任一分支结果，且接受完成顺序影响。"
tradeoff: "首结果延迟低；中间状态、恢复与确定性更复杂。"

### 外部并行任务 + 图内 join

useWhen: "任务很长、需独立扩缩容或跨服务执行。"
tradeoff: "运行资源隔离；需要 job identity、回调去重、取消和结果持久化协议。"

## 可运行示例

```python
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import Any, Callable

Node = Callable[[dict[str, Any]], dict[str, Any]]


@dataclass(frozen=True)
class Actor:
    name: str
    triggers: frozenset[str]
    run: Node


class MiniPregel:
    """演示 Plan → Execute → Update；为可读性使用顺序调用模拟并发。"""

    def __init__(
        self,
        actors: list[Actor],
        initial_channels: dict[str, Any],
        reducers: dict[str, Callable[[Any, list[Any]], Any]],
    ):
        self.actors = actors
        self.channels = dict(initial_channels)
        self.reducers = reducers
        self.updated = {"__start__"}
        self.step = 0
        self.trace: list[dict[str, Any]] = []

    def plan(self) -> list[Actor]:
        return [
            actor
            for actor in self.actors
            if actor.triggers & self.updated
        ]

    def tick(self) -> bool:
        selected = self.plan()
        if not selected:
            return False

        # 所有 actor 读取同一轮开始时的快照。
        snapshot = dict(self.channels)
        task_writes: list[tuple[str, str, Any]] = []

        # 真实运行时可并发；教学版故意打乱调用顺序也不改变可见性。
        for actor in reversed(selected):
            update = actor.run(dict(snapshot))
            for channel, value in update.items():
                task_writes.append((actor.name, channel, value))

        # Update barrier：先按 task 名稳定排序，再按 channel 归并。
        grouped: dict[str, list[Any]] = defaultdict(list)
        for actor_name, channel, value in sorted(task_writes):
            grouped[channel].append(value)

        self.updated = set()
        for channel, values in grouped.items():
            reducer = self.reducers[channel]
            self.channels[channel] = reducer(self.channels.get(channel), values)
            self.updated.add(channel)

        self.trace.append(
            {
                "step": self.step,
                "actors": sorted(actor.name for actor in selected),
                "snapshot": snapshot,
                "writes": task_writes,
                "after": dict(self.channels),
            }
        )
        self.step += 1
        return True


def last_value(_current: Any, updates: list[Any]) -> Any:
    if len(updates) != 1:
        raise ValueError(f"LastValue 冲突：本轮收到 {len(updates)} 个更新")
    return updates[0]


def append_all(current: list[str] | None, updates: list[str]) -> list[str]:
    return [*(current or []), *updates]


actors = [
    Actor(
        "left",
        frozenset({"__start__"}),
        lambda state: {"left": 2, "events": "left saw no right"},
    ),
    Actor(
        "right",
        frozenset({"__start__"}),
        # 同一 super-step 内看不到 left 刚产生的 2。
        lambda state: {"right": state.get("left", 0) + 3, "events": "right used old snapshot"},
    ),
    Actor(
        "join",
        frozenset({"left", "right"}),
        lambda state: {"total": state["left"] + state["right"]},
    ),
]

engine = MiniPregel(
    actors,
    initial_channels={},
    reducers={
        "left": last_value,
        "right": last_value,
        "total": last_value,
        "events": append_all,
    },
)

while engine.tick():
    if engine.step > 10:
        raise RuntimeError("out_of_steps")

assert engine.trace[0]["actors"] == ["left", "right"]
assert engine.channels["right"] == 3      # 没读到本轮 left=2
assert engine.channels["total"] == 5      # 下一轮 join 才读到二者
assert len(engine.trace) == 2
```

## 搭积木复现

### 积木 1：建立 channel version

为每个 channel 保存 version，为每个 actor 保存 versions_seen。

### 积木 2：实现 Plan

只有订阅 channel 出现新 version 的 actor 进入本轮；首轮由 START 激活。

### 积木 3：冻结 snapshot

本轮开始复制可见 channel 映射，所有 actor 从同一份逻辑快照读取。

### 积木 4：暂存 task writes

节点返回值先写入任务 buffer，不直接修改全局 channel。

### 积木 5：实现 Update barrier

所有 task 完成后稳定排序、按 channel 分组并调用 reducer。

### 积木 6：更新 versions_seen

actor 被选中时标记已读 trigger version，防止无新消息时反复运行。

### 积木 7：加入失败与 pending writes

保存已成功兄弟 writes，失败任务恢复时重做；用 fake side effect 验证幂等。

### 积木 8：区分停机状态

分别产出 done、out_of_steps、interrupted 和 cancelled，不能只返回布尔值。

## 自检

### 问题

A 和 B 在同一 super-step 运行：A 很快返回 count=1，B 稍后读取 count 并返回 seen=count；C 订阅 A/B 的结果。初始 count=0。请说明 B 和 C 分别看到什么、writes 何时可见、若 B 失败而 A 成功，恢复时哪些部分可能重做，以及怎样测试而不依赖 sleep。

### 站内答案

A/B 都从该轮开始时的 channel snapshot 读取，所以 B 的 seen 必须是 0，不能看到 A 本轮的 count=1。A/B 的 writes 先保存在各自 task 中；只有本轮所有必需任务完成后，after_tick 调用 apply_writes 才把它们归并到 channels，C 因相关 channel 在 barrier 后更新而在下一 super-step 被 Plan 选中，因此看到 count=1 和 B 的已提交结果。若 B 失败，运行时可把 A 已成功的 pending writes 持久化并在恢复时重新挂回，B 按 retry policy 重做；但 A 的外部副作用若发生在 checkpoint 前仍需幂等，不能仅凭 pending writes 假设 exactly once。测试应使用 deferred/event gate 控制 B 的完成与失败，先断言 gate 释放前 C 未执行、B 读到旧 snapshot，再释放或 reject；交换 A/B 完成顺序并断言 barrier 后 State 一致。
