---
track: "python"
id: "python-07"
order: 7
title: "07 · 性能、内存与诊断"
goal: "用可重复证据区分算法、数据结构、解释器、分配器和外部 I/O 造成的性能问题。"
lab: "为同一工作负载采集 pyperf、cProfile、采样栈、tracemalloc、gc 和并行诊断证据。"
interview: "基准为何会骗你？RSS 与 Python 对象内存有何不同？何时 list 应换 deque？"
officialScope: "https://docs.python.org/3.14/library/profile.html"
sourceScope: "Objects/dictobject.c、Objects/listobject.c、Modules/_tracemalloc.c、Python/specialize.c"
planningStatus: established
---

# 07 · 性能、内存与诊断

## python-07-01
title: "数据结构与复杂度：list、deque、dict、set 的工作负载选择"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "渐进复杂度、容量布局、探测冲突和操作分布必须回到具体工作负载。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 100
granularity: "合并讲解"

## python-07-02
title: "可重复基准：timeit、pyperf、预热、噪声、效应量与回归阈值"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "解释器预热、操作系统噪声和统计置信度决定数字是否能支持工程决策。"
learningValue: "工程必修"
learningValueScore: 5
estimatedMinutes: 100
granularity: "单点精讲"

## python-07-03
title: "CPU 诊断：cProfile 调用图、采样栈、flame graph 与 I/O 盲区"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "确定性统计和采样观测存在不同偏差，阻塞 I/O 又可能不在 Python 调用图中。"
learningValue: "工程必修"
learningValueScore: 5
estimatedMinutes: 100
granularity: "合并讲解"

## python-07-04
title: "内存诊断：tracemalloc、gc、对象图、free list 与 RSS 的证据分层"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "分配点、对象可达性、解释器缓存和操作系统驻留内存的因果链不相同。"
learningValue: "工程必修"
learningValueScore: 5
estimatedMinutes: 120
granularity: "合并讲解"

## python-07-05
title: "解释器与并行性能：dis、inline cache、specialization、GIL 与 free-threading 边界"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "字节码特化、失特化、GIL 释放点和构建模式必须与测量证据一起解释。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 120
granularity: "合并讲解"
