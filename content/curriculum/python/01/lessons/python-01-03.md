---
id: "python-01-03"
track: "python"
title: "名称绑定与 rebinding"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "Execution model · Naming and binding"
url: "https://docs.python.org/3/reference/executionmodel.html#naming-and-binding"

赋值语句把名称绑定到对象；重新赋值只改变当前命名空间里的绑定，不会把旧对象原地改造成新值。

## 导读

Python 名称可以理解为命名空间字典中的键，值是对象引用。执行 x = expression 时，解释器先求 expression 得到对象，再让当前作用域中的 x 指向它。赋值没有“把值塞进固定变量格子”的复制语义。

rebind 改变的是名称到对象的边，不会影响其他名称。mutation 改变的是对象自身，所有指向该对象的名称都会观察到变化。区分这两种操作，是理解函数参数、闭包和共享状态的地基。

作用域决定绑定写到哪里。函数内赋值默认创建局部名称；global 与 nonlocal 改变编译器对名称的分类，并分别指向模块命名空间或最近的闭包 cell。

## 核心机制

- 右侧表达式先求值，左侧 target 随后执行绑定；多重赋值也遵循先计算后绑定。
- 局部名称通常编译为 LOAD_FAST/STORE_FAST，全局名称走 LOAD_GLOBAL，闭包变量走 LOAD_DEREF/STORE_DEREF。
- del x 删除绑定并减少一次引用，不保证对象立即销毁，因为其他名称或容器可能仍持有它。
- 参数传递创建新的局部名称并绑定到调用者提供的同一对象，这常被称为 call by sharing。

## 常见误区

- 把参数重新赋值误认为能替换调用者的变量。函数只改变自己的局部绑定。
- 把 += 一概视为原地修改。list.__iadd__ 常修改原对象，tuple.__iadd__ 实际会创建新 tuple 并重新绑定。
- 在函数中读取后再给同名变量赋值，忽略编译期局部变量判定，触发 UnboundLocalError。

## 可运行示例

```python
def rebind_and_mutate(items):
    alias = items
    items.append("shared")     # 修改同一个 list
    items = ["new"]           # 只重绑局部名称
    return alias, items

original = []
alias, local = rebind_and_mutate(original)

assert original == ["shared"]
assert alias is original
assert local == ["new"]
assert local is not original
```

## 搭积木复现

### 画名称到对象的箭头

分别画出函数调用前、append 后、局部重绑定后的对象图，不使用“变量里装着值”的说法。

### 对照字节码

用 dis.dis 比较局部、global 与 nonlocal 的 LOAD/STORE 指令，确认作用域在编译阶段已经分类。

### 加入可变与不可变对象

用 list、tuple 各运行一次 +=，同时记录 id，解释协议为什么产生不同可观察行为。

## 自检

### 问题

函数执行 parameter = new_value 后，为什么调用者的同名变量不变，而 parameter.append(...) 却可能被调用者观察到？

### 站内答案

调用时参数只是新的局部名称，它与调用者名称暂时指向同一对象。重新赋值只改局部命名空间中的那条边；append 修改共同指向的对象，所以其他引用也能观察到。
