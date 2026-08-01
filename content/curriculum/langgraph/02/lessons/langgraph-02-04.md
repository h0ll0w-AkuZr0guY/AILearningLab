---
id: "langgraph-02-04"
track: "langgraph"
title: "append 与 replace"
depth: "deep"
visualIndex: "../visuals/langgraph-02-04.md"
exampleLanguage: "python"
readingMinutes: 24
sourceMinutes: 8
practiceMinutes: 9
reviewMinutes: 4
---

## 官方入口

title: "Graph API · Default reducer 与 Overwrite"
url: "https://docs.langchain.com/oss/python/langgraph/graph-api#reducers"

官方默认 reducer 对单一字段 update 采用覆盖；用 `Annotated` 可改为累积。当前 Graph API 还提供 `Overwrite`，用于在已配置 reducer 的字段上有意绕开其合并规则。覆盖是字段合同的一部分，绝非列表、消息或字典的“异常情况”。

## 真实源码

repo: "langchain-ai/langgraph"
file: "libs/langgraph/langgraph/channels/last_value.py"
symbol: "LastValue.update"
language: "python"
url: "https://github.com/langchain-ai/langgraph/blob/b2926a0ff9589c28c7e01fe7cdbb337b86d5a4b4/libs/langgraph/langgraph/channels/last_value.py#L20-L79"

### 逐段讲解

- 未注解字段使用 LastValue 类别的 channel，而非把 Python dict 直接 mutate。
- `update` 对空 values 不做变更；单值写入成为新 value。
- 同 step 有多个 values 时 LastValue 抛 InvalidUpdateError，拒绝以偶然完成顺序选择赢家。
- 聚合字段则由另一种 channel 逐项调用 reducer；二者不能混为“最后写入覆盖”。
- 节选省略 checkpoint 后的特殊 channel，因此课程只对普通 State key 的默认路径作结论。

### 源码节选

```python
class LastValue(Generic[Value], BaseChannel[Value, Value, Value]):
    def __init__(self, typ, key=""):
        self.typ = typ
        self.key = key
        self.value = MISSING

    def update(self, values: Sequence[Value]) -> bool:
        if len(values) == 0:
            return False
        if len(values) != 1:
            msg = create_error_message(
                message=f"At key '{self.key}': Can receive only one value per step.",
                error_code=ErrorCode.INVALID_CONCURRENT_GRAPH_UPDATE,
            )
            raise InvalidUpdateError(msg)
        self.value = values[-1]
        return True
```

## 导读

`status`、`final_answer`、`risk_score` 这类字段常有一个权威计算者；它们应 replace。`audit_events`、`citations`、`messages` 表达增量历史，通常 append 或按 ID 合并。若不先问“这个字段是当前事实还是发生过的事实”，开发者就会把所有 list append，或把所有 dict 覆盖。

把 append 想成在账本末尾记一笔，把 replace 想成更新白板上的当前温度。两者都可能是 list、dict 或字符串，容器类型并不能决定领域语义。比如 `allowed_scopes: list[str]` 可能必须 replace，因为它表示当前授权集合；`audit_events: list[Event]` 却要 append。

本课的目标是建立字段选择规则。自定义 reducer、去重和容量限制留给下一课，避免在一个“append 还是 replace”的问题中同时混入全部实现技巧。

## 分章正文

### 容器形状不是合并策略

kicker: "01 · OBSERVE"

订单 node 写 `{"items": ["A", "B"]}`，库存 node 写 `{"items": ["A"]}`。若 items 表示用户当前购物车，append 会制造重复和过期项；若表示扫描事件，replace 会丢失观察记录。先写字段的时间语义，才可选择 channel。

覆盖字段可由单 node 在一个 step 写一次；若两个 node 都能写，LangGraph 用错误迫使你声明 reducer 或加仲裁。这个限制保护的是语义，不是运行时的任性。

#### 本章结论

append/replace 由字段代表“当前快照”还是“增量历史”决定，与字段是否为 list 无关。

