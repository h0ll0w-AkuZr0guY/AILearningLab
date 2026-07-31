---
id: "python-04-06"
track: "python"
title: "throw、close、GeneratorExit 与清理"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "Expressions · generator.throw and generator.close"
url: "https://docs.python.org/3/reference/expressions.html#generator.throw"

throw 在暂停点抛入异常；close 注入 GeneratorExit，并要求生成器结束而不能继续 yield。

## 真实源码

repo: "python/cpython"
file: "Objects/genobject.c"
symbol: "gen_close"
language: "c"
url: "https://github.com/python/cpython/blob/main/Objects/genobject.c#L464"

### 逐段讲解

- CREATED 与 FINISHED 可直接关闭；EXECUTING 被拒绝，只有 SUSPENDED 能安全注入清理控制流。
- 若暂停在 yield from，close 先沿委派链关闭子迭代器，防止只清理外层。
- 随后设置 GeneratorExit 并从同一个 frame evaluation 入口恢复，让 finally 有机会执行。

### 源码节选

```c
static PyObject *
gen_close(PyObject *self, PyObject *args)
{
    PyGenObject *gen = _PyGen_CAST(self);
    int8_t state = gen->gi_frame_state;

    if (state == FRAME_CREATED || FRAME_STATE_FINISHED(state))
        Py_RETURN_NONE;
    if (state == FRAME_EXECUTING)
        return gen_raise_already_executing_error(gen), NULL;

    if (state == FRAME_SUSPENDED_YIELD_FROM) {
        PyObject *delegated = /* 从 frame 栈取得当前子迭代器 */;
        gen_close_iter(delegated);            // 先向内传播 close
    }

    PyErr_SetNone(PyExc_GeneratorExit);        // 在 yield 暂停点注入
    return gen_send_ex(gen, Py_None, NULL, 1); // 恢复以运行 finally
}
```

## 导读

throw(exc) 把异常当作恢复输入，在当前 yield 表达式处抛出。生成器内部可以捕获、产出恢复值、转换异常或让它继续传播；因此 throw 返回的也是下一次 yield 的值。

close() 是受约束的异常注入：它在暂停点抛 GeneratorExit。生成器可以用 finally 清理，但若捕获后继续 yield，CPython 会报 RuntimeError，因为调用者要求结束而生成器拒绝终止。

资源安全不能只依赖对象析构时自动 close。引用环、实现差异和进程退出都会改变时机；拥有生成器的代码应明确消费完或 close，并优先使用 with/aclosing 表达所有权。

## 核心机制

- throw 的现代推荐签名是 throw(exception_instance)，旧三参数形式已逐步弃用。
- close 在未启动或已结束生成器上幂等返回。
- GeneratorExit 继承 BaseException，普通 except Exception 不会吞掉它。
- finally 可以执行清理；捕获 GeneratorExit 后应重新抛出或正常 return。

## 常见误区

- 用 except BaseException: pass 吞掉 GeneratorExit，然后继续 yield。
- 把 close 当成强制中断；Python 代码仍会先运行 finally，清理本身也可能失败。
- 外层生成器关闭时忘记关闭当前委派的子生成器，泄漏内部资源。

## 可运行示例

```python
events = []

def managed_stream():
    try:
        while True:
            try:
                command = yield "ready"
                events.append(("command", command))
            except ValueError as exc:
                events.append(("recovered", str(exc)))
                yield "recovered"
    finally:
        events.append(("cleanup", True))

gen = managed_stream()
assert next(gen) == "ready"
assert gen.throw(ValueError("bad")) == "recovered"
assert next(gen) == "ready"
gen.close()
assert events[-1] == ("cleanup", True)
```

## 搭积木复现

### 统一恢复入口

让 resume 接受 VALUE 或 EXCEPTION 两种输入，分别把值压栈或在暂停点触发异常。

### 实现 close 契约

close 注入 GeneratorExit；若执行结果再次是 YIELD，则升级为 RuntimeError。

### 追踪委派清理

构造 outer yield from inner，两层 finally 都记录事件，断言关闭顺序从内到外。

## 自检

### 问题

生成器为什么可以在 finally 中清理，却不能在收到 GeneratorExit 后继续 yield？

### 站内答案

close 的合同是“让暂停计算终止并完成清理”。finally 必须有运行机会，否则资源会泄漏；继续 yield 则把终止请求变成了新数据输出，使 close 无法保证结束，所以运行时将其视为违反协议并抛 RuntimeError。
