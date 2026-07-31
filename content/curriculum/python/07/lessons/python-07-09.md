---
id: "python-07-09"
track: "python"
title: "TypeGuard、TypeIs 与双分支收窄"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "typing.TypeIs"
url: "https://docs.python.org/3/library/typing.html#typing.TypeIs"

TypeIs 的目标类型必须兼容输入，并在 true/false 两侧做交集/排除收窄；TypeGuard 主要只承诺 true 分支。

## 导读

用户定义谓词让 checker 信任函数签名中的逻辑证明。TypeGuard 可把输入在真分支改成目标类型，甚至目标并非原类型的严格子类型；假分支通常不排除目标。TypeIs 更接近 isinstance，要求兼容并收窄两侧。

checker 不会验证函数实现真的证明了声明。错误谓词等同于不安全 cast，会把运行时失败推迟到更远位置；谓词应小而纯，并用正反例测试。

## 核心机制

- 收窄对象通常是首个显式参数，方法中是 self 后的参数。
- TypeIs true 分支取已有类型与目标交集，false 分支排除目标。
- TypeGuard 常用于 invariant 容器的更强承诺。
- 谓词内部实现与声明的一致性由作者承担。

## 常见误区

- 只检查 list 第一项就声明 TypeGuard[list[str]]。
- 谓词修改被检查对象，引入检查后使用前的竞态。
- 期望 TypeGuard false 分支自动得到补集。

## 可运行示例

```python
from typing import TypeIs

def is_str(value: object) -> TypeIs[str]:
    return isinstance(value, str)

def normalize(value: str | int) -> str:
    if is_str(value):
        return value.strip()  # value: str
    return str(value)         # value: int，false 分支也被收窄

assert normalize(" x ") == "x"
assert normalize(7) == "7"
```

## 搭积木复现

### 写集合解释

把输入类型视为集合，计算 true 的交集与 false 的差集。

### 证明谓词

为所有目标成员写正例，为相邻非成员写反例，禁止采样式检查。

### 对照两种返回

相同函数分别标 TypeGuard/TypeIs，用 reveal_type 比较两分支。

## 自检

### 问题

为什么错误的 TypeGuard/TypeIs 实现比普通 bool helper 更危险？

### 站内答案

bool helper 只影响运行时分支；类型谓词还向 checker 提交证明，使后续代码省略检查并调用特定成员。checker 通常不验证函数体与承诺一致，错误声明会系统性制造虚假安全。
