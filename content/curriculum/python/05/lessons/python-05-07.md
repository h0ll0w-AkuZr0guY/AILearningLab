---
id: "python-05-07"
track: "python"
title: "with 展开、特殊方法查找与异常抑制"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "Compound statements · The with statement"
url: "https://docs.python.org/3/reference/compound_stmts.html#the-with-statement"

只要 __enter__ 成功返回，__exit__ 就必被调用；异常退出时 truthy 返回值抑制异常，多项 with 等价于嵌套。

## 导读

with 把资源获取成功后的清理责任绑定到语法结构。运行时先从类型上取得 __enter__/__exit__，调用 enter；只有 enter 成功后才保证 exit。若 enter 进行了多步获取后失败，类本身必须回滚已经取得的部分资源。

异常退出时，exit 接收 type、instance、traceback；truthy 返回值表示已处理并抑制异常。正常退出传入三个 None，exit 返回值被忽略。抑制属于强语义，应只覆盖上下文管理器明确能恢复的异常。

with A(), B() 等价于嵌套：按 A→B 获取，按 B→A 释放。这个 LIFO 顺序与锁、事务、临时状态覆盖的依赖方向一致。

## 核心机制

- 特殊方法通过 type(manager) 查找，实例上动态塞 __exit__ 不参与隐式协议。
- as 绑定失败也发生在 enter 成功之后，因此仍会调用 exit。
- 多个 context manager 由左到右 enter、由右到左 exit。
- 内层 exit 抑制异常后，外层 exit 会看到 None 三元组。

## 常见误区

- __exit__ 无条件 return True，吞掉 KeyboardInterrupt 之外的大量程序错误。
- __enter__ 获取资源 A 后获取 B 失败，却指望未进入成功的 with 自动调用 __exit__。
- 错误假设 exit 从实例字典查找并试图运行时替换单个实例方法。

## 可运行示例

```python
events = []

class Resource:
    def __init__(self, name, suppress=()):
        self.name, self.suppress = name, suppress

    def __enter__(self):
        events.append(("enter", self.name))
        return self

    def __exit__(self, exc_type, exc, tb):
        events.append(("exit", self.name, exc_type))
        return exc_type is not None and issubclass(exc_type, self.suppress)

with Resource("outer"), Resource("inner", (ValueError,)):
    raise ValueError("handled by inner")

assert events[:2] == [("enter", "outer"), ("enter", "inner")]
assert events[2][1] == "inner"
assert events[3] == ("exit", "outer", None)
```

## 搭积木复现

### 手工展开 with

按官方等价代码实现 hit_except 与 exit(*sys.exc_info())，覆盖 as 赋值失败。

### 验证嵌套顺序

三个资源记录 enter/exit 与异常三元组，断言 LIFO 及内层抑制后外层看到 None。

### 限制抑制范围

只对白名单异常返回 True，其他异常记录必要信息后返回 False。

## 自检

### 问题

为什么 __enter__ 失败时 Python 不调用同一对象的 __exit__？

### 站内答案

with 的清理保证从 enter 成功返回后才成立；enter 失败意味着对象尚未宣布完成可管理资源的建立，运行时无法知道哪些部分需要释放。多阶段 enter 必须在内部用 try/ExitStack 回滚已成功步骤，再把异常传播出去。
