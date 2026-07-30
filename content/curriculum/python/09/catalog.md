---
track: "python"
id: "python-09"
order: 9
title: "09 · 性能、内存与诊断"
goal: "以 profiling 证据定位瓶颈，区分算法、解释器与 IO。"
lab: "对一个慢 API 做 cProfile、tracemalloc 与 line profile 诊断。"
interview: "GIL 限制的究竟是哪类并行？"
officialScope: "https://docs.python.org/3/"
sourceScope: "Python/specialize.c"
planningStatus: established
---

# 09 · 性能、内存与诊断

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

## python-09-01

title: "复杂度模型、常数项与真实工作负载"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "渐近复杂度只描述规模趋势，真实瓶颈还受数据分布、缓存局部性、分配、解释器开销和 I/O 等待影响。"
learningValue: "基础必修"
learningValueScore: 5
estimatedMinutes: 80
granularity: "单点精讲"

## python-09-02

title: "list、deque 与紧凑/分块存储取舍"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "要从过量分配、连续指针数组、块链表、缓存局部性和两端操作推导性能，而非背复杂度表。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 85
granularity: "单点精讲"

## python-09-03

title: "dict 紧凑布局、探测序列与哈希冲突"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "包含稀疏 indices、紧凑 entries、开放寻址、扰动探测、删除 dummy、resize 与相等比较失败路径。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 120
granularity: "拆分专题"

## python-09-04

title: "可重复基准：timeit、pyperf、噪声与效应量"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "热身、specialization、CPU 频率、GC、输入构造和统计汇总都会制造假优化，需要实验设计而非单次计时。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 90
granularity: "单点精讲"

## python-09-05

title: "cProfile、pstats 与确定性调用图"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "要区分 primitive/total calls、tottime/cumtime、调用者/被调用者，并理解 instrumentation overhead 和异步等待误读。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 90
granularity: "单点精讲"

## python-09-06

title: "采样 profiler、火焰图与生产诊断"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "采样概率、栈聚合、off-CPU 时间、原生帧与短函数漏采决定证据边界，需与 tracing profiler 互补。"
learningValue: "进阶关键"
learningValueScore: 4
estimatedMinutes: 85
granularity: "单点精讲"

## python-09-07

title: "tracemalloc 快照、对象存活与 RSS 分离"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "Python allocator trace、对象图存活、arena/系统 allocator 保留、C 扩展内存与进程 RSS 是不同层次。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 110
granularity: "拆分专题"

## python-09-08

title: "dis、inline cache 与 specializing interpreter"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "需要连接基础 bytecode、quickening、guard、specialized opcode、deopt 与 workload 稳定性，且版本差异很大。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 115
granularity: "拆分专题"

## python-09-09

title: "GIL、释放点、free-threading 与线程安全"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "传统 GIL 只串行化解释器执行；C 扩展可释放，3.13+ free-threaded 构建又引入内部锁、biased refcount 与扩展兼容。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 125
granularity: "拆分专题"

## python-09-10

title: "multiprocessing 序列化、启动方式与共享内存"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "spawn/fork/forkserver、pickle 边界、copy-on-write、IPC 成本、资源追踪与异常回收会决定并行是否盈利。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 115
granularity: "拆分专题"

## python-09-11

title: "缓存命中、失效、stampede 与内存预算"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "缓存正确性取决于 key、TTL、版本和负缓存，性能还需处理并发 miss 合并、淘汰与不可见内存成本。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 95
granularity: "单点精讲"
