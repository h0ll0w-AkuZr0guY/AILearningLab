---
id: "python-07-04"
track: "python"
title: "Protocol 结构子类型与 runtime_checkable 边界"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "typing specification · Protocols"
url: "https://typing.python.org/en/latest/spec/protocol.html"

显式 Protocol 定义结构合同；实现类无需继承。runtime_checkable 只提供有限的属性存在检查，不校验完整签名。

## 导读

Protocol 把依赖方向从“继承某基类”改为“提供这些成员”。第三方类型可在不感知协议的情况下满足合同，特别适合端口、适配器和小接口。

@runtime_checkable 仅让 isinstance/issubclass 做浅层成员存在判断，通常不验证参数类型、返回类型或属性可写性。它适合 feature detection，不可替代数据验证与静态 checker。

## 核心机制

- 协议成员包括方法与带类型的 data attributes。
- 可变属性使类型参数倾向不变，readonly property 可允许协变。
- 显式继承 Protocol 的具体类仍需实现抽象成员才能实例化。
- runtime protocol 成员集合在类创建后冻结。

## 常见误区

- 把巨大对象所有成员塞进一个 Protocol，造成结构耦合。
- isinstance(x, P) 通过后假定签名与泛型参数正确。
- 协议声明可写字段却希望协变，破坏写入安全。

## 可运行示例

```python
from typing import Protocol, runtime_checkable

@runtime_checkable
class Reader(Protocol):
    def read(self, size: int = -1) -> bytes: ...

class SocketLike:
    def read(self, size=-1):
        return b"data"

reader: Reader = SocketLike()
assert reader.read(2) == b"data"
assert isinstance(reader, Reader)  # 只确认 read 存在，不证明其签名。
```

## 搭积木复现

### 从消费者抽取

只把调用方实际使用的成员放进协议，避免复制实现类完整 API。

### 做正反实现

一个隐式满足、一个缺成员、一个签名错误，用 checker 与 runtime check 对照。

### 证明可变性

把 attribute 分别声明为可写字段和只读 property，观察方差结论。

## 自检

### 问题

runtime_checkable Protocol 的 isinstance 通过，为什么仍不能保证调用安全？

### 站内答案

运行时检查主要确认成员名称存在，不做完整类型签名、overload、泛型实参和可写性验证。对象可能有同名但参数完全不同的方法。静态兼容由 checker 证明，运行时输入仍需独立验证。
