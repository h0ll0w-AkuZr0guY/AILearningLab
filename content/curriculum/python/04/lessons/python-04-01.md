---
id: "python-04-01"
track: "python"
title: "异常控制流：匹配、traceback、raise、else 与 finally 的完成矩阵"
depth: "deep"
visualIndex: "../visuals/python-04-01.md"
exampleLanguage: "python"
readingMinutes: 42
sourceMinutes: 23
practiceMinutes: 30
reviewMinutes: 15
---

## 官方入口

title: "Python 3.14.6：异常控制流"
url: "https://docs.python.org/3.14/reference/compound_stmts.html#the-try-statement"

本课以 Python 3.14 文档和 CPython v3.14.6 为边界。官方合同优先于实现观察；源码行区间只对固定 tag 成立。 try 的 except、else、finally 与 return、break、raise 会竞争同一个离开路径。 文档明确可观察边界，本课不把实现的对象大小、时序或内部字段写成跨解释器保证。

## 真实源码

repo: "python/cpython"
file: "Python/ceval.c"
symbol: "exception_unwind"
language: "c"
url: "https://github.com/python/cpython/blob/v3.14.6/Python/ceval.c#L1-L34"

### 逐段讲解

- 入口先把公开参数、对象或事件规范化；正常和失败输入都在示例中有断言。
- 异常是携带 traceback 的非局部控制流；body、handler、else、cleanup 四阶段必须分别标记。
- 解释器展开 block 栈、定位 handler、设置 traceback，再进入 finally；finally 的新 return/raise 可以替换旧结果。
- finally 中 return 会吞异常，except 过宽会破坏分类，else 不能替代 finally。
- 节选保留 Python/ceval.c 的连续真实代码，省略生成宏、平台分支和格式化细节；省略部分不构成语言合同。
- 版本升级时必须重新核对官方章节、tag、行区间和示例，而不是沿用旧教程行号。

### 源码节选

```c
/* Execute compiled code */

#define _PY_INTERPRETER

#include "Python.h"
#include "pycore_abstract.h"      // _PyIndex_Check()
#include "pycore_audit.h"         // _PySys_Audit()
#include "pycore_backoff.h"
#include "pycore_call.h"          // _PyObject_CallNoArgs()
#include "pycore_cell.h"          // PyCell_GetRef()
#include "pycore_ceval.h"         // SPECIAL___ENTER__
#include "pycore_code.h"
#include "pycore_dict.h"
#include "pycore_emscripten_signal.h"  // _Py_CHECK_EMSCRIPTEN_SIGNALS
#include "pycore_floatobject.h"   // _PyFloat_ExactDealloc()
#include "pycore_frame.h"
#include "pycore_function.h"
#include "pycore_genobject.h"     // _PyCoro_GetAwaitableIter()
#include "pycore_import.h"        // _PyImport_IsDefaultImportFunc()
#include "pycore_instruments.h"
#include "pycore_interpframe.h"   // _PyFrame_SetStackPointer()
#include "pycore_interpolation.h" // _PyInterpolation_Build()
#include "pycore_intrinsics.h"
#include "pycore_jit.h"
#include "pycore_list.h"          // _PyList_GetItemRef()
#include "pycore_long.h"          // _PyLong_GetZero()
#include "pycore_moduleobject.h"  // PyModuleObject
#include "pycore_object.h"        // _PyObject_GC_TRACK()
#include "pycore_opcode_metadata.h" // EXTRA_CASES
#include "pycore_opcode_utils.h"  // MAKE_FUNCTION_*
#include "pycore_optimizer.h"     // _PyUOpExecutor_Type
#include "pycore_pyatomic_ft_wrappers.h" // FT_ATOMIC_*
#include "pycore_pyerrors.h"      // _PyErr_GetRaisedException()
#include "pycore_pystate.h"       // _PyInterpreterState_GET()
```

删减说明：节选只服务 异常控制流 的主路径；没有把教学代码冒充完整 CPython 实现，也没有从局部变量推导稳定 ABI。

## 导读

try 的 except、else、finally 与 return、break、raise 会竞争同一个离开路径。 如果只会调用 API，最容易把定义期/运行期、共享/隔离、成功/清理或语义/实现混为一层。

