---
id: "python-05-06"
track: "python"
title: "ExceptionGroup、except* 与并发多失败"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-05-06.md"
---

## 官方入口

title: "Compound statements · except* clause"
url: "https://docs.python.org/3/reference/compound_stmts.html#except-star-clause"

每个 except* 按类型递归拆分匹配与未匹配子组；处理完成后，未处理异常与处理器新异常会重新合并传播。

## 导读

并发任务、批量校验和多资源清理可能同时产生多个彼此独立的失败。普通异常链只能表达顺序因果；ExceptionGroup 保存树形并列关系，同时保留每个叶子异常自己的 traceback。

except* 不是从组里取第一个异常。它按类型递归分割整棵树，当前处理器获得保留原嵌套形状的匹配子组，剩余子组继续交给后续 except*；全部处理器结束后，未处理叶子与处理器新抛异常再合并。

处理器中绑定的组是临时派生对象，修改它不会原地修改原组。要为叶子补 notes 或用 subgroup/split 构造新组，并把错误与任务标识、输入索引等结构化上下文关联。

## 核心机制

- ExceptionGroup 只能包含 Exception 子类；BaseExceptionGroup 可容纳取消、退出等 BaseException。
- subgroup(predicate) 保留匹配叶子及其必要父组结构；split 同时返回匹配和其余部分。
- except 与 except* 不能混用在同一个 try，except* 中不能 return/break/continue。
- 裸异常若被匹配 except*，会临时包装为空消息的组，保持处理器变量类型一致。

## 常见误区

- except* Exception 后仅打印，吞掉多个任务失败。
- 把 ExceptionGroup 当扁平 list，丢失子任务树与 traceback 分组。
- 用 cause 链串联无因果的并行失败，让最后一个错误看似由前一个导致。

## 可运行示例

```python
def validate_all():
    errors = [
        ValueError("row 1: invalid age"),
        TypeError("row 2: expected text"),
        OSError("row 3: storage unavailable"),
    ]
    raise ExceptionGroup("batch validation", errors)

handled = []
try:
    validate_all()
except* (ValueError, TypeError) as group:
    handled.extend(type(exc).__name__ for exc in group.exceptions)
except* OSError as group:
    for exc in group.exceptions:
        exc.add_note("retry batch after storage recovery")
    handled.append("OSError")

assert set(handled) == {"ValueError", "TypeError", "OSError"}
```

## 搭积木复现

### 实现树形 split

定义 Leaf/Group，递归返回 matching/rest，并在子节点为空时裁掉父组。

### 模拟 except*

依次把 rest 交给类型处理器，收集处理器新异常，最后合并所有未处理分支。

### 连接并发任务

让每个异常携带 task_id note，验证 TaskGroup 多失败输出仍能定位各自产生点。

## 自检

### 问题

为什么 except* 处理器拿到的仍是 ExceptionGroup，而非一组扁平异常？

### 站内答案

原始嵌套结构通常对应任务树、批次或资源层级。递归分割并保留结构，才能维持每个失败所属上下文；扁平化会丢失父组语义。处理器因此接收只含匹配叶子的派生子组，未匹配树继续流向后续处理器。
