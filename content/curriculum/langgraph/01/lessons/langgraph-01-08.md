---
id: "langgraph-01-08"
track: "langgraph"
title: "确定性：reducer 顺序、任务排序与外部 I/O"
depth: "deep"
visualIndex: "../visuals/langgraph-01-08.md"
exampleLanguage: "python"
readingMinutes: 35
sourceMinutes: 50
practiceMinutes: 75
reviewMinutes: 15
---

## 官方入口

title: "LangGraph Functional API · Determinism"
url: "https://docs.langchain.com/oss/python/langgraph/functional-api#determinism"

官方要求把随机数、当前时间、网络结果等非确定操作封装为 task 并持久化，使同一运行恢复时沿相同调用序列复用结果；同时强调副作用仍须幂等。Graph API 的 reducer 写入顺序由运行时任务路径排序提供结构稳定性。

## 真实源码

repo: "langchain-ai/langgraph"
file: "libs/langgraph/langgraph/pregel/_algo.py"
symbol: "apply_writes"
language: "python"
url: "https://github.com/langchain-ai/langgraph/blob/41341457342327166d72fc11952ab28fb61ec0bf/libs/langgraph/langgraph/pregel/_algo.py#L232-L333"

### 逐段讲解

- 函数先按 task.path 的稳定前缀排序，而不是采用线程完成顺序。并行 I/O 谁先返回会变化，但交给 reducer 的 writes 顺序必须能重现。
- versions_seen 记录每个节点消费过的 channel version，避免未变化输入反复触发；它约束调度，不等于用户可见的业务版本。
- writes 随已排序 tasks 分组到 channel。同一 channel 的 reducer 会收到稳定序列；不同 channel 独立更新。
- channel.update 决定覆盖、追加或自定义归并。运行时只能固定输入顺序，无法让错误的、依赖隐藏全局变量的 reducer 自动纯化。
- 节选删除了特殊 channel、finish 通知和 version 生成。返回 updated channel 集合用于触发下一轮；确定调度仍不能冻结模型、时钟或外部数据库。

### 源码节选

```python
def apply_writes(
    checkpoint: Checkpoint,
    channels: Mapping[str, BaseChannel],
    tasks: Iterable[WritesProtocol],
    get_next_version: GetNextVersion | None,
    trigger_to_nodes: Mapping[str, Sequence[str]],
) -> set[str]:
    # 并发完成时间不能决定 reducer 的输入顺序
    tasks = sorted(
        tasks,
        key=lambda task: task_path_str(task.path[:3]),
    )

    bump_step = any(task.triggers for task in tasks)

    for task in tasks:
        checkpoint["versions_seen"].setdefault(
            task.name, {}
        ).update({
            channel: checkpoint["channel_versions"][channel]
            for channel in task.triggers
            if channel in checkpoint["channel_versions"]
        })

    pending_by_channel: dict[str, list[Any]] = defaultdict(list)
    for task in tasks:
        for channel, value in task.writes:
            if channel in channels:
                pending_by_channel[channel].append(value)

    updated: set[str] = set()
    for channel, values in pending_by_channel.items():
        if channels[channel].update(values):
            updated.add(channel)

    return updated
```

## 导读

确定性经常被简化成“同样输入得到同样输出”。对 Agent 工作流，更有用的目标分三层：同一 super-step 的并发 writes 以稳定顺序归并；同一已暂停运行恢复时复用已记录的非确定结果；不同全新运行允许模型、网络和时间给出不同结果。把三层混在一起，团队会对“可重放”做出超出框架能力的承诺。

LangGraph 能控制自己拥有的部分：任务路径、channel version、reducer 输入序列、checkpoint 与 task 结果。它无法控制模型供应商、远端搜索索引、数据库当前值、随机数源和操作系统调度。正确策略是把这些观察变成显式事件并持久化，再让路由只依赖已记录值。

本课用一个故意非交换的 reducer 暴露顺序问题，再把外部 I/O 划分为 observation 与 effect。observation 如模型输出影响后续路线，需要记录供恢复复用；effect 如发信改变外界，需要幂等键保证重试后业务效果收敛。需要始终追问并严格验证：这份稳定性究竟来自运行时排序、已保存事件，还是外部系统自身的协议。


## 分章正文

### 区分归并确定、恢复一致与跨运行复现

kicker: "01 · THREE CLAIMS"

归并确定性指同一批 task writes 不论实际完成先后，都按 task path 的固定顺序交给 reducer。恢复一致性指同一 run 在 interrupt 或故障后继续时，已经耐久的 task 结果不重新观察世界。跨运行复现则要求模型版本、参数、数据快照、随机种子和外部依赖都被冻结，难度最高。

