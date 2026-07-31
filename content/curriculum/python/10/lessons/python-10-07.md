---
id: "python-10-07"
track: "python"
title: "assembler、jump fixup、exception table 与 code object"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-10-07.md"
---

## 官方入口

title: "Python Data Model · Code objects"
url: "https://docs.python.org/3/reference/datamodel.html#code-objects"

code object 保存可执行字节码及常量、名称、变量、位置、异常表等不可变元数据；它不携带函数 globals/defaults/closure。

## 真实源码

repo: "python/cpython"
file: "Python/assemble.c · Objects/codeobject.c"
symbol: "_PyAssemble_MakeCodeObject"
language: "c"
url: "https://github.com/python/cpython/blob/main/Python/assemble.c"

### 逐段讲解

- assembler 先确定 block 顺序与每条指令大小，再把 symbolic jump target 转成相对或绝对单位；若参数超过单字节，需要 EXTENDED_ARG，指令变长又会反过来改变跳转。
- 跳转 offset 和 EXTENDED_ARG 通过重复计算达到固定点。inline cache entries 也占 code units，反汇编时必须依赖当前 opcode metadata 正确跨过。
- 最终同时编码 co_code、co_consts、co_names、localsplus、line table 和 exception table，再验证栈深度与结构不变量后构造不可变 PyCodeObject。

### 源码节选

```c
def encode_oparg(opcode: int, arg: int) -> list[tuple[int, int]]:
    """教学版 EXTENDED_ARG：从高位到低位输出 8-bit 片段。"""
    parts = [arg & 0xFF]
    arg >>= 8
    while arg:
        parts.append(arg & 0xFF)
        arg >>= 8
    encoded = [(144, byte) for byte in reversed(parts[1:])]  # EXTENDED_ARG
    encoded.append((opcode, parts[0]))
    return encoded

assert len(encode_oparg(100, 7)) == 1
assert len(encode_oparg(100, 70_000)) == 3
```

## 导读

assembly 是把“可移动的指令图”冻结为“按地址排列的 code units”。难点来自自引用：jump 参数取决于目标和当前地址，参数变大可能需要 EXTENDED_ARG，使当前指令变长，又推动后续地址变化。实现会反复计算 offset/size，直到不再改变。

现代 CPython 把异常处理区间编码进 exception table。正常执行路径无需每次进入 try 都维护显式 block 栈；抛异常时，解释器根据当前 instruction offset 查 handler、目标栈深度和 lasti 标志。所谓 zero-cost 指正常不抛时移除了维护开销，抛出与查表仍有成本。

code object 是编译产物，不等于 function。它拥有 co_consts、co_names、co_varnames/freevars/cellvars、co_code 和调试表，却没有特定 globals 字典、默认参数或 closure cell 值。同一个 code object 可与不同环境组合成多个函数。

## 核心机制

- 常量、名称和 localsplus 通过表索引压缩到 oparg。
- line table 用紧凑编码表达 instruction range 到源码位置的变化。
- exception table 编码 start、length、target、stack depth 等字段，并按执行偏移查找。
- co_stacksize 来自 CFG 数据流最大值，直接决定 frame value stack 容量。
- marshal/pyc 可序列化 code object，但内部格式随 Python 版本变化，不是长期协议。

## 常见误区

- 假设一条 opcode 固定占两个字节，忽略 EXTENDED_ARG、cache entries 和版本变化。
- 把 try 的低正常路径成本误讲成异常处理“免费”。
- 修改 co_code 字节却不更新跳转、栈深度、行表和异常表。

## 可运行示例

```python
import dis

def guarded(value):
    try:
        return 10 // value
    except ZeroDivisionError:
        return 0

code = guarded.__code__
print("stack", code.co_stacksize)
print("consts", code.co_consts)
print("names", code.co_names)
dis.dis(guarded, show_caches=True)

# 3.11+ dis 输出末尾会展示 ExceptionTable；
# 对比 try 外的同一除法，观察正常路径指令差异。
```

## 搭积木复现

### 先排线性块

为每个 block 决定顺序，计算不含 jump fixup 时的初始 offset。

### 迭代 jump size

计算目标差值与 EXTENDED_ARG 数；只要任一指令长度变化就重新布局，直到固定点。

### 编码辅助表

为位置和异常区间设计 delta/varint 编码，并写独立 encode/decode round-trip 测试。

### 构造 mini code object

保存 instructions、consts、names、stacksize 与 location map，用自己的 stack VM 执行，再与 CPython dis 对照。

## 自检

### 问题

为什么 jump offset 不能在 codegen 第一次遇到跳转时一次算完？

### 站内答案

当时目标 block 可能尚未布局，前方指令也可能因 EXTENDED_ARG、inline cache 或优化改变长度。更关键的是跳转参数本身变大后会使跳转指令变长，从而继续推动地址。先用 symbolic target，统一布局并迭代到固定点，才能得到自洽偏移。
