---
id: "langgraph-01-10"
track: "langgraph"
title: "递归限制、停机条件与生产保护"
depth: "deep"
visualIndex: "../visuals/langgraph-01-10.md"
exampleLanguage: "python"
readingMinutes: 35
sourceMinutes: 35
practiceMinutes: 65
reviewMinutes: 15
---

## 官方入口

title: "LangGraph Graph API · Recursion limit"
url: "https://docs.langchain.com/oss/python/langgraph/graph-api#recursion-limit"

官方定义 recursion_limit 为单次执行允许的最大 super-step 数，达到上限会抛 GraphRecursionError；1.0.6 起默认值为 1000。RemainingSteps 和 metadata.langgraph_step 可用于接近上限时主动降级。

## 真实源码

repo: "langchain-ai/langgraph"
file: "libs/langgraph/langgraph/pregel/main.py"
symbol: "Pregel.stream · out_of_steps handling"
language: "python"
url: "https://github.com/langchain-ai/langgraph/blob/41341457342327166d72fc11952ab28fb61ec0bf/libs/langgraph/langgraph/pregel/main.py#L2985-L3017"

### 逐段讲解

- 代码在运行循环退出后检查 loop.status。out_of_steps 与正常所有节点 inactive 是不同终态，所以不会静默返回成功。
- sync durability 会先等待 checkpoint future，再处理退出。即使抛出 GraphRecursionError，调用者仍应通过 get_state 检查最后耐久边界，而非依赖异常对象携带全部业务状态。
- 错误消息明确指出达到限制且未命中 stop condition。提高 recursion_limit 只扩大预算，不能修复缺失 END、永真路由或没有进展的循环。
- draining 独立于 out_of_steps，代表外部控制要求优雅排空。生产系统还要把 deadline、取消、服务关闭与业务停机分开观测。
- RemainingSteps 的真实实现位于 managed/is_last_step.py，以 scratchpad.stop - scratchpad.step 计算；它是运行时托管值，不应由业务节点自行递减或持久化。

### 源码节选

```python
# 执行循环结束后先等待同步 checkpoint
emit_graph_lifecycle_events(loop)
if durability_ == "sync":
    loop._put_checkpoint_fut.result()

# 向调用者发出本轮可见输出
yield from _output(
    stream_mode,
    print_mode,
    subgraphs,
    stream.get,
    queue.Empty,
    version,
    _output_mapper,
    _state_mapper,
)

# out_of_steps 是运行保护触发，不是业务成功
if loop.status == "out_of_steps":
    message = (
        f"Recursion limit of {config['recursion_limit']} reached "
        "without hitting a stop condition. You can increase the "
        "limit by setting the recursion_limit config key."
    )
    raise GraphRecursionError(
        create_error_message(
            message=message,
            error_code=ErrorCode.GRAPH_RECURSION_LIMIT,
        )
    )
elif loop.status == "draining":
    raise GraphDrained(loop.control.drain_reason or "shutdown")
```

## 导读

循环是 LangGraph 的核心能力，也是最容易把资源耗尽伪装成“Agent 在思考”的地方。recursion_limit 提供硬护栏：一次 invoke/stream 的 super-step 超过预算而没有停机，就抛 GraphRecursionError。它类似保险丝，只负责在电流失控时切断，不会替电路设计正确工作状态。

可靠循环至少有五层出口：业务成功条件，例如证据充分；业务失败条件，例如确认无权限；进展检测，例如连续三轮没有新增信息；资源预算，例如步数、token、费用；外部控制，例如 deadline、取消与服务排空。只有最后再放 recursion_limit 兜底，才能在异常前整理部分结果。

本课把“递归”还原为 super-step 计数，而非 Python 函数递归；再用 RemainingSteps 做主动降级，设计 checkpoint 后的恢复策略和可观测指标。目标是让循环在任何出口都给出可解释状态，而非只会把限制从 25 改到 1000。


## 分章正文

### 限制计数的是 super-step，不是节点调用栈深度

kicker: "01 · WHAT IS COUNTED"

LangGraph 节点 A → B → A 每推进一轮调度就消耗 step；同一 super-step 并行执行十个节点，核心预算仍按该轮而非简单加十。子图、Send 和动态任务会让实际成本与 step 数不成线性关系，因此 step 是控制流护栏，不是精确费用单位。

recursion_limit 放在 invoke/stream 的 config 顶层。把它写进 configurable 会被当成用户配置而不生效。默认 1000 适合避免意外过早中断，却并不代表生产 Agent 应允许 1000 次模型调用；业务应按实际成本设更低预算。

#### 本章结论

step 限制约束图推进，token、时间、并发和费用仍需独立预算。

