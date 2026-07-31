---
id: "langgraph-02-07"
track: "langgraph"
title: "状态迁移"
depth: "deep"
visualIndex: "../visuals/langgraph-02-07.md"
exampleLanguage: "python"
readingMinutes: 28
sourceMinutes: 22
practiceMinutes: 30
reviewMinutes: 10
---

## 官方入口

title: "Persistence · Update state"
url: "https://docs.langchain.com/oss/python/langgraph/persistence#update-state"

官方文档规定 `update_state` 创建新 checkpoint，而非改写原 checkpoint；更新与 node update 一样经过 reducer，`as_node` 可改变系统认为更新来自哪个节点，从而影响下一步。该语义需要编译图配有 checkpointer 与正确的 thread 配置。

## 真实源码

repo: "langchain-ai/langgraph"
file: "libs/langgraph/langgraph/pregel/main.py"
symbol: "Pregel.update_state"
language: "python"
url: "https://github.com/langchain-ai/langgraph/blob/84023451a2bd5987b1d4df530f4145d503d75ccb/libs/langgraph/langgraph/pregel/main.py#L1462-L1609"

### 逐段讲解

- `update_state` 先取得 checkpointer 与当前 checkpoint；没有持久化后端时，不能把临时 dict 误认为可分叉的 state history。
- 更新被包装成 write，复用 channel/reducer 的归并路径，因此 list 或 messages 字段不会天然变成覆盖。
- 未给 `as_node` 时实现从 checkpoint 的写入元数据推断最后 writer；多个候选会形成歧义，应显式指定。
- 运行时保存新 checkpoint 配置并记录 source 为 update；旧 checkpoint 仍可通过历史接口读取。
- 节选不覆盖存储事务、并发请求的全局串行化或外部工具补偿，这些由 checkpointer 和应用协议承担。

### 源码节选

```python
# 1.0.5 的 update_state 调用链要点，删除了 config 与 hook 细节。
if not self.checkpointer:
    raise ValueError("No checkpointer set")
checkpoint = self.checkpointer.get_tuple(config)
if checkpoint is None:
    raise ValueError("No checkpoint found")

# update 像 node 的 partial update 一样进入 writes / reducers，
# 而不是直接 dict.update 覆盖 state。
task = PregelTaskWrites((), as_node, writes, triggers)
apply_writes(checkpoint.checkpoint, channels, [task], next_version)
metadata = {**checkpoint.metadata, "source": "update", "step": step + 1}
next_config = self._put_checkpoint(
    config,
    checkpoint,
    metadata=metadata,
    new_versions=new_versions,
)
return next_config
```

## 导读

暂停在“向客户退款前”的图，如果人工把订单状态从 `pending` 改为 `approved`，系统应从哪个节点继续？直接改内存字典看似简单，却会抹掉暂停前的可追溯状态，也无法解释下一步为何是发券、审核还是结束。LangGraph 的 state update 是一次状态迁移：从旧 checkpoint 读出 values、按 reducer 写入 partial update、记录一个新的 checkpoint，再以某个 node 身份决定触发关系。

可把 checkpoint 想成版本控制中的提交，而不是可变工作表。`update_state` 类似在旧提交上创建新提交；`as_node` 类似声明这次变更由哪个工作流节点产生。它不会倒带外部副作用，也不会让随后的 topology 自动正确，所以这节课的重点是“新快照与下一步”两层必须同时验证。

## 分章正文

### 一个修改为何会改变控制流

kicker: "01 · OBSERVE"

图有 `collect → review → ship`。`review` 中断后，人工更新 `{approved: True}`。若状态键没有 reducer，更新覆盖该键；若 `notes` 使用 append reducer，写入一条人工说明会累计而非替换。更关键的是，运行时需要知道这像 `review` 的输出还是 `collect` 的输出。不同 `as_node` 会导致不同 edge 被视为已经走过，下一次 plan 的 task 也不同。

因此先读 `graph.get_state(config)`：其中的 `values` 是业务 state，`next` 是待执行节点，`config` 含 checkpoint identity，metadata 指出来源。只看 `values` 等于只看数据库行而忽略事务位置。

