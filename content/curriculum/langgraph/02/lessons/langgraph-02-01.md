---
id: "langgraph-02-01"
track: "langgraph"
title: "TypedDict state"
depth: "deep"
visualIndex: "../visuals/langgraph-02-01.md"
exampleLanguage: "python"
readingMinutes: 24
sourceMinutes: 8
practiceMinutes: 9
reviewMinutes: 4
---

## 官方入口

title: "Graph API · State 与 Schema"
url: "https://docs.langchain.com/oss/python/langgraph/graph-api#state"

官方把 State 定义为节点和边的输入 schema，并允许 `TypedDict`、dataclass 或 Pydantic model。此课固定讨论 `TypedDict`：它描述字段合同，不替 Python dict 做运行时逐值校验；需要默认值或递归校验时应另选 dataclass/Pydantic，并评估性能与迁移成本。

## 真实源码

repo: "langchain-ai/langgraph"
file: "libs/langgraph/langgraph/graph/state.py"
symbol: "StateGraph.__init__ / StateGraph._add_schema / _get_channels"
language: "python"
url: "https://github.com/langchain-ai/langgraph/blob/b2926a0ff9589c28c7e01fe7cdbb337b86d5a4b4/libs/langgraph/langgraph/graph/state.py#L130-L250"

### 逐段讲解

- `StateGraph` 的公开签名说明 node 的形状是 `State -> Partial<State>`，而非“每个 node 返回完整状态”。
- 构造器把 state、input、output schema 分别登记；未显式给 input/output 时才回退到 state schema。
- `_add_schema` 调用 `_get_channels`，把字段注解转成 channel 或 managed value，再放进 `self.schemas`。
- 同名字段第二次登记时，非兼容 channel 会报错；这把跨 schema 的冲突提前到 build 阶段。
- 教学节选省略了 managed channel、deprecated 参数和 Pydantic 兼容分支，因此不能据此判断全部生产校验。

### 源码节选

```python
class StateGraph(Generic[StateT, ContextT, InputT, OutputT]):
    """A graph whose nodes communicate by reading and writing to a shared state.

    The signature of each node is `State -> Partial<State>`.
    Each state key can optionally be annotated with a reducer function.
    """

    def __init__(self, state_schema, context_schema=None, *,
                 input_schema=None, output_schema=None, **kwargs):
        self.schemas = {}
        self.channels = {}
        self.managed = {}
        self.state_schema = state_schema
        self.input_schema = input_schema or state_schema
        self.output_schema = output_schema or state_schema
        self._add_schema(self.state_schema)
        self._add_schema(self.input_schema, allow_managed=False)
        self._add_schema(self.output_schema, allow_managed=False)

    def _add_schema(self, schema, /, allow_managed=True):
        channels, managed, type_hints = _get_channels(schema)
        self.schemas[schema] = {**channels, **managed}
```

## 导读

客户退款图常有三个概念：用户输入、订单事实和最终答复。若把它们塞进一个随手扩展的 `dict`，第一个 node 会把 `order_id` 当字符串，第二个 node 可能写成整数，第三个 node 甚至把私有的数据库 client 一并塞进 checkpoint。错误往往到恢复、并行或迁移时才显现。

`TypedDict` 像一张机场行李托运单：字段名规定“可被交接的东西”，类型说明期待的形状，实际行李仍需在安检或业务层检查。它不是数据库 schema，也不是不可变对象，更不能阻止 node 原地改动传入 dict。

本课只建立字段与生命周期的边界；下一课给 `messages` 安装特殊的按 ID 合并规则。这里不把二者合并，因为“字段存在且可投影”与“多个写入怎样合并”是两套独立推理。

## 分章正文

### 先看一个会晚爆炸的 dict

kicker: "01 · OBSERVE"

设想 `class SupportState(TypedDict): ticket_id: str; answer: str`。分类 node 只返回 `{"ticket_id": "T-7"}`，检索 node 只返回 `{"answer": "已退款"}`。partial update 让两个 node 都不用伪造自己并不拥有的字段；运行时把每个 update 交给相应 channel。

相反，若分类 node 返回整个可变 dict，它可能把旧的 `answer` 一起写回。串行时看起来正常，并行 fan-out 时却把别人的新答复覆盖。这里的故障不是类型注解失灵，而是写集合被扩大了。

