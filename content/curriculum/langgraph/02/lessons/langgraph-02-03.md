---
id: "langgraph-02-03"
track: "langgraph"
title: "Annotated reducer"
depth: "deep"
visualIndex: "../visuals/langgraph-02-03.md"
exampleLanguage: "python"
readingMinutes: 28
sourceMinutes: 18
practiceMinutes: 18
reviewMinutes: 6
---

## 官方入口

title: "Graph API · Reducers"
url: "https://docs.langchain.com/oss/python/langgraph/graph-api#reducers"

官方规定 State 的每个 key 都有独立 reducer；未标注时默认是覆盖，`Annotated[T, reducer]` 则让该字段按 reducer 合并。这个函数应接收旧值和单个 update 并返回新值；它不会替你把非交换、带副作用或不兼容类型的业务规则变得安全。

## 真实源码

repo: "langchain-ai/langgraph"
file: "libs/langgraph/langgraph/channels/binop.py"
symbol: "BinaryOperatorAggregate.update"
language: "python"
url: "https://github.com/langchain-ai/langgraph/blob/b2926a0ff9589c28c7e01fe7cdbb337b86d5a4b4/libs/langgraph/langgraph/channels/binop.py#L65-L141"

### 逐段讲解

- StateGraph 读取 `Annotated` 元数据后为字段选择 BinaryOperatorAggregate channel。
- channel 保存当前 value；第一次 update 初始化，后续值依次调用 operator。
- update 接收的是本轮该 channel 的 values 序列，因而顺序和 reducer 的代数性质都影响结果。
- operator 发生 TypeError 时源码将异常转换为 `InvalidUpdateError`，帮助定位字段类型不匹配。
- 节选省略了 checkpoint copy、MISSING sentinel 与 channel 生命周期，不能据此推断持久化实现细节。

### 源码节选

```python
class BinaryOperatorAggregate(Generic[Value], BaseChannel[Value, Value, Value]):
    def __init__(self, typ, operator):
        self.operator = operator
        self.value = typ()

    def update(self, values: Sequence[Value]) -> bool:
        if not values:
            return False
        if self.value is MISSING:
            self.value = values[0]
            values = values[1:]
        for value in values:
            try:
                self.value = self.operator(self.value, value)
            except TypeError as e:
                raise InvalidUpdateError(
                    f"Invalid update for channel {self.key}: {e}"
                ) from e
        return True
```

## 导读

两个并行审核 node 都想给 `tags` 写值。默认覆盖无法回答“保留左、保留右还是合并”，LangGraph 因而拒绝同一 super-step 的多次默认写入。把字段标成 `Annotated[list[str], operator.add]` 才是向运行时声明“这些增量可组合”。

Reducer 像会计总账的入账规则：字段名只是账户，规则才定义多笔凭据怎样形成余额。把任意 Python 函数挂进去并不自动获得事务隔离，尤其当函数读取时钟、改全局变量、发 HTTP 或依赖到达顺序时。

本课分离 reducer 的类型标注、运行时 channel 与并发代数。第四课讨论一个字段何时覆盖何时追加；第五课会把自定义 reducer 的去重、上界与测试协议单独展开。

## 分章正文

### 并行不是两次顺序赋值

kicker: "01 · OBSERVE"

在 START fan-out 中，fraud node 写 `{"tags": ["risk"]}`，policy node 写 `{"tags": ["refund"]}`。若 `tags` 是普通 list 字段，运行时不能把调度先后偷偷解释成业务优先级，因此报 `INVALID_CONCURRENT_GRAPH_UPDATE`。错误是有价值的：它指出字段所有权尚未定义。

若声明 `Annotated[list[str], operator.add]`，每个 node 只提交自己的 delta，聚合得到两个标签。这个成功案例依赖 list 加法与本任务的业务语义匹配，不能推广为“任何字段都该 append”。

#### 本章结论

