---
id: "python-02-05"
track: "python"
title: "函数 descriptor、绑定方法与 self 注入"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-02-05.md"
---

## 官方入口

title: "Descriptor Guide · Functions and methods"
url: "https://docs.python.org/3/howto/descriptor.html#functions-and-methods"

函数是 non-data descriptor。通过实例读取函数时，function.__get__ 返回绑定了实例的 method；通过类读取时返回原函数。

## 真实源码

repo: "python/cpython"
file: "Objects/funcobject.c"
symbol: "func_descr_get"
language: "c"
url: "https://github.com/python/cpython/blob/main/Objects/funcobject.c#L1178-L1190"

### 逐段讲解

- 类访问直接返回原函数的新引用，因此仍由调用者显式传入实例。
- 实例访问调用 PyMethod_New；method 对象内部保存 __func__ 和 __self__。
- 该类型只提供 tp_descr_get、没有 tp_descr_set，所以函数属于 non-data descriptor。
- 绑定语义与调用优化分离；后续 vectorcall 只改变成本，不改变 self 注入合同。

### 源码节选

```c
/* 把函数绑定到对象。生产实现的核心只有这个分支。 */
static PyObject *
func_descr_get(PyObject *func, PyObject *obj, PyObject *type)
{
    // 通过类访问 C.method 时，不绑定任何实例。
    if (obj == Py_None || obj == NULL) {
        return Py_NewRef(func);
    }
    // 通过实例访问 obj.method 时，创建保存 func 与 obj 的 method。
    return PyMethod_New(func, obj);
}
```

## 导读

类体中的 def 创建普通函数对象并把它存入类字典。函数类型实现 __get__，所以 obj.method 会临时产生绑定方法，内部保存 __func__ 与 __self__；调用绑定方法时，__self__ 被自动放到参数列表最前面。

self 并不是语法关键字，也没有在函数定义阶段神秘注入。C.method(obj, arg) 与 obj.method(arg) 的核心调用目标相同，差别只在前者由调用者显式给实例，后者由 descriptor 返回的 MethodType 预绑定。

函数属于 non-data descriptor，因此实例可以用同名属性遮蔽方法。框架若依赖实例方法不可替换，需要显式限制实例字典、使用 data descriptor 或在调用前从类型读取函数。

## 核心机制

- C.__dict__["method"] 是 function；C.method 通常仍是 function，因为 __get__(None, C) 返回自身。
- obj.method 是 method 对象，obj.method.__self__ is obj，obj.method.__func__ is C.__dict__["method"]。
- 每次属性读取可以创建新的 method 包装对象，因此 obj.method is obj.method 通常为 False。
- method 调用走 vectorcall 等优化路径，但语义上等价于 function(instance, *args, **kwargs)。

## 常见误区

- 把 obj.method 保存为长期 callback，意外让 method 通过 __self__ 延长实例生命周期。
- 比较两次 obj.method 的身份判断监听器是否相同，忽略包装对象可重复创建。
- 给实例写入同名非 callable 值，后续方法调用变成运行时 TypeError。

## 可运行示例

```python
from types import MethodType

class Greeter:
    def greet(self, name):
        return f"{id(self)}:{name}"

obj = Greeter()
function = Greeter.__dict__["greet"]
bound = obj.greet

assert bound.__self__ is obj
assert bound.__func__ is function
assert bound("Ada") == function(obj, "Ada")
assert isinstance(bound, MethodType)
```

## 搭积木复现

### 拆开 function 与 method

同时打印类字典原函数、类访问结果和实例访问结果，比较类型、__func__、__self__。

### 手写 Function.__get__

返回 MethodType(self, obj)，并处理 obj is None；用自定义 descriptor 复现绑定。

### 验证生命周期

保存 bound method 后删除原实例名称，用 weakref 证明 __self__ 仍持有实例；再比较 weak method 方案。

## 自检

### 问题

为什么 obj.method(arg) 能自动传入 self，而 obj.__dict__ 中通常找不到 method？

### 站内答案

method 位于类字典，是实现 __get__ 的函数 descriptor。object.__getattribute__ 在实例字典未命中后调用 function.__get__(obj, type(obj))，得到保存 obj 的绑定方法；调用它时绑定对象作为第一个参数传给原函数。
