---
id: "python-08-07"
track: "python"
title: "TaskGroup 结构化并发与 ExceptionGroup"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "asyncio.TaskGroup"
url: "https://docs.python.org/3/library/asyncio-task.html#task-groups"

TaskGroup 在退出前等待所有孩子；首个非 CancelledError 失败取消其余孩子，最终以 ExceptionGroup 聚合非取消失败。

## 真实源码

repo: "python/cpython"
file: "Lib/asyncio/taskgroups.py"
symbol: "TaskGroup._aexit"
language: "python"
url: "https://github.com/python/cpython/blob/main/Lib/asyncio/taskgroups.py#L82"

### 逐段讲解

- body 异常或 parent 取消会调用 _abort，向所有未完成孩子发取消请求。
- 退出用 while self._tasks 等待集合真正归零；等待 Future 本身可被多次外部取消，因此需要循环重建。
- BaseException 单独优先传播，普通多错误聚合为 ExceptionGroup；内部取消还要恢复 parent 的外部取消计数。

### 源码节选

```python
async def _aexit(self, et, exc):
    self._exiting = True
    if et is not None:
        if not self._aborting:
            self._abort()                     # body 失败/外部取消 -> 取消孩子

    while self._tasks:                         # 词法作用域不能早于孩子结束
        if self._on_completed_fut is None:
            self._on_completed_fut = self._loop.create_future()
        try:
            await self._on_completed_fut
        except CancelledError as cancel:
            if not self._aborting:
                self._abort()
            propagate_cancellation_error = cancel
        self._on_completed_fut = None

    if self._errors:
        raise BaseExceptionGroup(
            "unhandled errors in a TaskGroup", self._errors)
    if propagate_cancellation_error:
        raise propagate_cancellation_error
```

## 导读

结构化并发要求父作用域拥有孩子：不能在所有孩子完成、失败或被取消前退出。TaskGroup.create_task 登记所有权，__aexit__ 负责失败联动和回收，因此不会留下无主兄弟。

首个非取消异常触发兄弟 cancel；同时失败或取消清理中失败的错误会汇入 ExceptionGroup。KeyboardInterrupt/SystemExit 等 base error 在回收孩子后优先重抛，避免被普通组包装。

## 核心机制

- body 自身异常也参与最终 group。
- 孩子仅 CancelledError 通常不加入错误组。
- 进入 abort 后不再接受新 task。
- 嵌套 TaskGroup 必须区分内部唤醒取消与外部取消。

## 常见误区

- 孩子吞 CancelledError，使 group 退出长时间挂起。
- 从 TaskGroup 返回 task 并期待离开作用域后继续后台运行。
- 只 except Exception，未用 except* 对多错误分类。

## 可运行示例

```python
import asyncio

async def main():
    events = []

    async def fail():
        await asyncio.sleep(0)
        raise ValueError("boom")

    async def sibling():
        try:
            await asyncio.Event().wait()
        finally:
            events.append("sibling-cleanup")

    try:
        async with asyncio.TaskGroup() as group:
            group.create_task(fail())
            group.create_task(sibling())
    except* ValueError as errors:
        assert len(errors.exceptions) == 1

    assert events == ["sibling-cleanup"]

asyncio.run(main())
```

## 搭积木复现

### 建立 owner 集合

enter 后允许 create，done callback 移除；exit 等集合归零。

### 实现 fail-fast

首个非取消失败保存错误并 cancel 其他孩子，继续等待清理。

### 处理取消碰撞

覆盖 parent 外部 cancel 与 child failure 同轮发生，保证错误与取消都不丢。

## 自检

### 问题

TaskGroup 为什么在发现首个失败后仍不能立即抛出？

### 站内答案

它先取消兄弟，但取消只是请求；每个孩子还要运行 finally，且清理可能产生新异常。结构化作用域必须等所有孩子终止，收集完整错误集合后才能离开，否则会泄漏仍运行的任务和资源。
