---
track: "langchain"
id: "langchain-06"
order: 6
title: "06 · Middleware 与横切能力"
goal: "将日志、重试、限额、安全与模型选择从业务节点剥离。"
lab: "实现 before/after/wrap_model/wrap_tool hooks。"
interview: "为什么 middleware 比在 agent 内塞 if/else 更可维护？"
officialScope: "https://docs.langchain.com/oss/python/langchain/overview"
sourceScope: "libs/langchain/langchain/agents/middleware"
planningStatus: established
---

# 06 · Middleware 与横切能力

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

## langchain-06-01

title: "hook ordering"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## langchain-06-02

title: "request context"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## langchain-06-03

title: "response transform"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## langchain-06-04

title: "tool wrapping"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 45
granularity: "单点精讲"

## langchain-06-05

title: "model selection"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## langchain-06-06

title: "rate limit"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## langchain-06-07

title: "PII redaction"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## langchain-06-08

title: "HITL middleware"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 70
granularity: "单点精讲"

## langchain-06-09

title: "summarization"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## langchain-06-10

title: "fallback"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## langchain-06-11

title: "cost guard"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## langchain-06-12

title: "custom middleware"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 70
granularity: "单点精讲"
