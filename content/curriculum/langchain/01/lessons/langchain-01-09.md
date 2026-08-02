---
id: "langchain-01-09"
track: "langchain"
title: "序列化边界"
depth: "deep"
visualIndex: "../visuals/langchain-01-09.md"
exampleLanguage: "python"
readingMinutes: 25
sourceMinutes: 8
practiceMinutes: 10
reviewMinutes: 2
---

## 官方入口

title: "LangChain Core Reference · load"
url: "https://reference.langchain.com/python/langchain-core/load"

这是 LangChain 官方 API reference 的模块级入口，页面本身没有稳定的子章节锚点，因此用路径级定位，并以其中 `dumpd`、`dumps`、`load` 的函数条目作为本课定位。官方 reference 明确说明：`load` 只允许 allowlist 中的类被实例化，可信边界之外的 payload 不能直接当普通 JSON 处理；序列化结果可能包含影响运行行为的构造参数。本文以 commit `725489f135458c37c668919b0d08652ebd04f131` 为源码边界。

## 真实源码

repo: "langchain-ai/langchain"
file: "libs/core/langchain_core/load/dump.py"
symbol: "dumps / dumpd / Serializable.to_json"
language: "python"
url: "https://github.com/langchain-ai/langchain/blob/725489f135458c37c668919b0d08652ebd04f131/libs/core/langchain_core/load/dump.py#L70-L120"

### 逐段讲解

- `dumpd` 把 `Serializable` 交给 `to_json`，普通值则走 not-implemented 表示；它不是把任意对象 pickle 化。
- `Serializable.is_lc_serializable` 默认返回 false，子类必须显式选择加入 LangChain 的序列化合同，避免继承基类就把资源对象暴露出去。
- `lc_id` 用 namespace 和类名生成稳定路径，路径是可迁移映射的身份，不是 Python 内存地址。
- `dumps` 会转义普通用户字典中看似 LC 标记的 `lc` 键，防止用户数据在反序列化时被误认成框架对象。
- `load` 对转义字典先还原为普通数据，对未转义对象递归加载后交给 reviver；reviver 再执行 allowlist、namespace 和初始化校验。

### 源码节选

```python
def dumps(obj, *, pretty=False, **kwargs):
    if "default" in kwargs:
        raise ValueError("`default` should not be passed to dumps")
    serialized = _serialize_value(obj)
    if pretty:
        return json.dumps(serialized, indent=kwargs.pop("indent", 2), **kwargs)
    return json.dumps(serialized, **kwargs)

def dumpd(obj):
    return _serialize_value(obj)

class Serializable(BaseModel, ABC):
    @classmethod
    def is_lc_serializable(cls):
        return False

    @classmethod
    def lc_id(cls):
        return [*cls.get_lc_namespace(), cls.__name__]
```

节选省略了 secret 映射、Pydantic 字段筛选、旧 namespace 映射、Jinja 校验和完整 reviver。它只能解释身份、转义和 allowlist 的核心机制，不能作为任意对象安全持久化的完整实现。

## 导读

“把 Runnable 保存成 JSON，之后再 load 回来”听起来像普通数据备份，实际上更接近保存一份可执行配置。payload 可能写入 provider、base URL、headers、模型名或文件路径；加载它可能创建网络客户端或读取秘密。另一个陷阱是用户自己的字典也可能有 `lc`、`id`、`type` 等字段，如果序列化器只看外形就会把业务数据误当框架对象。

本课建立三层边界：`dumpd/dumps` 负责把已选择加入合同的对象变成可表达的 JSON 结构；`load` 负责在 allowlist 和 namespace 约束下恢复对象；应用负责信任来源、secret 注入和版本迁移。序列化成功不代表反序列化安全，能反序列化也不代表跨版本行为相同。

本课与 `langchain-01-08` 的 callback 事件相邻：callback 记录运行，序列化记录可复现配置。它不把 callback handler、线程锁、打开的 socket 或任意 provider client 当作可以直接恢复的纯值。

## 分章正文

### 观察一个对象和一份 JSON 的差异

kicker: "01 · OBSERVE"

一个 `PromptTemplate` 实例有类身份、字段默认值和可序列化命名空间；普通 JSON 只有对象、数组、字符串和数字。如果保存时只取 `__dict__`，迁移后无法知道应实例化哪个类；如果把整个 Python 对象图写入，可能把连接、handler 和秘密一起带走。

#### 本章结论

可恢复结构必须同时保存受控身份和构造参数，不能用内存布局替代序列化合同。

### 建立序列化不变量

kicker: "02 · MODEL"

设 `S = (lc, id, type, kwargs)`。对于明确可序列化的对象，`id` 必须能落到允许映射，`kwargs` 必须是可验证输入；普通用户数据中出现 `lc` 时不能自动成为 `S`。恢复前要有 `trusted ∩ allowlist` 的交集，缺少任何一个条件都应返回普通数据或拒绝。

