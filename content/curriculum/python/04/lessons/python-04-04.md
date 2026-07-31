---
id: "python-04-04"
track: "python"
title: "暂停帧：指令指针、值栈与异常状态"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-04-04.md"
---

## 官方入口

title: "Data model · Generator objects"
url: "https://docs.python.org/3/reference/datamodel.html#generator-objects"

生成器暂停时会保留局部绑定、指令位置、内部求值栈和异常处理状态，以便恢复后像普通调用一样继续。

## 真实源码

repo: "python/cpython"
file: "Objects/genobject.c"
symbol: "gen_send_ex2"
language: "c"
url: "https://github.com/python/cpython/blob/main/Objects/genobject.c#L260"

### 逐段讲解

- 恢复前把 send 的参数压入保存的 frame 值栈，作为暂停处 yield 表达式的结果。
- 生成器拥有独立 exc_state；恢复期间临时接入线程异常链，执行结束后再还原调用者的异常状态。
- _PyEval_EvalFrame 返回后，CPython 读取 generator_return_kind 区分本次是 yield 还是 return，并校验 frame 状态已经离开 EXECUTING。

### 源码节选

```c
static PySendResult
gen_send_ex2(PyGenObject *gen, PyObject *arg, PyObject **presult, int exc)
{
    _PyInterpreterFrame *frame = &gen->gi_iframe;

    PyObject *arg_obj = arg ? arg : Py_None;
    _PyFrame_StackPush(frame,
        PyStackRef_FromPyObjectNew(arg_obj)); // send 值压回暂停帧

    PyThreadState *tstate = _PyThreadState_GET();
    _PyErr_StackItem *previous = tstate->exc_info;
    gen->gi_exc_state.previous_item = previous;
    tstate->exc_info = &gen->gi_exc_state;    // 切换到生成器异常状态

    PyObject *result = _PyEval_EvalFrame(tstate, frame, exc);

    int kind = ((_PyThreadStateImpl *)tstate)->generator_return_kind;
    if (kind == GENERATOR_YIELD) {
        *presult = result;
        return PYGEN_NEXT;
    }
    *presult = result;
    return result ? PYGEN_RETURN : PYGEN_ERROR;
}
```

## 导读

生成器能暂停，关键不在保存“下一行行号”，而在保存完整解释器 continuation：下一条指令、局部变量、尚未消费的值栈、异常处理深度和当前异常。只保存源码行无法恢复一个暂停在表达式中间的函数。

CPython 把解释器帧嵌入或关联到 generator object。YIELD_VALUE 交出栈顶值并把 frame 标为 suspended；下一次 send 会把恢复值压回栈，RESUME 后它成为 yield 表达式的计算结果。

gi_running 防止同一生成器重入。生成器执行期间再次 next 自己会破坏同一 frame 的栈与指令状态，因此 CPython 在状态机入口直接拒绝。

## 核心机制

- gi_frame/f_frame 暴露调试视角，f_lasti、f_locals 可用于观察但不应改写运行时不变量。
- FRAME_CREATED、EXECUTING、SUSPENDED、CLEARED 约束合法转换。
- yield 前后可能跨越 try/finally，异常栈也必须随 frame 一起保存。
- 重入保护属于正确性约束，不只是线程安全优化。

## 常见误区

- 把生成器理解成保存局部变量的普通对象，忽略半完成表达式和值栈。
- 依赖某一 Python 版本 f_lasti 的具体偏移或字节码序列，3.11+ 指令与 inline cache 已有显著变化。
- 在 trace/profile hook 中递归驱动当前生成器，触发 already executing。

## 可运行示例

```python
import dis
import inspect

def pipeline(seed):
    doubled = seed * 2
    received = yield doubled
    return received + doubled

gen = pipeline(5)
assert inspect.getgeneratorstate(gen) == "GEN_CREATED"
assert next(gen) == 10

frame = gen.gi_frame
assert frame is not None
assert frame.f_locals == {"seed": 5, "doubled": 10}
assert inspect.getgeneratorstate(gen) == "GEN_SUSPENDED"

try:
    gen.send(7)
except StopIteration as stop:
    assert stop.value == 17

dis.dis(pipeline)  # 观察 RETURN_GENERATOR、YIELD_VALUE 与 RESUME
```

## 搭积木复现

### 画状态机

为 CREATED、EXECUTING、SUSPENDED、CLOSED 定义允许的输入和转换，先不执行字节码。

### 保存 continuation

用一个简化指令数组、pc、locals 和 value_stack 实现能在 YIELD 暂停的 mini frame。

### 加入重入与异常态

运行中拒绝二次 resume，并让 throw 从同一恢复入口携带异常标记进入。

## 自检

### 问题

为什么只保存局部变量和源码行号仍不足以恢复生成器？

### 站内答案

yield 可以位于表达式、try/finally 或委派操作中。恢复还需要知道精确指令位置、尚未完成表达式的值栈、异常处理栈和当前异常；源码行可能对应多条指令，也无法描述栈中间态。完整 frame continuation 才能无歧义继续。
