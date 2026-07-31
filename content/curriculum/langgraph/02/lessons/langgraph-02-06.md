---
id: "langgraph-02-06"
track: "langgraph"
title: "消息 ID"
depth: "deep"
visualIndex: "../visuals/langgraph-02-06.md"
exampleLanguage: "python"
readingMinutes: 30
sourceMinutes: 20
practiceMinutes: 30
reviewMinutes: 10
---

## 官方入口

title: "Graph API · Working with messages in graph state"
url: "https://docs.langchain.com/oss/python/langgraph/graph-api#working-with-messages-in-graph-state"

官方入口说明：普通 reducer 会覆盖整个列表，`add_messages` 则把新 ID 追加、把已有 ID 的消息替换，并把字典等短写法反序列化为消息对象。本文以 LangGraph 1.0.5 为边界；消息内容的供应商格式并不由本课承诺。

## 真实源码

repo: "langchain-ai/langgraph"
file: "libs/langgraph/langgraph/graph/message.py"
symbol: "add_messages"
language: "python"
url: "https://github.com/langchain-ai/langgraph/blob/84023451a2bd5987b1d4df530f4145d503d75ccb/libs/langgraph/langgraph/graph/message.py#L187-L244"

### 逐段讲解

- 实现先把左右输入规整为列表并调用 `convert_to_messages`，因此 reducer 的输入可以是消息对象或支持的消息表示。
- 缺失 ID 时当前实现用 UUID 补齐；这便利于新增消息，却不能替代跨服务、跨回放需要的业务稳定 ID。
- `merged_by_id` 把左侧 ID 映射到下标：右侧同 ID 普通消息原位替换，陌生 ID 追加。
- `RemoveMessage` 只允许删除已存在 ID；未知 ID 抛 `ValueError`，`REMOVE_ALL_MESSAGES` 是另一个明确的清空分支。
- 节选省略 OpenAI 格式转换和消息 chunk 细节；它解释 state 合并，不能证明模型、工具或外部存储的 exactly-once 语义。

### 源码节选

```python
# LangGraph 1.0.5 的核心合并路径，省略格式转换分支。
merged = left.copy()
merged_by_id = {m.id: i for i, m in enumerate(merged)}
ids_to_remove = set()
for m in right:
    if (existing_idx := merged_by_id.get(m.id)) is not None:
        if isinstance(m, RemoveMessage):
            ids_to_remove.add(m.id)
        else:
            ids_to_remove.discard(m.id)
            merged[existing_idx] = m
    else:
        if isinstance(m, RemoveMessage):
            raise ValueError(
                f"Attempting to delete a message with an ID that doesn't exist ('{m.id}')"
            )
        merged_by_id[m.id] = len(merged)
        merged.append(m)
merged = [m for m in merged if m.id not in ids_to_remove]
```

## 导读

客服 agent 先回答“订单在运输中”，人工审核随后把同一条回答修正为“订单已签收”。若 state 只是 `messages + update`，页面会出现两条看似都有效的助手消息；若直接覆盖整个列表，又会吞掉用户问题与工具结果。真正需要保存的是一段对话中的身份关系：这条新 payload 是一条新事实，还是对 ID 为 `a-17` 的既有事实的修订？

消息 ID 像数据库表的主键，而不是展示序号。列表位置可随删除改变，内容也可编辑；ID 让更新、撤回、人工修订和工具配对有稳定指向。本课承接 `MessagesState` 与 reducer，专门建立这条“追加为默认、同 ID 替换为例外”的合同。下一课讨论整个 state 如何在 checkpoint 上形成新快照。

## 分章正文

### 先观察重复回答如何产生

kicker: "01 · OBSERVE"

设初始记录为 `[human:u1, ai:a1=运输中]`。审核节点返回 `[ai:a1=已签收]`。append 会得到两个 `a1` 语义版本，后续模型可能读到过时答案；replace 会只留下审核更新，反而丢失 `u1`。`add_messages` 的输入是旧列表与 partial update，输出是新列表：`u1` 保留，`a1` 原位替换。

原位的含义很重要。它保存叙事顺序，使“用户提问 → 助手答复 → 工具结果”仍可读；它也让 UI 或 trace 用 ID 关联稳定对象。把 ID 仅当作字符串比较，因此生产中要定义谁负责生成、是否可信、是否允许用户伪造。

