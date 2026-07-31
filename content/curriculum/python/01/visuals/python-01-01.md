---
lesson: "python-01-01"
track: "python"
decision: "本课的学习障碍集中在对象布局、引用关系与生命周期。读完文字后仍需同时追踪“PyObject 头部与 ob_type”中的多项变化，因此用结构格把相邻正文的真实机制拆成可单步核对的状态。"
---

## 视觉实验

### 展开结构并定位“PyObject 头部与 ob_type”

id: "python-01-01-main"
kind: "tensor"
placement: "mechanisms"
summary: "把本课核心机制中的真实状态与约束按步骤展开，使学习者能观察“PyObject 头部与 ob_type”中先发生什么、后发生什么，以及哪一个不变量不能被视觉过渡掩盖。"
caption: "当前高亮表示内存槽位、表项或执行结构的相对布局；步骤文字直接取自本课核心机制。动画不表示 CPython 的真实耗时、内存比例或跨版本私有布局，最终以官方入口、源码节选与可运行断言为证据。"
actionLabel: "展开结构变化"

#### 步骤

- PyObject_HEAD 展开后提… | PyObject_HEAD 展开后提供 ob_refcnt 与 ob_type；调试构建可能在头部加入额外追踪字段。
- Py_TYPE(obj) 读取 ob… | Py_TYPE(obj) 读取 ob_type，Py_SET_TYPE 只应用于受控初始化或底层实现，业务扩展不应随意改写类型指针。
- 具体对象结构体把 PyObject … | 具体对象结构体把 PyObject 或 PyVarObject 放在首字段，因此 PyObject* 能指向所有内建对象。
- 操作从公开 C API 进入后 | 操作从公开 C API 进入后，通常先取 Py_TYPE，再调用 nb_add、tp_getattro、tp_iter 等类型槽。

#### 观察重点

- 推进前先预测下一步会改变对象布局、引用关系与生命周期中的哪一项，并指出至少一个必须保持不变的条件。
- 视觉省略了平台、实现和版本分支；涉及 CPython 私有细节时，回到本课官方入口、源码路径与运行示例复核。
