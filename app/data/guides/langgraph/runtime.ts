import type { TopicGuide } from '../../topic-guides'

export const langGraphRuntimeGuides: Record<string, TopicGuide> = {
  '函数链为何不足：显式图、状态机与执行日志边界': {
    official: {
      title: 'LangGraph Graph API · Graphs',
      url: 'https://docs.langchain.com/oss/python/langgraph/graph-api#graphs',
      note: 'LangGraph 把应用建模为 State、Nodes 与 Edges：节点读取状态并产生更新，边决定下一批节点。底层以消息传递和离散 super-step 推进，所以循环、并行、暂停与恢复都能成为运行时可检查的结构。'
    },
    source: {
      repo: 'langchain-ai/langgraph',
      file: 'libs/langgraph/langgraph/pregel/main.py',
      symbol: 'Pregel',
      language: 'python',
      url: 'https://github.com/langchain-ai/langgraph/blob/30c4d58db86455128e42ddec96b1ba53c553ba22/libs/langgraph/langgraph/pregel/main.py#L450-L573',
      code: `class Pregel(PregelProtocol[StateT, ContextT, InputT, OutputT]):
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
    # stream、debug 和 subgraph 等生产能力。这里保留运行模型的主干字段。`,
      walkthrough: [
        '`StateGraph` 是声明层，最终会编译成继承 `Pregel` 的 `CompiledStateGraph`；调用 `invoke/stream` 时进入的是运行时，而非继续解释 builder。',
        '`nodes` 不是简单函数列表。每个 `PregelNode` 都声明订阅的 channel、触发条件、读取映射、Runnable 主体和写入器。',
        '`channels` 同时承担状态存储、更新归并和调度信号。边会被编译成特殊 channel 写入，因此运行时不需要每步扫描一张抽象邻接表。',
        'Plan、Execution、Update 的 barrier 让并发节点读取同一旧快照，消除“谁先写完谁就被兄弟读到”的竞态语义。',
        '持久化、暂停恢复和 stream 都依附同一执行循环，这也是显式运行时比手写函数链更有价值的地方。'
      ]
    },
    overview: [
      '函数链适合拓扑固定、每步只执行一次、失败后整体重试的短流程。Agent 工作流通常会循环调用模型与工具，按状态选择路径，并在外部审批、限流或长时间 I/O 前暂停。把这些规则埋在递归函数和 if/else 中，代码当然能跑，但运行时无法回答“现在停在哪、下一步是谁、哪些结果已经持久化、恢复后哪些副作用不能再做”。',
      '显式图把控制流提升为数据。节点名称形成稳定执行地址，边形成可检查的跳转关系，State 保存跨节点业务事实，checkpoint 保存某一时刻的运行快照。编排器因此可以在不理解节点业务代码的情况下做调度、stream、interrupt、resume、time travel 和 trace。',
      '图并不自动带来正确性。若节点直接修改共享对象、把数据库连接塞进 State、用当前时间决定不可记录的分支，或者恢复后重复发送付款，图只会把混乱画得更漂亮。本课先建立四层边界：Graph Definition、Business State、Runtime Context、External World，再决定每项数据和副作用应该放在哪里。'
    ],
    chapters: [
      {
        kicker: '01 · CONTROL FLOW',
        title: '普通函数链的能力边界在哪里',
        paragraphs: [
          '设有 classify → search → draft → approve → send 五步。若每步必定运行一次，输入输出都在内存中，`send(classify(input))` 这样的函数组合最直接。框架越少，调试面越小。',
          '问题从循环开始出现：search 质量不足要回到 rewrite，工具错误要按错误类型重试，approve 可能等待数小时，用户编辑后又从 draft 继续。此时程序计数器、局部变量和调用栈共同保存“进度”；进程退出后这些信息全部消失。',
          '你可以手写 while、状态枚举和数据库表。做到这一步，其实已经在实现工作流运行时。LangGraph 的价值在于提供经过统一约束的状态更新、调度、持久化和可观测协议，让业务代码只实现节点合同。'
        ],
        code: `def run_email_pipeline(email):
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
        return {"status": "sent"}`,
        language: 'python',
        takeaway: '当代码必须显式保存程序计数器、状态、暂停点和重试记录时，你已经跨过了普通函数链的舒适边界。'
      },
      {
        kicker: '02 · FOUR LAYERS',
        title: 'Graph、State、Runtime 与外部世界要分层',
        paragraphs: [
          'Graph Definition 描述稳定结构：有哪些节点、允许哪些跳转、入口和终点在哪里。它类似编译期程序，不应为每个请求临时塞入用户连接或密钥。',
          'Business State 是可序列化、可归并、可在节点间传递的事实，例如 messages、order_id、risk_level。它应足够重建下一步决策，却不应装数据库连接、HTTP client、锁和大模型对象。',
          'Runtime Context 保存本次运行依赖，如 tenant、model provider、store、stream writer。External World 则是支付、邮件、文件等真正不可由 reducer 回滚的系统。对外动作必须有幂等键或事务性 outbox。'
        ],
        points: [
          '图定义回答“允许怎样走”。',
          '业务 State 回答“到目前发生了什么”。',
          'Runtime Context 回答“本次运行依赖什么”。',
          '外部系统回答“哪些不可逆事实已经发生”。'
        ],
        takeaway: '四层混在一个 dict 中时，checkpoint 会同时失去可序列化性、可迁移性与安全边界。'
      },
      {
        kicker: '03 · GRAPH ≠ DAG',
        title: 'LangGraph 的图可以有循环，也不是数据分析邻接表',
        paragraphs: [
          '机器学习数据管线常用 DAG，因为每个任务运行一次，拓扑排序即可执行。Agent 的“思考—工具—观察—再思考”天然有环，终止取决于 State、剩余步数或外部事件。',
          'LangGraph 的 node/edge 图是控制图。真正的状态流通过 channels 完成，节点因订阅 channel 收到新值而激活。边最终也会编译成 channel 写入和 trigger，而不只是一份 `dict[node, neighbors]`。',
          '循环合法不代表无限循环合理。业务停机条件、recursion limit、deadline、取消和部分结果必须分别设计；把所有保护寄托在一个最大步数上，只会让错误更晚暴露。'
        ],
        takeaway: '用“有向控制图 + channel 状态机”理解 LangGraph，比套用 DAG 拓扑排序更接近真实实现。'
      },
      {
        kicker: '04 · EVENT LOG',
        title: '执行日志是恢复和面试解释的共同证据',
        paragraphs: [
          '只保存最终 State，无法解释它由哪些节点产生，也无法区分模型错误、工具错误和 reducer 覆盖。生产系统至少要记录 run/thread、step、task、node、input version、writes、error 与时间。',
          'checkpoint 是可恢复快照，trace 是因果证据，业务审计日志是合规记录。三者可以互相引用，但保留周期、访问权限和内容脱敏不同，不能把一份 LangSmith trace 当成所有问题的答案。',
          '面试中不要只说“图更可观测”。给出具体问题：某个节点执行了几次、在哪个 super-step、读取哪个 channel version、产生哪些写入、失败后为何重跑。这些才是显式运行模型带来的可验证能力。'
        ],
        takeaway: '可观测性来自稳定执行地址和事件协议，不来自画出一张 Mermaid 图。'
      },
      {
        kicker: '05 · FAILURE MODEL',
        title: '崩溃恢复首先是副作用语义问题',
        paragraphs: [
          '纯计算节点重跑通常安全；模型调用会增加成本且输出可能变化；发送邮件和扣款属于不可逆副作用。运行时即使准确恢复到节点前，也无法替外部系统撤销已经成功但尚未记录的动作。',
          '常用方案是幂等键：以 thread_id + business_operation 作为下游请求键，让重复请求返回同一结果。更强的方案是事务性 outbox：节点只在业务数据库事务中写待发送事件，由独立 worker 可靠投递。',
          '因此“durable execution”不等于 exactly-once side effect。更准确的合同是 checkpointed at-least-once execution，加上业务层幂等或事务协议，组合出用户可接受的效果。'
        ],
        takeaway: '恢复边界必须和副作用提交边界一起设计，否则 checkpoint 只能精确地重复犯错。'
      },
      {
        kicker: '06 · WHEN NOT TO USE',
        title: '何时保留普通代码更成熟',
        paragraphs: [
          '单次请求内的三步线性转换、无循环、无人工等待、整体失败可重试时，普通 async function 通常更清楚。引入 thread_id、checkpoint store、graph migration 和 trace 会增加运维成本。',
          '若关键需求只是后台任务队列、定时器或分布式事务，成熟的 job/workflow system 可能比 Agent graph 更合适。LangGraph 可以嵌入这些系统，却不该替代所有基础设施。',
          '选择标准应来自失败时要恢复的最小单位、流程是否需要动态循环、执行是否跨请求生命周期，以及控制流是否需要被产品或运维观察。'
        ],
        takeaway: '架构成熟度体现在会拒绝不必要的运行时，而不在于把每段业务逻辑都画成图。'
      },
      {
        kicker: '07 · DESIGN TEST',
        title: '用四个问题判断是否需要图',
        paragraphs: [
          '第一，流程会不会在一个节点之后回到先前节点？第二，是否需要跨进程或跨小时暂停？第三，失败后是否只重做部分工作？第四，运维是否需要修改 State 后继续？',
          '四项都是否时，函数链胜出。任意两项为真时，显式状态机开始有价值。若还包含并行 fan-out、人工审批和长期记忆，应进一步评估持久化和权限模型。',
          '这个判断是经验门槛，不是数学定理。最终用故障演练证明：进程在每个边界崩溃后，系统能否解释已完成事实并安全继续。'
        ],
        takeaway: '框架选择要落到故障恢复单位和可观测需求，而不是“Agent 就应该用图”。'
      },
      {
        kicker: '08 · FIRST MODEL',
        title: '先画状态转换表，再写节点函数',
        paragraphs: [
          '对每个节点列出允许读取的 State、返回的 partial update、可能的下一节点、外部动作和失败类型。这个表比先写 prompt 更容易发现隐式共享、缺失终止和重复副作用。',
          '然后为每条边写一条时间线测试：给定旧快照，哪些节点在同一 super-step 被选中，barrier 后 State 如何变化，下一步是谁。模型输出可以先用 deterministic fake 替代。',
          '最后才接真实模型和工具。这样框架问题、编排问题与模型质量问题能被分开定位。'
        ],
        takeaway: '图设计的最小产物是状态转换合同和时间线测试，不是节点名称列表。'
      }
    ],
    mechanisms: [
      'StateGraph 负责声明，CompiledStateGraph/Pregel 负责运行。',
      '节点订阅 channel；被更新 channel 决定下一 super-step 的活跃节点。',
      '同一 super-step 的节点读取同一旧快照，写入在 barrier 后统一可见。',
      '边会被编译为 channel 写入与 trigger，不等同于运行时扫描邻接表。',
      '业务 State 与 runtime context 使用不同生命周期和序列化合同。',
      'checkpoint 保存恢复快照，trace 保存执行因果，业务审计保存外部承诺。',
      '循环是控制图的一等结构，停机需要业务条件和运行保护共同保证。',
      '节点重跑通常是 at-least-once，外部副作用必须另做幂等。',
      '图编译后形成运行时快照，继续修改 builder 不会改变已有 compiled graph。',
      '简单线性短流程保留普通函数，能减少迁移、持久化和运维成本。'
    ],
    pitfalls: [
      '把 LangGraph 当成只会画图的函数链包装器。',
      '把模型、连接池、密钥和锁写进可持久化 State。',
      '直接修改输入 State，让 reducer 和 checkpoint 看不到明确 update。',
      '宣称 checkpoint 自动提供 exactly-once 外部副作用。',
      '把 recursion_limit 当成业务成功的终止条件。',
      '只检查最终输出，不记录节点/step/writes 时间线。',
      '所有流程都上图，忽略简单 async function 的可读性。',
      '让随机数、当前时间和无幂等 I/O 决定不可重放分支。'
    ],
    variants: [
      {
        title: '普通 async function',
        useWhen: '拓扑固定、生命周期短、整体失败可安全重试。',
        tradeoff: '代码和部署最简单；无法自然表达持久暂停、局部恢复和运维态状态检查。'
      },
      {
        title: 'LangGraph Graph API',
        useWhen: '需要循环、条件路由、并行、checkpoint、人工审批或状态修改。',
        tradeoff: '控制流清晰且运行时能力完整；要承担 schema、thread、migration 和副作用协议。'
      },
      {
        title: '通用工作流引擎 + LangGraph 子流程',
        useWhen: '企业已有队列、定时、补偿和跨服务编排，同时需要 Agent 内部循环。',
        tradeoff: '职责边界最强；两套运行历史、取消和重试语义必须显式桥接。'
      }
    ],
    studyPlan: { readingMinutes: 45, sourceMinutes: 35, practiceMinutes: 50, reviewMinutes: 15 },
    exampleLanguage: 'python',
    example: `from __future__ import annotations

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
# 而应让 workflow 产出 interrupted 状态，并由外部 resume。`,
    buildSteps: [
      { title: '积木 1：写状态转换表', body: '为 classify、draft、review、send 列出读取字段、partial update、下一节点、失败和外部副作用。' },
      { title: '积木 2：分开 state 与 cursor', body: '业务字段留在 state，当前执行地址单独保存，避免把调度字段暴露给每个节点。' },
      { title: '积木 3：节点只接收快照', body: '传入浅拷贝并要求返回 dict update；故意原地修改，写测试证明为什么日志会失真。' },
      { title: '积木 4：记录 transition', body: '每步保存 before、update、after 和 node，让最终 State 可以追溯。' },
      { title: '积木 5：实现 checkpoint', body: '只保存可序列化 state、cursor 和版本，不保存函数、连接或锁。' },
      { title: '积木 6：模拟 crash-resume', body: '运行一步后序列化 checkpoint，重建新 workflow 并从 cursor 继续。' },
      { title: '积木 7：隔离副作用', body: '让 send 先写 outbox 事件，以 operation_id 去重，再由外部 worker 投递。' },
      { title: '积木 8：写拒绝框架的对照', body: '把两步线性图改回普通函数，比较代码量和故障要求，说明选择边界。' }
    ],
    selfCheckQuestion: '一个客服 Agent 需要模型、数据库连接、messages、tenant_id、当前审批节点和“邮件已发送”记录。请分别放入 Graph Definition、Business State、Runtime Context、调度/checkpoint 元数据或外部系统，并解释错误放置会造成什么问题。',
    selfCheckAnswer: '模型选择和数据库连接属于 Runtime Context：它们是本次执行依赖，不应随 checkpoint 序列化；messages、tenant_id 和影响后续决策的审批业务结果属于 Business State；节点集合与允许跳转属于 Graph Definition；当前节点、step、task、channel version 属于运行时/checkpoint 元数据；“邮件已发送”必须由外部邮件/outbox 系统以幂等 operation_id 记录，State 可以保存该 ID 和确认结果但不能独自证明外部动作成功。把连接或模型塞入 State 会破坏序列化与迁移；把审批结果只留在调用栈会无法恢复；只在 State 写 sent=true 可能在崩溃窗口中与真实邮件系统不一致。'
  },
  'StateGraph Builder 与 compile：从 schema 到 CompiledStateGraph': {
    official: {
      title: 'LangGraph Graph API · Compiling your graph',
      url: 'https://docs.langchain.com/oss/python/langgraph/graph-api#compiling-your-graph',
      note: 'Graph 必须 compile 后才能运行。compile 会验证结构，并在同一边界接收 checkpointer、cache、store、interrupt 与 debug 等运行参数；结果是实现 Runnable 接口的 CompiledStateGraph。'
    },
    source: {
      repo: 'langchain-ai/langgraph',
      file: 'libs/langgraph/langgraph/graph/state.py',
      symbol: 'StateGraph.compile',
      language: 'python',
      url: 'https://github.com/langchain-ai/langgraph/blob/30c4d58db86455128e42ddec96b1ba53c553ba22/libs/langgraph/langgraph/graph/state.py#L1164-L1388',
      code: `def compile(
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
    return compiled.validate()`,
      walkthrough: [
        '源码版本固定到 langgraph 1.2.9、commit `30c4d58`。签名中 checkpointer、store、cache、interrupt 和 transformer 都属于运行时能力，不是 builder 上的普通业务 state。',
        '`self.validate()` 先检查入口、节点引用、边目标和 interrupt 节点；静态校验无法证明循环一定终止，也无法证明节点返回正确 dict。',
        '`output_channels` 按 output schema 过滤公开返回；`stream_channels` 从完整 State channel 中排除 managed value，两者解决不同 API 表面。',
        '`CompiledStateGraph` 继承 `Pregel`。它初始化时 `nodes={}`，随后通过 `attach_node/edge/branch` 把高层声明编译成 channel、trigger、writer 和 Runnable。',
        '`START` 会成为 `EphemeralValue(input_schema)` 输入 channel。END 则没有同构业务 actor，这个差异会在第四课展开。',
        '返回前再次 `compiled.validate()`，说明源码生成结构也有自己的不变量；compile 不是简单地把 `compiled=True`。'
      ]
    },
    overview: [
      '`StateGraph` 是可变 builder：开发者逐步加入 schema、node、edge 和 branch。`CompiledStateGraph` 是某一时刻的可执行快照：包含 Pregel actors、channels、触发器、写入器以及持久化/缓存依赖。把两者分开，相当于编译器分开 AST 与 executable plan。',
      'compile 的核心工作不是把 Python 变成机器码，而是“降低抽象层级”。State 字段变成 channel；节点函数变成 Runnable + input mapper + ChannelWrite；静态边变成目标节点触发 channel；多起点边变成 barrier channel；条件分支变成动态写入。',
      '这个边界提供三种工程收益：提前拒绝部分结构错误；冻结一份能被并发调用的执行计划；把 checkpointer/store/cache/interrupt 组合到统一运行时。代价是 builder 之后的修改不会进入已有 compiled graph，部署时必须管理图版本。'
    ],
    chapters: [
      {
        kicker: '01 · TWO REPRESENTATIONS',
        title: 'Builder 是声明，CompiledGraph 是执行计划',
        paragraphs: [
          'builder 需要适合编辑：节点按名字存入 dict，边保留为集合，branch 保留路由函数，schema 保存 Python 类型。它追求可读和可验证，不必直接满足高效调度。',
          '运行时需要适合执行：根据 channel 版本找到活跃节点，读取投影后的输入，调用 Runnable，把 partial update 写入 channel，并产生下一步 trigger。若每一轮都重新解释高层 schema 和 edge，复杂度和错误面都会增加。',
          'compile 正是二者的翻译层。它保留 `builder` 引用用于 JSON Schema 和图可视化，但调度依赖编译后的 `nodes/channels`。'
        ],
        takeaway: '“为什么要 compile”应回答数据结构和运行合同如何变化，而不是只说“框架要求调用”。'
      },
      {
        kicker: '02 · VALIDATION',
        title: '编译期只能证明结构不变量',
        paragraphs: [
          '`StateGraph.validate()` 会要求至少有一条从 START 出发的入口，检查 edge/branch 目标是否存在，并验证 interrupt 节点。`add_edge` 本身也拒绝以 END 为起点或以 START 为终点。',
          '它无法证明 node 必定返回 dict、conditional route 只返回声明目标、reducer 满足结合律、循环最终停止或副作用幂等。这些属于运行时检查、类型测试和故障演练。',
          '成熟的课程要把“compile 通过”视为结构证据，而非正确性证书。测试矩阵仍需覆盖无效返回、冲突写入、异常、超时和迁移。'
        ],
        code: `def validate_graph(nodes, edges):
    if not any(start == "__start__" for start, _ in edges):
        raise ValueError("graph needs an entrypoint")

    valid_sources = set(nodes) | {"__start__"}
    valid_targets = set(nodes) | {"__end__"}

    for start, end in edges:
        if start not in valid_sources:
            raise ValueError(f"unknown edge source: {start}")
        if end not in valid_targets:
            raise ValueError(f"unknown edge target: {end}")`,
        language: 'python',
        takeaway: '结构验证缩小错误空间，却不能替代语义和故障测试。'
      },
      {
        kicker: '03 · SCHEMA LOWERING',
        title: 'State 字段为何会变成 channel',
        paragraphs: [
          '每个 State key 都有 value type、update type 和 reducer。默认覆盖语义可用 LastValue 表达，`Annotated[list, operator.add]` 则可编译为聚合 channel。节点不直接提交完整 State，而是向一个或多个 channel 发送 update。',
          'input_schema 和 output_schema 是完整 State 的投影。输入可以只暴露 user_input，内部节点仍可写 OverallState 中已注册的字段；输出再过滤掉内部过程字段。',
          'managed value 与普通 channel 不同，它由 runtime 计算或注入，例如剩余步数。compile 在计算 stream/output 表面时排除它，避免把调度状态误当业务持久数据。'
        ],
        takeaway: 'Schema 不只是静态类型；它决定运行时 channel 和 reducer 合同。'
      },
      {
        kicker: '04 · NODE LOWERING',
        title: 'attach_node 组合读取、执行和写入',
        paragraphs: [
          '`attach_node` 为节点选择 input channels，必要时把 dict 映射为 Pydantic/dataclass schema，然后把用户函数作为 `bound` Runnable 放进 PregelNode。',
          '节点返回值先经过 `_get_updates`。dict 只保留已声明 output key；Command 会拆出 update 和 control；错误类型会触发 `InvalidUpdateError`。接着 ChannelWrite 把数据写到 State channels。',
          '每个普通节点还有 `_CHANNEL_BRANCH_TO:<node>` 触发 channel。静态边和条件分支都通过向这类 channel 写入空信号来激活下一节点。'
        ],
        takeaway: '一个用户 node 在运行时是 read mapper → Runnable → update/control writer 的组合。'
      },
      {
        kicker: '05 · EDGE LOWERING',
        title: '单边与 join 会编译成不同 channel',
        paragraphs: [
          'A → B 的静态边会给 A 增加 writer，向 B 的 branch trigger channel 写入信号。B 订阅该 channel，所以只有上一步 A 完成并提交写入后才会被 Plan 选中。',
          '`add_edge([A, B], C)` 表示 join。compile 创建 `NamedBarrierValue`，A/B 各写入自己的名称，C 只有在 barrier 收齐集合后才触发。',
          '这解释了为什么“B 和 C 都指向 D”与 `add_edge([B, C], D)` 语义不同。前者可能让 D 分别触发，后者要求同一轮/协议中的全部上游完成。'
        ],
        takeaway: '边不是一条可视化线；它会选择具体的信号与 barrier 语义。'
      },
      {
        kicker: '06 · RUNTIME DEPENDENCIES',
        title: 'checkpointer、store 与 cache 为什么在 compile 注入',
        paragraphs: [
          'checkpointer 保存 thread 内执行快照，store 提供跨 thread 的长期数据访问，cache 根据节点输入复用任务结果。三者生命周期和一致性合同不同，不能互相替代。',
          '把它们放在 compile 边界，使同一 graph definition 可以编译成测试版、内存版或生产版。节点通过 Runtime 获取依赖，不需要把数据库对象写进 State。',
          'interrupt_before/after 也在这里绑定，因为暂停点属于可执行计划。修改 interrupt 集合通常意味着新 compiled graph，而非修改某个请求 State。'
        ],
        takeaway: 'compile 是把纯拓扑与部署策略组合起来的装配边界。'
      },
      {
        kicker: '07 · IMMUTABILITY',
        title: '编译后修改 builder 为什么危险',
        paragraphs: [
          '`add_node` 在 builder 已编译后会警告：新增节点不会反映到已有 compiled graph。因为 attach 已生成 nodes、channels 和 triggers，自动增量同步容易制造半更新计划。',
          '正确做法是把 builder 构造封装成纯函数，每次部署创建新 builder 并 compile。测试不要复用被多 case 修改的全局 builder。',
          '持久线程还会引用节点名称和 channel schema。新编译计划能加载旧 checkpoint，不代表任意拓扑变化都安全；中断中的线程尤其不能丢失即将执行的节点。'
        ],
        takeaway: 'CompiledGraph 是版本化执行计划；修改 builder 后应重新编译并做迁移评估。'
      },
      {
        kicker: '08 · VERIFICATION',
        title: '如何证明自己的 mini compile 真正工作',
        paragraphs: [
          '不要只断言 `compile()` 返回对象。检查生成计划：START input channel、每个 node 的 subscriptions、每条 edge 的 writer、join barrier 的 expected set、公开 output keys。',
          '加入负例：缺 START、未知 target、重复 node、END 作为 source、START 作为 target、节点返回未声明字段。明确哪些在 build、compile 或 run 阶段失败。',
          '最后运行 builder 与 compiled plan 的隔离测试：compile 后修改 builder，新计划前后结果应不同，旧 compiled graph 必须保持原执行结构。'
        ],
        takeaway: '编译器测试既要验证生成结构，也要运行一条端到端时间线。'
      },
      {
        kicker: '09 · COMPILATION MAP',
        title: '把一张两节点图逐字段映射到运行时',
        paragraphs: [
          '以 `START→normalize→score→END` 为例。builder 的 `nodes` 保存两个 StateNodeSpec，`edges` 保存三条声明边；State schema 中 text、normalized、score 各产生一个 channel。compile 另外创建 START EphemeralValue，并把它设为 input_channels。',
          'attach_node(normalize) 让该 PregelNode 订阅自己的 branch trigger，读取 input schema 对应 channels，通过 mapper 组装 state，执行 Runnable 后由 `_get_updates` 提取 normalized。它的 writers 还会发布 score 的 trigger，因为存在 normalize→score。',
          'attach_node(score) 读取 barrier 后包含 normalized 的新快照，发布 score update。score→END 不会创建 END actor 或目标 trigger；score 完成后没有任何新消息，下一次 Plan 为空并正常结束。',
          '若 output schema 只有 score，调用者只得到 score；text 和 normalized 仍留在内部 channel/checkpoint。若把 normalize→score 改成条件 branch，compile 会把 route runnable 和动态 writes 挂到 normalize，而非生成固定 writer。',
          '手工完成这张映射表后，再阅读源码会发现 `compile` 的多数分支都在处理同一翻译任务的变体：不同 schema mapper、等待多源的 barrier、Command/Send 控制包、defer 节点、error handler，以及 checkpointer/store/cache 的装配。',
          '再向下追踪一次失败路径：节点返回字符串时，Runnable 本身可以正常结束，但 attach_node 生成的 `_get_updates` 无法把它解释为 channel writes，于是抛 InvalidUpdateError；若节点写入拼错的字段，更新过滤或类型测试应尽早暴露。由此可以把错误定位为“用户函数执行失败”“返回协议失败”“reducer 合并失败”三类，而非统一归因于 compile。',
          '编译产物还应带版本证据。生产部署可记录 graph name、代码 commit、State schema version、checkpointer serializer version 和节点清单摘要；恢复旧 thread 时先选择兼容 compiled plan，再加载 checkpoint。只保存一张 Mermaid 图片无法回答运行时到底使用哪份计划。',
          '最后比较“编译时参数”和“调用时参数”：checkpointer、store、cache 与 interrupt 集合决定执行计划具备哪些基础设施；thread_id、tags、recursion_limit 和 context 则随 invoke config 变化。把前者藏在每次请求配置里会产生不可预测的运行时差异，把后者硬编码进 compiled graph 又会破坏多租户与测试隔离。'
        ],
        takeaway: '能从声明图预测 nodes、channels、triggers 和 writers，才算真正掌握 compile，而非记住调用顺序。'
      }
    ],
    mechanisms: [
      'StateGraph 保存可编辑的 nodes、edges、branches、schemas 与 reducer。',
      'compile 先规范化 checkpointer，再执行 builder 结构验证。',
      'State schema 被降低为普通 channels 与 managed values。',
      'input/output schema 决定外部调用和返回投影，不等同于内部完整 State。',
      'CompiledStateGraph 继承 Pregel，因此天然提供 invoke、stream、batch 和 async API。',
      'attach_node 构造 mapper、PregelNode、Runnable bound 和 ChannelWrite。',
      'attach_edge 把单边变成目标 trigger，把多起点 join 变成 NamedBarrierValue。',
      'attach_branch 把路由结果映射为动态 channel writes 或 Send task。',
      'checkpointer/store/cache/interrupt 在 compile 边界绑定到执行计划。',
      '返回前对生成后的 compiled graph 再做运行时结构验证。'
    ],
    pitfalls: [
      '认为 compile 只是设置一个布尔值。',
      'compile 通过后就不写节点返回值和 reducer 测试。',
      '把 output schema 当作节点只能写入的完整字段集合。',
      '混淆 checkpointer、store 和 cache 的一致性语义。',
      '编译后继续修改 builder，并期待旧 graph 自动更新。',
      '把 join 画成两条普通边，忽略 barrier 语义。',
      '把数据库连接放进 State，而非通过 Runtime 注入。',
      '部署新 graph definition 时忽略中断线程和旧 checkpoint。'
    ],
    variants: [
      {
        title: '每次请求重新 build + compile',
        useWhen: '教学、极小动态图，且构建成本可忽略。',
        tradeoff: '定义灵活；重复验证和生成计划增加延迟，也更难固定部署版本。'
      },
      {
        title: '进程启动时 compile 一次',
        useWhen: '绝大多数固定拓扑生产服务。',
        tradeoff: '调用快且版本明确；按租户变化应放到 Runtime/State，不能偷偷改 builder。'
      },
      {
        title: '按 graph version 缓存多个 compiled plan',
        useWhen: '需要灰度、迁移旧 thread 或并行维护版本。',
        tradeoff: '恢复兼容更强；版本路由、资源释放和 observability 标签更复杂。'
      }
    ],
    studyPlan: { readingMinutes: 33, sourceMinutes: 59, practiceMinutes: 83, reviewMinutes: 15 },
    exampleLanguage: 'python',
    example: `from __future__ import annotations

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
assert "unused" in plan_v2.nodes`,
    buildSteps: [
      { title: '积木 1：定义 builder 表示', body: '只保存 nodes、edges、state/input/output schema，不要让它直接承担运行状态。' },
      { title: '积木 2：实现结构验证', body: '覆盖缺入口、未知节点、保留名冲突和非法 END/START 方向。' },
      { title: '积木 3：生成 NodePlan', body: '把函数包装为包含 subscriptions 与 publications 的运行计划。' },
      { title: '积木 4：编译普通边', body: '为目标生成 trigger，为源生成 writer；END 只终止，不创建普通 node。' },
      { title: '积木 5：加入 schema 投影', body: '区分内部完整 state、调用 input 和公开 output。' },
      { title: '积木 6：加入 join barrier', body: '把多起点边编译为 expected set，只有全部到齐才触发目标。' },
      { title: '积木 7：冻结计划', body: 'compile 后修改 builder，旧 plan 的 nodes/edges/schema 不得变化。' },
      { title: '积木 8：对照上游 attach_*', body: '逐项映射到 StateGraph.compile、CompiledStateGraph.attach_node/edge/branch。' }
    ],
    selfCheckQuestion: '给定 OverallState={input, normalized, score, trace}、InputState={input}、OutputState={score}，节点 normalize 返回 normalized 和 trace。请沿 StateGraph.compile 解释这四个字段如何进入 channel、节点为何能写 InputState 之外的字段、invoke 最终为何只返回 score，以及编译后新增 edge 为什么不会改变旧 graph。',
    selfCheckAnswer: 'compile 会收集 OverallState 及节点引用过的 schema，把四个普通字段建立为内部 channels；InputState 只决定 START 输入 channel 接受和向首节点投影哪些字段，并不把内部可写集合缩小到 input。attach_node 的 `_get_updates` 以完整 builder channels 作为普通节点 output_keys，因此 normalize 可以发布 normalized/trace。OutputState 用于计算 `output_channels`，invoke 结束只从 score channel 组装公开返回，内部 normalized/trace 仍可参与调度和 checkpoint。compile 已把当时的 edges 翻译成 PregelNode writers、target triggers 或 barrier channels；旧 CompiledStateGraph 持有这份生成结构，之后 builder.add_edge 只修改声明对象，必须重新 compile 才能进入新运行计划。'
  },
  'Pregel super-step：Plan、Execute、Update 与 BSP barrier': {
    official: {
      title: 'LangGraph runtime · Overview',
      url: 'https://docs.langchain.com/oss/python/langgraph/pregel#overview',
      note: 'Pregel 按 Bulk Synchronous Parallel 模型运行。每一步先 Plan 选出 actor，再并发 Execute；本轮写入对其他 actor 不可见，全部完成后才在 Update 阶段应用 channel updates。'
    },
    source: {
      repo: 'langchain-ai/langgraph',
      file: 'libs/langgraph/langgraph/pregel/_loop.py',
      symbol: 'PregelLoop.tick / PregelLoop.after_tick',
      language: 'python',
      url: 'https://github.com/langchain-ai/langgraph/blob/30c4d58db86455128e42ddec96b1ba53c553ba22/libs/langgraph/langgraph/pregel/_loop.py#L599-L706',
      code: `def tick(self) -> bool:
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
        raise GraphInterrupt()`,
      walkthrough: [
        '`tick()` 对应 Plan，并准备 Execution 所需 task；真正执行由 PregelRunner 完成，循环随后调用 `after_tick()` 进入 Update。',
        '`prepare_next_tasks` 不只看抽象边，而是比较 checkpoint 中每个节点已见 channel version、updated_channels、PUSH task 和 pending writes。',
        '同一轮任务执行时把 writes 收集在 task 上；只有 `after_tick → apply_writes` 才改变 channel，可见性 barrier 因此落在数据结构上。',
        '恢复时 `_reapply_writes_to_succeeded_nodes` 复用本轮已成功任务的写入，失败或 interrupt task 仍可重做。更完整语义会在持久化模块展开。',
        '`not self.tasks` 才是调度停机；`out_of_steps` 是保护失败。两者不能在产品状态上都写成 completed。',
        'Update 后立即生成 checkpoint，并在正确边界检查 interrupt_after，保证暂停点对应稳定快照。'
      ]
    },
    overview: [
      'super-step 是理解 LangGraph 并发语义的核心单位。同一轮被选中的节点都从轮次开始时的 channel 快照读取，执行产生的 writes 暂存在任务中。无论一个节点比兄弟快多少，它的结果都不会在当前轮被另一个兄弟读取；所有选中任务结束后，Update barrier 才统一归并。',
      '这与普通 `asyncio.as_completed` 的流式依赖不同。Pregel 可以并发执行任务，却故意延迟可见性，以换取可推演的轮次语义、确定性 reducer 顺序、稳定 checkpoint 和故障恢复边界。',
      'Plan 并非遍历所有 edge。运行时维护 channel versions 和每个节点 `versions_seen`，只有订阅的 channel 自上次执行后更新，节点才会被激活。循环、静态边、条件分支和 Send 最终都转成 channel/trigger 或 PUSH task。'
    ],
    chapters: [
      {
        kicker: '01 · BSP',
        title: 'Bulk Synchronous Parallel 的三个承诺',
        paragraphs: [
          'Plan 决定“本轮谁运行”；Execution 保证选中任务在同一逻辑轮次执行；Update 把所有写入一次性提交。逻辑同步不要求 CPU 真正同时开始，也不承诺完成时间相等。',
          '关键承诺是 snapshot isolation：本轮 actor 看不到兄弟本轮产生的 update。下一步节点只会读取 barrier 后的新快照。',
          '这让执行时间线可以写成 S0 → Tasks(S0) → Writes → S1，而不是由每个 await 完成顺序产生无数中间状态。'
        ],
        takeaway: 'super-step 是可见性和恢复边界，不只是“循环执行一次”。'
      },
      {
        kicker: '02 · PLAN',
        title: 'Plan 如何从 channel version 选择节点',
        paragraphs: [
          '每个 channel 有版本，checkpoint 记录当前 `channel_versions`；每个 node 记录 `versions_seen`。某订阅 channel 的当前版本高于节点已见版本，说明出现新消息，节点可进入下一轮。',
          '第一轮由 START input channel 激活入口节点。静态 edge 在上一步写入目标 trigger channel，条件分支写入选中目标的 branch channel，Send 则创建 PUSH task。',
          'Plan 还需要重建 task path、retry/cache policy、runtime context 和 read mapper。相同 node 名可能因多个 Send 输入产生多个独立 task，因此 node 与 task 不是一对一。'
        ],
        takeaway: '调度依据是未消费的 channel 更新与 task，而非按邻接表无条件走边。'
      },
      {
        kicker: '03 · EXECUTE',
        title: '并发执行不等于共享可变 State',
        paragraphs: [
          'runner 可以用线程或 asyncio 并发执行本轮任务。每个任务从 channel snapshot 组装自己的 node input，返回 partial update 或 Command，再转换为 writes。',
          '如果两个节点原地修改同一个 Python list，即使 channel barrier 存在，也会通过对象别名泄漏本轮写入，破坏快照隔离。因此节点应把 State 当只读输入，返回新 update。',
          '同步函数在 async 调用中可能通过执行器运行，但取消和 timeout 不能安全终止正在执行的同步 Python 代码。需要强超时边界的 I/O 节点应提供原生 async 实现。'
        ],
        takeaway: 'Pregel 隔离的是 channel 提交，不会魔法般复制你传入的每个可变对象。'
      },
      {
        kicker: '04 · UPDATE',
        title: 'apply_writes 为什么先排序再调用 reducer',
        paragraphs: [
          '上游 `apply_writes` 先按 task path 的稳定前缀排序，再按 channel 分组 writes。随后每个 channel 自己的 `update(vals)` 决定覆盖、追加、聚合或报冲突。',
          'LastValue 通常要求一轮最多一个更新；BinaryOperatorAggregate 依次应用 reducer；Topic 可收集多个值。运行时排序提供稳定输入序列，但 reducer 若不满足适当的代数性质，拓扑变化仍可能改变结果。',
          '成功更新的 channel 获得新 version，并加入 `updated_channels`。下一轮 Plan 只需查这组 channel 能触发哪些 nodes。'
        ],
        code: `# 反例：字符串拼接不是交换的。
def concat(current: str, update: str) -> str:
    return current + update

# 并行节点分别写 "A"、"B"。框架会稳定排序 task，
# 但一旦 task path 或 fan-out 结构改变，结果可能从 "AB" 变成 "BA"。
# 若业务只关心集合，应使用 set union 或显式排序后的结构。`,
        language: 'python',
        takeaway: '确定任务排序能复现当前计划，不代表任意 reducer 都对并行拓扑变化稳定。'
      },
      {
        kicker: '05 · BARRIER',
        title: '为什么快节点不能提前唤醒下游',
        paragraphs: [
          '假设 retrieve 和 profile 在同一轮并行，answer 依赖二者。retrieve 先结束时，它的 writes 仍停在 task buffer；answer 不会在兄弟 profile 结束前启动。',
          'after_tick 将二者写入 channel 后，下一轮 Plan 才观察 updated channel。若 answer 使用显式 join barrier，还必须收齐两个上游信号。',
          '这个语义提高可预测性，却会让最慢兄弟决定轮次延迟。若需要某分支先到先处理，应建更细的流式拓扑或独立 worker，而不是期待 barrier 自动消失。'
        ],
        takeaway: 'super-step 的尾延迟由该轮最慢必需任务决定，这是确定性换来的成本。'
      },
      {
        kicker: '06 · FAILURE',
        title: '同一轮一个任务失败后发生什么',
        paragraphs: [
          'Execution 阶段可在某任务失败时终止本轮。已成功兄弟的 writes 可以作为 pending writes 写入 checkpoint；恢复时重新挂回，而失败任务按 retry policy 重做。',
          '这比“整轮全部重做”减少成本，但外部副作用仍需幂等。任务已调用模型或 API，却在结果写入 checkpoint 前崩溃，恢复无法知道远端动作是否发生。',
          '错误处理节点、重试和超时属于 task policy；业务补偿属于图或外部事务。两者不要用一个笼统 catch-all 混合。'
        ],
        takeaway: '运行时能保存任务写入进度，却不能替外部系统提供原子提交。'
      },
      {
        kicker: '07 · HALTING',
        title: 'done、out_of_steps、interrupt 与 cancelled 不同',
        paragraphs: [
          '没有 task 可准备时 status=done，代表消息耗尽、所有 actor inactive。达到 stop 时 status=out_of_steps，说明运行保护触发，通常应向调用者暴露 `GraphRecursionError`。',
          'interrupt_before/after 是可恢复暂停，checkpoint 中应能继续；cancelled 是外部请求停止，是否保存部分结果取决于宿主协议。',
          '产品状态必须保留这些区别。把所有情况都映射成“已结束”会让监控、重试和用户体验失真。'
        ],
        takeaway: '停机原因是运行合同的一部分，不只是 while 循环返回 False。'
      },
      {
        kicker: '08 · TESTING',
        title: '用虚拟 scheduler 证明轮次语义',
        paragraphs: [
          '测试建立两个并行节点 left/right，让 left 立即完成，right 受 deferred gate 控制。断言 gate 释放前下游未启动，且 right 在本轮看不到 left 的 update。',
          '交换完成顺序，barrier 后 State 应相同；若 reducer 对顺序敏感，测试应明确记录期望 task path 排序。',
          '再覆盖一个任务失败、一个成功的恢复：成功 writes 不应重复执行纯任务，外部副作用节点则必须通过 idempotency key 验证重复调用安全。'
        ],
        takeaway: 'super-step 测试要控制完成顺序和可见性，不能靠 sleep 猜并发。'
      },
      {
        kicker: '09 · TIMELINE',
        title: '一次完整 super-step 的可观察时间线',
        paragraphs: [
          '轮次开始时 checkpoint 已固定 channel values 与 versions。Plan 读取这些版本并生成 task identity、path、trigger、input 和 policy；debug stream 此时可以发出 tasks 事件，但业务 State 尚未变化。',
          'Runner 启动任务后，每个节点产生 writes、error、interrupt 或 return。成功完成只代表任务 buffer 有结果；values stream 要等 apply_writes 更新了对应 output channel 才能宣告新快照。',
          'Update 会消费本轮读取过的 channels、按 channel 归并 writes、递增版本、标记 updated_channels，并在可能的最后一轮调用 channel.finish。随后清理 pending writes、保存 checkpoint，再检查 interrupt_after。',
          '因此 trace 中 node end、updates stream、values stream 和 checkpoint event 可能处于同一轮的不同位置。调试时必须先问观测的是 task 完成、partial update 还是已提交 State，不能把时间戳接近的事件视作同一语义。',
          '如果要计算节点延迟、super-step barrier 等待和端到端延迟，应分别打点 task start/end、最后一个任务结束、apply_writes 完成与 checkpoint 持久化完成。只用 graph.invoke 总耗时会把模型、队列、reducer、序列化和存储混在一起。'
        ],
        takeaway: '把事件放回 Plan/Execute/Update 位置，才能正确解释 stream、checkpoint 与节点日志。'
      }
    ],
    mechanisms: [
      'START/input channel 在第一轮触发入口 actor。',
      'Plan 比较 channel_versions 与 node versions_seen，选择有新消息的 actor。',
      '同一 node 可由多个 Send 形成多个独立 PUSH tasks。',
      'Execution 并发运行本轮 tasks，并把结果暂存为 task writes。',
      '本轮 writes 在 after_tick 前对所有节点不可见。',
      'apply_writes 先稳定排序 task，再按 channel 分组更新。',
      'channel.update 实现覆盖、追加、聚合、barrier 或冲突检测。',
      '成功更新的 channel 递增版本，并驱动下一轮 trigger。',
      '无 task 表示正常 done，超过 stop 表示 out_of_steps。',
      'Update 后 checkpoint 把稳定快照与 interrupt_after 对齐。'
    ],
    pitfalls: [
      '把 super-step 解释成“每个节点执行一次”。',
      '认为并发兄弟能立即读取先完成节点的写入。',
      '在节点内原地修改共享 list/dict，绕过 channel barrier。',
      '用 `as_completed` 风格直觉解释 BSP 更新可见性。',
      '并行 reducer 非结合/非交换，却不写顺序测试。',
      '把 out_of_steps 当成业务成功结束。',
      '认为成功 task 的 pending writes 等同于外部副作用 exactly once。',
      '用真实 sleep 测试轮次，造成偶发失败。'
    ],
    variants: [
      {
        title: '严格 BSP super-step',
        useWhen: '需要可推演快照、稳定 reducer、checkpoint 与恢复。',
        tradeoff: '语义清楚；受最慢任务 barrier 影响，细粒度流式反馈要另建通道。'
      },
      {
        title: '事件驱动逐结果推进',
        useWhen: '下游能独立消费任一分支结果，且接受完成顺序影响。',
        tradeoff: '首结果延迟低；中间状态、恢复与确定性更复杂。'
      },
      {
        title: '外部并行任务 + 图内 join',
        useWhen: '任务很长、需独立扩缩容或跨服务执行。',
        tradeoff: '运行资源隔离；需要 job identity、回调去重、取消和结果持久化协议。'
      }
    ],
    studyPlan: { readingMinutes: 36, sourceMinutes: 59, practiceMinutes: 90, reviewMinutes: 15 },
    exampleLanguage: 'python',
    example: `from __future__ import annotations

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
assert len(engine.trace) == 2`,
    buildSteps: [
      { title: '积木 1：建立 channel version', body: '为每个 channel 保存 version，为每个 actor 保存 versions_seen。' },
      { title: '积木 2：实现 Plan', body: '只有订阅 channel 出现新 version 的 actor 进入本轮；首轮由 START 激活。' },
      { title: '积木 3：冻结 snapshot', body: '本轮开始复制可见 channel 映射，所有 actor 从同一份逻辑快照读取。' },
      { title: '积木 4：暂存 task writes', body: '节点返回值先写入任务 buffer，不直接修改全局 channel。' },
      { title: '积木 5：实现 Update barrier', body: '所有 task 完成后稳定排序、按 channel 分组并调用 reducer。' },
      { title: '积木 6：更新 versions_seen', body: 'actor 被选中时标记已读 trigger version，防止无新消息时反复运行。' },
      { title: '积木 7：加入失败与 pending writes', body: '保存已成功兄弟 writes，失败任务恢复时重做；用 fake side effect 验证幂等。' },
      { title: '积木 8：区分停机状态', body: '分别产出 done、out_of_steps、interrupted 和 cancelled，不能只返回布尔值。' }
    ],
    selfCheckQuestion: 'A 和 B 在同一 super-step 运行：A 很快返回 count=1，B 稍后读取 count 并返回 seen=count；C 订阅 A/B 的结果。初始 count=0。请说明 B 和 C 分别看到什么、writes 何时可见、若 B 失败而 A 成功，恢复时哪些部分可能重做，以及怎样测试而不依赖 sleep。',
    selfCheckAnswer: 'A/B 都从该轮开始时的 channel snapshot 读取，所以 B 的 seen 必须是 0，不能看到 A 本轮的 count=1。A/B 的 writes 先保存在各自 task 中；只有本轮所有必需任务完成后，after_tick 调用 apply_writes 才把它们归并到 channels，C 因相关 channel 在 barrier 后更新而在下一 super-step 被 Plan 选中，因此看到 count=1 和 B 的已提交结果。若 B 失败，运行时可把 A 已成功的 pending writes 持久化并在恢复时重新挂回，B 按 retry policy 重做；但 A 的外部副作用若发生在 checkpoint 前仍需幂等，不能仅凭 pending writes 假设 exactly once。测试应使用 deferred/event gate 控制 B 的完成与失败，先断言 gate 释放前 C 未执行、B 读到旧 snapshot，再释放或 reject；交换 A/B 完成顺序并断言 barrier 后 State 一致。'
  },
  'START、END 与静态边：入口、终止、fan-out 和 join': {
    official: {
      title: 'LangGraph Graph API · START node / END node / Normal edges',
      url: 'https://docs.langchain.com/oss/python/langgraph/graph-api#start-node',
      note: 'START 表示把用户输入发送给首批节点的虚拟入口，END 表示终止目标。普通 edge 固定连接下一节点；一个节点有多个 outgoing edges 时，目标节点在下一 super-step 并行执行。'
    },
    source: {
      repo: 'langchain-ai/langgraph',
      file: 'libs/langgraph/langgraph/graph/state.py',
      symbol: 'CompiledStateGraph.attach_edge',
      language: 'python',
      url: 'https://github.com/langchain-ai/langgraph/blob/30c4d58db86455128e42ddec96b1ba53c553ba22/libs/langgraph/langgraph/graph/state.py#L1537-L1562',
      code: `def attach_edge(self, starts: str | Sequence[str], end: str) -> None:
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
            )`,
      walkthrough: [
        '`constants.py` 把 START/END 定义为 interned `__start__`/`__end__` 字符串，它们是保留地址，不能用作普通 node name。',
        'compile 会为 START 创建输入 `EphemeralValue` 和隐藏 PregelNode，使输入能通过与普通 channel 相同的触发协议进入首批节点。',
        'END 没有对应业务 PregelNode；attach_edge 遇到 end==END 时不写目标 trigger。当前分支没有后续 signal，消息耗尽后 loop 自然 done。',
        '普通边通过源 node writer 写 `_CHANNEL_BRANCH_TO:<target>`。目标 node 在 attach_node 时已订阅自己的 branch channel。',
        '多起点 edge 使用 NamedBarrierValue 收集 source names，目标只有在 expected set 全部到达后才触发。',
        '`defer=True` 目标使用 AfterFinish barrier，使执行时机推迟到图将结束的阶段，不能和普通 join 混为一谈。'
      ]
    },
    overview: [
      'START 和 END 看起来像两个节点，实际是编译协议中的哨兵。START 把一次 invoke 的输入写入专用临时 channel，并触发入口节点；END 不执行函数，也不保存业务 State，它表示该控制分支不再产生下一节点信号。',
      '静态 A → B 不是“调用 B”。A 的 task 在本轮结束时写入 B 的 trigger channel，B 在下一 super-step 被 Plan 选中。因此即使 A/B 都是同步函数，边仍跨越一次 barrier。',
      'fan-out 与 join 必须分开建模。A 同时连向 B/C 会让 B/C 在下一轮并行；若 D 要等二者，则用 `add_edge([B, C], D)` 建 barrier。简单地分别 `B→D`、`C→D` 可能让 D 触发两次，语义完全不同。'
    ],
    chapters: [
      {
        kicker: '01 · SENTINELS',
        title: '为什么入口和终点不用普通业务节点',
        paragraphs: [
          '若 START 是普通 node，就需要一个用户函数、State 输入和执行 task；而入口真正要做的只是把 invoke input 交给 channel 系统。虚拟哨兵可以让条件入口、多个入口和 checkpoint 统一处理。',
          '若 END 是普通 node，每条结束路径还会多一次无意义 task，并要决定它的输入、返回和 checkpoint。终止更自然的定义是没有后续 trigger，下一轮 Plan 得到空 task 集。',
          '哨兵名称保留也能在 compile 阶段拒绝非法拓扑，例如 END 作为起点、START 作为终点或用户节点占用保留名。'
        ],
        takeaway: 'START/END 是控制协议地址，不应承载 prompt、I/O 或业务字段。'
      },
      {
        kicker: '02 · ENTRY',
        title: 'START 如何把 invoke input 变成第一条消息',
        paragraphs: [
          'CompiledStateGraph 的 `input_channels=START`，START channel 类型是 `EphemeralValue(input_schema)`。一次输入只服务当前执行轮次，不像持久聚合 channel 那样跨步累积。',
          '入口可用 `add_edge(START, "node_a")` 固定，也可对 START 添加 conditional branch，让输入先路由到不同首节点。无论哪种，用户 node 都从下一调度步骤开始。',
          '多个普通 `START→A`、`START→B` 表示两个入口并行 fan-out。它不等价于按列表顺序调用 A 再 B。'
        ],
        takeaway: '入口边决定首批活跃 actor，START 自身不会消费一轮业务计算。'
      },
      {
        kicker: '03 · END',
        title: '到达 END 与整个图完成不是同一句话',
        paragraphs: [
          '某分支写向 END 只表示该分支没有后续节点。若同一 super-step 还有另一个并行分支产生后续 trigger，图会继续。',
          '整个 Pregel loop 在 Plan 无法准备任何 task 时才 done。由此可见 END 不是全局 `process.exit()`，也不会主动取消兄弟任务。',
          '若业务要求任一分支命中条件后立即取消其他工作，需要显式 control/cancellation 协议，而不是只把 route 返回 END。'
        ],
        takeaway: 'END 终止一条控制路径；全图停机由所有消息耗尽决定。'
      },
      {
        kicker: '04 · STATIC EDGE',
        title: 'A → B 为何至少跨一个 super-step',
        paragraphs: [
          'A 在本轮 Execution 中返回 update。A 的 writers 同时产生 state writes 和 B trigger write。二者在 Update barrier 一并提交。',
          '下一轮 Plan 看到 B trigger channel version 更新，才物化 B task。B 读取的是包含 A update 的新 State snapshot。',
          '这种设计避免 B 直接嵌套在 A 调用栈中，给 checkpoint、stream 和 interrupt_before(B) 留出稳定边界。'
        ],
        takeaway: '边是“提交后激活”，不是同步函数调用。'
      },
      {
        kicker: '05 · FAN-OUT',
        title: '多个 outgoing edges 怎样形成并行分支',
        paragraphs: [
          'A 同时 `add_edge(A, B)` 和 `add_edge(A, C)` 时，A writers 会向两个 branch channels 写信号。barrier 后 B/C 都在下一轮 Plan 中被选中。',
          'B/C 读取同一个包含 A update 的快照，互相看不到本轮写入。它们若更新同一 LastValue key，Update 会因冲突失败；若要聚合必须为该 key 声明 reducer。',
          '并行是否提高性能取决于 node 类型、async I/O、线程池和模型限流。图语义只声明可并发，不保证下层资源真的并行。'
        ],
        takeaway: 'fan-out 同时引入并发机会与多写者 reducer 合同。'
      },
      {
        kicker: '06 · JOIN',
        title: 'NamedBarrierValue 如何表达“全部到齐”',
        paragraphs: [
          '`add_edge([B, C], D)` 创建 expected={B,C} 的 barrier channel。B/C 完成时各写自己的 node name，channel 收齐集合后才成为 available 并触发 D。',
          '如果 B 通过条件路由根本不会执行，而 barrier 仍期待 B，D 将永远等待。因此静态 join 的上游集合必须和真实控制路径一致；动态 map-reduce 常用 Send/reducer 或专门聚合协议。',
          '循环中的 barrier 还要在消费后重置到下一轮。自己复现时若只用永久 set，第二轮会因旧到达记录立即放行。'
        ],
        takeaway: 'join 是带轮次生命周期的集合 barrier，不是“画两条线到 D”。'
      },
      {
        kicker: '07 · CYCLES',
        title: '静态边可以构成循环，但必须有退出边',
        paragraphs: [
          'A→B→A 是合法拓扑。每次节点 update 会在下一 super-step 激活对方，直到某个条件 branch 选择 END 或不再产生消息。',
          '纯静态闭环没有状态条件可以切断，最终通常撞 recursion_limit。编译器允许环，是因为有意义的 Agent loop 依赖运行时 State 才能决定结束。',
          '设计时把循环头、循环不变量、进度度量和退出条件写出来。只有“模型说结束”而无 schema 约束或步数保护的环很难生产化。'
        ],
        takeaway: '合法拓扑不保证可停机；循环正确性要用进度度量证明。'
      },
      {
        kicker: '08 · TOPOLOGY TEST',
        title: '用 step trace 验证 fan-out/join，而非只看最终值',
        paragraphs: [
          '测试 trace 应明确：step0 START，step1 A，step2 B/C，step3 D。若 D 出现在 step2，说明实现泄漏本轮写入；若出现两次，说明把 join 错写成两条普通边。',
          '让 B/C 交换完成顺序，D 的启动 step 不变。再让一个分支失败，D 必须不执行；恢复后 barrier 只在两者有效写入到齐时开放。',
          '加入一条 B→END 分支，证明它不会全局取消 C→D 路径。这个反例能消除“END 是立即停止”的错误模型。'
        ],
        takeaway: '拓扑测试的主要断言是节点出现在哪一轮、出现几次以及为何被触发。'
      }
    ],
    mechanisms: [
      'START 是保留的 `__start__` 控制地址。',
      'compile 为 START 创建 EphemeralValue 输入 channel 与隐藏 PregelNode。',
      '入口 edge 把 START 输入信号连接到首批 node trigger。',
      'END 是保留的 `__end__` 终止目标，没有普通业务 actor。',
      '普通静态 edge 让源节点 writer 发布目标 branch trigger。',
      '多个 outgoing edges 在下一 super-step 激活多个目标形成 fan-out。',
      '并行节点更新同一 key 时由该 key 的 channel/reducer 决定合法性。',
      '多起点 edge 创建 NamedBarrierValue，并以 source name 作为到达信号。',
      '某路径到 END 不会取消仍有消息的其他路径。',
      '全图在下一轮没有可选 task 时正常 done。'
    ],
    pitfalls: [
      '给 START/END 添加业务函数或业务 State。',
      '认为 A→B 会在同一调用栈或同一 super-step 执行。',
      '认为任一节点到 END 就立即终止全部并行分支。',
      '把 B→D、C→D 当成可靠 join，导致 D 运行两次。',
      '静态 barrier 等待一个条件路径中不会执行的节点。',
      'fan-out 多节点写 LastValue key，却没有 reducer。',
      '把可并发拓扑误当成底层资源必然并行。',
      '建立纯静态闭环，没有业务退出条件。'
    ],
    variants: [
      {
        title: '普通静态边',
        useWhen: '下一节点固定，只有一个源即可触发。',
        tradeoff: '最易读、最易测试；无法根据 State 动态选择路径。'
      },
      {
        title: '多 outgoing fan-out + 显式 join',
        useWhen: '多个独立分支可并行，后续必须等待全部结果。',
        tradeoff: '并发结构清晰；需要 reducer、错误传播和 barrier 完整性。'
      },
      {
        title: 'Conditional edge / Command / Send',
        useWhen: '目标、分支数量或 map 输入由运行时 State 决定。',
        tradeoff: '表达力强；静态图、类型注解、join 与可测试性更复杂，后续路由模块详讲。'
      }
    ],
    studyPlan: { readingMinutes: 32, sourceMinutes: 43, practiceMinutes: 70, reviewMinutes: 15 },
    exampleLanguage: 'python',
    example: `from __future__ import annotations

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
]`,
    buildSteps: [
      { title: '积木 1：定义保留哨兵', body: '拒绝业务节点占用 START/END，并限制非法 edge 方向。' },
      { title: '积木 2：实现 START 投递', body: '把 invoke input 作为首轮 snapshot，通过 outgoing START 选择入口。' },
      { title: '积木 3：编译普通边', body: '源完成后只产生目标 trigger，目标必须到下一轮才运行。' },
      { title: '积木 4：实现 fan-out', body: '同一源可写多个 target trigger，让目标共享下一轮旧快照。' },
      { title: '积木 5：检测并行写冲突', body: '无 reducer 时两个并行节点写同一 key 必须报错。' },
      { title: '积木 6：实现可重置 barrier', body: '记录 expected/arrived，收齐后触发并清空，为下一循环轮次准备。' },
      { title: '积木 7：实现 END 路径', body: 'END 不产生 task；保留其他仍有 trigger 的并行路径。' },
      { title: '积木 8：断言 step trace', body: '验证 extract → [retrieve,profile] → answer 的轮次与单次执行。' }
    ],
    selfCheckQuestion: '图为 START→A，A 同时指向 B 和 C；B→END，C→D→END。另一个版本把 B/C 都连到 D。请分别推演 super-step、D 执行次数与全图结束时机，并说明如何把第二个版本改成真正的 join。',
    selfCheckAnswer: '第一版首轮执行 A，下一轮 B/C 并行；B 到 END 只让 B 分支不再产生 trigger，C 完成后仍会在下一轮激活 D，D 再到 END，之后 Plan 无 task 才全图 done，所以 END 不会取消 C/D。第二版若分别使用普通 B→D 和 C→D，两条源写入都可能触发 D；具体运行时会按触发 channel 产生执行，不能把它当“天然等待全部”，在循环或不同到达轮次下尤其可能多次运行。真正 join 应使用 `add_edge([\"B\", \"C\"], \"D\")`，compile 创建 expected={B,C} 的 NamedBarrierValue，二者各写 source name，收齐后才激活一次 D。若 B 可能条件性跳过，则这个静态 barrier 会悬挂，应重新设计动态聚合或保证所有 expected 分支实际执行。'
  },
  '节点执行契约：Runnable、同步/异步、返回更新与副作用': {
    official: {
      title: 'LangGraph Graph API · Nodes',
      url: 'https://docs.langchain.com/oss/python/langgraph/graph-api#nodes',
      note: '节点可以是同步或异步 Python 函数，接收 state，并可按签名接收 RunnableConfig 与 Runtime。函数在内部被转换为 RunnableLambda，从而获得同步/异步、batch、tracing 与配置注入能力。'
    },
    source: {
      repo: 'langchain-ai/langgraph',
      file: 'libs/langgraph/langgraph/_internal/_runnable.py',
      symbol: 'RunnableCallable.invoke / RunnableCallable.ainvoke',
      language: 'python',
      url: 'https://github.com/langchain-ai/langgraph/blob/30c4d58db86455128e42ddec96b1ba53c553ba22/libs/langgraph/langgraph/_internal/_runnable.py#L278-L526',
      code: `class RunnableCallable(Runnable):
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
    raise TypeError("Expected a Runnable, callable or mapping")`,
      walkthrough: [
        '`StateGraph.add_node` 会调用 `coerce_to_runnable(action, name, trace=True)`，因此节点名、同步/异步能力和 tracing 从注册时就固定在 StateNodeSpec。',
        '`RunnableCallable.__init__` 读取签名，只对受支持的参数名和类型注解做注入。把第二个参数随便命名为 db 并不会自动获得 store。',
        '`invoke` 没有 sync func 时明确报错；`ainvoke` 没有 async func 时回退到 sync invoke。反方向不成立，所以纯 async node 不能通过 graph.invoke 运行。',
        '在 async graph 中执行同步 node 可能阻塞 event loop 或依赖执行器策略；不能因为框架提供 ainvoke 就假设任意同步 I/O 自动非阻塞。',
        'trace=True 时 RunnableCallable 建立 callback run、patch child config，并在异常/完成时通知 tracer；节点稳定命名直接影响可观测性。',
        '节点返回值随后由 CompiledStateGraph.attach_node 的 `_get_updates` 过滤/校验，Runnable 适配与 State update 提取是两个相邻但不同阶段。'
      ]
    },
    overview: [
      'LangGraph node 的最小合同是“读取当前 State snapshot，返回 partial update”。它可以是普通函数、async function、Runnable 或子图。框架会把 callable 适配为 Runnable，再在执行时按签名注入 config/runtime，并把返回值解释为 State update 与控制命令。',
      '把 State 视为只读输入非常重要。原地 mutation 没有清晰的 write set，可能绕过 reducer、污染并行兄弟的 snapshot，也让 checkpoint/trace 无法准确记录变化。返回 `{"field": new_value}` 才能进入 channel update 协议。',
      '副作用需要再分一层：可重算纯函数、可安全重试的幂等查询、有成本但可重试的模型调用、不可逆命令。节点合同要为后两类加入 timeout、retry、idempotency key、outbox 或人工确认，不能把所有错误都交给框架默认重试。'
    ],
    chapters: [
      {
        kicker: '01 · INPUT CONTRACT',
        title: 'State 输入是本轮快照，不是你的私有工作区',
        paragraphs: [
          '默认节点接收 graph state schema；指定 `input_schema` 可只投影部分字段。无论哪种，输入代表本 super-step 开始时可见 State。',
          '节点可以创建局部对象、调用模型和工具，但跨节点事实必须通过 update 返回。把临时 client、callback 或巨大原始响应写入 State 会扩大 checkpoint 并泄漏权限。',
          '输入 schema 是读取合同，完整 graph channels 决定可写字段。节点可返回其输入投影之外、但已在 OverallState 注册的 key。'
        ],
        takeaway: '读集合由 node input schema 控制，写集合由 graph State channels 控制。'
      },
      {
        kicker: '02 · SIGNATURE',
        title: 'state、config 与 runtime 如何注入',
        paragraphs: [
          '第一个位置参数通常是 state。`config: RunnableConfig` 暴露 tags、metadata、callbacks、recursion_limit 和 configurable；`runtime: Runtime[Context]` 暴露 context、store、stream_writer、execution_info 等。',
          '注入依赖参数名和受支持的类型注解。错误注解可能产生 warning 或缺失注入。业务函数应显式声明类型，让 API、IDE 与运行时约定一致。',
          'tenant、model provider 等不可持久依赖放 context；thread_id 属于 config/execution_info；需要参与 reducer 和 checkpoint 的事实才放 State。'
        ],
        code: `from dataclasses import dataclass
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
    return {"answer": f"{thread_id}/{model_name}: {state['query']}"}`,
        language: 'python',
        takeaway: 'State、config、runtime 是三种生命周期，不要用一个万能 dict 代替。'
      },
      {
        kicker: '03 · OUTPUT CONTRACT',
        title: '返回 partial update，而非完整复制或原地修改',
        paragraphs: [
          '节点只返回它更新的字段，runtime 用每个 channel 的 reducer 与旧值合并。完整复制 State 会把未拥有字段也声明为写入，增加并行冲突和 schema 演进风险。',
          '返回普通 dict 时，attach_node 只保留已注册 output_keys；返回错误类型会抛 `InvalidUpdateError`。悄悄拼写错字段可能被过滤或造成意外，因此类型检查与单元测试仍必要。',
          'Command 可以同时携带 update 与 goto，Send 可以创建动态 task。它们改变控制流，不应被当成普通 dict reducer 的语法糖。'
        ],
        takeaway: 'partial update 是显式 write set，也是 reducer、trace 和并发冲突检测的输入。'
      },
      {
        kicker: '04 · MUTATION',
        title: '为什么原地 append 会破坏 super-step 语义',
        paragraphs: [
          '若 state["messages"] 是 list，节点执行 `append` 后再返回同一对象，另一个并行节点可能通过共享引用看到变化，尽管 barrier 尚未提交。',
          '即使当前实现碰巧重建了 schema 对象，依赖这种隐式复制也很脆弱。正确写法是返回新增 message，让 Messages reducer 按 ID 合并；或返回新 list，由明确 reducer 决定 replace/append。',
          '测试可冻结或深拷贝输入，在节点后比较 before；开发期发现 mutation 就失败。大型对象则用只读 domain type 和 mutation API 隔离。'
        ],
        takeaway: '节点纯度至少要求不修改输入 State；外部 I/O 是否纯净是另一条轴。'
      },
      {
        kicker: '05 · SYNC / ASYNC',
        title: '四种调用组合怎样失败',
        paragraphs: [
          'sync node + graph.invoke 是直接路径；sync node + graph.ainvoke 可以回退到同步入口，但若 node 做阻塞 I/O，可能拖住 event loop，具体执行策略要验证。',
          'async node + graph.ainvoke 是原生路径；async-only node + graph.invoke 会因为没有同步函数报 TypeError，而不是自动新建 event loop。',
          '对网络、stream、可取消等待优先 async。对短 CPU 纯计算可 sync；长 CPU 工作应放进进程/任务系统，不要假设 `async def` 会并行执行 CPU。'
        ],
        points: [
          '接口形态必须与宿主调用方式配套。',
          'async 提供协作式等待，不提供 CPU 并行。',
          '同步函数不能在进程内被安全强制取消。'
        ],
        takeaway: '选择 sync/async 依据等待与取消需求，而非个人语法偏好。'
      },
      {
        kicker: '06 · ERROR POLICY',
        title: 'retry、timeout 与错误分类放在哪里',
        paragraphs: [
          '`add_node` 可配置 retry_policy、cache_policy、error_handler 和 timeout。网络抖动、429、临时数据库错误适合有限重试；输入无效、权限拒绝和确定性代码 bug 不应重试。',
          '当前源码明确：节点 wall-clock/idle timeout 只支持 async node，sync node 无法在进程内安全取消。宿主 deadline 仍要覆盖整个 graph。',
          'error handler 可以把失败转换为 State update 和后续路径，但不要吞掉原始 cause、task/node identity 和 retry history。'
        ],
        takeaway: '节点策略应按错误语义配置，默认“所有异常重试三次”会放大成本和副作用。'
      },
      {
        kicker: '07 · SIDE EFFECT',
        title: '把不可逆动作变成可重放协议',
        paragraphs: [
          '查询类副作用可用 request id、cache 和 timeout；命令类副作用如 send/charge 必须用业务 operation_id 去重。operation_id 应来自稳定业务标识，而非每次重试随机生成。',
          '事务性 outbox 节点只在数据库事务中记录 intent；独立 dispatcher 发送并回写结果。图 State 保存 outbox_id 和 status，恢复时查询事实，不直接猜测远端是否成功。',
          '模型调用介于两者之间：通常可重试但有成本和非确定性。可持久化 prompt/model/version/request hash 和结果，恢复优先复用已确认输出。'
        ],
        takeaway: '节点不是副作用隔离箱；可靠性来自明确的提交、去重和查询协议。'
      },
      {
        kicker: '08 · NODE TEST',
        title: '节点测试要脱离整张图',
        paragraphs: [
          '把 node 当普通函数测试：给定最小 State 和 fake Runtime，断言只读了允许字段、返回准确 update、没有原地 mutation。',
          '为 async node 用可控 fake client 覆盖成功、timeout、cancel、retryable 和 permanent error。不要在单元测试直接请求真实模型。',
          '再做 compiled graph 集成测试，验证 input projection、update reducer、trace node name 和调用 API 矩阵。单元与运行时测试各自证明不同合同。'
        ],
        takeaway: '节点先作为纯合同测试，再放进 Pregel 时间线；两层都需要。'
      },
      {
        kicker: '09 · OWNERSHIP',
        title: '为每个字段和外部动作指定唯一所有者',
        paragraphs: [
          '节点设计前先做 ownership matrix：字段由谁创建、谁可更新、reducer 是 replace 还是 aggregate、是否进入 checkpoint、是否包含敏感数据、版本迁移由谁负责。没有所有者的共享字段很快会成为多个节点互相覆盖的隐式总线。',
          '例如 `messages` 可由模型、工具和人工节点共同写，因此必须用消息 ID reducer；`risk_score` 应由风险节点单写，用 LastValue；`audit_events` 可追加但要有去重 ID；`db_client` 不属于任何 State writer，而由 Runtime Context 提供。',
          '外部动作也要有所有者。generate_email 只产出内容，schedule_email 只创建 outbox intent，dispatcher 只负责发送，reconcile 节点查询并把外部确认写回 State。拆开后每个失败窗口都能被命名和测试。',
          '节点越大，局部变量和副作用越多，checkpoint 能选择的恢复粒度越粗。拆分也有成本：更多 super-step、序列化和 trace。应在“需要独立重试/审批/观测的边界”拆，而非把每个函数都变成 node。',
          'ownership matrix 还应记录读权限。包含 PII 的字段不能因为进入共享 State 就对所有节点可见；可通过 input_schema 投影、子图私有 State、最小化 context 和工具授权缩小表面。可恢复性从来不能以无边界共享敏感数据为代价。'
        ],
        takeaway: '节点边界由状态与副作用所有权决定，而非代码行数或组织架构。'
      }
    ],
    mechanisms: [
      'add_node 从函数名/Runnable name 推断稳定节点名称，或接受显式名称。',
      'coerce_to_runnable 把 callable、generator、async callable 或 Runnable 统一适配。',
      'RunnableCallable 检查函数签名，记录可注入 config/runtime 参数。',
      'invoke 要求同步入口；ainvoke 优先 async，无 async 时可回退 sync。',
      'trace wrapper 为节点创建 callback run，并传播 child config。',
      'node input mapper 从声明的 input channels 构建 dict/dataclass/Pydantic 输入。',
      '节点返回 dict/Command 后由 `_get_updates` 提取已注册 State writes。',
      'ChannelWrite 把 partial updates 和 control packets 分开发布。',
      'retry/cache/timeout/error handler 保存在 StateNodeSpec/PregelNode。',
      '外部副作用一致性仍由幂等键、outbox 或业务事务保证。'
    ],
    pitfalls: [
      '在 node 中原地修改 State list/dict。',
      '每次返回完整 State，造成无所有权字段的隐式写入。',
      '把 config、runtime context 和业务 State 混在一起。',
      '纯 async node 却从同步 graph.invoke 调用。',
      'sync node 做阻塞网络 I/O，并以为 ainvoke 自动非阻塞。',
      '对权限错误、校验错误和代码 bug 统一自动重试。',
      '每次重试生成新幂等键，让去重失效。',
      '只做整图端到端测试，节点错误难以定位。'
    ],
    variants: [
      {
        title: '纯函数节点',
        useWhen: '解析、校验、路由特征或确定性转换。',
        tradeoff: '最易测试和重放；真实 Agent 仍需要在边界接模型/工具。'
      },
      {
        title: '原生 async I/O 节点',
        useWhen: '模型、HTTP、数据库或 stream 需要并发、timeout 和取消。',
        tradeoff: '资源利用更好；必须正确传播取消、关闭 client 和限制并发。'
      },
      {
        title: '命令节点 + outbox',
        useWhen: '邮件、支付、发布等不可逆外部动作。',
        tradeoff: '恢复语义可靠；多出 intent、dispatcher、状态查询和补偿流程。'
      }
    ],
    studyPlan: { readingMinutes: 35, sourceMinutes: 55, practiceMinutes: 90, reviewMinutes: 15 },
    exampleLanguage: 'python',
    example: `from __future__ import annotations

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


asyncio.run(main())`,
    buildSteps: [
      { title: '积木 1：定义输入与 partial update', body: '节点接收 State snapshot，只声明自己拥有的 allowed update keys。' },
      { title: '积木 2：检测原地 mutation', body: '运行前后比较输入；分别复现 list.append 和返回新 list 的差异。' },
      { title: '积木 3：实现 sync invoke', body: '纯 async callable 从同步入口必须明确失败，禁止偷偷创建 event loop。' },
      { title: '积木 4：实现 async ainvoke', body: '原生 await async node；sync fallback 只允许短计算，并在文档标明阻塞边界。' },
      { title: '积木 5：注入 Runtime', body: '把 tenant/client/store 从 State 移出，按函数签名注入测试替身。' },
      { title: '积木 6：校验返回 update', body: '拒绝非 dict、未知字段和完整 State 误写，保留清晰错误。' },
      { title: '积木 7：加入 outbox', body: '用稳定 operation_id 写一次 intent，模拟恢复重复调用并断言未重复。' },
      { title: '积木 8：覆盖调用矩阵', body: '测试 sync/sync、sync/async、async/async 和 async/sync 失败四种组合。' }
    ],
    selfCheckQuestion: '一个 async 节点接收 messages、RunnableConfig 和 Runtime[Context]，调用模型后直接 `state[\"messages\"].append(reply)`，随后发送邮件并返回完整 state。请指出至少六个合同问题，并给出可恢复、可测试的重构路径。',
    selfCheckAnswer: '问题包括：一，原地 append 修改输入快照，可能让并行兄弟提前观察写入；二，返回完整 state 把节点不拥有的字段也声明为 writes，增加 reducer 冲突；三，messages 应通过 add_messages 等 reducer 返回新增/替换消息；四，模型、tenant/client 等依赖应从 Runtime Context 注入，thread/trace 配置来自 RunnableConfig，不应混进业务 State；五，模型调用需要原生 async、timeout、取消、错误分类和有限重试；六，发送邮件是不可逆命令，模型结果提交与邮件发送之间存在崩溃窗口；七，直接在同一节点混合生成与发送让单元测试和恢复粒度过大；八，完整原始响应或密钥不得进入 checkpoint。重构为 generate_reply async 节点，只读 messages 并返回 `{\"messages\": [reply], \"email_intent\": ...}`；随后 schedule_email 节点以 thread_id+业务操作构造稳定 operation_id，在事务性 outbox 中 put_once，返回 outbox_id/status；dispatcher 负责真实发送。用 fake model 控制成功、timeout、cancel 和 permanent error，用输入快照断言无 mutation，并重复执行 schedule_email 证明幂等。'
  }
}
