---
id: "python-02-01"
track: "python"
title: "实例字典、类字典与查找入口"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "Data model · Custom classes"
url: "https://docs.python.org/3/reference/datamodel.html#custom-classes"

类对象和通常的实例分别拥有命名空间。属性表达式不会简单地把两个字典合并，而是进入类型定义的属性访问协议。

## 导读

普通实例的 __dict__ 保存这个实例独有的动态属性，类的 __dict__ 保存由类体创建的属性、函数和 descriptor。类字典实际由 mappingproxy 暴露只读视图，修改类属性应通过 setattr(cls, name, value) 进入类型协议。

读取 obj.name 时，解释器以 type(obj) 为起点查 MRO，并同时考虑 descriptor 与实例字典；写入 obj.name 通常落到实例字典，但 data descriptor 或自定义 __setattr__ 可以截获它。由此可见，“先查实例再查类”只是缺少 descriptor 时的近似说法。

同名实例字段会 shadow 普通类变量和 non-data descriptor，却压不过 data descriptor。课程后续会把这张优先级表逐项实现；这一节先建立两个命名空间和同名遮蔽的可观察模型。

## 核心机制

- class 语句先执行类体形成临时 namespace，再由 metaclass 创建类对象。
- C.__dict__ 是 mappingproxy，反映真实类字典但阻止绕过 type.__setattr__ 直接写入。
- 普通实例在布局允许时持有 __dict__；slots 实例可能完全没有实例字典。
- 类属性更新会使类型查找缓存失效，现有实例下次读取可立即观察到新值。

## 常见误区

- 直接写 C.__dict__["x"]，忽略 mappingproxy 只读且类修改需要使内部缓存失效。
- 把 obj.x = value 误认为会修改 C.x；普通赋值会在实例字典创建同名遮蔽项。
- 使用 vars(obj) 作为所有对象通用接口，忽略 slots、C 扩展对象和代理对象可能没有 __dict__。

## 可运行示例

```python
class Service:
    timeout = 10

first = Service()
second = Service()

first.timeout = 3
assert first.__dict__ == {"timeout": 3}
assert second.__dict__ == {}
assert first.timeout == 3
assert second.timeout == 10

Service.timeout = 20
assert first.timeout == 3       # 实例字段继续遮蔽
assert second.timeout == 20     # 仍从类字典读取
```

## 搭积木复现

### 画出两个命名空间

分别列出 Service.__dict__、first.__dict__、second.__dict__，在每次赋值后更新名称到对象的边。

### 制造同名 shadowing

先读类变量，再写实例变量，最后修改类变量；用三个断言解释可见范围。

### 引入 slots 反例

创建无 __dict__ 的 slots 类，验证固定字段仍通过 descriptor 工作，实例字典并非属性系统的必需部件。

## 自检

### 问题

为什么修改 Service.timeout 能影响尚未写入 timeout 的所有实例，却不会覆盖 first.timeout？

### 站内答案

未写入的实例没有同名实例项，读取会继续走到类字典；first 已在自己的字典中建立遮蔽项，普通类变量属于 non-data 路径，实例项优先。若类上放的是 data descriptor，优先级会反过来。
