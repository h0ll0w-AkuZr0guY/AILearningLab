---
track: "langgraph"
id: "langgraph-01"
order: 1
title: "01 · Graph 思维与执行模型"
goal: "先厘清节点、边、状态、super-step 和副作用的边界。"
lab: "用假节点搭建可重复的图执行实验。"
interview: "为什么 Agent 不能被当作普通函数链？"
officialScope: "https://docs.langchain.com/oss/python/langgraph/overview"
sourceScope: "libs/langgraph/langgraph/graph"
planningStatus: established
---

# 01 · Graph 思维与执行模型

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

## langgraph-01-01

title: "函数链为何不足：显式图、状态机与执行日志边界"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "需要从循环、并发、暂停恢复和失败重放推导何时必须把控制流外显，同时区分图定义、运行状态、运行时上下文与外部副作用。"
learningValue: "基础必修"
learningValueScore: 5
estimatedMinutes: 145
granularity: "合并精讲"

## langgraph-01-02

title: "StateGraph Builder 与 compile：从 schema 到 CompiledStateGraph"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "compile 会把 schema、channel、node、edge、branch、interrupt、checkpointer 和 store 编译成 Pregel 运行时对象；需要沿多个真实源码函数追踪。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 190
granularity: "拆分专题"

## langgraph-01-03

title: "Pregel super-step：Plan、Execute、Update 与 BSP barrier"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "同一 super-step 的任务读取旧快照、并发产生不可见写入，barrier 后再确定性归并并触发下一步；错误、停机和递归上限又跨越循环状态。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 200
granularity: "拆分专题"

## langgraph-01-04

title: "START、END 与静态边：入口、终止、fan-out 和 join"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "START/END 是编译哨兵而非普通业务节点；单边、并行 fan-out、多起点 join 分别编译成触发 channel、写入和 barrier，需用时间线验证。"
learningValue: "基础必修"
learningValueScore: 5
estimatedMinutes: 160
granularity: "单点精讲"

## langgraph-01-05

title: "节点执行契约：Runnable、同步/异步、返回更新与副作用"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "普通函数会被适配为 Runnable，并按签名注入 state、config、runtime；同步/异步调用矩阵、部分更新、超时取消和幂等副作用需要统一设计。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 195
granularity: "拆分专题"

## langgraph-01-06

title: "状态快照与执行元数据：values、tasks、next 与 config"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "快照同时描述 channel values、待执行 tasks、下一节点和线程配置，必须区分业务 state、调度元数据与 checkpoint identity。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 145
granularity: "拆分专题"

## langgraph-01-07

title: "可重放执行：checkpoint、pending writes 与恢复边界"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "恢复并非从头重跑；成功任务写入、失败任务、interrupt、resume 和 checkpoint 版本共同决定哪些操作复用、哪些重新执行。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 190
granularity: "拆分专题"

## langgraph-01-08

title: "确定性：reducer 顺序、任务排序与外部 I/O"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "运行时可排序任务与归并写入，但随机数、时间、模型调用和外部系统仍会破坏可重放性；需要事件记录与幂等键共同收敛。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 175
granularity: "拆分专题"

## langgraph-01-09

title: "拓扑验证与迁移：孤立节点、循环和 interrupt 兼容"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "编译验证只覆盖可静态证明的结构错误；带持久线程的节点改名、删除、状态键变更和中断位置会形成迁移约束。"
learningValue: "工程扩展"
learningValueScore: 4
estimatedMinutes: 145
granularity: "单点精讲"

## langgraph-01-10

title: "递归限制、停机条件与生产保护"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "循环是合法控制流，但必须同时设计语义停机、RemainingSteps、外部 deadline、取消和部分结果，避免把 recursion_limit 当业务规则。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 150
granularity: "单点精讲"