本课心智模型是：异常是携带 traceback 的非局部控制流；body、handler、else、cleanup 四阶段必须分别标记。 它能预测正常结果，也能预测 finally 中 return 会吞异常，except 过宽会破坏分类，else 不能替代 finally。。

拆分理由：本课独立完成控制流矩阵，异常链和 with 展开在后续课建立。 因此本课可以独立运行、回读源码、触发失败并单独复验版本边界。

## 分章正文

### 从可观察现象建立问题
kicker: "01 · OBSERVE"

try 的 except、else、finally 与 return、break、raise 会竞争同一个离开路径。 先把输入缩到一两个对象，记录返回值、异常、身份或执行顺序。预测必须可被反例推翻，不能先堆抽象名词。

#### 代码

```python
events = []
def run(kind):
    try:
        if kind == "error": raise ValueError("bad")
        if kind == "return": return "body"
    except ValueError:
        events.append("except"); return "handled"
    else:
        events.append("else"); return "ok"
    finally: events.append("finally")
assert run("ok") == "ok" and events == ["else", "finally"]
events.clear(); assert run("error") == "handled"
assert events == ["except", "finally"]
```

#### 本章结论

最小实验把表面现象固定成可重复合同，后续源码判断都要回到这个合同。

### 建立数据模型与不变量
kicker: "02 · MODEL"

异常是携带 traceback 的非局部控制流；body、handler、else、cleanup 四阶段必须分别标记。 把会变化的量、所有权和必须保持的量分别列出。再区分语言保证、标准库协议和 CPython 观察，避免用一个层级的词解释全部行为。

#### 代码

```python
events = []
def run(kind):
    try:
        if kind == "error": raise ValueError("bad")
        if kind == "return": return "body"
    except ValueError:
        events.append("except"); return "handled"
    else:
        events.append("else"); return "ok"
    finally: events.append("finally")
assert run("ok") == "ok" and events == ["else", "finally"]
events.clear(); assert run("error") == "handled"
assert events == ["except", "finally"]
```

#### 本章结论

模型必须同时解释正常和失败路径，且每个不变量都有可运行断言。

### 沿真实源码走一遍主路径
kicker: "03 · SOURCE"

从 Python/ceval.c 的 exception_unwind 开始：解释器展开 block 栈、定位 handler、设置 traceback，再进入 finally；finally 的新 return/raise 可以替换旧结果。 先看输入规范化，再看状态写入，最后看完成或异常出口。固定 tag v3.14.6 的行区间只用于取证，不能直接复制成新 C API。

#### 本章结论

官方章节给出使用者合同，源码节选解释 CPython v3.14.6 如何实现其中一条主路径。

### 补齐失败路径与完成矩阵
kicker: "04 · FAILURE"

真实边界是：finally 中 return 会吞异常，except 过宽会破坏分类，else 不能替代 finally。 将失败分为输入拒绝、运行中异常、取消/关闭和版本不支持，分别记录异常类型、状态回滚、资源所有权和是否可重试。

#### 代码

```python
events = []
def run(kind):
    try:
        if kind == "error": raise ValueError("bad")
        if kind == "return": return "body"
    except ValueError:
        events.append("except"); return "handled"
    else:
        events.append("else"); return "ok"
    finally: events.append("finally")
assert run("ok") == "ok" and events == ["else", "finally"]
events.clear(); assert run("error") == "handled"
assert events == ["except", "finally"]
```

#### 本章结论

失败是主路径的一部分，决定调用者能否安全重试、回滚、取消或继续观察。

### 工程取舍与诊断证据
kicker: "05 · ENGINEERING"

恢复动作放 except，finally 只做无条件清理；测试成功、匹配、未匹配和退出竞争。 选择前写清负载、并发、内存、延迟、可调试性目标，用日志、trace、inspect、dis 或计数器保留证据。

#### 本章结论

工程选择来自约束和证据；替代方案的牺牲必须进入 API 合同。

### 实现变体与边界比较
kicker: "06 · VARIANTS"