#### 本章结论

消息历史不是只能增长的日志；它是带稳定身份的有序记录集。

### 把 ID、位置和内容分开建模

kicker: "02 · MODEL"

一条教学消息可写成 `{id, role, content}`。`id` 回答“我是谁”，`role` 回答“谁说的”，`content` 回答“说了什么”；三者不要互相推导。拿 content 当键会把两句相同的“好的”错误合并，拿数组下标当键则会在删除前项后指向另一条消息。

新增 ID 的操作是 append；已有 ID 的普通消息是 replace；已有 ID 的删除标记是 remove；未知 ID 的 remove 是失败。最后一种失败尤其有价值：它暴露调用方的过期 checkpoint、错误 thread 或重试顺序，而不是静默把数据丢掉。

#### 代码

```python
assert merge([], [{"id": "u1", "content": "退款"}])[0]["id"] == "u1"
assert merge([{"id": "a1", "content": "旧"}], [{"id": "a1", "content": "新"}])[0]["content"] == "新"
```

#### 本章结论

ID 是更新定位键，位置只是阅读顺序，内容是可变载荷。

### 沿 add_messages 走一次替换

kicker: "03 · SOURCE"

源码在规整消息后复制 `left`，因此不会直接把左侧列表容器替换为同一对象。它建立 `id → index` 哈希表，读取 right 时以 O(1) 平均成本找到旧位置。命中普通消息就写 `merged[existing_idx] = m`，未命中才把 ID 记为当前长度并 append。最后统一过滤 `ids_to_remove`，避免迭代中不断移动下标。

请注意“复制列表”不等于深拷贝每个消息对象。课程代码不得原地改写读入消息；需要修订时创建带同 ID 的新消息。源码会为缺 ID 的消息赋 UUID，但若一个上游重放同一业务事件时每次都重新生成 ID，去重便失效。因此能跨节点引用的 tool call、人工修改或外部事件应在写入前携带稳定 ID。

#### 本章结论

索引表负责定位，延迟过滤负责安全删除；稳定性仍由写入者的 ID 策略决定。

### 删除、清空与工具消息的失败边界

kicker: "04 · FAILURE"

删除 ID 不存在的消息会抛错。不要捕获后当作成功，因为它可能意味着同一 `thread_id` 上的 history 已被截断。清空全部消息也不能伪装成一串逐项删除，LangGraph 使用 `REMOVE_ALL_MESSAGES` 这一特殊哨兵来表达意图；操作之后继续给出的消息成为新列表。

工具调用还多一层关系：带 tool call 的 AIMessage 必须与相应 ToolMessage 配对。替换 AIMessage 时若改变或移除 tool call，却保留旧 ToolMessage，会让下游模型收到不合法的会话。此类语义校验属于 node 或专门 validator；`add_messages` 只按 ID 合并，不能替你证明工具协议正确。

#### 本章结论

合并成功不等于对话有效；引用完整性与权限需要额外合同。

### 工程选择：日志、快照和隐私

kicker: "05 · ENGINEERING"

不可修改审计日志适合每次修订生成新 ID，并用 `supersedes` 建边；聊天工作区适合同 ID replace，使读者只看当前版本。两种模型都合理，关键是不要混用。若要支持撤销与 time travel，应保留 checkpoint 历史，而不只保存 reducer 输出。

消息可能携带 PII、附件 URL 或工具参数。ID 并非授权凭证，服务端必须按 thread、用户和租户检查更新者；删除 state 也不必然删除外部日志或模型供应商记录。对长会话，应通过 `RemoveMessage` 或摘要 node 控制 token 预算，同时为摘要标注覆盖的消息 ID 范围。

#### 本章结论

选择 replace 还是追加，是产品的审计与阅读模型选择；ID 无法替代权限、保留策略和工具协议。

## 核心机制

- `add_messages` 默认追加陌生 ID 的消息。
- 同 ID 的普通消息在原位置替换旧消息。
- 删除标记只能指向存在的 ID；未知 ID 是可诊断失败。
- ID、列表位置与内容必须独立设计。
- reducer 合并的是 state 值，不校验工具调用、权限或外部副作用。

## 常见误区

