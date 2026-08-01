---
id: "langgraph-02-10"
track: "langgraph"
title: "state 校验"
depth: "deep"
visualIndex: "../visuals/langgraph-02-10.md"
exampleLanguage: "python"
readingMinutes: 28
sourceMinutes: 22
practiceMinutes: 30
reviewMinutes: 10
---

## 官方入口

title: "Graph API · Schema"
url: "https://docs.langchain.com/oss/python/langgraph/graph-api#schema"

官方文档将 state schema 作为 nodes/edges 的输入合同：可用 TypedDict、dataclass 或 Pydantic；Pydantic 能提供递归数据验证，但性能通常低于 TypedDict/dataclass。schema 可与 input/output schema 分开，字段 reducer 决定 update 的合并，而不等同于所有业务校验。

## 真实源码

repo: "langchain-ai/langgraph"
file: "libs/langgraph/langgraph/graph/state.py"
symbol: "StateGraph._add_schema / StateGraph.compile"
language: "python"
url: "https://github.com/langchain-ai/langgraph/blob/84023451a2bd5987b1d4df530f4145d503d75ccb/libs/langgraph/langgraph/graph/state.py#L256-L286"

### 逐段讲解

- `_add_schema` 调用 `_get_channels`，把字段及其 Annotated reducer 解析为运行时 channel。
- 同一个 key 若以不同的非 LastValue channel 重复注册，源码抛 ValueError；这是图定义结构冲突的早失败。
- `compile()` 调用 `validate()` 检查当前 graph 的可达性、边和 interrupt 配置，和 payload 的递归类型校验是不同层次。
- Pydantic schema 可在运行时验证值，但 node 返回的业务含义仍要通过明确逻辑、测试或审批保证。
- 节选删去了 Pydantic/LangChain 的序列化细节，课程不承诺任意 Python annotation 都会成为生产边界防火墙。

### 源码节选

```python
def _add_schema(self, schema: type[Any], /, allow_managed: bool = True) -> None:
    if schema not in self.schemas:
        _warn_invalid_state_schema(schema)
        channels, managed, type_hints = _get_channels(schema)
        if managed and not allow_managed:
            names = ", ".join(managed)
            raise ValueError(f"Invalid managed channels detected: {names}.")
        self.schemas[schema] = {**channels, **managed}
        for key, channel in channels.items():
            if key in self.channels and self.channels[key] != channel:
                if not isinstance(channel, LastValue):
                    raise ValueError(f"Channel '{key}' already exists with a different type")
            else:
                self.channels[key] = channel

# compile() 会调用 self.validate(...)；它验证图定义，
# 不替代订单、权限或跨字段业务校验。
```

## 导读

订单 agent 收到 `{"amount": "100", "currency": "CNY", "approved": true}`。类型注解可能让开发者以为 amount 会自动成为整数，Pydantic 可能进一步把某些输入解析为数值；但“批准金额不能超过授权额度”“退款必须对应已支付订单”仍是业务不变量，既不是 `TypedDict`、也不是 reducer 能独立判断的。校验若混在一个模糊的 `if` 里，失败时无法知道该重试、纠正输入、拒绝请求还是转人工。

本课建立三层边界：图定义校验防止 builder 自相矛盾，数据 schema 校验检查结构与类型，业务不变量校验检查这次状态迁移是否被允许。三层各自有时间点、错误主体与测试方法。它是模块 02 的收束：State/reducer 允许“如何合并”，验证决定“什么允许进入”。

## 分章正文

### 三种错误不能用同一个 catch

kicker: "01 · OBSERVE"

若两个 schema 给 `messages` 注册不同 reducer，属于建图配置错误，应在 startup/compile 失败，不能等用户请求。若请求缺少 `currency` 或 amount 不是可接受数字，属于输入/state payload 错误，应该返回字段路径和可纠正说明。若 currency 合法但 amount 超过信用额度，属于业务拒绝，可能进入人工审批而非 400 或崩溃。

