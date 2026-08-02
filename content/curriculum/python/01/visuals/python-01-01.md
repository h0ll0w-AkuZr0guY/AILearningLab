---
lesson: "python-01-01"
track: "python"
decision: "读完第二章后仍看不见：普通 GIL 64 位构建中共同头部、PyVarObject 与具体类型如何叠加，也看不见为什么同一张字节图不能外推到 free-threaded、调试或其它实现。用 tensor 展示一个明确构建的视图，再把 ABI 边界作为最后一步，最能避免把观察误当语言合同。"
---

## 视觉实验

### 逐字节展示 PyObject → PyVarObject → PyLongObject 的三层布局

id: "python-01-01-memory"
kind: "tensor"
placement: "chapter:2"
summary: "以普通 GIL 64 位构建为受限视图：引用状态占首个机器字，随后是类型指针；PyVarObject 追加 ob_size，具体类型再追加专属体。最后一步标出 free-threaded 会改变头部布局，强调共同头部模型不等于固定偏移 API。"
caption: "图中的 16/24 字节只对应普通 GIL 64 位视图。依据 Include/object.h v3.14.6（8594736f）；free-threaded、调试、32 位和 Stable ABI 场景须使用各自的公开 API 与 sizeof 实测。"
actionLabel: "推进到下一层"

#### 步骤

- PyObject | 普通 GIL 64 位视图为 16 字节：首个机器字保存引用状态，随后是 ob_type（类型指针）。这是观察图，不是 Python API。
- PyVarObject | 同一受限视图中追加 ob_size；list/tuple/bytes 用它表示可变部分的元素数。
- PyLongObject | 在 PyVarObject 基础上追加类型专属数字存储；具体 digit 宽度和对象大小由构建及实现决定。
- 布局契约 | 具体对象以 PyObject/PyVarObject 作为首部成员；扩展通过 PyObject_HEAD 与公开转换 API 表达，而非手写偏移。
- 类型专属体 | 每个类型按需追加字段：PyListObject 追加 ob_item 指针+allocated，PyFloatObject 直接存 double。
- 三合一 | 同一对象可按 PyObject*/PyVarObject*/具体类型三种视角解释；切换到 free-threaded 时该共同语义保留，字节布局则不再相同。

#### 观察重点

- 推进到「PyVarObject」前先预测：为什么元素数要与共同头部分离，而不应从固定偏移推导跨构建 API。
- 在普通 GIL CPython 中用 ctypes 比较类型指针；再解释为何 free-threaded、PyPy 和 Stable ABI 只能使用各自公开接口。
