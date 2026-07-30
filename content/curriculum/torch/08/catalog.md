---
track: "torch"
id: "torch-08"
order: 8
title: "08 · Distributed 与并行训练"
goal: "从 process group、all-reduce 到 DDP/FSDP 的梯度同步模型。"
lab: "将单卡训练改成最小 DDP 并验证等价性。"
interview: "DDP 为什么要求每个进程一张 GPU？"
officialScope: "https://pytorch.org/docs/stable/"
sourceScope: "仓库根目录与 tests"
planningStatus: established
---

# 08 · Distributed 与并行训练

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

## torch-08-01

title: "process group"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 70
granularity: "单点精讲"

## torch-08-02

title: "rank world size"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 70
granularity: "单点精讲"

## torch-08-03

title: "all reduce"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 70
granularity: "单点精讲"

## torch-08-04

title: "DDP reducer"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 70
granularity: "单点精讲"

## torch-08-05

title: "gradient bucket"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 70
granularity: "单点精讲"

## torch-08-06

title: "DistributedSampler"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 70
granularity: "单点精讲"

## torch-08-07

title: "FSDP sharding"
status: pending
owner: ""
difficulty: "专家"
difficultyReason: "横跨运行时、编译器或分布式系统边界，必须拆成多个积木并完成源码级复现。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 100
granularity: "拆分专题"

## torch-08-08

title: "activation checkpoint"
status: pending
owner: ""
difficulty: "专家"
difficultyReason: "横跨运行时、编译器或分布式系统边界，必须拆成多个积木并完成源码级复现。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 100
granularity: "拆分专题"

## torch-08-09

title: "tensor parallel"
status: pending
owner: ""
difficulty: "专家"
difficultyReason: "横跨运行时、编译器或分布式系统边界，必须拆成多个积木并完成源码级复现。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 100
granularity: "拆分专题"

## torch-08-10

title: "fault tolerance"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 70
granularity: "单点精讲"
