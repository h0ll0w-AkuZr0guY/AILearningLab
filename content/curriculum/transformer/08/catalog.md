---
track: "transformer"
id: "transformer-08"
order: 8
title: "08 · 高效 Attention 与推理"
goal: "从 memory bandwidth、kernel fusion、cache 到量化理解吞吐。"
lab: "profile 标准 attention 与 SDPA 的差异。"
interview: "推理为什么常受内存带宽而非 FLOPs 限制？"
officialScope: "https://pytorch.org/docs/stable/generated/torch.nn.MultiheadAttention.html"
sourceScope: "仓库根目录与 tests"
planningStatus: established
---

# 08 · 高效 Attention 与推理

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

## transformer-08-01

title: "FlashAttention"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 70
granularity: "单点精讲"

## transformer-08-02

title: "SDPA backend"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## transformer-08-03

title: "memory bandwidth"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## transformer-08-04

title: "prefill decode"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## transformer-08-05

title: "continuous batching"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 70
granularity: "单点精讲"

## transformer-08-06

title: "paged KV cache"
status: pending
owner: ""
difficulty: "专家"
difficultyReason: "横跨运行时、编译器或分布式系统边界，必须拆成多个积木并完成源码级复现。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 100
granularity: "拆分专题"

## transformer-08-07

title: "quantization basics"
status: pending
owner: ""
difficulty: "专家"
difficultyReason: "横跨运行时、编译器或分布式系统边界，必须拆成多个积木并完成源码级复现。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 100
granularity: "拆分专题"

## transformer-08-08

title: "speculative decoding"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## transformer-08-09

title: "tensor parallel"
status: pending
owner: ""
difficulty: "专家"
difficultyReason: "横跨运行时、编译器或分布式系统边界，必须拆成多个积木并完成源码级复现。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 100
granularity: "拆分专题"

## transformer-08-10

title: "serving metrics"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"
