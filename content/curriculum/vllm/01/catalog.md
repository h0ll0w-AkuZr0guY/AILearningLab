---
track: "vllm"
id: "vllm-01"
order: 1
title: "01 · 推理服务的性能模型"
goal: "从 prefill/decode、吞吐/延迟、显存/带宽建立服务决策模型。"
lab: "计算不同请求形态下的 token 吞吐预算。"
interview: "为什么 decode 常常受 memory bandwidth 限制？"
officialScope: "https://docs.vllm.ai/"
sourceScope: "vllm/v1/core/sched/scheduler.py"
planningStatus: established
---

# 01 · 推理服务的性能模型

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

## vllm-01-01

title: "prefill 与 decode：V1 调度器为什么取消了阶段划分"
status: curated
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## vllm-01-02

title: "TTFT 与 TPOT：四段区间如何从事件时间戳算出来"
status: curated
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## vllm-01-03

title: "batching 权衡：token 预算、并发上限与抢占代价"
status: curated
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## vllm-01-04

title: "显存占用：gpu_memory_utilization 到底以什么为基数"
status: curated
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## vllm-01-05

title: "显存带宽：decode 为什么算不满 GPU"
status: curated
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## vllm-01-06

title: "request shape"
status: pending
owner: ""
difficulty: "简单"
difficultyReason: "核心规则较少，可通过一个最小实验直接观察，适合与相邻基础概念合并学习。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 25
granularity: "合并基础课"

## vllm-01-07

title: "SLO"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## vllm-01-08

title: "queueing"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## vllm-01-09

title: "throughput metric"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## vllm-01-10

title: "capacity model"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## vllm-01-11

title: "service baseline"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"
