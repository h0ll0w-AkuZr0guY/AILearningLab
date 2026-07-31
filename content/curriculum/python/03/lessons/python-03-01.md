---
id: "python-03-01"
track: "python"
title: "函数对象：code、globals、defaults 与 closure"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "Data model · User-defined functions"
url: "https://docs.python.org/3/reference/datamodel.html#user-defined-functions"

函数对象把无上下文 code object 与定义环境组合起来；globals、defaults、kwdefaults 和 closure 都属于函数对象。

## 导读

def 是可执行语句：它先取得编译好的 code object，再把当前模块 globals、默认值、闭包 cell、名称和元数据封装成函数对象，最后把名称绑定到该函数。函数体要到调用时才建立 frame 并执行。

同一个 code object 可以与不同 globals 或 closure 组合成行为不同的函数。反过来，修改函数.__defaults__、__kwdefaults__ 或 closure cell 会改变后续调用，却不改变 bytecode；这解释了“代码相同”不等于“函数行为相同”。

默认表达式在 def 执行时求值并存进函数对象；全局名称在调用时通过 function.__globals__ 解析；自由变量从 function.__closure__ 中的 cell 读取。三种值拥有不同的捕获时机。

## 核心机制

- __code__ 保存指令、常量和名称表，不持有模块运行上下文。
- __globals__ 指向定义函数的模块字典，而非调用者模块。
- __defaults__ 只保存末尾位置参数默认值，__kwdefaults__ 保存关键字专用默认值。
- __closure__ 与 code.co_freevars 按位置对应，每个元素是可共享、可变绑定的 cell。

## 常见误区

- 把默认值放进 code.co_consts，忽略默认表达式可在每次 def 执行时产生新对象。
- 认为把函数传到另一个模块会改用新模块 globals；函数持续引用定义模块。
- 序列化函数时只保存源码，遗漏 globals、closure 与版本依赖。

## 可运行示例

```python
import types

FACTOR = 2

def scale(value, offset=1):
    return value * FACTOR + offset

assert scale.__defaults__ == (1,)
assert scale.__globals__ is globals()
assert scale.__closure__ is None

# 同一 code object 配上另一份 globals，行为随环境改变。
other_globals = {"FACTOR": 10, "__builtins__": __builtins__}
other_scale = types.FunctionType(scale.__code__, other_globals, "other_scale", (1,))
assert scale(3) == 7
assert other_scale(3) == 31
```

## 搭积木复现

### 拆开函数四个组成部分

分别观察 __code__、__globals__、__defaults__、__closure__，给每个字段标注求值时机。

### 复用 code object

用 types.FunctionType 配置另一份 globals 和 defaults，证明 bytecode 与执行环境可以分离。

### 修改一项做差分

只改变 defaults、globals 或 cell 中的一项，保持 code 身份不变，记录行为差异。

## 自检

### 问题

为什么默认参数属于函数对象，而字符串和数字字面量通常出现在 code.co_consts？

### 站内答案

字面量是编译期指令的组成部分；默认表达式在 def 语句实际执行时求值，可能调用函数、读取当前名称或创建可变对象。求值结果必须随这次函数对象创建保存，因此放在 __defaults__/__kwdefaults__，而非无上下文的 code object。