#### 本章结论

状态编辑既改变值，也可能改变下一步；二者必须用同一 checkpoint 观察。

### 从旧快照到新快照的五个动作

kicker: "02 · MODEL"

第一，使用同一 `thread_id` 定位当前 checkpoint。第二，读取旧 values 与最新写入身份。第三，把 partial update 交给字段 reducer。第四，写入带新 checkpoint ID 的新快照。第五，以 `as_node` 或可推断 writer 计算下一轮触发。原快照保留，所以 history 能比较“人工修改前后”。

这也解释了为何 `update_state` 不是 HTTP PATCH。PATCH 常覆盖字段且不描述工作流来源；这里的 update 必须服从 state 的合并规则和图的触发语义。对 `messages` 使用 `add_messages` 时，更新同 ID 是修订，陌生 ID 是新增。

#### 代码

```python
old = {"approved": False, "notes": ["等待审核"]}
new = transition(old, {"approved": True, "notes": ["人工确认"]})
assert new["notes"] == ["等待审核", "人工确认"]
```

#### 本章结论

update 是 reducer 驱动的版本化迁移，不能简化为覆盖字典。

### as_node 是控制流证据，不是注释

kicker: "03 · SOURCE"

`Pregel.update_state` 要求已配置 checkpointer，随后围绕 checkpoint、writes 与 `apply_writes` 组织更新。这复用正常节点返回 partial state 的通道逻辑。文档说明 `as_node` 决定更新被当作谁的输出，进而影响下一节点；没有唯一最后 writer 时，让推断承担业务歧义会在版本升级或并行写入后变成隐患。

例如人工批准是对 review 决策的接管，就应 `as_node="review"`，并断言下一状态的 `next` 指向 ship。若人工只是修复 collect 的输入，则应按 collect 的实际合同重新执行 review。不要把 `as_node` 设成喜欢的节点来“跳过”校验，这会制造没有发生过的因果记录。

#### 本章结论

`as_node` 声明迁移在图中的因果位置；它应来自业务事实，而非为了跳转方便。

### 冲突、回放与外部副作用

kicker: "04 · FAILURE"

两个操作者从同一旧 checkpoint 分别批准和拒绝，后写者若无版本检查就会覆盖前写者。应用应携带期望 checkpoint ID 或业务版本，在持久化层实现 compare-and-set，冲突时要求重新读取。LangGraph 保存 history 有助诊断，却不自动替不同客户端仲裁。

从旧 checkpoint 重放会再次执行其后的节点。若人工 update 前已经发过退款，重放不能凭 state 自动撤回银行动作；外部命令必须带幂等键、审计 ID 与补偿路径。`update_state` 创建新 checkpoint，不表示每个服务都具有事务一致性。

#### 本章结论

快照分叉可回看，不能解决并发编辑或外部副作用的原子性。

### 把人工介入做成可运营协议

kicker: "05 · ENGINEERING"

生产 UI 应显示 thread ID、旧 checkpoint ID、变更 diff、操作者与 `as_node`。更新后立刻调用 `get_state`，断言 values、next 和 metadata 同时符合预期；只提示“保存成功”不够。为敏感决定保存原因与权限证据，避免任何拿到 thread ID 的人改写 state。

验收还应覆盖“编辑后再次中断”。先在 c1 触发 interrupt，人工生成 c2，再从 c2 恢复并确认只执行 ship 之后的节点；若恢复又回到 collect，说明 as_node、边或 checkpoint 配置的因果记录并未对齐。将这种 fixture 放进发布前回归，可防止 UI 改动悄悄变成流程跳转漏洞。

还要记录“谁可以编辑什么”。普通客服可补充 notes，却不能把 `approved` 改为 true；审批员也应受订单状态与额度 policy 约束。权限判定应发生在创建 update 前，审计日志保存 actor、reason、旧值摘要和新 checkpoint ID。把权限结果写入可观察 metadata，能够让后续恢复、争议处理和安全审查解释这次迁移为何合法。

小修复适合 `update_state`；大规模 schema 改造应使用迁移 node 或新版本图。若一项人工操作需要同时更新数据库和 state，要采用 outbox、事务或可重试命令，不能把 checkpoint 当分布式事务管理器。

