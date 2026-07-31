---
id: "langgraph-01-09"
track: "langgraph"
title: "拓扑验证与迁移：孤立节点、循环和 interrupt 兼容"
depth: "deep"
visualIndex: "../visuals/langgraph-01-09.md"
exampleLanguage: "python"
readingMinutes: 33
sourceMinutes: 35
practiceMinutes: 62
reviewMinutes: 15
---

## 官方入口

title: "LangGraph Graph API · Graph migrations"
url: "https://docs.langchain.com/oss/python/langgraph/graph-api#graph-migrations"

官方区分完成线程与 interrupted 线程：完成线程可更换全部拓扑；中断线程通常能接受边变化，但删除或重命名其可能进入的节点会破坏恢复。State key 的重命名会丢失旧值，不兼容类型变化可能失败。

## 真实源码

repo: "langchain-ai/langgraph"
file: "libs/langgraph/langgraph/graph/state.py"
symbol: "StateGraph.validate"
language: "python"
url: "https://github.com/langchain-ai/langgraph/blob/41341457342327166d72fc11952ab28fb61ec0bf/libs/langgraph/langgraph/graph/state.py#L1116-L1162"

### 逐段讲解

- 验证器先从静态边、条件分支和 Command 的 ends 声明收集所有 source；动态路由若不给 Literal 或 path_map，只能保守认为可能到很多节点。
- 所有 source 必须是已注册节点或 START，并且图必须至少有一个 START 出边。这个检查防止拼写错误和无入口图，不证明业务最终可终止。
- 目标集合允许 END，其他目标必须存在。静态可知的悬空边会在 compile 前失败；运行时字符串路由仍可能产生未知节点。
- interrupt_before/after 的节点名也在编译时核对。它只证明当前图包含该名字，无法证明历史 checkpoint 所等待的旧 interrupt 与新响应 schema 兼容。
- validate 最后标记 compiled。它没有读取任何生产 checkpoint，所以不可能发现旧线程 next 指向被重命名节点、旧 State 缺少新必填字段或业务语义已经改变。

### 源码节选

```python
def validate(self, interrupt: Sequence[str] | None = None) -> Self:
    all_sources = {source for source, _ in self._all_edges}
    for start, branches in self.branches.items():
        all_sources.add(start)
    for name, spec in self.nodes.items():
        if spec.ends:
            all_sources.add(name)

    for source in all_sources:
        if source not in self.nodes and source != START:
            raise ValueError(
                f"Found edge starting at unknown node '{source}'"
            )

    if START not in all_sources:
        raise ValueError("Graph must have an entrypoint")

    all_targets = {end for _, end in self._all_edges}
    for target in all_targets:
        if target not in self.nodes and target != END:
            raise ValueError(
                f"Found edge ending at unknown node '{target}'"
            )

    if interrupt:
        for node in interrupt:
            if node not in self.nodes:
                raise ValueError(f"Interrupt node '{node}' not found")

    self.compiled = True
    return self
```

## 导读

编译通过回答的是“这张新图在自身定义中是否自洽”。线上迁移还要回答“昨天保存的执行地址和数据，今天的代码是否仍能解释”。两者像编译一个新版数据库客户端与读取旧表：类型检查成功，并不代表列重命名、枚举收紧和存量数据都安全。

LangGraph 默认让最新部署的图代码作用于现有线程，并不会把每个运行永久钉在启动时的代码版本。好处是修复立即生效，代价是每次节点、State、interrupt 或 Functional 调用序列变化都成为持久协议变更。

本课建立双门禁：静态拓扑验证负责当前图；存量线程审计负责 checkpoint 兼容。迁移先枚举 busy、interrupted、error 线程的 next/tasks/state，再决定双写、兼容节点、排空、分版本图名或一次性数据转换。


## 分章正文

### validate 能证明什么，又刻意不证明什么

kicker: "01 · STATIC GATE"

StateGraph.validate 能发现未知 source/target、缺少 START 入口和无效 interrupt 节点。它还会根据静态边、branch path_map 与节点 ends 收集可能目标。这些是图定义内部的一致性问题，应在提交前快速失败。

它不会证明所有节点可达、所有循环终止、所有动态路由字符串合法，也不会访问 checkpointer。孤立但注册的节点可能只是未来入口或死代码；是否禁止要由项目 lint 规则决定。

