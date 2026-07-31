---
id: "python-07-03"
track: "python"
title: "泛型函数推断、overload 与实现签名"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-07-03.md"
---

## 官方入口

title: "Typing spec · Overload definitions"
url: "https://typing.python.org/en/latest/spec/overload.html"

overload variants 描述调用者可见关系，实现签名负责运行时分派且需兼容所有 variants，但调用时通常不可见。

## 导读

泛型调用从实参、上下文返回类型和约束收集候选，再求满足全部使用点的类型实参。overload 则先展开参数兼容性，按规范规则选择 variant；实现签名只检查实现能否覆盖所有分支，不给调用者兜底。

overload 适合返回类型由参数字面量、参数组合或位置决定且普通 TypeVar 无法表达的 API。分支顺序要与运行时判断顺序一致，重叠分支必须返回兼容类型，否则静态选择与真实行为可能相反。

## 核心机制

- variant 只写 ...，紧跟单个运行时实现。
- 实现参数应接受所有 variant 输入，返回应覆盖全部 variant 输出。
- Literal 可表达值依赖分支，TypeVar 更适合同型关系。
- Any 和 Union 参数会触发不确定匹配与联合返回规则。

## 常见误区

- 加一个宽泛最后 variant 掩盖错误调用。
- 静态 overload 顺序与运行时 isinstance 顺序不一致。
- 实现签名通过却假设调用者能看到其更宽输入。

## 可运行示例

```python
from typing import Literal, overload

@overload
def decode(raw: bytes, *, text: Literal[False] = False) -> bytes: ...
@overload
def decode(raw: bytes, *, text: Literal[True]) -> str: ...

def decode(raw: bytes, *, text: bool = False) -> bytes | str:
    return raw.decode() if text else raw

assert decode(b"x") == b"x"
assert decode(b"x", text=True) == "x"
```

## 搭积木复现

### 列调用矩阵

先列每种参数组合与返回，再决定 TypeVar、Literal 或 overload。

### 检查覆盖与重叠

为每个 variant 找到运行时分支，并证明实现参数/返回兼容。

### 锁定推断

用 assert_type 覆盖 literals、普通 bool、Any、Union 与非法组合。

## 自检

### 问题

为什么 overload 的实现签名通常不作为调用者最后一个候选？

### 站内答案

实现签名是内部运行时容器，常被迫写得更宽以容纳全部分支；若公开参与匹配，错误调用会落到宽签名而失去静态检查。调用合同由 variants 定义，实现只需证明能兑现它们。
