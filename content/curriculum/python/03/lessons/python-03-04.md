---
id: "python-03-04"
track: "python"
title: "closure cell、cellvars 与 freevars"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "Execution model · Naming and binding"
url: "https://docs.python.org/3/reference/executionmodel.html#naming-and-binding"

嵌套函数引用外层局部名称时，外层名称成为 cell variable，内层对应为 free variable；函数 closure 保存共享绑定 cell。

## 导读

闭包捕获的不是一次值复制，而是一格可共享绑定。编译器发现内层函数引用外层局部名称后，把外层名称从普通 fast local 提升为 cell；创建内层函数时，把该 cell 放入 __closure__。

同一外层调用产生的多个内层函数可共享一个 cell，所以 nonlocal 修改会被全部观察到。不同外层调用则创建不同 cell，形成互相隔离的状态实例。

code.co_cellvars 描述本函数创建、供内层使用的名称；code.co_freevars 描述本函数需要从外层接收的名称。function.__closure__ 的 cell 顺序与 co_freevars 一一对应。

## 核心机制

- MAKE_CELL/COPY_FREE_VARS 等指令准备 cell 环境，LOAD_DEREF/STORE_DEREF 读取或修改绑定。
- cell 保存对象引用，不执行深拷贝，因此捕获可变对象仍有别名语义。
- nonlocal 在编译期要求找到已有外层绑定，不能凭空创建。
- 删除 cell 绑定后读取可产生 NameError/空 cell 状态，cell 对象本身仍可存在。

## 常见误区

- 把 closure 解释成函数源码文本或整份外层 locals 快照。
- 循环中创建多个 lambda 时以为每次自动复制循环变量。
- 用可变闭包状态实现跨请求缓存，却没有并发、重入和清理合同。

## 可运行示例

```python
def make_counter():
    count = 0

    def increment():
        nonlocal count
        count += 1
        return count

    def current():
        return count

    return increment, current

increment, current = make_counter()
assert increment.__closure__[0] is current.__closure__[0]
assert increment() == 1
assert current() == 1
assert increment.__code__.co_freevars == ("count",)
```

## 搭积木复现

### 观察 cell 身份

返回两个读取同一外层名称的函数，比较对应 __closure__ 元素是否为同一对象。

### 对照 cellvars/freevars

外层 code.co_cellvars 与内层 code.co_freevars 使用同一名称但描述不同责任。

### 实现 nonlocal 状态机

让一个函数写 cell、另一个函数读 cell，并补两个独立 factory 调用的隔离测试。

## 自检

### 问题

为什么同一个 factory 返回的两个闭包能共享状态，而两次 factory 调用返回的闭包不会互相影响？

### 站内答案

一次外层调用为 cell variable 创建一组运行时 cell，并把相同 cell 交给本次创建的内层函数；下一次调用拥有新的 frame 和新的 cell。共享边界由外层调用实例决定，而非由 code object 决定。