#### 本章结论

compile validation 是结构类型检查，不是模型检查器或迁移审计器。

### 中断线程保存的是节点地址，删除名字就失去落点

kicker: "02 · SAVED ADDRESS"

interrupted thread 的 snapshot.next/tasks 可能写着 human_review。部署后若把节点改名为 approval，运行时加载旧 checkpoint 时仍会寻找 human_review；新边画得再正确，也没有函数可接住这个地址。

安全重命名采用 add-then-remove：保留旧节点名作为兼容适配器，内部调用新实现或迁移旧 State；新路径改走新节点；待所有旧线程排空后再删除。节点名因此应像公开 API endpoint 一样稳定。

#### 本章结论

对存量 checkpoint 而言，node name 是可持久程序计数器。

### 边通常未持久化，但业务路线仍可能需要版本锁

kicker: "03 · EDGES"

官方指出 interrupted thread 通常可以接受新增、删除或改道边，只要待进入节点仍存在。因为 checkpoint 保存当前状态和下一节点，节点完成后的新路由由最新图计算。技术上能跑，不代表业务上允许。

若审批中的订单必须继续旧费率流程，就应在 State 保存 policy_version，并让路由按版本选择；或发布 v2 图名，把新线程导向 v2、旧线程留在 v1。把业务兼容寄托在“边不持久化”会让存量运行静默改变承诺。

#### 本章结论

技术兼容只保证能执行，业务兼容还要保持启动时承诺。

### 新增、删除、重命名与类型收紧的风险不同

kicker: "04 · STATE SCHEMA"

新增可选字段最安全：旧 checkpoint 缺失时节点使用默认值。删除不再读取的字段通常可容忍额外数据。重命名却不会自动搬运旧值，新字段看起来像从未存在；把 Optional 收紧为必填或把字符串改成不兼容对象，也可能让旧状态无法验证或执行。

稳定做法是 schema_version + 分阶段迁移：先新增 new_key 并兼容读取 old_key，节点双写；后台统计旧线程；再停止写 old_key；最后排空后删除。类型转换应是显式、幂等、可审计函数。

#### 本章结论

State 是持久数据合同，演进方式应接近数据库 schema migration。

### 节点还在并不代表人工恢复协议仍兼容

kicker: "05 · INTERRUPT CONTRACT"

旧 interrupt 可能询问布尔 approve，新版本期待包含 reason、scope 的对象。节点名相同，Command(resume=True) 到达新代码后仍可能解析失败或更危险地被错误解释。interrupt payload、resume schema 与调用顺序都应版本化。

在 State 或 interrupt value 中保留 contract_version，新节点同时解析旧版与新版；无法兼容时让旧图排空。迁移验收必须拿真实历史 checkpoint 做恢复演练，单纯重新触发一个新版 interrupt 无法覆盖旧 payload。

#### 本章结论

可恢复人工交互是一条跨部署 API，问题和答案都需要版本。

### 上线前扫描存量线程并分类处置

kicker: "06 · MIGRATION GATE"

门禁输入包括变更前后节点集合、State schema、interrupt 合同和 Functional 调用序列；运行证据包括 busy、interrupted、error 线程的 next、tasks 与 schema_version。对每个删除节点计算是否仍有线程指向，对每个新必填字段检查旧 values。

处置可以是阻止部署、保留兼容节点、运行状态迁移、等待排空或发布新 graph id。迁移后抽样 get_state/get_state_history，并从旧 checkpoint 在 staging 恢复，比较路线、外部幂等键与最终状态。

#### 本章结论

迁移评审必须把代码 diff 与活跃 checkpoint 集合相交。

## 核心机制

- validate 收集静态 sources/targets，检查未知节点和 START 入口。
- 条件分支的 Literal、path_map 与 ends 提高可静态验证范围。
- 编译时 interrupt 节点必须存在，但历史 interrupt 合同不在检查范围。
- 最新部署图会解释现有线程，运行不会自动钉住旧代码版本。
- interrupted thread 的 next/task node name 是持久执行地址。
- 边通常不存入 checkpoint，节点完成后的路线可采用新拓扑。
- 新增可选 State 字段通常兼容；重命名会让旧值失联。
- 不兼容类型收紧与新必填字段需要显式数据迁移。
- 业务版本可进入 State 路由，或用不同 graph id 隔离代际。
- 真实 checkpoint 恢复演练是迁移门禁的最终证据。