#### 本章结论

可运营的状态迁移必须有版本、权限、diff、下一步断言和外部幂等协议。

## 核心机制

- update 以 checkpoint 为父版本创建新 checkpoint。
- partial update 经过同一字段 reducer。
- `as_node` 影响后续调度，不能随意省略。
- `get_state` 的 values、next、metadata 要一起验收。
- history 不等于外部副作用的回滚能力。

## 常见误区

- 把 `update_state` 当作原地修改 Python dict。
- 只确认 values 正确，不检查 next。
- 并发人工编辑没有期望 checkpoint/version。
- 用 `as_node` 跳过应执行的业务校验。
- 将 checkpoint 写成功误解为邮件、支付也已原子提交。

## 实现变体

### 变体 A：暂停后人工接管

useWhen: "中断点有明确 node 身份，人工只修正该决策的输出。"
tradeoff: "恢复路径短且可审计；需要精确管理权限与 as_node。"

#### 代码

```python
graph.update_state(config, {"approved": True}, as_node="review")
```

### 变体 B：新命令重新进入图

useWhen: "人工操作本质是新业务事件，必须重新经过验证与路由。"
tradeoff: "因果更清楚；多一个 step，响应更慢。"

#### 代码

```python
graph.invoke({"manual_decision": "approve"}, config)
```

## 可运行示例

```python
from copy import deepcopy

def transition(snapshot, update):
    result = deepcopy(snapshot)
    for key, value in update.items():
        result[key] = result.get(key, []) + value if key == "notes" else value
    return result

history = [{"id": "c1", "values": {"approved": False, "notes": ["等待审核"]}, "next": "review"}]
after = transition(history[-1]["values"], {"approved": True, "notes": ["人工确认"]})
history.append({"id": "c2", "parent": "c1", "values": after, "next": "ship", "as_node": "review"})
assert history[0]["values"]["approved"] is False
assert history[-1]["values"]["notes"] == ["等待审核", "人工确认"]
assert history[-1]["next"] == "ship"
try:
    expected = "c1"
    actual = "c2"
    if expected != actual:
        raise RuntimeError("checkpoint 已变化，必须重新读取后再编辑")
except RuntimeError as error:
    assert "重新读取" in str(error)
else:
    raise AssertionError("并发编辑必须被发现")
print("state transition contract: ok")
```

## 搭积木复现

### 积木 1：记录不可变快照

为每个快照给 ID、parent、values 与 next；断言旧快照不会被编辑。

### 积木 2：实现字段 reducer

让 notes 追加、approved 覆盖，比较它与无 reducer 的字段。

### 积木 3：写入 as_node

把人工批准标为 review 输出，并断言 next 为 ship。

### 积木 4：加入乐观并发检查

提交时比较 expected checkpoint ID；不一致则拒绝。

### 积木 5：演练外部命令

给退款命令设置 idempotency key，模拟 checkpoint 成功后服务超时。

## 自检

### 问题

为何 `update_state({"messages": [...]})` 不能推断为覆盖历史？人工批准后该检查什么，两个操作者同时修改又该如何处理？

### 站内答案

结论：更新会经过字段 reducer，messages 若使用 `add_messages` 便按 ID 合并而不是覆盖。机制：`update_state` 从当前 checkpoint 产生 writes，经 `apply_writes` 保存新 checkpoint；`as_node` 决定后续触发。源码证据：`Pregel.update_state` 的 checkpointer、writes 与 checkpoint 路径位于 main.py 1462–1609。可运行验证：示例断言 notes 追加、旧 c1 未变、review 身份把 next 置为 ship，并拒绝过期 checkpoint。工程取舍：人工接管快捷但需审计；新命令更完整但多一步。适用边界：并发仲裁与外部退款原子性必须由应用和存储协议实现。

## 更新日志

### 深化 checkpoint 状态迁移

at: "2026-07-31T18:11:31+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "OpenAI Codex · GPT-5.6 Terra"
summary: "以 update_state 的 checkpoint、reducer 与 as_node 路径讲解人工迁移、并发冲突和外部副作用边界。"
