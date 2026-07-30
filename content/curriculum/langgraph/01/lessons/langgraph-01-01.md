---
id: "langgraph-01-01"
track: "langgraph"
title: "函数链为何不足：显式图、状态机与执行日志边界"
depth: "deep"
exampleLanguage: "python"
readingMinutes: 45
sourceMinutes: 35
practiceMinutes: 50
reviewMinutes: 15
---

## 官方入口

title: "LangGraph Graph API · Graphs"
url: "https://docs.langchain.com/oss/python/langgraph/graph-api#graphs"

LangGraph 把应用建模为 State、Nodes 与 Edges：节点读取状态并产生更新，边决定下一批节点。底层以消息传递和离散 super-step 推进，所以循环、并行、暂停与恢复都能成为运行时可检查的结构。

## 真实源码

repo: "langchain-ai/langgraph"
file: "libs/langgraph/langgraph/pregel/main.py"
symbol: "Pregel"
language: "python"
url: "https://github.com/langchain-ai/langgraph/blob/30c4d58db86455128e42ddec96b1ba53c553ba22/libs/langgraph/langgraph/pregel/main.py#L450-L573"

### 逐段讲解

- `StateGraph` 是声明层，最终会编译成继承 `Pregel` 的 `CompiledStateGraph`；调用 `invoke/stream` 时进入的是运行时，而非继续解释 builder。
- `nodes` 不是简单函数列表。每个 `PregelNode` 都声明订阅的 channel、触发条件、读取映射、Runnable 主体和写入器。
- `channels` 同时承担状态存储、更新归并和调度信号。边会被编译成特殊 channel 写入，因此运行时不需要每步扫描一张抽象邻接表。
- Plan、Execution、Update 的 barrier 让并发节点读取同一旧快照，消除“谁先写完谁就被兄弟读到”的竞态语义。
- 持久化、暂停恢复和 stream 都依附同一执行循环，这也是显式运行时比手写函数链更有价值的地方。

### 源码节选

```python
class Pregel(PregelProtocol[StateT, ContextT, InputT, OutputT]):
    """LangGraph 的实际运行时。

    Actor 从 channel 读取，并把更新写回 channel。运行被切成多个 step：

    1. Plan：选择订阅了本轮已更新 channel 的 actor。
    2. Execution：并发执行已选择的 actor；本轮写入暂不对其他 actor 可见。
    3. Update：统一把写入应用到 channel，形成下一轮可见快照。

    当没有 actor 可被选择，或达到最大 step 数时结束。
    """

    nodes: dict[str, PregelNode]
    channels: dict[str, BaseChannel]
    input_channels: str | Sequence[str]
    output_channels: str | Sequence[str]

    # 真实类还承载 checkpointer、store、cache、interrupt、retry、
    # stream、debug 和 subgraph 等生产能力。这里保留运行模型的主干字段。
```

## 导读

函数链适合拓扑固定、每步只执行一次、失败后整体重试的短流程。Agent 工作流通常会循环调用模型与工具，按状态选择路径，并在外部审批、限流或长时间 I/O 前暂停。把这些规则埋在递归函数和 if/else 中，代码当然能跑，但运行时无法回答“现在停在哪、下一步是谁、哪些结果已经持久化、恢复后哪些副作用不能再做”。

显式图把控制流提升为数据。节点名称形成稳定执行地址，边形成可检查的跳转关系，State 保存跨节点业务事实，checkpoint 保存某一时刻的运行快照。编排器因此可以在不理解节点业务代码的情况下做调度、stream、interrupt、resume、time travel 和 trace。

图并不自动带来正确性。若节点直接修改共享对象、把数据库连接塞进 State、用当前时间决定不可记录的分支，或者恢复后重复发送付款，图只会把混乱画得更漂亮。本课先建立四层边界：Graph Definition、Business State、Runtime Context、External World，再决定每项数据和副作用应该放在哪里。

## 分章正文

### 普通函数链的能力边界在哪里

kicker: "01 · CONTROL FLOW"

设有 classify → search → draft → approve → send 五步。若每步必定运行一次，输入输出都在内存中，`send(classify(input))` 这样的函数组合最直接。框架越少，调试面越小。

问题从循环开始出现：search 质量不足要回到 rewrite，工具错误要按错误类型重试，approve 可能等待数小时，用户编辑后又从 draft 继续。此时程序计数器、局部变量和调用栈共同保存“进度”；进程退出后这些信息全部消失。

