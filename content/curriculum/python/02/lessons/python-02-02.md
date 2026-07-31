---
id: "python-02-02"
track: "python"
title: "object.__getattribute__ 完整查找链"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-02-02.md"
---

## 官方入口

title: "Descriptor Guide · Invocation from an instance"
url: "https://docs.python.org/3/howto/descriptor.html#invocation-from-an-instance"

object.__getattribute__ 实现实例属性读取主链：data descriptor、实例字典、non-data descriptor、普通类变量，全部失败后才由点号表达式触发 __getattr__。

## 真实源码

repo: "python/cpython"
file: "Objects/object.c"
symbol: "_PyObject_GenericGetAttrWithDict"
language: "c"
url: "https://github.com/python/cpython/blob/main/Objects/object.c#L1767-L1890"

### 逐段讲解

- 上游源码先从类型和 MRO 找类属性，descriptor 判定早于实例字典。
- PyDescr_IsData 决定最高优先级分支，和课程手写版的 is_data 完全对应。
- 实例存储在新版本中可能是 inline values、managed dict 或传统 dict pointer，属于同一语义的多种布局优化。
- non-data descriptor 被刻意放在实例字典之后，普通类变量则是最后一个成功分支。

### 源码节选

```c
PyObject *
_PyObject_GenericGetAttrWithDict(
    PyObject *obj, PyObject *name, PyObject *dict, int suppress)
{
    PyTypeObject *tp = Py_TYPE(obj);
    PyObject *descr = NULL;
    PyObject *res = NULL;
    descrgetfunc f = NULL;

    // ① 先沿类型 MRO 查找类属性，并取得其 tp_descr_get。
    _PyType_LookupStackRefAndVersion(tp, name, &cref.ref);
    descr = PyStackRef_AsPyObjectBorrow(cref.ref);
    if (descr != NULL) {
        f = Py_TYPE(descr)->tp_descr_get;
        // ② data descriptor 拥有最高读取优先级。
        if (f != NULL && PyDescr_IsData(descr)) {
            res = f(descr, obj, (PyObject *)Py_TYPE(obj));
            goto done;
        }
    }

    // ③ 随后读取实例字典或 inline values。
    if (dict != NULL && PyDict_GetItemRef(dict, name, &res) != 0) {
        goto done;
    }

    // ④ 实例未命中时才调用 non-data descriptor。
    if (f != NULL) {
        res = f(descr, obj, (PyObject *)Py_TYPE(obj));
        goto done;
    }
    // ⑤ 最后返回普通类变量，否则构造 AttributeError。
}
```

## 导读

每一次 obj.name 都先进入 type(obj) 的 tp_getattro 槽，普通 Python 类通常落到 PyObject_GenericGetAttr。它先沿 MRO 找类属性，并检查该属性的类型是否提供 __get__、__set__ 或 __delete__，然后才决定实例字典和类属性谁优先。

最容易漏掉的细节是 descriptor 身份由“类属性对象的类型”决定。某个对象拥有名为 __get__ 的实例字段并不够；协议查找会在 type(descriptor) 上寻找特殊方法，避免 descriptor 自身的实例属性再次触发无限元协议。

__getattribute__ 必须对所有名称运行，包括读取 helper、__dict__ 和 __class__。自定义实现若用 self.__dict__ 继续取值，会再次进入自己，形成递归；安全做法是调用 object.__getattribute__(self, name) 获取原始基础能力。

## 核心机制

- find_name_in_mro(type(obj), name) 返回首个类字典命中，并受 C3 线性化顺序约束。
- 命中对象的类型若定义 __get__ 且还定义 __set__ 或 __delete__，它是 data descriptor，优先于实例字典。
- 无 data descriptor 时检查实例字典；随后调用 non-data descriptor.__get__ 或直接返回类变量。
- 主链抛出 AttributeError 后，点号和 getattr 才查找类上的 __getattr__；直接调用 object.__getattribute__ 不包含该兜底。

## 常见误区

- 在自定义 __getattribute__ 中使用 getattr(self, name) 或 self.__dict__，无限递归直到 RecursionError。
- 把 descriptor 判定写成 hasattr(cls_var, "__get__")，与 CPython 的特殊方法类型查找语义不一致。
- 吞掉属性内部执行产生的所有 AttributeError，并错误地交给 __getattr__，掩盖真实业务 bug。

## 可运行示例

```python
def find_in_mro(cls, name, missing):
    for base in cls.__mro__:
        if name in vars(base):
            return vars(base)[name]
    return missing

def object_getattribute(obj, name):
    missing = object()
    obj_type = type(obj)
    class_value = find_in_mro(obj_type, name, missing)
    descriptor_type = type(class_value)
    descriptor_get = getattr(descriptor_type, "__get__", missing)

    is_data = descriptor_get is not missing and (
        hasattr(descriptor_type, "__set__")
        or hasattr(descriptor_type, "__delete__")
    )
    if is_data:
        return descriptor_get(class_value, obj, obj_type)

    namespace = vars(obj)
    if name in namespace:
        return namespace[name]

    if descriptor_get is not missing:
        return descriptor_get(class_value, obj, obj_type)
    if class_value is not missing:
        return class_value
    raise AttributeError(name)
```

## 搭积木复现

### 只实现 MRO 查找

先写 find_in_mro 并验证多继承的首个命中，暂不加入 descriptor。

### 加入 data descriptor 分支

从 type(class_value) 读取协议方法，把最高优先级分支放到实例字典之前。

### 补齐实例与 non-data 分支

加入实例字典、non-data descriptor、普通类变量和 AttributeError，逐个构造测试。

### 与内建结果差分测试

对普通字段、property、函数、cached_property 和缺失字段同时调用模拟器与 getattr，比较结果和异常类型。

## 自检

### 问题

为什么 data descriptor 的判断要查看 type(class_value)，而不是 class_value 自己的实例字典？

### 站内答案

Python 的特殊方法通常隐式从类型上解析，descriptor 协议也遵循这一规则。这样协议行为由 descriptor 类稳定定义，不会因某个 descriptor 实例动态塞入 __get__ 而改变解释器分派，也避免协议查找递归进入同一属性系统。
