---
track: "python"
id: "python-05"
order: 5
title: "05 · 异常与上下文管理"
goal: "把异常视为非局部控制流，并处理清理与异常链。"
lab: "实现事务 context manager，覆盖 commit、rollback 与 suppress。"
interview: "finally 中 return 为什么危险？"
officialScope: "https://docs.python.org/3/"
sourceScope: "Python/errors.c 与 Lib/contextlib.py"
planningStatus: established
---

# 05 · 异常与上下文管理

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

## python-05-01

title: "异常对象、traceback 链与处理器生命周期"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "异常对象反向持有 traceback、frame 与 locals；还要理解 except target 自动删除和 sys.exception 的嵌套恢复。"
learningValue: "基础必修"
learningValueScore: 5
estimatedMinutes: 75
granularity: "单点精讲"

## python-05-02

title: "异常匹配、层级设计与捕获边界"
status: curated
owner: ""
difficulty: "中等"
difficultyReason: "规则集中在类层级与从上到下首次匹配，但库 API 还需设计可操作的异常分类和禁止吞掉 BaseException。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 55
granularity: "合并基础课"

## python-05-03

title: "raise、bare raise 与 traceback 保真"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "raise、raise exc、with_traceback 会产生不同栈形状，直接影响诊断、包装器和跨层重抛。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 70
granularity: "单点精讲"

## python-05-04

title: "__context__、__cause__ 与 raise from"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "要区分隐式处理上下文、显式因果链和仅隐藏显示的 from None，才能安全做领域异常翻译。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 70
granularity: "单点精讲"

## python-05-05

title: "try/except/else/finally 的控制流矩阵"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "return、break、continue、异常和新异常都要穿过 finally；其完成原因覆盖规则必须用矩阵验证。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 105
granularity: "拆分专题"

## python-05-06

title: "ExceptionGroup、except* 与并发多失败"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "处理器按类型递归拆分组、并行运行语义后再合并未处理与新异常，不能用普通 except 心智模型推演。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 110
granularity: "拆分专题"

## python-05-07

title: "with 展开、特殊方法查找与异常抑制"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "需要完整展开 enter/exit、异常三元组、truthy suppression、多项嵌套顺序和类型级特殊方法查找。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 85
granularity: "单点精讲"

## python-05-08

title: "ExitStack：动态资源、部分获取与所有权转移"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "动态数量资源要求 LIFO 回滚、enter 中途失败、回调抑制/替换异常以及 pop_all 所有权转移。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 110
granularity: "拆分专题"

## python-05-09

title: "async with、取消与可靠异步清理"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "清理本身可以 await，也可能再次被取消；必须区分资源所有者、屏蔽范围、超时和聚合清理失败。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 115
granularity: "拆分专题"
