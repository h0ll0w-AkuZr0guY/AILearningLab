---
id: "langgraph-01-06"
track: "langgraph"
title: "状态快照与执行元数据：values、tasks、next 与 config"
depth: "deep"
visualIndex: "../visuals/langgraph-01-06.md"
exampleLanguage: "python"
readingMinutes: 33
sourceMinutes: 30
practiceMinutes: 67
reviewMinutes: 15
---

## 官方入口

title: "LangGraph Persistence · StateSnapshot fields"
url: "https://docs.langchain.com/oss/python/langgraph/persistence#statesnapshot-fields"

官方把 checkpoint 对外表示为 StateSnapshot：values 是 channel 值，next 与 tasks 描述下一 super-step，config 给出 thread/checkpoint 身份，metadata、parent_config 与 created_at 提供历史因果。页面事实按 LangGraph 1.2.10 核验。

## 真实源码

repo: "langchain-ai/langgraph"
file: "libs/langgraph/langgraph/types.py"
symbol: "StateSnapshot"
language: "python"
url: "https://github.com/langchain-ai/langgraph/blob/41341457342327166d72fc11952ab28fb61ec0bf/libs/langgraph/langgraph/types.py#L643-L661"

### 逐段讲解

- 类注释把时间点钉在 step 开始处，因此 next/tasks 是“即将执行”，metadata.writes 通常解释上一轮如何形成当前 values；把它读成节点执行后的瞬时栈会产生一拍偏差。
- values 来自公开 channel 读取，不承诺包含 channel version、触发器或任务 ID。业务代码应消费它，诊断器不能只凭它还原调度。
- next 是便于观察的节点名元组，tasks 才承载 task id、错误、中断与子图状态；同一个节点经 Send 并行多次时，next 名称可以重复而 task 身份仍不同。
- config 不是普通业务配置。thread_id、checkpoint_ns、checkpoint_id 组成持久化定位键；拿错 checkpoint_id 会读取历史分叉而非最新状态。
- parent_config 把快照串成历史链，interrupts 显式列出未解决暂停点。生产审计还应保留部署版本和业务事件 ID，不能让 StateSnapshot 独自承担合规日志。

### 源码节选

```python
class StateSnapshot(NamedTuple):
    """Snapshot of graph state at the beginning of a step."""

    values: dict[str, Any] | Any
    # 当前 channel 的业务可见值

    next: tuple[str, ...]
    # 本 step 中每个 task 将执行的节点名

    config: RunnableConfig
    # 可再次定位此快照的 thread/checkpoint 配置

    metadata: CheckpointMetadata | None
    # source、step、writes 等执行来历

    created_at: str | None
    parent_config: RunnableConfig | None

    tasks: tuple[PregelTask, ...]
    # 已尝试任务还可能携带 error 或 subgraph state

    interrupts: tuple[Interrupt, ...]
    # 当前仍待解决的中断
```

## 导读

第一次调用 graph.get_state 时，最容易把返回值当成“一个更漂亮的 state dict”。这个理解会把恢复问题压扁。StateSnapshot 同时回答三类问题：业务已经知道什么，运行时准备执行什么，以及这份观察属于哪条线程的哪个历史坐标。三类字段拥有不同所有者和演进节奏。

可以把它类比成列车运行图的一张定格照片。values 是车上已经装载的货物，tasks 是下一站待发的具体车次，next 是车次目的站的摘要，config 是线路、班次与照片编号。只看货物不能知道哪辆车将开出，只看目的站也不能证明货物内容。

本课把快照作为可验证合同来读：先建立 step 时间线，再比较 values、next、tasks；随后沿 config 找到历史与分支，最后讨论错误、interrupt 和子图怎样改变观察结果。目标是写出能诊断真实恢复问题的检查器，而非会打印对象。


## 分章正文

### 先确定快照位于 super-step 的哪一侧

kicker: "01 · TIME ORIENTATION"

StateSnapshot 的源码定义是“step 开始时的图状态”。若 step 2 的 node_b 已完成并形成 checkpoint，那么该快照的 values 包含 node_b 更新，metadata.writes 解释 node_b 的产出，而 next/tasks 指向 step 3。把 next 当成刚执行完的节点，会让故障报告整体错一轮。

顺序图 START → A → B → END 通常会留下输入、A 前、B 前和完成等边界快照。初始输入也会经过 __start__ 任务，因此 step 可能从 -1 的输入 checkpoint 开始。数字只是运行时计数，业务迁移不要把“step=3”硬编码成某个节点。

#### 代码

```python
snapshot = graph.get_state(config)
print(snapshot.metadata["step"])   # 调度步号
print(snapshot.metadata["writes"]) # 形成当前值的上一轮写入
print(snapshot.next)                # 下一轮节点
print(snapshot.values)              # 当前可见 channel 值
```

