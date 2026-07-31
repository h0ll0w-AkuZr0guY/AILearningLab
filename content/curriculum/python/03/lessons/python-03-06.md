---
id: "python-03-06"
track: "python"
title: "参数绑定：positional-only、keyword-only、*args 与 **kwargs"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-03-06.md"
---

## 官方入口

title: "Expressions · Calls"
url: "https://docs.python.org/3/reference/expressions.html#calls"

调用先展开位置和关键字实参，再按参数种类绑定；重复赋值、未知关键字、缺失必需参数和位置参数过多都会失败。

## 导读

参数绑定是把调用端的 args/kwargs 映射到函数签名槽位。参数种类依次包括 positional-only、positional-or-keyword、var-positional、keyword-only、var-keyword；每类都决定名称能否由位置或关键字提供。

绑定要在函数体运行前完成，因此错误不会进入用户代码。一个参数若同时被位置和关键字赋值会报 multiple values；没有 **kwargs 时未知关键字报错；没有 *args 时多余位置参数报错。

inspect.Signature.bind 提供与调用语义一致的公共模型，适合路由器、依赖注入和 RPC 层。自己拼 zip(args, parameter_names) 会遗漏位置专用、关键字专用和重复绑定。

## 核心机制

- "/" 之前参数只能按位置传递，允许 **kwargs 中出现同名业务键而不冲突。
- "*" 之后参数只能按关键字传递，使调用意图稳定且便于扩展。
- *args 总是 tuple，**kwargs 为新 dict，只接收未被正式参数消费的实参。
- defaults 在绑定缺失参数时填入；Signature.bind 后需 apply_defaults 才会显式出现在 mapping。

## 常见误区

- 包装器用 *args/**kwargs 接收一切，却丢失原函数签名和静态工具支持。
- 把 bind_partial 用于真实调用校验，允许必需参数缺失后在更远处失败。
- RPC 参数名直接映射 Python 签名，升级时把位置参数改名造成不必要兼容破坏。

## 可运行示例

```python
from inspect import signature

def request(method, path, /, timeout=3, *, retries=0, **metadata):
    return method, path, timeout, retries, metadata

sig = signature(request)
bound = sig.bind("GET", "/health", retries=2, trace_id="abc")
bound.apply_defaults()

assert bound.arguments == {
    "method": "GET",
    "path": "/health",
    "timeout": 3,
    "retries": 2,
    "metadata": {"trace_id": "abc"},
}
assert request(*bound.args, **bound.kwargs)[3] == 2
```

## 搭积木复现

### 建立参数种类表

为五种 Parameter.kind 写一个签名，并标注位置、关键字和收集行为。

### 实现最小 binder

先绑定 positional-only 与 positional-or-keyword，再加入重复检测、defaults、*args 和 **kwargs。

### 与 Signature.bind 差分

覆盖成功、重复赋值、缺失、未知关键字和多余位置参数，比较异常类别。

## 自检

### 问题

为什么 positional-only 参数能让一个 API 在不破坏调用者的前提下重命名参数？

### 站内答案

调用者只能按位置提供该参数，从未依赖其名称；名称只是实现内部局部绑定。若参数允许关键字调用，名称就成为公共 API，重命名会破坏现有调用。
