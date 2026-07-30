---
id: "python-07-06"
track: "python"
title: "协变、逆变、不变与可变性证明"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "Typing specification · Variance inference"
url: "https://typing.python.org/en/latest/spec/generics.html#variance-inference"

类型参数只用于输出可推断协变，只用于输入可推断逆变，同时读写通常不变；3.12 语法可由 checker 推断。

## 导读

若 Cat <: Animal，Producer[Cat] 可替代 Producer[Animal]，这是协变；Consumer[Animal] 可替代 Consumer[Cat]，这是逆变。可读可写 Box[Cat] 不能当 Box[Animal]，否则调用者可能写入 Dog，所以保持不变。

方差属于 generic type constructor，不是某个变量的属性。证明方法是把 T 出现位置按“数据流出/流入”追踪，并考虑 Callable 参数会反转一次位置。

## 核心机制

- 不可变容器的读取接口常协变，可变容器通常不变。
- 回调参数类型常逆变，返回类型协变。
- 私有/Final 存储可帮助 checker 推断只读类协变。
- ParamSpec 与 TypeVarTuple 按规范保持不变。

## 常见误区

- 背诵 list invariant 却不能构造写入反例。
- 给可写 Protocol 强行声明 covariant。
- 把子类关系方向直接复制到 Consumer，遗漏输入位置反转。

## 可运行示例

```python
from typing import Protocol

class Animal: ...
class Cat(Animal): ...

class Producer[T_co](Protocol):
    def produce(self) -> T_co: ...

class Consumer[T_contra](Protocol):
    def consume(self, value: T_contra) -> None: ...

def feed(source: Producer[Cat], sink: Consumer[Cat]) -> None:
    sink.consume(source.produce())

# Producer[Cat] 可用于需要 Producer[Animal] 的只读位置；
# Consumer[Animal] 可用于需要 Consumer[Cat] 的位置。
```

## 搭积木复现

### 写替换反例

对每个候选方差假设构造调用者允许的读写，找出是否能写入错误类型。

### 标注正负位置

返回为正、参数为负，嵌套 Callable 每穿过参数位置反转一次。

### 用 checker 验证

为 Producer、Consumer、Box 写合法/非法赋值样例并锁定诊断。

## 自检

### 问题

为什么 list[Cat] 不能赋给 list[Animal]，即使 Cat 是 Animal？

### 站内答案

接收 list[Animal] 的代码有权 append(Dog)。若实际对象是 list[Cat]，写入后再按 Cat 读取就不安全。读写接口让元素类型同时处于输出和输入位置，因此 list 必须不变。
