---
track: "python"
id: "python-01"
order: 1
title: "01 · 对象与名称模型"
goal: "掌握“名称绑定对象”而非变量装盒子的执行模型。"
lab: "用 id、gc、sys.getrefcount 与 dis 建立可观察实验。"
interview: "可变默认参数、interning 与循环引用为何要分层解释？"
officialScope: "https://docs.python.org/3/"
sourceScope: "Include/object.h 与 Objects/object.c"
planningStatus: established
---

# 01 · 对象与名称模型

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

## python-01-01

title: "PyObject 头部与 ob_type"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "需要把 Python 对象模型映射到 C 结构体共同前缀、类型指针和 slot 分派，后续源码课会继续拆解具体字段。"
learningValue: "基础必修"
learningValueScore: 5
estimatedMinutes: 90
granularity: "拆分专题"

## python-01-02

title: "身份、相等与哈希契约"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "同时涉及 is、富比较双向分派、NotImplemented 与 dict 哈希查找不变量。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 75
granularity: "单点精讲"

## python-01-03

title: "名称绑定与 rebinding"
status: curated
owner: ""
difficulty: "简单"
difficultyReason: "核心是名称到对象的一条绑定规则，可与参数传递和作用域通过同一对象图实验掌握。"
learningValue: "基础必修"
learningValueScore: 5
estimatedMinutes: 35
granularity: "合并基础课"

## python-01-04

title: "可变对象的别名风险"
status: curated
owner: ""
difficulty: "中等"
difficultyReason: "规则本身直接，但要同时处理容器重复引用、浅拷贝和 API 所有权边界。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 50
granularity: "单点精讲"

## python-01-05

title: "小整数缓存与字符串驻留"
status: curated
owner: ""
difficulty: "中等"
difficultyReason: "两个优化都复用不可变对象，适合合并比较；难点在区分语言语义与 CPython 实现现象。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 40
granularity: "合并基础课"

## python-01-06

title: "引用计数的增减时机"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "要追踪 new、borrowed、stolen reference 与 DECREF 触发析构时的可重入路径。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 100
granularity: "拆分专题"

## python-01-07

title: "分代 GC 与循环检测"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "需要从对象图、内部引用扣减、可达性传播和代际成本模型复现循环检测。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 105
granularity: "拆分专题"

## python-01-08

title: "弱引用与 finalizer"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "弱所有权、回调重入、竞态窗口与确定性资源管理之间存在多重边界。"
learningValue: "高频核心"
learningValueScore: 4
estimatedMinutes: 70
granularity: "单点精讲"

## python-01-09

title: "浅拷贝、深拷贝与图"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "真正对象是可能共享并成环的图，必须理解 memo 如何同时保留拓扑并阻止递归。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 75
granularity: "单点精讲"

## python-01-10

title: "__slots__ 的布局影响"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "牵涉 member descriptor、实例内存布局、继承冲突、弱引用和框架反射兼容。"
learningValue: "进阶关键"
learningValueScore: 4
estimatedMinutes: 70
granularity: "单点精讲"

## python-01-11

title: "对象生命周期实验"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "综合引用计数、循环 GC、对象复活、weakref、tracemalloc 与 allocator 行为，需要多证据诊断。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 110
granularity: "拆分专题"
