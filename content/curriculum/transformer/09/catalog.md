---
track: "transformer"
id: "transformer-09"
order: 9
title: "09 · 微调与对齐"
goal: "区分 full fine-tuning、PEFT、SFT、偏好优化和安全评估。"
lab: "用 LoRA 微调小模型并审计数据格式。"
interview: "LoRA 为什么可用低秩更新逼近任务变化？"
officialScope: "https://pytorch.org/docs/stable/generated/torch.nn.MultiheadAttention.html"
sourceScope: "仓库根目录与 tests"
planningStatus: established
---

# 09 · 微调与对齐

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

## transformer-09-01

title: "instruction data"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## transformer-09-02

title: "SFT loss"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## transformer-09-03

title: "LoRA matrices"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 70
granularity: "单点精讲"

## transformer-09-04

title: "rank alpha"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## transformer-09-05

title: "QLoRA"
status: pending
owner: ""
difficulty: "专家"
difficultyReason: "横跨运行时、编译器或分布式系统边界，必须拆成多个积木并完成源码级复现。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 100
granularity: "拆分专题"

## transformer-09-06

title: "prompt tuning"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## transformer-09-07

title: "DPO intuition"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## transformer-09-08

title: "reward model"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## transformer-09-09

title: "catastrophic forgetting"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## transformer-09-10

title: "safety evaluation"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"