### 默认 LastValue 的精确边界

kicker: "02 · MODEL"

LastValue 接受零或一个值：零代表本轮没有该字段更新，一个值成为新状态，两个及以上值在同轮失败。它不是数据库的 last-write-wins，因为这里拒绝不确定的并发事实，而非按时间戳静默覆盖。

串行两个 node 都更新 status 时，每个 super-step 只有一个 update，可以自然 replace。并行流程若真有优先级，显式将候选写到 `status_candidates`，下一 node 按来源、版本或人工审批确定 status；不要把图执行顺序偷渡成优先级。

#### 代码

```python
def replace(old, writes):
    if len(writes) != 1: raise ValueError("single writer required")
    return writes[0]
```

#### 本章结论

默认覆盖是单 writer 合同；多 writer 失败比任意胜者更可恢复、更可解释。

### append 会保留什么成本

kicker: "03 · SOURCE"

对 `Annotated[list[T], add]`，聚合 channel 保存 old list 并接收 delta；对默认字段，LastValue 只保存一个最新 value。源码把多值 LastValue 转为 `INVALID_CONCURRENT_GRAPH_UPDATE`，正好对应文档的 fan-out 故障页。

append 的优点是来源和时间线可回放，代价是 checkpoint 增长、token 增长以及重复事件。生产日志需要 event_id、分页、摘要或 compaction，且必须明确压缩后还能回答哪些审计问题。只因“以后可能有用”无限保留不是可靠设计。

#### 本章结论

append 是保留增量证据的选择，同时购买了存储、延迟、去重和隐私管理责任。

### 有意覆盖累计字段时

kicker: "04 · FAILURE"

偶尔需要清空或重置累计字段，例如人工确认后用一份已审核消息集合替换草稿历史。若直接返回普通 list，reducer 仍会 append，结果是“想清空却加更多”。当前 API 的 Overwrite 是明确的逃生阀：它表明本次 update 要绕过该字段的 reducer。

这种能力应少用并被审计。覆盖历史前要写明触发者、旧值保留位置、是否影响重放以及失败后的补偿。把 Overwrite 当快捷修复会把平时可组合的状态重新变成隐式全量复制。

#### 本章结论

绕过 reducer 必须是显式、可解释的状态迁移，不应承担普通业务写入。

### 字段选择表比函数名更重要

kicker: "05 · ENGINEERING"

为每个字段写一张表：含义、owner、并发 writer、默认值、merge、容量、删除、checkpoint、PII 和迁移。`final_answer` 由 answer node replace；`messages` 由按 ID reducer 合并；`audit_events` append 后去重；`risk_candidates` 追加，由 adjudicate node replace `risk_score`。这张表是审阅 reducer 的第一手证据。

测试至少覆盖：单 writer 覆盖、同轮多 writer 失败、append 保序、显式重置和恢复后重复执行。若产品需要强一致的跨系统当前值，State reducer 仍需配合事务或权威数据源，不能假设内存图状态替代数据库。

#### 本章结论

把 merge 选择写成字段级设计表，并用冲突、重置和恢复测试证明它。

上线前可把设计表变成回放 fixture：给出初始值、两个并行 update、重复 update、reset update 和预期 checkpoint。若答案是“看运行顺序”或“由调用者临时决定”，字段合同尚未闭合，应增加稳定排序键、版本，或把决策移到单 writer node。这个测试比一次页面演示更能接近恢复路径。

容量也是 replace/append 的选择依据。当前快照字段通常可以用新值覆盖并限制大小；append 字段会随对话、trace 或诊断增长，必须决定压缩、归档、删除和恢复时的可见窗口。若一个字段既要保留全量历史又要服务低延迟 prompt，拆为 append-only 事件存储和 replace 的摘要投影，比让一个 list 承担两种相反职责可靠。

## 核心机制

### reset 必须成为一个可见事件

