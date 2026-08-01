---
id: "langgraph-02-02"
track: "langgraph"
title: "MessagesState"
depth: "deep"
visualIndex: "../visuals/langgraph-02-02.md"
exampleLanguage: "python"
readingMinutes: 24
sourceMinutes: 8
practiceMinutes: 9
reviewMinutes: 4
---

## 官方入口

title: "Graph API · MessagesState"
url: "https://docs.langchain.com/oss/python/langgraph/graph-api#messagesstate"

官方的消息状态用 `MessagesState` 预置 `messages` 字段，并把它与 `add_messages` reducer 关联。该 reducer 的重点是以消息 ID 合并更新：新增 ID 被追加，已存在 ID 的消息被替换。它解决的是会话记录的身份语义，不是普通 list 的无条件拼接。

## 真实源码

repo: "langchain-ai/langgraph"
file: "libs/langgraph/langgraph/graph/message.py"
symbol: "add_messages / MessagesState"
language: "python"
url: "https://github.com/langchain-ai/langgraph/blob/b2926a0ff9589c28c7e01fe7cdbb337b86d5a4b4/libs/langgraph/langgraph/graph/message.py#L61-L150"

### 逐段讲解

- `add_messages` 接受左右两个消息集合，并由 wrapper 支持被当作 `Annotated` reducer 使用。
- 它先把输入规范化为消息对象，为缺失 ID 的消息补 ID，再建立左侧 ID 到位置的索引。
- 右侧消息若命中已有 ID，就原位替换；未命中才 append，因此重放同一条 ID 不会制造第二个副本。
- `RemoveMessage` 会在最终过滤阶段移除指定 ID；删不存在的 ID 会成为明确错误而非安静忽略。
- `MessagesState` 本身很小：真正的行为来自 `Annotated[list[AnyMessage], add_messages]`，节选省略了 format 参数和 LangChain 消息转换兼容分支。

### 源码节选

```python
def add_messages(left=None, right=None, *, format=None):
    if left is None:
        return partial(add_messages, format=format)
    if right is None:
        return partial(add_messages, left, format=format)

    left = [message_chunk_to_message(m) for m in convert_to_messages(left)]
    right = [message_chunk_to_message(m) for m in convert_to_messages(right)]
    for i, m in enumerate(left):
        if m.id is None:
            left[i] = m.model_copy(update={"id": str(uuid.uuid4())})
    left_idx_by_id = {m.id: i for i, m in enumerate(left)}
    merged = left.copy()
    for m in right:
        if (existing_idx := left_idx_by_id.get(m.id)) is not None:
            merged[existing_idx] = m
        else:
            merged.append(m)
    return merged

class MessagesState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
```

## 导读

一条客服对话不是“字符串数组”。模型可能先输出一条带工具调用的 AI 消息，工具完成后需要以同一 ID 修订该消息的内容或元数据；人工审核也可能删除一条误发草稿。若一律 `old + new`，修订会变成两条相互矛盾的历史。

`MessagesState` 把消息流看作有顺序的、按 ID 定位的记录集。顺序保留“何时说过”，ID 保留“这是哪一次说话”。它不是事件溯源系统的全替代：如果合规需要保留每次编辑，应该另建不可变 audit event，而非期望消息 reducer 自动保存版本。

本课把消息身份与普通 reducer 分开讲。下一课才抽象 `Annotated` 怎样把任意字段交给 reducer；这里先用真实消息处理说明为什么 list 的值相等远远不够。

## 分章正文

### 重试为何会制造两句回答

kicker: "01 · OBSERVE"

假设模型调用在远端已成功，但进程在 checkpoint 前崩溃。恢复后同一 logical turn 又得到 reply。若两次 reply 都随机产生 ID，history 里会有两条看似独立的答案；若业务为该 turn 分配稳定 message ID，第二次写入会替换第一次已确认或预留的记录。

这不等于“任意重试都无害”。模型输出可能不同，外部工具仍可能已执行。消息 ID 只把 State 中的表示收敛，不能为模型调用和工具调用提供事务。

