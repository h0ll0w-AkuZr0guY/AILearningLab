---
track: "python"
id: "python-03"
order: 3
title: "03 · 函数、闭包与装饰器"
goal: "理解 code object、cell、调用约定和装饰器对签名的影响。"
lab: "实现带参数装饰器并保留 introspection 信息。"
interview: "闭包为什么会产生 late binding，如何从 cell 解释？"
officialScope: "https://docs.python.org/3/"
sourceScope: "Objects/funcobject.c"
planningStatus: established
---

# 03 · 函数、闭包与装饰器

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

## python-03-01

title: "函数对象：code、globals、defaults 与 closure"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "函数是代码与定义环境的组合，需要区分运行时值、编译产物和闭包绑定分别存放在哪里。"
learningValue: "基础必修"
learningValueScore: 5
estimatedMinutes: 75
granularity: "单点精讲"

## python-03-02

title: "code object、常量表与名称表"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "要从 co_code、co_consts、co_names 和 dis 指令重建无上下文的编译结果。"
learningValue: "进阶关键"
learningValueScore: 4
estimatedMinutes: 70
granularity: "单点精讲"

## python-03-03

title: "frame、fast locals 与局部变量同步"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "横跨 frame 布局、LOAD_FAST、locals() 快照语义和调试器同步，适合拆分源码专题。"
learningValue: "进阶关键"
learningValueScore: 4
estimatedMinutes: 100
granularity: "拆分专题"

## python-03-04

title: "closure cell、cellvars 与 freevars"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "必须连接编译期名称分类、运行时 cell 身份与 LOAD_DEREF/STORE_DEREF。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 80
granularity: "单点精讲"

## python-03-05

title: "late binding 与默认参数早绑定"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "两个现象共享定义时机与调用时机的对比，合并后更容易解释循环闭包的正确修复边界。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 70
granularity: "合并基础课"

## python-03-06

title: "参数绑定：positional-only、keyword-only、*args 与 **kwargs"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "调用要处理五类参数、重复赋值、缺失参数和默认值，适合用 Signature.bind 复现完整矩阵。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 80
granularity: "单点精讲"

## python-03-07

title: "装饰器求值、应用顺序与带参装饰器"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "要区分 decorator expression 的定义期求值顺序和 wrapper 的自下而上应用顺序。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 75
granularity: "单点精讲"

## python-03-08

title: "functools.wraps、__wrapped__ 与签名保真"
status: curated
owner: ""
difficulty: "中等"
difficultyReason: "机制集中在元数据复制和 __wrapped__ 链，可通过 inspect.signature 与缓存键失败案例验证。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 50
granularity: "单点精讲"
