---
id: "langchain-01-07"
track: "langchain"
title: "config 传播"
depth: "deep"
visualIndex: "../visuals/langchain-01-07.md"
exampleLanguage: "python"
readingMinutes: 25
sourceMinutes: 8
practiceMinutes: 10
reviewMinutes: 2
---

## 官方入口

title: "LangChain Models · Invocation config"
url: "https://docs.langchain.com/oss/python/langchain/models#invocation-config"

官方章节把 `config` 定义为调用期控制面：`run_name`、`tags`、`metadata`、`callbacks` 和 `max_concurrency` 等字段用于追踪、调试和资源控制。它还明确区分了不继承的 `run_name` 与会传给子调用的 tags、metadata。本文以 LangChain commit `725489f135458c37c668919b0d08652ebd04f131` 的 `RunnableConfig` 实现为版本边界，重点解释配置如何归一化、合并和沿父子 Runnable 传播，不把任意业务字段误当成全局配置。

## 真实源码

repo: "langchain-ai/langchain"
file: "libs/core/langchain_core/runnables/config.py"
symbol: "ensure_config / patch_config / merge_configs"
language: "python"
url: "https://github.com/langchain-ai/langchain/blob/725489f135458c37c668919b0d08652ebd04f131/libs/core/langchain_core/runnables/config.py#L255-L308"

### 逐段讲解

- `ensure_config` 先建立默认 tags、metadata、callbacks、recursion_limit 和 configurable，再从上下文复制可继承配置。
- 已知顶层键按允许集合进入配置；未知键不会被丢掉，而是放进 `configurable`，使它们在运行期仍可被显式读取。
- `patch_config` 换 callback manager 时清除原 run 的 `run_name` 与 `run_id`，避免把父运行身份伪装成子运行。
- `merge_configs` 对 metadata 使用覆盖加版本合并，对 tags 去重排序，对 configurable 做后者覆盖；callbacks 则按 list、manager、None 的组合规则合并。
- `Runnable.with_config` 返回 `RunnableBinding`，绑定的是一个新 Runnable；它不修改原对象，因此同一个可运行单元可以拥有多个调用配置。

### 源码节选

```python
def ensure_config(config=None):
    empty = RunnableConfig(
        tags=[], metadata={}, callbacks=None,
        recursion_limit=DEFAULT_RECURSION_LIMIT,
        configurable={},
    )
    if var_config := var_child_runnable_config.get():
        empty.update(copy_inheritable_values(var_config))
    if config is not None:
        empty.update(copy_known_keys(config))
        for key, value in config.items():
            if key not in CONFIG_KEYS and value is not None:
                empty["configurable"][key] = value
    return empty

def patch_config(config, *, callbacks=None, run_name=None, configurable=None):
    config = ensure_config(config)
    if callbacks is not None:
        config["callbacks"] = callbacks
        config.pop("run_name", None)
        config.pop("run_id", None)
    if run_name is not None:
        config["run_name"] = run_name
    if configurable is not None:
        config["configurable"] = {**config.get("configurable", {}), **configurable}
    return config
```

节选保留配置的三层边界，省略了 Pydantic 类型别名、版本 metadata 和 callback manager 的六种组合。它不是一个完整可替换的生产实现，尤其不能据此自行定义新的继承键。

## 导读

Runnable 的业务输入回答“这次计算什么”，config 回答“这次计算怎样被观察、限制和选择”。如果把 `user_id`、模型温度、数据库连接和 callback handler 全塞进输入字典，业务函数就被迫知道观测系统；如果把所有东西都塞进 config，又会让数据 schema 隐身，重放时无法解释。

本课用一条不变量贯穿：业务值沿数据管道转换，config 沿调用树传播；两条通道可以同时存在，但不互相伪装。已知控制键按 LangChain 规则处理，未知顶层键进入 `configurable`；子运行继承适合追踪的 tags、metadata 和 callbacks，`run_name` 只描述当前运行；显式 patch 后要重新建立子运行身份。

