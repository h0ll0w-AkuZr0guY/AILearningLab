---
id: "langchain-02-05"
track: "langchain"
title: "model profile 与能力协商"
depth: "deep"
exampleLanguage: "python"
readingMinutes: 25
sourceMinutes: 10
practiceMinutes: 10
reviewMinutes: 5
visualIndex: "../visuals/langchain-02-05.md"
---

## 官方入口

title: "LangChain Models · Model profiles"
url: "https://docs.langchain.com/oss/python/langchain/models#model-profiles"

官方章节说明 chat model 可以通过 `profile` 暴露上下文长度、输入模态、tool calling 和 structured output 等能力；profile 要求较新的 LangChain 版本，是 beta 功能，字段可能缺失、变化或被 provider package 更新。页面同时展示了显式覆盖 profile 的方式，因此本课把 profile 当“能力证据”，不当成永久完整的类型枚举。

补充入口：[Providers and models · Model capabilities](https://docs.langchain.com/oss/python/concepts/providers-and-models#model-capabilities) 说明不同模型的能力不同；[Models · Configurable models](https://docs.langchain.com/oss/python/langchain/models#configurable-models) 说明模型选择与参数配置可延后到运行时。两者共同约束上层的能力协商边界。

## 真实源码

repo: "langchain-ai/langchain"
file: "libs/core/langchain_core/language_models/chat_models.py"
symbol: "BaseChatModel.profile / _resolve_model_profile / _set_model_profile / _check_profile_keys"
language: "python"
url: "https://github.com/langchain-ai/langchain/blob/c318abed446e7d1a0e872a6967b9b17bc6f4761c/libs/core/langchain_core/language_models/chat_models.py#L366-L431"

### 其他固定证据

- `ModelProfile` 使用 `TypedDict(total=False)`，字段可缺省且允许额外 key：[model_profile.py#L13-L30](https://github.com/langchain-ai/langchain/blob/c318abed446e7d1a0e872a6967b9b17bc6f4761c/libs/core/langchain_core/language_models/model_profile.py#L13-L30)。
- profile 字段覆盖输入、输出、tool calling 和 structured output 能力：[model_profile.py#L49-L149](https://github.com/langchain-ai/langchain/blob/c318abed446e7d1a0e872a6967b9b17bc6f4761c/libs/core/langchain_core/language_models/model_profile.py#L49-L149)。
- 未知 key 会发出版本错配警告：[model_profile.py#L155-L183](https://github.com/langchain-ai/langchain/blob/c318abed446e7d1a0e872a6967b9b17bc6f4761c/libs/core/langchain_core/language_models/model_profile.py#L155-L183)。
- 上游测试验证自动解析、显式覆盖、解析异常被抑制以及 partner-only 字段警告：[test_base.py#L1587-L1664](https://github.com/langchain-ai/langchain/blob/c318abed446e7d1a0e872a6967b9b17bc6f4761c/libs/core/tests/unit_tests/language_models/chat_models/test_base.py#L1587-L1664)。

### 逐段讲解

- `profile` 是排除在序列化字段之外的可选字典，partner package 可以通过 `_resolve_model_profile` 按自身模型标识读取数据。
- 构造时若没有显式 profile，Pydantic after validator 调用解析钩子；读取 profile 的异常被抑制，避免可选能力数据让模型无法创建。
- 第二个 validator 检查未知 key，并给出可能的 core/provider 版本错配警告。
- `total=False` 意味着能力检查必须使用 `.get()` 或显式缺失策略，不能把 key 不存在理解为 true。

### 源码节选

```python
profile: ModelProfile | None = Field(default=None, exclude=True)

def _resolve_model_profile(self) -> ModelProfile | None:
    return None

@model_validator(mode="after")
def _set_model_profile(self) -> Self:
    if self.profile is None:
        with contextlib.suppress(Exception):
            self.profile = self._resolve_model_profile()
    return self

@model_validator(mode="after")
def _check_profile_keys(self) -> Self:
    if self.profile and isinstance(self.profile, dict):
        _warn_unknown_profile_keys(self.profile)
    return self
```

节选省略具体 partner profile 文件和模型能力的真实来源。官方文档说明资料可能来自 models.dev、integration package augmentation 和 profile CLI；因此 profile 可帮助协商，却不能替代运行时 capability probe、provider 错误处理和产品策略。

## 导读

### “支持工具调用”是一项事实还是一个开关

业务在选择模型前可能需要知道：上下文窗口够不够、能不能接图像、能不能原生 structured output、工具调用是否能流式返回。把这些判断散落在 provider 名称上会很脆弱，因为同一 provider 的不同模型能力不同，且 provider package 版本会更新。

`profile` 像一张能力卡：它给出已登记的证据，但某一栏可以空缺、过期或属于 beta。安全的上层策略是“明确要求时缺失即拒绝或走保守回退”，而不是把缺失当作支持。

## 分章正文

### 从可观察现象建立问题

kicker: "01 · OBSERVE"

考虑两个模型：

```python
text_model.profile == {"text_inputs": True, "tool_calling": False}
vision_model.profile == {"text_inputs": True, "image_inputs": True}
```

同一段业务代码若在没有 `image_inputs` 时仍发送图片，最终可能收到 provider 400；若在没有 `tool_calling` 时强行 bind tools，失败会更晚且更难定位。能力协商把这个差异前移到选择策略。

#### 本章结论

profile 的价值是提前约束策略，前提是调用者承认它可能缺失和变化。

### 建立数据模型与不变量

kicker: "02 · MODEL"

```text
Profile = optional map[str, capability]
Capability = bool | int | str | list[str]
Decision = requirement → profile.get(key) → accept / fallback / reject
```

不变量：

1. 没有 profile 不等于模型没有能力，只表示当前层没有可靠画像。
2. 画像中的 `False` 与缺失不同：前者是已知不支持，后者是未知。
3. 任何必须能力都要有明确缺失策略，不能用 truthiness 把三态压成两态。
4. 显式 profile 覆盖和 provider 自动 profile 必须可在日志中区分，以便审计来源。

#### 本章结论

能力协商是三态判断：支持、不支持、未知；上层要为未知单独设计路径。

### 沿真实源码走一遍主路径

kicker: "03 · SOURCE"

BaseChatModel 在构造后先处理 profile：如果调用者已传入 profile，就保留显式值；否则调用 partner override 的 `_resolve_model_profile`。解析异常被抑制，随后 `_check_profile_keys` 检查字段名。这样核心层不需要知道 OpenAI、Anthropic 或其他 partner 的模型标识规则。

`ModelProfile` 的字段分成输入、输出、tool calling 和 structured output 等组，`total=False` 使每个组都可能没有数据。上层 create_agent 或自定义 router 可以读取它们，但决定仍应带版本和 fallback 证据。

#### 本章结论

核心层拥有 profile 生命周期和警告机制，partner 层拥有模型标识与资料加载，业务层拥有能力决策。

### 补齐失败路径与边界

kicker: "04 · FAILURE"

- profile 文件缺失或解析异常不会让模型构造失败；此时能力变成未知，不能悄悄变成支持。
- 显式 profile 会优先于自动解析，适合修复缺失或过期数据，但错误的覆盖也会让策略产生假阳性。
- 未知 key 会警告，可能表示 core 与 provider package 版本不匹配；不能把警告当作字段已被核心理解。
- beta 字段格式变化时，`profile.get()` 仍可能拿到不同类型，调用者要做类型和版本防线。

本课不把 models.dev、provider package 或真实 provider 响应中的能力值重新验证为永久事实；它们是资料链的输入，课程只固定 core 对 profile 的处理机制。

#### 本章结论

profile 失败采取“可用但降级”的设计；是否允许继续使用要由上层的安全策略决定。

### 从教学实现走向工程取舍

kicker: "05 · ENGINEERING"

教学 router 可以把 profile 当作普通 dict，演示 `required = True`、缺失和 false 三态。生产系统应把 profile 来源、更新时间、package 版本、模型 id 和实际调用失败记录在可观测事件中。

硬能力约束适合工具调用、模态输入和上下文长度，软能力约束适合质量/成本路由。对于 beta 字段，先用显式 provider allowlist 或实际探测补强，避免因为画像过期阻断可用模型。

能力协商还需要回答“谁对结果负责”。profile 只能说明某个资料源登记过能力，真正的调用仍可能因为账户权限、请求形状、区域或 provider 临时状态失败。稳定系统应把 profile 当作 preflight gate，再把实际响应当作 runtime evidence；两者不一致时更新画像、降级策略和报警，而不是直接修改业务判断。对于模型切换，至少把 model id、profile 版本、选择理由和 fallback 结果写进 trace metadata，才能复盘一次策略为什么选错。

#### 本章结论

能力画像降低了错误发现成本，却不能代替真实调用、版本锁定和降级策略。

## 核心机制

- profile 是可选、可缺省、可扩展的能力字典，不是完整稳定 schema。
- provider package 通过 `_resolve_model_profile` 注入默认画像，显式 profile 优先。
- 解析异常被抑制，未知 key 通过 warning 暴露版本错配风险。
- 上层必须区分 `True`、`False` 和缺失，并为缺失定义 fallback 或拒绝策略。

## 常见误区

- 把没有 `tool_calling` key 当作明确不支持，或反过来当作支持。
- 看到 profile 是 dict 就直接持久化所有 key，忽略 beta 和 provider-specific 演化。
- 把显式 profile 覆盖当成事实背书，忘记错误覆盖会制造假能力。
- 只根据 provider 名路由能力，不检查具体模型和当前 integration package 版本。

## 实现变体

### 变体 A：保守能力门

useWhen: "工具调用、模态输入或上下文限制出错代价高。"
tradeoff: "缺失能力会触发回退或拒绝；减少假阳性但可能放弃未知的可用模型。"

#### 代码

```python
def require(profile, key):
    value = profile.get(key) if profile else None
    if value is not True:
        raise RuntimeError(f"需要能力 {key}，当前是 {value!r}")
```

### 变体 B：软路由能力分数

useWhen: "成本、质量和上下文需求可以在多个候选之间权衡。"
tradeoff: "可以利用部分画像；必须接受字段缺失和策略漂移。"

#### 代码

```python
def score(profile):
    if not profile:
        return 0
    return int(profile.get("max_input_tokens", 0)) + 100_000 * int(
        profile.get("tool_calling", False)
    )
```

## 可运行示例

```python
import warnings


def choose(profile: dict[str, object] | None, required: str) -> str:
    value = profile.get(required) if profile else None
    if value is True:
        return "use"
    if value is False:
        return "fallback"
    return "unknown"


assert choose({"tool_calling": True}, "tool_calling") == "use"
assert choose({"tool_calling": False}, "tool_calling") == "fallback"
assert choose({}, "tool_calling") == "unknown"
assert choose(None, "tool_calling") == "unknown"


def warn_unknown(profile: dict[str, object], known: set[str]) -> list[str]:
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        extras = sorted(set(profile) - known)
        if extras:
            warnings.warn(f"unknown profile keys: {extras}")
        return [str(item.message) for item in caught]


messages = warn_unknown({"tool_calling": True, "future_flag": True}, {"tool_calling"})
assert messages and "future_flag" in messages[0]
print("model profile negotiation: ok")
```

示例只证明三态决策和未知字段警告；它没有读取 models.dev、provider package 或真实模型能力，也不能把 fake profile 当成 provider 事实。

## 搭积木复现

### 积木 1：建立 optional profile

让模型的 profile 可以是 dict 或 None，先断言 None 不会阻止基础 invoke。

### 积木 2：区分三态能力

分别测试 key 为 True、False 和缺失，禁止用 `if profile.get(key, True)` 把未知当支持。

### 积木 3：加入显式覆盖

让构造参数传入 profile 时优先于默认 resolver，并记录覆盖来源。

### 积木 4：注入 resolver 异常

让 `_resolve_model_profile` 抛异常，断言模型仍可创建，但能力决策返回 unknown。

### 积木 5：检查未知字段

给 profile 加 provider-only key，发出 warning，并把它与真正的能力读取分开。

### 积木 6：对照上游测试

阅读固定 commit 的 BaseChatModel validators、ModelProfile TypedDict 和 profile 测试，核对教学 router 省略的 Pydantic validator 顺序、partner 数据来源和版本提示。

## 自检

### 问题

为什么 profile 缺失时不能直接判定“不支持”？为什么核心层要抑制 `_resolve_model_profile` 的异常，却仍然对未知 key 发出 warning？

### 站内答案

结论：缺失表示当前没有可靠画像，可能是未加载、旧版本或 partner 尚未提供数据；它与明确 False 不同。核心层抑制 resolver 异常是为了让可选资料不阻断模型基础使用，而未知 key warning 用来暴露 core/provider package 版本错配。机制：`_set_model_profile` 只在 profile 为空时调用 `_resolve_model_profile`，在 suppress 中保留 profile=None；随后 `_check_profile_keys` 调 `_warn_unknown_profile_keys` 对声明之外的字段发 warning。源码证据是固定 commit 的 `chat_models.py#L366-L431`、`model_profile.py#L13-L30`、`#L155-L183`，上游测试 `test_base.py#L1597-L1664` 覆盖自动解析、显式覆盖、异常抑制和 unknown key。验证方法：运行示例的 True/False/unknown 三态断言，再注入 resolver 异常和额外 key，检查模型仍能用但 warning 可见。工程取舍：保守门禁适合工具和模态硬约束，软路由适合成本/质量权衡；两者都要记录 profile 来源、版本和实际调用结果。适用边界：profile 是 beta、字段可缺省，未来版本可能调整格式，不能由本课 commit 推断未来 provider 的能力值。

## 更新日志

<!-- PR 前署名门禁通过后追加本批人类 × AI 记录。 -->

### 本批署名确认与能力协商深化

at: "2026-08-08T20:35:41+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "Codex Desktop · gpt-5.6-luna"
summary: "补齐 ModelProfile 的 resolver、显式覆盖、True/False/unknown 三态与未知字段告警，加入固定源码证据、失败断言和 state 视觉。"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/44"
