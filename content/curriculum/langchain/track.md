---
id: "langchain"
order: 7
name: "LangChain"
symbol: "LC"
color: "#7655e8"
description: "模型、消息、工具、Agent、Middleware 与从零复现。"
docs: "https://docs.langchain.com/oss/python/langchain/overview"
source: "https://github.com/langchain-ai/langchain"
interviewSource: "https://www.nowcoder.com/discuss/comment/22623788"
---

# LangChain 课程路线

模块和课题从同级编号目录自动加载。调整课程结构时修改对应模块的 `catalog.md`，不要在这里复制课题清单。

## 大纲审计与优化方向（2026-08-01）

完整评估见 docs/CURRICULUM_AUDIT_2026-08-01.md #4。

**优化目标**：120→~45课；主线「LLM框架抽象（Runnable接口）+ 手撸 mini-LangChain」。

| 模块变化 | 关键动作 |
|---|---|
| 保留模块01核心 | 已curated 5课(消息/BaseMessage/ChatModel/Prompt/Runnable invoke) + 扩展3课(batch/stream/error) |
| 删除模块03 Prompt/Output(12课) | 降为1课放模块01末尾(PromptTemplate=Runnable子类) |
| 删除模块04 Tool系统(12课) | 保留核心Tool/ToolCall/AgentLoop为模块03(8课) |
| 删除模块06 Middleware | 整合进模块02 Runnable组合 |
| 删除模块07 RAG(12课) | 移到LangGraph路线统一维护 |
| 删除模块08 Memory/Context(12课) | 降为模块05末尾1-2课 |
| 删除模块09 高级Chain(12课) | 整合进模块02 |
| 保留模块02 Provider + 模块05 Agent → 重组 | Provider适配(5课)、Agent Loop(8课)、Memory+生产(5课) |
| 压缩模块10 手撸LC → 6课 | Runnable/Chain/Tool/Agent/Memory五步积木 |
| 新增 "手撸 mini-LangChain"（6课） | 从 Runnable 接口到完整 Agent 调用的最小可用框架 |

**核心设计思想**：Runnable 接口（invoke/batch/stream/bind/with_config）是 LangChain 的「统一token预算」级抽象——所有模块围绕这一单一接口展开。

**已curated 5课处理**：模块01的5篇精写正文保留，ID不变；后续pending按新粒度。