#### 本章结论

任何快照诊断先画 before/execute/barrier/after 时间线，再解释字段。

### values 保存事实，next 与 tasks 保存程序计数器

kicker: "02 · BUSINESS VS SCHEDULER"

values 是 schema 对应 channel 的当前值，例如 messages、order_id、approval。它们决定节点业务逻辑，却不应混入 current_node、retry_task_id 这类调度字段。调度器已经用 next、tasks、channel versions 和 pending writes 保存执行位置，重复写进业务 State 会制造两套可能冲突的真相。

next 适合快速回答“可能执行哪些节点”。tasks 更细：PregelTask 具有稳定 id、name、error、interrupts，并可在请求 subgraphs=True 时附带子图 state。fan-out 三次调用同一 worker 时，next 只看到三个相同名称；定位某个失败输入必须看 task id 和 task path。

#### 本章结论

业务状态与执行游标分开，才能独立迁移 schema 与调度实现。

### config 是地址，不是随手透传的 options

kicker: "03 · IDENTITY"

持久化配置的 configurable 中至少要理解 thread_id、checkpoint_ns、checkpoint_id。thread_id 选择一条长期会话，checkpoint_ns 隔离父图和子图命名空间，checkpoint_id 选择该线程的一次历史提交。省略 checkpoint_id 时 get_state 通常读取最新快照，带上它则读取指定历史。

重放与继续的差异就在地址中。向最新 thread 配置提交普通输入，含义可能是新一轮；用历史 checkpoint_id 调用，则形成从旧坐标出发的分支。API 调用看似只差一个字段，业务语义却从“继续现在”变成“改写过去”。

#### 要点

- thread_id 不是用户 ID，一个用户可以有多个独立线程。
- checkpoint_id 不是业务版本号，它定位持久化快照。
- checkpoint_ns 使嵌套图可以复用节点名而不碰撞。
- recursion_limit 属于 config 顶层，不应塞进 configurable。

#### 本章结论

把 config 当数据库复合主键审查，复制粘贴旧 checkpoint_id 是高风险操作。

### 失败状态要读 tasks，暂停状态要读 interrupts

kicker: "04 · ERRORS AND INTERRUPTS"

一个 super-step 中 A 成功、B 失败时，完整 checkpoint 仍停在该 step 的开始边界。A 的结果可能作为 pending write 保存，B 的 PregelTask 则带 error。values 尚未等同于“合并了 A 的最终状态”，因此值、任务错误和 pending write 是三层证据。

interrupt 属于可恢复控制流，并不等同异常。快照可在 tasks 内暴露 task.interrupts，也在新版 StateSnapshot 顶层暴露 interrupts。恢复前应校验 interrupt id、期望响应 schema 与发起节点；只检查 next 是否非空会把人工等待误报成卡死。

#### 本章结论

状态正常、任务失败、主动暂停可以同时出现在一张快照周围，诊断必须逐层读。

### parent_config 与 history 构成可分叉的提交图

kicker: "05 · HISTORY"

get_state_history 返回按时间倒序排列的 StateSnapshot。parent_config 指向上一 checkpoint，update_state 又会创建新 checkpoint 而非原地覆盖旧对象。从历史节点重新执行会产生新分支，所以它更接近 Git commit graph，而非只能前进的日志数组。

排查时可用 metadata.source 区分 input、loop、update，用 metadata.writes 判断是谁形成当前值，再沿 parent_config 验证父子关系。业务上还应记录 graph schema version 和 deployment sha，否则相同 checkpoint 在新代码下恢复时无法解释行为差异。

#### 本章结论

可观察历史必须同时带数据版本、图版本和代码版本，时间戳本身不足以重建因果。

### 写一个快照检查器，而非到处 print

kicker: "06 · OBSERVER"

检查器首先验证 next 与未失败 tasks 的名称对应，再确认每个 task id 唯一、config 具有线程和 checkpoint 身份、metadata.step 单调、完成快照的 next/tasks 都为空。遇到子图 state 时递归检查 namespace，避免父子任务混在同一平面。

检查器不应断言 values 里必有 current_node，也不应把 next=() 一概判定成功：执行可能以异常离开且最后持久快照仍有任务信息。最终运行结论要结合调用异常、trace、checkpoint 与外部业务记录。

#### 本章结论

好的观测器验证字段间不变量，并明确它看不到的事实。

## 核心机制

