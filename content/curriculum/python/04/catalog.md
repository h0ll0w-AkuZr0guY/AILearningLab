---
track: "python"
id: "python-04"
order: 4
title: "04 · 迭代、生成器与协程"
goal: "统一 iterator protocol、generator frame、send/throw 和 await。"
lab: "手写可暂停解析器，再把它改造成 async generator。"
interview: "yield from 如何传递返回值与异常？"
officialScope: "https://docs.python.org/3/"
sourceScope: "Objects/genobject.c 与 Python/ceval.c"
planningStatus: established
---

# 04 · 迭代、生成器与协程

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

## python-04-01

title: "Iterable、Iterator 与 __getitem__ 兼容路径"
status: curated
owner: ""
difficulty: "中等"
difficultyReason: "公开协议很小，但要区分可重复 iterable、一次性 iterator，并理解 CPython 为旧式序列保留的索引回退。"
learningValue: "基础必修"
learningValueScore: 5
estimatedMinutes: 50
granularity: "合并基础课"

## python-04-02

title: "迭代耗尽、StopIteration 与 PEP 479"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "需要分清协议结束信号、生成器 return value、意外 StopIteration 转 RuntimeError 以及 C API 的三态返回。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 80
granularity: "单点精讲"

## python-04-03

title: "生成器函数、惰性启动与对象状态"
status: curated
owner: ""
difficulty: "中等"
difficultyReason: "核心是调用只创建 generator，首次 next 才执行；结合 inspect 状态与一次性耗尽即可完整观察。"
learningValue: "基础必修"
learningValueScore: 5
estimatedMinutes: 50
granularity: "合并基础课"

## python-04-04

title: "暂停帧：指令指针、值栈与异常状态"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "要把 yield 映射到 frame 状态、指令恢复点、局部变量、值栈和异常栈保存，适合独立源码复现。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 110
granularity: "拆分专题"

## python-04-05

title: "send 注入值与生成器预激"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "需要同时解释 yield 的产出值和表达式结果、初始暂停点限制及双向协议的时序。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 70
granularity: "单点精讲"

## python-04-06

title: "throw、close、GeneratorExit 与清理"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "异常从暂停点注入，close 还会沿委派链传播；忽略 GeneratorExit 会破坏资源清理契约。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 100
granularity: "拆分专题"

## python-04-07

title: "yield from 委派状态机与返回值通道"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "yield from 同时转发 next、send、throw、close，并把子生成器 StopIteration.value 变为表达式结果，必须逐分支复现。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 120
granularity: "拆分专题"

## python-04-08

title: "contextmanager：单次 yield 与异常回注"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "一个 yield 被解释为 enter/exit 分界，with 块异常通过 throw 回注，恰好一次 yield 的约束需要实现验证。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 80
granularity: "单点精讲"

## python-04-09

title: "awaitable 与 __await__ 迭代协议"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "await 是专用于异步运行时的委派协议；要连接 coroutine、__await__ iterator、Future 驱动和不可重复 await。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 105
granularity: "拆分专题"

## python-04-10

title: "异步迭代：__aiter__、__anext__ 与 StopAsyncIteration"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "协议形似同步迭代，但 __anext__ 返回 awaitable，终止异常独立，资源结束还可能需要显式 aclose。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 80
granularity: "单点精讲"

## python-04-11

title: "异步生成器的背压、取消与 aclose"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "要从一次 anext 请求驱动一次产出解释自然背压，并处理取消在暂停点注入、finally 清理和并发驱动保护。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 110
granularity: "拆分专题"
