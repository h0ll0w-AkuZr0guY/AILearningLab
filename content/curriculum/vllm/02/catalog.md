---
track: "vllm"
id: "vllm-02"
order: 2
title: "02 · PagedAttention 与 KV Cache"
goal: "理解 KV cache 的块化管理为何能降低碎片与浪费。"
lab: "手写 block table 模拟器并测算浪费率。"
interview: "PagedAttention 借鉴了虚拟内存的什么思想？"
officialScope: "https://docs.vllm.ai/"
sourceScope: "vllm/v1/core/kv_cache_manager.py"
planningStatus: established
---

# 02 · PagedAttention 与 KV Cache

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

## vllm-02-01

title: "KV cache layout"
status: pending
owner: ""
difficulty: "专家"
difficultyReason: "横跨运行时、编译器或分布式系统边界，必须拆成多个积木并完成源码级复现。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 100
granularity: "拆分专题"

## vllm-02-02

title: "block size"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## vllm-02-03

title: "block table"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## vllm-02-04

title: "logical physical block"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## vllm-02-05

title: "fragmentation"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 70
granularity: "单点精讲"

## vllm-02-06

title: "sharing"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## vllm-02-07

title: "copy on write"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 70
granularity: "单点精讲"

## vllm-02-08

title: "prefix cache"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 70
granularity: "单点精讲"

## vllm-02-09

title: "eviction"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## vllm-02-10

title: "cache metric"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## vllm-02-11

title: "paged attention rebuild"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 70
granularity: "单点精讲"
