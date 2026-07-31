---
id: "python-05-09"
track: "python"
title: "async with、取消与可靠异步清理"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-05-09.md"
---

## 官方入口

title: "Data model · Asynchronous Context Managers"
url: "https://docs.python.org/3/reference/datamodel.html#asynchronous-context-managers"

__aenter__ 与 __aexit__ 都返回 awaitable；async with 保证 enter 成功后等待 exit，但任务取消也会进入清理路径。

## 导读

异步资源的获取与释放可能需要网络往返，因此 __aenter__/__aexit__ 都可 await。async with 保留同步 with 的所有权和异常抑制语义，同时把两个边界交给事件循环调度。

取消以 CancelledError 注入 task 当前 await 点。async with 会进入 __aexit__，但清理内部的 await 仍可能遭遇新的取消或超时。可靠设计应让释放幂等、限制耗时，并只在确有必要时由独立 task 或 shield 保护关键提交/回滚段。

shield 只保护被等待操作本身，不会让外层 task 忘记取消；过度屏蔽会让停机和超时失效。资源 owner 还需决定等待清理完成、记录后台清理句柄或在超时后强制丢弃的策略。

## 核心机制

- async with EXPR as value 依次 await __aenter__、运行 body、await __aexit__。
- __aexit__ 收到 CancelledError 时也可清理，但通常应返回 False 让取消继续传播。
- AsyncExitStack 同一栈可登记同步与异步退出回调并按 LIFO await。
- 清理失败可能替换原业务异常；关键系统可用 notes/ExceptionGroup 保存两个失败。

## 常见误区

- __aexit__ 捕获 BaseException 后 return True，无意中吞掉任务取消。
- 整个业务块都 shield，导致上层取消合同失效。
- 释放函数非幂等，取消重试或多 owner 竞争造成二次提交/关闭错误。

## 可运行示例

```python
import asyncio

class Lease:
    def __init__(self, events):
        self.events = events
        self.released = False

    async def __aenter__(self):
        self.events.append("acquired")
        return self

    async def release(self):
        if not self.released:               # 取消重试也安全
            await asyncio.sleep(0)
            self.released = True
            self.events.append("released")

    async def __aexit__(self, exc_type, exc, tb):
        await self.release()
        return False                         # 包括 CancelledError 在内均继续传播

async def worker(events):
    async with Lease(events):
        await asyncio.Event().wait()

async def demo():
    events = []
    task = asyncio.create_task(worker(events))
    await asyncio.sleep(0)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    assert events == ["acquired", "released"]

asyncio.run(demo())
```

## 搭积木复现

### 展开 async with

手写 await aenter 与 try/except/finally 中 await aexit，保留异常三元组和 suppression。

### 注入取消

分别在 acquire、body、release 的 await 点 cancel，断言资源状态和 CancelledError 是否继续传播。

### 设计清理预算

为 release 加幂等键、超时、有限 shield 与失败记录，明确超时后的 owner 决策。

## 自检

### 问题

为什么在 __aexit__ 中 await 清理并不自动保证清理一定完成？

### 站内答案

任务已处于取消传播路径，清理里的 await 仍是可暂停点，也可能收到后续取消、超时或自身异常。可靠性来自幂等释放、明确的清理时间预算和最小范围保护；shield 只能保护特定 awaitable 的执行，外层取消仍需被观察和传播。
