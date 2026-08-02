---
track: "python"
id: "python-01"
order: 1
title: "01 · 对象、身份与序列"
goal: "从语言层对象合同进入 CPython 的布局、所有权与序列容量模型，能区分值、身份、地址和可达性。"
lab: "用 ctypes、gc、sys 与离线断言观察对象头、比较分派、循环回收、对象复用和 list 容量。"
interview: "相等与 hash 为什么绑定？循环引用为何需要 GC？tuple 的不可变边界到底在哪里？"
officialScope: "https://docs.python.org/3.14/reference/datamodel.html#objects-values-and-types"
sourceScope: "Include/object.h、Objects/object.c、Python/gc.c、Objects/longobject.c、Objects/listobject.c、Objects/tupleobject.c"
planningStatus: established
---

# 01 · 对象、身份与序列

五个课题以同一对象模型逐层增加机制：共同头部给出解释入口，身份与 hash 给出比较合同，引用与 GC 给出生命周期，静态复用给出实现边界，序列布局给出容量与可变性。它们分别拥有不同的可观察失败路径，不能再压成“Python 对象基础”一课。

## python-01-01

title: "PyObject 头部与 ob_type：CPython 对象模型的共同入口"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "需要把语言对象合同映射到 C 共同前缀、类型指针、ABI 边界与构建差异。"
learningValue: "基础必修"
learningValueScore: 5
estimatedMinutes: 90
granularity: "拆分专题"

## python-01-02

title: "身份、相等与哈希：is/id 的地址语义与 __eq__/__hash__ 契约"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "必须同时推演身份、富比较回退、NotImplemented 与 dict 不变量，并区分语言与 CPython slot。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 90
granularity: "拆分专题"

## python-01-03

title: "引用计数、分代 GC 与循环引用：内存管理的双保险"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "引用计数、循环可达性、代际触发、finalizer 与不同构建的收集边界必须联动解释。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 90
granularity: "拆分专题"

## python-01-04

title: "小整数池与 interned 字符串：CPython 的静态对象缓存"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "需要区分语言的值语义、显式 sys.intern 合同、编译器折叠与 CPython static-object 路径。"
learningValue: "专项拓展"
learningValueScore: 4
estimatedMinutes: 90
granularity: "单点精讲"

## python-01-05

title: "列表与元组内部：PyListObject 的 over-allocate 与 PyTupleObject 的不可变性"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "要把列表两层指针存储、容量公式、批量增长、tuple 尾部布局、浅拷贝与并发边界放在一起推演。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 90
granularity: "拆分专题"