### 先定义业务完成，再定义保护上限

kicker: "02 · SEMANTIC STOP"

检索循环的成功条件可以是引用覆盖所有子问题且置信度达标；失败条件可以是连续两次查询无新文档或权限拒绝。条件必须由可审计 State 字段计算，不能只听模型输出“done”字符串，也不能把 step == limit-1 当作完成。

路由函数应返回 END、fallback 或 retry，并为每条分支写最小反例。若成功条件永远无法满足，增大 recursion_limit 只会增加延迟和费用；若条件过松，图会提前终止并把不完整答案标成成功。

#### 本章结论

停机是领域判定，限制是运行时预算，两者不能互相代替。

### 检测循环有没有获得新信息

kicker: "03 · PROGRESS"

合法循环也可能活锁：模型反复选择同一工具、查询返回相同文档、review 与 revise 来回改同一句话。记录 last_action_signature、evidence_ids、revision_hash 与 no_progress_count，可以把“仍在运行”区分成“确实前进”和“重复消耗”。

当 no_progress_count 达阈值，可切换策略、请求人工介入或返回部分结果。阈值应由离线轨迹与成本数据校准；对高风险动作宁可早停审批，对便宜搜索可给更多探索空间。

#### 代码

```python
signature = (tool_name, normalized_args)
if signature == state["last_action"]:
    no_progress = state["no_progress_count"] + 1
else:
    no_progress = 0

if no_progress >= 2:
    return Command(
        update={"status": "needs_review"},
        goto="fallback",
    )
```

#### 本章结论

生产循环要观测增量，而非只统计已经走了多少步。

### 用 RemainingSteps 预留整理和持久化的最后机会

kicker: "04 · GRACEFUL DEGRADATION"

RemainingSteps 是托管值，运行时从 stop 与当前 step 计算并注入 State view。节点在剩余两三步时可停止新搜索，转向 summarize_partial 或 human_handoff。这样图正常到达 END，用户得到带限制说明的部分结果。

不要让每个节点自行维护 remaining_steps 字段：并行分支会竞争递减，checkpoint 恢复也容易重复扣除。托管值用于运行预算，业务 State 可另存 attempts、token_spent 与 reason，作为可持久解释。

#### 本章结论

主动降级把“超限异常”改造成可设计的产品状态，但仍保留硬上限兜底。

### 步数之外还要处理墙钟时间、取消与服务排空

kicker: "05 · DEADLINE AND CANCEL"

一个节点可能等待远端模型十分钟而只消耗一个 step，因此 recursion_limit 防不住超时。请求级 deadline 应进入 runtime context，节点调用向下游传递剩余时间；取消信号要终止可取消 I/O，并让不可取消副作用用幂等键收尾。

服务发布或缩容触发 draining 时，应停止接收新工作、完成或安全 checkpoint 当前任务，再由新进程恢复。把 shutdown 当 GraphRecursionError 重试会掩盖容量问题，也可能形成风暴。

#### 本章结论

step、deadline、cancel、drain 是四种不同控制信号，指标与恢复策略应分开。

### 超限后从 checkpoint 继续必须先修复原因

kicker: "06 · RECOVERY"

捕获 GraphRecursionError 后可用相同 thread_id 读取最后 StateSnapshot，展示部分 values、next 和轨迹。若只是预算偏低且仍有明确进展，可在人工或策略批准后用更高限制继续；若路由永真或无进展，直接继续只会再次超限。

恢复决策应写入 State 或外部审计：谁提高预算、依据什么、最多增加多少、是否改变模型和工具权限。高费用或高风险流程要把预算提升视为授权事件，而非自动无限翻倍。

#### 本章结论

从超限点恢复前先分类根因：预算不足、无进展、代码缺陷或依赖阻塞。

### 用轨迹分布校准限制与告警

kicker: "07 · OPERATIONS"

监控 p50/p95 step、每 step token/延迟、no-progress 比例、GraphRecursionError 率、fallback 成功率和人工接管率。只看平均步数会隐藏少量昂贵长尾；只看异常率则会忽略大量在上限前一刻勉强完成的退化运行。

上线新 prompt、模型或工具后比较轨迹长度分布和重复 action signature。限制应根据任务类型分层：FAQ、深度研究、代码修复具有不同正常范围。告警附带 thread、checkpoint、最后节点与预算消耗，才能让运维直接定位。

#### 本章结论

限制值来自轨迹与成本证据，不来自复制示例中的常数。

## 核心机制

