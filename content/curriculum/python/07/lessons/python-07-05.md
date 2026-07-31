---
id: "python-07-05"
track: "python"
title: "ABC 名义子类型、register 与 __subclasshook__"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "abc · Abstract Base Classes"
url: "https://docs.python.org/3/library/abc.html"

ABC 可通过继承、register 虚拟注册或 __subclasshook__ 影响 issubclass；虚拟子类不会获得实现，也不进入 MRO。

## 导读

ABC 同时提供名义合同与可复用实现。abstractmethod 阻止缺实现的名义子类实例化；register 把外部类声明为虚拟子类，只改变 issubclass/isinstance 结果，不注入方法。

__subclasshook__ 可按类字典结构判断兼容，返回 True/False/NotImplemented。它是全局运行时语义，过宽规则会让不满足行为合同的类被永久视为子类。

## 核心机制

- abstractmethod 可与 property/classmethod 组合，装饰器顺序有要求。
- register 返回被注册类，可作装饰器。
- 虚拟子类的 MRO 不包含 ABC，super 不会进入 ABC 实现。
- get_cache_token 可观察虚拟注册缓存失效。

## 常见误区

- register 后调用 ABC 提供的 concrete helper，虚拟类并未继承它。
- __subclasshook__ 只看一个同名属性就承诺复杂语义。
- 用 ABC 强迫第三方模型继承，增加不必要依赖。

## 可运行示例

```python
from abc import ABC, abstractmethod

class Repository(ABC):
    @abstractmethod
    def get(self, key: str) -> object: ...

class LegacyRepo:
    def get(self, key):
        return key

Repository.register(LegacyRepo)
assert issubclass(LegacyRepo, Repository)
assert Repository not in LegacyRepo.__mro__
```

## 搭积木复现

### 区分三条路径

分别测试继承、register、subclasshook 的实例化、MRO、方法获取和 isinstance。

### 约束 hook

只对非常稳定且可用名称检查的协议返回 True，其余返回 NotImplemented。

### 选择 ABC/Protocol

需要共享实现或运行时注册选 ABC；仅静态消费合同优先小 Protocol。

## 自检

### 问题

ABC.register 为什么不等价于继承？

### 站内答案

register 只把类加入虚拟子类关系，使 isinstance/issubclass 为真；它不修改目标类 MRO、不会复制 concrete methods，也不执行 abstractmethod 完整性检查。它是一项运行时分类声明，而非实现复用机制。
