---
id: "python-07-01"
track: "python"
title: "注解求值：3.14 lazy scopes、annotationlib 与 future"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-07-01.md"
---

## 官方入口

title: "Language reference · Annotations"
url: "https://docs.python.org/3/reference/compound_stmts.html#annotations"

Python 3.14 默认在 annotation scope 中惰性求值；future annotations 则保存字符串，两种延迟模型的反射行为不同。

## 导读

注解不会自动检查运行时值。3.14 起，定义函数/类时保存可稍后求值的信息，读取 __annotations__ 或 annotationlib 时才解析；这允许前向名称和类体名称，又把 NameError/副作用推迟到反射时。

from __future__ import annotations 使用旧的字符串化延迟模型。框架不应手写 eval 字符串，应通过 annotationlib.get_annotations 或 typing.get_type_hints 选择 VALUE、FORWARDREF、STRING 等格式，并显式提供 namespace。

## 核心机制

- annotation scope 能访问包围作用域和类 namespace，但其惰性值可能在更晚时刻失败。
- typing.get_type_hints 会解析 forward references，并可合并类 MRO 注解、剥离部分 Annotated 元数据。
- __annotations__ 是运行时元数据，不会改变赋值与调用语义。
- 插件读取注解必须考虑导入副作用、任意表达式与不可信代码。

## 常见误区

- 假设所有版本 __annotations__ 都是类型对象或都是字符串。
- 对不可信模块注解直接 eval，形成代码执行入口。
- 装饰器在定义期强制读取 lazy annotation，使本可前向引用的名称过早失败。

## 可运行示例

```python
import annotationlib

class Node:
    parent: "Node | None"

def link(node: Node) -> list[Node]:
    return [node]

values = annotationlib.get_annotations(link, format=annotationlib.Format.VALUE)
strings = annotationlib.get_annotations(link, format=annotationlib.Format.STRING)
assert values["return"] == list[Node]
assert "list" in strings["return"]
```

## 搭积木复现

### 建立版本矩阵

比较 eager、future string 与 3.14 lazy 的定义期、读取期和值形态。

### 封装反射入口

统一用 annotationlib/typing helper，参数明确 format、globals、locals 与失败策略。

### 延迟失败测试

覆盖未定义前向名、类作用域名、重定义全局名与带副作用表达式。

## 自检

### 问题

3.14 的 lazy annotations 与 future annotations 都是延迟，为什么仍不能视为同一机制？

### 站内答案

future 模式把源码表达式字符串化，稍后需重新解析并重建 namespace；3.14 lazy scope 保存可按格式求值的延迟对象，能更准确保留词法环境并支持 ForwardRef 输出。反射工具、错误时机和可观察值形态都不同。