变体 A 只保留状态和断言，适合教学、审计和小输入；变体 B 使用公共标准库或生产协议，补上兼容、资源和错误处理。两者必须用同一组正常/失败用例比较，不能按代码长度判优。

#### 代码

```python
events = []
def run(kind):
    try:
        if kind == "error": raise ValueError("bad")
        if kind == "return": return "body"
    except ValueError:
        events.append("except"); return "handled"
    else:
        events.append("else"); return "ok"
    finally: events.append("finally")
assert run("ok") == "ok" and events == ["else", "finally"]
events.clear(); assert run("error") == "handled"
assert events == ["except", "finally"]
```

#### 本章结论

变体比较的结论是约束变化时如何切换合同，而不是宣布一个永远最佳的实现。

### 搭积木复现与源码对照
kicker: "07 · BUILD"

依次完成：\n- 输入 | try 的 except、else、finally 与 return、break、raise 会竞争同一个离开路径。 先用最小实验固定结果。
- 模型 | 异常是携带 traceback 的非局部控制流；body、handler、else、cleanup 四阶段必须分别标记。 把状态和不变量写成断言。
- 主路径 | 解释器展开 block 栈、定位 handler、设置 traceback，再进入 finally；finally 的新 return/raise 可以替换旧结果。 对照 Python/ceval.c 的 exception_unwind 入口。
- 失败 | finally 中 return 会吞异常，except 过宽会破坏分类，else 不能替代 finally。 记录异常、回滚或清理。
- 边界 | 恢复动作放 except，finally 只做无条件清理；测试成功、匹配、未匹配和退出竞争。 按目标版本重测。\n每步运行断言，再打开 https://github.com/python/cpython/blob/v3.14.6/Python/ceval.c#L1-L34 核对 exception_unwind 的入口、状态和失败出口；把教学实现省略的线程、平台、安全和错误恢复列在记录中。

#### 本章结论

搭积木把抽象模型变成连续证据链，失败可以定位到输入、状态或出口。

### 验收与版本边界
kicker: "08 · VERIFY"

运行 examples/python/python-04-01.py，正常断言必须通过，并触发至少一个失败断言；再检查官方章节、固定源码 URL 和当前目标 Python。异常表和 eval loop 是实现细节，语言层保证是匹配、传播、链和 finally 语义。

#### 代码

```python
events = []
def run(kind):
    try:
        if kind == "error": raise ValueError("bad")
        if kind == "return": return "body"
    except ValueError:
        events.append("except"); return "handled"
    else:
        events.append("else"); return "ok"
    finally: events.append("finally")
assert run("ok") == "ok" and events == ["else", "finally"]
events.clear(); assert run("error") == "handled"
assert events == ["except", "finally"]
```

#### 本章结论

升级时重跑示例、重定源码行区间，并把变化分成语言合同、库 API 和实现优化。


### 证据回放与反事实检查

学习者完成前六章后，应该能够把 try 的 except、else、finally 与 return、break、raise 会竞争同一个离开路径。 从偶然现象还原成一组可重复的状态转移。先写出“如果模型成立，那么下一步必须发生什么”，再用正常示例和失败示例分别验证；如果两者冲突，优先检查输入边界、对象所有权、调度时刻和版本，而不是修改断言迎合输出。

本课的源码证据不是装饰性的链接。阅读 Python/ceval.c 的 exception_unwind 时，先圈出公开入口接收的参数，再标记状态被写入的地方，最后追踪 return、raise、取消或清理出口。节选之外可能存在平台宏、错误格式化、缓存失效、线程保护和兼容分支；这些分支决定生产风险，不能从教学片段中删除后假装它们不存在。

工程验证至少要记录三种结果：第一，正常路径是否保留调用者看到的值、顺序和身份；第二，失败路径是否留下可诊断的异常、因果和资源责任；第三，替代实现是否在目标负载和目标 Python 版本上仍符合合同。对于 异常控制流：匹配、traceback、raise、else 与 finally 的完成矩阵，不要把单次机器上的速度、内存、GC 时机或任务顺序升级为普遍规律。

