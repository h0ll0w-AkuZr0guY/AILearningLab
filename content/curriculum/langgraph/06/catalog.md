---
track: "langgraph"
id: "langgraph-06"
order: 6
title: "06 · 持久化与耐久执行"
goal: "为可恢复执行定义 checkpoint、副作用边界和幂等策略。"
lab: "实现订单查询工作流的 crash-resume 测试。"
interview: "重放时怎样避免重复支付？"
officialScope: "https://docs.langchain.com/oss/python/langgraph/overview"
sourceScope: "libs/langgraph/langgraph/types.py"
planningStatus: established
---

# 06 · 持久化与耐久执行

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

## langgraph-06-01

title: "checkpointer 接口"
status: pending
owner: ""
difficulty: "专家"
difficultyReason: "横跨运行时、编译器或分布式系统边界，必须拆成多个积木并完成源码级复现。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 100
granularity: "拆分专题"

## langgraph-06-02

title: "thread id"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## langgraph-06-03

title: "snapshot 与 history"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## langgraph-06-04

title: "interrupt 前状态"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 70
granularity: "单点精讲"

## langgraph-06-05

title: "resuming 语义"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## langgraph-06-06

title: "task queue 模式"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## langgraph-06-07

title: "幂等副作用"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## langgraph-06-08

title: "outbox pattern"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## langgraph-06-09

title: "durable task 边界"
status: pending
owner: ""
difficulty: "专家"
difficultyReason: "横跨运行时、编译器或分布式系统边界，必须拆成多个积木并完成源码级复现。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 100
granularity: "拆分专题"

## langgraph-06-10

title: "time travel 调试"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"