#### 本章结论

State 的最小单位是“有所有者的字段 update”，不是一份由所有 node 复制的全局对象。

### TypedDict 写的是交接合同

kicker: "02 · MODEL"

`TypedDict` 让编辑器、静态检查器和读者看到 `ticket_id`、`intent`、`answer` 的预期形状。`NotRequired` 可表达缺省字段，但它不等于 node 可以无条件读取：读取前仍要分支或用 `get`。Python 在运行时通常仍把它当普通 dict，外部 JSON 的类型和权限验证要放在入口处。

把长期业务事实放 State，把一次调用的模型名、租户连接、logger 放 Runtime context，把 thread_id、trace tags 放 config。三者混成一个 `TypedDict` 会扩大持久化、泄密和迁移面。

#### 代码

```python
from typing_extensions import NotRequired, TypedDict

class SupportState(TypedDict):
    ticket_id: str
    intent: NotRequired[str]
    answer: NotRequired[str]

def classify(state: SupportState) -> dict[str, str]:
    return {"intent": "refund"}
```

#### 本章结论

`TypedDict` 使字段边界可读、可检查；输入真实性、默认值和权限仍是应用的责任。

### schema 怎样变成可写 channel

kicker: "03 · SOURCE"

源码中的 `StateGraph.__init__` 并不只保存一个 class 引用。它依次登记内部 state、输入投影与输出投影；`_add_schema` 再通过 `_get_channels` 读取类型提示。没有 reducer 的普通字段会走 LastValue 一类的默认 channel，带 `Annotated` 的字段会走聚合 channel，这正是后续并发规则的入口。

多个 schema 若出现同名字段，源码会比较对应 channel。普通 LastValue 的兼容回退是为 input/output projection 服务，不代表你可任意用不同 reducer 重新解释一个字段。字段重命名、类型改变和 reducer 改变都要视作 checkpoint 兼容事件。

#### 本章结论

schema 不是注释；构建阶段会把它编译成 channel 合同，冲突应在 compile 前暴露。

### input、output 与内部 State 不必相同

kicker: "04 · BOUNDARY"

入口可只接收 `UserInput`，内部 State 增加 `intent`、`retrieved_policy`，出口只暴露 `AnswerOutput`。这像 API gateway 的请求、服务内部 DTO 和响应各有不同字段：少暴露并不等于内部不存在，少读取也不等于没有写权限。

常见失败是把 API request 直接作为完整 State，再在 node 中临时增字段。第一轮也许可跑，恢复旧 checkpoint、子图连接或类型检查时会失去边界。应把 OverallState 明确写出，并用 node 的 input schema 缩小其读面。

#### 本章结论

输入、内部和输出 schema 是三个权限面；相同只是最简单默认值，不是架构要求。

### 迁移与校验各由谁承担

kicker: "05 · ENGINEERING"

新增可选字段通常比改名安全，改名会让旧 checkpoint 中的值失去映射；把 `amount: str` 改为 `Decimal` 也不能只靠注解宣布完成，需要读旧值、转换、拒绝坏数据和回滚策略。官方迁移说明也把不兼容的字段类型变化列为风险。

`TypedDict` 适合热路径和松耦合 node。用户输入、金额、权限等必须验证的边界可在入口用 Pydantic 或显式 validator 转换，再把可信值写入 State。为每个字段记录 owner、是否持久化、是否敏感、默认策略和迁移版本，比分散在 node 里更可审计。

#### 本章结论

选择 `TypedDict` 是性能与显式验证的取舍；它不能替代输入校验、权限设计或状态迁移。

## 核心机制

### 把字段合同变成测试矩阵

字段设计先回答五个问题：谁创建，谁能写，读者是否都应看见，是否需要进入 checkpoint，以及改名后怎样读回旧 thread。`ticket_id` 适合在入口建立后只读；`intent` 可由分类 node 替换；`answer` 应由生成 node 拥有。若多个 node 都“可能顺手写 answer”，类型写得再漂亮也没有一致性策略。

测试应分两层。单元测试给 node 一份最小 snapshot，断言它返回的 keys 正是所属字段、没有改动输入对象；图测试再验证 input projection、output projection 和 checkpoint 恢复。把 `dict.update` 的便利误认为 LangGraph 合并语义，会遗漏同轮多 writer、reducer 和版本迁移三个关键条件。

