---
id: "python-02-04"
track: "python"
title: "data 与 non-data descriptor 优先级"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-02-04.md"
---

## 官方入口

title: "Descriptor Guide · Summary of invocation logic"
url: "https://docs.python.org/3/howto/descriptor.html#summary-of-invocation-logic"

定义 __set__ 或 __delete__ 的 descriptor 属于 data descriptor，优先于实例字典；只定义 __get__ 的 non-data descriptor 可以被实例同名项遮蔽。

## 导读

descriptor 是放在类字典中的对象，它通过 __get__、__set__、__delete__ 接管另一个对象的属性。优先级差异是有意设计：property、验证字段等 data descriptor 必须守住写入和读取不变量；函数、cached_property 等 non-data descriptor 则允许实例缓存或覆盖。

data 的判定不取决于 __set__ 是否真的允许赋值。只要 descriptor 类型定义 __set__，即使实现总是抛 AttributeError，它仍压过实例字典，这正是只读 property 能阻止同名实例字段绕过的原因。

cached_property 反向利用 non-data 规则：第一次 __get__ 计算结果并写入实例字典，下一次实例字典在 descriptor 之前命中，从此不再执行 descriptor。

## 核心机制

- __get__(descriptor, instance, owner) 在实例访问时接收对象，在类访问时 instance 通常为 None。
- __set__ 或 __delete__ 任意存在即可获得 data descriptor 优先级。
- 实例字典位于 data descriptor 之后、non-data descriptor 之前。
- descriptor 必须定义在类或其 MRO 上；把 descriptor 对象塞进实例字典不会自动调用协议。

## 常见误区

- 认为只读 descriptor 只需 __get__，结果被实例字典轻易遮蔽；应提供抛 AttributeError 的 __set__。
- 在 __get__ 内用 instance.public_name 读取自身，重新触发同一 descriptor。
- 把 descriptor 存在每个实例里，既浪费内存又没有协议调用效果。

## 可运行示例

```python
class Positive:
    def __set_name__(self, owner, name):
        self.storage_name = f"_{name}"

    def __get__(self, instance, owner=None):
        if instance is None:
            return self
        return instance.__dict__[self.storage_name]

    def __set__(self, instance, value):
        if value <= 0:
            raise ValueError("必须为正数")
        instance.__dict__[self.storage_name] = value

class Product:
    price = Positive()

item = Product()
item.price = 12
item.__dict__["price"] = -1       # 尝试同名绕过
assert item.price == 12           # data descriptor 仍然优先
```

## 搭积木复现

### 实现 non-data 版本

只写 __get__，在实例字典放入同名值，确认它能遮蔽 descriptor。

### 增加 __set__ 升级为 data

即使 __set__ 只抛错，实例同名项也不再优先；用完全相同的测试对比。

### 复现 cached_property

non-data __get__ 首次计算后写入公开名称，让后续读取直接走实例字典。

## 自检

### 问题

为什么“定义一个永远抛错的 __set__”仍会改变读取优先级？

### 站内答案

解释器按 descriptor 类型是否提供写入协议分类，而不预执行其业务逻辑。存在 __set__ 表示这个字段希望统一控制写边界，因此读取也必须优先经过 descriptor，避免调用者向实例字典塞入同名值绕过只读或验证合同。