#### 本章结论

消息 ID 是 State 合并的身份键；它只能解决表示去重，不能解决外部副作用。

### MessagesState 的字段到底承诺什么

kicker: "02 · MODEL"

`MessagesState` 适合以对话作为共享工作记忆的图。node 读取的是一组 `AnyMessage`，应返回新增或更新的消息列表，而不应把整份 history 复制回来。`add_messages` 接受消息对象及其可转换表示，但生产系统应尽早标准化角色、content block、tool call 和 ID。

同一 ID 表示同一逻辑消息，替换会保留原来的列表位置。不同 ID 即使文本相同也都是两次事件，必须 append。缺 ID 时源码会补 UUID，方便临时使用，却不适合作为需要跨重试稳定去重的业务键。

#### 代码

```python
state = {"messages": [{"id": "u-1", "role": "user", "text": "退款"}]}
update = {"messages": [{"id": "a-1", "role": "ai", "text": "正在查询"}]}
# 将 update 交给 add_messages，而非 state["messages"] + update["messages"]
```

#### 本章结论

MessagesState 的值是“带身份的会话记录”；缺失身份时的自动补全不等于业务幂等键。

### 源码如何完成按 ID 合并

kicker: "03 · SOURCE"

`add_messages` 先通过 `convert_to_messages` 和 `message_chunk_to_message` 归一化输入，避免把 chunk 与完整 message 混用。随后它为缺少 ID 的对象复制出带 UUID 的版本，建立左侧索引，并复制 left，避免直接修改传入 list。

右侧遍历时，ID 命中就改 `merged[existing_idx]`，未命中才 `append`。这个顺序解释了一个重要边界：同一批右侧更新若携带相同 ID，后来的值会覆盖前者；因此上游不应让两个并行 writer 争夺同一消息 ID。

#### 本章结论

源码实现的是有序、按 ID 的 upsert；它没有给冲突作者做业务仲裁。

### 删除和替换比追加更危险

kicker: "04 · FAILURE"

把一条工具调用消息替换成最终答案前，要确认消费者不会依赖旧的 tool_calls。把 `RemoveMessage` 用于历史裁剪前，也要考虑模型上下文、审计留存和 checkpoint 回放。删除的语义是“当前消息视图不再有它”，不是抹除所有持久化痕迹。

另一个失败是直接原地 `state["messages"].append(...)`。它绕开 channel write，可能让并行兄弟观察到没有 barrier 的变化，还使检查点难以准确表示本 step 的 write set。始终返回新消息 update。

#### 本章结论

消息修改会影响后续 prompt 与恢复；把 append 当唯一操作会同时丢掉修订和删除语义。

### 会话历史要有长度与隐私预算

kicker: "05 · ENGINEERING"

消息累积会放大 token、checkpoint 和隐私成本。摘要 node 应产生带明确来源的 summary，裁剪 node 应有保留窗口、审计策略和测试，而不是在任意模型 node 中悄悄 `pop(0)`。PII、工具原始响应和密钥不应因“以后可能有用”就进入 messages。

对于真正的事件历史，单独写 append-only 存储；对于模型上下文，MessagesState 保存当前可工作的投影。两层分开后，修订、删除、保留期限和用户导出才有清晰责任。

#### 本章结论

MessagesState 是 Agent 工作记忆，不是没有容量、合规和版本策略的万能聊天数据库。

调试时记录 reducer 输入的 message ID、角色、来源 node 与 thread，而不是只打印最终文本。这样可以分辨模型实际生成两次、同一 ID 正确替换、或上游错误复用了 ID。日志应脱敏或摘要；为了定位问题而复制完整用户对话，会把工作记忆的隐私风险扩散到 trace 系统。

也要区分消息的展示顺序与事实发生顺序。工具并行返回时，前端可按用户可理解的时间线渲染，State 合并应以 message ID 和明确更新版本为准；把网络到达时间混进 reducer，会使同一 checkpoint 在不同机器重放出不同 prompt。出现这种需求时，将 arrival_time 当普通字段保存，不要把它变成隐藏排序规则。