本课承接 `langchain-01-05` 的 invoke，先讲配置通道，再由下一课说明 callback 如何消费它。配置传播是框架基础设施，不等同于 LangGraph 的 checkpoint 或业务 context；后者需要单独的生命周期和持久化协议。

## 分章正文

### 观察同一函数的两种输入

kicker: "01 · OBSERVE"

同一个 `double(3)`，业务输入始终是整数 3；调用者却可以通过 config 增加 tag、追踪名称和最大并行度。若把 tag 放入业务字典，函数必须把它从数据中剥离；若把业务数字放进 config，schema 校验、缓存键和结果计算都会失去清晰边界。

#### 本章结论

业务输入和 config 是两条并行通道，先分通道再谈继承。

### 建立配置模型与不变量

kicker: "02 · MODEL"

把一次调用表示为 `(value, config)`。`value` 可以从字符串变成整数；config 的 `tags`、`metadata` 和 callback manager 伴随调用树向下传递。`run_name` 是当前 run 的命名，不能因为孩子继承它就把整棵树伪装成同名节点；`configurable` 是显式运行期参数，不能偷偷变成环境变量。

#### 代码

```python
parent = {"run_name": "root", "tags": ["prod"], "metadata": {"request": "r1"}}
child = {"tags": ["parse"], "metadata": {"step": 2}}
merged = {
    "tags": sorted(set(parent["tags"] + child["tags"])),
    "metadata": {**parent["metadata"], **child["metadata"]},
}
assert merged == {"tags": ["parse", "prod"], "metadata": {"request": "r1", "step": 2}}
assert "run_name" not in merged
```

#### 本章结论

继承不是简单的 dict update；每个键都有传播、覆盖或禁止继承的合同。

### 沿 ensure_config 走一遍

kicker: "03 · SOURCE"

源码先创建默认配置，再复制上下文中的 child runnable config，随后只接受已知配置键。未知键被放进 `configurable`，这使自定义运行参数仍然可见，却不把它们当作 callback、并发或递归控制。对 `model`、`checkpoint_ns` 等 configurable 值，源码还会把它们补进 metadata，方便追踪。

#### 本章结论

归一化的任务是补齐默认值、复制可变集合并保持未知字段的显式归属。

### patch 如何重置运行身份

kicker: "04 · FAILURE"

当父运行把 callback manager 交给子 Runnable 时，`patch_config` 替换 callback 后会删除 `run_name` 和 `run_id`。这是防止身份污染的重要步骤：run id 只属于创建它的运行，子运行应该由 callback manager 生成新的 id。若自定义 executor 直接复制父 dict 而不 patch，就会出现多个节点共享一个 run id，追踪树无法闭合。

#### 本章结论

传播可观察上下文，不能传播已经消费过的运行身份；换 manager 就要重新建立身份。

### merge_configs 的冲突规则

kicker: "05 · MERGE"

`merge_configs` 不是任意字段的最后写入者赢。tags 合并后去重排序，metadata 默认后者覆盖但 `lc_versions` 这样的版本映射继续合并，configurable 后者覆盖，callbacks 根据 list 或 manager 类型增加 handler。对两个 config 都有 callback 时，如果盲目 `dict.update`，前一层观测器会被静默丢掉。

#### 本章结论

配置合并必须按字段语义实现；“都是字典”不能推出“所有字段都可覆盖”。

### 从组合实现走向工程决策

kicker: "06 · ENGINEERING"

变体一是函数签名显式接收 `config`，适合需要读取 tags、metadata 或配置参数的 Runnable；优点是依赖可见，代价是每个函数要遵守接口。变体二是通过 contextvar 取得当前 child config，适合深层组合和标准 Runnable；优点是少量传参，代价是线程、任务和脱离框架的后台工作必须验证上下文是否存在。

