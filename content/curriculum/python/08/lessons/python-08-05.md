---
id: "python-08-05"
track: "python"
title: "await 的协作公平性与事件循环饥饿"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "asyncio.sleep"
url: "https://docs.python.org/3/library/asyncio-task.html#asyncio.sleep"

sleep 总会暂停当前 task；delay=0 提供让其他 ready tasks 运行的优化路径。普通 await 只有底层未完成时才必然暂停。

## 导读

await 是协议调用，不是无条件 yield。等待一个已经完成的 Future 或内部从不真正挂起的 coroutine，可能同步一路返回；包含许多 await 的循环仍可能完全霸占 event loop。

asyncio 采用协作式公平：代码自行到达可暂停点。CPU 密集循环应分块并显式让出、移到 executor/process，或改用向量化实现；频繁 sleep(0) 只能缓解调度，不能消除 CPU 工作。

## 核心机制

- await 链可在同一 Task 内同步穿透多个立即完成对象。
- sleep(0) 把 continuation 重新排入 ready。
- asyncio.Lock 通常按等待队列公平唤醒，但整体 loop 公平仍受 callback 时间影响。
- 同步 callback 无任何抢占点。

## 常见误区

- 以源码中出现 await 次数评估公平性。
- 在 async handler 中用 time.sleep、同步 requests 或大 JSON/正则计算。
- 每次迭代 sleep(0) 导致调度开销，却没有设置真实工作预算。

## 可运行示例

```python
import asyncio

async def immediate():
    return None

async def busy(events):
    for index in range(30_000):
        await immediate()          # 从未挂起，仍在同一 Task 同步前进
        if index % 5_000 == 0:
            await asyncio.sleep(0) # 明确把 continuation 交回 ready 队列
    events.append("busy-done")

async def observer(events):
    await asyncio.sleep(0)
    events.append("observer-ran")

async def main():
    events = []
    await asyncio.gather(busy(events), observer(events))
    assert "observer-ran" in events

asyncio.run(main())
```

## 搭积木复现

### 区分完成状态

await 已完成与未完成 Future，记录 loop tick 是否变化。

### 设置 CPU 预算

每批按时间而非固定次数让出，观察延迟分位数与吞吐。

### 选择卸载方式

I/O 阻塞用 thread，Python CPU 用 process，短计算保留 loop 并设阈值。

## 自检

### 问题

为什么 `await some_async_function()` 不保证其他 Task 获得运行机会？

### 站内答案

async function 可能一路只等待已完成对象，整个 await 链同步返回当前 Task；只有底层产生未完成 awaitable，或显式 sleep(0) 等调度点，控制权才回到 loop。公平性取决于真实暂停，而非 await 关键词数量。
