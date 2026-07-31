---
id: "python-10-05"
track: "python"
title: "symbol table：local、global、free 与 cell"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-10-05.md"
---

## 官方入口

title: "Execution model · Resolution of names"
url: "https://docs.python.org/3/reference/executionmodel.html#resolution-of-names"

语言参考定义名称绑定、global、nonlocal、class block 和 annotation scope；symtable 模块可观察编译器的名称分类结果。

## 真实源码

repo: "python/cpython"
file: "Python/symtable.c"
symbol: "analyze_name"
language: "c"
url: "https://github.com/python/cpython/blob/main/Python/symtable.c"

### 逐段讲解

- 第一遍 AST visitor 为每个 block 收集 DEF_LOCAL、USE、DEF_PARAM、DEF_GLOBAL、DEF_NONLOCAL 等 raw facts，并创建嵌套 block。
- 第二遍把父级 bound/global/free 集合向下传播。某个子级把外层 local 当作 free 时，外层相应名称升级为 cell，以便 frame 共享同一个闭包槽。
- 分类结果进入 ste_symbols，codegen 随后选择 LOAD_FAST、LOAD_GLOBAL、LOAD_DEREF、LOAD_NAME 等不同指令；它不是运行时临时搜索出来的。

### 源码节选

```c
/* 教学化压缩：真实 analyze_name 还处理 type params/class 特例 */
if (flags & DEF_GLOBAL) {
    SET_SCOPE(scopes, name, GLOBAL_EXPLICIT);
    PySet_Add(global, name);                 // 子作用域也看到显式 global
    PySet_Discard(bound, name);
    return 1;
}
if (flags & DEF_NONLOCAL) {
    if (!PySet_Contains(bound, name))         // 外层函数没有可绑定名称
        return syntax_error("no binding for nonlocal");
    SET_SCOPE(scopes, name, FREE);
    PySet_Add(free, name);
    return 1;
}
if (flags & DEF_BOUND) {
    SET_SCOPE(scopes, name, LOCAL);
    PySet_Add(local, name);
    return 1;
}
if (PySet_Contains(bound, name)) {
    SET_SCOPE(scopes, name, FREE);            // 向外层报告闭包需求
    PySet_Add(free, name);
}
```

## 导读

Python 函数内只要存在一次名称绑定，该名称通常就被整个 block 视为 local。这个决定在编译期完成，因此读取发生在赋值前会得到 UnboundLocalError，而不会动态回退到同名 global。symbol table 的核心任务是把“源码里出现了哪些定义和使用”转换成每个 block 的确定作用域。

一次遍历不够。访问外层函数时还不知道深层子函数是否会捕获某个 local；访问子函数时又需要知道父层有哪些 bound 名称。因此实现先收集事实与 block 树，再自顶向下传播环境、自底向上汇报 free variables。父 block 的 local 被子 block 捕获后成为 cell，运行时 frame 才会为它创建可共享槽。

class block 是重要反例：类体执行产生 namespace，但方法里的裸名称通常不会闭包捕获普通类属性；方法通过 global 或显式 __class__ cell 处理。comprehension、annotation scope、type parameter 等也会创建或调整隐式 block。资深回答应从具体版本的 symtable 结果验证，避免把 LEGB 口诀当作完整实现。

## 核心机制

- DEF_PARAM 与其他 local binding 冲突规则在收集阶段即可报 SyntaxError。
- global/nonlocal 必须先于同 block 对该名称的使用或绑定声明。
- FREE_CLASS 让方法访问的 free variable 与类 namespace 同名绑定正确共存。
- __class__ cell 由使用 zero-argument super 或 __class__ 的方法触发并由 class 构造阶段填充。
- CO_OPTIMIZED/CO_NEWLOCALS 与符号分类共同决定 frame 的 locals 表示和访问指令。

## 常见误区

- 把 LEGB 理解为每次读取都从 local 查不到后继续查 global；已分类为 local 的读取不会这样回退。
- 只分析函数嵌套，遗漏 class、comprehension、annotation 和 exec/import * 的特殊约束。
- 用 locals() 修改字典期待稳定改变 optimized fast locals。

## 可运行示例

```python
import symtable

source = """
rate = 2
def outer(base):
    total = base
    def inner(value):
        nonlocal total
        total += value
        return total * rate
    return inner
"""

root = symtable.symtable(source, "<lesson>", "exec")
outer = root.lookup("outer").get_namespace()
inner = outer.lookup("inner").get_namespace()

for scope in (root, outer, inner):
    print("\n", scope.get_name())
    for ident in scope.get_identifiers():
        s = scope.lookup(ident)
        print(ident, "local", s.is_local(), "free", s.is_free(),
              "global", s.is_global(), "nonlocal", s.is_nonlocal())
```

## 搭积木复现

### 收集 raw facts

遍历简化 AST，给每个 block 记录 def/use/param/global/nonlocal，先拒绝同 block 明显冲突。

### 传播环境

进入子函数时传入 bound/global 集合；将未本地绑定但命中 bound 的使用标记为 free。

### 反向升级 cell

子 block 返回 free 集合，父 block 若本地定义同名名称就将其升级为 cell，并从向上传播集合移除。

### 映射 opcode

对 local/global/free/cell 各生成一个最小函数，用 symtable 与 dis 验证分类和 LOAD/STORE 指令一致。

## 自检

### 问题

为什么 outer 的 local 只有在 inner 引用它时才需要成为 cell？

### 站内答案

普通 local 可以留在当前 frame 的快速局部槽中，生命周期不超过一次调用。被子函数捕获后，它必须在 outer 返回后继续存活，并让 outer 与所有闭包看到同一可变绑定；因此编译器用 cell 间接层承载该绑定。所有 local 都无条件装进 cell 会增加分配和间接访问成本。
