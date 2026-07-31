---
id: "python-10-08"
track: "python"
title: "interpreter frame、dispatch loop 与 eval breaker"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-10-08.md"
---

## 官方入口

title: "InternalDocs · The bytecode interpreter"
url: "https://github.com/python/cpython/blob/main/InternalDocs/interpreter.md"

当前解释器指令由 Python/bytecodes.c 定义并生成 dispatch cases；构建可选择传统 switch/computed goto 或 tail-call interpreter。

## 真实源码

repo: "python/cpython"
file: "Include/internal/pycore_frame.h · Python/bytecodes.c · Python/ceval.c"
symbol: "_PyEval_EvalFrameDefault"
language: "c"
url: "https://github.com/python/cpython/blob/main/Python/ceval.c"

### 逐段讲解

- interpreter frame 把 code、globals/builtins、previous frame、instruction pointer 与 localsplus/value stack 放在紧凑内部结构中；需要反射时才物化用户可见 PyFrameObject。
- dispatch loop 取当前 code unit、解码 opcode/oparg、移动 instruction pointer，再进入由 bytecodes.c 生成的语义 case。多数 case 用栈输入/输出 DSL 描述，生成器同时得到栈效果与多种解释器实现。
- eval breaker 是低频事件聚合点。pending calls、signal、GC、线程切换等不应让每条热点指令承担昂贵检查，解释器在后向跳转/调用等安全点统一处理。

### 源码节选

```c
# 教学版 stack VM，对应“取指、解码、执行、推进”
def evaluate(code, consts):
    stack = []
    ip = 0
    while True:
        op, arg = code[ip]
        ip += 1
        if op == "LOAD_CONST":
            stack.append(consts[arg])
        elif op == "ADD":
            right = stack.pop()
            left = stack.pop()
            stack.append(left + right)
        elif op == "JUMP_BACKWARD":
            ip -= arg
            # CPython 会在部分安全点检查 eval breaker
        elif op == "RETURN_VALUE":
            return stack.pop()

assert evaluate([("LOAD_CONST", 0), ("LOAD_CONST", 1),
                 ("ADD", 0), ("RETURN_VALUE", 0)], [20, 22]) == 42
```

## 导读

frame 是一次执行的状态快照：正在运行哪个 code object、下一条指令在哪里、局部变量/闭包/临时值在哪、调用者是谁。现代内部 _PyInterpreterFrame 追求紧凑和低分配，只有 traceback、sys._getframe、debugger 等需要时才绑定或物化 PyFrameObject。把二者混为一谈会误判每次函数调用的分配成本。

解释器是栈机。LOAD_FAST 把 local 槽压栈，BINARY_OP 取出操作数并压入结果，RETURN_VALUE 弹出返回值。源码中的 bytecodes DSL 是权威语义入口，generated_cases 是派生结果；不同构建可以用 computed goto、switch 或 tail calls 分派，但 Python 可观察语义应一致。

信号、pending call、异步异常、线程调度和周期性 GC 需要及时响应，又不能让每条 opcode 都执行一串慢检查。eval breaker 把多个条件压成快速标志，并在已选择的安全点进入慢路径。这是一种常见系统设计：热点只检查摘要，冷路径再解析具体事件。

## 核心机制

- localsplus 连续保存 fast locals、cell/free 和 value stack，索引由 code object 元数据解释。
- stack pointer 必须与每条指令声明的输入/输出效果严格一致，异常路径也要恢复到 handler 指定深度。
- frame owner 区分 thread、generator 等所有权状态，决定暂停/返回后的生命周期。
- RESUME 是 tracing、specialization 和 generator resume 等状态的显式汇合点。
- tail-call interpreter 指 C 函数/标签之间的尾调用分派，并非 Python 语言的尾递归优化。

## 常见误区

- 把 PyFrameObject 当作每次调用都完整堆分配的执行帧。
- 直接阅读 generated_cases 却忽略它由 bytecodes.c 生成，难以理解 DSL 与版本差异。
- 认为 GIL 或 eval breaker 会在每条字节码后固定切换线程。

## 可运行示例

```python
import dis
import sys

def add_then_double(left, right):
    total = left + right
    frame = sys._getframe()
    assert frame.f_code is add_then_double.__code__
    return total * 2

print(add_then_double.__code__.co_varnames)
for ins in dis.get_instructions(add_then_double, show_caches=True):
    print(ins.offset, ins.opname, ins.argrepr)

# 将 dis 的栈效果逐条手算，再对照 co_stacksize；
# 注意 sys._getframe 主动让 frame 进入可观察路径。
```

## 搭积木复现

### 实现四指令 VM

从 LOAD_CONST、LOAD_LOCAL、BINARY_ADD、RETURN 开始，显示打印 ip 与 stack 前后状态。

### 加入 frame

把 code/locals/stack/ip 封装进 Frame，CALL 创建子 frame，RETURN 将结果压回父 frame。

### 加入异常展开

维护简化 exception table；指令失败时按 ip 查 handler、截断 stack 并跳转。

### 加入 breaker

用一个 bitset 汇总 cancel/signal/gc 请求，只在 backward jump 和 call 边界处理，测量逐指令检查与摘要检查差异。

## 自检

### 问题

tail-call interpreter 为什么与“Python 自动尾递归优化”没有关系？

### 站内答案

它改变的是解释器 C 实现中 opcode handler 之间的分派方式，让编译器更好布局和优化 handler；Python 函数调用仍会创建解释器 frame，并保留 traceback、递归限制和可观察栈语义。用户写的尾递归不会因此被消除。
