---
id: "langgraph-02-09"
track: "langgraph"
title: "schema 演进"
depth: "deep"
visualIndex: "../visuals/langgraph-02-09.md"
exampleLanguage: "python"
readingMinutes: 28
sourceMinutes: 19
practiceMinutes: 32
reviewMinutes: 11
---

## 官方入口

title: "Backward compatibility · Technical compatibility"
url: "https://docs.langchain.com/oss/python/langgraph/backward-compatibility#technical-compatibility"

官方文档说明，恢复线程时会反序列化旧 state，再以最新部署的图按保存的 node 名继续执行。删除或重命名 node/state key、收紧字段、添加无默认的必填字段都可能破坏在途线程；新增可选字段、保留弃用字段与 add-then-remove 是推荐迁移模式。

## 真实源码

repo: "langchain-ai/langgraph"
file: "libs/langgraph/langgraph/graph/state.py"
symbol: "StateGraph._add_schema / StateGraph.compile"
language: "python"
url: "https://github.com/langchain-ai/langgraph/blob/84023451a2bd5987b1d4df530f4145d503d75ccb/libs/langgraph/langgraph/graph/state.py#L256-L286"

### 逐段讲解

- `_add_schema` 将 schema 展开为 channels 与 managed values，并在同名 channel 的类型不兼容时失败。
- `compile()` 会调用 `validate()`，但它验证当前图结构，不会自动把历史 checkpoint 的业务 payload 变形。
- checkpoint 恢复需要旧 state key、保存的 node name 与新代码共同成立，兼容性因此是持久化 API 合同。
- 文档指出 edge topology 本身不保存在 checkpoint；仍存在的 node 间改边通常可行，删除/改名暂停节点则会使恢复找不到入口。
- 节选不涵盖你使用的数据库、序列化版本或部署滚动策略，生产迁移还需自己的观测与回滚门禁。

### 源码节选

```python
def _add_schema(self, schema: type[Any], /, allow_managed: bool = True) -> None:
    if schema not in self.schemas:
        channels, managed, type_hints = _get_channels(schema)
        self.schemas[schema] = {**channels, **managed}
        for key, channel in channels.items():
            if key in self.channels:
                if self.channels[key] != channel:
                    if isinstance(channel, LastValue):
                        pass
                    else:
                        raise ValueError(
                            f"Channel '{key}' already exists with a different type"
                        )
            else:
                self.channels[key] = channel

# compile() 随后调用 self.validate(...)；它验证当前 builder，
# 不是对每份已经持久化的旧值执行业务迁移。
```

## 导读

v1 的订单 state 是 `{customer_name, status}`，v2 想把名字改为 `{customer: {name}}`，并把 `status` 收紧为枚举。新线程容易通过，昨晚在 interrupt 处暂停的旧线程却会带着旧键恢复到新 node：访问 `state["customer"]["name"]` 立即失败，或更糟地走默认值继续处理错误订单。schema 改动由此像数据库迁移，也像公开 API 变更。

正确问题不是“能否改 TypedDict”，而是“哪些 checkpoint 尚可能回来、它们会进入哪个 node、旧值怎样被识别、转换后能否回滚”。这节课把迁移拆为兼容窗口、归一化、观察和删除四步。它建立在上一课的不可变快照之上，避免在恢复时偷偷原地修补历史。

## 分章正文

### 先画出版本交界

kicker: "01 · OBSERVE"

同一部署可能同时有新请求、正在运行的 thread 与 interrupted thread。新代码总会被恢复线程使用，所以 checkpoint 的字段与 node 名就是跨部署接口。给每份 state 加 `schema_version`，不能神奇地转换数据，却能让迁移 node 知道输入属于哪一代，拒绝未知未来版本。

将 `name → customer.name` 拆成两步：v2 先接受旧 name 和新 customer，入口 node 将旧值映射为新结构并双写一个 drain window；确认没有旧 checkpoint 后才删除 name。把重命名一步到位会使暂停线程没有恢复入口。

