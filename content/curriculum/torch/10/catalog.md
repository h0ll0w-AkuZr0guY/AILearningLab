---
track: "torch"
id: "torch-10"
order: 10
title: "10 · PyTorch 源码与扩展"
goal: "从 ATen dispatch、autograd engine 到 C++/CUDA extension 建立路线图。"
lab: "跟踪一个 aten 算子，并实现小型 C++ extension。"
interview: "dispatcher 如何选择 CPU、CUDA、Autograd kernel？"
officialScope: "https://pytorch.org/docs/stable/"
sourceScope: "仓库根目录与 tests"
planningStatus: established
---

# 10 · PyTorch 源码与扩展

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

## torch-10-01

title: "ATen tensor"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 70
granularity: "单点精讲"

## torch-10-02

title: "dispatcher keys"
status: pending
owner: ""
difficulty: "专家"
difficultyReason: "横跨运行时、编译器或分布式系统边界，必须拆成多个积木并完成源码级复现。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 100
granularity: "拆分专题"

## torch-10-03

title: "operator registration"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 70
granularity: "单点精讲"

## torch-10-04

title: "native functions"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 70
granularity: "单点精讲"

## torch-10-05

title: "autograd engine"
status: pending
owner: ""
difficulty: "专家"
difficultyReason: "横跨运行时、编译器或分布式系统边界，必须拆成多个积木并完成源码级复现。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 100
granularity: "拆分专题"

## torch-10-06

title: "TensorIterator"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 70
granularity: "单点精讲"

## torch-10-07

title: "C++ extension"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 70
granularity: "单点精讲"

## torch-10-08

title: "CUDA extension"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 70
granularity: "单点精讲"

## torch-10-09

title: "custom library op"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 70
granularity: "单点精讲"

## torch-10-10

title: "source build"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "进阶关键"
learningValueScore: 3
estimatedMinutes: 70
granularity: "单点精讲"
