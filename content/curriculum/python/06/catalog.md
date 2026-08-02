---
track: "python"
id: "python-06"
order: 6
title: "06 · asyncio 与并发控制"
goal: "从单轮事件循环到结构化并发、取消、背压和线程/进程隔离建立可靠异步系统。"
lab: "构建可追踪 TaskGroup 服务，注入取消、超时、队列满、线程阻塞和进程序列化失败。"
interview: "Task 为什么会消失？取消为何不能吞？gather 与 TaskGroup 如何选择？GIL 限制什么？"
officialScope: "https://docs.python.org/3.14/library/asyncio-task.html"
sourceScope: "Lib/asyncio/base_events.py、Lib/asyncio/tasks.py、Lib/asyncio/taskgroups.py、Python/ceval_gil.c"
planningStatus: established
---

# 06 · asyncio 与并发控制

## python-06-01
title: "事件循环与 Task：ready/timer 队列、Future、强引用和调度公平性"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "循环轮次、回调队列、任务驱动和弱引用生命周期共同决定一个 await 何时恢复。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 120
granularity: "合并讲解"

## python-06-02
title: "取消与截止时间：CancelledError、cancelling、uncancel、timeout、wait_for 与 shield"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "取消计数、传播方向、超时包装和屏蔽作用域都有不同的失败与清理结果。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 120
granularity: "合并讲解"

## python-06-03
title: "并发收敛：gather、TaskGroup、ExceptionGroup 与部分成功策略"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "兄弟任务取消、异常聚合、结果顺序和恢复策略不能由单个 await 规则推导。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 120
granularity: "合并讲解"

## python-06-04
title: "背压与资源上限：Queue、Semaphore、join、shutdown 与生产者所有权"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "队列容量、任务计数、消费者失败和关闭协议共同决定是否泄漏或永久等待。"
learningValue: "工程必修"
learningValueScore: 5
estimatedMinutes: 100
granularity: "合并讲解"

## python-06-05
title: "跨执行边界：to_thread、executor、ContextVar、GIL 与 multiprocessing 数据所有权"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "线程、进程、上下文传播、序列化和自由线程构建具有完全不同的共享内存合同。"
learningValue: "工程必修"
learningValueScore: 5
estimatedMinutes: 120
granularity: "合并讲解"
