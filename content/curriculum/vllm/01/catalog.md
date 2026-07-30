---
track: "vllm"
id: "vllm-01"
order: 1
title: "01 · 推理服务的性能模型"
goal: "从 prefill/decode、吞吐/延迟、显存/带宽建立服务决策模型。"
lab: "计算不同请求形态下的 token 吞吐预算。"
interview: "为什么 decode 常常受 memory bandwidth 限制？"
officialScope: "https://docs.vllm.ai/"
sourceScope: "vllm/core/scheduler.py"
planningStatus: established
---

# 01 · 推理服务的性能模型

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

## vllm-01-01

title: "prefill decode"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## vllm-01-02

title: "TTFT TPOT"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## vllm-01-03

title: "batching tradeoff"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## vllm-01-04

title: "GPU occupancy"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## vllm-01-05

title: "memory bandwidth"
status: pending
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