#### 本章结论

持久化 schema 的消费者包括未来代码；部署是一次 API 版本发布。

### 用显式迁移函数而非隐式默认值

kicker: "02 · MODEL"

迁移函数输入旧 payload，输出新 payload，并满足：不修改输入、同一旧值重复迁移得到同一结果、保留无法安全解释的原始字段或拒绝它。可选字段可提供默认值；新增必填字段必须来自已有证据、人工补全或暂停迁移，不能凭空猜测。

例如旧 `status="paid"` 可映射为 `payment={"state":"paid"}`；若旧值为自由文本 `"maybe"`，应停在 review 而非映射为 approved。规范化发生在 node 的 update 中，记录 `migration_from` 和原 checkpoint ID，使审计能解释一次值为何改变。

#### 本章结论

安全迁移是可测试的数据转换，不是用 `.get()` 藏住缺字段。

### 当前源码能保证什么

kicker: "03 · SOURCE"

`StateGraph._add_schema` 负责把当前 schema 组织为 channel，并拒绝同 key 的不兼容聚合定义；`compile()` 调用图验证。因此开发期能尽早发现新 builder 自相矛盾。它不知道生产库里存了哪些 `schema_version=1` 的 payload，也无法判断旧业务名称是否仍有含义。

官方兼容文档进一步指出：edge 不存入 checkpoint，添加或改边在 node 仍存在时通常可行；保存的 node 名却会参与恢复。因此先保留旧 node 为转发 wrapper，再在活跃线程耗尽后移除，比直接 rename 安全。实际支持范围随 LangGraph 版本变化，部署前应以本课链接的文档与目标版本测试为准。

#### 本章结论

builder 验证保证当前定义自洽；旧 checkpoint 兼容必须由迁移策略和真实 fixture 证明。

### 失败必须可停止而非“尽力修复”

kicker: "04 · FAILURE"

旧 checkpoint 可能缺少新必填字段、含已删除 node、或携带无法反序列化的类型。对财务、权限和人工批准字段，默认值往往是错误决定。迁移应抛带 thread/checkpoint/version 的可操作错误，将任务送入隔离队列或人工 review，并保留原快照供回滚。

双写也有失败路径：新旧字段不一致时不能静默挑一个。定义权威字段和比对指标，异常率超过阈值就停止删除计划。清理旧字段前查询 interrupted/busy thread，结合 tracing 和 `get_state_history` 做抽样恢复演练。

#### 本章结论

无法证明的转换应暂停并保留证据；吞错会把兼容问题变成业务数据损坏。

### 发布节奏与回滚

kicker: "05 · ENGINEERING"

推荐节奏是：先加兼容 reader/可选字段，发布可观测的迁移 node；随后双写并统计旧版本；对 staging 的真实匿名 fixture 回放；确认在途线程清零后，再删除旧字段、旧 node 和兼容分支。每一步都要可回滚到上一版 reader。不要将 schema 迁移与新业务规则、reducer 改写混在一次发布，否则出现差异无法定位原因。

checkpoint 的保留期限决定 drain window 下限。若用户可数月后恢复流程，旧 reader 也需存活数月，或必须提供离线批迁移与明确的“不再可恢复”产品政策。兼容成本是产品承诺，不只是代码整洁度。

迁移指标至少按版本统计读取量、转换成功率、拒绝原因、恢复失败 node 和双写不一致数。指标不能只看总量，因为少量高价值 interrupted thread 也可能携带不可逆支付或人工审批。删除前把这些指标、代表 fixture 和 rollback commit 一并留在发布记录中，才能让下一次演进有可靠起点。

#### 本章结论

迁移完成的信号是旧线程耗尽与演练通过，不是新版本成功部署。

## 核心机制