并行写冲突是缺少合并合同的信号；reducer 是显式合同，不是绕过错误的开关。

### Annotated 连接类型和运行时

kicker: "02 · MODEL"

Python 的 `Annotated[T, f]` 保留基础类型 T 与元数据 f。LangGraph 读取该元数据，将字段从默认 LastValue 解释成可聚合 channel。node 的返回仍是普通 partial dict，例如 `{"tags": ["risk"]}`；node 不应手动取旧 state 再 append，因为那会把并发读取与归并混在一起。

Reducer 的输入输出必须与字段值相容。`list[str] + list[str]` 合理；把单个 str 返回给 list reducer 会在运行时类型错误。类型检查器能提前发现一部分问题，真实并发输入、空值和升级版本仍要由测试覆盖。

#### 代码

```python
from operator import add
from typing import Annotated
from typing_extensions import TypedDict
class State(TypedDict):
    tags: Annotated[list[str], add]
```

#### 本章结论

Annotated 同时是给人看的字段声明和给 StateGraph 选 channel 的运行时元数据。

### BinaryOperatorAggregate 怎样归并

kicker: "03 · SOURCE"

`BinaryOperatorAggregate.update(values)` 遍历同一字段的一串 update，不是只调用一次二元函数。当前 value 缺失时先以第一个输入初始化，其余输入依次执行 `operator(current, value)`；因此 operator 的闭包性质、单位元和 TypeError 都是真实运行边界。

字符串拼接通常结合但不交换：`"A" + "B"` 与 `"B" + "A"` 不同。LangGraph 会为 task writes 建稳定顺序以支持重放，可是改变拓扑、fan-out 或 task path 后，语义顺序仍可能变化。若业务只需要集合，使用集合并集或排序后的结构更诚实。

#### 本章结论

reducer 接收有序增量流；稳定当前执行不等于任意拓扑变化都保持相同业务结果。

### 空值、异常和多 writer

kicker: "04 · FAILURE"

为空 list 选择 `operator.add` 时，要考虑初始 `[]` 和 node 不写该字段的区别。无 write 不应产生伪更新；写入 `None` 则需要 reducer 明确是否忽略、拒绝或表示清空。把异常吞成旧值会隐藏数据丢失，除非状态机另有显式 error 字段和可观察告警。

没有 reducer 的单 writer 字段仍应保持默认覆盖，这样重复写会暴露架构漂移。多个 writer 有 reducer 并不表示所有 writer 都有权限；授权仍应由路由、input projection 与业务校验约束。

#### 本章结论

reducer 必须定义缺失、空值、异常与 writer 权限，不能只为正常列表相加写一行 lambda。

### 选择代数而非巧合顺序

kicker: "05 · ENGINEERING"

计数可用加法，集合可用 union，日志可追加但要用 event_id 去重，价格通常由单一权威 writer 覆盖。理想并行 reducer 至少要可测试其结合性；若还需要不同调度顺序一致，则要满足交换性。无法满足时，应把竞争写拆成显式仲裁 node，保存候选及证据，而不是隐含“最后到达者赢”。

Reducer 应是纯函数：相同 left/right 返回相同值，不修改输入、不访问网络、不生成随机 ID。这样 checkpoint 重放、时间旅行和测试才不会把一次状态归并变成一次外部动作。大集合还要测 checkpoint 尺寸与读取代价，正确不等于便宜。

#### 本章结论

把 reducer 当作可审计的领域代数；需要仲裁或副作用时另建节点和状态字段。

## 核心机制

### reducer 是领域运算，不是并发消音器

给字段加 `operator.add` 前，先写出 identity、输入形状和允许的顺序语义。列表的 identity 是 `[]`，每次 update 应是列表增量；把单个字符串当作 update 会按字符扩散，或者在别的 operator 下悄悄产生错误结果。dict 的 `update` 也不是天然安全，它在键冲突时隐含“最后一个 writer 赢”的业务裁决。