#### 代码

```python
payload = {"lc": 1, "id": ["demo", "Prompt"], "type": "constructor", "kwargs": {}}
user_data = {"lc": 1, "id": "订单", "value": 3}
assert payload["type"] == "constructor"
assert user_data["id"] != payload["id"]
```

#### 本章结论

外形相似不等于来源相同；序列化标记必须由框架生成或经过明确转义。

### 沿 dumpd 与 Serializable 走一遍

kicker: "03 · SOURCE"

`dumpd` 统一进入 `_serialize_value`，可序列化对象调用 `to_json`，不可序列化对象返回 not-implemented 结构。`Serializable` 默认拒绝序列化，子类显式返回 true 后才建立 lc id 和 kwargs。字段筛选会排除默认值和标记为 exclude 的字段，secret 则通过 id 进入独立映射，避免把真正的值直接写进 JSON。

#### 本章结论

序列化是对象主动提供的合同，不是库对任意对象的反射式承诺。

### load 的可信边界

kicker: "04 · FAILURE"

`load` 的默认 core allowlist 适合可信 manifest，不适合任意用户输入；更严格的选择是显式类列表或只允许 messages。源码先检查 escaped dict，保证用户数据不被 reviver 实例化，然后递归子值，再调用 reviver。即便 payload 的结构完全正确，类路径不在允许集合中仍应失败。

官方文档警告构造参数可能改变 base URL 或 headers，因此攻击者可把反序列化变成 SSRF 或秘密读取入口。安全设计应把 manifest 当代码配置，使用签名、版本、来源和显式 allowlist；不要因为 JSON 看起来“没有代码”就取消审查。

#### 本章结论

反序列化是有副作用的构造动作，allowlist 是必要条件，可信来源仍需独立判断。

### 转义规则如何保护用户数据

kicker: "05 · DATA"

普通字典含有 `lc` 键时，dump 过程用 `__lc_escaped__` 包裹；load 看到它会先 unescape 并返回普通 dict，不递归 reviver。这个顺序很关键：如果先对子字段递归再检查转义，恶意嵌套对象可能已经被实例化。测试应同时覆盖顶层字典、metadata 内嵌字典和列表中的字典。

#### 本章结论

转义标志必须在反序列化的最外层优先处理，避免用户数据跨过对象恢复边界。

### 两种持久化变体的取舍

kicker: "06 · ENGINEERING"

变体一是只保存显式白名单对象的 manifest，启动时校验版本和 class path，再由应用注入 secret。它便于迁移与审计，但需要写 schema 升级。变体二是只保存消息和业务字段，不恢复模型与 Runnable，通过代码版本重新组装执行图。它更安全、更容易回滚，却不能完整复现当时的 provider 参数。

生产系统还要处理 PII 脱敏、secret 引用、类改名、旧字段迁移和 schema version。`lc_id` 是识别入口，不是跨版本 ABI；依赖固定 commit 的课程示例也不能承诺任意未来版本都兼容。

#### 本章结论

可复现性和攻击面同时随恢复范围增长；优先保存业务事实和受控配置，再决定是否恢复可执行对象。

### 用安全 payload 断言边界

kicker: "07 · VERIFY"

实验至少包含三组断言：可序列化对象 dump 后保留 id/kwargs；不允许的类 load 时抛出明确错误；普通用户字典即使含 `lc` 也只恢复成 dict。再加入一个恶意 base URL 字段，只验证系统拒绝或要求显式审批，不真正发出网络请求。

#### 本章结论

序列化测试同时验证可恢复性、拒绝路径和数据不被提升为对象，不能只比较 JSON 字符串。

## 核心机制

- `Serializable` 默认不加入序列化，显式子类才提供稳定 lc id。
- `dumpd/dumps` 生成 JSON 兼容结构，并转义含 `lc` 的普通用户数据。
- `load` 以 allowlist、namespace、secret 策略和初始化校验约束恢复。
- 序列化的构造参数可能改变网络和资源行为，manifest 需要按代码配置审计。

## 常见误区

- 用 pickle 或 `__dict__` 代替 LangChain 的可迁移序列化合同。
- 看到 JSON 就认为没有执行风险，忽略构造参数可以改变 base URL。
- 把任意含 `lc` 的业务字典直接交给 reviver。
- 依赖 `lc_id` 就认为跨版本、跨 provider 和跨环境自动兼容。

## 实现变体

### 变体 A：受控对象 manifest

useWhen: "需要保存 Prompt、Runnable 或消息对象，并在受控环境恢复时。"
tradeoff: "可复现信息丰富；必须维护 allowlist、版本迁移和 secret 注入策略。"

#### 代码

```python
manifest = {
    "schema_version": 1,
    "kind": "Prompt",
    "kwargs": {"template": "Hi {name}"},
}
assert manifest["schema_version"] == 1
assert manifest["kind"] in {"Prompt", "Message"}
```

