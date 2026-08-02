---
id: "langchain-01-10"
track: "langchain"
title: "错误语义"
depth: "deep"
visualIndex: "../visuals/langchain-01-10.md"
exampleLanguage: "python"
readingMinutes: 25
sourceMinutes: 8
practiceMinutes: 10
reviewMinutes: 2
---

## 官方入口

title: "LangChain Models · Connection resilience"
url: "https://docs.langchain.com/oss/python/langchain/models#connection-resilience"

官方章节区分可重试的网络、限流和服务端错误与不应盲目重试的客户端错误，并把 `max_retries`、timeout 和 checkpoint 放在连接韧性语境中。异常类的官方 reference 还规定 `OutputParserException` 用于区分可修复的解析失败与其他执行错误，页面路径是该 API 的稳定定位。本文以 LangChain commit `725489f135458c37c668919b0d08652ebd04f131` 为边界，讨论错误分类、传播、重试和副作用，不把“一次重试成功”当成 exactly-once 证明。

## 真实源码

repo: "langchain-ai/langchain"
file: "libs/core/langchain_core/exceptions.py"
symbol: "LangChainException / OutputParserException"
language: "python"
url: "https://github.com/langchain-ai/langchain/blob/725489f135458c37c668919b0d08652ebd04f131/libs/core/langchain_core/exceptions.py#L7-L35"

### 逐段讲解

- `LangChainException` 提供框架级异常根类，调用者可以把框架错误与普通 Python 错误分开处理。
- `OutputParserException` 同时继承 `ValueError` 和 `LangChainException`，因此保持 Python 兼容，又能被 Agent 或 parser recovery 精确捕获。
- `observation` 和 `llm_output` 保存供修复策略使用的上下文，`send_to_llm` 明确表示是否把它们反馈给驱动模型。
- Runnable 的 `_call_with_config` 在执行包装器中记录 error 后重新抛出，异常不会被 callback 自动吞掉，也不会替业务完成回滚。
- provider 层的 `max_retries` 只覆盖它声明的瞬态网络边界；解析错误、权限错误和确定性参数错误需要不同策略。

### 源码节选

```python
class LangChainException(Exception):
    """General LangChain exception."""

class OutputParserException(ValueError, LangChainException):
    """Differentiate parsing errors from other execution errors."""

    def __init__(
        self,
        error,
        observation=None,
        llm_output=None,
        send_to_llm=False,
    ):
        super().__init__(error)
        self.observation = observation
        self.llm_output = llm_output
        self.send_to_llm = send_to_llm
```

节选保留异常的继承关系和修复上下文，省略参数校验、序列化和 provider 具体异常映射。它不能告诉应用某个 HTTP 状态一定可安全重试，更不能替代业务幂等设计。

## 导读

同一句“请求失败”可能意味着四种完全不同的动作：网络连接暂时中断，模型已经生成但解析失败，凭证错误需要立刻报警，或第一步已写库而第二步超时。若所有异常都交给一个 `retry()`，系统可能把无效 token 重试到限流、把坏 JSON无限发给模型，或者重复创建订单。

本课把错误看成带来源和副作用边界的控制流。错误分类至少包含：可暂时恢复的 transport、可修复的 parse、不可重试的 configuration/auth、资源耗尽或取消。错误应在最小可重试单元被处理；在单元之前已经发生的副作用必须有幂等键、事务或补偿。`OutputParserException` 提供的是可区分信号，真正的 repair loop 仍由应用决定。

本课收束模块 01 的 Runnable 基础：前几课建立消息、模型、Prompt、invoke、batch、config 与 callback，本课补齐失败合同。后续 Agent 课程可以复用分类，但不能把本课的 parser recovery 推广成通用业务重试。

## 分章正文

### 从“重试后成功”反推问题

kicker: "01 · OBSERVE"

模型调用第一次超时、第二次返回正确 JSON，看起来说明重试有效。但如果第一次请求已经在 provider 完成，只是响应丢失，第二次可能产生重复副作用；如果第一次返回了 malformed JSON，第二次成功也不能证明 parser 能处理所有合法变体。结果正确是一个事实，副作用次数和失败来源是另外两个事实。

#### 本章结论

重试的验收必须包含错误类别、尝试次数、外部副作用和结果一致性。

### 建立错误模型

kicker: "02 · MODEL"

把一次运行表示为 `(attempt, phase, error, side_effect)`。transport error 常发生在发送、等待或响应读取边界；parse error 发生在模型输出已到达之后；auth/config error 在每次重试前都可预测；cancel/timeout 还要确认下游是否停止。每类错误决定“重试哪一层、最多几次、是否反馈模型、是否需要人工处理”。