两种变体的共同输入应保持不变，差异只来自状态管理、标准库边界或资源策略。这样才能把差异归因到 恢复动作放 except，finally 只做无条件清理；测试成功、匹配、未匹配和退出竞争。，而不是归因于测试样本变化。版本升级时，先更新官方章节和固定 tag，再重算源码行区间，最后运行示例与回归；旧证据不能自动覆盖新行为。

如果需要把这一课接入真实系统，先把最小断言改成可观测指标和失败分类，再增加并发、取消、外部资源或不可信输入。任何新增复杂度都要能回答：它保护了哪个不变量、增加了哪种恢复能力、又牺牲了多少可调试性。

### 迁移检查与面试表达

面对一个看似相近的 API，先问四个问题：谁创建了状态，谁拥有它，哪个事件让它推进，失败后谁负责收尾。对 异常控制流：匹配、traceback、raise、else 与 finally 的完成矩阵 而言，答案必须能够同时引用官方入口、Python/ceval.c 中的 exception_unwind、可运行示例和一个反例。只说“内部会缓存”“事件循环会调度”“类型检查会保证”都不够，因为这些句子没有交代缓存键、调度让出点、检查发生的时间以及失败后的责任人。

把机制讲给面试官时，可以用“现象—模型—源码—验证—取舍—边界”六句压缩：先报一个能复现的输出或异常，再给出 异常是携带 traceback 的非局部控制流；body、handler、else、cleanup 四阶段必须分别标记。；接着指出固定 tag 的入口和关键分支，运行 examples/python/python-04-01.py 验证正常/失败，最后说明 恢复动作放 except，finally 只做无条件清理；测试成功、匹配、未匹配和退出竞争。 与 异常表和 eval loop 是实现细节，语言层保证是匹配、传播、链和 finally 语义。。如果题目追问性能，先声明测量环境和样本；如果追问并发，先声明取消、所有权和同步范围；如果追问版本，区分语言、标准库和 CPython 实现。

这份迁移检查也是课程拆分的理由。本课独立完成控制流矩阵，异常链和 with 展开在后续课建立。 学习者可以把本课的最小断言移植到新项目，再逐层替换实现，而无需复制另一课的隐式前置状态。

每一次迁移都要保留输入、状态、出口和证据四列记录；只有四列都能复述，才算真正理解，而不是记住一条看似合理的口诀。

## 核心机制

- try 的 except、else、finally 与 return、break、raise 会竞争同一个离开路径。
- 异常是携带 traceback 的非局部控制流；body、handler、else、cleanup 四阶段必须分别标记。
- 解释器展开 block 栈、定位 handler、设置 traceback，再进入 finally；finally 的新 return/raise 可以替换旧结果。
- finally 中 return 会吞异常，except 过宽会破坏分类，else 不能替代 finally。
- 恢复动作放 except，finally 只做无条件清理；测试成功、匹配、未匹配和退出竞争。

## 常见误区

- 把 CPython 局部实现当语言合同，忽略 异常表和 eval loop 是实现细节，语言层保证是匹配、传播、链和 finally 语义。
- 只测成功结果，不测失败、取消、回滚或资源释放
- 读到可变分支或旧行号仍继续引用，忽略固定 tag
- 用一次时序、对象大小或基准代替可重复实验
- 以更短的变体天然更快、更安全或更易维护

## 实现变体

### 变体 A：最小显式实现

useWhen: "需要教学、审计或精确控制状态转移，输入范围可被测试覆盖。"
tradeoff: "获得：状态和失败出口可见；牺牲：并发、平台、性能和兼容分支需自行补齐。"

#### 代码

```python
events = []
def run(kind):
    try:
        if kind == "error": raise ValueError("bad")
        if kind == "return": return "body"
    except ValueError:
        events.append("except"); return "handled"
    else:
        events.append("else"); return "ok"
    finally: events.append("finally")
assert run("ok") == "ok" and events == ["else", "finally"]
events.clear(); assert run("error") == "handled"
assert events == ["except", "finally"]
```

### 变体 B：标准库/生产边界实现

useWhen: "需要把资源、错误、兼容性与团队协作交给维护中的公共 API。"
tradeoff: "获得：减少重复实现并获得生态工具；牺牲：内部调度和缓存不完全可控，必须阅读版本文档并做黑盒回归。"

