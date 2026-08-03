---
track: "langchain"
id: "langchain-01"
order: 1
title: "01 · Core 抽象与消息契约"
goal: "建立 Message、Model、Prompt、Runnable 的最小抽象，并理解为什么它们可组合。"
lab: "手写 BaseMessage、ChatModel 和可串联 Runnable。"
interview: "为什么消息对象比裸字符串更适合 Agent 系统？"
officialScope: "https://docs.langchain.com/oss/python/langchain/overview"
sourceScope: "libs/core/langchain_core/messages、libs/core/langchain_core/runnables、libs/core/tests/unit_tests/runnables"
planningStatus: established
---

# 01 · Core 抽象与消息契约

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

## langchain-01-01

title: "消息角色与 content blocks"
status: curated
owner: ""
difficulty: "简单"
difficultyReason: "核心规则较少，可通过一个最小实验直接观察，适合与相邻基础概念合并学习。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "合并基础课"

## langchain-01-02

title: "BaseMessage 不变量"
status: curated
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"
## langchain-01-03

title: "ChatModel 输入输出"
status: curated
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## langchain-01-04

title: "Prompt 变量绑定"
status: curated
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## langchain-01-05

title: "Runnable invoke"
status: curated
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## langchain-01-06

title: "batch 与 stream"
status: curated
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## langchain-01-07

title: "config 传播"
status: curated
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## langchain-01-08

title: "callback 事件"
status: curated
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## langchain-01-09

title: "序列化边界"
status: curated
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## langchain-01-10

title: "错误语义"
status: curated
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## langchain-01-11

title: "同步异步双接口"
status: curated
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## langchain-01-12

title: "最小核心复现"
status: curated
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"