数据最小化也是 State 设计的一部分。回复正文可以持久化，访问令牌、数据库连接、原始身份证件和未脱敏模型 trace 不应借“后续 node 也许需要”进入共享状态。需要它的 node 应从受控 Runtime 或 store 读取；恢复时记录稳定引用，而非复制敏感原件。

- `StateGraph` 接收 schema 后把字段登记为 channels。
- node 返回 partial update，只有声明字段进入合并路径。
- input/output schema 可以投影内部 State。
- `TypedDict` 主要提供静态合同，运行时值仍需验证。
- reducer、持久化和字段迁移是字段合同的后续层。

## 常见误区

- 以为 `TypedDict` 会在运行时拒绝错误 JSON。
- 每个 node 都返回整份 State，意外覆盖并行 writer。
- 把数据库 client、密钥或 trace 对象存入 checkpoint。
- 仅改字段名就认为旧 thread 可无缝恢复。

## 实现变体

### 显式 TypedDict + 入口校验

useWhen: "热路径、字段稳定，且边界可由单独 validator 控制。"
tradeoff: "轻量且清晰；需要团队主动维护验证与迁移测试。"

#### 代码

```python
def validate_ticket(payload: dict) -> dict[str, str]:
    ticket = payload.get("ticket_id")
    if not isinstance(ticket, str) or not ticket:
        raise ValueError("ticket_id 必须是非空字符串")
    return {"ticket_id": ticket}
```

### dataclass 或 Pydantic 边界模型

useWhen: "需要默认值、递归结构或强制运行时校验。"
tradeoff: "失败更早、错误更集中；构造和序列化成本更高，应测量而非猜测。"

#### 代码

```python
from dataclasses import dataclass
@dataclass
class Input: ticket_id: str
```

## 可运行示例

```python
from typing_extensions import NotRequired, TypedDict

class State(TypedDict):
    ticket_id: str
    intent: NotRequired[str]
    answer: NotRequired[str]

def apply(state: State, update: dict[str, str]) -> State:
    unknown = set(update) - {"ticket_id", "intent", "answer"}
    if unknown:
        raise KeyError(f"未知 State 字段: {unknown}")
    return {**state, **update}

state: State = {"ticket_id": "T-7"}
state = apply(state, {"intent": "refund"})
state = apply(state, {"answer": "已退款"})
assert state == {"ticket_id": "T-7", "intent": "refund", "answer": "已退款"}
try:
    apply(state, {"db_client": "secret"})
except KeyError:
    pass
else:
    raise AssertionError("未知字段必须在教学合同中失败")
print("typed state contract: ok")
```

## 搭积木复现

### 积木 1：列出字段所有者

为 ticket、intent、answer 标记创建者、writer、是否进 checkpoint 和敏感性。

### 积木 2：写出入口投影

让外部输入只含 ticket_id，禁止请求体携带内部 answer。

### 积木 3：返回 partial update

让 classify 只返回 intent，并断言旧 ticket_id 保留。

### 积木 4：拒绝未知字段

给 apply 传 db_client，断言错误文本包含字段名。

### 积木 5：演练字段迁移

模拟旧 `ticket` 键，显式转换成 `ticket_id`，再删除兼容代码前先迁移存量。

## 自检

### 问题

为什么 `TypedDict` 不足以保证 LangGraph State 正确？一个 node 返回完整 state 会如何破坏并行合同？

### 站内答案

结论：`TypedDict` 给出静态字段协议，正确性还依赖入口校验、channel reducer 和迁移。机制：StateGraph 将字段变成 channels，node 应只返回自己拥有的 partial update；完整复制把未拥有字段也变成 write。源码证据：`StateGraph.__init__` 登记三种 schema，`_add_schema` 调 `_get_channels`。运行验证：本课示例保留未写字段并拒绝未知字段。工程取舍：热路径可用 TypedDict 加显式 validator；复杂值可在边界用 Pydantic。适用边界：它不能阻止原地 mutation，也不能自动迁移旧 checkpoint。

## 更新日志

### 新建 TypedDict 状态合同课

at: "2026-07-31T15:03:02+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "OpenAI Codex · GPT-5.6 Terra"
summary: "以当前 LangGraph 源码梳理 schema、channel、投影与迁移边界，并加入离线字段合同断言。"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/15"