## 核心机制

- `MessagesState` 用 `Annotated` 将 messages 字段绑定到 `add_messages`。
- reducer 先规范化消息，再以 ID 判定 replace 或 append。
- 同 ID 更新保持列表位置，不同 ID 保留为不同会话事件。
- 删除与缺 ID 都有特殊语义，应由业务层显式设计。
- 外部工具和模型调用的幂等性仍需独立协议。

## 常见误区

- 把 `messages + new_messages` 当成等价实现。
- 以为自动 UUID 能跨进程重试实现业务去重。
- 直接修改 state 中的 list。
- 为节约 token 在任意 node 中删除历史而不留审计策略。

## 实现变体

### 使用预置 MessagesState

useWhen: "共享对话就是主要 State，且需要 LangChain 消息兼容与按 ID upsert。"
tradeoff: "启动快、语义成熟；字段策略仍需在业务图中约束。"

#### 代码

```python
from langgraph.graph import MessagesState
# class Support(MessagesState): ticket_id: str
```

### 自定义对话投影 + 审计事件

useWhen: "需要严格版本、保留期限、法律审计或非 LangChain 消息格式。"
tradeoff: "可解释性更强；要自行维护转换、索引与读取成本。"

#### 代码

```python
class Event:  # 生产中应使用受验证的 domain model
    def __init__(self, event_id, message_id, kind):
        self.event_id, self.message_id, self.kind = event_id, message_id, kind
```

## 可运行示例

```python
def add_messages(left, right):
    merged = [dict(m) for m in left]
    index = {m["id"]: i for i, m in enumerate(merged)}
    for message in right:
        if not message.get("id"):
            raise ValueError("教学实现要求稳定 message id")
        if message["id"] in index:
            merged[index[message["id"]]] = dict(message)
        else:
            index[message["id"]] = len(merged)
            merged.append(dict(message))
    return merged

history = [{"id": "u-1", "text": "退款"}, {"id": "a-1", "text": "查询中"}]
merged = add_messages(history, [{"id": "a-1", "text": "已退款"}, {"id": "t-1", "text": "工具已完成"}])
assert [m["id"] for m in merged] == ["u-1", "a-1", "t-1"]
assert merged[1]["text"] == "已退款"
try:
    add_messages(merged, [{"text": "无身份"}])
except ValueError:
    pass
else:
    raise AssertionError("稳定去重场景必须拒绝缺 ID 消息")
print("message identity contract: ok")
```

## 搭积木复现

### 积木 1：定义消息身份

把 message_id 设为逻辑 turn 的稳定标识，而非每次网络调用临时随机数。

### 积木 2：实现 append

未知 ID 进入尾部，并更新索引。

### 积木 3：实现 replace

已知 ID 替换原位置，断言列表长度不增长。

### 积木 4：处理非法消息

拒绝缺 ID、非法角色或无效 content，而不是把坏数据推入 checkpoint。

### 积木 5：分离事件与工作记忆

让审计事件保存编辑原因，MessagesState 只保存当前 prompt 所需投影。

## 自检

### 问题

为什么 `add_messages` 不能被简化为 `operator.add`？发生恢复重试时，稳定 ID 和随机 UUID 分别意味着什么？

### 站内答案

结论：`operator.add` 只能追加，`add_messages` 还要按 ID 替换和处理删除。机制：源码规范化两侧消息、建立左侧 ID 索引，命中则 replace，未命中才 append。源码证据位于 `message.py` 的 `add_messages` 与 `MessagesState`。运行验证：示例对 `a-1` 的更新保持长度为三并替换文本，缺 ID 失败。工程取舍：业务稳定 ID 让 State 表示可收敛；随机 UUID 只适合一次性新消息。适用边界：这并不保证模型或工具副作用只执行一次。

## 更新日志

### 新建消息身份与合并课

at: "2026-07-31T15:03:02+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "WorkBuddy · Hy3"
summary: "基于 add_messages 与 MessagesState 源码解释按 ID 追加、替换、删除和重试边界，并加入可运行 upsert 断言。"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/15"