它们的可恢复性不同。配置错误要求开发者修代码；数据错误要求调用方修改值；业务拒绝要求产品决策或新的事实。把三者都吞为 `False` 会让 trace、重试策略和用户提示失去意义。

#### 本章结论

验证的第一步是分层：图、形状、业务事实分别失败、分别观测。

### 选择 TypedDict、dataclass 与 Pydantic

kicker: "02 · MODEL"

TypedDict 轻量，适合内部图中性能敏感、调用方已受控的 state；它主要表达静态合同，运行时不会自动逐字段拦截任意 dict。dataclass 适合需要默认值的明确数据模型。Pydantic 适合边界输入、嵌套模型、约束和可读 validation error，但每次构造/验证有成本，应测量而非猜测。

分离 input、state、output schema 很有用：外部输入可严格，内部 state 可包含调度字段，输出只暴露允许的数据。不要把数据库对象、secret 或 runtime connection 放进 Pydantic state，以免 checkpoint 序列化泄露或失败。无论选哪个，reducer 的输入域都应与 schema 对齐。

#### 代码

```python
def validate_order(value):
    if type(value["amount"]) is not int or value["amount"] <= 0:
        raise ValueError("amount 必须是正整数")
```

#### 本章结论

schema 类型是边界工具，选型取决于验证深度、默认值与热点性能。

### 源码的结构校验边界

kicker: "03 · SOURCE"

`_add_schema` 通过 `_get_channels` 将 field annotation 变成 channel，并检查 managed 值能否出现在 input/output schema。它还拒绝同 key 的不兼容 channel，这是定义期错误。随后 compile 验证 graph；这些早失败让错误离配置最近。

它不读取订单余额、不会知道某用户是否有权限、也不会替你清理旧 checkpoint。即使使用 Pydantic，校验通过只表示数据满足模型声明，并不等于业务操作被授权。将这一边界写在 node 合同中，才不会把框架的结构保护误当领域规则。

#### 本章结论

LangGraph 的 schema/channel 检查保护图定义；业务规则仍需由节点和可信系统执行。

### 失败路径要带字段、版本与处置

kicker: "04 · FAILURE"

对可纠正数据错误，错误应包含字段路径、实际值类别和期望，不泄露敏感原文。对旧 checkpoint schema，先按上一课迁移或明确隔离。对业务拒绝，返回结构化 reason，例如 `limit_exceeded`，并保存请求 ID、state version 与 policy version，方便重试或人工复核。

不要在 reducer 中把非法值静默夹到范围内，例如负金额自动变零。这样 state 看似有效，却丢失攻击、集成 bug 或计费缺陷的证据。若产品确实需要归一化，应由显式 node 写入原始值、归一化规则版本和结果，再让校验确认规则被允许使用。

#### 本章结论

好错误使下一位行动者知道谁改、改什么、能否重试；静默修正会毁掉诊断链。

### 验证成本与安全边界

kicker: "05 · ENGINEERING"

对每个入口都全量递归验证大型消息 history，可能把 token/CPU 花在重复校验；可以在边界严格验证，在可信 node 间使用轻量 state，并在关键 write 前做 targeted invariant checks。缓存验证结果时必须以 payload/version 为键，不能跨租户复用。

安全上，把 schema 当 allow-list：输出 schema 不暴露内部思考、token、密钥或 connection；日志对 validation error 做脱敏；Pydantic coercion 的版本变化也要在依赖升级时回归测试。校验不是安全的全部，授权、速率限制、审计和外部系统的约束仍必须存在。

测试矩阵应同时覆盖合法边界、缺字段、错误类型、未知枚举、并行 update 冲突和已通过 shape 却被业务拒绝的案例。每一类断言错误码与状态是否写入，而不只断言抛了异常。这样升级 Pydantic、调整 reducer 或移动 validator node 后，才能发现原本拒绝的输入是否意外进入了副作用路径。

#### 本章结论

把昂贵验证放在价值最高的边界，同时用显式不变量守住关键状态迁移。

## 核心机制