你可以手写 while、状态枚举和数据库表。做到这一步，其实已经在实现工作流运行时。LangGraph 的价值在于提供经过统一约束的状态更新、调度、持久化和可观测协议，让业务代码只实现节点合同。

#### 代码

```python
def run_email_pipeline(email):
    state = {"email": email, "attempt": 0}

    while True:
        category = classify(state)
        if category == "ignore":
            return {"status": "ignored"}

        draft = write_reply(state)
        decision = wait_for_human(draft)  # 进程在这里如何安全暂停？

        if decision == "edit":
            state["feedback"] = decision.feedback
            state["attempt"] += 1
            continue

        send_email(draft)                 # 崩溃后重启会不会重复发送？
        return {"status": "sent"}
```

#### 本章结论

当代码必须显式保存程序计数器、状态、暂停点和重试记录时，你已经跨过了普通函数链的舒适边界。

### Graph、State、Runtime 与外部世界要分层

kicker: "02 · FOUR LAYERS"

Graph Definition 描述稳定结构：有哪些节点、允许哪些跳转、入口和终点在哪里。它类似编译期程序，不应为每个请求临时塞入用户连接或密钥。

Business State 是可序列化、可归并、可在节点间传递的事实，例如 messages、order_id、risk_level。它应足够重建下一步决策，却不应装数据库连接、HTTP client、锁和大模型对象。

Runtime Context 保存本次运行依赖，如 tenant、model provider、store、stream writer。External World 则是支付、邮件、文件等真正不可由 reducer 回滚的系统。对外动作必须有幂等键或事务性 outbox。

#### 要点

- 图定义回答“允许怎样走”。
- 业务 State 回答“到目前发生了什么”。
- Runtime Context 回答“本次运行依赖什么”。
- 外部系统回答“哪些不可逆事实已经发生”。

#### 本章结论

四层混在一个 dict 中时，checkpoint 会同时失去可序列化性、可迁移性与安全边界。

### LangGraph 的图可以有循环，也不是数据分析邻接表

kicker: "03 · GRAPH ≠ DAG"

机器学习数据管线常用 DAG，因为每个任务运行一次，拓扑排序即可执行。Agent 的“思考—工具—观察—再思考”天然有环，终止取决于 State、剩余步数或外部事件。

LangGraph 的 node/edge 图是控制图。真正的状态流通过 channels 完成，节点因订阅 channel 收到新值而激活。边最终也会编译成 channel 写入和 trigger，而不只是一份 `dict[node, neighbors]`。

循环合法不代表无限循环合理。业务停机条件、recursion limit、deadline、取消和部分结果必须分别设计；把所有保护寄托在一个最大步数上，只会让错误更晚暴露。

#### 本章结论

用“有向控制图 + channel 状态机”理解 LangGraph，比套用 DAG 拓扑排序更接近真实实现。

### 执行日志是恢复和面试解释的共同证据

kicker: "04 · EVENT LOG"

只保存最终 State，无法解释它由哪些节点产生，也无法区分模型错误、工具错误和 reducer 覆盖。生产系统至少要记录 run/thread、step、task、node、input version、writes、error 与时间。

checkpoint 是可恢复快照，trace 是因果证据，业务审计日志是合规记录。三者可以互相引用，但保留周期、访问权限和内容脱敏不同，不能把一份 LangSmith trace 当成所有问题的答案。

面试中不要只说“图更可观测”。给出具体问题：某个节点执行了几次、在哪个 super-step、读取哪个 channel version、产生哪些写入、失败后为何重跑。这些才是显式运行模型带来的可验证能力。

#### 本章结论

可观测性来自稳定执行地址和事件协议，不来自画出一张 Mermaid 图。

### 崩溃恢复首先是副作用语义问题

kicker: "05 · FAILURE MODEL"

纯计算节点重跑通常安全；模型调用会增加成本且输出可能变化；发送邮件和扣款属于不可逆副作用。运行时即使准确恢复到节点前，也无法替外部系统撤销已经成功但尚未记录的动作。

常用方案是幂等键：以 thread_id + business_operation 作为下游请求键，让重复请求返回同一结果。更强的方案是事务性 outbox：节点只在业务数据库事务中写待发送事件，由独立 worker 可靠投递。

因此“durable execution”不等于 exactly-once side effect。更准确的合同是 checkpointed at-least-once execution，加上业务层幂等或事务协议，组合出用户可接受的效果。

