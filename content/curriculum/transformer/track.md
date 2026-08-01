---
id: "transformer"
order: 5
name: "Transformer"
symbol: "Tr"
color: "#e99726"
description: "从矩阵、注意力、训练动力学到模型系统。"
docs: "https://pytorch.org/docs/stable/generated/torch.nn.MultiheadAttention.html"
source: "https://github.com/huggingface/transformers"
interviewSource: "https://www.nowcoder.com/discuss/769275190441148416"
---

# Transformer 课程路线

模块和课题从同级编号目录自动加载。调整课程结构时修改对应模块的 `catalog.md`，不要在这里复制课题清单。

## 大纲审计与优化方向（2026-08-01）

完整评估见 docs/CURRICULUM_AUDIT_2026-08-01.md #5。

**优化目标**：120→~55课；主线「理解注意力 + 手撸 mini-GPT」。

| 模块变化 | 关键动作 |
|---|---|
| 重组模块01 线性代数→6课 | 跳过大学向量的基础部分,从矩阵乘法/softmax算起 |
| 压缩模块02 Tokenization→3课 | tokenizer接口/BPE概念/embedding+position(非NLP预处理工程) |
| 合并03+04 Attention→8课 | QK^T/scale/softmax/mask/RoPE/KV cache/GQA/MQA 聚焦核心 |
| 合并05+06+07核心→8课 | residual/norm/MLP/dropout + loss/optimizer/schedule + 数据/batch/perplexity |
| 降级模块08高效Attention | 降为M3末尾1课(flash attention概念,mini框架不需要) |
| 降级模块09微调 | 删减(留给LoRA路线),保留1句概述 |
| 合并10+11+12 → 手撸mini-GPT(10课) | tokenizer/模型/训练/sampling/checkpoint/部署/架构复盘+面试实战 |

**已curated 10课处理**：模块01为foundation短文,需按深化标准重写;可复用现有视觉文件。