- 用消息内容或数组下标充当稳定 ID。
- 让重放路径每次随机生成业务消息 ID。
- 以为 replace 会自动修复 AI tool call 与 ToolMessage 的引用关系。
- 吞掉未知删除错误，把错误 thread 当作空会话。
- 原地修改 state 中的消息对象，再期待 checkpoint 历史保持独立。

## 实现变体

### 变体 A：当前视图的同 ID 替换

useWhen: "人工编辑、流式内容最终定稿或 UI 只需要当前有效对话。"
tradeoff: "阅读紧凑；若未另存 history，旧文本不可审计。"

#### 代码

```python
next_messages = merge(messages, [{"id": "a1", "role": "ai", "content": "已修正"}])
```

### 变体 B：追加修订事件

useWhen: "合规审计、回放或必须保留每次人工判断。"
tradeoff: "历史完整；渲染时需要根据 supersedes 再计算当前视图。"

#### 代码

```python
event = {"id": "a2", "supersedes": "a1", "role": "ai", "content": "已修正"}
```

## 可运行示例

```python
from copy import deepcopy

def merge(left, right):
    merged = deepcopy(left)
    index = {message["id"]: i for i, message in enumerate(merged)}
    remove = set()
    for message in right:
        mid = message["id"]
        if message.get("remove"):
            if mid not in index:
                raise ValueError(f"不能删除未知消息 {mid}")
            remove.add(mid)
        elif mid in index:
            merged[index[mid]] = deepcopy(message)
        else:
            index[mid] = len(merged)
            merged.append(deepcopy(message))
    return [m for m in merged if m["id"] not in remove]

base = [{"id": "u1", "role": "human", "content": "订单到了吗？"},
        {"id": "a1", "role": "ai", "content": "运输中"}]
fixed = merge(base, [{"id": "a1", "role": "ai", "content": "已签收"}])
assert [m["id"] for m in fixed] == ["u1", "a1"]
assert fixed[-1]["content"] == "已签收"
assert base[-1]["content"] == "运输中"  # 输入未被修改
assert [m["id"] for m in merge(fixed, [{"id": "a1", "remove": True}])] == ["u1"]
try:
    merge(base, [{"id": "ghost", "remove": True}])
except ValueError as error:
    assert "未知消息" in str(error)
else:
    raise AssertionError("未知删除必须失败")
print("message identity contract: ok")
```

## 搭积木复现

### 积木 1：定义消息身份

给每条输入分配 `id`、role 与 content；断言同内容的两条用户消息仍可并存。

### 积木 2：建立 ID 索引

从旧列表生成 `id → index`，用断言拒绝重复 ID 的初始快照。

### 积木 3：实现新增与替换

陌生 ID append，已有 ID 原位替换；验证原列表不被改变。

### 积木 4：加入删除失败

删除已有 ID 后过滤；删除 `ghost` 必须抛错并保留诊断。

### 积木 5：模拟回放

对同一稳定 ID 重复提交相同修订，断言列表不增长；再用随机 ID 观察为何会重复。

## 自检

### 问题

人工审核要把 `a1` 改写，随后用户要求删除 `a1`。请说明两次 update 的状态结果、源码如何定位它们、何时应改用追加修订事件，以及怎样测试未知 ID。

### 站内答案

结论：审核返回同 ID `a1` 的普通消息，保留原位置并替换内容；删除返回 `RemoveMessage(id="a1")` 后该条被移除。机制：`merged_by_id` 定位旧下标，普通消息替换，删除 ID 收集到 `ids_to_remove` 并在末尾过滤。源码证据：`message.py` 187–244 是该路径；未知删除在 227–230 行抛 `ValueError`。可运行验证：本课示例断言替换后 ID 顺序不变、输入未变、删除后只剩 `u1`，并断言 ghost 删除失败。工程取舍：当前对话视图用 replace；审计或回放应追加带 `supersedes` 的新事件。适用边界：ID 不校验工具调用完整性、权限或外部删除，需要业务层补齐。

## 更新日志

### 深化消息身份与修订边界

at: "2026-07-31T18:11:31+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "OpenAI Codex · GPT-5.6 Terra"
summary: "以 add_messages 源码重建消息 ID 的追加、替换、删除、回放与工具协议边界，并加入可运行断言。"
