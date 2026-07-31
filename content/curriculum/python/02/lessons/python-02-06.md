---
id: "python-02-06"
track: "python"
title: "classmethod 与 staticmethod descriptor"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-02-06.md"
---

## 官方入口

title: "Descriptor Guide · Kinds of methods"
url: "https://docs.python.org/3/howto/descriptor.html#kinds-of-methods"

staticmethod 读取时返回底层 callable 而不绑定参数；classmethod 读取时把实际访问类绑定为第一个参数。

## 真实源码

repo: "python/cpython"
file: "Objects/funcobject.c"
symbol: "cm_descr_get / sm_descr_get"
language: "c"
url: "https://github.com/python/cpython/blob/main/Objects/funcobject.c#L1353-L1360"

### 逐段讲解

- 两个包装器的区别完整集中在 __get__ 对返回 callable 的处理。
- classmethod 复用 PyMethod_New，只是 __self__ 从实例换成了实际访问类。
- staticmethod 既不绑定实例也不绑定类，类和实例参数在读取时都被忽略。
- 源码没有“静态方法调用协议”；它们仍然是 descriptor 属性查找。

### 源码节选

```c
static PyObject *
cm_descr_get(PyObject *self, PyObject *obj, PyObject *type)
{
    classmethod *cm = (classmethod *)self;
    if (type == NULL) {
        type = (PyObject *)Py_TYPE(obj);
    }
    // classmethod 把实际 owner 绑定成第一个参数。
    return PyMethod_New(cm->cm_callable, type);
}

static PyObject *
sm_descr_get(PyObject *self, PyObject *obj, PyObject *type)
{
    staticmethod *sm = (staticmethod *)self;
    // staticmethod 忽略 obj 与 type，原样返回 callable。
    return Py_NewRef(sm->sm_callable);
}
```

## 导读

staticmethod 和 classmethod 都是放入类字典的包装 descriptor。staticmethod 的 __get__ 忽略 instance 与 owner，直接返回底层函数；classmethod 则把 owner 绑定给函数，所以无论通过类还是实例访问，第一个参数都是实际类。

classmethod 适合替代构造器和多态工厂，因为子类调用 Base.from_config 时绑定的是子类，返回 cls(...) 可以保持派生类型。staticmethod 适合逻辑上归属于类、却完全不需要实例和类状态的纯函数。

两者都不等同于 Java 式静态成员。Python 仍先对类属性执行 descriptor 协议，继承和覆盖也由 MRO 控制。模块级函数往往比为了“组织名字”而滥用 staticmethod 更直接。

## 核心机制

- 装饰器在类体执行时接收 function，返回 staticmethod/classmethod 包装对象。
- classmethod.__get__ 产生以 owner 为 __self__ 的绑定方法。
- 通过子类访问 inherited classmethod 时 owner 是子类，实现虚拟构造器。
- 包装对象的 __wrapped__、元数据传播和装饰器组合顺序会影响反射工具。

## 常见误区

- 替代构造器硬编码 Base(...)，使子类调用仍返回基类，破坏多态。
- staticmethod 内偷偷读取全局可变状态，却因名字“static”被误认为纯函数。
- 任意叠加 property、classmethod 和自定义装饰器，忽略 descriptor 只对类字典最终对象生效。

## 可运行示例

```python
class Endpoint:
    scheme = "https"

    def __init__(self, host):
        self.host = host

    @classmethod
    def from_url(cls, url):
        scheme, host = url.split("://", 1)
        if scheme != cls.scheme:
            raise ValueError("scheme 不匹配")
        return cls(host)

    @staticmethod
    def normalize_host(host):
        return host.strip().lower()

class InternalEndpoint(Endpoint):
    pass

result = InternalEndpoint.from_url("https://API.LOCAL")
assert type(result) is InternalEndpoint
assert Endpoint.normalize_host(" API.LOCAL ") == "api.local"
```

## 搭积木复现

### 写绑定矩阵

比较普通函数、staticmethod、classmethod 经类访问和实例访问后的 __self__ 与调用参数。

### 实现两个纯 Python descriptor

StaticMethod.__get__ 返回 self.f；ClassMethod.__get__ 返回 MethodType(self.f, owner)。

### 用子类检验工厂

子类调用替代构造器，断言返回子类；这比只测试基类更能证明 classmethod 的价值。

## 自检

### 问题

为什么 classmethod 替代构造器应调用 cls(...)，而不应写死定义它的基类？

### 站内答案

descriptor 绑定的 owner 会随访问类变化，子类调用时 cls 就是子类。写 cls(...) 才能把继承带来的多态延伸到对象创建；写死基类会丢失子类字段、验证和返回类型。
