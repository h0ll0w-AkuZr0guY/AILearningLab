---
id: "python-04-05"
track: "python"
title: "send 注入值与生成器预激"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "Expressions · generator.send"
url: "https://docs.python.org/3/reference/expressions.html#generator.send"

send(value) 恢复生成器，并让 value 成为当前 yield 表达式的结果；首次恢复只能发送 None。

## 导读

yield 同时有两个方向：右侧表达式产生的值向外发送，恢复时 send(value) 又让 value 成为 yield 表达式在生成器内部的结果。把两条方向分开画成时序图，才能避免把“yield 出去的值”和“send 进去的值”混为一谈。

新生成器还没有停在 yield 表达式上，因此非 None 值没有接收位置。next(gen) 与 gen.send(None) 都负责预激，让执行跑到第一个 yield；之后才能发送业务值。

双向 generator 可以实现协作式解析器或状态机，但在现代异步代码中通常由 async/await 提供更清晰的类型边界。理解 send 仍很重要，因为 coroutine 与 await 的底层驱动模型沿用了这套恢复语义。

## 核心机制

- value = yield outgoing：首次交出 outgoing，下一次 resume 才给 value 赋值。
- next(gen) 是 send(None) 的便利入口。
- send 返回的是生成器下一次 yield 的 outward value，而非刚送进去的值。
- 生成器 return 后 send 同样抛 StopIteration，返回值位于异常 value。

## 常见误区

- 对 GEN_CREATED 直接 send(non_none)，得到 TypeError。
- 把 gen.send(command) 当成无返回的消息发送，遗漏它会立刻运行到下一暂停点并返回一个值。
- 用装饰器偷偷预激生成器，使调用者无法判断资源和副作用何时启动。

## 可运行示例

```python
def accumulator():
    total = 0
    while True:
        command = yield total
        if command is None:
            return total
        op, value = command
        if op == "add":
            total += value
        elif op == "reset":
            total = value
        else:
            raise ValueError(op)

gen = accumulator()
assert next(gen) == 0          # 预激，并取得第一个 outward value
assert gen.send(("add", 3)) == 3
assert gen.send(("add", 4)) == 7
try:
    gen.send(None)
except StopIteration as stop:
    assert stop.value == 7
```

## 搭积木复现

### 画双向时序

为 caller、generator 两列标出 next、yield outward、send inward、next yield 的先后顺序。

### 实现显式状态

写 accumulator 并让每种 command 都产生可断言的新状态，避免只 print。

### 覆盖非法输入

测试未预激 send、未知 command、结束后 send 与执行中重入。

## 自检

### 问题

为什么 gen.send(x) 的返回值不是 x，而是生成器下一次 yield 的值？

### 站内答案

x 是当前暂停处 yield 表达式在生成器内部的结果。send 会立即恢复执行，直到生成器再次 yield、return 或抛异常；调用者得到的是这段执行的新 outward 结果。因此 send 同时完成“输入上一暂停点”和“拉取下一暂停点”。
