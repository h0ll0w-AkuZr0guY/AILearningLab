---
track: "transformer"
id: "transformer-10"
order: 10
title: "10 · 从零实现 Mini-GPT"
goal: "将 tokenizer、模型、训练、checkpoint、sampling 组成可验证闭环。"
lab: "完成字符级 GPT 并写一页架构复盘。"
interview: "训练和推理阶段每一层的张量形状是什么？"
officialScope: "https://pytorch.org/docs/stable/generated/torch.nn.MultiheadAttention.html"
sourceScope: "仓库根目录与 tests"
planningStatus: established
---

# 10 · 从零实现 Mini-GPT

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

## transformer-10-01

title: "config design"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## transformer-10-02

title: "embedding module"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 45
granularity: "单点精讲"

## transformer-10-03

title: "attention module"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 70
granularity: "单点精讲"

## transformer-10-04

title: "block stack"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## transformer-10-05

title: "lm head"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## transformer-10-06

title: "training loop"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## transformer-10-07

title: "checkpoint resume"
status: pending
owner: ""
difficulty: "专家"
difficultyReason: "横跨运行时、编译器或分布式系统边界，必须拆成多个积木并完成源码级复现。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 100
granularity: "拆分专题"

## transformer-10-08

title: "sampling API"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## transformer-10-09

title: "unit tests"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## transformer-10-10

title: "scaling diagnosis"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"
