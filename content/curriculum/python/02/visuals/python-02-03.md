---
lesson: "python-02-03"
track: "python"
decision: "读者容易把 self 误解为调用时语法注入，难以看见函数、接收者和 method object 的关系；流程视觉将三种读取方式的接收者并列。"
---

## 视觉实验

### 在读取期生成绑定接收者

id: "python-02-03-method-binding"
kind: "flow"
placement: "chapter:2"
summary: "从类字典中的函数出发，对比经类、经实例、经 classmethod 与经 staticmethod 读取后形成的对象和调用参数。"
caption: "用户函数的 CPython 证据见 Objects/funcobject.c L1192-L1198；`__set_name__` 是创建期通知，与这张读取期图分离。"
actionLabel: "推进绑定步骤"

#### 步骤

- 类字典原函数 | `C.__dict__["f"]` 保存 function descriptor，本身尚未选定接收者。
- 经类读取 | `C.f` 的 obj 为空，getter 返回原函数；调用者仍须显式提供第一个参数。
- 经实例读取 | `c.f` 创建 method，保存 `__func__=C.f` 与 `__self__=c`，调用时把 c 放到参数首位。
- 装饰器分支 | classmethod 把动态 class 作为接收者，staticmethod 直接返回包裹可调用对象。

#### 观察重点

- 预测 `C.f()` 为什么缺少 self，而 `c.f()` 为什么可运行。
- 观察绑定在读取期发生；不要把这张图用于推导 `__set_name__` 的类创建期调用。
