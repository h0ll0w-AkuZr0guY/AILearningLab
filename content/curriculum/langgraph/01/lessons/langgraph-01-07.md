---
id: "langgraph-01-07"
track: "langgraph"
title: "可重放执行：checkpoint、pending writes 与恢复边界"
depth: "deep"
visualIndex: "../visuals/langgraph-01-07.md"
exampleLanguage: "python"
readingMinutes: 38
sourceMinutes: 52
practiceMinutes: 85
reviewMinutes: 15
---

## 官方入口

title: "LangGraph Persistence · Pending writes"
url: "https://docs.langchain.com/oss/python/langgraph/persistence#pending-writes"

官方说明同一 super-step 有节点失败时，已成功节点的 task-level writes 会作为 pending writes 耐久保存；恢复该 step 时成功节点无需重跑。完整 StateSnapshot 仍只在 super-step 边界提交。按 1.2.10 的 _loop.put_writes 重新核验。

## 真实源码

repo: "langchain-ai/langgraph"
file: "libs/langgraph/langgraph/pregel/_loop.py"
symbol: "PregelLoop.put_writes"
language: "python"
url: "https://github.com/langchain-ai/langgraph/blob/41341457342327166d72fc11952ab28fb61ec0bf/libs/langgraph/langgraph/pregel/_loop.py#L415-L493"

### 逐段讲解

- 入口以 task_id 归属每组写入。恢复判断的最小单位是具体任务尝试，而非只有节点名；并行 Send 多次调用同一节点仍可独立复用。
- 特殊 channel 的写入会去重，普通 state channel 则保留给 reducer。NULL_TASK_ID 用于非普通节点任务的写入，需要累积而非简单替换。
- 普通 task 再次提交时先删除相同 task_id 的旧记录，避免一次失败尝试和一次成功尝试同时污染恢复视图。
- 内存中的 checkpoint_pending_writes 先更新，随后在 durability 允许时调用 checkpointer.put_writes，把任务级结果锚定到当前 checkpoint。
- 1.2.10 还在持久化 DeltaChannel 前确保缺失的消息 ID 稳定，说明“写入可重放”不仅要保存值，也要稳定其身份。节选删去了 UntrackedValue 清洗、task path、后台 future 与错误标记分支。

### 源码节选

```python
def put_writes(self, task_id: str, writes: WritesT) -> None:
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
        )
```

## 导读

“从 checkpoint 恢复”常被想象成读出一份 state，然后从下一节点继续。并行 super-step 会暴露这个模型的空洞：A 和 B 同时运行，A 完成，B 失败；barrier 尚未通过，所以还没有包含两者合并结果的完整下一快照。若只保存 step 边界，恢复必须重跑 A 与 B。

pending writes 在边界内部再加一层任务级耐久记录。A 的输出按 task_id 绑定到当前 checkpoint，B 的错误也被记录。恢复时运行时重建同一批 task，把已有成功结果注入，真正再执行的只有未成功任务。它减少重复计算，却没有把半轮结果提前暴露为下一轮 state。

这项能力很像仓库收货：整车未验收前不能入库成为新库存，但已经逐箱扫码的合格箱不必退回重扫。扫码记录不是正式库存快照；若其中一箱失败，下一次验收复用合格箱记录，只处理问题箱。

还要区分“结果已经在内存队列中”与“结果已经达到所选耐久级别”。后台 checkpointer 写入可能与下一段计算重叠，sync、async、exit 对进程突然终止时可保留的最近边界并不相同。生产验收不能只在 Python 对象上看到 checkpoint_pending_writes 就宣布安全，而要让持久化后端重新读取同一 thread/checkpoint，核对 task_id、task_path、channel、序列化后的值和错误标记。若后端写入失败，计算成功也只是尚未形成恢复承诺的暂态事实。

恢复测试还要验证 reducer 只在 barrier 成功后把 pending writes 合成一次逻辑更新。若把已复用结果和重试结果提前各合并一次，追加型 reducer 会产生重复消息，计数型 reducer 会翻倍。任务级结果的“已保存”与业务 State 的“已提交”之间存在明确的提交阶段，任何教学实现都应把这条边界线画出来。


## 分章正文

### 完整 checkpoint 与 pending write 保存不同承诺

kicker: "01 · TWO DURABILITY LEVELS"

完整 checkpoint 位于 super-step barrier，包含 channel values、versions_seen、下一任务等一致视图。pending write 位于单个 task 完成时，形如 task_id、channel、value，锚定到本轮起始 checkpoint。它证明该任务曾产出什么，不等于全局 reducer 已提交。

