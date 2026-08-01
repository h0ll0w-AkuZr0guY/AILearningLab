---
id: "langgraph-02-05"
track: "langgraph"
title: "自定义 reducer"
depth: "deep"
visualIndex: "../visuals/langgraph-02-05.md"
exampleLanguage: "python"
readingMinutes: 28
sourceMinutes: 16
practiceMinutes: 20
reviewMinutes: 6
---

## 官方入口

title: "Graph API · Reducers"
url: "https://docs.langchain.com/oss/python/langgraph/graph-api#reducers"

官方将 reducer 定义为 State 每个 key 的更新合并规则：未声明时采用覆盖语义；声明 `Annotated[T, reducer]` 时，node 返回的 update 会交给该字段的函数。并行 fan-out 的同 key 写入需要可解释的合并规则，不能依赖任务先后完成的偶然顺序。

## 真实源码

repo: "langchain-ai/langgraph"
file: "libs/langgraph/langgraph/channels/binop.py"
symbol: "BinaryOperatorAggregate.__init__ / BinaryOperatorAggregate.update"
language: "python"
url: "https://github.com/langchain-ai/langgraph/blob/b2926a0ff9589c28c7e01fe7cdbb337b86d5a4b4/libs/langgraph/langgraph/channels/binop.py#L65-L145"

### 逐段讲解

- `BinaryOperatorAggregate` 保存值类型、二元 operator 与当前 value；它是普通 `Annotated` reducer 的 channel 载体。
- 构造器会为 `collections.abc.Sequence`、`set`、`dict` 等抽象类型选择可实例化的初始容器，不能把这一便利误读成深层默认值系统。
- `update(values)` 对本 super-step 收到的序列依次调用 operator；首个值初始化 channel，其余值与当前值归并。
- operator 抛出的异常会使该次 state update 失败，因此 reducer 必须显式处理合法输入域，不能把类型错误吞掉。
- 节选删去了 checkpoint、类型泛型与 channel 序列化协作；它解释合并，不承诺外部副作用原子性。

### 源码节选

```python
class BinaryOperatorAggregate(Generic[Value], BaseChannel[Value, Value, Value]):
    def __init__(self, typ: type[Value], operator: Callable[[Value, Value], Value]):
        self.typ = typ
        self.operator = operator
        try:
            self.value = typ()
        except Exception:
            pass

    def update(self, values: Sequence[Value]) -> bool:
        if not values:
            return False
        if not hasattr(self, "value"):
            self.value = values[0]
            values = values[1:]
        for value in values:
            self.value = self.operator(self.value, value)
        return True

    def get(self) -> Value:
        try:
            return self.value
        except AttributeError:
            raise EmptyChannelError()
```

## 导读

两个并行风险 node 各自返回一个分数，看似只要写 `max` 就能解决；第三个 node 又想同时附上证据、第四个 node 负责撤销过期证据。此时 reducer 已经不再是一个技术细节，而是“什么算同一份业务事实”的领域规则。

自定义 reducer 很像账本的过账规则。它必须回答初始余额是什么、同一笔凭证能否重复提交、顺序是否影响结果、非法凭证如何报错、回放旧 checkpoint 后是否得到同一余额。没有这些答案，给字段加一个 lambda 只是在把并发歧义藏起来。

本课在 `Annotated reducer` 的通用机制之上，收敛到设计、证明与测试一条真实业务聚合器。下一课的消息 ID 会专门讨论对话记录的身份；这里不抢占它的内容，而处理任意领域值的代数和恢复边界。

## 分章正文

### 先从可反驳的不变量开始

kicker: "01 · CONTRACT"

不要先问“用什么函数拼两个 dict”，先写不变量。对 `evidence_by_id`，每个 ID 只能对应一个最新证据，重复的同一 payload 不应增加条目，过期更新必须拒绝，输出不得改变输入对象。对 `risk_score`，若它是最高风险则 `max` 合适；若它是概率分布，直接 `max` 会丢失证据权重。

不变量让 reducer 可以被单元测试，而不是只能依赖一次整图运行。每次 StateGraph 重试、批量写入、checkpoint 回放，都可能重新调用这一规则；函数若偷读全局时间、随机数或数据库，恢复就失去可推演性。