append 字段收到 `[]` 通常意味着“本次没有新增事件”，不会自然清空历史；把空列表解释为清空会使任何默认值意外抹掉审计链。需要截断消息、重建索引或撤销候选时，要选用官方 Overwrite 语义或一个专门的 reset/update 协议，并让调用方、checkpoint 迁移和 UI 都看得到这次破坏性改变。

replace 也不意味着“最后到达者赢”。同一 super-step 两个普通 LastValue 写入会触发并发更新错误，正是为了拒绝把任务完成时序当领域优先级。对于订单状态，建立 `status_candidates` 的追加字段，仲裁 node 按时间、权限、证据选择唯一 status；对于事实缓存，则指定单 writer 并在 schema 上写清 owner。

字段命名可以帮助决策：`current_*`、`selected_*` 常是 replace；`events`、`observations`、`diagnostics` 多是 append；`candidates` 先 append 后仲裁。名称不是证明，但能逼迫设计者在写代码前说清时间语义与删除边界。

- 默认 LastValue 只接受每 step 一个 update。
- append 记录 delta，replace 表示当前权威快照。
- 容器类型不能决定 reducer。
- 多 writer 的 replace 冲突应通过错误或显式仲裁暴露。
- Overwrite 用于有审计理由的例外重置。

## 常见误区

- 所有 list 都 append，所有 dict 都 replace。
- 把 LastValue 当作按完成时间获胜。
- 对累计字段返回空 list 就期待清空。
- 把状态 reducer 当作跨服务事务。

## 实现变体

### 单 writer 当前值

useWhen: "字段有清晰权威来源，如最终答复或审批状态。"
tradeoff: "读取简单；并行竞争必须单独建模。"

#### 代码

```python
status = "approved"  # 唯一 owner 写入当前快照
```

### 候选累积 + 仲裁

useWhen: "多个 node 提供可解释的候选结论。"
tradeoff: "保留证据；增加状态量和一个决策 step。"

#### 代码

```python
candidates = [{"source": "fraud", "score": 0.8}]
```

## 可运行示例

```python
def last_value(writes):
    if len(writes) != 1:
        raise ValueError("INVALID_CONCURRENT_GRAPH_UPDATE")
    return writes[0]
def append(old, writes):
    return old + [x for write in writes for x in write]

assert last_value(["approved"]) == "approved"
assert append(["e1"], [["e2"], ["e3"]]) == ["e1", "e2", "e3"]
try: last_value(["approved", "rejected"])
except ValueError: pass
else: raise AssertionError("concurrent replace must fail")
print("append versus replace: ok")
```

## 搭积木复现

### 积木 1：给字段写时间语义

区分 current status、event history、候选与消息修订。

### 积木 2：实现单值 channel

零 write 保持，单 write 覆盖，双 write 报错。

### 积木 3：实现追加 channel

只接受 delta，断言旧事件不丢失。

### 积木 4：复现错误清空

向 append 字段写空列表，说明为何不是 replace。

### 积木 5：加入仲裁

把两个 status 放候选字段，使用显式规则选择当前 status。

## 自检

### 问题

一个 `allowed_scopes: list[str]` 和 `audit_events: list[Event]` 应否使用同一 reducer？请从语义、源码和失败路径回答。

### 站内答案

结论：通常不应。allowed_scopes 表示当前授权快照，宜由权威 writer replace；audit_events 表示增量历史，宜 append 并另行去重。机制：LastValue 接受单个值，聚合 channel 处理多个 delta。源码证据：last_value.py 对一个 step 多值抛并发更新错误。运行验证：示例证明单值冲突失败、事件追加保序。工程取舍：候选加仲裁提高可解释性但增加步骤。适用边界：跨服务授权仍须查询权威策略与事务边界。

## 更新日志

### 新建 append 与 replace 决策课

at: "2026-07-31T15:03:02+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "WorkBuddy · Hy3"
summary: "以 LastValue 并发保护解释字段级 append、replace、仲裁与显式重置边界。"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/15"
