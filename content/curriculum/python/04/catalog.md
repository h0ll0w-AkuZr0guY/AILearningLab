---
track: "python"
id: "python-04"
order: 4
title: "04 · 异常、资源与异步协议"
goal: "把异常视为携带因果链的控制流，连接可靠清理、await 与异步迭代协议。"
lab: "构造异常链、ExceptionGroup、同步/异步上下文管理器和可取消的异步生成器。"
interview: "raise from 解决什么诊断问题？finally 覆盖异常的条件？async generator 如何可靠关闭？"
officialScope: "https://docs.python.org/3.14/reference/executionmodel.html#exceptions"
sourceScope: "Python/ceval.c、Objects/exceptions.c、Objects/genobject.c、Lib/contextlib.py"
planningStatus: established
---

# 04 · 异常、资源与异步协议

## python-04-01
title: "异常控制流：匹配、traceback、raise、else 与 finally 的完成矩阵"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "捕获、重抛、return、break 与 finally 会竞争同一个控制流出口。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 110
granularity: "合并讲解"

## python-04-02
title: "异常因果与多失败：__context__、raise from、ExceptionGroup 与 except*"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "隐式因果、显式因果、抑制上下文和按子组处理并发失败必须精确区分。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 120
granularity: "合并讲解"

## python-04-03
title: "同步资源管理：with 展开、异常抑制、ExitStack 与所有权转移"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "__enter__/__exit__ 的返回值、部分获取失败和动态资源栈涉及不同的责任边界。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 100
granularity: "合并讲解"

## python-04-04
title: "await 协议：coroutine、awaitable、Future 与 async iterator 的驱动关系"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "语言 await、__await__ 迭代器、Future 回调与 StopAsyncIteration 的错误边界相互嵌套。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 120
granularity: "合并讲解"

## python-04-05
title: "异步资源生命周期：async with、async generator、背压、取消与 aclose"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "取消可以在 yield、await 和清理段注入，资源释放必须覆盖所有离开路径。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 120
granularity: "合并讲解"
