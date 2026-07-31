---
id: "python-03-05"
track: "python"
title: "late binding 与默认参数早绑定"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "Function definitions · Default parameter evaluation"
url: "https://docs.python.org/3/reference/compound_stmts.html#function-definitions"

默认表达式在 def 执行时从左到右求值一次；闭包自由变量则在函数调用时通过共享 cell 读取当前绑定。

## 导读

循环闭包的 late binding 来自多个函数共享循环变量 cell，调用时才 LOAD_DEREF。循环结束后 cell 保存最终值，所以所有函数看到同一结果。它与 lambda 没有特殊关系，嵌套 def 完全相同。

把 i 写成默认参数 i=i 会在每次 def/lambda 创建时求值右侧并存入各自 __defaults__，调用时从参数默认槽取值，因此形成早绑定快照。该修复适合不可变值；若捕获的是可变对象，仍然共享该对象。

另一种更明确的修复是 factory(i) 每次调用创建新的 cell。选择默认参数还是 factory，取决于 i 是否属于公开签名和后续是否需要 nonlocal 修改。

## 核心机制

- late binding 路径：循环变量成为 cell，所有 closure 保存相同 cell 身份。
- 默认参数路径：定义函数时求值，结果分别保存在每个函数对象的 __defaults__。
- factory 路径：每次外层调用创建独立 frame/cell。
- functools.partial 也能提前固定实参，但返回对象的反射表面与普通函数不同。

## 常见误区

- 只说“lambda 延迟执行”，没有解释共享 cell 和 LOAD_DEREF。
- 用默认空 list 捕获状态，修复整数问题后引入跨调用可变默认值。
- 为了隐藏 late binding 滥用默认参数，使本不该公开的参数出现在签名中。

## 可运行示例

```python
late = [lambda: i for i in range(3)]
assert [fn() for fn in late] == [2, 2, 2]
assert len({id(fn.__closure__[0]) for fn in late}) == 1

early = [lambda i=i: i for i in range(3)]
assert [fn() for fn in early] == [0, 1, 2]
assert [fn.__defaults__ for fn in early] == [(0,), (1,), (2,)]

def factory(value):
    return lambda: value

isolated = [factory(i) for i in range(3)]
assert len({id(fn.__closure__[0]) for fn in isolated}) == 3
```

## 搭积木复现

### 先证明共享 cell

比较循环创建函数的 closure cell 身份，再修改或结束循环观察所有结果。

### 用默认参数固定值

观察每个函数的 __defaults__，解释定义期求值如何绕过 cell。

### 用 factory 创建独立 cell

比较两种修复的签名、可变状态能力和可读性，选择符合 API 合同的方案。

## 自检

### 问题

默认参数 i=i 为什么能修复循环闭包，却不能被简单描述为“复制变量”？

### 站内答案

右侧 i 在函数定义执行时求值得到对象引用，结果存进新函数自己的 __defaults__；调用时参数绑定使用该默认值，不再读取循环变量 cell。对整数看起来像复制值，对可变对象仍只是复制引用。
