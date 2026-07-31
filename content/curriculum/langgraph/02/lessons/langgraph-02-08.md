---
id: "langgraph-02-08"
track: "langgraph"
title: "不可变思维"
depth: "deep"
visualIndex: "../visuals/langgraph-02-08.md"
exampleLanguage: "python"
readingMinutes: 28
sourceMinutes: 19
practiceMinutes: 32
reviewMinutes: 11
---

## 官方入口

title: "LangGraph runtime · Reducers"
url: "https://docs.langchain.com/oss/python/langgraph/pregel#reducers"

官方运行时文档指出 reducer 重建 state 时可能被再次调用；对输入 write 的原地 mutation 不会写回持久化 write，随机数、时间或外部副作用也会在回放时重做。稳定身份应在写入 channel 前附加，而非在 reducer 内生成。

## 真实源码

repo: "langchain-ai/langgraph"
file: "libs/langgraph/langgraph/graph/state.py"
symbol: "StateGraph / _add_schema"
language: "python"
url: "https://github.com/langchain-ai/langgraph/blob/84023451a2bd5987b1d4df530f4145d503d75ccb/libs/langgraph/langgraph/graph/state.py#L111-L125"

### 逐段讲解

- `StateGraph` 的 node 合同是 `State -> Partial<State>`，不是接收 dict 后就地改写并返回它。
- 每个 state key 可有 reducer，多个 node update 的聚合由 channel 完成；输入对象的 Python 别名不会自动消失。
- `_add_schema` 把 schema 解析为 channels，并拒绝同名键具有不兼容 channel 类型的组合。
- 当前 runtime 通过 checkpoint writes 重建值，故 reducer 的纯度关系到 replay；这不是普通函数是否“优雅”的问题。
- 节选省略了 task 复制、序列化与 storage 实现，不能承诺任何任意 Python 对象都会深拷贝或跨进程安全。

### 源码节选

```python
class StateGraph(Generic[StateT, ContextT, InputT, OutputT]):
    """A graph whose nodes communicate by reading and writing to a shared state.

    The signature of each node is `State -> Partial<State>`.
    Each state key can optionally be annotated with a reducer function that
    will be used to aggregate the values of that key received from multiple nodes.
    """

def _add_schema(self, schema: type[Any], /, allow_managed: bool = True) -> None:
    channels, managed, type_hints = _get_channels(schema)
    for key, channel in channels.items():
        if key in self.channels and self.channels[key] != channel:
            if not isinstance(channel, LastValue):
                raise ValueError(f"Channel '{key}' already exists with a different type")
        else:
            self.channels[key] = channel
```

## 导读

两个并行 node 都收到 `state["messages"]`。第一个原地 `append`，第二个稍后读取该 list；即使第二个节点从逻辑上应看见 super-step 开始时的快照，它仍可能通过 Python 对象别名看见兄弟写入。这样一次偶然成功的测试会掩盖并发、重试和 checkpoint 回放下的错误。

不可变思维并不要求 Python 的每个对象都用 frozen class。它要求把读入 state 当作只读值，把变化表达成新的 partial update，让 reducer 在明确边界合并。像会计分录一样：节点提交“增加什么”，而非拿走总账本当场涂改。它带来可复现、可比较、可回放的状态路径，代价是复制与序列化成本必须被测量。

## 分章正文

### 别名如何绕过逻辑快照

kicker: "01 · OBSERVE"

`snapshot = {"items": shared_list}` 后，node A 执行 `snapshot["items"].append("A")`。node B 即使拿到 `dict(snapshot)`，其中的 items 还是同一 list；它读到 A 的内容，隔离被破坏。浅复制 dict、`list.copy()`、深复制分别隔离到不同层级，不能靠“我写过 copy”猜测安全。

正确 node 写法是 `return {"items": [new_item]}`，并让 append reducer 构造新的合并结果。对于嵌套 dict，返回要修改的分支副本；对于大张量或文件句柄，不能简单深拷贝，应改为不可变 ID、copy-on-write 数据层或单 writer 设计。

#### 本章结论

