import type { TopicGuide } from '../../topic-guides'

export const langGraphResilienceGuides: Record<string, TopicGuide> = {
  '状态快照与执行元数据：values、tasks、next 与 config': {
    official: {
      title: 'LangGraph Persistence · StateSnapshot fields',
      url: 'https://docs.langchain.com/oss/python/langgraph/persistence#statesnapshot-fields',
      note: '官方把 checkpoint 对外表示为 StateSnapshot：values 是 channel 值，next 与 tasks 描述下一 super-step，config 给出 thread/checkpoint 身份，metadata、parent_config 与 created_at 提供历史因果。页面事实按 LangGraph 1.2.10 核验。'
    },
    source: {
      repo: 'langchain-ai/langgraph',
      file: 'libs/langgraph/langgraph/types.py',
      symbol: 'StateSnapshot',
      language: 'python',
      url: 'https://github.com/langchain-ai/langgraph/blob/41341457342327166d72fc11952ab28fb61ec0bf/libs/langgraph/langgraph/types.py#L643-L661',
      code: `class StateSnapshot(NamedTuple):
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
    # 当前仍待解决的中断`,
      walkthrough: [
        '类注释把时间点钉在 step 开始处，因此 next/tasks 是“即将执行”，metadata.writes 通常解释上一轮如何形成当前 values；把它读成节点执行后的瞬时栈会产生一拍偏差。',
        'values 来自公开 channel 读取，不承诺包含 channel version、触发器或任务 ID。业务代码应消费它，诊断器不能只凭它还原调度。',
        'next 是便于观察的节点名元组，tasks 才承载 task id、错误、中断与子图状态；同一个节点经 Send 并行多次时，next 名称可以重复而 task 身份仍不同。',
        'config 不是普通业务配置。thread_id、checkpoint_ns、checkpoint_id 组成持久化定位键；拿错 checkpoint_id 会读取历史分叉而非最新状态。',
        'parent_config 把快照串成历史链，interrupts 显式列出未解决暂停点。生产审计还应保留部署版本和业务事件 ID，不能让 StateSnapshot 独自承担合规日志。'
      ]
    },
    overview: [
      '第一次调用 graph.get_state 时，最容易把返回值当成“一个更漂亮的 state dict”。这个理解会把恢复问题压扁。StateSnapshot 同时回答三类问题：业务已经知道什么，运行时准备执行什么，以及这份观察属于哪条线程的哪个历史坐标。三类字段拥有不同所有者和演进节奏。',
      '可以把它类比成列车运行图的一张定格照片。values 是车上已经装载的货物，tasks 是下一站待发的具体车次，next 是车次目的站的摘要，config 是线路、班次与照片编号。只看货物不能知道哪辆车将开出，只看目的站也不能证明货物内容。',
      '本课把快照作为可验证合同来读：先建立 step 时间线，再比较 values、next、tasks；随后沿 config 找到历史与分支，最后讨论错误、interrupt 和子图怎样改变观察结果。目标是写出能诊断真实恢复问题的检查器，而非会打印对象。'
    ],
    chapters: [
      {
        kicker: '01 · TIME ORIENTATION',
        title: '先确定快照位于 super-step 的哪一侧',
        paragraphs: [
          'StateSnapshot 的源码定义是“step 开始时的图状态”。若 step 2 的 node_b 已完成并形成 checkpoint，那么该快照的 values 包含 node_b 更新，metadata.writes 解释 node_b 的产出，而 next/tasks 指向 step 3。把 next 当成刚执行完的节点，会让故障报告整体错一轮。',
          '顺序图 START → A → B → END 通常会留下输入、A 前、B 前和完成等边界快照。初始输入也会经过 __start__ 任务，因此 step 可能从 -1 的输入 checkpoint 开始。数字只是运行时计数，业务迁移不要把“step=3”硬编码成某个节点。'
        ],
        code: `snapshot = graph.get_state(config)
print(snapshot.metadata["step"])   # 调度步号
print(snapshot.metadata["writes"]) # 形成当前值的上一轮写入
print(snapshot.next)                # 下一轮节点
print(snapshot.values)              # 当前可见 channel 值`,
        language: 'python',
        takeaway: '任何快照诊断先画 before/execute/barrier/after 时间线，再解释字段。'
      },
      {
        kicker: '02 · BUSINESS VS SCHEDULER',
        title: 'values 保存事实，next 与 tasks 保存程序计数器',
        paragraphs: [
          'values 是 schema 对应 channel 的当前值，例如 messages、order_id、approval。它们决定节点业务逻辑，却不应混入 current_node、retry_task_id 这类调度字段。调度器已经用 next、tasks、channel versions 和 pending writes 保存执行位置，重复写进业务 State 会制造两套可能冲突的真相。',
          'next 适合快速回答“可能执行哪些节点”。tasks 更细：PregelTask 具有稳定 id、name、error、interrupts，并可在请求 subgraphs=True 时附带子图 state。fan-out 三次调用同一 worker 时，next 只看到三个相同名称；定位某个失败输入必须看 task id 和 task path。'
        ],
        takeaway: '业务状态与执行游标分开，才能独立迁移 schema 与调度实现。'
      },
      {
        kicker: '03 · IDENTITY',
        title: 'config 是地址，不是随手透传的 options',
        paragraphs: [
          '持久化配置的 configurable 中至少要理解 thread_id、checkpoint_ns、checkpoint_id。thread_id 选择一条长期会话，checkpoint_ns 隔离父图和子图命名空间，checkpoint_id 选择该线程的一次历史提交。省略 checkpoint_id 时 get_state 通常读取最新快照，带上它则读取指定历史。',
          '重放与继续的差异就在地址中。向最新 thread 配置提交普通输入，含义可能是新一轮；用历史 checkpoint_id 调用，则形成从旧坐标出发的分支。API 调用看似只差一个字段，业务语义却从“继续现在”变成“改写过去”。'
        ],
        points: [
          'thread_id 不是用户 ID，一个用户可以有多个独立线程。',
          'checkpoint_id 不是业务版本号，它定位持久化快照。',
          'checkpoint_ns 使嵌套图可以复用节点名而不碰撞。',
          'recursion_limit 属于 config 顶层，不应塞进 configurable。'
        ],
        takeaway: '把 config 当数据库复合主键审查，复制粘贴旧 checkpoint_id 是高风险操作。'
      },
      {
        kicker: '04 · ERRORS AND INTERRUPTS',
        title: '失败状态要读 tasks，暂停状态要读 interrupts',
        paragraphs: [
          '一个 super-step 中 A 成功、B 失败时，完整 checkpoint 仍停在该 step 的开始边界。A 的结果可能作为 pending write 保存，B 的 PregelTask 则带 error。values 尚未等同于“合并了 A 的最终状态”，因此值、任务错误和 pending write 是三层证据。',
          'interrupt 属于可恢复控制流，并不等同异常。快照可在 tasks 内暴露 task.interrupts，也在新版 StateSnapshot 顶层暴露 interrupts。恢复前应校验 interrupt id、期望响应 schema 与发起节点；只检查 next 是否非空会把人工等待误报成卡死。'
        ],
        takeaway: '状态正常、任务失败、主动暂停可以同时出现在一张快照周围，诊断必须逐层读。'
      },
      {
        kicker: '05 · HISTORY',
        title: 'parent_config 与 history 构成可分叉的提交图',
        paragraphs: [
          'get_state_history 返回按时间倒序排列的 StateSnapshot。parent_config 指向上一 checkpoint，update_state 又会创建新 checkpoint 而非原地覆盖旧对象。从历史节点重新执行会产生新分支，所以它更接近 Git commit graph，而非只能前进的日志数组。',
          '排查时可用 metadata.source 区分 input、loop、update，用 metadata.writes 判断是谁形成当前值，再沿 parent_config 验证父子关系。业务上还应记录 graph schema version 和 deployment sha，否则相同 checkpoint 在新代码下恢复时无法解释行为差异。'
        ],
        takeaway: '可观察历史必须同时带数据版本、图版本和代码版本，时间戳本身不足以重建因果。'
      },
      {
        kicker: '06 · OBSERVER',
        title: '写一个快照检查器，而非到处 print',
        paragraphs: [
          '检查器首先验证 next 与未失败 tasks 的名称对应，再确认每个 task id 唯一、config 具有线程和 checkpoint 身份、metadata.step 单调、完成快照的 next/tasks 都为空。遇到子图 state 时递归检查 namespace，避免父子任务混在同一平面。',
          '检查器不应断言 values 里必有 current_node，也不应把 next=() 一概判定成功：执行可能以异常离开且最后持久快照仍有任务信息。最终运行结论要结合调用异常、trace、checkpoint 与外部业务记录。'
        ],
        takeaway: '好的观测器验证字段间不变量，并明确它看不到的事实。'
      }
    ],
    mechanisms: [
      'StateSnapshot 描述 step 开始边界，values 与 next 在时间线上相隔一次调度。',
      'values 是 channel 的公开值，调度内部版本与触发器不属于业务 State。',
      'next 是节点名摘要，tasks 是带身份、错误、中断和子图状态的执行单元。',
      'thread_id 选择线程，checkpoint_id 选择历史坐标，checkpoint_ns 隔离嵌套图。',
      'metadata.source 区分 input、loop、update，metadata.writes 解释快照来历。',
      'parent_config 连接历史；update_state 与 replay 会产生新 checkpoint 分支。',
      'error 与 interrupt 语义不同，前者是失败证据，后者是等待恢复的控制流。',
      '完成通常表现为 next 与 tasks 为空，但业务成功仍需输出和外部事实证明。'
    ],
    pitfalls: [
      '把 snapshot.values 当成完整 checkpoint 底层结构并手工改写。',
      '把 next 当作刚执行完成的节点，故障时间线整体错一轮。',
      'fan-out 时只按 node name 聚合，丢失具体 task id 与输入。',
      '复用用户 ID 作为所有对话的 thread_id，造成状态串线。',
      '把历史 checkpoint_id 无意带入继续请求，产生时间旅行分支。',
      '只看 next 非空就认定卡死，忽略待处理 interrupt。',
      '把 step 数绑定业务阶段，部署新拓扑后仍依赖固定数字。',
      '让 checkpoint 取代 trace、业务审计和外部副作用记录。'
    ],
    variants: [
      {
        title: '轻量运行状态页',
        useWhen: '客服或运维只需查看当前 values、next、interrupt 与最近错误。',
        tradeoff: '认知负担低、泄露面小；无法解释复杂 fan-out、pending writes 和历史分支。'
      },
      {
        title: '完整 checkpoint 调试器',
        useWhen: '需要 time travel、子图递归、task 级失败定位和版本迁移演练。',
        tradeoff: '诊断能力强；必须做字段脱敏、访问控制、历史分页和版本兼容。'
      },
      {
        title: '业务投影事件',
        useWhen: '产品只关心 approved、sent 等领域阶段，不应暴露运行时结构。',
        tradeoff: '界面稳定且可审计；投影可能滞后，不能替代底层恢复证据。'
      }
    ],
    studyPlan: { readingMinutes: 33, sourceMinutes: 30, practiceMinutes: 67, reviewMinutes: 15 },
    exampleLanguage: 'python',
    example: `from dataclasses import dataclass
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
assert "review" not in snapshot.values`,
    buildSteps: [
      { title: '积木 1：定义三层数据', body: '分别建立业务 values、调度 Task 和 checkpoint address，不允许用一个 dict 混装。' },
      { title: '积木 2：固定时间方向', body: '构造 A 完成、B 待执行的快照，给 metadata.writes、values、next 标注同一时间线。' },
      { title: '积木 3：验证字段不变量', body: '检查 task id 唯一、next 与活动 tasks 对齐、完成态为空、地址字段完整。' },
      { title: '积木 4：加入错误与 interrupt', body: '让一个 task 携带 error、另一个携带 interrupt，输出不同运维结论。' },
      { title: '积木 5：串接历史', body: '加入 parent checkpoint，模拟 update_state 形成分支并验证旧快照保持不变。' },
      { title: '积木 6：对照真实运行', body: '用 InMemorySaver 跑最小图，对 get_state 与 get_state_history 的字段逐项验收。' }
    ],
    selfCheckQuestion: '某线程的快照显示 values 已有 draft，next=("review",)，tasks 中 review 带 interrupt，config 含旧 checkpoint_id。你如何判断它在等待、失败还是已完成；继续、更新状态和从旧点 replay 分别应怎样选择配置？',
    selfCheckAnswer: '结论：它处于 review 的可恢复暂停点，尚未完成。先看 tasks/interrupts 识别主动等待，不能因 values 有 draft 就宣布成功，也不能因 next 非空就当故障。正常恢复应以该线程的最新 checkpoint 配置提交匹配 interrupt 的 Command(resume=...)；人工修正用 update_state 创建新 checkpoint，再从新地址继续；实验性 replay 才显式携带历史 checkpoint_id，并接受后续节点、模型调用和外部请求重新执行。证据链应包括 task id、interrupt id、metadata.step/writes、最新 checkpoint 地址和外部业务状态；若有不可逆副作用，还需幂等记录证明其是否已经发生。'
  },

  '可重放执行：checkpoint、pending writes 与恢复边界': {
    official: {
      title: 'LangGraph Persistence · Pending writes',
      url: 'https://docs.langchain.com/oss/python/langgraph/persistence#pending-writes',
      note: '官方说明同一 super-step 有节点失败时，已成功节点的 task-level writes 会作为 pending writes 耐久保存；恢复该 step 时成功节点无需重跑。完整 StateSnapshot 仍只在 super-step 边界提交。按 1.2.10 的 _loop.put_writes 重新核验。'
    },
    source: {
      repo: 'langchain-ai/langgraph',
      file: 'libs/langgraph/langgraph/pregel/_loop.py',
      symbol: 'PregelLoop.put_writes',
      language: 'python',
      url: 'https://github.com/langchain-ai/langgraph/blob/41341457342327166d72fc11952ab28fb61ec0bf/libs/langgraph/langgraph/pregel/_loop.py#L415-L493',
      code: `def put_writes(self, task_id: str, writes: WritesT) -> None:
    """Put writes for a task, to be read by the next tick."""
    if not writes:
        return

    # 特殊 channel 同一任务最后一次写入胜出
    if all(w[0] in WRITES_IDX_MAP for w in writes):
        writes = list({w[0]: w for w in writes}.values())

    if task_id == NULL_TASK_ID:
        writes_to_save = [
            w[1:] for w in self.checkpoint_pending_writes
            if w[0] == task_id
        ] + list(writes)
    else:
        # 同一 task 的新尝试替换旧 pending writes
        self.checkpoint_pending_writes = [
            w for w in self.checkpoint_pending_writes
            if w[0] != task_id
        ]
        writes_to_save = writes

    self.checkpoint_pending_writes.extend(
        (task_id, channel, value) for channel, value in writes
    )

    if self.durability != "exit" and self.checkpointer_put_writes:
        self.submit(
            self.checkpointer_put_writes,
            self.checkpoint_config,
            writes_to_save,
            task_id,
        )`,
      walkthrough: [
        '入口以 task_id 归属每组写入。恢复判断的最小单位是具体任务尝试，而非只有节点名；并行 Send 多次调用同一节点仍可独立复用。',
        '特殊 channel 的写入会去重，普通 state channel 则保留给 reducer。NULL_TASK_ID 用于非普通节点任务的写入，需要累积而非简单替换。',
        '普通 task 再次提交时先删除相同 task_id 的旧记录，避免一次失败尝试和一次成功尝试同时污染恢复视图。',
        '内存中的 checkpoint_pending_writes 先更新，随后在 durability 允许时调用 checkpointer.put_writes，把任务级结果锚定到当前 checkpoint。',
        '1.2.10 还在持久化 DeltaChannel 前确保缺失的消息 ID 稳定，说明“写入可重放”不仅要保存值，也要稳定其身份。节选删去了 UntrackedValue 清洗、task path、后台 future 与错误标记分支。'
      ]
    },
    overview: [
      '“从 checkpoint 恢复”常被想象成读出一份 state，然后从下一节点继续。并行 super-step 会暴露这个模型的空洞：A 和 B 同时运行，A 完成，B 失败；barrier 尚未通过，所以还没有包含两者合并结果的完整下一快照。若只保存 step 边界，恢复必须重跑 A 与 B。',
      'pending writes 在边界内部再加一层任务级耐久记录。A 的输出按 task_id 绑定到当前 checkpoint，B 的错误也被记录。恢复时运行时重建同一批 task，把已有成功结果注入，真正再执行的只有未成功任务。它减少重复计算，却没有把半轮结果提前暴露为下一轮 state。',
      '这项能力很像仓库收货：整车未验收前不能入库成为新库存，但已经逐箱扫码的合格箱不必退回重扫。扫码记录不是正式库存快照；若其中一箱失败，下一次验收复用合格箱记录，只处理问题箱。',
      '还要区分“结果已经在内存队列中”与“结果已经达到所选耐久级别”。后台 checkpointer 写入可能与下一段计算重叠，sync、async、exit 对进程突然终止时可保留的最近边界并不相同。生产验收不能只在 Python 对象上看到 checkpoint_pending_writes 就宣布安全，而要让持久化后端重新读取同一 thread/checkpoint，核对 task_id、task_path、channel、序列化后的值和错误标记。若后端写入失败，计算成功也只是尚未形成恢复承诺的暂态事实。',
      '恢复测试还要验证 reducer 只在 barrier 成功后把 pending writes 合成一次逻辑更新。若把已复用结果和重试结果提前各合并一次，追加型 reducer 会产生重复消息，计数型 reducer 会翻倍。任务级结果的“已保存”与业务 State 的“已提交”之间存在明确的提交阶段，任何教学实现都应把这条边界线画出来。'
    ],
    chapters: [
      {
        kicker: '01 · TWO DURABILITY LEVELS',
        title: '完整 checkpoint 与 pending write 保存不同承诺',
        paragraphs: [
          '完整 checkpoint 位于 super-step barrier，包含 channel values、versions_seen、下一任务等一致视图。pending write 位于单个 task 完成时，形如 task_id、channel、value，锚定到本轮起始 checkpoint。它证明该任务曾产出什么，不等于全局 reducer 已提交。',
          '因此 time travel 选择完整 checkpoint 边界，不能把任意 pending write 当可公开分叉点。恢复同一失败轮次时才会用这些中间记录跳过已成功 task。把二者混合，会让下游读到只完成一半的并行更新。'
        ],
        takeaway: '任务级耐久用于去重重算，step 级 checkpoint 用于形成一致状态。'
      },
      {
        kicker: '02 · FAILURE TIMELINE',
        title: 'A 成功、B 失败时到底保存了什么',
        paragraphs: [
          '设 step 4 有 fetch_profile 与 score_risk。profile 先完成，其 writes 经 put_writes 保存；risk 抛出异常并留下 ERROR。因为本轮未整体成功，apply_writes 不会把两者作为完整下一状态提交。最新 StateSnapshot 仍描述 step 4 开始时的 values 和待处理 tasks。',
          '恢复后 prepare_next_tasks 以相同 task identity 重建任务，发现 profile 已有成功 writes，于是把它标为可复用；risk 没有成功结果，再次调用。risk 成功后两组 writes 才按确定顺序进入 reducer，barrier 提交 step 5 checkpoint。'
        ],
        code: `step_4_checkpoint
  ├─ task profile → pending write: profile=vip
  ├─ task risk    → ERROR: timeout
  └─ no step_5 checkpoint

resume(step_4)
  ├─ profile → reuse saved write
  ├─ risk    → execute again
  └─ barrier → apply both → checkpoint step_5`,
        language: 'text',
        takeaway: '恢复跳过的是已有成功结果的 task，不是按节点名笼统跳过一段图。'
      },
      {
        kicker: '03 · TASK IDENTITY',
        title: '稳定 task_id 才能把结果交还给正确调用',
        paragraphs: [
          '同一节点可能经 Send 对十个文档并行执行。节点名都是 summarize，pending write 必须依赖由路径和调用位置派生的 task identity，才能知道 doc-3 已成功、doc-7 需要重试。只用节点名作缓存键会把一个输入的摘要错误复用给另一个输入。',
          '代码迁移也会影响身份。Functional API 按调用位置匹配 task 和 interrupt；在恢复点之前插入、删除、重排调用会错配缓存结果。Graph API 以节点边界恢复，风险更多集中在节点名、状态合同和 Send 路径变化。'
        ],
        takeaway: '可重放程序的调用位置与任务身份属于持久化协议，不能当内部细节随意重排。'
      },
      {
        kicker: '04 · SIDE EFFECT GAP',
        title: 'pending write 仍封不住外部副作用的崩溃窗口',
        paragraphs: [
          '节点先调用支付 API 成功，随后在 put_writes 前崩溃。checkpointer 没有成功记录，恢复必然重跑节点；支付系统却可能已经扣款。反过来，先写 State 为 paid 再调用外部 API，崩溃后又可能出现“状态声称成功、真实支付未发生”。',
          '框架无法对任意外部系统做原子提交。解法是稳定 idempotency key，或业务数据库事务内写 outbox，再由投递器以事件 ID 去重。pending writes 降低重复执行概率，幂等协议才约束重复执行后果。'
        ],
        takeaway: 'durable execution 提供至少一次恢复基础，业务必须补上幂等或事务边界。'
      },
      {
        kicker: '05 · INTERRUPT AND RESUME',
        title: 'interrupt 会从节点开头重入，调用前代码必须可重放',
        paragraphs: [
          'interrupt 保存暂停信息并退出当前节点；Command(resume=...) 后节点从开头重新执行，先前 interrupt 调用按顺序获得恢复值。因此放在 interrupt 之前的数据库 append、随机数和网络请求可能再次发生。',
          '安全结构是把副作用放到 interrupt 之后，或拆成独立幂等节点；若前置计算昂贵或非确定，则封装为能单独持久化结果的 task。多个 interrupt 的顺序也属于协议，部署时重排会让旧 resume value 对上新问题。'
        ],
        takeaway: '暂停恢复是重新进入可记录程序，不是冻结 Python 调用栈后原地解冻。'
      },
      {
        kicker: '06 · DURABILITY MODES',
        title: '异步持久化、同步持久化与 exit 模式选择失败窗口',
        paragraphs: [
          '耐久策略决定写入与计算如何重叠。同步等待把 checkpoint 失败尽早暴露，延迟较高；异步写可提高吞吐，但进程突停时最近计算可能尚未落盘；exit 只在运行退出时集中保存，适合可整体重算且无需中途恢复的短任务。',
          '策略不能只凭基准吞吐选。要先定义恢复点目标、可接受重算成本、外部副作用风险和 checkpointer 故障处理。支付审批与离线摘要即使使用相同图结构，也应拥有不同 durability 策略。'
        ],
        takeaway: '持久化模式实质是在延迟、写放大和故障丢失窗口之间做业务选择。'
      },
      {
        kicker: '07 · CRASH LAB',
        title: '用逐点杀进程证明恢复合同',
        paragraphs: [
          '测试至少覆盖：task 执行前、外部调用后、put_writes 前后、barrier 合并前后、checkpoint 提交前后。每个注入点记录 task 调用次数、pending writes、完整快照和外部幂等表，再恢复同一 thread。',
          '验收标准是纯任务允许重算，已有成功 pending write 不重算，失败任务按策略重试，reducer 只提交一次逻辑更新，不可逆副作用以 operation_id 保持一次业务效果。仅做“正常跑通后再次 invoke”无法验证崩溃窗口。'
        ],
        takeaway: '恢复能力需要故障注入证据，成功路径单测无法替代。'
      }
    ],
    mechanisms: [
      '每个 task 完成时可用 put_writes 保存 task_id、channel、value。',
      'pending write 绑定当前起始 checkpoint，不是新的完整 StateSnapshot。',
      '失败 super-step 恢复时重建相同任务，成功 writes 被复用，失败任务重跑。',
      '所有任务完成后才通过 reducer 合并并提交下一 step checkpoint。',
      'task identity 区分同一节点的多次并行调用，不能退化成节点名缓存。',
      'interrupt 恢复会从节点开头重入，resume 值按调用顺序匹配。',
      'durability 模式改变落盘等待与故障窗口，不改变外部系统原子性。',
      '外部副作用仍需幂等键、去重表、事务性 outbox 或补偿协议。',
      'DeltaChannel 等增量持久化还要求消息等元素身份在写入前稳定。',
      'time travel 从完整 checkpoint 分叉，不能从任意半轮 pending write 分叉。'
    ],
    pitfalls: [
      '宣称 pending writes 提供 exactly-once 节点执行。',
      '用 node name 代替 task id，fan-out 结果交叉复用。',
      '把半轮成功 writes 直接暴露成一致业务 State。',
      '在 interrupt 前创建不可去重的外部记录。',
      '持久化成功前就向用户确认扣款或发送完成。',
      '恢复时换 thread_id，导致运行时看不到已有 pending writes。',
      'Functional API 在恢复点前重排 task/interrupt 调用。',
      '只测试异常重试，不在真实崩溃窗口杀进程。',
      '选择异步 durability 却没有定义进程突停的重算预算。',
      '以为 InMemorySaver 能提供跨进程生产耐久性。'
    ],
    variants: [
      {
        title: '任务级 pending writes',
        useWhen: '同一 super-step 有昂贵并行节点，希望失败恢复只重跑未成功任务。',
        tradeoff: '显著减少重算；checkpointer 写入更多，任务身份和序列化合同更严格。'
      },
      {
        title: '只做 step 边界 checkpoint',
        useWhen: '任务廉价、纯计算、整轮重算可接受，或外部引擎已经管理任务缓存。',
        tradeoff: '实现和存储简单；任一并行任务失败会让整轮重算。'
      },
      {
        title: '事务性 outbox 组合',
        useWhen: '节点会扣款、发信或写跨服务事实，需要可证明的一次业务效果。',
        tradeoff: '恢复语义最可靠；引入业务数据库表、投递 worker、去重与监控。'
      }
    ],
    studyPlan: { readingMinutes: 38, sourceMinutes: 52, practiceMinutes: 85, reviewMinutes: 15 },
    exampleLanguage: 'python',
    example: `from dataclasses import dataclass, field
from typing import Callable

@dataclass
class Store:
    pending: dict[str, dict[str, str]] = field(default_factory=dict)

    def put_writes(self, task_id: str, writes: dict[str, str]) -> None:
        self.pending[task_id] = dict(writes)

calls = {"profile": 0, "risk": 0}

def profile() -> dict[str, str]:
    calls["profile"] += 1
    return {"profile": "vip"}

def risk() -> dict[str, str]:
    calls["risk"] += 1
    if calls["risk"] == 1:
        raise RuntimeError("temporary")
    return {"risk": "low"}

tasks: dict[str, Callable[[], dict[str, str]]] = {
    "task-profile": profile,
    "task-risk": risk,
}
store = Store()

for task_id, task in tasks.items():
    try:
        store.put_writes(task_id, task())
    except RuntimeError:
        pass

for task_id, task in tasks.items():
    if task_id not in store.pending:
        store.put_writes(task_id, task())

state = {}
for writes in store.pending.values():
    state.update(writes)

assert state == {"profile": "vip", "risk": "low"}
assert calls == {"profile": 1, "risk": 2}`,
    buildSteps: [
      { title: '积木 1：建立 step checkpoint', body: '保存本轮输入 state 与待执行 task，不提前合并任何半轮结果。' },
      { title: '积木 2：加入 task identity', body: '让同名 worker 的不同输入拥有稳定 task_id，并写碰撞测试。' },
      { title: '积木 3：实现 put_writes', body: '按 task_id 保存 channel/value，同一任务新尝试替换旧结果。' },
      { title: '积木 4：制造并行半失败', body: 'A 成功、B 首次失败，断言没有完整下一 checkpoint 但 A writes 已存在。' },
      { title: '积木 5：恢复未完成任务', body: '重建 tasks，已有成功结果直接注入，只有 B 调用次数增加。' },
      { title: '积木 6：通过 barrier', body: '按固定顺序把 A/B writes 交给 reducer，再创建下一完整快照。' },
      { title: '积木 7：加入幂等副作用', body: '用 thread_id + operation 建立下游 idempotency key，注入调用成功后落盘前崩溃。' },
      { title: '积木 8：验证 durability 策略', body: '分别模拟 sync、async、exit 的停止点，记录可丢失窗口与重算量。' }
    ],
    selfCheckQuestion: '同一 super-step 的 A 已调用支付 API 并返回、B 失败；A 的 put_writes 是否成功未知。恢复时哪些部分可能重跑，pending writes 能保证什么，怎样才能防止重复扣款？',
    selfCheckAnswer: '结论：B 必须重跑；A 只有在相同 checkpoint 下存在可匹配的成功 pending write 时才会复用，否则也可能重跑。pending writes 保证运行时能识别已经耐久保存的 task 结果并避免其重复计算，无法覆盖“支付成功但结果尚未持久化”的崩溃窗口，也不提供外部 exactly-once。标准方案是在第一次调用前生成稳定 idempotency key，例如 thread_id + payment_operation，把它交给支付端去重；或在业务数据库事务中写 outbox，由投递器按事件 ID 发送。恢复测试要在 API 返回、put_writes 前后分别杀进程，并同时核对 task 调用次数、pending writes、checkpoint 和支付端去重记录。'
  },

  '确定性：reducer 顺序、任务排序与外部 I/O': {
    official: {
      title: 'LangGraph Functional API · Determinism',
      url: 'https://docs.langchain.com/oss/python/langgraph/functional-api#determinism',
      note: '官方要求把随机数、当前时间、网络结果等非确定操作封装为 task 并持久化，使同一运行恢复时沿相同调用序列复用结果；同时强调副作用仍须幂等。Graph API 的 reducer 写入顺序由运行时任务路径排序提供结构稳定性。'
    },
    source: {
      repo: 'langchain-ai/langgraph',
      file: 'libs/langgraph/langgraph/pregel/_algo.py',
      symbol: 'apply_writes',
      language: 'python',
      url: 'https://github.com/langchain-ai/langgraph/blob/41341457342327166d72fc11952ab28fb61ec0bf/libs/langgraph/langgraph/pregel/_algo.py#L232-L333',
      code: `def apply_writes(
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

    return updated`,
      walkthrough: [
        '函数先按 task.path 的稳定前缀排序，而不是采用线程完成顺序。并行 I/O 谁先返回会变化，但交给 reducer 的 writes 顺序必须能重现。',
        'versions_seen 记录每个节点消费过的 channel version，避免未变化输入反复触发；它约束调度，不等于用户可见的业务版本。',
        'writes 随已排序 tasks 分组到 channel。同一 channel 的 reducer 会收到稳定序列；不同 channel 独立更新。',
        'channel.update 决定覆盖、追加或自定义归并。运行时只能固定输入顺序，无法让错误的、依赖隐藏全局变量的 reducer 自动纯化。',
        '节选删除了特殊 channel、finish 通知和 version 生成。返回 updated channel 集合用于触发下一轮；确定调度仍不能冻结模型、时钟或外部数据库。'
      ]
    },
    overview: [
      '确定性经常被简化成“同样输入得到同样输出”。对 Agent 工作流，更有用的目标分三层：同一 super-step 的并发 writes 以稳定顺序归并；同一已暂停运行恢复时复用已记录的非确定结果；不同全新运行允许模型、网络和时间给出不同结果。把三层混在一起，团队会对“可重放”做出超出框架能力的承诺。',
      'LangGraph 能控制自己拥有的部分：任务路径、channel version、reducer 输入序列、checkpoint 与 task 结果。它无法控制模型供应商、远端搜索索引、数据库当前值、随机数源和操作系统调度。正确策略是把这些观察变成显式事件并持久化，再让路由只依赖已记录值。',
      '本课用一个故意非交换的 reducer 暴露顺序问题，再把外部 I/O 划分为 observation 与 effect。observation 如模型输出影响后续路线，需要记录供恢复复用；effect 如发信改变外界，需要幂等键保证重试后业务效果收敛。需要始终追问并严格验证：这份稳定性究竟来自运行时排序、已保存事件，还是外部系统自身的协议。'
    ],
    chapters: [
      {
        kicker: '01 · THREE CLAIMS',
        title: '区分归并确定、恢复一致与跨运行复现',
        paragraphs: [
          '归并确定性指同一批 task writes 不论实际完成先后，都按 task path 的固定顺序交给 reducer。恢复一致性指同一 run 在 interrupt 或故障后继续时，已经耐久的 task 结果不重新观察世界。跨运行复现则要求模型版本、参数、数据快照、随机种子和外部依赖都被冻结，难度最高。',
          '工程文档应准确写出承诺。例如“同一 checkpoint 的成功任务结果会复用，未记录任务可能重跑；新运行不保证文本逐字相同”。笼统写“流程是 deterministic”会掩盖供应商升级、检索索引变化和外部副作用。'
        ],
        takeaway: '确定性是分层合同，先写清比较的是哪两个执行。'
      },
      {
        kicker: '02 · ORDERED REDUCTION',
        title: '为什么并发完成顺序不能直接进入 reducer',
        paragraphs: [
          'fan-out 的 A、B 都向 transcript 追加值。若 runner 谁先完成谁先 update，网络抖动就会把列表顺序变成 A,B 或 B,A，后续 prompt 与路由随之改变。apply_writes 先按稳定 task path 排序，切断 wall-clock race 与语义顺序的联系。',
          '排序不要求 reducer 交换，但要求 path 生成稳定。对于逻辑上无序的集合，仍建议 reducer 显式按业务 key 排序或使用 map；把偶然的 fan-out 索引当领域顺序，会在拓扑调整后改变结果。'
        ],
        code: `# 完成顺序：[B, A, C]
# task path 顺序：[A, B, C]
ordered = sorted(tasks, key=lambda t: t.path[:3])
transcript = " > ".join(t.write for t in ordered)
assert transcript == "A > B > C"`,
        language: 'python',
        takeaway: '运行时排序消除竞速，业务排序仍应由稳定领域键表达。'
      },
      {
        kicker: '03 · REDUCER LAWS',
        title: '结合律、交换律、幂等性决定你能否安全并行',
        paragraphs: [
          '追加列表满足结合律但不交换；集合并集同时结合、交换、幂等；数字加法结合且交换，却不幂等。知道这些性质才能判断重排、分批和重复写会怎样影响状态。自定义 reducer 若读取全局时间或原地修改输入，即使运行时固定顺序也难以重放。',
          '对每个 reducer 做性质测试：随机生成三组 writes，验证 regroup 是否一致；打乱顺序观察是否允许；重复一项观察是否应去重。若业务需要 last-write-wins，必须定义“last”依据 task path、事件序号还是业务时间，不能默认为完成时钟。'
        ],
        takeaway: 'reducer 是并行状态机的代数合同，不只是两个参数的工具函数。'
      },
      {
        kicker: '04 · OBSERVATIONS',
        title: '随机数、时间和模型输出要变成已记录观察',
        paragraphs: [
          'Functional API 恢复时会从 entrypoint 开头重放，并按调用位置复用已完成 task。若 time.time、random.random 或模型调用写在 task 外，恢复会得到新值，可能走到不同 interrupt 或调用序列，随后缓存结果和 resume value 都会错位。',
          '把非确定读取放进 task 的意义并非让第一次结果可预测，而是让它一旦发生就成为该 run 的事实。Graph API 节点本身是恢复边界；昂贵观察仍应拆成独立节点或可持久 task，避免同一节点在 interrupt 重入时再次调用。'
        ],
        takeaway: '记录随机结果，而非幻想消灭随机性，才能让一次具体运行保持身份。'
      },
      {
        kicker: '05 · EFFECTS',
        title: '观察需要复用，副作用需要收敛',
        paragraphs: [
          '读取汇率是 observation，它影响计算，恢复应尽量复用同一次快照；提交订单是 effect，它改变外部世界，重试时必须以 operation_id 返回同一业务结果。两者都属于 I/O，却需要不同协议。',
          '常见做法是为 observation 记录 provider、请求参数、响应、获取时间与版本；为 effect 记录 idempotency key、请求摘要、外部事务号和最终状态。只把完整 HTTP body 塞入 State 会造成密钥泄露与体积膨胀，应存安全引用或最小重放字段。'
        ],
        takeaway: '把 I/O 先分类为观察或效果，才能选择缓存、幂等或补偿。'
      },
      {
        kicker: '06 · CODE EVOLUTION',
        title: '部署变化也会破坏同一运行的重放序列',
        paragraphs: [
          'Functional API 用 task/interrupt 的位置匹配缓存和恢复值。若在旧运行暂停点之前新增一个 task，旧的第 N 个结果可能被交给新的第 N 个调用。官方 backward compatibility 因此建议让存量运行排空，或发布新的 entrypoint 名称。',
          'Graph API 从节点边界重入，新增边通常安全，删除待执行节点却会失去地址。两种 API 都要求把可恢复结构当持久协议进行版本评审，而不只比较 Python 类型是否通过。'
        ],
        takeaway: '能继续运行旧 checkpoint 的代码变化，才算工作流意义上的向后兼容。'
      },
      {
        kicker: '07 · EVIDENCE',
        title: '用扰动测试证明哪些层保持稳定',
        paragraphs: [
          '测试一：随机打乱并发任务完成顺序，断言 reducer 结果稳定。测试二：在 interrupt 后改变系统时间与随机种子，断言已记录 task 结果仍复用。测试三：让外部 effect 在响应丢失后重试，断言幂等表只有一个业务事务号。',
          '再运行两次全新 thread，允许模型文本不同，但要求 schema、停机条件和安全不变量成立。这样测试既不把非确定系统强行锁成字符串快照，也不放弃对可恢复结构的严格验证。'
        ],
        takeaway: '确定性测试要主动扰动调度、时间与网络，再按分层合同断言。'
      }
    ],
    mechanisms: [
      'apply_writes 按 task.path 稳定排序，隔离实际完成时钟。',
      '排序后的 writes 先按 channel 分组，再交给各 channel reducer。',
      'channel versions 与 versions_seen 决定哪些更新触发下一 super-step。',
      '结合律影响分批归并，交换律影响重排，幂等性影响重复写。',
      'Functional API 用持久 task 结果让同一 run 恢复时复用非确定观察。',
      'task 和 interrupt 的调用位置构成 Functional API 的重放协议。',
      'Graph API 在节点边界恢复，节点内 interrupt 仍会从节点开头重入。',
      'observation 需要记录和复用，effect 需要幂等、outbox 或补偿。',
      '全新 run 可以产生不同结果，可恢复 run 应保持已记录事实一致。',
      '代码版本、模型版本与数据快照决定更强的跨运行复现能力。'
    ],
    pitfalls: [
      '把稳定 reducer 顺序夸大成整个 Agent 输出确定。',
      '让 reducer 读取当前时间、随机数或可变全局变量。',
      '用任务完成时间定义业务上的最后写入。',
      '依赖 set/dict 的偶然输出顺序形成 prompt。',
      '在 Functional entrypoint 的 task 外调用模型或网络。',
      '在旧暂停点前重排 task/interrupt 却继续复用原图名。',
      '把 observation 与 effect 都用普通缓存处理。',
      '只设随机种子，却不冻结模型、内核、数据和供应商版本。',
      '用最终文本完全相等测试新 thread，造成脆弱回归门。',
      '忽略 1.2.10 对持久化消息 ID 稳定性的修复背景。'
    ],
    variants: [
      {
        title: '稳定有序 reducer',
        useWhen: '输出顺序具有语义，例如消息、步骤或证据优先级。',
        tradeoff: '可解释且可重放；必须维护稳定业务 key，拓扑索引变化可能成为迁移事件。'
      },
      {
        title: '交换幂等 reducer',
        useWhen: '状态本质是集合、最大值或按唯一 ID 合并的映射。',
        tradeoff: '对并行顺序和重复写更稳健；会丢失到达顺序，冲突解决规则需明确。'
      },
      {
        title: '事件记录后决策',
        useWhen: '模型、随机、时间或远端读取会改变路由且必须可恢复。',
        tradeoff: '同一运行可审计；增加存储、脱敏、保留期和供应商数据许可成本。'
      }
    ],
    studyPlan: { readingMinutes: 35, sourceMinutes: 50, practiceMinutes: 75, reviewMinutes: 15 },
    exampleLanguage: 'python',
    example: `from dataclasses import dataclass

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
assert event_log["route-choice"] == "manual-review"`,
    buildSteps: [
      { title: '积木 1：制造竞速', body: '让三个 task 以随机延迟完成，先观察按完成时钟 append 的不稳定结果。' },
      { title: '积木 2：加入稳定 path', body: '按路径前缀排序后再归并，重复一百次断言顺序相同。' },
      { title: '积木 3：测试 reducer 定律', body: '为 list append、set union、last-write-wins 分别检查结合、交换和幂等。' },
      { title: '积木 4：记录 observation', body: '把随机路由和当前时间封装成可持久 task，恢复时只读取事件。' },
      { title: '积木 5：隔离 effect', body: '为发送动作加入 operation_id，模拟响应丢失后的重复请求。' },
      { title: '积木 6：破坏调用序列', body: '在 Functional workflow 的 interrupt 前插入 task，写测试展示位置错配风险。' },
      { title: '积木 7：做分层回归', body: '同 run 断言事实复用，新 run 只断言 schema、停机和安全不变量。' }
    ],
    selfCheckQuestion: '两个并行节点都向同一列表 reducer 写入，模型调用又决定后续路由。LangGraph 能保证哪些顺序或结果，哪些不能；你会怎样设计可恢复且可测试的合同？',
    selfCheckAnswer: '结论：运行时会按稳定 task path 排序同一 super-step 的 writes，再把它们按 channel 交给 reducer，因此不会让线程完成先后直接决定列表顺序；它无法保证模型供应商每次返回相同文本，也无法让错误 reducer、外部时间或数据库自动确定。把模型调用作为独立可持久 task/节点，其响应和模型版本作为 observation 记录；同一 run 恢复时复用该结果，新的 run 允许不同。列表若存在领域顺序，应使用稳定业务 key 排序；若顺序无意义，改用按 ID 合并的交换幂等 reducer。测试要打乱完成时序、改变随机种子并恢复同一 checkpoint，验证已记录路由不变；另用新 thread 验证输出 schema、终止、安全和幂等副作用，而非强求文本逐字相同。'
  },

  '拓扑验证与迁移：孤立节点、循环和 interrupt 兼容': {
    official: {
      title: 'LangGraph Graph API · Graph migrations',
      url: 'https://docs.langchain.com/oss/python/langgraph/graph-api#graph-migrations',
      note: '官方区分完成线程与 interrupted 线程：完成线程可更换全部拓扑；中断线程通常能接受边变化，但删除或重命名其可能进入的节点会破坏恢复。State key 的重命名会丢失旧值，不兼容类型变化可能失败。'
    },
    source: {
      repo: 'langchain-ai/langgraph',
      file: 'libs/langgraph/langgraph/graph/state.py',
      symbol: 'StateGraph.validate',
      language: 'python',
      url: 'https://github.com/langchain-ai/langgraph/blob/41341457342327166d72fc11952ab28fb61ec0bf/libs/langgraph/langgraph/graph/state.py#L1116-L1162',
      code: `def validate(self, interrupt: Sequence[str] | None = None) -> Self:
    all_sources = {source for source, _ in self._all_edges}
    for start, branches in self.branches.items():
        all_sources.add(start)
    for name, spec in self.nodes.items():
        if spec.ends:
            all_sources.add(name)

    for source in all_sources:
        if source not in self.nodes and source != START:
            raise ValueError(
                f"Found edge starting at unknown node '{source}'"
            )

    if START not in all_sources:
        raise ValueError("Graph must have an entrypoint")

    all_targets = {end for _, end in self._all_edges}
    for target in all_targets:
        if target not in self.nodes and target != END:
            raise ValueError(
                f"Found edge ending at unknown node '{target}'"
            )

    if interrupt:
        for node in interrupt:
            if node not in self.nodes:
                raise ValueError(f"Interrupt node '{node}' not found")

    self.compiled = True
    return self`,
      walkthrough: [
        '验证器先从静态边、条件分支和 Command 的 ends 声明收集所有 source；动态路由若不给 Literal 或 path_map，只能保守认为可能到很多节点。',
        '所有 source 必须是已注册节点或 START，并且图必须至少有一个 START 出边。这个检查防止拼写错误和无入口图，不证明业务最终可终止。',
        '目标集合允许 END，其他目标必须存在。静态可知的悬空边会在 compile 前失败；运行时字符串路由仍可能产生未知节点。',
        'interrupt_before/after 的节点名也在编译时核对。它只证明当前图包含该名字，无法证明历史 checkpoint 所等待的旧 interrupt 与新响应 schema 兼容。',
        'validate 最后标记 compiled。它没有读取任何生产 checkpoint，所以不可能发现旧线程 next 指向被重命名节点、旧 State 缺少新必填字段或业务语义已经改变。'
      ]
    },
    overview: [
      '编译通过回答的是“这张新图在自身定义中是否自洽”。线上迁移还要回答“昨天保存的执行地址和数据，今天的代码是否仍能解释”。两者像编译一个新版数据库客户端与读取旧表：类型检查成功，并不代表列重命名、枚举收紧和存量数据都安全。',
      'LangGraph 默认让最新部署的图代码作用于现有线程，并不会把每个运行永久钉在启动时的代码版本。好处是修复立即生效，代价是每次节点、State、interrupt 或 Functional 调用序列变化都成为持久协议变更。',
      '本课建立双门禁：静态拓扑验证负责当前图；存量线程审计负责 checkpoint 兼容。迁移先枚举 busy、interrupted、error 线程的 next/tasks/state，再决定双写、兼容节点、排空、分版本图名或一次性数据转换。'
    ],
    chapters: [
      {
        kicker: '01 · STATIC GATE',
        title: 'validate 能证明什么，又刻意不证明什么',
        paragraphs: [
          'StateGraph.validate 能发现未知 source/target、缺少 START 入口和无效 interrupt 节点。它还会根据静态边、branch path_map 与节点 ends 收集可能目标。这些是图定义内部的一致性问题，应在提交前快速失败。',
          '它不会证明所有节点可达、所有循环终止、所有动态路由字符串合法，也不会访问 checkpointer。孤立但注册的节点可能只是未来入口或死代码；是否禁止要由项目 lint 规则决定。'
        ],
        takeaway: 'compile validation 是结构类型检查，不是模型检查器或迁移审计器。'
      },
      {
        kicker: '02 · SAVED ADDRESS',
        title: '中断线程保存的是节点地址，删除名字就失去落点',
        paragraphs: [
          'interrupted thread 的 snapshot.next/tasks 可能写着 human_review。部署后若把节点改名为 approval，运行时加载旧 checkpoint 时仍会寻找 human_review；新边画得再正确，也没有函数可接住这个地址。',
          '安全重命名采用 add-then-remove：保留旧节点名作为兼容适配器，内部调用新实现或迁移旧 State；新路径改走新节点；待所有旧线程排空后再删除。节点名因此应像公开 API endpoint 一样稳定。'
        ],
        takeaway: '对存量 checkpoint 而言，node name 是可持久程序计数器。'
      },
      {
        kicker: '03 · EDGES',
        title: '边通常未持久化，但业务路线仍可能需要版本锁',
        paragraphs: [
          '官方指出 interrupted thread 通常可以接受新增、删除或改道边，只要待进入节点仍存在。因为 checkpoint 保存当前状态和下一节点，节点完成后的新路由由最新图计算。技术上能跑，不代表业务上允许。',
          '若审批中的订单必须继续旧费率流程，就应在 State 保存 policy_version，并让路由按版本选择；或发布 v2 图名，把新线程导向 v2、旧线程留在 v1。把业务兼容寄托在“边不持久化”会让存量运行静默改变承诺。'
        ],
        takeaway: '技术兼容只保证能执行，业务兼容还要保持启动时承诺。'
      },
      {
        kicker: '04 · STATE SCHEMA',
        title: '新增、删除、重命名与类型收紧的风险不同',
        paragraphs: [
          '新增可选字段最安全：旧 checkpoint 缺失时节点使用默认值。删除不再读取的字段通常可容忍额外数据。重命名却不会自动搬运旧值，新字段看起来像从未存在；把 Optional 收紧为必填或把字符串改成不兼容对象，也可能让旧状态无法验证或执行。',
          '稳定做法是 schema_version + 分阶段迁移：先新增 new_key 并兼容读取 old_key，节点双写；后台统计旧线程；再停止写 old_key；最后排空后删除。类型转换应是显式、幂等、可审计函数。'
        ],
        takeaway: 'State 是持久数据合同，演进方式应接近数据库 schema migration。'
      },
      {
        kicker: '05 · INTERRUPT CONTRACT',
        title: '节点还在并不代表人工恢复协议仍兼容',
        paragraphs: [
          '旧 interrupt 可能询问布尔 approve，新版本期待包含 reason、scope 的对象。节点名相同，Command(resume=True) 到达新代码后仍可能解析失败或更危险地被错误解释。interrupt payload、resume schema 与调用顺序都应版本化。',
          '在 State 或 interrupt value 中保留 contract_version，新节点同时解析旧版与新版；无法兼容时让旧图排空。迁移验收必须拿真实历史 checkpoint 做恢复演练，单纯重新触发一个新版 interrupt 无法覆盖旧 payload。'
        ],
        takeaway: '可恢复人工交互是一条跨部署 API，问题和答案都需要版本。'
      },
      {
        kicker: '06 · MIGRATION GATE',
        title: '上线前扫描存量线程并分类处置',
        paragraphs: [
          '门禁输入包括变更前后节点集合、State schema、interrupt 合同和 Functional 调用序列；运行证据包括 busy、interrupted、error 线程的 next、tasks 与 schema_version。对每个删除节点计算是否仍有线程指向，对每个新必填字段检查旧 values。',
          '处置可以是阻止部署、保留兼容节点、运行状态迁移、等待排空或发布新 graph id。迁移后抽样 get_state/get_state_history，并从旧 checkpoint 在 staging 恢复，比较路线、外部幂等键与最终状态。'
        ],
        takeaway: '迁移评审必须把代码 diff 与活跃 checkpoint 集合相交。'
      }
    ],
    mechanisms: [
      'validate 收集静态 sources/targets，检查未知节点和 START 入口。',
      '条件分支的 Literal、path_map 与 ends 提高可静态验证范围。',
      '编译时 interrupt 节点必须存在，但历史 interrupt 合同不在检查范围。',
      '最新部署图会解释现有线程，运行不会自动钉住旧代码版本。',
      'interrupted thread 的 next/task node name 是持久执行地址。',
      '边通常不存入 checkpoint，节点完成后的路线可采用新拓扑。',
      '新增可选 State 字段通常兼容；重命名会让旧值失联。',
      '不兼容类型收紧与新必填字段需要显式数据迁移。',
      '业务版本可进入 State 路由，或用不同 graph id 隔离代际。',
      '真实 checkpoint 恢复演练是迁移门禁的最终证据。'
    ],
    pitfalls: [
      'compile 成功就宣布历史线程兼容。',
      '直接重命名被 interrupt 或 next 引用的节点。',
      '删除 State key 后假定 checkpointer 会自动清理和迁移。',
      '把字段重命名当等价重构，导致旧值静默丢失。',
      '新增无默认值的必填字段并立即部署到存量线程。',
      '只保留节点名，却改变 interrupt resume schema。',
      '认为边不持久化就代表业务路线可以任意变化。',
      '使用 step 数而非稳定节点/业务版本做迁移判定。',
      '没有查询 busy/interrupted/error 线程就清理兼容代码。',
      '只在新线程测试新版图，不用真实旧 checkpoint 恢复。'
    ],
    variants: [
      {
        title: '兼容演进同一 graph id',
        useWhen: '变更可通过可选字段、兼容节点和版本路由向后兼容。',
        tradeoff: '修复立即覆盖存量线程；代码在排空期同时维护多代合同。'
      },
      {
        title: '新 graph id 分代',
        useWhen: 'Functional 调用序列、业务规则或 State 类型发生难以兼容的大变化。',
        tradeoff: '隔离清晰、回滚简单；需要双重部署、路由、监控与存量排空。'
      },
      {
        title: '停机迁移 checkpoint',
        useWhen: '线程数量可控，必须一次性转换关键字段或执行地址。',
        tradeoff: '最终模型干净；迁移脚本风险高，必须备份、幂等和可回滚。'
      }
    ],
    studyPlan: { readingMinutes: 33, sourceMinutes: 35, practiceMinutes: 62, reviewMinutes: 15 },
    exampleLanguage: 'python',
    example: `from dataclasses import dataclass

@dataclass(frozen=True)
class StoredThread:
    thread_id: str
    next_nodes: tuple[str, ...]
    values: dict[str, object]

def validate_graph(nodes, edges):
    allowed = nodes | {"START", "END"}
    assert any(source == "START" for source, _ in edges)
    for source, target in edges:
        if source not in allowed or target not in allowed:
            raise ValueError(f"unknown: {source} -> {target}")

def migration_issues(nodes, required_keys, threads):
    issues = []
    for thread in threads:
        missing_nodes = set(thread.next_nodes) - nodes
        missing_keys = required_keys - thread.values.keys()
        if missing_nodes:
            issues.append((thread.thread_id, "node", missing_nodes))
        if missing_keys:
            issues.append((thread.thread_id, "state", missing_keys))
    return issues

new_nodes = {"draft_v2", "send"}
validate_graph(
    new_nodes,
    [("START", "draft_v2"), ("draft_v2", "send"), ("send", "END")],
)
parked = [StoredThread("t-1", ("draft",), {"text": "hello"})]
issues = migration_issues(
    new_nodes,
    {"text", "schema_version"},
    parked,
)
assert len(issues) == 2`,
    buildSteps: [
      { title: '积木 1：复现静态 validate', body: '检查 START、未知 source/target 与 interrupt 节点，明确其不读取 checkpoint。' },
      { title: '积木 2：建立存量线程样本', body: '保存 next_nodes、values、interrupt version 和运行状态。' },
      { title: '积木 3：比较节点集合', body: '找出被删除或重命名且仍由活跃线程引用的地址。' },
      { title: '积木 4：比较 State 合同', body: '检测旧线程缺少新必填字段、旧字段重命名和不兼容类型。' },
      { title: '积木 5：加入兼容适配器', body: '保留旧节点名与 old_key 读取，双写新字段并统计剩余调用。' },
      { title: '积木 6：演练旧点恢复', body: '在 staging 加载真实历史 checkpoint，验证路由、resume schema 和副作用幂等。' }
    ],
    selfCheckQuestion: '新版图编译通过，但把 review 改名为 approval、messages_v1 改名为 messages，并改变了 interrupt 的回答结构。哪些存量线程会出问题，怎样无停机迁移？',
    selfCheckAnswer: '结论：已完成线程不依赖旧执行地址，通常可直接使用新拓扑；任何 busy、error 或 interrupted 线程若 snapshot.next/tasks 指向 review，删除该节点就无法恢复。旧 checkpoint 中 messages_v1 不会自动搬到 messages，新节点可能读到空值；旧 interrupt 的布尔 resume 也不能直接交给期待对象的新代码。无停机方案是先保留 review 兼容节点，把旧 resume 解析为新结构并转给 approval；State 同时定义两键，优先读 messages、回退 messages_v1，并在节点更新时双写或做一次幂等迁移；新线程走新路径。上线门禁扫描活跃线程和真实 checkpoint，待 review、v1 字段与旧 interrupt 全部排空后，下一阶段才删除兼容层。'
  },

  '递归限制、停机条件与生产保护': {
    official: {
      title: 'LangGraph Graph API · Recursion limit',
      url: 'https://docs.langchain.com/oss/python/langgraph/graph-api#recursion-limit',
      note: '官方定义 recursion_limit 为单次执行允许的最大 super-step 数，达到上限会抛 GraphRecursionError；1.0.6 起默认值为 1000。RemainingSteps 和 metadata.langgraph_step 可用于接近上限时主动降级。'
    },
    source: {
      repo: 'langchain-ai/langgraph',
      file: 'libs/langgraph/langgraph/pregel/main.py',
      symbol: 'Pregel.stream · out_of_steps handling',
      language: 'python',
      url: 'https://github.com/langchain-ai/langgraph/blob/41341457342327166d72fc11952ab28fb61ec0bf/libs/langgraph/langgraph/pregel/main.py#L2985-L3017',
      code: `# 执行循环结束后先等待同步 checkpoint
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
    raise GraphDrained(loop.control.drain_reason or "shutdown")`,
      walkthrough: [
        '代码在运行循环退出后检查 loop.status。out_of_steps 与正常所有节点 inactive 是不同终态，所以不会静默返回成功。',
        'sync durability 会先等待 checkpoint future，再处理退出。即使抛出 GraphRecursionError，调用者仍应通过 get_state 检查最后耐久边界，而非依赖异常对象携带全部业务状态。',
        '错误消息明确指出达到限制且未命中 stop condition。提高 recursion_limit 只扩大预算，不能修复缺失 END、永真路由或没有进展的循环。',
        'draining 独立于 out_of_steps，代表外部控制要求优雅排空。生产系统还要把 deadline、取消、服务关闭与业务停机分开观测。',
        'RemainingSteps 的真实实现位于 managed/is_last_step.py，以 scratchpad.stop - scratchpad.step 计算；它是运行时托管值，不应由业务节点自行递减或持久化。'
      ]
    },
    overview: [
      '循环是 LangGraph 的核心能力，也是最容易把资源耗尽伪装成“Agent 在思考”的地方。recursion_limit 提供硬护栏：一次 invoke/stream 的 super-step 超过预算而没有停机，就抛 GraphRecursionError。它类似保险丝，只负责在电流失控时切断，不会替电路设计正确工作状态。',
      '可靠循环至少有五层出口：业务成功条件，例如证据充分；业务失败条件，例如确认无权限；进展检测，例如连续三轮没有新增信息；资源预算，例如步数、token、费用；外部控制，例如 deadline、取消与服务排空。只有最后再放 recursion_limit 兜底，才能在异常前整理部分结果。',
      '本课把“递归”还原为 super-step 计数，而非 Python 函数递归；再用 RemainingSteps 做主动降级，设计 checkpoint 后的恢复策略和可观测指标。目标是让循环在任何出口都给出可解释状态，而非只会把限制从 25 改到 1000。'
    ],
    chapters: [
      {
        kicker: '01 · WHAT IS COUNTED',
        title: '限制计数的是 super-step，不是节点调用栈深度',
        paragraphs: [
          'LangGraph 节点 A → B → A 每推进一轮调度就消耗 step；同一 super-step 并行执行十个节点，核心预算仍按该轮而非简单加十。子图、Send 和动态任务会让实际成本与 step 数不成线性关系，因此 step 是控制流护栏，不是精确费用单位。',
          'recursion_limit 放在 invoke/stream 的 config 顶层。把它写进 configurable 会被当成用户配置而不生效。默认 1000 适合避免意外过早中断，却并不代表生产 Agent 应允许 1000 次模型调用；业务应按实际成本设更低预算。'
        ],
        takeaway: 'step 限制约束图推进，token、时间、并发和费用仍需独立预算。'
      },
      {
        kicker: '02 · SEMANTIC STOP',
        title: '先定义业务完成，再定义保护上限',
        paragraphs: [
          '检索循环的成功条件可以是引用覆盖所有子问题且置信度达标；失败条件可以是连续两次查询无新文档或权限拒绝。条件必须由可审计 State 字段计算，不能只听模型输出“done”字符串，也不能把 step == limit-1 当作完成。',
          '路由函数应返回 END、fallback 或 retry，并为每条分支写最小反例。若成功条件永远无法满足，增大 recursion_limit 只会增加延迟和费用；若条件过松，图会提前终止并把不完整答案标成成功。'
        ],
        takeaway: '停机是领域判定，限制是运行时预算，两者不能互相代替。'
      },
      {
        kicker: '03 · PROGRESS',
        title: '检测循环有没有获得新信息',
        paragraphs: [
          '合法循环也可能活锁：模型反复选择同一工具、查询返回相同文档、review 与 revise 来回改同一句话。记录 last_action_signature、evidence_ids、revision_hash 与 no_progress_count，可以把“仍在运行”区分成“确实前进”和“重复消耗”。',
          '当 no_progress_count 达阈值，可切换策略、请求人工介入或返回部分结果。阈值应由离线轨迹与成本数据校准；对高风险动作宁可早停审批，对便宜搜索可给更多探索空间。'
        ],
        code: `signature = (tool_name, normalized_args)
if signature == state["last_action"]:
    no_progress = state["no_progress_count"] + 1
else:
    no_progress = 0

if no_progress >= 2:
    return Command(
        update={"status": "needs_review"},
        goto="fallback",
    )`,
        language: 'python',
        takeaway: '生产循环要观测增量，而非只统计已经走了多少步。'
      },
      {
        kicker: '04 · GRACEFUL DEGRADATION',
        title: '用 RemainingSteps 预留整理和持久化的最后机会',
        paragraphs: [
          'RemainingSteps 是托管值，运行时从 stop 与当前 step 计算并注入 State view。节点在剩余两三步时可停止新搜索，转向 summarize_partial 或 human_handoff。这样图正常到达 END，用户得到带限制说明的部分结果。',
          '不要让每个节点自行维护 remaining_steps 字段：并行分支会竞争递减，checkpoint 恢复也容易重复扣除。托管值用于运行预算，业务 State 可另存 attempts、token_spent 与 reason，作为可持久解释。'
        ],
        takeaway: '主动降级把“超限异常”改造成可设计的产品状态，但仍保留硬上限兜底。'
      },
      {
        kicker: '05 · DEADLINE AND CANCEL',
        title: '步数之外还要处理墙钟时间、取消与服务排空',
        paragraphs: [
          '一个节点可能等待远端模型十分钟而只消耗一个 step，因此 recursion_limit 防不住超时。请求级 deadline 应进入 runtime context，节点调用向下游传递剩余时间；取消信号要终止可取消 I/O，并让不可取消副作用用幂等键收尾。',
          '服务发布或缩容触发 draining 时，应停止接收新工作、完成或安全 checkpoint 当前任务，再由新进程恢复。把 shutdown 当 GraphRecursionError 重试会掩盖容量问题，也可能形成风暴。'
        ],
        takeaway: 'step、deadline、cancel、drain 是四种不同控制信号，指标与恢复策略应分开。'
      },
      {
        kicker: '06 · RECOVERY',
        title: '超限后从 checkpoint 继续必须先修复原因',
        paragraphs: [
          '捕获 GraphRecursionError 后可用相同 thread_id 读取最后 StateSnapshot，展示部分 values、next 和轨迹。若只是预算偏低且仍有明确进展，可在人工或策略批准后用更高限制继续；若路由永真或无进展，直接继续只会再次超限。',
          '恢复决策应写入 State 或外部审计：谁提高预算、依据什么、最多增加多少、是否改变模型和工具权限。高费用或高风险流程要把预算提升视为授权事件，而非自动无限翻倍。'
        ],
        takeaway: '从超限点恢复前先分类根因：预算不足、无进展、代码缺陷或依赖阻塞。'
      },
      {
        kicker: '07 · OPERATIONS',
        title: '用轨迹分布校准限制与告警',
        paragraphs: [
          '监控 p50/p95 step、每 step token/延迟、no-progress 比例、GraphRecursionError 率、fallback 成功率和人工接管率。只看平均步数会隐藏少量昂贵长尾；只看异常率则会忽略大量在上限前一刻勉强完成的退化运行。',
          '上线新 prompt、模型或工具后比较轨迹长度分布和重复 action signature。限制应根据任务类型分层：FAQ、深度研究、代码修复具有不同正常范围。告警附带 thread、checkpoint、最后节点与预算消耗，才能让运维直接定位。'
        ],
        takeaway: '限制值来自轨迹与成本证据，不来自复制示例中的常数。'
      }
    ],
    mechanisms: [
      'recursion_limit 约束一次执行的最大 super-step 数，配置位于 config 顶层。',
      '达到上限且未命中停机条件时，loop.status 变为 out_of_steps。',
      'Pregel.stream/astream 在退出阶段抛 GraphRecursionError，而非返回业务成功。',
      'RemainingSteps 由 stop - step 动态计算，是运行时 managed value。',
      '业务成功、业务失败和无进展应由显式 State 与路由表达。',
      'step 预算不等于 token、费用、并发或墙钟时间预算。',
      'deadline、cancel、drain 需要独立控制路径和可观察状态。',
      '同步 durability 会在退出处理前等待 checkpoint future。',
      '超限后的最后 checkpoint 可用于诊断和受控恢复。',
      '预算提升应有上限、证据和授权，避免自动无限循环。'
    ],
    pitfalls: [
      '把 GraphRecursionError 当作 Python 递归栈溢出。',
      '把 recursion_limit 放进 config.configurable。',
      '达到上限后直接把部分 State 标为成功。',
      '发现循环就只提高上限，不检查路由与进展。',
      '让多个并行节点手工递减业务 remaining_steps。',
      '只设置 step 限制，不给模型/网络调用 deadline。',
      '把模型自述 done 当唯一成功条件。',
      '异常后自动把预算翻倍并无限恢复。',
      '所有任务类型共用一个限制，忽略成本分布。',
      '只监控错误率，不记录 fallback、长尾和重复动作。'
    ],
    variants: [
      {
        title: '外部捕获 GraphRecursionError',
        useWhen: '图简单，超限很少，调用层能够展示统一失败或人工处理。',
        tradeoff: '接入成本低；图异常退出，最后一步无法主动整理用户友好的部分结果。'
      },
      {
        title: 'RemainingSteps 主动降级',
        useWhen: '长循环需要在预算耗尽前总结、交接或返回部分证据。',
        tradeoff: '产品体验更稳；State 和路由增加 fallback 分支，必须测试边界步数。'
      },
      {
        title: '多维预算控制器',
        useWhen: '生产 Agent 同时受 token、费用、deadline、工具次数和风险权限约束。',
        tradeoff: '控制精细且可审计；需要统一计量、原子预算扣减和跨子图传播。'
      }
    ],
    studyPlan: { readingMinutes: 35, sourceMinutes: 35, practiceMinutes: 65, reviewMinutes: 15 },
    exampleLanguage: 'python',
    example: `from dataclasses import dataclass, field

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
assert partial.evidence == ["evidence-1"]`,
    buildSteps: [
      { title: '积木 1：实现硬 step 保险丝', body: '循环超过预算抛异常，并证明并行任务数与 step 数不是同一指标。' },
      { title: '积木 2：加入业务停机', body: '用证据质量、失败原因和 END 路由表达正常完成，禁止依赖上限。' },
      { title: '积木 3：加入进展指纹', body: '比较 action signature 与证据集合，连续无增量时切 fallback。' },
      { title: '积木 4：实现剩余预算', body: '在最后两步停止新 I/O，整理 partial result 并正常到达 END。' },
      { title: '积木 5：叠加 deadline/cancel', body: '给单节点 I/O 传递剩余墙钟时间，区分取消、超时和排空。' },
      { title: '积木 6：演练超限恢复', body: '读取最后 checkpoint，按根因决定继续、修路由或人工接管。' },
      { title: '积木 7：建立轨迹指标', body: '记录 p95 step、token、重复动作、fallback 与错误率，按任务类型校准限制。' }
    ],
    selfCheckQuestion: '一个工具调用 Agent 反复在 model 与 tools 间循环。把 recursion_limit 从 25 提到 1000 是否足够；你会怎样同时设计停机、降级、超时、恢复和监控？',
    selfCheckAnswer: '结论：提高上限只能延后保险丝熔断，无法修复缺失停机或重复工具调用，甚至把一次缺陷放大成昂贵长尾。先定义领域出口，例如任务完成、工具确认不可达、用户拒绝；记录 tool+normalized_args 和结果摘要，连续无新信息就转 fallback。用 RemainingSteps 在硬上限前预留总结/人工交接步骤，另设 token、费用、工具次数和墙钟 deadline，因为一个慢节点只消耗一个 step。GraphRecursionError 后读取同 thread 的最后 checkpoint，只有在仍有可证明进展且获得预算授权时才提高限制继续；永真路由应先修复。监控按任务类型记录 p50/p95 step、每步 token/延迟、重复动作率、fallback、超限和人工接管，并把 thread、checkpoint、最后节点及预算原因附在告警中。'
  }
}
