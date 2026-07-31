---
id: "python-04-10"
track: "python"
title: "异步迭代：__aiter__、__anext__ 与 StopAsyncIteration"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "Data model · Asynchronous Iterators"
url: "https://docs.python.org/3/reference/datamodel.html#asynchronous-iterators"

__aiter__ 返回异步 iterator；__anext__ 返回 awaitable，最终产生下一项或抛 StopAsyncIteration。

## 导读

同步 iterator 的 next 必须立即给值或结束，无法在等待网络数据时让出控制权。异步 iterator 把“取下一项”建模为 awaitable：async for 每轮先取 __anext__()，再 await 它，因此等待期间事件循环可以运行其他任务。

__aiter__ 从 Python 3.7 起必须直接返回 asynchronous iterator，不能返回一个最终解析为 iterator 的 awaitable。__anext__ 的 awaitable 以正常返回值表示数据，以 StopAsyncIteration 表示结束。

异步 iterable 与异步 iterator 仍有可重复/一次性的区别。数据库查询对象可以每次 __aiter__ 创建新 cursor；async generator object 通常就是一次性 iterator。

## 核心机制

- async for 展开为 iterator = type(obj).__aiter__(obj)，随后反复 await type(iterator).__anext__(iterator)。
- StopAsyncIteration 是独立结束信号，避免普通 StopIteration 与 coroutine 驱动协议冲突。
- anext(iterator, default) 提供与 next 类似的默认结束值。
- 循环 break 不保证任意自定义异步 iterator 自动释放资源，所有权应通过 async with 或显式 aclose 表达。

## 常见误区

- 把 __aiter__ 写成 async def 并 return self，现代 Python 得到 coroutine 而非 async iterator。
- __anext__ 在结束时 return None，导致无限产生 None；必须 raise StopAsyncIteration。
- async for 提前 break 后假设所有底层 cursor 都已关闭。

## 可运行示例

```python
import asyncio

class AsyncRange:
    def __init__(self, stop):
        self.current = 0
        self.stop = stop

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self.current >= self.stop:
            raise StopAsyncIteration
        await asyncio.sleep(0)  # 模拟一次可让出控制权的异步读取
        value = self.current
        self.current += 1
        return value

async def collect():
    result = []
    async for value in AsyncRange(3):
        result.append(value)
    return result

assert asyncio.run(collect()) == [0, 1, 2]
```

## 搭积木复现

### 展开 async for

显式调用 aiter/anext 并捕获 StopAsyncIteration，观察每轮都 await 一个取数操作。

### 分离 query 与 cursor

让 query.__aiter__ 创建独立异步 cursor，验证两个消费者互不共享进度。

### 加入资源所有权

为 cursor 增加 aclose 与 async context manager，在正常、break、异常、取消四条路径断言关闭。

## 自检

### 问题

为什么 __anext__ 要返回 awaitable，而 __aiter__ 从 Python 3.7 起反而必须直接返回 iterator？

### 站内答案

真正可能等待的是每一次取数，所以异步边界放在 __anext__ 最清晰；获取遍历会话本身保持同步，async for 能立即拿到稳定协议对象。早期允许异步 __aiter__ 增加了展开规则和兼容复杂度，后来被收紧。
