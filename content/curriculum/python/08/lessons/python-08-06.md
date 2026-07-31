---
id: "python-08-06"
track: "python"
title: "gather 的结果、异常与取消矩阵"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-08-06.md"
---

## 官方入口

title: "asyncio.gather"
url: "https://docs.python.org/3/library/asyncio-task.html#asyncio.gather"

gather 按输入顺序聚合结果；默认首个异常立即传播但不取消兄弟，return_exceptions=True 把异常当结果，取消外层则取消未完成孩子。

## 真实源码

repo: "python/cpython"
file: "Lib/asyncio/tasks.py"
symbol: "gather"
language: "python"
url: "https://github.com/python/cpython/blob/main/Lib/asyncio/tasks.py#L771"

### 逐段讲解

- coroutine 输入先转成 Future/Task，重复同一 awaitable 会复用同一个 child，但结果位置仍按原输入排列。
- done callback 在默认模式遇到首个 exception 就完成 outer，不会遍历取消其他 children。
- outer.cancel 才向所有未完成 child 发 cancel；outer 已因异常完成后再 cancel 已太晚。

### 源码节选

```python
def gather(*aws, return_exceptions=False):
    children = [ensure_future(aw) for aw in aws]
    outer = _GatheringFuture(children)

    def _done_callback(child):
        if outer.done():
            if not child.cancelled():
                child.exception()            # 取回后续异常，避免报警
            return
        if not return_exceptions:
            if child.cancelled():
                outer.set_exception(CancelledError())
                return
            if (exc := child.exception()) is not None:
                outer.set_exception(exc)      # 兄弟继续运行
                return
        if all(done.done() for done in children):
            outer.set_result([
                done.exception() or done.result()
                for done in children
            ])
    return outer
```

## 导读

gather 是结果聚合器，不是失败作用域。默认首个异常使等待者立即收到失败，兄弟 Task 继续运行；这对独立请求有时合理，对“要么全成功要么全取消”的子任务树则危险。

return_exceptions=True 把异常对象放进结果列表，调用者必须逐项分类。子 Task 自己被取消会作为 CancelledError 结果/异常处理，不把 gather outer 标成 cancelled；取消 gather outer 才传播到所有未完成孩子。

## 核心机制

- 结果顺序按输入，而非完成顺序。
- 传 coroutine 会自动创建 Task。
- outer 已 done 后 cancel 不再影响仍运行的兄弟。
- 重复传入同一 awaitable 会映射到多个结果位置。

## 常见误区

- 捕获 gather 首错后以为兄弟已停止，立即释放它们仍使用的资源。
- return_exceptions=True 后不检查结果类型。
- 用 gather 构建强生命周期树，却没有 owner 回收晚失败。

## 可运行示例

```python
import asyncio

async def main():
    release = asyncio.Event()
    events = []

    async def fail():
        raise ValueError("first")

    async def sibling():
        await release.wait()
        events.append("sibling-finished")

    sibling_task = asyncio.create_task(sibling())
    try:
        await asyncio.gather(fail(), sibling_task)
    except ValueError:
        assert not sibling_task.cancelled()
        release.set()
        await sibling_task
    assert events == ["sibling-finished"]

asyncio.run(main())
```

## 搭积木复现

### 列四维矩阵

child 成功/失败/取消 × outer 取消 × return_exceptions × outer 是否已完成。

### 实现聚合 Future

每个 child done callback 更新计数；首错完成 outer，但继续取回晚异常。

### 比较 TaskGroup

同一三个 worker 分别用 gather/TaskGroup，记录兄弟取消和抛出类型。

## 自检

### 问题

gather 默认传播首个异常后，为什么不自动取消其他子任务？

### 站内答案

gather 的合同是按位置聚合一组可独立 awaitable；一个 child 失败不代表其他工作应被撤销。它只让 outer 提前以异常完成，兄弟保留自己的生命周期。需要共同成败与词法所有权时应使用 TaskGroup。
