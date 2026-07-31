---
id: "python-02-08"
track: "python"
title: "super() 与 cooperative inheritance"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-02-08.md"
---

## 官方入口

title: "Built-in functions · super"
url: "https://docs.python.org/3/library/functions.html#super"

super(type, obj) 从 obj 的 MRO 中 type 之后的位置继续属性查找；零参数 super 由编译器提供当前类和第一个参数。

## 真实源码

repo: "python/cpython"
file: "Objects/typeobject.c"
symbol: "super_getattro"
language: "c"
url: "https://github.com/python/cpython/blob/main/Objects/typeobject.c#L11754-L11767"

### 逐段讲解

- superobject 同时保存起点 type、绑定 obj 和实际 obj_type，三者缺一不可。
- 真正的下一站由 do_super_lookup 根据实际 MRO 计算，并非编译期固定父类。
- 找到属性后仍会执行 descriptor 绑定，所以方法最终继续绑定原实例。
- __class__ 单独走普通属性路径，避免代理把绑定对象的类冒充为自身类型。

### 源码节选

```c
static PyObject *
super_getattro(PyObject *self, PyObject *name)
{
    superobject *su = superobject_CAST(self);

    // super.__class__ 描述代理自身，而不是 su->obj 的实际类型。
    if (PyUnicode_Check(name) &&
        PyUnicode_GET_LENGTH(name) == 9 &&
        _PyUnicode_Equal(name, &_Py_ID(__class__)))
    {
        return PyObject_GenericGetAttr(self, name);
    }

    // 其余名称从 su->type 之后，在 su->obj_type 的 MRO 中继续。
    return do_super_lookup(
        su, su->type, su->obj, su->obj_type, name, NULL);
}
```

## 导读

super 不是“调用父类”的缩写。它创建一个代理，记住当前起点类和绑定对象，然后沿绑定对象实际类型的 MRO 从起点之后继续搜索。diamond 中同一祖先因此只会在一条 cooperative 链上执行一次。

零参数 super() 依赖编译器创建的 __class__ cell 和函数第一个参数。把包含 super() 的方法随意复制到另一个类、嵌套函数或缺少实例参数的位置，可能破坏隐式上下文。

cooperative inheritance 要求链上的实现使用兼容签名、消费自己负责的参数、把剩余参数继续传给 super，并确保终点能接受它们。任何一层硬编码某个基类，都会绕开 MRO 中其他参与者。

## 核心机制

- super(Current, obj).name 在 type(obj).__mro__ 找到 Current，随后从下一项开始。
- 找到 descriptor 后仍调用其 __get__，并把原实例绑定给返回方法。
- 类方法中的 super() 绑定类而非实例，同样沿实际 cls 的 MRO 工作。
- 改变父类列表会改变 cooperative 调用顺序，因此每层应只承担局部职责。

## 常见误区

- 写 Base.__init__(self) 硬跳到固定父类，让 diamond 的另一条分支被跳过或祖先执行两次。
- 多继承各层签名不兼容，某层漏传或重复消费关键字参数。
- 认为 super().method 一定来自直接父类，调试时忽略对象实际类型和完整 MRO。

## 可运行示例

```python
class Root:
    def render(self, **options):
        assert not options
        return ["root"]

class Audit(Root):
    def render(self, *, audit=False, **options):
        result = super().render(**options)
        return ["audit"] + result if audit else result

class Cache(Root):
    def render(self, *, cache=False, **options):
        result = super().render(**options)
        return ["cache"] + result if cache else result

class Service(Audit, Cache):
    pass

assert Service.__mro__ == (Service, Audit, Cache, Root, object)
assert Service().render(audit=True, cache=True) == ["audit", "cache", "root"]
```

## 搭积木复现

### 先打印完整 MRO

在写 super 调用前列出实际子类 MRO，预测每一层下一站，拒绝只说“父类”。

### 统一关键字合同

每层只消费自己的 keyword-only 参数，其余 **options 原样转发，根节点断言没有遗留。

### 制造硬编码反例

把一层 super 改成固定 Base.method，记录哪条分支被跳过或重复执行。

## 自检

### 问题

在 Service(Audit, Cache) 中，Audit 里的 super().render 为什么会进入 Cache，而非 Audit 的语法父类 Root？

### 站内答案

super 以 Audit 为 MRO 起点，并使用 self 的实际类型 Service。Service.__mro__ 中 Audit 后一项是 Cache，所以查找进入 Cache；这种动态下一站正是 cooperative diamond 能让每层恰好执行一次的基础。
