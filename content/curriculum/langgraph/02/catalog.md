---
track: "langgraph"
id: "langgraph-02"
order: 2
title: "02 · State、Reducer 与消息"
goal: "理解状态 schema、reducer 与消息累积的可组合契约。"
lab: "为客服图建立消息与订单状态 reducer。"
interview: "为什么不能随意覆盖共享 state？"
officialScope: "https://docs.langchain.com/oss/python/langgraph/overview"
sourceScope: "libs/langgraph/langgraph/graph/message.py"
planningStatus: established
---

# 02 · State、Reducer 与消息

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

## langgraph-02-01

title: "TypedDict state"
status: curated
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 45
granularity: "单点精讲"

## langgraph-02-02

title: "MessagesState"
status: curated
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 45
granularity: "单点精讲"

## langgraph-02-03

title: "Annotated reducer"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 70
granularity: "单点精讲"

## langgraph-02-04

title: "append 与 replace"
status: curated
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "单点精讲"

## langgraph-02-05

title: "自定义 reducer"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 70
granularity: "单点精讲"

## langgraph-02-06

title: "消息 ID"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "需要同时推演消息身份、原位替换、删除失败、回放稳定性与工具消息引用边界。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 90
granularity: "单点精讲"

## langgraph-02-07

title: "状态迁移"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "人工 state 编辑同时涉及 checkpoint 版本、reducer、as_node 因果位置、下一步调度和并发冲突。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 90
granularity: "单点精讲"

## langgraph-02-08

title: "不可变思维"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "需要跨越 Python 引用别名、super-step 隔离、纯 reducer、重试回放和大对象所有权。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 90
granularity: "单点精讲"

## langgraph-02-09

title: "schema 演进"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "恢复旧 checkpoint 要同时处理字段/node 兼容、迁移纯度、在途线程和可回滚部署窗口。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 90
granularity: "单点精讲"

## langgraph-02-10

title: "state 校验"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "需区分图配置、数据形状与业务不变量，并将 schema/reducer 约束连接到运行时错误处置。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 90
granularity: "单点精讲"
