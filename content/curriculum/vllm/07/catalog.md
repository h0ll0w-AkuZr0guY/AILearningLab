---
track: "vllm"
id: "vllm-07"
order: 7
title: "07 · LoRA、多 LoRA 与量化"
goal: "把 adapter 加载和 quantized base model 纳入 serving 资源模型。"
lab: "配置 multi-LoRA 路由与隔离测试。"
interview: "多 LoRA 如何影响 cache、调度和显存？"
officialScope: "https://docs.vllm.ai/"
sourceScope: "仓库根目录与 tests"
planningStatus: established
---

# 07 · LoRA、多 LoRA 与量化

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

## vllm-07-01

title: "LoRA request"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 70
granularity: "单点精讲"

## vllm-07-02

title: "adapter cache"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 70
granularity: "单点精讲"

## vllm-07-03

title: "multi LoRA"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 70
granularity: "单点精讲"

## vllm-07-04

title: "rank limit"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## vllm-07-05

title: "quantization formats"
status: pending
owner: ""
difficulty: "专家"
difficultyReason: "横跨运行时、编译器或分布式系统边界，必须拆成多个积木并完成源码级复现。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 100
granularity: "拆分专题"

## vllm-07-06

title: "AWQ GPTQ"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## vllm-07-07

title: "FP8 KV"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## vllm-07-08

title: "accuracy tradeoff"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## vllm-07-09

title: "hot swap"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## vllm-07-10

title: "tenant isolation"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## vllm-07-11

title: "metrics"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## vllm-07-12

title: "serving rebuild"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"