super-step 的逻辑隔离不会修复 Python 可变对象别名；节点必须主动避免原地写。

### 把变化写成值而不是动作

kicker: "02 · MODEL"

将 state 看成 `S`，node 产生 partial update `Δ`，reducer 计算 `S' = reduce(S, Δ)`。这个表达迫使我们指出变化归属哪个 key、多个 Δ 如何组合、空更新意味着什么。原地 mutation 只有“执行过 append”这一动作记录，无法在 history 中可靠重演。

纯 reducer 只依赖 old value 与 update。若在其中 `uuid4()`、`datetime.now()` 或请求数据库，重建同一 writes 会得到不同 state；若它给无 ID 消息补 ID，这个 ID 只存在本次重建结果，持久 writes 仍旧无 ID。应由 node 在创建 update 时生成业务 ID 与时间戳，并把它们作为数据提交。

#### 本章结论

把变化数据化，才能比较、重放并测试它；把事实制造藏在 reducer 中，会使同一历史产生不同结果。

### StateGraph 的边界在哪里

kicker: "03 · SOURCE"

源码明确 node 签名为 `State -> Partial<State>`。它把 schema 的字段变成 channels，让每个 key 独立选择 LastValue 或 reducer。`_add_schema` 对同名键的非 LastValue 不兼容类型抛错，说明 schema 是运行合同而非注释。它并没有承诺把你在 node 中拿到的任意对象深复制，因此原地 mutation 仍是调用者的责任。

同一字段的多个 update 在运行时由 channel 汇集；这让“返回增量”是可组合协议。开发者应把真正共享、不可复制且有外部所有权的对象放到 runtime context 或服务层，而不是塞进 durable state。context 的不可变意图也能降低节点把连接、用户对象写进 checkpoint 的风险。

#### 本章结论

源码规定部分更新和 channel 合并，却不把 Python 的可变引用变成自动安全的值。

### 重试会放大一次偷偷的 mutation

kicker: "04 · FAILURE"

若 node 先 append 再抛异常，框架重试时可能再次 append；若 append 的对象同时被外部 cache 引用，失败前的中间状态还会泄漏。正确做法是先在局部变量计算新事件，成功后一次 return；外部写入使用幂等键，使重试不会重复扣费或发信。

测试应保存调用前快照、运行 node、断言输入深度相等，再将同一 update 分批或重复归并。也要用两个 node 共享同一 nested list 的反例验证浅复制不足。不能只看最终内容“有 A、有 B”，还要断言 B 在自己的输入中看不到 A 本轮的写入。

#### 本章结论

失败与重试会把别名 bug 从偶发读错放大为重复、泄漏和不可回放的状态损坏。

### 什么时候不复制整个 state

kicker: "05 · ENGINEERING"

大型 conversation、检索结果或二进制 payload 每步深拷贝会让 GC、checkpoint 序列化和网络存储昂贵。优化路径是缩短 state，只存不可变对象 ID、摘要、版本号和必要 provenance；原始大对象放到有生命周期管理的外部 store。另一条路径是让单个拥有者 node 串行修改某个可变资源，其余 node 用命令或事件通信。

性能优化不能重新引入隐式共享。先用 trace 量化 state 大小、复制时间、序列化时间和 checkpoint 延迟，再选择结构共享或外部引用；并保留版本和访问权限，避免 ID 指向被清理或越权读取的对象。

不可变还让观测更诚实：trace 里每个 update 都能被序列化、比较和回放，而“某个 list 被改过”没有独立输入输出证据。对于必须共享的资源，明确将其定义为 runtime context 的受控能力，并限制只有一个 node 拥有写权限；这样共享从偶然别名变成可审计的架构决定。

调试时可在 node 边界计算稳定摘要，例如事件 ID 列表和结构哈希，而不打印完整含敏感信息的 payload。相邻步骤若摘要相同却出现外部效果，说明副作用没有被 state 的可观察合同捕获；若摘要在 node 未返回 update 时变化，几乎可以直接怀疑原地 mutation 或共享引用。这个轻量观测方法比在生产日志中倾倒整个 state 更安全也更易定位。

