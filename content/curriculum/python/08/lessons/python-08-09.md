---
id: "python-08-09"
track: "python"
title: "Semaphore、Queue 背压、join 与 shutdown"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-08-09.md"
---

## 官方入口

title: "asyncio Queues"
url: "https://docs.python.org/3/library/asyncio-queue.html"

有界 Queue 在满时暂停 put 形成缓冲背压；unfinished_tasks 由 put 增、task_done 减，join 等到归零；3.13+ shutdown 唤醒阻塞生产者/消费者。

## 真实源码

repo: "python/cpython"
file: "Lib/asyncio/queues.py"
symbol: "Queue.put / put_nowait / shutdown"
language: "python"
url: "https://github.com/python/cpython/blob/main/Lib/asyncio/queues.py#L125"

### 逐段讲解

- 队列满时每个 putter 创建 Future 排队；取消等待者要从 deque 移除，若已被唤醒还需唤醒下一个，避免容量 token 丢失。
- 真正入队时 unfinished_tasks 增一并清除 finished event；get 不减少它，业务处理后 task_done 才减少。
- shutdown 唤醒全部 getter/putter 让其重查状态；immediate 模式还会排空并修改 unfinished count，因此打破“join 表示已处理”语义。

### 源码节选

```python
async def put(self, item):
    while self.full():
        if self._is_shutdown:
            raise QueueShutDown
        putter = self._get_loop().create_future()
        self._putters.append(putter)
        try:
            await putter
        except:
            putter.cancel()
            self._putters.remove(putter)
            if not self.full() and not putter.cancelled():
                self._wakeup_next(self._putters)
            raise
    return self.put_nowait(item)

def put_nowait(self, item):
    if self._is_shutdown:
        raise QueueShutDown
    self._put(item)
    self._unfinished_tasks += 1        # 表示尚未“处理”，并非只表示仍在队列
    self._finished.clear()
    self._wakeup_next(self._getters)
```

## 导读

Semaphore 限制同时进入临界区的工作数，Queue(maxsize) 限制等待处理的缓冲数；两者解决不同资源。只有有界 queue 的 producer await put，压力才会从慢消费者传回上游。

queue.join 等 unfinished_tasks 归零，而非 qsize 归零。消费者 get 后必须在 finally 调 task_done；否则队列看似为空，join 却永远挂起。shutdown(false) 允许排空，immediate 会牺牲处理完成不变量换取快速终止。

## 核心机制

- asyncio Queue/Semaphore 只用于同一 event loop，不是线程安全容器。
- Semaphore cancellation 要归还尚未消费或已分配 token。
- Queue maxsize=0 表示无界，不具备内存背压。
- sentinel 终止与 shutdown API 的多消费者传播语义不同。

## 常见误区

- 只设 Semaphore，不限制创建百万个等待 Task。
- get 后业务异常跳过 task_done。
- immediate shutdown 后仍把 join 返回解释为所有工作成功处理。

## 可运行示例

```python
import asyncio

async def worker(queue, results):
    while True:
        try:
            item = await queue.get()
        except asyncio.QueueShutDown:
            return
        try:
            results.append(item * 2)
        finally:
            queue.task_done()

async def main():
    queue = asyncio.Queue(maxsize=2)
    results = []
    workers = [asyncio.create_task(worker(queue, results)) for _ in range(2)]
    for item in range(5):
        await queue.put(item)
    await queue.join()
    queue.shutdown()
    await asyncio.gather(*workers)
    assert sorted(results) == [0, 2, 4, 6, 8]

asyncio.run(main())
```

## 搭积木复现

### 分离两种容量

Queue 控待处理数，Semaphore 控正在访问外部资源数，分别暴露指标。

### 实现等待队列

getter/putter Future deque，取消时清理并转交 wakeup。

### 验证关闭矩阵

graceful/immediate × 队列空/非空 × 阻塞 get/put × join。

## 自检

### 问题

为什么 Queue 已经 empty，join 仍可能一直等待？

### 站内答案

empty 只表示所有 item 已被 get；join 追踪的是 put 后尚未 task_done 的工作。消费者可能正在处理，或异常路径漏掉 task_done。unfinished_tasks 每 put 加一，每完成处理减一，归零才表示处理合同完成。