#### 本章结论

恢复边界必须和副作用提交边界一起设计，否则 checkpoint 只能精确地重复犯错。

### 何时保留普通代码更成熟

kicker: "06 · WHEN NOT TO USE"

单次请求内的三步线性转换、无循环、无人工等待、整体失败可重试时，普通 async function 通常更清楚。引入 thread_id、checkpoint store、graph migration 和 trace 会增加运维成本。

若关键需求只是后台任务队列、定时器或分布式事务，成熟的 job/workflow system 可能比 Agent graph 更合适。LangGraph 可以嵌入这些系统，却不该替代所有基础设施。

选择标准应来自失败时要恢复的最小单位、流程是否需要动态循环、执行是否跨请求生命周期，以及控制流是否需要被产品或运维观察。

#### 本章结论

架构成熟度体现在会拒绝不必要的运行时，而不在于把每段业务逻辑都画成图。

### 用四个问题判断是否需要图

kicker: "07 · DESIGN TEST"

第一，流程会不会在一个节点之后回到先前节点？第二，是否需要跨进程或跨小时暂停？第三，失败后是否只重做部分工作？第四，运维是否需要修改 State 后继续？

四项都是否时，函数链胜出。任意两项为真时，显式状态机开始有价值。若还包含并行 fan-out、人工审批和长期记忆，应进一步评估持久化和权限模型。

这个判断是经验门槛，不是数学定理。最终用故障演练证明：进程在每个边界崩溃后，系统能否解释已完成事实并安全继续。

#### 本章结论

框架选择要落到故障恢复单位和可观测需求，而不是“Agent 就应该用图”。

### 先画状态转换表，再写节点函数

kicker: "08 · FIRST MODEL"

对每个节点列出允许读取的 State、返回的 partial update、可能的下一节点、外部动作和失败类型。这个表比先写 prompt 更容易发现隐式共享、缺失终止和重复副作用。

然后为每条边写一条时间线测试：给定旧快照，哪些节点在同一 super-step 被选中，barrier 后 State 如何变化，下一步是谁。模型输出可以先用 deterministic fake 替代。

最后才接真实模型和工具。这样框架问题、编排问题与模型质量问题能被分开定位。

#### 本章结论

图设计的最小产物是状态转换合同和时间线测试，不是节点名称列表。

## 核心机制

- StateGraph 负责声明，CompiledStateGraph/Pregel 负责运行。
- 节点订阅 channel；被更新 channel 决定下一 super-step 的活跃节点。
- 同一 super-step 的节点读取同一旧快照，写入在 barrier 后统一可见。
- 边会被编译为 channel 写入与 trigger，不等同于运行时扫描邻接表。
- 业务 State 与 runtime context 使用不同生命周期和序列化合同。
- checkpoint 保存恢复快照，trace 保存执行因果，业务审计保存外部承诺。
- 循环是控制图的一等结构，停机需要业务条件和运行保护共同保证。
- 节点重跑通常是 at-least-once，外部副作用必须另做幂等。
- 图编译后形成运行时快照，继续修改 builder 不会改变已有 compiled graph。
- 简单线性短流程保留普通函数，能减少迁移、持久化和运维成本。

## 常见误区

- 把 LangGraph 当成只会画图的函数链包装器。
- 把模型、连接池、密钥和锁写进可持久化 State。
- 直接修改输入 State，让 reducer 和 checkpoint 看不到明确 update。
- 宣称 checkpoint 自动提供 exactly-once 外部副作用。
- 把 recursion_limit 当成业务成功的终止条件。
- 只检查最终输出，不记录节点/step/writes 时间线。
- 所有流程都上图，忽略简单 async function 的可读性。
- 让随机数、当前时间和无幂等 I/O 决定不可重放分支。

## 实现变体

### 普通 async function

useWhen: "拓扑固定、生命周期短、整体失败可安全重试。"
tradeoff: "代码和部署最简单；无法自然表达持久暂停、局部恢复和运维态状态检查。"

### LangGraph Graph API

useWhen: "需要循环、条件路由、并行、checkpoint、人工审批或状态修改。"
tradeoff: "控制流清晰且运行时能力完整；要承担 schema、thread、migration 和副作用协议。"

### 通用工作流引擎 + LangGraph 子流程

