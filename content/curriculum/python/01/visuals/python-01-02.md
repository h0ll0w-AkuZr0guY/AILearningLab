---
lesson: "python-01-02"
track: "python"
decision: "读完第二章后仍看不见：do_richcompare 三次尝试（右→左→swap）的调用顺序以及每次返回 Py_NotImplemented 时堆栈如何跳转。这是同一表达式在三个 slot 之间跳转的流程，用 flow 逐步展示最直观。"
---

## 视觉实验

### 让 3 == 3.0 走一遍 do_richcompare 三次尝试

id: "python-01-02-richcmp"
kind: "flow"
placement: "chapter:2"
summary: "表达式 3 == 3.0 依次尝试：右操作数 3.0 的 float.__eq__(3) → 返回 True 直接结束；若改为 3 == MyInt(3) 且 MyInt 未定义 __eq__，则左操作数 int.__eq__ 返回 NotImplemented → 跳转右操作数的 tp_richcompare 第三次尝试。"
caption: "数字模拟 Objects/object.c do_richcompare v3.14.6（L1046-1090）的三次尝试；精确语义以本课可运行示例的断言为准。"
actionLabel: "推进到下一个尝试"

#### 步骤

- 初始 | 表达式 `v = 3` 与 `w = 3.0`，op=Py_EQ，进入 do_richcompare。
- 尝试1 | 检查 w->ob_type->tp_richcompare（float.__eq__）：float 认识 int，返回 Py_True。
- 尝试2 | 不执行（尝试1 已返回非 NotImplemented），直接结束。
- 尝试3 | 当前两个 slot 都不再执行，因为尝试1已经返回非 NotImplemented 的真值结果。
- 结果 | PyObject_RichCompare 返回 Py_True → `3 == 3.0` 为 True。

#### 观察重点

- 推进到「尝试1」前先预测：如果 3.0 不认识 int，float.__eq__ 会返回什么。
- 用课程示例验证反向场景：`MyObj() == 3` 在三次尝试后的回退行为。