业务 context 适合租户、授权主体和请求数据，configurable 适合声明过的运行期可配置项，metadata 适合追踪标签。把 access token 放 metadata 会泄露到 tracing，把数据库事务放 configurable 会误解它的生命周期。

#### 本章结论

传播机制要服从数据敏感性和生命周期；可继承不等于可公开，也不等于可持久化。

### 用验证实验确认传播边界

kicker: "07 · VERIFY"

测试应捕获父、子两个 run 的 config 快照，断言 tags 和 metadata 继承、run_name 不继承、callbacks 没有被覆盖，并确认输入字典没有被 config 污染。还要测试两个 config 合并后的 tags 顺序稳定、未知键进入 configurable、原始 config 未被函数原地修改。

#### 本章结论

配置测试既要验证值，又要验证身份、复制和敏感信息边界。

## 核心机制

- `ensure_config` 补齐默认键、复制可变集合并归类未知键。
- `patch_config` 在替换 callback manager 时清理父运行身份。
- `merge_configs` 按 tags、metadata、configurable 和 callbacks 的字段语义合并。
- `with_config` 通过 binding 创建新 Runnable，不改变原 Runnable 的默认行为。

### 配置传播的实际决策

可以把一次调用想成一张沿着 Runnable 图移动的“运行卡片”。卡片上有业务不需要读取的追踪信息，也有当前步骤确实要读取的 configurable 参数。父节点创建子节点时，tags 适合描述这次运行属于哪个实验，metadata 适合记录稳定且低敏的上下文，configurable 才适合承载租户、模型别名或检索数量这类运行期选择。三者都放进同一个字典，却承担不同的可见性和生命周期，混用后很难判断一个值究竟应该被继承、覆盖还是丢弃。

`ensure_config` 的复制动作给出了一个重要的不变量：调用方交给 Runnable 的 config 不应因为内部追加 tag 或写入 callback 而改变。若测试只比较最终输出，就看不出这个边界；下一次复用同一个字典时，旧调用留下的 tag 可能泄漏到新调用，形成跨请求污染。`merge_configs` 的列表拼接也意味着顺序有语义，父级观察者应该先于子级观察者收到事件，生产实现不能用无序集合替代。涉及敏感信息时，还要在进入 metadata 前做白名单和脱敏，不能把“方便调试”当作上传原文的理由。

当任务跨线程、队列或后台协程时，隐式上下文可能失效。此时应把真正必需的业务参数显式传递，把追踪字段交给框架管理，并用失败测试确认缺失上下文时的默认行为。这样的拆分让重试、缓存和审计各自拥有清晰输入，也避免把一个只用于日志的字段错误地当成模型调用的业务契约。

## 常见误区

- 把 config 当作业务输入，导致函数 schema 和缓存键混入追踪字段。
- 用 `dict.update` 合并 callbacks，静默丢掉父级 handler。
- 把 run_name、run_id 当作可继承标签，生成无法解释的重复运行节点。
- 将秘密、完整用户内容或授权 token 放进会上传到 tracing 的 metadata。

## 实现变体

### 变体 A：显式 config 参数

useWhen: "函数需要读取一个可测试的运行期选项，或代码脱离 Runnable 也要能调用时。"
tradeoff: "依赖关系清楚、便于单测；函数签名更长，组合器必须正确转发。"

#### 代码

```python
def label(value, config):
    prefix = config.get("configurable", {}).get("prefix", "")
    return f"{prefix}{value}"

assert label("x", {"configurable": {"prefix": "id:"}}) == "id:x"
```

### 变体 B：上下文继承

useWhen: "深层 Runnable 组合需要自动获得父级 tags、metadata 与 callback 子上下文时。"
tradeoff: "调用链简洁并能统一接入追踪；脱离调用上下文的线程或后台任务可能丢失配置。"

#### 代码