因此 time travel 选择完整 checkpoint 边界，不能把任意 pending write 当可公开分叉点。恢复同一失败轮次时才会用这些中间记录跳过已成功 task。把二者混合，会让下游读到只完成一半的并行更新。

#### 本章结论

任务级耐久用于去重重算，step 级 checkpoint 用于形成一致状态。

### A 成功、B 失败时到底保存了什么

kicker: "02 · FAILURE TIMELINE"

设 step 4 有 fetch_profile 与 score_risk。profile 先完成，其 writes 经 put_writes 保存；risk 抛出异常并留下 ERROR。因为本轮未整体成功，apply_writes 不会把两者作为完整下一状态提交。最新 StateSnapshot 仍描述 step 4 开始时的 values 和待处理 tasks。

恢复后 prepare_next_tasks 以相同 task identity 重建任务，发现 profile 已有成功 writes，于是把它标为可复用；risk 没有成功结果，再次调用。risk 成功后两组 writes 才按确定顺序进入 reducer，barrier 提交 step 5 checkpoint。

#### 代码

```text
step_4_checkpoint
  ├─ task profile → pending write: profile=vip
  ├─ task risk    → ERROR: timeout
  └─ no step_5 checkpoint

resume(step_4)
  ├─ profile → reuse saved write
  ├─ risk    → execute again
  └─ barrier → apply both → checkpoint step_5
```

#### 本章结论

恢复跳过的是已有成功结果的 task，不是按节点名笼统跳过一段图。

### 稳定 task_id 才能把结果交还给正确调用

kicker: "03 · TASK IDENTITY"

同一节点可能经 Send 对十个文档并行执行。节点名都是 summarize，pending write 必须依赖由路径和调用位置派生的 task identity，才能知道 doc-3 已成功、doc-7 需要重试。只用节点名作缓存键会把一个输入的摘要错误复用给另一个输入。

代码迁移也会影响身份。Functional API 按调用位置匹配 task 和 interrupt；在恢复点之前插入、删除、重排调用会错配缓存结果。Graph API 以节点边界恢复，风险更多集中在节点名、状态合同和 Send 路径变化。

#### 本章结论

可重放程序的调用位置与任务身份属于持久化协议，不能当内部细节随意重排。

### pending write 仍封不住外部副作用的崩溃窗口

kicker: "04 · SIDE EFFECT GAP"

节点先调用支付 API 成功，随后在 put_writes 前崩溃。checkpointer 没有成功记录，恢复必然重跑节点；支付系统却可能已经扣款。反过来，先写 State 为 paid 再调用外部 API，崩溃后又可能出现“状态声称成功、真实支付未发生”。

框架无法对任意外部系统做原子提交。解法是稳定 idempotency key，或业务数据库事务内写 outbox，再由投递器以事件 ID 去重。pending writes 降低重复执行概率，幂等协议才约束重复执行后果。

#### 本章结论

durable execution 提供至少一次恢复基础，业务必须补上幂等或事务边界。

### interrupt 会从节点开头重入，调用前代码必须可重放

kicker: "05 · INTERRUPT AND RESUME"

interrupt 保存暂停信息并退出当前节点；Command(resume=...) 后节点从开头重新执行，先前 interrupt 调用按顺序获得恢复值。因此放在 interrupt 之前的数据库 append、随机数和网络请求可能再次发生。

安全结构是把副作用放到 interrupt 之后，或拆成独立幂等节点；若前置计算昂贵或非确定，则封装为能单独持久化结果的 task。多个 interrupt 的顺序也属于协议，部署时重排会让旧 resume value 对上新问题。

#### 本章结论

暂停恢复是重新进入可记录程序，不是冻结 Python 调用栈后原地解冻。

### 异步持久化、同步持久化与 exit 模式选择失败窗口

kicker: "06 · DURABILITY MODES"

耐久策略决定写入与计算如何重叠。同步等待把 checkpoint 失败尽早暴露，延迟较高；异步写可提高吞吐，但进程突停时最近计算可能尚未落盘；exit 只在运行退出时集中保存，适合可整体重算且无需中途恢复的短任务。

策略不能只凭基准吞吐选。要先定义恢复点目标、可接受重算成本、外部副作用风险和 checkpointer 故障处理。支付审批与离线摘要即使使用相同图结构，也应拥有不同 durability 策略。

#### 本章结论

持久化模式实质是在延迟、写放大和故障丢失窗口之间做业务选择。

### 用逐点杀进程证明恢复合同

kicker: "07 · CRASH LAB"

测试至少覆盖：task 执行前、外部调用后、put_writes 前后、barrier 合并前后、checkpoint 提交前后。每个注入点记录 task 调用次数、pending writes、完整快照和外部幂等表，再恢复同一 thread。