- StateSnapshot 描述 step 开始边界，values 与 next 在时间线上相隔一次调度。
- values 是 channel 的公开值，调度内部版本与触发器不属于业务 State。
- next 是节点名摘要，tasks 是带身份、错误、中断和子图状态的执行单元。
- thread_id 选择线程，checkpoint_id 选择历史坐标，checkpoint_ns 隔离嵌套图。
- metadata.source 区分 input、loop、update，metadata.writes 解释快照来历。
- parent_config 连接历史；update_state 与 replay 会产生新 checkpoint 分支。
- error 与 interrupt 语义不同，前者是失败证据，后者是等待恢复的控制流。
- 完成通常表现为 next 与 tasks 为空，但业务成功仍需输出和外部事实证明。

## 常见误区

- 把 snapshot.values 当成完整 checkpoint 底层结构并手工改写。
- 把 next 当作刚执行完成的节点，故障时间线整体错一轮。
- fan-out 时只按 node name 聚合，丢失具体 task id 与输入。
- 复用用户 ID 作为所有对话的 thread_id，造成状态串线。
- 把历史 checkpoint_id 无意带入继续请求，产生时间旅行分支。
- 只看 next 非空就认定卡死，忽略待处理 interrupt。
- 把 step 数绑定业务阶段，部署新拓扑后仍依赖固定数字。
- 让 checkpoint 取代 trace、业务审计和外部副作用记录。

## 实现变体

### 轻量运行状态页

useWhen: "客服或运维只需查看当前 values、next、interrupt 与最近错误。"
tradeoff: "认知负担低、泄露面小；无法解释复杂 fan-out、pending writes 和历史分支。"

### 完整 checkpoint 调试器

useWhen: "需要 time travel、子图递归、task 级失败定位和版本迁移演练。"
tradeoff: "诊断能力强；必须做字段脱敏、访问控制、历史分页和版本兼容。"

### 业务投影事件

useWhen: "产品只关心 approved、sent 等领域阶段，不应暴露运行时结构。"
tradeoff: "界面稳定且可审计；投影可能滞后，不能替代底层恢复证据。"

## 可运行示例

```python
from dataclasses import dataclass
from typing import Any

@dataclass(frozen=True)
class Task:
    id: str
    name: str
    error: str | None = None

@dataclass(frozen=True)
class Snapshot:
    values: dict[str, Any]
    next: tuple[str, ...]
    config: dict[str, dict[str, str]]
    metadata: dict[str, Any]
    tasks: tuple[Task, ...]

    def verify(self) -> None:
        active = tuple(t.name for t in self.tasks if t.error is None)
        assert active == self.next
        address = self.config["configurable"]
        assert address["thread_id"] and address["checkpoint_id"]

snapshot = Snapshot(
    values={"draft": "退款说明"},
    next=("review",),
    config={"configurable": {
        "thread_id": "order-42",
        "checkpoint_id": "cp-7",
    }},
    metadata={"source": "loop", "step": 3},
    tasks=(Task("task-8", "review"),),
)
snapshot.verify()
assert "review" not in snapshot.values
```

## 搭积木复现

### 积木 1：定义三层数据

分别建立业务 values、调度 Task 和 checkpoint address，不允许用一个 dict 混装。

### 积木 2：固定时间方向

构造 A 完成、B 待执行的快照，给 metadata.writes、values、next 标注同一时间线。

### 积木 3：验证字段不变量

检查 task id 唯一、next 与活动 tasks 对齐、完成态为空、地址字段完整。

### 积木 4：加入错误与 interrupt

让一个 task 携带 error、另一个携带 interrupt，输出不同运维结论。

### 积木 5：串接历史

加入 parent checkpoint，模拟 update_state 形成分支并验证旧快照保持不变。

### 积木 6：对照真实运行

用 InMemorySaver 跑最小图，对 get_state 与 get_state_history 的字段逐项验收。

## 自检

### 问题

某线程的快照显示 values 已有 draft，next=("review",)，tasks 中 review 带 interrupt，config 含旧 checkpoint_id。你如何判断它在等待、失败还是已完成；继续、更新状态和从旧点 replay 分别应怎样选择配置？

### 站内答案

结论：它处于 review 的可恢复暂停点，尚未完成。先看 tasks/interrupts 识别主动等待，不能因 values 有 draft 就宣布成功，也不能因 next 非空就当故障。正常恢复应以该线程的最新 checkpoint 配置提交匹配 interrupt 的 Command(resume=...)；人工修正用 update_state 创建新 checkpoint，再从新地址继续；实验性 replay 才显式携带历史 checkpoint_id，并接受后续节点、模型调用和外部请求重新执行。证据链应包括 task id、interrupt id、metadata.step/writes、最新 checkpoint 地址和外部业务状态；若有不可逆副作用，还需幂等记录证明其是否已经发生。
