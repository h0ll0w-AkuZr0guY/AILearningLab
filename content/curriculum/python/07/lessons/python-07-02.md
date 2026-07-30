---
id: "python-07-02"
track: "python"
title: "TypeVar：约束、bound、default 与解算结果"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "typing.TypeVar"
url: "https://docs.python.org/3/library/typing.html#typing.TypeVar"

constraints 限定离散候选并提升到成员类型；bound 接受上界子类型并保留推断出的具体类型；default 在未推断时使用。

## 导读

TypeVar 表达多处类型之间的关系，不等于 Union。约束 TypeVar(str, bytes) 要求一次调用统一选择其中一个成员，子类通常提升为对应成员；bound=SupportsAbs 允许任意满足上界的具体类型并保留该具体类型。

default 是调用点无法从参数推断类型实参时的后备值，不会放宽 bound/constraints。API 应先问需要“有限模式选择”还是“开放扩展的上界”，再决定约束或 bound。

## 核心机制

- 同一 TypeVar 在参数与返回位置建立相关性。
- constraints 至少两个且不能与 bound 同时使用。
- 显式类型实参与参数证据共同参与解算。
- Any 可能污染解算并把未知传播到返回值。

## 常见误区

- 用 Union[T1,T2] 替代 constrained TypeVar，丢失输入输出同型关系。
- bound 写成具体实现类，阻断结构兼容扩展。
- 为方便把 default=Any，掩盖调用点缺失的类型证据。

## 可运行示例

```python
from typing import TypeVar

AnyText = TypeVar("AnyText", str, bytes)
Comparable = TypeVar("Comparable", bound="SupportsLessThan")

def concat(left: AnyText, right: AnyText) -> AnyText:
    return left + right

assert concat("a", "b") == "ab"
assert concat(b"a", b"b") == b"ab"
# concat("a", b"b") 在静态检查中失败：一次调用无法选择同一约束成员。
```

## 搭积木复现

### 写关系测试

用 reveal_type 或 assert_type 证明返回类型随参数改变，而非只检查“能否通过”。

### 比较三模型

为同一 API 分别用 Union、constraints、bound，记录子类和混合参数推断差异。

### 审计 Any

对无注解依赖和 Any 输入加回归样例，防止返回契约静默退化。

## 自检

### 问题

TypeVar("T", str, bytes) 与 T bound=str|bytes 的推断差异是什么？

### 站内答案

constraints 从离散集合选择成员，str 子类输入通常被提升为 str；bound 接受上界之下的具体子类型，解算可保留子类。前者适合有限实现模式，后者适合开放的多态接口。
