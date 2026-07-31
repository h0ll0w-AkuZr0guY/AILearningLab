---
id: "python-08-03"
track: "python"
title: "create_task 生命周期、强引用与 eager start"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-08-03.md"
---

## 官方入口

title: "asyncio.create_task"
url: "https://docs.python.org/3/library/asyncio-task.html#asyncio.create_task"

create_task 把 coroutine 调度为 Task；调用者应保存强引用。eager_start 可让 coroutine 在创建期间同步运行到首次阻塞。

## 导读

默认 create_task 把首次 step 排入 ready queue，当前 callback 不让出前子任务通常不会运行。loop 对 task 只保存弱引用，fire-and-forget 需要业务集合持有强引用，并在完成 callback 中移除和读取异常。

eager task factory/eager_start 让 coroutine 在 Task 构造时同步执行，若不阻塞甚至直接完成。它能省一次调度，却改变副作用、异常和任务排序时机，属于语义选择而非纯性能开关。

## 核心机制

- name 与 context 在创建时记录，ContextVar 默认复制当前 context。
- background set + task.add_done_callback(discard) 建立有限生命周期引用。
- 完成 Task 的 exception 若从未读取会在销毁/loop handler 中报警。
- TaskGroup.create_task 把所有权绑定到词法作用域。

## 常见误区

- create_task 后丢弃引用，依赖 GC 时机维持业务任务。
- done callback 只 discard，不调用 result/exception，后台失败无人处理。
- 开启 eager 后仍依赖“创建后先修改状态、子任务才运行”的顺序。

## 可运行示例

```python
import asyncio

async def worker(item):
    await asyncio.sleep(0)
    return item * 2

async def main():
    background = set()
    results = []

    task = asyncio.create_task(worker(21), name="double-21")
    background.add(task)
    task.add_done_callback(background.discard)
    task.add_done_callback(lambda done: results.append(done.result()))

    await task
    assert results == [42]
    assert not background

asyncio.run(main())
```

## 搭积木复现

### 建立 owner

定义谁保存 task、谁 await、谁读取异常、何时移除，禁止无主任务。

### 比较启动模式

默认与 eager 下记录 create 前后、coroutine 入口和首个 await 顺序。

### 加入关闭协议

服务 shutdown 时 cancel 所有 background 并 gather(return_exceptions=True)。

## 自检

### 问题

为什么 asyncio 文档要求保存 create_task 返回值的强引用？

### 站内答案

event loop 的内部集合不会承诺用强引用把 Task 保活；无其他 owner 时任务可能在完成前被回收。业务还需要引用来等待、取消和读取异常。明确 owner 集合既保生命周期，也使关闭与失败处理可审计。
