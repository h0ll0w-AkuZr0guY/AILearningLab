---
id: "langgraph"
order: 3
name: "LangGraph"
symbol: "LGr"
color: "#9a6cff"
description: "显式状态机、耐久执行、人工审批与生产编排。"
docs: "https://docs.langchain.com/oss/python/langgraph/overview"
source: "https://github.com/langchain-ai/langgraph"
interviewSource: "https://www.nowcoder.com/discuss/882573284426932224"
---

# LangGraph 课程路线

模块和课题从同级编号目录自动加载。调整课程结构时修改对应模块的 `catalog.md`，不要在这里复制课题清单。

## 大纲审计与优化方向（2026-08-01）

完整评估见 docs/CURRICULUM_AUDIT_2026-08-01.md #2。

**核心问题**：模块04与06（Checkpoint）、03与05（Edge/State）、08与09（多Agent/子图）三重重叠；RAG/安全/部署属于应用工程而非框架核心。

**优化目标**：132→~70课；主线「状态图引擎 + 手撸 mini BSP runtime」。

| 模块变化 | 关键动作 |
|---|---|
| 合并 03+05 → "边、路由与状态模型"（8课） | 条件边/循环/图组合/fan-out/fan-in 归入一个模块；删除 05 重复的 state/build/compile |
| 合并 04+06 → "Checkpoint 与耐久执行"（6课） | thread id/snapshot/pending writes/idempotency key 四个概念一套讲完 |
| 合并 08+09 → "多Agent 与子图组合"（8课） | subgraph/上下文隔离/parallel/角色合同/误差传播合并 |
| 降级 11 RAG → 移到 LangChain 路线 | 不重复维护两套 RAG 课程 |
| 降级 12 安全 → 1课放在 M8 末尾 | 安全最佳实践，不独立成模块 |
| 降级 13 部署 → 整合到 Nuxt/系统设计 | 不重复 |
| 新增 "手撸 mini-LangGraph"（6课） | StateGraph/Node/Pregel/Checkpoint/reducer 五步积木实战 |
| 降模块01门槛 | 第一课改为「从 if-else 地狱到图的动机」（简单难度），保留 Pregel 为随后核心课 |

**递进线路**：图思维→状态定义→边/路由/循环→checkpoint→多Agent→人工审批→观测评测→手撸mini-LangGraph

**已curated 20课处理**：模块01/02的20篇精写正文保留，ID在新模块下重新编号；新增的手撸模块全部pending。