验收标准是纯任务允许重算，已有成功 pending write 不重算，失败任务按策略重试，reducer 只提交一次逻辑更新，不可逆副作用以 operation_id 保持一次业务效果。仅做“正常跑通后再次 invoke”无法验证崩溃窗口。

#### 本章结论

恢复能力需要故障注入证据，成功路径单测无法替代。

## 核心机制

- 每个 task 完成时可用 put_writes 保存 task_id、channel、value。
- pending write 绑定当前起始 checkpoint，不是新的完整 StateSnapshot。
- 失败 super-step 恢复时重建相同任务，成功 writes 被复用，失败任务重跑。
- 所有任务完成后才通过 reducer 合并并提交下一 step checkpoint。
- task identity 区分同一节点的多次并行调用，不能退化成节点名缓存。
- interrupt 恢复会从节点开头重入，resume 值按调用顺序匹配。
- durability 模式改变落盘等待与故障窗口，不改变外部系统原子性。
- 外部副作用仍需幂等键、去重表、事务性 outbox 或补偿协议。
- DeltaChannel 等增量持久化还要求消息等元素身份在写入前稳定。
- time travel 从完整 checkpoint 分叉，不能从任意半轮 pending write 分叉。

## 常见误区

- 宣称 pending writes 提供 exactly-once 节点执行。
- 用 node name 代替 task id，fan-out 结果交叉复用。
- 把半轮成功 writes 直接暴露成一致业务 State。
- 在 interrupt 前创建不可去重的外部记录。
- 持久化成功前就向用户确认扣款或发送完成。
- 恢复时换 thread_id，导致运行时看不到已有 pending writes。
- Functional API 在恢复点前重排 task/interrupt 调用。
- 只测试异常重试，不在真实崩溃窗口杀进程。
- 选择异步 durability 却没有定义进程突停的重算预算。
- 以为 InMemorySaver 能提供跨进程生产耐久性。

## 实现变体

### 任务级 pending writes

useWhen: "同一 super-step 有昂贵并行节点，希望失败恢复只重跑未成功任务。"
tradeoff: "显著减少重算；checkpointer 写入更多，任务身份和序列化合同更严格。"

### 只做 step 边界 checkpoint

useWhen: "任务廉价、纯计算、整轮重算可接受，或外部引擎已经管理任务缓存。"
tradeoff: "实现和存储简单；任一并行任务失败会让整轮重算。"

### 事务性 outbox 组合

useWhen: "节点会扣款、发信或写跨服务事实，需要可证明的一次业务效果。"
tradeoff: "恢复语义最可靠；引入业务数据库表、投递 worker、去重与监控。"

## 可运行示例

```python
from dataclasses import dataclass, field
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
assert calls == {"profile": 1, "risk": 2}
```

## 搭积木复现

### 积木 1：建立 step checkpoint

保存本轮输入 state 与待执行 task，不提前合并任何半轮结果。

### 积木 2：加入 task identity

让同名 worker 的不同输入拥有稳定 task_id，并写碰撞测试。

### 积木 3：实现 put_writes

按 task_id 保存 channel/value，同一任务新尝试替换旧结果。

### 积木 4：制造并行半失败

A 成功、B 首次失败，断言没有完整下一 checkpoint 但 A writes 已存在。

### 积木 5：恢复未完成任务

重建 tasks，已有成功结果直接注入，只有 B 调用次数增加。

### 积木 6：通过 barrier

按固定顺序把 A/B writes 交给 reducer，再创建下一完整快照。

### 积木 7：加入幂等副作用

用 thread_id + operation 建立下游 idempotency key，注入调用成功后落盘前崩溃。

### 积木 8：验证 durability 策略

分别模拟 sync、async、exit 的停止点，记录可丢失窗口与重算量。

## 自检

### 问题

同一 super-step 的 A 已调用支付 API 并返回、B 失败；A 的 put_writes 是否成功未知。恢复时哪些部分可能重跑，pending writes 能保证什么，怎样才能防止重复扣款？

### 站内答案

结论：B 必须重跑；A 只有在相同 checkpoint 下存在可匹配的成功 pending write 时才会复用，否则也可能重跑。pending writes 保证运行时能识别已经耐久保存的 task 结果并避免其重复计算，无法覆盖“支付成功但结果尚未持久化”的崩溃窗口，也不提供外部 exactly-once。标准方案是在第一次调用前生成稳定 idempotency key，例如 thread_id + payment_operation，把它交给支付端去重；或在业务数据库事务中写 outbox，由投递器按事件 ID 发送。恢复测试要在 API 返回、put_writes 前后分别杀进程，并同时核对 task 调用次数、pending writes、checkpoint 和支付端去重记录。