- builder/channel 冲突在 schema 注册或 compile 时失败。
- TypedDict、dataclass、Pydantic 的运行时保证与成本不同。
- 数据形状校验和业务不变量校验必须分层。
- input/state/output 可使用不同 schema，减少泄露和误用。
- 错误必须携带可行动的字段/版本信息，不能静默归一化。

## 常见误区

- 以为 TypedDict 会在运行时拒绝所有错误 dict。
- 让 Pydantic “通过”成为审批或权限通过。
- 在 reducer 内吞掉非法更新并改成默认值。
- 将秘密、连接或完整原始 payload 放进持久化 state。
- 对每一步全量验证巨大 history，却从不测量延迟。

## 实现变体

### 变体 A：边界 Pydantic + 内部轻 state

useWhen: "外部 JSON 不可信、内部步骤多且性能敏感。"
tradeoff: "错误友好且热点较快；需清晰维护转换边界。"

#### 代码

```python
external = OrderRequest.model_validate(payload)  # 边界
internal_update = {"amount": external.amount}   # 图内
```

### 变体 B：纯 TypedDict + 显式 validator node

useWhen: "依赖轻量、验证规则本身需要路由、审计或人工处理。"
tradeoff: "控制细；需自己维护错误结构和测试矩阵。"

#### 代码

```python
def validate_node(state): return {"validation": check_business_rules(state)}
```

## 可运行示例

```python
def validate_shape(order):
    required = {"amount", "currency", "credit_limit"}
    missing = required - order.keys()
    if missing:
        raise ValueError(f"缺字段: {sorted(missing)}")
    if type(order["amount"]) is not int or order["amount"] <= 0:
        raise ValueError("amount 必须是正整数")
    if order["currency"] not in {"CNY", "USD"}:
        raise ValueError("不支持的 currency")

def validate_business(order):
    if order["amount"] > order["credit_limit"]:
        return {"ok": False, "reason": "limit_exceeded"}
    return {"ok": True}

good = {"amount": 100, "currency": "CNY", "credit_limit": 200}
validate_shape(good)
assert validate_business(good) == {"ok": True}
too_large = {"amount": 300, "currency": "CNY", "credit_limit": 200}
validate_shape(too_large)
assert validate_business(too_large)["reason"] == "limit_exceeded"
try:
    validate_shape({"amount": "100", "currency": "CNY", "credit_limit": 200})
except ValueError as error:
    assert "正整数" in str(error)
else:
    raise AssertionError("形状错误不得进入业务校验")
print("state validation contract: ok")
```

## 搭积木复现

### 积木 1：分离三个 error 类别

为 graph 配置、payload 形状和业务拒绝分别定义错误码与日志字段。

### 积木 2：实现输入 shape 检查

检查 required、type、枚举，断言错误含字段但不含敏感内容。

### 积木 3：实现业务不变量

将信用额度比较做成单独函数，返回可路由的 reason。

### 积木 4：连接 reducer 输入域

确保通过校验的 amount 才能进入累积/覆盖 reducer。

### 积木 5：测量热点成本

分别记录边界递归验证、内部检查与 checkpoint 序列化耗时。

## 自检

### 问题

请区分“同名 channel reducer 冲突”“amount 为字符串”“金额超过额度”三种错误，并说明应在哪里处理。

### 站内答案

结论：channel 冲突是开发期图定义错误；字符串 amount 是输入/state shape 错误；超额度是合法数据上的业务拒绝。机制：`_add_schema` 将 annotation 解析为 channel 并拒绝不兼容组合，schema 选择决定值验证深度，业务 node 决定授权/额度不变量。源码证据：state.py 256–286 是 channel 注册与冲突失败路径。可运行验证：示例先拒绝字符串，再让超额度通过 shape 但返回 `limit_exceeded`。工程取舍：边界 Pydantic 错误好但有成本，轻 state+validator 可控但需维护。适用边界：任何 schema 都不能替代授权、审计和外部账本约束。

## 更新日志

### 深化 state 校验分层

at: "2026-07-31T18:11:31+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "WorkBuddy · Hy3"
summary: "以 StateGraph channel 注册路径区分图结构、数据 schema 与业务不变量，并补充可运行失败断言。"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/16"
