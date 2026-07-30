---
id: "python-09-09"
track: "python"
title: "GIL、释放点、free-threading 与线程安全"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "Python support for free threading"
url: "https://docs.python.org/3/howto/free-threading-python.html"

传统构建用 GIL 串行化 Python 执行；3.13+ 可选 free-threaded 构建允许多核 Python threads，但扩展可能重新启用 GIL且对象同步成本改变。

## 导读

GIL 保护 CPython 运行时，让一个解释器中通常只有一个线程执行 Python bytecode；线程在 I/O、显式释放 GIL 的 C 扩展或调度切换时交棒。它不保证复合业务操作原子，也不阻止操作系统 I/O 并发。

free-threaded 构建移除全局锁，使用容器内部锁、biased/deferred reference counting、immortalization 与 QSBR 等机制。它能让 CPU Python threads 多核并行，也带来单线程/内存开销和新的真实数据竞争；未声明兼容的 C 扩展可在导入时重新启用 GIL。

## 核心机制

- sys._is_gil_enabled 检查运行态，sysconfig Py_GIL_DISABLED 检查构建能力。
- NumPy/压缩/加密等 C 代码可能释放 GIL并行，需看具体 API。
- 内建类型内部锁是实现保护，不是多步骤业务事务。
- 锁、Queue、immutable snapshot 仍是跨构建可移植同步合同。

## 常见误区

- 说“有 GIL 所以 dict check-then-set 线程安全”。
- 说“线程对 CPU 永远无用”，忽略释放 GIL 的扩展/free-threaded。
- 启用 free-threading 后删除所有锁，暴露复合不变量竞态。

## 可运行示例

```python
import sys
import sysconfig
import threading

build_supports_free_threading = bool(
    sysconfig.get_config_var("Py_GIL_DISABLED")
)
gil_enabled = (
    sys._is_gil_enabled()
    if hasattr(sys, "_is_gil_enabled")
    else True
)

lock = threading.Lock()
state = {"balance": 0}

def deposit(amount):
    # 读-改-写是复合不变量，跨构建都应显式同步。
    with lock:
        state["balance"] += amount
```

## 搭积木复现

### 分层声明

区分 bytecode、C extension、I/O、业务复合操作各自并行/原子边界。

### 双构建测试

GIL 与 free-threaded 上跑 race stress、TSAN/扩展兼容和性能基准。

### 证明锁范围

锁保护具体不变量而非“整个函数”，测竞争、粒度与死锁顺序。

## 自检

### 问题

GIL 为什么不能保证 `if key not in d: d[key] = value` 的业务原子性？

### 站内答案

这是多个操作组成的 check-then-act，中间可在字节码/C 调用/调度点切换，另一线程也可能通过检查并写入。GIL 保护解释器内部免于结构损坏，不把任意多步逻辑变成事务；应使用锁或原子化 owner API。