工程文档应准确写出承诺。例如“同一 checkpoint 的成功任务结果会复用，未记录任务可能重跑；新运行不保证文本逐字相同”。笼统写“流程是 deterministic”会掩盖供应商升级、检索索引变化和外部副作用。

#### 本章结论

确定性是分层合同，先写清比较的是哪两个执行。

### 为什么并发完成顺序不能直接进入 reducer

kicker: "02 · ORDERED REDUCTION"

fan-out 的 A、B 都向 transcript 追加值。若 runner 谁先完成谁先 update，网络抖动就会把列表顺序变成 A,B 或 B,A，后续 prompt 与路由随之改变。apply_writes 先按稳定 task path 排序，切断 wall-clock race 与语义顺序的联系。

排序不要求 reducer 交换，但要求 path 生成稳定。对于逻辑上无序的集合，仍建议 reducer 显式按业务 key 排序或使用 map；把偶然的 fan-out 索引当领域顺序，会在拓扑调整后改变结果。

#### 代码

```python
# 完成顺序：[B, A, C]
# task path 顺序：[A, B, C]
ordered = sorted(tasks, key=lambda t: t.path[:3])
transcript = " > ".join(t.write for t in ordered)
assert transcript == "A > B > C"
```

#### 本章结论

运行时排序消除竞速，业务排序仍应由稳定领域键表达。

### 结合律、交换律、幂等性决定你能否安全并行

kicker: "03 · REDUCER LAWS"

追加列表满足结合律但不交换；集合并集同时结合、交换、幂等；数字加法结合且交换，却不幂等。知道这些性质才能判断重排、分批和重复写会怎样影响状态。自定义 reducer 若读取全局时间或原地修改输入，即使运行时固定顺序也难以重放。

对每个 reducer 做性质测试：随机生成三组 writes，验证 regroup 是否一致；打乱顺序观察是否允许；重复一项观察是否应去重。若业务需要 last-write-wins，必须定义“last”依据 task path、事件序号还是业务时间，不能默认为完成时钟。

#### 本章结论

reducer 是并行状态机的代数合同，不只是两个参数的工具函数。

### 随机数、时间和模型输出要变成已记录观察

kicker: "04 · OBSERVATIONS"

Functional API 恢复时会从 entrypoint 开头重放，并按调用位置复用已完成 task。若 time.time、random.random 或模型调用写在 task 外，恢复会得到新值，可能走到不同 interrupt 或调用序列，随后缓存结果和 resume value 都会错位。

把非确定读取放进 task 的意义并非让第一次结果可预测，而是让它一旦发生就成为该 run 的事实。Graph API 节点本身是恢复边界；昂贵观察仍应拆成独立节点或可持久 task，避免同一节点在 interrupt 重入时再次调用。

#### 本章结论

记录随机结果，而非幻想消灭随机性，才能让一次具体运行保持身份。

### 观察需要复用，副作用需要收敛

kicker: "05 · EFFECTS"

读取汇率是 observation，它影响计算，恢复应尽量复用同一次快照；提交订单是 effect，它改变外部世界，重试时必须以 operation_id 返回同一业务结果。两者都属于 I/O，却需要不同协议。

常见做法是为 observation 记录 provider、请求参数、响应、获取时间与版本；为 effect 记录 idempotency key、请求摘要、外部事务号和最终状态。只把完整 HTTP body 塞入 State 会造成密钥泄露与体积膨胀，应存安全引用或最小重放字段。

#### 本章结论

把 I/O 先分类为观察或效果，才能选择缓存、幂等或补偿。

### 部署变化也会破坏同一运行的重放序列

kicker: "06 · CODE EVOLUTION"

Functional API 用 task/interrupt 的位置匹配缓存和恢复值。若在旧运行暂停点之前新增一个 task，旧的第 N 个结果可能被交给新的第 N 个调用。官方 backward compatibility 因此建议让存量运行排空，或发布新的 entrypoint 名称。

Graph API 从节点边界重入，新增边通常安全，删除待执行节点却会失去地址。两种 API 都要求把可恢复结构当持久协议进行版本评审，而不只比较 Python 类型是否通过。

#### 本章结论

能继续运行旧 checkpoint 的代码变化，才算工作流意义上的向后兼容。

### 用扰动测试证明哪些层保持稳定

kicker: "07 · EVIDENCE"

测试一：随机打乱并发任务完成顺序，断言 reducer 结果稳定。测试二：在 interrupt 后改变系统时间与随机种子，断言已记录 task 结果仍复用。测试三：让外部 effect 在响应丢失后重试，断言幂等表只有一个业务事务号。

再运行两次全新 thread，允许模型文本不同，但要求 schema、停机条件和安全不变量成立。这样测试既不把非确定系统强行锁成字符串快照，也不放弃对可恢复结构的严格验证。

#### 本章结论

确定性测试要主动扰动调度、时间与网络，再按分层合同断言。

## 核心机制

