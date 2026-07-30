---
track: "torch"
id: "torch-04"
order: 4
title: "04 · 自定义 Autograd 与数值验证"
goal: "实现 Function 时保存最小上下文，并用 gradcheck 验证导数。"
lab: "手写 Swish 或 LayerNorm 的 forward/backward。"
interview: "in-place 为什么会触发 version counter 错误？"
officialScope: "https://pytorch.org/docs/stable/"
sourceScope: "torch/nn"
planningStatus: established
---

# 04 · 自定义 Autograd 与数值验证

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

## torch-04-01

title: "torch.autograd.Function"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 45
granularity: "单点精讲"

## torch-04-02

title: "ctx save_for_backward"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## torch-04-03

title: "forward backward"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## torch-04-04

title: "double backward"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## torch-04-05

title: "gradcheck"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 70
granularity: "单点精讲"

## torch-04-06

title: "gradgradcheck"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 70
granularity: "单点精讲"

## torch-04-07

title: "version counter"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## torch-04-08

title: "anomaly detection"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## torch-04-09

title: "detach"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## torch-04-10

title: "custom op boundary"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"
