---
id: "lora"
order: 10
name: "LoRA · PEFT"
symbol: "Lo"
color: "#d76e91"
description: "低秩适配、PEFT、QLoRA、adapter 生命周期与训练诊断。"
docs: "https://huggingface.co/docs/peft/main/conceptual_guides/lora"
source: "https://github.com/huggingface/peft"
interviewSource: "https://www.nowcoder.com/discuss/769275190441148416"
---

# LoRA · PEFT 课程路线

模块和课题从同级编号目录自动加载。调整课程结构时修改对应模块的 `catalog.md`，不要在这里复制课题清单。

## 大纲审计与优化方向（2026-08-01）

完整评估见 docs/CURRICULUM_AUDIT_2026-08-01.md #7。

**优化目标**：88→~40课；主线「低秩适配数学 + 手撸 mini-LoRA」。

| 模块变化 | 关键动作 |
|---|---|
| 合并01+03 → LoRA设计(6课) | 低秩数学/初始化/缩放/r/alpha选择 |
| 合并02+04 → LoRA训练(8课) | 注入目标层/训练循环/PEFT框架 |
| 压缩05 QLoRA→3课 | 量化前提/内存预算/4-bit训练 |
| 保持06合并路由(4课)、07变体(3课)、08评测(4课) | 核心内容精简 |
| 新增 "手撸 mini-LoRA"(6课) | SVD分解/adapter注入/训练步/fuse merge五步积木 |