#### 代码

```python
policy = {
    "transport": "retry_same_input",
    "parse": "repair_or_fail",
    "auth": "fail_fast",
    "cancel": "stop_and_reconcile",
}
assert policy["auth"] == "fail_fast"
assert policy["parse"] != policy["transport"]
```

#### 本章结论

错误类型不是日志标签，而是决定控制流和资源行为的输入。

### 沿异常类与调用包装器走一遍

kicker: "03 · SOURCE"

`OutputParserException` 用继承关系把 parser 错误从普通执行错误中分离，并保存 observation、llm_output、send_to_llm。Runnable 包装器捕获 `BaseException`，调用 error callback 后继续 raise；这保证调用者不会因为观测事件而误以为调用成功。两条源码路径共同定义了“可被分类”和“仍会失败”的边界。

#### 本章结论

异常类提供可分派的语义，执行包装器负责保持传播；分类不能被理解成自动恢复。

### 失败路径与重试窗口

kicker: "04 · FAILURE"

transport 失败发生在请求是否到达服务端未知的窗口，重试可能重复执行；如果 provider 明确返回 429/5xx，退避和最大尝试次数应由客户端或集成层配置。401、404 或 schema 参数错误通常属于确定性失败，不应反复打同一个请求。

parser 失败时输出已到达系统，可以选择把 observation 和 llm_output 交给模型修复，也可以直接失败。repair loop 必须设置次数、验证 schema、限制 token 和记录原始输出；否则“修复”会变成无界的模型递归。

#### 本章结论

重试窗口越靠近副作用边界越危险；parser 修复和 transport 重试是两种不同的闭环。

### 错误、callback 与外部资源

kicker: "05 · RESOURCE"

callback 的 error 事件只记录 Runnable 控制流。一个步骤可能在抛错前已经写入文件或发送消息，后续重试会再次写入。要做到安全重试，第一选择是让写操作带业务幂等键；第二选择是事务；第三选择是记录补偿任务并让下游可审计。没有这些条件时，应该把“可能重复”写进接口合同，而不是承诺 exactly-once。

#### 本章结论

异常传播、观测记录和资源回收要分开验收，callback 不是事务管理器。

### 选择真实实现变体

kicker: "06 · ENGINEERING"

变体一是局部重试：只对无副作用、可证明瞬态的 model call 使用指数退避；优点是减少重复写，缺点是可能留下半成品。变体二是显式 repair loop：捕获 `OutputParserException`，把 observation 与坏输出送回模型；优点是能修正格式，缺点是增加延迟和模型成本。变体三是 fail-fast 加人工复核，适合支付、权限和不确定副作用；优点是边界清楚，缺点是吞吐下降。

#### 本章结论

重试粒度由副作用边界决定，修复机制由错误可诊断性决定，敏感动作优先选择可审计的停止。

### 用失败注入验证策略

kicker: "07 · VERIFY"

测试用 fake provider 逐次注入 timeout、429、malformed JSON 和 401。对每类错误断言尝试次数、异常类型和最终资源计数；对 parser repair 断言坏输出不直接进入业务对象；对取消断言后台任务状态。一个只写“最终返回 200”的测试无法区分第一次请求是否已产生副作用。

#### 本章结论

错误策略需要故障注入矩阵，且每格都要有业务结果和资源证据。

## 核心机制

- `LangChainException` 提供框架级错误根，`OutputParserException` 提供 parser 专用分派信号。
- Runnable 记录 error 后仍将原异常传播给调用者。
- transport、parse、auth、cancel 的重试和修复边界不同。
- 安全重试依赖幂等、事务或补偿；callback 只提供观察证据。

## 常见误区

- 任何异常都重试，导致认证失败和参数错误浪费配额。
- 捕获 parser 错误后把原始文本直接当结构化对象使用。
- 只看最终成功，不记录尝试次数、下游任务和外部写入次数。
- 用 `send_to_llm=True` 代替 schema 验证、次数上限和敏感输出脱敏。

## 实现变体

### 变体 A：局部瞬态重试

useWhen: "调用是纯计算或 provider 明确返回可重试的网络/限流错误时。"
tradeoff: "减少短暂失败；若服务端已执行而响应丢失，仍需要请求幂等键。"

#### 代码

