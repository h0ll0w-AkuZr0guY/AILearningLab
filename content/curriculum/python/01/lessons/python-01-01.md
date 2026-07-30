---
id: "python-01-01"
track: "python"
title: "PyObject 头部与 ob_type"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "CPython source · Include/object.h · PyObject"
url: "https://github.com/python/cpython/blob/main/Include/object.h"

CPython 的普通对象都以 PyObject 头部开场。头部保存引用计数和类型指针；变长对象再通过 PyVarObject 增加 ob_size。

## 导读

Python 层看到的 int、list、函数和类实例形态各异，CPython 的 C 代码却需要一种共同入口。PyObject 就是这个共同前缀：任何对象指针都可以先被当作 PyObject*，读取引用计数和运行时类型，再由类型对象决定后续操作。

PyObject 不是完整对象。它更像快递箱统一贴在最前面的标签，箱子后面才是 PyLongObject、PyListObject 等类型自己的字段。C 代码依赖“共同头部必须位于偏移 0”这一布局契约完成安全的向上转型。

ob_type 指向 PyTypeObject。加法、属性读取、迭代和释放等行为并不直接写在每个对象头里，而是通过类型对象中的 slot 分派。这个设计让数据布局和行为表分离，也解释了 type(x) 为什么是运行时机制的一部分。

## 核心机制

- PyObject_HEAD 展开后提供 ob_refcnt 与 ob_type；调试构建可能在头部加入额外追踪字段。
- Py_TYPE(obj) 读取 ob_type，Py_SET_TYPE 只应用于受控初始化或底层实现，业务扩展不应随意改写类型指针。
- 具体对象结构体把 PyObject 或 PyVarObject 放在首字段，因此 PyObject* 能指向所有内建对象。
- 操作从公开 C API 进入后，通常先取 Py_TYPE，再调用 nb_add、tp_getattro、tp_iter 等类型槽。

## 常见误区

- 把 PyObject 当成 Python 对象全部内存。它只描述共同头部，具体值可能内联在后续字段，也可能指向另一块存储。
- 认为 ob_type 等同于类名字符串。它指向完整的类型对象，类型对象自身也有类型，最终形成 metaclass 链。
- 根据某个 CPython 版本的私有字段做二进制假设。稳定 ABI、limited API 与源码内部布局的兼容承诺不同。

## 可运行示例

```python
import ctypes

class PyObjectHead(ctypes.Structure):
    _fields_ = [
        ("ob_refcnt", ctypes.c_ssize_t),
        ("ob_type", ctypes.c_void_p),
    ]

value = []
head = PyObjectHead.from_address(id(value))

# id(value) 在 CPython 中就是对象首地址；ob_type 指回 list 类型对象。
assert head.ob_type == id(list)
assert head.ob_refcnt >= 1
print({"address": hex(id(value)), "type": hex(head.ob_type)})
```

## 搭积木复现

### 画出共同头部

先只保留 refcount 和 type pointer，明确它们解决生命周期与行为分派两个不同问题。

### 观察真实对象地址

用 ctypes 只读映射 id(obj) 所在内存，比较 list、dict、自定义实例的 ob_type。不要写入这些字段。

### 沿类型槽继续追踪

从 Py_TYPE(obj) 进入 PyTypeObject，选择 tp_getattro 或 tp_dealloc 追踪一次完整分派。

## 自检

### 问题

如果每种对象都没有共同的 PyObject 头部，Py_DECREF 和 Py_TYPE 这类通用 C API 将被迫怎样设计？

### 站内答案

它们要么接收带标签的联合体，要么为每种对象生成独立入口，并在调用前保存额外的类型信息。共同前缀让所有对象都能以 PyObject* 进入通用生命周期和分派代码；代价是 CPython 扩展必须严格遵守布局与引用所有权约定。
