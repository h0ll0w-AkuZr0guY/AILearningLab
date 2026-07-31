---
id: "python-03-08"
track: "python"
title: "functools.wraps、__wrapped__ 与签名保真"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-03-08.md"
---

## 官方入口

title: "functools · update_wrapper and wraps"
url: "https://docs.python.org/3/library/functools.html#functools.wraps"

wraps 通过 update_wrapper 复制关键元数据并设置 __wrapped__；inspect.signature 等工具会沿该链恢复原 callable。

## 导读

普通 wrapper(*args, **kwargs) 在运行上能转发调用，却把 __name__、__qualname__、__doc__、__annotations__ 和签名表面替换成 wrapper 自身。日志、依赖注入、API 文档和序列化可能因此把所有端点看成同一个函数。

functools.wraps 复制面向观察者的元数据，并设置 __wrapped__ 指向被包装对象。inspect.unwrap 与 inspect.signature 默认沿这条链找到原始 callable；它不会自动让 wrapper 获得编译期完全相同的真实参数布局。

需要改变公开签名的装饰器应显式设置 __signature__ 或返回拥有新协议的对象，同时对类型检查器使用 ParamSpec/TypeVar。保留旧签名与声称新行为之间必须一致。

## 核心机制

- WRAPPER_ASSIGNMENTS 默认复制 module、name、qualname、doc、annotations、type params 等。
- WRAPPER_UPDATES 默认更新 wrapper.__dict__，保留装饰器自身状态同时继承被包装元数据。
- __wrapped__ 形成可递归链，并允许工具选择是否 follow_wrapped。
- wraps 只处理运行时反射；静态类型和真实调用校验仍需相应签名设计。

## 常见误区

- 缓存和路由用 wrapper.__name__ 作唯一键，未使用 wraps 时多个函数全部叫 wrapper。
- wrapper 实际增加必需参数，却仍暴露原签名，文档和调用错误信息误导。
- 多层装饰器中某一层漏掉 __wrapped__，后续工具无法穿透完整链。

## 可运行示例

```python
from functools import wraps
from inspect import signature, unwrap

def traced(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        print(f"call {fn.__qualname__}")
        return fn(*args, **kwargs)
    return wrapper

@traced
def add(left: int, right: int = 0) -> int:
    """Return a sum."""
    return left + right

assert add.__name__ == "add"
assert str(signature(add)) == "(left: int, right: int = 0) -> int"
assert unwrap(add).__name__ == "add"
```

## 搭积木复现

### 先观察破坏

不使用 wraps 装饰两个不同签名函数，记录名称、文档、annotations 和 signature 如何丢失。

### 实现迷你 update_wrapper

复制 assigned 字段、更新 __dict__ 并设置 __wrapped__，与 functools.wraps 做差分。

### 验证多层链

组合三个装饰器，使用 inspect.unwrap 和 signature 检查每层都保持可穿透。

## 自检

### 问题

functools.wraps 为什么不能保证 wrapper 的真实调用协议与原函数完全相同？

### 站内答案

它主要复制元数据并提供 __wrapped__ 供反射工具恢复原签名，wrapper 本身的 code object 仍可能只有 *args/**kwargs，甚至改变参数或返回行为。协议一致性还需要实现、类型注解和必要时的 __signature__ 共同保证。