#### 本章结论

不可变思维是可观察的所有权协议；优化应减少状态表面，而非让多个节点共享可变对象。

## 核心机制

- node 返回 partial update，channel/reducer 再形成下一状态。
- shallow copy 不会隔离嵌套 list/dict 的别名。
- reducer 应是纯函数，稳定 metadata 在写入前生成。
- retry 与 replay 会重放状态计算，外部副作用需幂等。
- 大对象用 ID、摘要或单 writer 管理，不能把共享可变对象塞进 state。

## 常见误区

- 以为 `dict(state)` 已经隔离全部嵌套对象。
- 在 reducer 内生成 UUID、时间或查询数据库。
- node append 后抛错，再把重试重复写入归咎于框架。
- 用 deep copy 解决所有性能与所有权问题。
- 把数据库连接或用户会话对象写进 checkpoint state。

## 实现变体

### 变体 A：纯事件 reducer

useWhen: "事件小、可序列化，需要重放与审计。"
tradeoff: "可测试且确定；state 会随事件增长，需要摘要策略。"

#### 代码

```python
return {"events": [{"id": event_id, "kind": "approved"}]}
```

### 变体 B：外部对象 ID + 单 writer

useWhen: "数据很大或拥有复杂生命周期。"
tradeoff: "checkpoint 轻；需要 store 的权限、过期与一致性协议。"

#### 代码

```python
return {"document_refs": ["doc:42@v7"]}
```

## 可运行示例

```python
from copy import deepcopy

state = {"events": [{"id": "e0", "kind": "start"}]}
bad_input = dict(state)                 # 浅复制，events 仍共享
bad_input["events"].append({"id": "e1", "kind": "bad"})
assert len(state["events"]) == 2       # 反例：原 state 被污染

clean = {"events": [{"id": "e0", "kind": "start"}]}
node_input = deepcopy(clean)
update = {"events": [{"id": "e1", "kind": "approved"}]}
after = {"events": clean["events"] + update["events"]}
assert clean == {"events": [{"id": "e0", "kind": "start"}]}
assert after["events"][-1]["id"] == "e1"
assert after == {"events": [{"id": "e0", "kind": "start"}, {"id": "e1", "kind": "approved"}]}
print("immutability contract: ok")
```

## 搭积木复现

### 积木 1：制造共享别名

用 shallow copy 改嵌套列表，断言旧 state 被污染，先看见问题。

### 积木 2：冻结 node 输入

保存 deep copy 的输入快照，node 只能构造局部 update。

### 积木 3：写纯 reducer

输入 old 与 events，返回新 list；同输入调用两次结果相同。

### 积木 4：加入重试断言

重复提交同 ID 事件，验证幂等 reducer 或上游去重策略。

### 积木 5：替换大 payload

把正文文本换成 versioned document ID，并说明外部 store 的权限检查。

## 自检

### 问题

为什么 `StateGraph` 的 Partial<State> 合同仍不能自动阻止原地 mutation？请给出一个重试失败路径与一个大 state 的工程替代方案。

### 站内答案

结论：Partial<State> 规定应返回什么，无法改变 Python 嵌套对象的别名语义；node 应把输入视为只读并返回 update。机制：channel/reducer 将 Δ 合并到 S，replay 会重建 state；在 reducer 内制造 ID 或时间不会写回原始 writes。源码证据：state.py 111–125 定义 node 签名和 per-key reducer，`_add_schema` 解析兼容 channel。可运行验证：示例先证明 shallow copy 污染，再断言纯 update 不改变 clean。工程取舍：小事件可累积；大 payload 改存 versioned ID 并由单 writer/store 管理。适用边界：外部对象仍需权限、生命周期和幂等操作协议。

## 更新日志

### 深化 state 不可变与回放边界

at: "2026-07-31T18:11:31+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "OpenAI Codex · GPT-5.6 Terra"
summary: "以 StateGraph 部分更新合同讲解别名、纯 reducer、重试污染和大状态的所有权取舍。"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/16"