```python
from contextvars import ContextVar

current_config = ContextVar("current_config", default={})

def nested(value):
    return value + current_config.get().get("metadata", {}).get("step", 0)

token = current_config.set({"metadata": {"step": 2}})
try:
    assert nested(3) == 5
finally:
    current_config.reset(token)
assert nested(3) == 3
```

## 可运行示例

```python
from copy import deepcopy

KNOWN = {"tags", "metadata", "callbacks", "run_name", "run_id", "max_concurrency"}

def ensure_config(config=None):
    config = config or {}
    result = {"tags": [], "metadata": {}, "configurable": {}}
    for key, value in config.items():
        if key in KNOWN:
            result[key] = deepcopy(value)
        else:
            result["configurable"][key] = deepcopy(value)
    return result

def merge_configs(*configs):
    result = ensure_config()
    for config in configs:
        item = ensure_config(config)
        result["tags"] = sorted(set(result["tags"] + item.get("tags", [])))
        result["metadata"] = {**result["metadata"], **item.get("metadata", {})}
        result["configurable"] = {**result["configurable"], **item["configurable"]}
        if item.get("callbacks") is not None:
            result["callbacks"] = list(result.get("callbacks", [])) + list(item["callbacks"])
    return result

original = {"tags": ["root"], "metadata": {"request": "r1"}, "timeout": 3}
merged = merge_configs(original, {"tags": ["child", "root"], "metadata": {"step": 2}})
assert merged["tags"] == ["child", "root"]
assert merged["metadata"] == {"request": "r1", "step": 2}
assert merged["configurable"]["timeout"] == 3
assert original == {"tags": ["root"], "metadata": {"request": "r1"}, "timeout": 3}

bad = merge_configs({"callbacks": ["root"]}, {"callbacks": ["child"]})
assert bad["callbacks"] == ["root", "child"]
```

示例实现了教学用的复制、归类、tags 合并和 callback 追加，故意没有实现 LangChain 的 callback manager 类型、版本 metadata 和 run id 生命周期。失败路径由原始输入不被修改与 callback 不被覆盖两个断言覆盖。

## 搭积木复现

### 积木 1：拆出业务值和 config

让函数只从 value 计算结果，只从 config 读取可声明参数，断言两者不会互相污染。

### 积木 2：补齐默认配置

实现 `ensure_config`，测试 None、空字典和未知键的归属。

### 积木 3：复制可变字段

修改子配置的 tags、metadata 与 callbacks，断言父配置保持不变。

### 积木 4：实现字段级 merge

分别为 tags、metadata、configurable 和 callbacks 写冲突用例，不使用一次 `update` 代替规则。

### 积木 5：模拟父子运行

为父 run 和子 run 生成不同 id，替换 callback 时清除旧身份，断言追踪树可回溯。

## 自检

### 问题

为什么 `run_name` 和 `tags` 不能采用同一种继承规则？如何验证一个子 Runnable 没有误用父级 run id？

### 站内答案

结论是 tags 描述一组可继承的观察标签，run_name 描述当前运行节点；两者语义不同。机制上，官方配置文档说明 tags、metadata 会传给子调用，而 run_name 只标识当前 invocation；源码的 `patch_config` 在替换 callback manager 时删除 run_name 和 run_id，促使子 manager 创建新身份。验证时在 fake callback handler 中记录父、子两次 `on_chain_start` 的 run id，断言 id 不相等、子事件的 parent_run_id 指向父 id，并断言 tags 含父标签而子 name 为自身名称。工程取舍是显式传播可过滤的低基数 metadata，避免把业务密钥放进去；如果运行已跨进程或持久化，必须把需要恢复的业务 context 写入专门的状态协议，不能依赖 contextvar。

## 更新日志

### 建立 config 归一化、合并与父子传播课程

at: "2026-08-02T20:41:41+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "Codex · gpt-5.6-luna"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/31"
summary: "新增 Runnable config 的双通道模型、字段级合并、运行身份边界、示例和 state 视觉索引。"
