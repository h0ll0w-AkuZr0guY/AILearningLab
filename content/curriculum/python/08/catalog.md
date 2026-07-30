---
track: "python"
id: "python-08"
order: 8
title: "08 · asyncio 与并发控制"
goal: "从 event loop 调度、Task、取消传播走到结构化并发。"
lab: "实现带 timeout、限流、重试、取消语义的批量请求器。"
interview: "TaskGroup 和 gather 的部分失败语义如何区别？"
officialScope: "https://docs.python.org/3/"
sourceScope: "Lib/asyncio/tasks.py"
planningStatus: established
---

# 08 · asyncio 与并发控制

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

## python-08-01

title: "event loop 的 ready/timer 队列与单轮调度"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "需要复现 selector 等待、定时器迁移、ready 快照与 callback 执行顺序，才能解释公平性和慢回调。"
learningValue: "基础必修"
learningValueScore: 5
estimatedMinutes: 110
granularity: "拆分专题"

## python-08-02

title: "coroutine、Future、Task 与驱动关系"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "三者分别表示可暂停计算、一次性结果槽与调度驱动器，混淆会导致重复 await、裸 coroutine 泄漏和错误取消。"
learningValue: "基础必修"
learningValueScore: 5
estimatedMinutes: 85
granularity: "单点精讲"

## python-08-03

title: "create_task 生命周期、强引用与 eager start"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "任务可在调用者下一次让出前保持待调度，loop 只保留弱引用；新 eager start 又改变副作用和异常时机。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 85
granularity: "单点精讲"

## python-08-04

title: "取消请求、CancelledError、cancelling 与 uncancel"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "cancel 是在下个暂停点注入的请求而非强制终止，多次请求计数、清理重抛和结构化并发内部取消必须分开追踪。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 120
granularity: "拆分专题"

## python-08-05

title: "await 的协作公平性与事件循环饥饿"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "await 只有在被等待对象真正挂起时才让出；立即完成 await、CPU 循环和无界回调链都可能饿死其他任务。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 80
granularity: "单点精讲"

## python-08-06

title: "gather 的结果、异常与取消矩阵"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "子任务失败、子任务取消、gather 自身取消、return_exceptions 与完成后 cancel 组合形成多分支语义。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 105
granularity: "拆分专题"

## python-08-07

title: "TaskGroup 结构化并发与 ExceptionGroup"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "首个非取消失败触发兄弟取消、退出等待所有孩子、聚合异常，并需处理外部取消与内部唤醒取消碰撞。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 125
granularity: "拆分专题"

## python-08-08

title: "timeout、wait_for、shield 与取消作用域"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "三者保护的是不同 task/await 边界；timeout 通过取消当前 task 并转换异常，shield 仅阻止向子任务传播。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 115
granularity: "拆分专题"

## python-08-09

title: "Semaphore、Queue 背压、join 与 shutdown"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "并发数和缓冲量是不同限制；还要维持 put/get/task_done 计数、取消安全与 3.13 shutdown 不变量。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 115
granularity: "拆分专题"

## python-08-10

title: "to_thread、run_in_executor、ContextVar 与 GIL"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "线程卸载涉及 context 传播、取消只能停止等待者、executor 容量以及 CPU Python 代码仍受 GIL 约束。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 90
granularity: "单点精讲"

## python-08-11

title: "asyncio debug、任务栈与泄漏诊断"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "要区分 never awaited coroutine、pending task destruction、未取回异常、慢 callback 和永不完成 Future 的证据链。"
learningValue: "进阶关键"
learningValueScore: 4
estimatedMinutes: 90
granularity: "单点精讲"
