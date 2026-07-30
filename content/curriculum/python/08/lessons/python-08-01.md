---
id: "python-08-01"
track: "python"
title: "event loop 的 ready/timer 队列与单轮调度"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "asyncio Event Loop"
url: "https://docs.python.org/3/library/asyncio-eventloop.html"

事件循环在每一轮计算 selector 等待时间、处理 I/O、迁移到期 timer，再运行本轮 ready callback 快照。

## 真实源码

repo: "python/cpython"
file: "Lib/asyncio/base_events.py"
symbol: "BaseEventLoop._run_once"
language: "python"
url: "https://github.com/python/cpython/blob/main/Lib/asyncio/base_events.py#L1992"

### 逐段讲解

- 若 ready 非空或 loop 正在停止，selector timeout 为 0；否则由最早 timer 决定睡眠时间。
- selector 返回的 I/O 事件先转换为 ready handles，到期 timer 也从最小堆迁入 ready。
- 只执行进入本轮时 ready 的数量；callback 新排入的工作留给下一轮，避免单个回调链无限霸占同一 tick。

### 源码节选

```python
def _run_once(self):
    # ready 有工作时不能阻塞；否则睡到最早 timer 或 I/O。
    if self._ready or self._stopping:
        timeout = 0
    elif self._scheduled:
        timeout = max(0, self._scheduled[0]._when - self.time())
    else:
        timeout = None

    event_list = self._selector.select(timeout)
    self._process_events(event_list)          # I/O completion -> ready

    end_time = self.time() + self._clock_resolution
    while self._scheduled and self._scheduled[0]._when < end_time:
        handle = heapq.heappop(self._scheduled)
        self._ready.append(handle)            # 到期 timer -> ready

    ntodo = len(self._ready)                  # 固定本轮快照
    for _ in range(ntodo):
        handle = self._ready.popleft()
        if not handle._cancelled:
            handle._run()                     # 新 callback 下一轮再执行
```

## 导读

event loop 是单线程调度器，不会在任意字节码处抢占 coroutine。Task 运行到 await 一个未完成对象才把 continuation 注册为 callback 并返回 loop；loop 随后选择另一个 ready handle。

timer 使用单调时钟和最小堆，ready 使用 FIFO deque，I/O selector 负责休眠而不轮询。理解这三种结构后，sleep(0)、call_soon、call_later 和 socket readiness 的相对次序就能从数据结构推导。

## 核心机制

- call_soon 追加 ready，call_later/call_at 进入 scheduled heap。
- loop.time 使用 monotonic clock，避免系统时间跳变影响 deadline。
- 取消 timer 通常先标记，达到比例阈值再批量整理堆。
- 一个 callback 的同步执行时间直接阻塞整条 loop。

## 常见误区

- 把 event loop 当并行执行器，在 callback 中做长 CPU 计算。
- 用 wall-clock datetime 计算 loop deadline，遇到时钟校准漂移。
- 假设 callback 新安排的 callback 会在同一轮立即递归运行。

## 可运行示例

```python
import asyncio

async def main():
    loop = asyncio.get_running_loop()
    events = []

    def first():
        events.append("first")
        loop.call_soon(events.append, "scheduled-during-first")

    loop.call_soon(first)
    loop.call_soon(events.append, "already-ready")
    await asyncio.sleep(0)
    assert events == ["first", "already-ready"]
    await asyncio.sleep(0)
    assert events[-1] == "scheduled-during-first"

asyncio.run(main())
```

## 搭积木复现

### 实现三种队列

deque 保存 ready，heap 保存 deadline，fake selector 返回 I/O callbacks。

### 实现一轮

计算 timeout、迁移事件、固定 ntodo 再运行，测试 callback 链跨轮。

### 加入可观测性

记录 tick、queue size、callback duration 与 selector sleep，定位饥饿。

## 自检

### 问题

为什么 _run_once 先固定 ntodo，而不一直执行到 ready 队列为空？

### 站内答案

callback 可以不断 call_soon 自己。若循环到队列为空，同一生产者能在一个 tick 内无限续约，timer、I/O 和取消都得不到重新检查。固定快照把新工作推到下一轮，形成最基本的调度公平边界。
