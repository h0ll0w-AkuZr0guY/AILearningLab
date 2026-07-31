---
id: "python-05-02"
track: "python"
title: "异常匹配、层级设计与捕获边界"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "Compound statements · except clause"
url: "https://docs.python.org/3/reference/compound_stmts.html#except-clause"

except 从上到下选择第一个类型匹配的处理器；匹配基于异常类的非虚基类层级。

## 导读

except 处理的是类型合同。运行时按源码顺序寻找第一个匹配类或其子类的子句，因此宽泛处理器放在前面会使更具体分支永远不可达。异常层级决定调用者能以多粗或多细的粒度恢复。

库应把“可重试”“调用参数错误”“外部依赖失败”“内部不变量损坏”等操作语义编码进类型层级或稳定字段。调用者捕获的是自己有能力处理的边界，无法恢复的异常应继续传播。

Exception 排除了 KeyboardInterrupt、SystemExit、GeneratorExit 等进程或控制流信号；捕获 BaseException 通常只适用于必须清理后重新抛出的底层边界。

## 核心机制

- 多个 except 按顺序只运行一个，匹配成功后不再尝试后续分支。
- 元组可合并采用相同恢复策略的异常类型。
- 自定义业务异常通常继承 Exception，并提供一个稳定根类供调用者做粗粒度处理。
- 捕获范围应尽量包围会发生预期错误的最小语句，else 承载成功后可能另行失败的代码。

## 常见误区

- except Exception: pass 同时吞掉编程错误、依赖失败和数据损坏。
- 先捕获 Exception 再写 ValueError 分支，后者永远到不了。
- 为了统一接口把所有异常都改成同一个 message，丢失可重试性与原始 cause。

## 可运行示例

```python
class StorageError(Exception):
    """调用者可统一记录的存储层根异常。"""

class TransientStorageError(StorageError):
    retryable = True

class CorruptRecordError(StorageError):
    retryable = False

def policy(exc):
    if isinstance(exc, TransientStorageError):
        return "retry"
    if isinstance(exc, CorruptRecordError):
        return "quarantine"
    if isinstance(exc, StorageError):
        return "fail-request"
    raise exc

assert policy(TransientStorageError()) == "retry"
assert policy(CorruptRecordError()) == "quarantine"
```

## 搭积木复现

### 列出恢复动作

先列 retry、fallback、reject、abort-process，再让每类异常只映射到调用者确实能做的动作。

### 设计层级

建立稳定根类与少量操作性子类；变化频繁的细节放属性，不无限扩张类型树。

### 审计捕获范围

为每个 except 标注“为何能恢复”，删除只记录后继续执行的宽泛捕获。

## 自检

### 问题

为什么“只捕获你能处理的异常”比“所有边界都 except Exception”更可靠？

### 站内答案

捕获意味着当前层承诺能恢复、转换或补充信息。宽泛捕获会把程序错误与可预期业务失败混在一起，常导致损坏状态继续运行。让未知异常传播可保留失败可见性；清理应交给 finally/with，不需要以吞掉异常为代价。
