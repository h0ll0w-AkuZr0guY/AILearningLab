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

title: "请求形状：prompt 长度、max_tokens、priority 与到达时间如何决定一次调度的账本"
status: curated
owner: ""
difficulty: "中等"
difficultyReason: "需要把 Request 对象的一组字段（prompt 长度、max_tokens、priority、arrival_time、num_tokens_with_spec）映射到调度器的欠账与排序决策，并区分请求级字段与实例级配置的边界。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## vllm-01-07

title: "SLO 与 goodput：TTFT/TPOT/E2EL 目标如何在负载验收中被度量"
status: curated
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握 per-request metrics 的五个字段口径、goodput 的达标判定与负载生成参数（request-rate/burstiness/max-concurrency）之间的相互作用。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## vllm-01-08

title: "等待队列：FCFS 与 priority 队列、抢占回队与 skipped waiting"
status: curated
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握 deque 与 heap 两种队列的插入/弹出/回队语义、waiting 与 skipped_waiting 的选择规则，以及抢占后 prepend 的次序。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## vllm-01-09

title: "吞吐与延迟指标：prompt/generation token、TTFT/TPOT 直方图与 e2e 延迟的口径"
status: curated
owner: ""
difficulty: "中等"
difficultyReason: "需要区分计数器、仪表与直方图三类指标，并把 request 级时间戳事件（QUEUED/SCHEDULED/NEW_TOKENS）换算成四段区间与 TPOT 均值。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## vllm-01-10

title: "容量模型：KV cache 块数、watermark 与并发上限如何共同决定服务能力"
status: curated
owner: ""
difficulty: "中等"
difficultyReason: "需要把 gpu_memory_utilization、block_size、max_num_seqs、watermark 与 max_model_len 组合成可计算的容量方程，并解释 capacity-bound 与 prefill-bound 两种受限态。"
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
