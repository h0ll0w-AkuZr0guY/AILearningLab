---
id: "python-04-08"
track: "python"
title: "contextmanager：单次 yield 与异常回注"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-04-08.md"
---

## 官方入口

title: "contextlib.contextmanager"
url: "https://docs.python.org/3/library/contextlib.html#contextlib.contextmanager"

yield 前对应 __enter__，yield 值绑定给 as；with 块异常会在 yield 位置重新抛入，yield 后负责退出与清理。

## 真实源码

repo: "python/cpython"
file: "Lib/contextlib.py"
symbol: "_GeneratorContextManager.__enter__ / __exit__"
language: "python"
url: "https://github.com/python/cpython/blob/main/Lib/contextlib.py#L167"

### 逐段讲解

- __enter__ 调 next(self.gen) 取得唯一 yield 值；若生成器未 yield 就结束，转成明确 RuntimeError。
- with 正常退出时 __exit__ 再 next 一次，并要求立即 StopIteration；第二次 yield 同样是协议错误。
- with 块抛异常时 __exit__ 用 gen.throw 把同一异常送回 yield 处，让生成器决定传播、替换或抑制。

### 源码节选

```python
class _GeneratorContextManager:
    def __enter__(self):
        try:
            return next(self.gen)          # yield 值就是 with ... as 的值
        except StopIteration:
            raise RuntimeError("generator didn't yield") from None

    def __exit__(self, typ, value, traceback):
        if typ is None:
            try:
                next(self.gen)             # 正常退出：执行 yield 之后的清理
            except StopIteration:
                return False
            raise RuntimeError("generator didn't stop")

        try:
            self.gen.throw(value)          # 异常退出：在 yield 位置回注
        except StopIteration as exc:
            return exc is not value        # 正常结束可表示异常已被处理
        except BaseException as exc:
            if exc is not value:
                raise
            return False
```

## 导读

@contextmanager 把一个生成器协议适配成 __enter__/__exit__。yield 之前获取资源，yield 出去的值交给 as，yield 之后释放资源；try/finally 让正常与异常退出共享清理代码。

with 块里的异常不会绕过生成器。适配器调用 gen.throw，把异常精确地抛在 yield 位置，因此生成器可以 except 特定异常并决定是否抑制；若只写 finally，清理后原异常继续传播。

一个 contextmanager 实例是一次性的，因为底层 generator 不能重启。作为装饰器使用时，ContextDecorator 会为每次函数调用重新创建实例，这与“同一实例可重入”是不同能力。

## 核心机制

- 零次 yield 表示 enter 无法提供资源，抛 generator did not yield。
- 两次及以上 yield 表示 exit 后仍未停止，抛 generator did not stop。
- 正常退出通过 next 恢复；异常退出通过 throw 恢复。
- 是否抑制异常取决于生成器如何结束以及是否重新抛出原异常。

## 常见误区

- 捕获异常后只记录日志不再 raise，无意中让 with 后继续执行。
- yield 两次，误把 contextmanager 当成普通数据生成器。
- 缓存并复用同一个 context manager 实例，第二次进入时底层 generator 已关闭。

## 可运行示例

```python
from contextlib import contextmanager

events = []

@contextmanager
def transaction():
    events.append("begin")
    try:
        yield {"connection": "demo"}
    except ValueError:
        events.append("rollback")
        raise                       # 保留原失败语义
    else:
        events.append("commit")
    finally:
        events.append("release")

with transaction() as tx:
    assert tx["connection"] == "demo"

assert events == ["begin", "commit", "release"]
```

## 搭积木复现

### 实现 enter

保存 generator，next 一次取得资源；对零次 yield 给出专门协议错误。

### 实现两条 exit

正常路径 next，异常路径 throw；都要求生成器随后结束，并正确返回 suppress 布尔值。

### 写行为矩阵

覆盖零次、一次、两次 yield，正常退出，原异常重抛，新异常替换与有意抑制。

## 自检

### 问题

with 块中的异常为什么能被 @contextmanager 函数里 yield 周围的 except 捕获？

### 站内答案

适配器的 __exit__ 收到异常三元组后调用 generator.throw，将异常注入到生成器当前暂停的 yield 表达式处。对生成器而言，yield 就像突然抛出了该异常，所以周围 except/finally 会按普通控制流运行。