- recursion_limit 约束一次执行的最大 super-step 数，配置位于 config 顶层。
- 达到上限且未命中停机条件时，loop.status 变为 out_of_steps。
- Pregel.stream/astream 在退出阶段抛 GraphRecursionError，而非返回业务成功。
- RemainingSteps 由 stop - step 动态计算，是运行时 managed value。
- 业务成功、业务失败和无进展应由显式 State 与路由表达。
- step 预算不等于 token、费用、并发或墙钟时间预算。
- deadline、cancel、drain 需要独立控制路径和可观察状态。
- 同步 durability 会在退出处理前等待 checkpoint future。
- 超限后的最后 checkpoint 可用于诊断和受控恢复。
- 预算提升应有上限、证据和授权，避免自动无限循环。

## 常见误区

- 把 GraphRecursionError 当作 Python 递归栈溢出。
- 把 recursion_limit 放进 config.configurable。
- 达到上限后直接把部分 State 标为成功。
- 发现循环就只提高上限，不检查路由与进展。
- 让多个并行节点手工递减业务 remaining_steps。
- 只设置 step 限制，不给模型/网络调用 deadline。
- 把模型自述 done 当唯一成功条件。
- 异常后自动把预算翻倍并无限恢复。
- 所有任务类型共用一个限制，忽略成本分布。
- 只监控错误率，不记录 fallback、长尾和重复动作。

## 实现变体

### 外部捕获 GraphRecursionError

useWhen: "图简单，超限很少，调用层能够展示统一失败或人工处理。"
tradeoff: "接入成本低；图异常退出，最后一步无法主动整理用户友好的部分结果。"

### RemainingSteps 主动降级

useWhen: "长循环需要在预算耗尽前总结、交接或返回部分证据。"
tradeoff: "产品体验更稳；State 和路由增加 fallback 分支，必须测试边界步数。"

### 多维预算控制器

useWhen: "生产 Agent 同时受 token、费用、deadline、工具次数和风险权限约束。"
tradeoff: "控制精细且可审计；需要统一计量、原子预算扣减和跨子图传播。"

## 可运行示例

```python
from dataclasses import dataclass, field

@dataclass
class SearchState:
    evidence: list[str] = field(default_factory=list)
    status: str = "searching"

def run(state: SearchState, recursion_limit: int) -> SearchState:
    for step in range(recursion_limit):
        remaining = recursion_limit - step

        # 领域成功：证据已经达到验收门槛。
        if len(state.evidence) >= 2:
            state.status = "complete"
            return state

        # 预留最后一步做降级，不把超限伪装成成功。
        if remaining <= 1:
            state.status = "partial"
            return state

        state.evidence.append(f"evidence-{step + 1}")

    raise RuntimeError("out of steps")

complete = run(SearchState(), recursion_limit=5)
partial = run(SearchState(), recursion_limit=2)
assert complete.status == "complete"
assert partial.status == "partial"
assert partial.evidence == ["evidence-1"]
```

## 搭积木复现

### 积木 1：实现硬 step 保险丝

循环超过预算抛异常，并证明并行任务数与 step 数不是同一指标。

### 积木 2：加入业务停机

用证据质量、失败原因和 END 路由表达正常完成，禁止依赖上限。

### 积木 3：加入进展指纹

比较 action signature 与证据集合，连续无增量时切 fallback。

### 积木 4：实现剩余预算

在最后两步停止新 I/O，整理 partial result 并正常到达 END。

### 积木 5：叠加 deadline/cancel

给单节点 I/O 传递剩余墙钟时间，区分取消、超时和排空。

### 积木 6：演练超限恢复

读取最后 checkpoint，按根因决定继续、修路由或人工接管。

### 积木 7：建立轨迹指标

记录 p95 step、token、重复动作、fallback 与错误率，按任务类型校准限制。

## 自检

### 问题

一个工具调用 Agent 反复在 model 与 tools 间循环。把 recursion_limit 从 25 提到 1000 是否足够；你会怎样同时设计停机、降级、超时、恢复和监控？

### 站内答案

结论：提高上限只能延后保险丝熔断，无法修复缺失停机或重复工具调用，甚至把一次缺陷放大成昂贵长尾。先定义领域出口，例如任务完成、工具确认不可达、用户拒绝；记录 tool+normalized_args 和结果摘要，连续无新信息就转 fallback。用 RemainingSteps 在硬上限前预留总结/人工交接步骤，另设 token、费用、工具次数和墙钟 deadline，因为一个慢节点只消耗一个 step。GraphRecursionError 后读取同 thread 的最后 checkpoint，只有在仍有可证明进展且获得预算授权时才提高限制继续；永真路由应先修复。监控按任务类型记录 p50/p95 step、每步 token/延迟、重复动作率、fallback、超限和人工接管，并把 thread、checkpoint、最后节点及预算原因附在告警中。