```python
def retry_transport(call, attempts=3):
    last = None
    for _ in range(attempts):
        try:
            return call()
        except TimeoutError as error:
            last = error
    raise last

count = {"n": 0}
def flaky():
    count["n"] += 1
    if count["n"] < 2:
        raise TimeoutError("temporary")
    return "ok"

assert retry_transport(flaky) == "ok"
assert count["n"] == 2
```

### 变体 B：结构化输出修复

useWhen: "模型响应已到达但只发生格式错误，且业务动作尚未执行时。"
tradeoff: "可以把 observation 反馈给模型；增加 token、延迟和不确定性，必须有上限。"

#### 代码

```python
def parse_or_repair(text, repair):
    for attempt in range(2):
        try:
            key, value = text.split(":")
            return {key: int(value)}
        except (ValueError, TypeError):
            if attempt == 1:
                raise
            text = repair(text)

assert parse_or_repair("answer:bad", lambda _: "answer:7") == {"answer": 7}
try:
    parse_or_repair("still-bad", lambda _: "still-bad")
except ValueError:
    pass
else:
    raise AssertionError("repair loop must be bounded")
```

## 可运行示例

```python
class OutputParserException(ValueError):
    def __init__(self, error, observation=None, llm_output=None, send_to_llm=False):
        super().__init__(error)
        self.observation = observation
        self.llm_output = llm_output
        self.send_to_llm = send_to_llm

def parse_answer(text):
    try:
        value = int(text.removeprefix("answer:"))
    except ValueError as error:
        raise OutputParserException(
            "not an integer", "return answer:<integer>", text, True
        ) from error
    return value

def call_with_repair(responses, max_attempts=2):
    for attempt, response in enumerate(responses, start=1):
        try:
            return parse_answer(response), attempt
        except OutputParserException as error:
            if not error.send_to_llm or attempt >= max_attempts:
                raise
    raise AssertionError("unreachable")

value, attempts = call_with_repair(["broken", "answer:7"])
assert value == 7 and attempts == 2

try:
    call_with_repair(["answer:nope", "still-broken"])
except OutputParserException as error:
    assert error.observation == "return answer:<integer>"
else:
    raise AssertionError("bounded repair should fail")

calls = {"writes": 0}
def write_once(key, store):
    if key not in store:
        store[key] = "committed"
        calls["writes"] += 1

store = {}
write_once("request-1", store)
write_once("request-1", store)
assert calls["writes"] == 1
```

示例把解析错误与 transport 重试分开，修复最多两次，失败时保留专用异常；最后用业务键证明重复执行时写入仍是一次。它没有连接真实 provider，延迟和 HTTP 状态映射需要集成层另测。

## 搭积木复现

### 积木 1：分类错误来源

定义 transport、parse、auth、cancel 四类输入，先为每类写出不同动作。

### 积木 2：保持异常传播

包装调用并记录 error，再抛原异常，断言调用者不能从日志推断成成功。

### 积木 3：加入有限 transport 重试

只捕获 TimeoutError/明确的 429 类错误，断言 401 和参数错误立即失败。

### 积木 4：加入 parser repair

使用 observation、坏输出和次数上限，断言修复结果仍经 schema 解析。

### 积木 5：加入幂等写入

让模型调用前后各出现一次写操作，用 request key 断言重试不会增加提交次数。

## 自检

### 问题

为什么 `OutputParserException` 可以进入 repair loop，而 `401` 通常应 fail fast？如果模型调用前已经写库，parser 修复还需要什么额外边界？

### 站内答案

结论是 parser 错误通常表示输出已到达但格式不符合合同，存在有限、可验证的修复路径；401 表示身份或权限确定性失败，重复发送不会改变凭证。机制上，源码让 `OutputParserException` 继承 `ValueError` 与 `LangChainException`，并保存 observation、llm_output、send_to_llm，调用者可以精确捕获；官方连接韧性文档把客户端错误与网络、429、5xx 的可重试边界分开。验证时对坏 JSON 运行最多两次修复并重新解析，对 401 断言只调用一次；若调用前已写库，repair 不能只关心返回值，还要使用幂等键、事务或补偿，并断言写入次数与任务状态。适用边界是只有在副作用尚未发生或已经可证明幂等时，才可把 repair 结果交给后续业务动作。

## 更新日志

### 建立错误分类、parser repair 与幂等重试课程

at: "2026-08-02T20:41:41+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "Codex · gpt-5.6-luna"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/31"
commit: "f54f99b04b070443bb7b097ffe9f0bcac85f753c"
summary: "新增 transport、parser、auth、cancel 的错误语义、有限修复、源码证据、失败示例和 flow 视觉索引。"
