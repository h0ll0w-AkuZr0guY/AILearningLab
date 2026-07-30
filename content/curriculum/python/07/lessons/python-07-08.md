---
id: "python-07-08"
track: "python"
title: "TypedDict：Required、NotRequired、ReadOnly 与演进"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "typing.TypedDict"
url: "https://docs.python.org/3/library/typing.html#typing.TypedDict"

TypedDict 描述具有固定字符串键集合的 dict 静态形状；运行时仍是普通 dict，不做构造验证。

## 导读

TypedDict 适合 JSON-like 边界：每个键有独立类型，Required/NotRequired 决定存在性，ReadOnly 限制静态写入。total=False 只改变默认必需性，不把 value 自动变成 Optional。

结构兼容还需考虑额外键、必需性和可写性。可写字段会带来类型污染风险；只读消费者合同更容易接受字段更具体或含额外数据的 producer。

## 核心机制

- __required_keys__/__optional_keys__ 提供运行时元数据，但值仍未验证。
- 键缺失与键存在且值 None 是两种合同。
- ReadOnly 是静态限制，不冻结运行时 dict。
- API 演进新增 NotRequired 键通常比新增 Required 键兼容。

## 常见误区

- isinstance(payload, MyTypedDict)，TypedDict 不支持这种运行时验证。
- 用 Optional[T] 表示键可缺失。
- 把外部未校验 JSON 直接 cast 成 TypedDict。

## 可运行示例

```python
from typing import NotRequired, ReadOnly, Required, TypedDict

class UserPayload(TypedDict, total=False):
    id: Required[ReadOnly[str]]
    display_name: str
    email: NotRequired[str | None]

payload: UserPayload = {"id": "u-1"}
payload["display_name"] = "Ada"
# payload["id"] = "u-2"  # 静态错误；运行时 dict 并不会阻止。
```

## 搭积木复现

### 列存在性矩阵

为每个键记录 required/optional、nullable、readonly，禁止三者混写。

### 加运行时验证

入口先 schema parser，验证后才返回 TypedDict；不要用 cast 冒充证据。

### 模拟版本演进

对新增/删除/改类型/改必需性写 producer-consumer 兼容测试。

## 自检

### 问题

NotRequired[str] 与 Required[str | None] 有何本质区别？

### 站内答案

前者允许键完全缺失，但一旦存在必须是 str；后者要求键始终存在，值可以是 str 或 None。它们对应 JSON patch 与完整资源表示中不同的数据语义。
