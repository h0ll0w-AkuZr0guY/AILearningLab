---
track: "transformer"
id: "transformer-01"
order: 1
title: "01 · 线性代数与张量记号"
goal: "让每一个矩阵乘法都有形状、语义和计算复杂度。"
lab: "为 attention 全程标注 B、T、D、H 形状。"
interview: "为什么 shape bug 往往比公式 bug 更常见？"
officialScope: "https://pytorch.org/docs/stable/generated/torch.nn.MultiheadAttention.html"
sourceScope: "src/transformers/models"
planningStatus: established
---

# 01 · 线性代数与张量记号

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

## transformer-01-01

title: "标量向量矩阵"
status: curated
owner: ""
difficulty: "简单"
difficultyReason: "核心规则较少，可通过一个最小实验直接观察，适合与相邻基础概念合并学习。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 25
granularity: "合并基础课"

## transformer-01-02

title: "batch 维度"
status: curated
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## transformer-01-03

title: "einsum 记号"
status: curated
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## transformer-01-04

title: "矩阵乘法形状"
status: curated
owner: ""
difficulty: "简单"
difficultyReason: "核心规则较少，可通过一个最小实验直接观察，适合与相邻基础概念合并学习。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 25
granularity: "合并基础课"

## transformer-01-05

title: "broadcast 规则"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 70
granularity: "单点精讲"

## transformer-01-06

title: "范数与归一化"
status: curated
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## transformer-01-07

title: "softmax 性质"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 70
granularity: "单点精讲"

## transformer-01-08

title: "Jacobian 直觉"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "横跨运行时、编译器或分布式系统边界，必须拆成多个积木并完成源码级复现。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 100
granularity: "拆分专题"

## transformer-01-09

title: "计算复杂度"
status: curated
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## transformer-01-10

title: "数值稳定性"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "横跨运行时、编译器或分布式系统边界，必须拆成多个积木并完成源码级复现。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 100
granularity: "拆分专题"
