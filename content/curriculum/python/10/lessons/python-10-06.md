---
id: "python-10-06"
track: "python"
title: "compiler unit、basic block 与 CFG"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-10-06.md"
---

## 官方入口

title: "InternalDocs · Compiler design"
url: "https://github.com/python/cpython/blob/main/InternalDocs/compiler.md"

CPython 编译管线依次完成 AST、symbol table、指令序列/控制流图、优化和 assembly；内部文件名会随版本重构。

## 真实源码

repo: "python/cpython"
file: "Python/compile.c · Python/codegen.c · Python/flowgraph.c"
symbol: "_PyAST_Compile"
language: "c"
url: "https://github.com/python/cpython/blob/main/Python/compile.c"

### 逐段讲解

- compile.c 建立 compiler state 和嵌套 compiler unit；每个 function/class/comprehension 进入新 unit，拥有自己的常量、名称、locals、freevars 和 block。
- codegen visitor 把 AST 节点翻译为语义指令，控制结构创建 basic block 并连接跳转；此时很多操作数仍是名称/常量引用，不是最终紧凑整数。
- flowgraph 在 CFG 上删除不可达块、折叠跳转、传播行号、验证栈效果并处理异常边，最后才交给 assembler 布局。

### 源码节选

```c
# 用 Python 复现“基本块 + 边”，帮助阅读 C 结构
class Block:
    def __init__(self, label):
        self.label = label
        self.instructions = []
        self.next = []       # fallthrough / conditional / exception edges

entry = Block("entry")
yes = Block("yes")
no = Block("no")
exit_ = Block("exit")

entry.instructions += [("LOAD_FAST", "flag"), ("POP_JUMP_IF_FALSE", no)]
entry.next += [yes, no]
yes.instructions += [("LOAD_CONST", 1), ("JUMP", exit_)]
yes.next += [exit_]
no.instructions += [("LOAD_CONST", 0)]
no.next += [exit_]
exit_.instructions += [("RETURN_VALUE", None)]
```

## 导读

codegen 不应一边递归 AST 一边立刻写最终字节串。跳转目标尚未布局，异常区间尚未稳定，常量与名称索引还可去重，优化也需要看跨语句控制流。CPython 先生成可修改的指令和 basic block，再在 CFG 上完成全局约束，最后 assembly。

basic block 是一段只有单入口、除末尾外没有跳转的线性指令。if、loop、try、match 会拆出多个 block，边表示 fallthrough、条件跳转、循环回边或异常控制流。栈式虚拟机还要求每条进入同一 block 的路径具有兼容栈深度，否则解释器不知道栈槽含义。

compiler unit 对应一个独立 code object 候选，例如 module、function、lambda、class body 或 comprehension。进入 unit 时需要将 symbol table 给出的 locals/freevars/cellvars 映射到稳定索引，离开时把子 code object 作为常量装入父 unit。

## 核心机制

- VISIT 宏/visitor 按 AST 类型分派；表达式通常约定把一个结果压栈，语句约定保持入口栈平衡。
- jump target 先用 block identity 表示，避免提前猜测字节偏移。
- 常量 key 要处理 1 与 True、-0.0 与 0.0 等“相等但类型/位模式不同”的边界。
- 异常处理引入隐式边和 handler 栈深度，不能只看显式 jump。
- CFG optimizer 必须保持 traceback 行号、异常语义和可观测指令行为，而非只追求更短。

## 常见误区

- 把 AST 节点和 opcode 一一对应；一个节点可能发出多块、多指令，也可能在优化后完全消失。
- 只画正常控制流，遗漏异常边导致栈深度与资源清理推理错误。
- 在 codegen 阶段写死最终 jump offset，之后插入 cache/extended arg 会让偏移失效。

## 可运行示例

```python
import ast
import dis

source = """
def choose(flag):
    if flag:
        return 1
    return 0
"""
tree = ast.parse(source)
code = compile(tree, "<lesson>", "exec")
fn_code = next(c for c in code.co_consts if hasattr(c, "co_code"))

for ins in dis.get_instructions(fn_code, show_caches=True):
    print(f"{ins.offset:>3}", ins.opname, ins.argrepr,
          "target" if ins.is_jump_target else "")
```

## 搭积木复现

### 定义 IR 合同

建立 Instruction(op, arg, location, target) 和 Block，明确表达式/语句对虚拟栈的净效果。

### 翻译 if/while

从 AST 发射 block 和 symbolic jump，不计算字节偏移；输出 DOT 或文本边表。

### 做数据流分析

从 entry 传播 stack depth，遇到同一 block 的不一致深度立即报编译错误。

### 加入保守优化

删除不可达 block、跳转穿透和常量条件折叠，每个优化前后都用真实 Python 结果和 dis 做差分。

## 自检

### 问题

为什么 basic block 适合作为 codegen 与 assembler 之间的中间表示？

### 站内答案

它保留了接近 opcode 的线性执行细节，同时把跳转表示为结构化边，便于在布局前做可达性、栈深度、异常区域和跳转优化。若直接写字节串，全局信息不完整；若一直停留在 AST，又难以表达栈效果和精确指令级控制流。