useWhen: "企业已有队列、定时、补偿和跨服务编排，同时需要 Agent 内部循环。"
tradeoff: "职责边界最强；两套运行历史、取消和重试语义必须显式桥接。"

## 可运行示例

```python
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

Update = dict[str, Any]
Node = Callable[[dict[str, Any]], Update]


@dataclass(frozen=True)
class Transition:
    step: int
    node: str
    before: dict[str, Any]
    update: Update
    after: dict[str, Any]


@dataclass
class ExplicitWorkflow:
    """只实现本课需要的显式状态机，不依赖 LangGraph。"""

    nodes: dict[str, Node]
    next_node: dict[str, str | None]
    state: dict[str, Any]
    cursor: str | None
    log: list[Transition] = field(default_factory=list)

    def tick(self) -> bool:
        if self.cursor is None:
            return False

        node_name = self.cursor
        before = dict(self.state)  # 给节点只读快照，而非共享可变对象
        update = self.nodes[node_name](before)
        if not isinstance(update, dict):
            raise TypeError(f"{node_name} 必须返回 partial update")

        self.state = {**self.state, **update}
        self.log.append(
            Transition(
                step=len(self.log),
                node=node_name,
                before=before,
                update=dict(update),
                after=dict(self.state),
            )
        )
        self.cursor = self.next_node[node_name]
        return self.cursor is not None

    def checkpoint(self) -> dict[str, Any]:
        # 这里只保存可序列化业务事实和程序计数器。
        return {
            "state": dict(self.state),
            "cursor": self.cursor,
            "completed_steps": len(self.log),
        }


def classify(state: dict[str, Any]) -> Update:
    return {"route": "reply" if "?" in state["email"] else "archive"}


def draft(state: dict[str, Any]) -> Update:
    if state["route"] == "archive":
        return {"draft": None, "status": "archived"}
    return {"draft": f"Reply to: {state['email']}", "status": "drafted"}


workflow = ExplicitWorkflow(
    nodes={"classify": classify, "draft": draft},
    next_node={"classify": "draft", "draft": None},
    state={"email": "Can I get a refund?"},
    cursor="classify",
)

while workflow.tick():
    pass

assert workflow.state["status"] == "drafted"
assert [event.node for event in workflow.log] == ["classify", "draft"]
assert workflow.checkpoint()["cursor"] is None

# 练习：加入 human_review 节点。它不能阻塞等待输入，
# 而应让 workflow 产出 interrupted 状态，并由外部 resume。
```

## 搭积木复现

### 积木 1：写状态转换表

为 classify、draft、review、send 列出读取字段、partial update、下一节点、失败和外部副作用。

### 积木 2：分开 state 与 cursor

业务字段留在 state，当前执行地址单独保存，避免把调度字段暴露给每个节点。

### 积木 3：节点只接收快照

传入浅拷贝并要求返回 dict update；故意原地修改，写测试证明为什么日志会失真。

### 积木 4：记录 transition

每步保存 before、update、after 和 node，让最终 State 可以追溯。

### 积木 5：实现 checkpoint

只保存可序列化 state、cursor 和版本，不保存函数、连接或锁。

### 积木 6：模拟 crash-resume

运行一步后序列化 checkpoint，重建新 workflow 并从 cursor 继续。

### 积木 7：隔离副作用

让 send 先写 outbox 事件，以 operation_id 去重，再由外部 worker 投递。

### 积木 8：写拒绝框架的对照

把两步线性图改回普通函数，比较代码量和故障要求，说明选择边界。

## 自检

### 问题

一个客服 Agent 需要模型、数据库连接、messages、tenant_id、当前审批节点和“邮件已发送”记录。请分别放入 Graph Definition、Business State、Runtime Context、调度/checkpoint 元数据或外部系统，并解释错误放置会造成什么问题。

### 站内答案

模型选择和数据库连接属于 Runtime Context：它们是本次执行依赖，不应随 checkpoint 序列化；messages、tenant_id 和影响后续决策的审批业务结果属于 Business State；节点集合与允许跳转属于 Graph Definition；当前节点、step、task、channel version 属于运行时/checkpoint 元数据；“邮件已发送”必须由外部邮件/outbox 系统以幂等 operation_id 记录，State 可以保存该 ID 和确认结果但不能独自证明外部动作成功。把连接或模型塞入 State 会破坏序列化与迁移；把审批结果只留在调用栈会无法恢复；只在 State 写 sent=true 可能在崩溃窗口中与真实邮件系统不一致。