- checkpoint state 与 node 名是跨版本恢复合同。
- 新字段先可选，重命名采用 add → 双写/归一化 → drain → remove。
- 迁移函数需纯、可重复、可审计并保留失败。
- compile 验证当前图，不能迁移已存业务数据。
- 删除旧字段前要观测在途 thread 与回放 fixture。

## 常见误区

- 给新必填审批字段补一个猜测默认值。
- 把 node rename 当作只改显示名称。
- 在 reducer 内暗中迁移并读取外部数据库。
- 双写不比较，等数据已经分叉才发现。
- 新部署成功就删除旧 schema 分支。

## 实现变体

### 变体 A：在线兼容 reader

useWhen: "在途 thread 数量有限，需要逐次恢复时自然归一化。"
tradeoff: "风险低且可观察；兼容代码与双写窗口更长。"

#### 代码

```python
state = migrate_v1_to_v2(state) if state.get("schema_version", 1) == 1 else state
```

### 变体 B：离线批迁移

useWhen: "存量巨大、schema 改动很深且能暂时冻结恢复。"
tradeoff: "上线代码简单；需要备份、停机窗口与逐条失败隔离。"

#### 代码

```python
for checkpoint in old_checkpoints: write_new(migrate_v1_to_v2(checkpoint))
```

## 可运行示例

```python
from copy import deepcopy

def migrate_v1_to_v2(old):
    if old.get("schema_version", 1) != 1:
        raise ValueError("只接受 schema v1")
    if old.get("status") not in {"pending", "paid"}:
        raise ValueError("未知旧状态，必须人工复核")
    result = deepcopy(old)
    result["customer"] = {"name": result.pop("customer_name")}
    result["payment"] = {"state": result.pop("status")}
    result["schema_version"] = 2
    return result

v1 = {"schema_version": 1, "customer_name": "Lin", "status": "paid"}
v2 = migrate_v1_to_v2(v1)
assert v1 == {"schema_version": 1, "customer_name": "Lin", "status": "paid"}
assert v2["customer"]["name"] == "Lin" and v2["payment"]["state"] == "paid"
try:
    migrate_v1_to_v2({"customer_name": "Lin", "status": "maybe"})
except ValueError as error:
    assert "人工复核" in str(error)
else:
    raise AssertionError("未知业务值不得猜测迁移")
print("schema migration contract: ok")
```

## 搭积木复现

### 积木 1：收集旧 fixture

从 checkpoint history 抽取 v1 的正常、缺字段和异常状态样本。

### 积木 2：写版本标记

新增 schema_version，未知版本拒绝而非倒猜。

### 积木 3：实现纯迁移

复制输入，完成 name/status 的结构转换并记录来源。

### 积木 4：加入失败隔离

无法映射的枚举值抛出包含 checkpoint ID 的错误并入 review 队列。

### 积木 5：演练 drain

统计旧字段读取和 interrupted thread，归零后才删除旧 node/field。

## 自检

### 问题

为什么“新字段改成必填”可能使已中断 thread 失败？请给出安全 rename 与验证计划。

### 站内答案

结论：旧 checkpoint 不含新必填值，恢复的最新 node 无法满足自己的输入合同。机制：恢复会反序列化旧 state 并按已保存 node 名进入新代码；schema 是跨部署接口。源码证据：state.py 256–286 将当前 schema 变为 channels 并拒绝不兼容定义，兼容文档说明旧 checkpoint 需要额外策略。可运行验证：示例将 v1 纯转换为 v2，并拒绝 `maybe` 而非猜测。工程取舍：在线兼容耗时长但可回滚，离线迁移集中但需要备份和隔离。适用边界：删除前必须按实际 checkpoint 保留期确认在途线程已耗尽。

## 更新日志

### 深化持久化 schema 演进

at: "2026-07-31T18:11:31+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "WorkBuddy · Hy3"
summary: "结合兼容文档和 StateGraph schema 代码，补充 checkpoint 迁移、失败隔离、双写与 drain 验证。"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/16"
