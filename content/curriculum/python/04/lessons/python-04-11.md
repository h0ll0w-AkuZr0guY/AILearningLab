---
id: "python-04-11"
track: "python"
title: "异步生成器的背压、取消与 aclose"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-04-11.md"
---

## 官方入口

title: "Expressions · Asynchronous generator functions"
url: "https://docs.python.org/3/reference/expressions.html#asynchronous-generator-functions"

async def 中使用 yield 创建 asynchronous generator；通过 __anext__/asend/athrow/aclose 驱动，并以 StopAsyncIteration 结束。

## 真实源码

repo: "python/cpython"
file: "Objects/genobject.c"
symbol: "async_gen_asend_send"
language: "c"
url: "https://github.com/python/cpython/blob/main/Objects/genobject.c#L1974"

### 逐段讲解

- 每个 __anext__/asend 调用创建一次 awaitable 会话；会话关闭后不能再次 await。
- ag_running_async 阻止两个消费者同时恢复同一异步生成器，保护唯一暂停 frame。
- 恢复结果经 async_gen_unwrap_value 转换：异步生成器产出值与等待期间向事件循环 yield 的对象需要分开编码。

### 源码节选

```c
static PyObject *
async_gen_asend_send(PyObject *self, PyObject *arg)
{
    PyAsyncGenASend *request = _PyAsyncGenASend_CAST(self);

    if (request->ags_state == AWAITABLE_STATE_CLOSED)
        return PyErr_Format(PyExc_RuntimeError,
                            "cannot reuse already awaited __anext__()/asend()");

    if (request->ags_state == AWAITABLE_STATE_INIT) {
        if (request->ags_gen->ag_running_async)
            return PyErr_Format(PyExc_RuntimeError,
                                "anext(): asynchronous generator is already running");
        request->ags_state = AWAITABLE_STATE_ITER;
    }

    request->ags_gen->ag_running_async = 1;   // 同一 frame 只能有一个驱动者
    PyObject *result = gen_send((PyObject *)request->ags_gen, arg);
    result = async_gen_unwrap_value(request->ags_gen, result);
    if (result == NULL)
        request->ags_state = AWAITABLE_STATE_CLOSED;
    return result;
}
```

## 导读

异步生成器把 await 与 yield 放进同一个函数：await 处理上游数据尚未到达，yield 把一项交给下游。下游每次 await anext 才驱动生产者到下一项，因此在单消费者拉取模型里天然形成一项一确认的背压。

天然背压有边界。若生产者内部先把数据读进无界队列，真正的缓冲发生在队列，async generator 只能控制出队速度；需要为队列设置 maxsize，并让上游 await put 才能把压力继续向源头传播。

取消会在当前 await 暂停点抛 CancelledError；提前结束还需要 aclose 注入 GeneratorExit 以运行 finally。contextlib.aclosing 能把异步生成器的生命周期绑定到 async with，确保 break 与异常也在相同上下文内清理。

## 核心机制

- __anext__ 返回一次性 awaitable；完成后不能重复 await 同一个请求对象。
- asend(value)、athrow(exc)、aclose() 是同步 generator 双向方法的异步版本。
- 运行中保护禁止并发 anext 同一个对象；广播需求应在外部 fan-out，而非共享一个 cursor。
- 有界 asyncio.Queue 把消费速度反向传递给生产任务，是显式可量化的背压边界。

## 常见误区

- 两个 task 同时调用 anext(gen)，触发 already running 或产生未定义的业务所有权。
- 使用无界 Queue 后宣称系统有背压，实际只是把压力变成内存增长。
- 消费者 break 后没有 aclose，导致生成器 finally 与上下文变量清理延后。

## 可运行示例

```python
import asyncio
from contextlib import aclosing

async def stream(queue):
    try:
        while True:
            item = await queue.get()
            if item is None:
                return
            try:
                yield item
            finally:
                queue.task_done()
    finally:
        # 真实系统在这里关闭 cursor、响应体或订阅。
        events.append("stream-closed")

async def demo():
    queue = asyncio.Queue(maxsize=1)
    await queue.put("first")
    events.clear()
    async with aclosing(stream(queue)) as values:
        async for value in values:
            assert value == "first"
            break
    assert events == ["stream-closed"]

events = []
asyncio.run(demo())
```

## 搭积木复现

### 先做拉取模型

每次 anext 只生产一项，记录请求、产出和消费者处理完成的时间线。

### 加入有界缓冲

在生产者与生成器间放 maxsize=1 的 Queue，证明第二次 put 会等到下游取走。

### 完成取消矩阵

覆盖 break、consumer cancel、producer error、normal EOF，并断言 aclose/finally/queue.task_done 的次数。

## 自检

### 问题

异步生成器为什么常有自然背压，却仍可能把系统内存撑爆？

### 站内答案

拉取模型中，下游每次 anext 才驱动一项产出，所以生成器边界本身按消费速度前进；若上游另有任务持续写入无界队列、网络缓冲或批量缓存，压力已在到达生成器前被吸收。只有所有中间缓冲有界，并让写入者在满时 await，背压才能传回数据源。