#### 本章结论

reducer 的第一份设计产物是领域不变量与输入域，不是代码片段。

### 设计 identity、结合律与顺序

kicker: "02 · ALGEBRA"

若一个 reducer 有 identity，空 update 应保持原值；若满足结合律，`merge(merge(a,b),c)` 与 `merge(a,merge(b,c))` 等价，runtime 如何把 writes 分批就不会改变结果。若还满足交换律，任务排序变化也不会改变结果。list append 通常不交换，因而可以保留顺序，却必须承认顺序是合同的一部分。

许多 reducer 不可能完全交换。例如“同一 ID 取版本号更高的证据”可通过显式 version 和稳定 tie-breaker 变得确定；“最后完成者胜出”依赖墙钟时间，重放时不稳定。需要业务仲裁时，应让 reducer 保留候选，再交给一个单 writer node 决定。

#### 代码

```python
def choose_newer(old: dict[str, int], new: dict[str, int]) -> dict[str, int]:
    result = dict(old)
    for key, value in new.items():
        if key not in result or value >= result[key]:
            result[key] = value
    return result
```

#### 本章结论

结合律保护批处理边界；顺序敏感的规则必须把排序依据显式写进数据。

### Annotated 如何抵达 channel

kicker: "03 · SOURCE"

`StateGraph` 解析 `Annotated` 后，将其 reducer 转为聚合 channel。`BinaryOperatorAggregate.update` 接收一个 values 序列：没有值直接返回；没有初始 value 时取首值；再从左到右调用 operator。这里的“左到右”解释为什么非交换的 string/list 合并必须谨慎：源码能给当前任务路径一个稳定次序，却无法把业务无序变成数学确定。

函数的真实签名是二元 `(current, update) -> next`。它不应假设 update 是完整 State，也不应在内部修改 `current`。复制容器再写入，能避免同一 Python 对象被多个 checkpoint 快照或测试引用共享。

#### 本章结论

`Annotated` 是字段元数据，channel 才是实际调用 reducer 与保存累计值的位置。

### 失败输入与并发冲突要显形

kicker: "04 · FAILURE"

假设两个 writer 对同一证据 ID 给出相同版本但不同内容。静默选择后者会让攻击或 bug 隐身；更安全的规则是发现 tie 后抛错，或把两个候选保留给仲裁 node。对 schema 不符、负版本、缺 ID，也应给出能定位字段与 writer 的异常。

不要把“能接受多个 writer”理解为“所有冲突都有合理答案”。`operator.add` 适合独立集合或确知顺序的日志；余额、库存、支付状态更适合单 writer、命令队列或具备幂等键的事务系统。reducer 只能合并已提交的 State value，不能撤销已经发送的邮件或收费。

#### 本章结论

自定义 reducer 应暴露无业务答案的冲突，不能用任意覆盖伪装成功。

### 恢复、演进和性能的成本

kicker: "05 · ENGINEERING"

纯 reducer 才可安全回放：给定旧值和同一更新序列，结果必须一致。保存随机种子或墙钟时间并不能让所有外部读取可重放；应在 node 中先把事实写成 update，再让 reducer 只处理数据。状态变大时，合并 `dict` 的复制和 checkpoint 序列化会成为成本，须测量字段大小、写入频率和读取延迟。

演进 reducer 时保留版本号。旧的 `{"score": 3}` 与新的 `{"score": 3, "source": "tool"}` 可以通过迁移 node 归一化；直接改变函数并重放历史，可能得到不同状态。生产上线前至少跑同一组 fixture 的一次合并、分批合并、重复合并和恢复合并。

#### 本章结论

工程级 reducer 同时需要纯度、迁移方案、体积预算和性质测试。

## 核心机制

- 每个 State key 独立选择覆盖或聚合 channel。
- `Annotated[T, fn]` 把二元 `fn(current, update)` 绑定给该字段。
- BinaryOperatorAggregate 按当前 step 的 write 序列逐项归并。
- identity、结合律、幂等性与交换性决定重试和并发下的可预测程度。
- 领域无法仲裁的冲突应失败或进入显式仲裁路径。