- apply_writes 按 task.path 稳定排序，隔离实际完成时钟。
- 排序后的 writes 先按 channel 分组，再交给各 channel reducer。
- channel versions 与 versions_seen 决定哪些更新触发下一 super-step。
- 结合律影响分批归并，交换律影响重排，幂等性影响重复写。
- Functional API 用持久 task 结果让同一 run 恢复时复用非确定观察。
- task 和 interrupt 的调用位置构成 Functional API 的重放协议。
- Graph API 在节点边界恢复，节点内 interrupt 仍会从节点开头重入。
- observation 需要记录和复用，effect 需要幂等、outbox 或补偿。
- 全新 run 可以产生不同结果，可恢复 run 应保持已记录事实一致。
- 代码版本、模型版本与数据快照决定更强的跨运行复现能力。

## 常见误区

- 把稳定 reducer 顺序夸大成整个 Agent 输出确定。
- 让 reducer 读取当前时间、随机数或可变全局变量。
- 用任务完成时间定义业务上的最后写入。
- 依赖 set/dict 的偶然输出顺序形成 prompt。
- 在 Functional entrypoint 的 task 外调用模型或网络。
- 在旧暂停点前重排 task/interrupt 却继续复用原图名。
- 把 observation 与 effect 都用普通缓存处理。
- 只设随机种子，却不冻结模型、内核、数据和供应商版本。
- 用最终文本完全相等测试新 thread，造成脆弱回归门。
- 忽略 1.2.10 对持久化消息 ID 稳定性的修复背景。

## 实现变体

### 稳定有序 reducer

useWhen: "输出顺序具有语义，例如消息、步骤或证据优先级。"
tradeoff: "可解释且可重放；必须维护稳定业务 key，拓扑索引变化可能成为迁移事件。"

### 交换幂等 reducer

useWhen: "状态本质是集合、最大值或按唯一 ID 合并的映射。"
tradeoff: "对并行顺序和重复写更稳健；会丢失到达顺序，冲突解决规则需明确。"

### 事件记录后决策

useWhen: "模型、随机、时间或远端读取会改变路由且必须可恢复。"
tradeoff: "同一运行可审计；增加存储、脱敏、保留期和供应商数据许可成本。"

## 可运行示例

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class TaskWrites:
    path: tuple[str | int, ...]
    value: str

def apply_writes(tasks: list[TaskWrites]) -> str:
    ordered = sorted(
        tasks,
        key=lambda task: tuple(map(str, task.path[:3])),
    )
    return " > ".join(task.value for task in ordered)

race_order = [
    TaskWrites(("pull", 2), "B"),
    TaskWrites(("pull", 1), "A"),
    TaskWrites(("pull", 3), "C"),
]

assert apply_writes(race_order) == "A > B > C"

# 第一次随机路由的结果已变成该 run 的事件，
# 恢复只能读记录，不能重新掷骰子。
event_log = {"route-choice": "manual-review"}
assert event_log["route-choice"] == "manual-review"
```

## 搭积木复现

### 积木 1：制造竞速

让三个 task 以随机延迟完成，先观察按完成时钟 append 的不稳定结果。

### 积木 2：加入稳定 path

按路径前缀排序后再归并，重复一百次断言顺序相同。

### 积木 3：测试 reducer 定律

为 list append、set union、last-write-wins 分别检查结合、交换和幂等。

### 积木 4：记录 observation

把随机路由和当前时间封装成可持久 task，恢复时只读取事件。

### 积木 5：隔离 effect

为发送动作加入 operation_id，模拟响应丢失后的重复请求。

### 积木 6：破坏调用序列

在 Functional workflow 的 interrupt 前插入 task，写测试展示位置错配风险。

### 积木 7：做分层回归

同 run 断言事实复用，新 run 只断言 schema、停机和安全不变量。

## 自检

### 问题

两个并行节点都向同一列表 reducer 写入，模型调用又决定后续路由。LangGraph 能保证哪些顺序或结果，哪些不能；你会怎样设计可恢复且可测试的合同？

### 站内答案

结论：运行时会按稳定 task path 排序同一 super-step 的 writes，再把它们按 channel 交给 reducer，因此不会让线程完成先后直接决定列表顺序；它无法保证模型供应商每次返回相同文本，也无法让错误 reducer、外部时间或数据库自动确定。把模型调用作为独立可持久 task/节点，其响应和模型版本作为 observation 记录；同一 run 恢复时复用该结果，新的 run 允许不同。列表若存在领域顺序，应使用稳定业务 key 排序；若顺序无意义，改用按 ID 合并的交换幂等 reducer。测试要打乱完成时序、改变随机种子并恢复同一 checkpoint，验证已记录路由不变；另用新 thread 验证输出 schema、终止、安全和幂等副作用，而非强求文本逐字相同。
