---
id: "python-05-04"
track: "python"
title: "__context__、__cause__ 与 raise from"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-05-04.md"
---

## 官方入口

title: "Exceptions · Exception context"
url: "https://docs.python.org/3/library/exceptions.html#exception-context"

处理异常期间再抛异常会设置 __context__；raise X from Y 设置显式 __cause__，from None 仅抑制默认上下文显示。

## 导读

__context__ 记录“处理哪个异常时又发生了这个异常”，由运行时隐式设置；__cause__ 记录作者声明的直接原因，由 raise new from old 显式设置。默认渲染优先展示 cause，否则在未抑制时展示 context。

raise DomainError(...) from exc 适合把数据库、HTTP、解析器异常翻译成稳定领域边界，同时让诊断工具仍能追到原始失败。from None 只设置 __suppress_context__ 隐藏默认打印，原 __context__ 对象仍可供程序检查。

因果链应表达真正抽象关系。每一层都机械包装会产生“洋葱 traceback”，使最重要的业务语义被重复 message 淹没；同一层无法增加恢复信息时应直接传播。

## 核心机制

- 处理器、finally 或 with 退出期间的新异常会得到隐式 __context__。
- 显式 cause 决定默认显示文案为 direct cause，并设置 suppress_context。
- from None 隐藏低层噪声但不销毁 context 证据。
- traceback.print_exception(chain=True) 会按 cause/context 规则渲染整条链。

## 常见误区

- 翻译异常时只复制 str(exc)，丢失类型、结构化字段与 traceback。
- 对所有失败 from None，生产事故中再也看不到底层证据。
- 把两个同时发生但无因果关系的错误硬串成 cause；并行多失败应使用 ExceptionGroup。

## 可运行示例

```python
class UserLookupError(Exception):
    def __init__(self, user_id):
        self.user_id = user_id
        super().__init__(f"cannot load user {user_id}")

def parse_user(raw, user_id):
    try:
        return int(raw)
    except ValueError as exc:
        raise UserLookupError(user_id) from exc

try:
    parse_user("NaN", "u-7")
except UserLookupError as error:
    assert isinstance(error.__cause__, ValueError)
    assert error.__context__ is error.__cause__
    assert error.__suppress_context__ is True
    assert error.user_id == "u-7"
```

## 搭积木复现

### 区分关系

为每次包装回答：新异常是否是低层失败的语义翻译？是则 cause；只是在处理期间失败则保留 context。

### 实现领域边界

保留稳定业务字段，用 from 原异常翻译 provider-specific 错误。

### 测试渲染与对象图

同时断言 __cause__/__context__/__suppress_context__，再检查面向用户的精简输出。

## 自检

### 问题

raise X from None 是否真的删除了原始异常？

### 站内答案

没有。它把 __cause__ 设为 None 并开启 __suppress_context__，从而在默认未捕获异常输出中隐藏隐式上下文；原异常通常仍在 X.__context__ 中。该机制适合向用户隐藏无用实现细节，但日志或调试工具仍可按策略读取。
