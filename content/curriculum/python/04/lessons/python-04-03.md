---
id: "python-04-03"
track: "python"
title: "生成器函数、惰性启动与对象状态"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-04-03.md"
---

## 官方入口

title: "Expressions · Yield expressions"
url: "https://docs.python.org/3/reference/expressions.html#yield-expressions"

函数体出现 yield 后，调用函数只创建 generator object；执行在首次 next/send(None) 时开始，并在每个 yield 暂停。

## 导读

含 yield 的 def 创建 generator function。调用它时，参数绑定已经完成，生成器对象和执行帧也已准备好，但函数体第一行尚未运行。这让数据管线可以先组装，直到消费者真正拉取时才产生副作用。

generator 的状态通常可观察为 GEN_CREATED、GEN_RUNNING、GEN_SUSPENDED、GEN_CLOSED。状态转换是单向生命周期，已关闭对象不能重启；想重复计算必须再次调用 generator function 创建新对象。

惰性会推迟异常、资源获取和日志。API 设计必须说明错误发生在“构造迭代器”还是“首次消费”，否则调用者很难确定重试与清理边界。

## 核心机制

- 调用 generator function 创建对象并保存初始 frame，不执行用户代码。
- next(gen) 等价于 gen.send(None)，首次恢复从函数入口开始。
- yield value 将 value 交给调用者并保存恢复位置；下一次恢复后 yield 表达式结果为 None 或 send 的值。
- 正常 return、未处理异常或 close 都会进入 CLOSED，后续 next 只抛 StopIteration。

## 常见误区

- 在调用生成器后立刻期待参数校验或文件打开已经执行。
- 把 generator 存成可复用字段，第一次请求已把它耗尽。
- 在生成器里跨 yield 持有数据库事务或锁，却没有明确消费期限与 close 策略。

## 可运行示例

```python
import inspect

events = []

def rows(limit):
    events.append("started")
    for index in range(limit):
        events.append(f"before:{index}")
        yield index
    events.append("returned")

gen = rows(2)
assert events == []
assert inspect.getgeneratorstate(gen) == "GEN_CREATED"

assert next(gen) == 0
assert events == ["started", "before:0"]
assert inspect.getgeneratorstate(gen) == "GEN_SUSPENDED"

assert list(gen) == [1]
assert events[-1] == "returned"
assert inspect.getgeneratorstate(gen) == "GEN_CLOSED"
```

## 搭积木复现

### 记录状态迁移

在入口、yield 前后、finally 与 return 处写事件日志，同时用 inspect.getgeneratorstate 断言状态。

### 移动失败时机

分别在函数调用前的普通包装器和生成器体第一行校验参数，比较异常出现的时刻。

### 设计可重复 API

让对象保存 generator factory 而非 generator instance，并为每次遍历创建新会话。

## 自检

### 问题

为什么调用 generator function 时连函数体第一行都不会执行？这对 API 有什么影响？

### 站内答案

调用阶段只绑定参数并创建保存执行上下文的 generator object，真正解释 frame 由首次 next/send(None) 触发。这样才能实现按需计算，但校验、资源获取和异常也被推迟。若 API 需要立即失败，应在普通外层函数中校验，再返回内部生成器。
