---
id: "python-05-08"
track: "python"
title: "ExitStack：动态资源、部分获取与所有权转移"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-05-08.md"
---

## 官方入口

title: "contextlib.ExitStack"
url: "https://docs.python.org/3/library/contextlib.html#contextlib.ExitStack"

ExitStack 以 LIFO 保存退出回调，适合动态数量与可选资源；pop_all 可把待清理责任转移到新的 stack。

## 真实源码

repo: "python/cpython"
file: "Lib/contextlib.py"
symbol: "ExitStack.__exit__"
language: "python"
url: "https://github.com/python/cpython/blob/main/Lib/contextlib.py#L630"

### 逐段讲解

- 回调按 LIFO 弹出，以模拟真正嵌套的 with；每个回调都收到当前最新异常三元组。
- 回调返回真值会清除当前异常，外层回调随后看到正常退出；回调自己抛新异常则成为新的当前异常。
- _fix_exception_context 修复人工调用回调时的因果链，使结果与词法嵌套 context manager 尽量一致。

### 源码节选

```python
def __exit__(self, *exc_details):
    exc = exc_details[1]
    received_exc = exc is not None
    suppressed_exc = False
    pending_raise = False

    while self._exit_callbacks:
        is_sync, callback = self._exit_callbacks.pop()  # 后进先出
        try:
            details = (None, None, None) if exc is None else (
                type(exc), exc, exc.__traceback__)
            if callback(*details):
                suppressed_exc = True
                pending_raise = False
                exc = None                              # 外层看到已恢复
        except BaseException as new_exc:
            _fix_exception_context(new_exc, exc)
            pending_raise = True
            exc = new_exc                               # 新失败继续向外层清理传播

    if pending_raise:
        raise exc
    return received_exc and suppressed_exc
```

## 导读

词法 with 适合资源数量在写代码时已知。ExitStack 把退出动作作为数据压栈，允许根据配置、循环和运行结果动态获取任意数量资源，同时保持与嵌套 with 相同的反向释放顺序。

enter_context 先调用 cm.__enter__，成功后才压入 __exit__。因此第 N 个资源获取失败时，前 N-1 个已登记资源仍会在离开 stack 时回滚；这正是批量文件、连接和锁获取需要的部分成功语义。

pop_all 把整组回调移动到新 stack，不执行它们。它表达明确的所有权转移：验证阶段临时拥有资源，全部成功后把关闭责任交给返回对象或更长生命周期的 owner。

## 核心机制

- callback(fn, *args) 只做无异常三元组的清理，不能抑制异常；push(exit) 可参与抑制。
- 每个 exit 看到前一个内层 exit 处理后的最新异常。
- close 等价于以正常退出三元组立即展开 stack。
- pop_all 返回新 stack，原 stack 变空；遗失新 stack 会造成资源责任泄漏。

## 常见误区

- 把 enter_context 与普通 cm.__enter__ 混用，后者成功后没有注册退出。
- 用 callback 返回 True 期待抑制异常；普通 callback wrapper 的返回值会被忽略。
- 调用 pop_all 后没有保存或关闭返回 stack。

## 可运行示例

```python
from contextlib import ExitStack
from io import StringIO

class NamedBuffer(StringIO):
    def __init__(self, name, events):
        super().__init__()
        self.name, self.events = name, events
    def close(self):
        self.events.append(("close", self.name))
        super().close()

events = []
with ExitStack() as stack:
    buffers = [
        stack.enter_context(NamedBuffer(name, events))
        for name in ("a", "b", "c")
    ]
    buffers[0].write("ready")

assert events == [("close", "c"), ("close", "b"), ("close", "a")]
```

## 搭积木复现

### 实现回调栈

先只支持 push 无参 cleanup，按 LIFO 展开并覆盖中途获取失败。

### 加入异常状态

让 exit 接收当前异常并可抑制或替换，外层回调必须看到更新后的状态。

### 实现所有权转移

pop_all 原子移动回调 deque，测试旧 owner 不再关闭、新 owner 只关闭一次。

## 自检

### 问题

ExitStack 为什么不能只保存一组 close 函数并在最后 reverse 调用？

### 站内答案

真正的 context manager exit 会收到当前异常并可能抑制或替换它；后续外层 exit 必须看到更新后的异常状态，还要维护正确 cause/context。简单 reverse close 只能做无条件清理，无法复现嵌套 with 的异常转换与所有权语义。
