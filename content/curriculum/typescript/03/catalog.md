---
track: "typescript"
id: "typescript-03"
order: 3
title: "03 · 控制流分析与窄化"
goal: "理解 checker 如何沿路径积累事实、又在哪些地方放弃事实。"
lab: "实现可辨识联合状态机和 exhaustive matcher。"
interview: "赋值后 narrowing 为什么会失效？"
officialScope: "https://www.typescriptlang.org/docs/"
sourceScope: "src/compiler/checker.ts"
planningStatus: established
---

# 03 · 控制流分析与窄化

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

## typescript-03-01

title: "typeof narrowing"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 45
granularity: "单点精讲"

## typescript-03-02

title: "instanceof narrowing"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 45
granularity: "单点精讲"

## typescript-03-03

title: "in 操作符"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## typescript-03-04

title: "truthiness 陷阱"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## typescript-03-05

title: "discriminated union"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## typescript-03-06

title: "never exhaustiveness"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## typescript-03-07

title: "user type predicate"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## typescript-03-08

title: "assertion function"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## typescript-03-09

title: "alias control flow"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## typescript-03-10

title: "闭包中的收窄丢失"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 70
granularity: "单点精讲"
