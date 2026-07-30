---
id: "python-04-02"
track: "python"
title: "迭代耗尽、StopIteration 与 PEP 479"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "Expressions · Generator-iterator methods"
url: "https://docs.python.org/3/reference/expressions.html#generator-iterator-methods"

生成器 return 会以 StopIteration.value 传递结果；生成器体意外泄漏的 StopIteration 会依 PEP 479 转为 RuntimeError。

## 真实源码

repo: "python/cpython"
file: "Objects/genobject.c"
symbol: "gen_iternext"
language: "c"
url: "https://github.com/python/cpython/blob/main/Objects/genobject.c#L749"

### 逐段讲解

- gen_send_ex 把恢复结果分成 YIELD、RETURN、ERROR，而不是只返回一个可能为空的指针。
- 生成器 return value 在 RETURN 分支被包装进 StopIteration.value，供 yield from 或手工驱动器读取。
- 普通 for 只把 StopIteration 当控制信号并丢弃 value，因此聚合结果必须由委派表达式或显式驱动器接收。

### 源码节选

```c
static PyObject *
gen_iternext(PyObject *self)
{
    PyGenObject *gen = _PyGen_CAST(self);
    PyObject *result;

    if (gen_send_ex(gen, NULL, &result) == PYGEN_RETURN) {
        if (result != Py_None) {
            _PyGen_SetStopIterationValue(result); // return x -> StopIteration(x)
        }
        Py_CLEAR(result);
    }
    return result;                              // yield 值或 NULL + 异常状态
}
```

## 导读

StopIteration 在 iterator 边界上是正常结束信号，在普通业务函数里却是一种异常。消费方必须区分“拿到值”“正常耗尽”“真实错误”三态；CPython C API 也通过返回值加 error indicator 表达这三种情况。

生成器里的 return result 不会像普通函数那样直接返回调用者。它结束迭代，并把 result 放入 StopIteration.value。for 会吞掉这个值，yield from 则把它变成整个委派表达式的结果。

PEP 479 防止生成器体内部意外抛出的 StopIteration 被误判为正常结束。它越过生成器边界时会转成 RuntimeError；正确结束应使用 return，调用可能抛 StopIteration 的代码则应在生成器体内显式处理。

## 核心机制

- next(it, default) 只在 StopIteration 时返回 default，其他异常继续传播。
- 耗尽后的 iterator 应持续抛 StopIteration，不应神秘地重新开始。
- return x 编译为生成器返回路径，x 最终进入 StopIteration.value。
- PEP 479 的转换发生在异常将要逃出生成器边界时，内部 try/except StopIteration 仍然有效。

## 常见误区

- 用 raise StopIteration(value) 模拟生成器 return，现代 Python 会得到 RuntimeError。
- C 扩展只看 PyIter_Next 返回 NULL，不检查 PyErr_Occurred，因而吞掉真实异常。
- 把一个已经耗尽的 iterator 当成空容器并重复使用，掩盖上游提前消费。

## 可运行示例

```python
def child():
    yield "chunk"
    return {"count": 1}

it = child()
assert next(it) == "chunk"
try:
    next(it)
except StopIteration as stop:
    assert stop.value == {"count": 1}

def broken():
    # 这不是合法的“返回”，PEP 479 会把它改成 RuntimeError。
    raise StopIteration("accidental")
    yield

try:
    next(broken())
except RuntimeError as exc:
    assert isinstance(exc.__cause__, StopIteration)
```

## 搭积木复现

### 实现三态 next

写 next_result(iterator) 返回 VALUE、DONE、ERROR 三种枚举，禁止用 None 同时表示值和结束。

### 提取 return value

手工驱动含 return 的生成器，读取 StopIteration.value，再比较 for 循环为何看不到它。

### 制造协议泄漏

让生成器调用 next(empty_iterator)，分别不捕获与捕获 StopIteration，验证 PEP 479 的边界。

## 自检

### 问题

为什么 PEP 479 要把生成器体意外抛出的 StopIteration 改成 RuntimeError？

### 站内答案

因为生成器调用者把 StopIteration 解释为“正常耗尽”。若生成器内部任意一层代码意外抛出它，错误会静默截短数据流。转换成 RuntimeError 能保留失败可见性；生成器作者仍可用 return 正常结束，或在内部明确捕获确实属于局部协议的 StopIteration。
