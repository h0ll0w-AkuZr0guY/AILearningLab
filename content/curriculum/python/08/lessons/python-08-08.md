---
id: "python-08-08"
track: "python"
title: "timeout、wait_for、shield 与取消作用域"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "asyncio Timeouts and Shielding"
url: "https://docs.python.org/3/library/asyncio-task.html#timeouts"

timeout 取消当前 Task 并在作用域外转换为 TimeoutError；wait_for 取消目标 awaitable；shield 阻止调用者取消传播给子 Task，但调用者仍收到 CancelledError。

## 导读

asyncio.timeout 是词法取消作用域：deadline 到达时取消当前 Task，__aexit__ 识别自己的取消并转成 TimeoutError，因此 TimeoutError 要在 async with 外捕获。嵌套 timeout 可安全区分各自 deadline。

wait_for 针对一个 awaitable，超时会 cancel 它并等待取消完成，所以墙钟时间可能超过 timeout。shield 只切断 caller cancellation → child cancellation 这条边，caller 的 await 仍抛 CancelledError，且必须保存 child 强引用并决定以后如何回收。

## 核心机制

- timeout 使用 loop deadline 和 Task cancellation count 区分自己的请求。
- wait_for 遇到外部取消也会取消目标并传播。
- shield 不抵御 child 自身取消或其他 owner 取消。
- 保护提交/回滚要有限时且有后续 owner，不能无限 shield。

## 常见误区

- 在 timeout block 内 except TimeoutError，实际先收到 CancelledError。
- shield coroutine 后丢弃返回 task 引用，保护了执行却无法回收结果。
- 以为 wait_for 会在 deadline 瞬间返回，忽略取消清理耗时。

## 可运行示例

```python
import asyncio

async def commit(events):
    await asyncio.sleep(0.02)
    events.append("committed")

async def main():
    events = []
    task = asyncio.create_task(commit(events))
    try:
        async with asyncio.timeout(0.001):
            await asyncio.shield(task)
    except TimeoutError:
        # 当前 task 超时，但 shield 保留 commit task。
        await task
    assert events == ["committed"]

asyncio.run(main())
```

## 搭积木复现

### 画取消边

对 timeout、wait_for、shield 标出谁取消谁、谁转换异常、谁继续运行。

### 测时间线

目标 cleanup 延迟 50ms，断言 wait_for 实际返回时间与最终状态。

### 设计 shield owner

保存 task、设置二级 deadline、读取结果/异常，并在服务关闭时回收。

## 自检

### 问题

shield 为什么既让子 Task 继续运行，又让当前 await 抛 CancelledError？

### 站内答案

shield 只阻断取消向被保护 Task 传播，不取消调用者本身的取消合同。调用者仍应尽快响应取消；子任务被留下继续执行，因此必须有独立 owner 保存引用、等待或在稍后处理结果。
