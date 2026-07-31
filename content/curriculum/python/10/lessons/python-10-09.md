---
id: "python-10-09"
track: "python"
title: "vectorcall：参数数组、关键字名称与绑定"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "Python/C API · Call Protocol"
url: "https://docs.python.org/3/c-api/call.html#the-vectorcall-protocol"

vectorcall 让内部调用通过连续 PyObject* 参数数组传值，避免为每次调用先物化 positional tuple 与 keyword dict；协议自 Python 3.9 起公开。

## 真实源码

repo: "python/cpython"
file: "Objects/call.c · Objects/funcobject.c · Python/ceval.c"
symbol: "PyObject_Vectorcall"
language: "c"
url: "https://github.com/python/cpython/blob/main/Objects/call.c"

### 逐段讲解

- tp_call 接收 args tuple 和 kwargs dict，通用却需要创建容器。vectorcall 接收 callable、PyObject* 连续数组、nargsf 和只含关键字名称的 kwnames tuple。
- args 前半段是 positional values，后半段按 kwnames 顺序放 keyword values；关键字名称和值分离，使调用点常量名称 tuple 可复用。
- 支持 vectorcall 的类型通过 offset/函数指针暴露入口。调用辅助函数优先走 fast path，不支持时才回落到传统协议；callee 仍必须执行完整参数绑定和错误检查。

### 源码节选

```c
/* f(10, scale=2) 的概念布局 */
PyObject *values[2] = {ten, two};             // 先位置值，再关键字值
PyObject *kwnames = PyTuple_Pack(1, name_scale);

PyObject *result = PyObject_Vectorcall(
    callable,
    values,
    1,                                        // 位置参数数量，不含关键字值
    kwnames
);

/* nargsf 可能携带 PY_VECTORCALL_ARGUMENTS_OFFSET 标志；
   必须用 PyVectorcall_NARGS(nargsf) 提取真实位置参数数。 */
```

## 导读

函数调用看似一条 CALL 指令，背后却要完成 callable 检查、参数传输、关键字匹配、默认值填充、*args/**kwargs 收集、frame 创建和错误格式化。传统 tp_call 把位置参数封成 tuple、关键字封成 dict，适合作为稳定通用边界；解释器内部大量短调用会为这些临时容器付出显著成本。

vectorcall 的核心是“借用调用方已有的连续栈布局”。值已经位于 evaluation stack，相邻内存可以直接作为 PyObject* 数组传给 callee；固定关键字名称通常来自 code object，可复用 kwnames tuple。省掉的是中间容器物化和哈希插入，Python 参数语义没有缩水。

快速传输之后仍要绑定。positional-only 不接受同名 keyword，普通参数不能被重复赋值，keyword-only 必须按名匹配，多余值进入 *args/**kwargs 或触发 TypeError。真正的优化来自将常见无歧义路径内联、延迟构造可变容器，同时保留冷失败路径的准确错误。

## 核心机制

- nargsf 的低位/标志组合通过 PyVectorcall_NARGS 解码，不能直接当整数使用。
- PY_VECTORCALL_ARGUMENTS_OFFSET 允许 callee 临时使用 args[-1] scratch slot，前提是恢复原值。
- bound method fast path 可把 self 放进参数数组，避免创建临时 method object 或 tuple。
- 重新赋值 type.__call__ 可能改变 vectorcall 支持，缓存 callable 能力时必须遵循类型版本机制。
- vectorcall 不替 callee 自动做 recursion control；需要递归保护的实现自行进入/离开检查。

## 常见误区

- 把 vectorcall 说成完全绕过参数绑定；它只优化传输和常见调用路径。
- 错误计算 positional count，把 keyword values 也算进 nargs。
- 保存 borrowed args 指针到调用结束之后，造成悬垂引用或所有权错误。

## 可运行示例

```python
import inspect

def bind_like_python(a, /, b=2, *items, scale, **options):
    return a, b, items, scale, options

sig = inspect.signature(bind_like_python)
bound = sig.bind(10, 20, 30, scale=4, debug=True)
bound.apply_defaults()
print(bound.arguments)

cases = [
    lambda: bind_like_python(a=10, scale=2),       # positional-only
    lambda: bind_like_python(10, 20, b=30, scale=2), # duplicate
    lambda: bind_like_python(10),                  # missing kw-only
]
for call in cases:
    try:
        call()
    except TypeError as error:
        print(type(error).__name__, error)
```

## 搭积木复现

### 画参数内存图

对 f(1, 2, x=3, y=4) 标出 args 数组、nargs、kwnames 和每个引用的所有权。

### 实现 binder

用参数 kind 表驱动位置绑定、keyword 查找、默认值和 variadic 收集；每个失败分支写精确测试。

### 比较物化成本

实现 tuple/dict 协议与 array/kwnames 协议，统计临时容器和哈希插入次数，不只测一个纳秒数字。

### 追踪真实调用

从 CALL 指令到 _PyObject_VectorcallTstate，再到 Python function vectorcall/frame 初始化，画出 fast/slow 两条路径。

## 自检

### 问题

vectorcall 的主要收益来自哪里，为什么它不会改变 Python 函数签名语义？

### 站内答案

收益来自复用调用点已有的连续值布局和可复用关键字名称，减少 tuple、dict 创建及关键字哈希插入。callee 仍根据同一签名表执行 positional-only、keyword-only、默认值、重复赋值和 variadic 规则，因此优化的是数据搬运与常见路径，不是语言合同。
