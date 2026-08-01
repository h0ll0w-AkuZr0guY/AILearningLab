---
id: "vllm"
order: 9
name: "vLLM"
symbol: "vL"
color: "#f36b53"
description: "PagedAttention、调度、KV Cache 与 OpenAI-compatible serving。"
docs: "https://docs.vllm.ai/"
source: "https://github.com/vllm-project/vllm"
interviewSource: "https://www.nowcoder.com/discuss/882573284426932224"
---

# vLLM 课程路线

模块和课题从同级编号目录自动加载。调整课程结构时修改对应模块的 `catalog.md`，不要在这里复制课题清单。

## 大纲审计与优化方向（2026-08-01）

完整评估见 docs/CURRICULUM_AUDIT_2026-08-01.md #6。

**优化目标**：92→~50课；主线「推理服务性能模型 + 手撸 mini scheduler」。

| 模块变化 | 关键动作 |
|---|---|
| 保留模块01不变 | 已curated 5课 + 6 pending 继续推进 |
| 整合 02+03+04 为 PagedAttention/Scheduler/Engine 核心链 | PagedAttention(7课)→Scheduler(8课,合并模块01剩余pending+03)→Engine(5课) |
| 降级模块06 Sampling(12→2) | LLM采样概述 + vLLM中采样实现 |
| 降级模块07 LoRA(12→1) | vLLM中的LoRA服务(详细留给LoRA路线) |
| 保持模块05/08 | OpenAI API服务(6课)、观测调优(3课核心) |
| 新增 "手撸 mini-scheduler"（6课） | 统一token预算/KV block分配/FCFS抢占/prefix caching四步积木 |

**已curated 5课处理**：模块01精写正文保留，ID不变。