更重要的是 reducer 的可重放性。恢复、批处理或拓扑微调可能改变 writes 的分组方式；若 `reduce(reduce(s, xs), ys)` 与 `reduce(s, xs + ys)` 不等，重放结果就依赖实现细节。纯、无外部 I/O、可解释的 reducer 才适合放在 State 层。扣库存、收费、发送邮件等必须作为 node 的显式动作，带幂等键与补偿，而非藏进 reducer。

当值需要优先级而不是合并，收集候选 `{source, score, evidence}`，再让一个仲裁 node 返回唯一结果。这增加一次 super-step，却把“为什么选择此值”保留为可测试、可审计的领域规则。

- `Annotated` 为单个 State key 附加 reducer 元数据。
- StateGraph 用元数据选择聚合 channel。
- channel 依次归并本轮 writes，并检查类型错误。
- 默认覆盖字段不能安全接收同轮多 writer。
- 结合性、交换性、纯度与资源成本决定 reducer 是否适合并发。

## 常见误区

- 用 reducer 掩盖没有字段所有者的架构问题。
- 在 node 中先读旧 list 再手动 append。
- 假设字符串拼接在任意并发顺序下结果相同。
- 在 reducer 内发送请求、生成随机 ID 或修改外部对象。

## 实现变体

### append-only list

useWhen: "事件天然按发生顺序消费，并且能接受记录增长。"
tradeoff: "时间线直观；需另加去重、裁剪和顺序语义。"

#### 代码

```python
def append(left: list[str], right: list[str]) -> list[str]: return left + right
```

### 显式仲裁节点

useWhen: "多个候选写入相互排斥，或优先级来自业务证据。"
tradeoff: "决策透明；多一个 super-step 与候选状态。"

#### 代码

```python
def choose(candidates): return max(candidates, key=lambda x: x["confidence"])
```

## 可运行示例

```python
from operator import add
def reduce_many(current, writes, reducer):
    for write in writes:
        current = reducer(current, write)
    return current

tags = reduce_many([], [["risk"], ["refund"]], add)
assert tags == ["risk", "refund"]
assert reduce_many(0, [2, 3], add) == 5
try:
    reduce_many([], ["wrong-shape"], add)
except TypeError:
    pass
else:
    raise AssertionError("list reducer 必须拒绝不相容 update")
print("annotated reducer: ok")
```

## 搭积木复现

### 积木 1：复现默认冲突

让两个 writer 同轮写普通字段，记录为什么业务无法定义胜者。

### 积木 2：声明 Annotated 字段

把 tags 绑定 add，并使每个 node 仅返回自己的增量。

### 积木 3：实现顺序归并

按 values 序列调用二元 reducer，断言初值与每次变换。

### 积木 4：测试形状失败

传单个字符串给 list reducer，断言 TypeError 可见。

### 积木 5：测试代数性质

比较不同分组的结果；若顺序影响业务，改为仲裁 node。

## 自检

### 问题

为什么 `Annotated[list[str], add]` 能处理两个并行 tag update，却不能自动解决两个节点对同一价格字段的竞争写入？

### 站内答案

结论：tags 的领域语义允许合并增量，价格通常需要权威来源或仲裁。机制：Annotated 将 key 连接到聚合 channel，BinaryOperatorAggregate 依次处理同轮 values。源码证据：binop.py 的 `update` 保存 current value 并调用 operator。运行验证：示例合并两组标签、拒绝错误形状。工程取舍：可交换、纯的 reducer 适合并发；竞争决策需显式候选和仲裁。适用边界：稳定任务排序不能把非交换业务规则变成无歧义事实。

## 更新日志

### 新建 Annotated reducer 课

at: "2026-07-31T15:03:02+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "WorkBuddy · Hy3"
summary: "沿聚合 channel 解释 Annotated、同轮写入顺序和 reducer 的代数与副作用边界。"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/15"
