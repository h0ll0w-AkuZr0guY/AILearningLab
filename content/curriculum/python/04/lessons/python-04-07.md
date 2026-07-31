---
id: "python-04-07"
track: "python"
title: "yield from 委派状态机与返回值通道"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-04-07.md"
---

## 官方入口

title: "Expressions · yield from"
url: "https://docs.python.org/3/reference/expressions.html#yield-expressions"

yield from 会转发子迭代器的值与 send/throw/close，并把 StopIteration.value 作为表达式结果。

## 导读

yield from iterable 远多于 for item in iterable: yield item。它建立一条双向委派通道：调用者的 next/send/throw/close 需要按子迭代器能力转发，子生成器 return 的值还要回到外层继续执行。

若子对象只是普通 iterator，它没有 send 时只有 send(None) 能退化为 next；非 None send 会失败。throw 若无法转发，异常在外层 yield from 表达式处抛出；close 则在子对象提供 close 时先调用它。

PEP 380 的价值是把一大段容易漏分支的代理状态机变成语言结构。理解等价展开后，才能在设计嵌套解析器、任务树和资源清理时判断异常与返回值究竟走哪条通道。

## 核心机制

- 初始 iter(EXPR) 得到 delegated iterator，随后每个产出直接转给最外层调用者。
- 子迭代器 StopIteration.value 结束委派，并成为 yield from 表达式的值。
- 外层 send(None) 驱动 next(sub); send(x) 优先调用 sub.send(x)。
- throw 与 close 沿当前委派链传播，finally 通常从最内层开始清理。

## 常见误区

- 用普通 for 代替 yield from，却期待 send 和 return value 也会自动转发。
- 认为 yield from 只接受生成器；任何 iterable 都能委派，但双向能力取决于实际 iterator。
- 子生成器用 raise StopIteration 返回，触发 PEP 479 而破坏返回值通道。

## 可运行示例

```python
def child():
    total = 0
    while True:
        value = yield total
        if value is None:
            return total
        total += value

def parent():
    result = yield from child()
    yield ("child-returned", result)

gen = parent()
assert next(gen) == 0
assert gen.send(2) == 2
assert gen.send(5) == 7
assert gen.send(None) == ("child-returned", 7)

# 普通 for 只能转发 outward values，无法表达上面的 send 与 return value 通道。
```

## 搭积木复现

### 先实现单向委派

用 for/yield 转发普通 iterator，明确它只覆盖 next 与 outward value。

### 补齐双向矩阵

为 next、send(None)、send(value)、throw、close、StopIteration.value 分别写测试和转发分支。

### 验证嵌套链

构造三层 delegator，记录 send、异常和 close 到达的顺序，确保返回值逐层回传。

## 自检

### 问题

为什么 yield from 的等价实现不能只写成 for value in child: yield value？

### 站内答案

for 版本只覆盖 next 拉取和向外 yield。完整委派还要把调用者 send 的值送入子生成器、把 throw/close 沿链传播，并把子生成器 StopIteration.value 变成外层表达式结果。遗漏任一分支都会改变协程状态机或资源清理语义。
