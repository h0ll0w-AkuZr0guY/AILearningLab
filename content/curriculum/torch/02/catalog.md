---
track: "torch"
id: "torch-02"
order: 2
title: "02 · 索引、广播与算子语义"
goal: "精确把握 indexing 产生 view 还是 copy，以及 broadcast 的梯度聚合。"
lab: "实现复杂索引并用 data_ptr 验证别名。"
interview: "broadcast backward 为什么需要 reduce？"
officialScope: "https://pytorch.org/docs/stable/"
sourceScope: "aten/src/ATen"
planningStatus: established
---

# 02 · 索引、广播与算子语义

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

## torch-02-01

title: "basic indexing"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "需将整数、slice 与地址仿射变换连到 alias、offset、降维和写传播。"
learningValue: "基础必修"
learningValueScore: 5
estimatedMinutes: 120
granularity: "单点精讲"

## torch-02-02

title: "advanced indexing"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "多个 LongTensor 索引会先广播、再共同迭代并物化 gather 结果。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 125
granularity: "单点精讲"

## torch-02-03

title: "boolean mask"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "mask 会改变输出长度并映射到 nonzero/gather 或 scatter。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 120
granularity: "单点精讲"

## torch-02-04

title: "ellipsis None"
status: curated
owner: ""
difficulty: "中等"
difficultyReason: "两个 token 会改变消费维度和输出 rank，混入 tensor index 时需要分层推导。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 110
granularity: "合并基础课"

## torch-02-05

title: "broadcast alignment"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "需从尾维对齐、零 stride 视图、反向 reduce 与原地限制一起推导。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 125
granularity: "单点精讲"

## torch-02-06

title: "expand 与 repeat"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## torch-02-07

title: "in-place 约束"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## torch-02-08

title: "type promotion"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## torch-02-09

title: "einsum"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## torch-02-10

title: "operator dispatch"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"
