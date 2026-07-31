---
id: "python-08-04"
track: "python"
title: "取消请求、CancelledError、cancelling 与 uncancel"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-08-04.md"
---

## 官方入口

title: "Coroutines and Tasks · Task Cancellation"
url: "https://docs.python.org/3/library/asyncio-task.html#task-cancellation"

Task.cancel 在下一次可运行机会向 coroutine 注入 CancelledError；这是可清理、可暂时捕获的请求，并非强制终止。

## 导读

cancel() 增加取消请求计数，并安排 Task 在下次 step 向当前暂停点 throw CancelledError。coroutine 的 finally 会运行；若捕获后不重新抛，Task 可能正常返回，因此 cancel() 返回真不等于 task.cancelled() 最终为真。

CancelledError 继承 BaseException，普通 except Exception 不会吞。TaskGroup/timeout 使用内部取消唤醒父任务，cancelling() 计数让内部与外部请求不互相丢失；业务代码几乎不应调用 uncancel，除非确实要把已吞取消的状态一起清除。

## 核心机制

- cancel(msg) 是幂等意图但多次调用会增加 cancelling count。
- cancelled() 只有 coroutine 最终传播 CancelledError 才为真。
- cleanup 后 bare raise 保持结构化并发合同。
- await 被取消 Task 会把取消传播给其当前等待 Future。

## 常见误区

- except BaseException 后返回默认值，静默吞取消。
- 在 finally 做无界阻塞清理，使取消永远无法完成。
- 捕获 CancelledError 却只 uncancel，不理解外部可能还有多次请求。

## 可运行示例

```python
import asyncio

async def worker(events):
    try:
        events.append("started")
        await asyncio.Event().wait()
    except asyncio.CancelledError:
        events.append("cancel-observed")
        raise
    finally:
        events.append("cleanup")

async def main():
    events = []
    task = asyncio.create_task(worker(events))
    await asyncio.sleep(0)
    assert task.cancel()
    assert task.cancelling() == 1
    try:
        await task
    except asyncio.CancelledError:
        pass
    assert task.cancelled()
    assert events == ["started", "cancel-observed", "cleanup"]

asyncio.run(main())
```

## 搭积木复现

### 实现取消状态

MiniTask 保存 requests，下一 step 用 throw 而非直接标完成。

### 建立路径矩阵

取消发生在未启动、sleep、子 Future、cleanup、已完成五种时点。

### 验证计数

多次 cancel、捕获重抛、捕获吞掉、uncancel 后分别断言 cancelling/cancelled。

## 自检

### 问题

task.cancel() 返回 True 后，为什么 task.cancelled() 最终仍可能是 False？

### 站内答案

True 只表示取消请求成功排入。coroutine 会在暂停点收到 CancelledError，并有机会捕获；若它吞掉异常后返回普通值，Task 正常完成，cancelled() 为 False。推荐只为清理捕获，然后重新抛出。