### 变体 B：事实数据加代码重建

useWhen: "安全优先、执行图可由部署版本重建，而不需要恢复任意类时。"
tradeoff: "攻击面更小、回滚清晰；需要确保代码版本和 provider 配置能重建当时行为。"

#### 代码

```python
saved = {"messages": [{"role": "user", "content": "hi"}], "prompt_version": "2026-08"}
def rebuild(data):
    assert data["prompt_version"] == "2026-08"
    return [m["content"] for m in data["messages"]]

assert rebuild(saved) == ["hi"]
try:
    rebuild({"messages": [], "prompt_version": "old"})
except AssertionError:
    pass
else:
    raise AssertionError("old schema must be rejected")
```

## 可运行示例

```python
import json

class Prompt:
    namespace = ["demo"]
    def __init__(self, template):
        self.template = template
    @classmethod
    def lc_id(cls):
        return [*cls.namespace, cls.__name__]

def dumpd(value):
    if isinstance(value, Prompt):
        return {"lc": 1, "type": "constructor", "id": value.lc_id(), "kwargs": {"template": value.template}}
    if isinstance(value, dict):
        clean = {k: dumpd(v) for k, v in value.items()}
        if "lc" in clean:
            return {"__lc_escaped__": clean}
        return clean
    if isinstance(value, list):
        return [dumpd(item) for item in value]
    return value

def load(value, allowed_ids):
    if isinstance(value, dict) and "__lc_escaped__" in value:
        return value["__lc_escaped__"]
    if isinstance(value, dict) and value.get("type") == "constructor":
        if tuple(value["id"]) not in allowed_ids:
            raise ValueError("class is not allowed")
        return Prompt(**value["kwargs"])
    if isinstance(value, dict):
        return {k: load(v, allowed_ids) for k, v in value.items()}
    if isinstance(value, list):
        return [load(v, allowed_ids) for v in value]
    return value

serialized = dumpd(Prompt("Hi {name}"))
restored = load(serialized, {("demo", "Prompt")})
assert isinstance(restored, Prompt)
assert restored.template == "Hi {name}"

user = dumpd({"lc": 1, "value": "data"})
assert load(user, set()) == {"lc": 1, "value": "data"}

try:
    load({"type": "constructor", "id": ["evil", "Client"], "kwargs": {}}, set())
except ValueError as error:
    assert str(error) == "class is not allowed"
else:
    raise AssertionError("untrusted class was instantiated")
assert json.dumps(serialized)
```

示例只模拟核心 allowlist 和 escaped dict 逻辑，故意没有导入真实类、读取 secrets 或访问网络。正常断言验证可恢复对象和用户数据保真，失败断言验证未知 class path 被拒绝。

## 搭积木复现

### 积木 1：定义稳定 id

用 namespace 加类名生成 id，先拒绝内存地址和模块临时路径。

### 积木 2：只允许显式对象

默认让 `is_serializable` 为 false，再为一个安全数据类显式开启，测试 not-implemented 分支。

### 积木 3：实现 dumpd

生成 type、id、kwargs，断言 JSON 可编码并排除运行时连接对象。

### 积木 4：加入 allowlist load

允许指定类，拒绝未知类、空 allowlist 和坏 kwargs，确认错误不会静默降级。

### 积木 5：保护普通字典

为包含 `lc` 的字典增加 escaped 包装，覆盖嵌套字典和列表。

## 自检

### 问题

为什么 `load()` 不能把外部 JSON 当普通数据直接执行？如何用最小测试证明 allowlist 和 escaped dict 分别解决了什么问题？

### 站内答案

结论是 load 会依据 payload 的 class path 和 kwargs 构造对象，外部 JSON 因而可能改变 base URL、headers 或模型配置；它具备执行配置的风险。机制上，官方 reference 要求 allowlist，源码 `load.py` 的 `Reviver` 只允许映射中的对象，且 `_load` 在 reviver 之前优先识别 escaped dict。测试一先构造未知 `id`，用空 allowlist 断言抛出“not allowed”；测试二构造含 `lc` 的普通 metadata 字典，经过 dumpd 后含 `__lc_escaped__`，load 后断言仍是 dict 而非 Prompt 实例。工程上，可信 manifest 也应有签名、版本、secret 映射和初始化校验；对不可信输入优先只允许 messages 或显式类列表，不能以“JSON 没有代码”作为安全依据。

## 更新日志

### 建立 LangChain 序列化、allowlist 与用户数据保护课程

at: "2026-08-02T20:41:41+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "Codex · gpt-5.6-luna"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/31"
commit: "f54f99b04b070443bb7b097ffe9f0bcac85f753c"
summary: "新增 dumpd、load、allowlist、escaped dict 与执行配置风险课程，配套固定源码、失败断言和 flow 视觉索引。"
