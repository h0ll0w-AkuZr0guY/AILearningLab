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

合并记录：原 torch-02-06「expand 与 repeat」与模块 01 已精写的 torch-01-08「expand 与 repeat：零 stride 广播和真实物化」是同一课题，按合并处理并入 torch-01-08；模块 02 空出的最终课题改为「索引写回」，它是 torch-02-02 高级索引「读」路径的对偶「写」路径，官方文档与 `aten/src/ATen/native/TensorAdvancedIndexing.cpp` 都独立成章，且全站无覆盖。torch-02-10 只讲「一次调用如何选出 kernel」这一语义层；DispatchKey 全量枚举与自定义算子注册留给模块 10 的 torch-10-02、torch-10-03。

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

title: "index_put_ 与索引赋值：重复下标、accumulate 与内存重叠"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "写回路径要同时处理重复下标的未定义行为、accumulate 归约、self 与 index/value 的重叠断言和确定性开关。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 125
granularity: "单点精讲"

## torch-02-07

title: "in-place 约束：内存重叠断言、版本计数与叶子检查"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "一次原地写要先过 ATen 的重叠断言，再过 autograd 的叶子、视图与版本计数三道门，报错分属不同层。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 120
granularity: "单点精讲"

## torch-02-08

title: "type promotion：三桶归并如何决定结果 dtype"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "结果类型由有维张量、零维张量、包装标量三个桶分别提升再按类别合并，且不看数值，与直觉和 NumPy 都不同。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 115
granularity: "单点精讲"

## torch-02-09

title: "einsum：下标方程降解为 diagonal、permute 与 bmm"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "要把方程解析、重复下标取对角、省略号广播与成对收缩降解到 bmm 的完整流水线连起来推导。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 120
granularity: "单点精讲"

## torch-02-10

title: "operator dispatch：DispatchKeySet 如何为一次调用选出 kernel"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "需要把张量键集合、线程局部包含/排除集、fallthrough 掩码、优先级取位与逐层 redispatch 串成一次真实调用链。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 150
granularity: "单点精讲"
