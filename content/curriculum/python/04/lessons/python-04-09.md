---
id: "python-04-09"
track: "python"
title: "awaitable 与 __await__ 迭代协议"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-04-09.md"
---

## 官方入口

title: "Data model · Awaitable Objects"
url: "https://docs.python.org/3/reference/datamodel.html#awaitable-objects"

__await__ 必须返回 iterator；事件循环驱动这个 iterator，直到 StopIteration.value 成为 await 表达式结果。

## 导读

await obj 需要 obj 是 native coroutine 或提供 __await__ 的 awaitable。__await__ 返回一个 iterator，异步运行时像驱动生成器一样反复 send/throw；iterator 暂停时交出的对象由运行时解释，结束时 StopIteration.value 成为 await 结果。

await 自身不会创建线程，也不会自动让任意慢函数并发。它把当前 coroutine 的 continuation 暂停，并把控制权交给调度器；只有被等待对象在无法立刻完成时真正挂起，其他任务才有机会运行。

native coroutine 故意不实现普通 __iter__/__next__，避免被 for 或 list 意外消费。协议复用了生成器的驱动机制，同时通过独立类型边界表达“这个暂停点必须由异步运行时管理”。

## 核心机制

- __await__ 每次调用应返回符合 iterator 协议的对象，常见写法是内部生成器的 __await__。
- Future.__await__ 未完成时向事件循环 yield 自身，完成后返回 result 或抛保存的异常。
- coroutine.send/throw/close 与 generator 对应，但 coroutine 不能直接普通迭代。
- 已完成的 native coroutine 不能再次 await，否则 RuntimeError。

## 常见误区

- 自定义 __await__ 直接返回 list，而非 iterator。
- 在 async def 里调用阻塞 IO 后再写 await，以为关键词会把此前阻塞变成非阻塞。
- 复用同一个 coroutine object；应再次调用 coroutine function 创建新对象。

## 可运行示例

```python
class Immediate:
    def __init__(self, value):
        self.value = value

    def __await__(self):
        # 含 yield 的函数才会产生 iterator；不可达 yield 保留协议形状。
        if False:
            yield None
        return self.value

async def compute():
    first = await Immediate(20)
    second = await Immediate(22)
    return first + second

driver = compute().__await__()
try:
    next(driver)
except StopIteration as stop:
    assert stop.value == 42
```

## 搭积木复现

### 手驱 coroutine

取得 coro.__await__()，用 next/send 驱动到 StopIteration.value，先理解无调度器版本。

### 实现 MiniFuture

保存 PENDING/DONE、result/exception 与 callbacks；__await__ 在 pending 时 yield self。

### 实现最小调度器

任务遇到 MiniFuture 就注册恢复回调，future 完成后把结果 send 回 coroutine。

## 自检

### 问题

await 为什么可以理解为受异步运行时约束的 yield from，却不能简单等同于“开启并发”？

### 站内答案

await 通过 __await__ iterator 委派并暂停当前 continuation，这与生成器委派机制相近；是否有其他任务运行取决于事件循环、被等待对象是否真的未完成以及调度策略。等待一个立即完成对象不会产生并发，等待前执行的阻塞代码仍会阻塞线程。
