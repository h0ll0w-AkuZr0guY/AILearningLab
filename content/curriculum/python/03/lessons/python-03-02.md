---
id: "python-03-02"
track: "python"
title: "code object、常量表与名称表"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "Data model · Code objects"
url: "https://docs.python.org/3/reference/datamodel.html#code-objects"

code object 表示已编译、无执行上下文的 Python 代码；co_consts、co_names、co_varnames 与字节码操作数共同解释指令。

## 导读

code object 是不可变编译产物。co_code 保存编码后的指令流，dis 模块把它解释为 opcode；许多指令参数只是索引，真正对象位于 co_consts、co_names、co_varnames 等并行表。

LOAD_CONST i 从 co_consts[i] 取字面量或嵌套 code；LOAD_GLOBAL/LOAD_ATTR 等名称类指令引用 co_names；LOAD_FAST 引用局部变量布局。理解索引表后，字节码不再是神秘助记符。

嵌套 def 的函数对象尚未在外层 code 中存在，外层 co_consts 保存的是内层 code object。执行 MAKE_FUNCTION 时才把它与当时的 defaults、closure 和 globals 组合起来。

## 核心机制

- co_consts 包含字面量、文档字符串以及嵌套函数的 code object。
- co_names 保存由全局、属性和导入相关指令引用的名称。
- co_varnames 以参数开头，随后是编译器分配的局部名称。
- 行号和异常表把指令偏移映射到源码位置和异常处理区间，供 traceback 与调试器使用。

## 常见误区

- 用字节偏移硬解析新版本 bytecode，忽略 inline cache 和指令格式会演进。
- 把 co_names 中出现的名称都当成 globals，属性名和导入名也会进入同一表。
- 修改 code.replace 后只测试返回值，没有验证闭包数量、异常表和调试信息仍一致。

## 可运行示例

```python
import dis
import types

LIMIT = 10

def clamp(value):
    return min(value, LIMIT)

code = clamp.__code__
assert "min" in code.co_names
assert "LIMIT" in code.co_names
assert "value" in code.co_varnames

for instruction in dis.get_instructions(clamp):
    print(instruction.opname, instruction.argrepr)

assert isinstance(code, types.CodeType)
```

## 搭积木复现

### 从 dis 反查索引表

对每条 LOAD_CONST/LOAD_GLOBAL/LOAD_FAST 记录 arg，并在对应 co_* 表中定位真实值。

### 加入嵌套函数

在 co_consts 中找到内层 code object，再观察 MAKE_FUNCTION 何时创建函数对象。

### 比较版本边界

只依赖 dis.Instruction 公共字段完成分析器，避免把 opcode 数值和 cache 布局写死。

## 自检

### 问题

为什么 code object 可以被多个函数复用，却不能独立完成一次正常函数调用？

### 站内答案

它只有指令和编译期元数据，没有 globals、defaults、closure 等解析运行时名称所需的环境。函数对象把 code 与定义环境组合，调用时再创建 frame 和局部参数绑定。
