---
id: "python-05-05"
track: "python"
title: "try/except/else/finally 的控制流矩阵"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "Compound statements · The try statement"
url: "https://docs.python.org/3/reference/compound_stmts.html#the-try-statement"

else 只在 try 正常完成且未 return/break/continue 时执行；finally 在所有离开路径运行，并可覆盖保存的异常或返回。

## 导读

try 语句管理的是“完成原因”：正常落下、return、break、continue、异常。finally 在离开前总会执行；若 finally 自己以 return、break、continue 或新异常完成，先前保存的完成原因会被覆盖。

else 的价值是缩小捕获范围。把成功后的后处理放进 else，它抛出的异常不会被前面的 except 误认为 try 中预期失败；这比扩大 try 包住整个函数更能维持异常分类。

finally 中 return 会静默丢弃 try 中的异常或返回值。Python 3.14 会对 finally 内的 return/break/continue 发出 SyntaxWarning，这反映其控制流风险，而非简单风格偏好。

## 核心机制

- except 只处理 try suite 抛出的匹配异常，处理器自身异常向外传播。
- else 需要 try 正常完成且未发生非局部跳转。
- finally 运行时保存先前完成原因，结束后恢复它，除非 finally 产生新的完成原因。
- finally 新异常会把先前异常设为 __context__。

## 常见误区

- finally return 覆盖业务返回或吞掉异常。
- try 范围过大，让 except ValueError 意外捕获成功后日志/序列化中的 ValueError。
- 在 finally 中只在成功路径初始化的局部变量上清理，制造 UnboundLocalError 覆盖根因。

## 可运行示例

```python
events = []

def execute(fail=False):
    resource = None
    try:
        resource = "open"
        if fail:
            raise ValueError("work failed")
    except ValueError:
        events.append("handled")
        raise
    else:
        events.append("commit")
        return "ok"
    finally:
        if resource is not None:
            events.append("close")
        # 此处绝不能 return，否则 fail=True 的异常会被吞掉。

assert execute() == "ok"
assert events == ["commit", "close"]

events.clear()
try:
    execute(True)
except ValueError:
    pass
assert events == ["handled", "close"]
```

## 搭积木复现

### 建立完成原因枚举

用 NORMAL、RETURN、BREAK、CONTINUE、EXCEPTION 表示 try 离开方式，再描述 finally 覆盖规则。

### 生成测试矩阵

让 try 与 finally 分别选择五种完成原因，断言最终返回或异常，重点覆盖覆盖关系。

### 重构真实事务

try 只包可能失败的操作，except 分类，else commit，finally 仅做幂等释放。

## 自检

### 问题

finally 中 return 为什么能吞掉 try 中原本要传播的异常？

### 站内答案

解释器进入 finally 前会暂存 try 的完成原因。若 finally 正常结束，就恢复原异常或 return；若 finally 自己执行 return，它提供了更新、更晚的完成原因，旧异常被丢弃。清理代码应完成资源释放后自然落下，避免产生新的控制流。
