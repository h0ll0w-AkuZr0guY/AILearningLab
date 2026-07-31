---
id: "python-07-07"
track: "python"
title: "ParamSpec、Concatenate 与装饰器签名"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-07-07.md"
---

## 官方入口

title: "typing.ParamSpec"
url: "https://docs.python.org/3/library/typing.html#typing.ParamSpec"

ParamSpec 转发完整 callable 参数形状；P.args/P.kwargs 只用于包装实现，Concatenate 表达在前端增加或移除位置参数。

## 导读

普通 TypeVar 只能表示一个类型，无法保存 positional-only、keyword-only、默认值和名称组成的整个调用签名。ParamSpec 把这套参数列表作为一个变量，让装饰器返回与输入完全相同的 Callable[P,R]。

Concatenate[Context,P] 表示包装器内部调用需要额外前缀参数，而对外隐藏或注入它。它只支持 Callable 的首参数位置，无法任意删除中间关键字参数。

## 核心机制

- 实现体以 *args: P.args、**kwargs: P.kwargs 转发。
- 返回值关系用独立 TypeVar R。
- functools.wraps 保运行时元数据，ParamSpec 保静态签名，两者职责不同。
- 方法 descriptor 的 self 与 Concatenate 注入参数需分别建模。

## 常见误区

- 用 Callable[..., R]，返回包装器后所有参数检查消失。
- 只写 ParamSpec 却忘记 wraps，反射框架仍看到 inner。
- 试图用 Concatenate 删除末尾或任意命名参数。

## 可运行示例

```python
from collections.abc import Callable
from functools import wraps
from typing import ParamSpec, TypeVar

P = ParamSpec("P")
R = TypeVar("R")

def traced(fn: Callable[P, R]) -> Callable[P, R]:
    @wraps(fn)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        print(fn.__qualname__, args, kwargs)
        return fn(*args, **kwargs)
    return wrapper
```

## 搭积木复现

### 先保真转发

Callable[P,R] 到 Callable[P,R]，覆盖各类参数和非法调用。

### 加入上下文

用 Concatenate 注入 request/lock，明确它在公开签名内还是由装饰器隐藏。

### 双重验收

checker 用 assert_type，运行时用 inspect.signature 与 __wrapped__。

## 自检

### 问题

ParamSpec 与 functools.wraps 分别解决什么问题？

### 站内答案

ParamSpec 让静态 checker 知道包装前后的完整参数关系；wraps 复制运行时名称、文档并设置 __wrapped__，让 inspect 等反射工具恢复原函数。只用其中一个都会在另一层丢失签名。
