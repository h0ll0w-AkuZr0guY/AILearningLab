---
id: "python-02-09"
track: "python"
title: "__set_name__ 与声明式字段收集"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-02-09.md"
---

## 官方入口

title: "Descriptor Guide · Automatic name notification"
url: "https://docs.python.org/3/howto/descriptor.html#automatic-name-notification"

type 创建类时会扫描类命名空间，对定义 __set_name__ 的属性调用 descriptor.__set_name__(owner, name)。类创建后再赋值需要手动通知。

## 真实源码

repo: "python/cpython"
file: "Objects/typeobject.c"
symbol: "type_new_set_names"
language: "c"
url: "https://github.com/python/cpython/blob/main/Objects/typeobject.c#L11368-L11410"

### 逐段讲解

- 复制类字典不是多余开销：__set_name__ 是用户回调，可能重入并修改原字典。
- _PyObject_LookupSpecial 从 descriptor 类型解析协议，与其他特殊方法保持一致。
- 回调参数正是新建 owner 和类字典中的 key，descriptor 构造阶段无需提前知道名称。
- 任一回调失败会终止类创建并附加说明，避免产生部分初始化的声明式模型。

### 源码节选

```c
static int
type_new_set_names(PyTypeObject *type)
{
    PyObject *dict = lookup_tp_dict(type);
    // 回调可能修改类字典，所以先复制稳定快照再迭代。
    PyObject *names_to_set = PyDict_Copy(dict);
    if (names_to_set == NULL) {
        return -1;
    }

    Py_ssize_t i = 0;
    PyObject *key, *value;
    while (PyDict_Next(names_to_set, &i, &key, &value)) {
        // 特殊方法从 value 的类型解析。
        PyObject *set_name = _PyObject_LookupSpecial(
            value, &_Py_ID(__set_name__));
        if (set_name == NULL) {
            if (PyErr_Occurred()) goto error;
            continue;
        }
        // descriptor.__set_name__(owner, attribute_name)
        PyObject *res = PyObject_CallFunctionObjArgs(
            set_name, type, key, NULL);
        Py_DECREF(set_name);
        if (res == NULL) goto error;
        Py_DECREF(res);
    }
    Py_DECREF(names_to_set);
    return 0;
error:
    Py_DECREF(names_to_set);
    return -1;
}
```

## 导读

descriptor 在类体执行时只是一个对象，构造函数并不知道自己最终被赋给哪个属性。type.__new__ 完成类对象后调用 __set_name__(owner, name)，让字段获得公开名称、私有存储名和所属模型。

ORM、验证框架和序列化器常用这一回调收集声明式字段。可靠实现不能直接修改继承来的共享 registry；子类应复制基类字段表，再加入当前类字段，避免一个子类污染兄弟类。

__set_name__ 只对类创建时命名空间中的对象自动运行。后续执行 Model.new_field = Field() 会经过 type.__setattr__，但不会自动补调 __set_name__；动态框架必须显式调用或集中提供注册 API。

## 核心机制

- 类体按准备好的 namespace 执行，descriptor 对象先以普通值形式进入 namespace。
- metaclass 创建 owner 后遍历 namespace，调用 type(attribute).__set_name__ 对应协议。
- 同一个 descriptor 实例若复用于多个类或名称，其内部 owner/name 可能被后一次覆盖，应禁止或保存多映射。
- 字段 registry 的继承策略应在 __init_subclass__ 或 metaclass 中显式定义。

## 常见误区

- 多个字段共用同一个 descriptor 实例，storage_name 被最后一个名称覆盖。
- 子类直接 append 到基类共享 _fields，导致兄弟类相互看见不属于自己的字段。
- 运行时 setattr 添加 Field 后期待自动初始化，直到首次读取才暴露缺失 storage_name。

## 可运行示例

```python
class Field:
    def __set_name__(self, owner, name):
        self.public_name = name
        self.storage_name = f"_{name}"

    def __get__(self, instance, owner=None):
        if instance is None:
            return self
        return getattr(instance, self.storage_name)

    def __set__(self, instance, value):
        if value is None:
            raise ValueError(f"{self.public_name} 不能为空")
        setattr(instance, self.storage_name, value)

class User:
    name = Field()

user = User()
user.name = "Ada"
assert user._name == "Ada"
assert User.name.public_name == "name"
```

## 搭积木复现

### 先记录名称

Field.__init__ 不接收字段名，完全依赖 __set_name__ 建立 public/storage 两个名称。

### 收集字段表

在 __init_subclass__ 中复制所有基类 registry，再扫描 cls.__dict__ 加入本类 Field。

### 支持动态注册

提供 add_field(cls, name, field)，内部先 setattr 再显式 field.__set_name__，并更新 registry。

### 验证继承隔离

创建两个兄弟子类分别添加字段，断言基类和另一兄弟的字段表未被污染。

## 自检

### 问题

为什么 Python 不在 descriptor.__init__ 时把属性名传进去？

### 站内答案

descriptor 构造发生在类体求值阶段，它只是右侧表达式的结果，尚不知道最终赋值目标，甚至可能被条件逻辑、别名或 metaclass 处理。类 namespace 完成后，type 才同时掌握 owner 与 name，因此 __set_name__ 是更稳定的通知时机。
