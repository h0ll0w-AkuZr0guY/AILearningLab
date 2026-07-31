---
id: "python-08-11"
track: "python"
title: "asyncio debug、任务栈与泄漏诊断"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-08-11.md"
---

## 官方入口

title: "Developing with asyncio · Debug Mode"
url: "https://docs.python.org/3/library/asyncio-dev.html#debug-mode"

debug mode 检测未 await coroutine、错误线程调用、慢 callback；Task introspection 与 loop exception handler 提供运行中证据。

## 导读

异步泄漏常不是内存对象本身，而是永不完成的生命周期：Task 等待无人会 set 的 Future、Queue.join 缺 task_done、后台异常从未读取、async generator 未关闭。诊断必须从 all_tasks、task.get_stack 和等待对象关系建立证据。

debug mode 记录 Task 创建来源、检查非线程安全 API、输出超过 slow_callback_duration 的 callback。它有开销，适合开发/灰度；生产应保留 task name、结构化 owner、等待时长和 loop exception handler。

## 核心机制

- RuntimeWarning: coroutine was never awaited 指 coroutine object 未被驱动。
- Task was destroyed but pending 表示 owner/loop 提前消失。
- Task exception was never retrieved 表示失败无人 await/result/exception。
- get_stack/print_stack 显示暂停 frame，配合 task name 与 creation traceback。

## 常见误区

- 只在进程退出看 warning，任务创建源已无业务上下文。
- 定期 all_tasks 却没有基线、owner 和等待年龄，无法识别泄漏。
- 用异常 done callback 本身抛错，覆盖原任务诊断。

## 可运行示例

```python
import asyncio

async def blocked(event):
    await event.wait()

async def main():
    loop = asyncio.get_running_loop()
    loop.set_debug(True)
    loop.slow_callback_duration = 0.05

    event = asyncio.Event()
    task = asyncio.create_task(blocked(event), name="blocked-demo")
    await asyncio.sleep(0)

    stacks = task.get_stack()
    assert task.get_name() == "blocked-demo"
    assert stacks[-1].f_code.co_name == "blocked"

    task.cancel()
    await asyncio.gather(task, return_exceptions=True)

asyncio.run(main(), debug=True)
```

## 搭积木复现

### 建立任务快照

定时记录 name、age、state、top frame、owner、current awaitable。

### 制造四类失败

never awaited、pending destroyed、unretrieved exception、slow callback，保存对应证据。

### 设置发布门

测试结束断言除允许列表外无 pending tasks，loop handler 收集未处理上下文并使测试失败。

## 自检

### 问题

为什么仅统计 asyncio.all_tasks() 数量不足以判断任务泄漏？

### 站内答案

服务负载会让正常 task 数波动，短快任务和永久等待任务数量可能相同。需要任务年龄、owner、暂停栈、等待对象和关闭预期；同一 owner 下持续增长或超过 deadline 的 waiting state 才是有力泄漏证据。
