---
id: "python-01-10"
track: "python"
title: "__slots__ 的布局影响"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-01-10.md"
---

## 官方入口

title: "Data model · __slots__"
url: "https://docs.python.org/3/reference/datamodel.html#slots"

__slots__ 为指定属性创建 member descriptor，并通常省去每实例 __dict__；它改变布局、继承和弱引用能力。

## 导读

普通实例把动态属性放进实例字典，灵活但每个实例需要字典相关存储。__slots__ 在类创建时声明固定字段，类型系统为每个字段安装 member descriptor，值存放在实例布局的固定偏移。

节省多少内存取决于实例数量、字段数、继承和 Python 版本。slots 的主要语义是限制动态属性表面；性能提升属于需要基准验证的副作用，不能只比较 sys.getsizeof(instance) 而漏掉普通实例的 __dict__。

继承会让布局变复杂：子类未声明 slots 会重新获得 __dict__；多继承中多个非空 slots 基类可能发生布局冲突；需要弱引用时还要把 __weakref__ 放进 slots。

## 核心机制

- 类创建阶段把 slot 名称转换为 descriptor，descriptor 按固定 offset 读写实例内存。
- 没有 __dict__ 时，未声明属性赋值会抛 AttributeError。
- 声明 "__dict__" 可恢复动态属性，声明 "__weakref__" 可恢复弱引用支持。
- dataclass(slots=True) 会生成 slots 类，但继承、pickle 和框架反射仍需测试。

## 常见误区

- 用 slots 代替输入校验或真正的不可变性；已有 slot 字段仍可被重新赋值。
- 只量实例本体大小就宣称节省比例，遗漏普通类的字典、共享 key 与分配器粒度。
- 在大量依赖 __dict__ 的序列化、ORM 或调试工具中启用 slots，却没有兼容测试。

## 可运行示例

```python
class Point:
    __slots__ = ("x", "y", "__weakref__")

    def __init__(self, x, y):
        self.x = x
        self.y = y

point = Point(1, 2)
assert not hasattr(point, "__dict__")

try:
    point.label = "origin"
except AttributeError:
    pass
else:
    raise AssertionError("未声明字段不应被创建")
```

## 搭积木复现

### 比较两种布局

创建字段相同的普通类和 slots 类，同时统计实例、__dict__ 与批量分配后的 tracemalloc 差值。

### 观察 descriptor

检查 Point.__dict__["x"]，调用其 __get__/__set__，理解 slot 仍然走属性协议。

### 覆盖继承边界

分别测试 slots 子类、普通子类、多继承、weakref 和 pickle，记录你的框架真正支持哪些组合。

## 自检

### 问题

__slots__ 为什么既是内存布局选择，也是公共 API 选择？

### 站内答案

它把任意动态属性改成预声明字段，影响反射、序列化、继承和扩展能力；调用者过去能附加的元数据可能直接失败。因此启用 slots 需要把节省的实际数据与失去的扩展表面一起评估。
