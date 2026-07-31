---
id: "python-07-10"
track: "python"
title: "mypy、pyright 差异与类型回归测试"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-07-10.md"
---

## 官方入口

title: "Typing specification · Conformance"
url: "https://typing.python.org/en/latest/spec/conformance.html"

typing specification 定义共同语义，checker 仍可能在尚未规范化、配置、推断启发式和错误恢复上存在差异。

## 导读

类型注解是一门由规范、typeshed、checker 版本和配置共同实现的语言。mypy 支持成熟插件生态与部分名义工作流，pyright 常更积极实现新规范并采用不同推断；“某工具通过”不自动意味着公共库对其他消费者稳定。

类型回归测试应像运行时测试一样提交：正例必须通过，反例必须在指定位置失败，reveal_type/assert_type 锁定推断结果。公共库可用两个 checker 跑核心合同，工具专属行为则隔离并记录原因。

## 核心机制

- strict 是一组开关，不同工具同名模式细节不同。
- stub、py.typed、插件和配置搜索路径会改变结果。
- checker 升级应审阅诊断变化，不盲目批量 ignore。
- 最小复现必须包含 Python 版本与完整配置。

## 常见误区

- 用 # type: ignore 不带错误码，未来其他错误也被吞。
- 只测试实现文件，不从消费者视角测试已发布 API。
- 依赖 checker bug/启发式设计过度聪明的公共签名。

## 可运行示例

```python
from typing import assert_type

def first[T](items: list[T]) -> T:
    return items[0]

assert_type(first([1, 2]), int)
assert_type(first(["a"]), str)

# tests/typecheck/fail_first.py:
# first([])  # 需要上下文才能推断 T，期望 checker 给出明确诊断。
#
# CI:
# python -m mypy --strict src tests/typecheck/pass
# pyright --project pyrightconfig.json
```

## 搭积木复现

### 固定环境

锁 Python、mypy、pyright、typing_extensions 与配置文件。

### 建立 pass/fail 样例

正例断推断类型，反例按错误码/行号验收，避免只看退出码。

### 管理差异

先判断规范允许还是工具 bug，再最小化隔离，附 issue 与删除条件。

## 自检

### 问题

为什么类型测试不能只检查 checker 退出码为 0？

### 站内答案

API 可能悄悄退化为 Any，checker 仍无错误退出；非法调用也可能因宽泛 overload 被接受。assert_type/reveal_type 锁定正向推断，独立 fail fixtures 锁定应拒绝的调用，二者共同验证合同。
