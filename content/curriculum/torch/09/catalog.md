---
track: "torch"
id: "torch-09"
order: 9
title: "09 · torch.compile 与图捕获"
goal: "理解 Dynamo、AOTAutograd、Inductor 及 graph break 的约束。"
lab: "定位 graph break，重构后比较吞吐。"
interview: "Python side effect 为什么会破坏捕获？"
officialScope: "https://pytorch.org/docs/stable/"
sourceScope: "仓库根目录与 tests"
planningStatus: established
---

# 09 · torch.compile 与图捕获

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

## torch-09-01

title: "torch.compile modes"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 70
granularity: "单点精讲"

## torch-09-02

title: "Dynamo guards"
status: pending
owner: ""
difficulty: "专家"
difficultyReason: "横跨运行时、编译器或分布式系统边界，必须拆成多个积木并完成源码级复现。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 100
granularity: "拆分专题"

## torch-09-03

title: "graph break"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 70
granularity: "单点精讲"

## torch-09-04

title: "AOTAutograd"
status: pending
owner: ""
difficulty: "专家"
difficultyReason: "横跨运行时、编译器或分布式系统边界，必须拆成多个积木并完成源码级复现。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 100
granularity: "拆分专题"

## torch-09-05

title: "Inductor fusion"
status: pending
owner: ""
difficulty: "专家"
difficultyReason: "横跨运行时、编译器或分布式系统边界，必须拆成多个积木并完成源码级复现。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 100
granularity: "拆分专题"

## torch-09-06

title: "dynamic shapes"
status: pending
owner: ""
difficulty: "简单"
difficultyReason: "核心规则较少，可通过一个最小实验直接观察，适合与相邻基础概念合并学习。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 25
granularity: "合并基础课"

## torch-09-07

title: "fake tensor"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 70
granularity: "单点精讲"

## torch-09-08

title: "backend selection"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 70
granularity: "单点精讲"

## torch-09-09

title: "debug logs"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 70
granularity: "单点精讲"

## torch-09-10

title: "compile cache"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 70
granularity: "单点精讲"
