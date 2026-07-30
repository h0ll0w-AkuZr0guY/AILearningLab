---
id: "python-05-01"
track: "python"
title: "异常对象、traceback 链与处理器生命周期"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "Data model · Exceptions"
url: "https://docs.python.org/3/reference/datamodel.html#exceptions"

traceback 由 tb_frame、tb_lasti、tb_lineno、tb_next 组成；异常对象通过 __traceback__ 持有传播路径。

## 导读

异常不是一段打印文本。它是携带类型、参数、notes、显式原因、隐式上下文和 traceback 的对象；traceback 又逐帧指向 frame，frame 持有 locals 与 globals。保存一个异常，可能间接延长整条调用栈上大对象的生命周期。

传播时，每离开一个 Python frame，运行时都会在 traceback 链加入节点。显示顺序通常从最外层调用到最内层失败点；对象链的遍历则由 __traceback__ 和 tb_next 提供结构化证据，可用于日志裁剪、错误分组和测试。

except Exception as exc 结束后，名称 exc 会被自动删除，因为 exc → traceback → frame → locals → exc 会形成环。sys.exception() 保存当前处理器的异常，并在嵌套处理器结束后恢复外层异常。

## 核心机制

- BaseException.args 是构造参数元组；自定义异常应把稳定的机器字段另存为显式属性。
- __traceback__ 指向链头，每个节点关联一个 frame 和下一节点。
- add_note() 可追加补充上下文，不必改变异常类型或 message。
- 处理器目标在退出时清除；若需长期保存，应提取必要字段并考虑 traceback.clear_frames。

## 常见误区

- 把异常对象放进无限期缓存或队列，意外保留请求 frame 中的大张量、响应体和密钥。
- 依赖 str(exc) 解析业务字段，message 改动就破坏调用方。
- 记录 traceback 后再次无界拼接本地变量，造成敏感信息泄漏和日志爆炸。

## 可运行示例

```python
import sys
import traceback
import weakref

class Payload:
    pass

def fail():
    payload = Payload()
    watch = weakref.ref(payload)
    try:
        raise ValueError("invalid")
    except ValueError as exc:
        assert sys.exception() is exc
        frames = traceback.extract_tb(exc.__traceback__)
        assert frames[-1].name == "fail"
        return exc, watch

error, watch = fail()
assert watch() is not None          # traceback 的 frame 仍持有 payload
traceback.clear_frames(error.__traceback__)
del error                           # 生产代码也应释放最后的异常引用
```

## 搭积木复现

### 画引用图

从 exception.__traceback__ 走到 tb_frame.f_locals，再回到 exception，标出可能形成的环。

### 实现结构化错误

定义包含 code、resource_id、retryable 的异常，message 仅用于人读，测试读取显式字段。

### 做保留实验

用 weakref 观察局部大对象在保存异常前后何时可回收，并用 traceback.clear_frames 验证。

## 自检

### 问题

为什么 Python 会在 except 块结束时自动删除 as 绑定的异常名称？

### 站内答案

异常持有 traceback，traceback 持有当前 frame，frame.locals 若继续持有该异常名称就形成强引用环。自动删除缩短对象与整帧局部变量的保留时间；外部仍可显式保存异常，但此时必须承担 traceback 带来的内存与敏感信息成本。