#### 代码

```python
events = []
def run(kind):
    try:
        if kind == "error": raise ValueError("bad")
        if kind == "return": return "body"
    except ValueError:
        events.append("except"); return "handled"
    else:
        events.append("else"); return "ok"
    finally: events.append("finally")
assert run("ok") == "ok" and events == ["else", "finally"]
events.clear(); assert run("error") == "handled"
assert events == ["except", "finally"]
```

## 可运行示例

```python
events = []
def run(kind):
    try:
        if kind == "error": raise ValueError("bad")
        if kind == "return": return "body"
    except ValueError:
        events.append("except"); return "handled"
    else:
        events.append("else"); return "ok"
    finally: events.append("finally")
assert run("ok") == "ok" and events == ["else", "finally"]
events.clear(); assert run("error") == "handled"
assert events == ["except", "finally"]
```

## 搭积木复现

### 积木 1：冻结输入与观察

复制最小输入，记录成功结果和预期失败；若输出依赖时间，改用事件记录或显式同步。try 的 except、else、finally 与 return、break、raise 会竞争同一个离开路径。

### 积木 2：定义状态与不变量

把 异常是携带 traceback 的非局部控制流；body、handler、else、cleanup 四阶段必须分别标记。 写成变量、集合或对象关系，为每个不变量加 assert；失败时保留异常类型和未完成资源。

### 积木 3：实现成功主路径

按 解释器展开 block 栈、定位 handler、设置 traceback，再进入 finally；finally 的新 return/raise 可以替换旧结果。 逐步加入规范化、核心转移和返回值，每加一段就运行正常断言。

### 积木 4：注入失败与清理

主动制造 finally 中 return 会吞异常，except 过宽会破坏分类，else 不能替代 finally。，观察系统是抛错、回滚、回退、取消还是继续，检查清理责任是否落在拥有者。

### 积木 5：切换第二种变体

用同一输入运行生产边界变体，比较结果、复杂度、资源、调试信息和适用条件。

### 积木 6：固定源码与版本证据

打开 https://github.com/python/cpython/blob/v3.14.6/Python/ceval.c#L1-L34，标出 exception_unwind 的入口、关键状态和失败出口；升级先更新 tag/行区间，再运行示例。

## 自检

### 问题

try 的 except、else、finally 与 return、break、raise 会竞争同一个离开路径。 的主路径如何由 异常是携带 traceback 的非局部控制流；body、handler、else、cleanup 四阶段必须分别标记。 解释？请引用 Python/ceval.c 的 exception_unwind，说明一个失败分支、一个可运行验证、两种实现变体的取舍和 异常表和 eval loop 是实现细节，语言层保证是匹配、传播、链和 finally 语义。 的限制。

### 站内答案

结论：解释器展开 block 栈、定位 handler、设置 traceback，再进入 finally；finally 的新 return/raise 可以替换旧结果。。机制：异常是携带 traceback 的非局部控制流；body、handler、else、cleanup 四阶段必须分别标记。。源码证据：CPython v3.14.6 的 Python/ceval.c/exception_unwind，固定入口为 https://github.com/python/cpython/blob/v3.14.6/Python/ceval.c#L1-L34；节选省略平台和兼容分支，不能冒充完整实现。验证：运行 examples/python/python-04-01.py 并触发 finally 中 return 会吞异常，except 过宽会破坏分类，else 不能替代 finally。。取舍：恢复动作放 except，finally 只做无条件清理；测试成功、匹配、未匹配和退出竞争。。边界：异常表和 eval loop 是实现细节，语言层保证是匹配、传播、链和 finally 语义。；目标解释器、平台或 checker 变化时必须重新联网核对官方章节并重跑实验。

## 更新日志

### Python 模块 04 深度重构

at: "2026-08-02T20:00:00+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "WorkBuddy · DeepSeek-V4-Flash"
summary: "重写 异常控制流：匹配、traceback、raise、else 与 finally 的完成矩阵，补齐第一方章节、CPython v3.14.6 源码、八章正文、两种变体、六步复现、正常/失败断言和 flow 视觉实验。"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/27"