## 常见误区

- compile 成功就宣布历史线程兼容。
- 直接重命名被 interrupt 或 next 引用的节点。
- 删除 State key 后假定 checkpointer 会自动清理和迁移。
- 把字段重命名当等价重构，导致旧值静默丢失。
- 新增无默认值的必填字段并立即部署到存量线程。
- 只保留节点名，却改变 interrupt resume schema。
- 认为边不持久化就代表业务路线可以任意变化。
- 使用 step 数而非稳定节点/业务版本做迁移判定。
- 没有查询 busy/interrupted/error 线程就清理兼容代码。
- 只在新线程测试新版图，不用真实旧 checkpoint 恢复。

## 实现变体

### 兼容演进同一 graph id

useWhen: "变更可通过可选字段、兼容节点和版本路由向后兼容。"
tradeoff: "修复立即覆盖存量线程；代码在排空期同时维护多代合同。"

### 新 graph id 分代

useWhen: "Functional 调用序列、业务规则或 State 类型发生难以兼容的大变化。"
tradeoff: "隔离清晰、回滚简单；需要双重部署、路由、监控与存量排空。"

### 停机迁移 checkpoint

useWhen: "线程数量可控，必须一次性转换关键字段或执行地址。"
tradeoff: "最终模型干净；迁移脚本风险高，必须备份、幂等和可回滚。"

## 可运行示例

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class StoredThread:
    thread_id: str
    next_nodes: tuple[str, ...]
    values: dict[str, object]

def validate_graph(nodes, edges):
    allowed = nodes | {"START", "END"}
    assert any(source == "START" for source, _ in edges)
    for source, target in edges:
        if source not in allowed or target not in allowed:
            raise ValueError(f"unknown: {source} -> {target}")

def migration_issues(nodes, required_keys, threads):
    issues = []
    for thread in threads:
        missing_nodes = set(thread.next_nodes) - nodes
        missing_keys = required_keys - thread.values.keys()
        if missing_nodes:
            issues.append((thread.thread_id, "node", missing_nodes))
        if missing_keys:
            issues.append((thread.thread_id, "state", missing_keys))
    return issues

new_nodes = {"draft_v2", "send"}
validate_graph(
    new_nodes,
    [("START", "draft_v2"), ("draft_v2", "send"), ("send", "END")],
)
parked = [StoredThread("t-1", ("draft",), {"text": "hello"})]
issues = migration_issues(
    new_nodes,
    {"text", "schema_version"},
    parked,
)
assert len(issues) == 2
```

## 搭积木复现

### 积木 1：复现静态 validate

检查 START、未知 source/target 与 interrupt 节点，明确其不读取 checkpoint。

### 积木 2：建立存量线程样本

保存 next_nodes、values、interrupt version 和运行状态。

### 积木 3：比较节点集合

找出被删除或重命名且仍由活跃线程引用的地址。

### 积木 4：比较 State 合同

检测旧线程缺少新必填字段、旧字段重命名和不兼容类型。

### 积木 5：加入兼容适配器

保留旧节点名与 old_key 读取，双写新字段并统计剩余调用。

### 积木 6：演练旧点恢复

在 staging 加载真实历史 checkpoint，验证路由、resume schema 和副作用幂等。

## 自检

### 问题

新版图编译通过，但把 review 改名为 approval、messages_v1 改名为 messages，并改变了 interrupt 的回答结构。哪些存量线程会出问题，怎样无停机迁移？

### 站内答案

结论：已完成线程不依赖旧执行地址，通常可直接使用新拓扑；任何 busy、error 或 interrupted 线程若 snapshot.next/tasks 指向 review，删除该节点就无法恢复。旧 checkpoint 中 messages_v1 不会自动搬到 messages，新节点可能读到空值；旧 interrupt 的布尔 resume 也不能直接交给期待对象的新代码。无停机方案是先保留 review 兼容节点，把旧 resume 解析为新结构并转给 approval；State 同时定义两键，优先读 messages、回退 messages_v1，并在节点更新时双写或做一次幂等迁移；新线程走新路径。上线门禁扫描活跃线程和真实 checkpoint，待 review、v1 字段与旧 interrupt 全部排空后，下一阶段才删除兼容层。
