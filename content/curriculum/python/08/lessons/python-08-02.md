---
id: "python-08-02"
track: "python"
title: "coroutine、Future、Task 与驱动关系"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-08-02.md"
---

## 官方入口

title: "Coroutines and Tasks · Awaitables"
url: "https://docs.python.org/3/library/asyncio-task.html#awaitables"

coroutine 是可暂停计算；Future 是最终结果占位与 callback 容器；Task 是驱动 coroutine 并把完成状态暴露成 Future 的调度单元。

## 导读

调用 async def 得到 coroutine object，它保存 continuation，却不会自行推进。Task 包装 coroutine，把每一步 send/throw 排入 event loop；当 coroutine await Future 时，Task 给 Future 注册唤醒 callback，完成后把结果 send 回 continuation。

Future 是一次完成的状态槽：PENDING 只能转为 RESULT、EXCEPTION 或 CANCELLED，完成 callback 被调度而非同步递归执行。应用层通常创建 Task，协议/库层才直接创建 Future 连接 callback API。

## 核心机制

- await coroutine 会由当前 Task 直接驱动嵌套 continuation，不必显式 create_task。
- create_task 产生并发兄弟；直接 await 保持顺序调用。
- Future.set_result/set_exception 只能执行一次。
- Task 同时是 Future，因此可 await、加 callback、查询 exception。

## 常见误区

- 调用 coroutine function 后既不 await 也不 schedule，最终出现 never awaited。
- 手工 set_result 一个 Task，Task 的结果必须来自 coroutine。
- 为顺序依赖都 create_task，制造生命周期与错误归属复杂度。

## 可运行示例

```python
import asyncio

async def child(events):
    events.append("child-start")
    await asyncio.sleep(0)
    events.append("child-end")
    return 42

async def main():
    events = []
    coroutine = child(events)
    assert events == []               # 只有 continuation，尚无人驱动
    task = asyncio.create_task(coroutine)
    assert isinstance(task, asyncio.Future)
    assert await task == 42
    assert events == ["child-start", "child-end"]

asyncio.run(main())
```

## 搭积木复现

### 实现 MiniFuture

状态、result/exception、callbacks 与一次完成不变量。

### 实现 MiniTask.step

send/throw coroutine；yield Future 时注册 wakeup，结束时设置结果。

### 覆盖错误路径

重复完成、coroutine 异常、Future 取消与错误 await 对象。

## 自检

### 问题

为什么 coroutine object 本身不能像 Task 一样在后台继续运行？

### 站内答案

coroutine 只保存可恢复的执行状态，没有调度责任。必须由当前 Task 的 await 链或新 Task 反复 send/throw 驱动。Task 把 continuation 与 event loop callback、Future 完成状态和取消协议连接起来，才形成独立运行单元。