## 常见误区

- 用“最后完成者”作为业务优先级。
- 原地改写 reducer 的 current dict/list。
- 让 reducer 请求数据库、读取当前时间或生成随机 ID。
- 认为任何 list/dict 都能通过 `operator.add` 解决多 writer。
- 修改 reducer 后不回放旧 checkpoint fixture。

## 实现变体

### 可交换集合并集

useWhen: "每个元素独立，重复值可忽略，顺序没有业务含义。"
tradeoff: "并行稳定且幂等；丢失插入顺序和重复事件信息。"

#### 代码

```python
def union(old: set[str], update: set[str]) -> set[str]:
    return old | update
```

### 候选累积 + 单 writer 仲裁

useWhen: "多个来源会冲突，但最终选择需要可信度、权限或人工规则。"
tradeoff: "信息不丢、可审计；多一个 step，State 与 checkpoint 更大。"

#### 代码

```python
def append_candidates(old: list[dict], update: list[dict]) -> list[dict]:
    return [*old, *update]
```

## 可运行示例

```python
from typing import Iterable

def merge_versions(old: dict[str, tuple[int, str]], update: dict[str, tuple[int, str]]):
    result = dict(old)
    for key, candidate in update.items():
        if candidate[0] < 0:
            raise ValueError(f"{key} 的版本不能为负")
        existing = result.get(key)
        if existing is None or candidate[0] > existing[0]:
            result[key] = candidate
        elif candidate[0] == existing[0] and candidate != existing:
            raise ValueError(f"{key} 出现同版本冲突")
    return result

base = {"order-7": (1, "pending")}
once = merge_versions(base, {"order-7": (2, "approved")})
batched = merge_versions(merge_versions(base, {"order-7": (2, "approved")}), {})
assert once == batched == {"order-7": (2, "approved")}
assert merge_versions(once, {"order-7": (2, "approved")}) == once
try:
    merge_versions(once, {"order-7": (2, "rejected")})
except ValueError as error:
    assert "同版本冲突" in str(error)
else:
    raise AssertionError("冲突必须显式失败")
print("custom reducer contract: ok")
```

## 搭积木复现

### 积木 1：写字段不变量

为 evidence 标出 ID、版本、允许覆盖条件和谁可以删除。

### 积木 2：实现空更新

让 merge(old, {}) 等于 old，并断言输入对象未被修改。

### 积木 3：实现高版本覆盖

只接受更大 version，测试一次性和分批合并得到同一结果。

### 积木 4：拒绝平级冲突

同版本不同 payload 抛错，记录 writer 与候选用于诊断。

### 积木 5：检验重试幂等

重复提交完全相同 update，断言状态不增长。

### 积木 6：演练 schema 演进

把旧 tuple 转换为带 source 的记录，再允许新 reducer 处理它。

## 自检

### 问题

请为“多个工具并行写入订单状态”选择 reducer 或仲裁方案，并说明什么性质能保证 checkpoint 回放不因批次变化而改变结果。

### 站内答案

结论：若工具可对同一订单给出冲突状态，先累积带版本、来源和幂等键的候选，再由单 writer 按业务权限仲裁；只有确定“版本更高胜出”时才直接 reducer。机制：reducer 只接收旧值与 update，需拒绝同版本不同内容；结合律使不同批次分组得到同一结果，幂等性使重试安全。源码证据：`BinaryOperatorAggregate.update` 逐项把 values 归并到当前值。运行验证：示例覆盖高版本覆盖、分批等价、重复提交和同版本冲突。工程取舍：候选累积增加 State 与一个 step，换取可审计冲突。适用边界：支付、库存等外部事务仍需幂等命令和数据库约束，不能只靠 reducer。

## 更新日志

### 新建自定义 reducer 设计课

at: "2026-07-31T15:03:02+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "WorkBuddy · Hy3"
summary: "以 BinaryOperatorAggregate 源码讲解 reducer 的代数性质、冲突显形、回放边界与版本化验证。"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/15"
