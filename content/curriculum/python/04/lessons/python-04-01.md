---
id: "python-04-01"
track: "python"
title: "Iterable、Iterator 与 __getitem__ 兼容路径"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "Built-in types · Iterator Types"
url: "https://docs.python.org/3/library/stdtypes.html#iterator-types"

容器提供 __iter__ 产生 iterator；iterator 的 __iter__ 返回自身，__next__ 返回下一项或抛出 StopIteration。

## 真实源码

repo: "python/cpython"
file: "Objects/abstract.c"
symbol: "PyObject_GetIter"
language: "c"
url: "https://github.com/python/cpython/blob/main/Objects/abstract.c#L2813"

### 逐段讲解

- 先读类型对象的 tp_iter 槽；有槽时调用它，并检查结果本身确实实现 iterator 协议。
- 没有 tp_iter 时，旧式序列仍可经 PySequence_Check 与 PySeqIter_New 走整数索引回退。
- 回退是兼容路径，不应成为新容器 API 的首选设计；显式 __iter__ 才能表达稳定迭代语义。

### 源码节选

```c
PyObject *
PyObject_GetIter(PyObject *o)
{
    PyTypeObject *t = Py_TYPE(o);
    getiterfunc f = t->tp_iter;             // 先找类型的 __iter__ 槽

    if (f == NULL) {
        if (PySequence_Check(o))
            return PySeqIter_New(o);        // 兼容旧序列：依次请求 o[0]、o[1]...
        return type_error("'%.200s' object is not iterable", o);
    }

    PyObject *res = (*f)(o);
    if (res != NULL && !PyIter_Check(res)) {
        PyErr_Format(PyExc_TypeError,
                     "%T.__iter__() must return an iterator, not %T", o, res);
        Py_SETREF(res, NULL);
    }
    return res;
}
```

## 导读

Iterable 表示“能创建遍历会话”，Iterator 表示“某一次遍历会话的游标”。列表可以反复 iter(list) 得到彼此独立的游标；generator 通常同时是 iterable 与 iterator，iter(gen) 仍返回它自己，因此只能消费一次。

for 并不要求对象是容器。它先调用 iter(obj)，随后重复 next(iterator)，捕获 StopIteration 后结束。把取数状态放进 iterator，让容器本体保持可重复遍历，是最常见的职责划分。

CPython 仍兼容只实现 __getitem__(0)、__getitem__(1)… 的旧式序列。索引抛出 IndexError 时迭代结束。这条路径解释了一些“没有 __iter__ 却能 for”的对象，也提醒框架作者不要把兼容现象误当成首选协议。

## 核心机制

- iter(x) 优先调用 type(x).__iter__(x)，不会先从实例字典取同名方法。
- iterator.__iter__ 必须返回自身，才能让接收 iterable 的 API 同样接收已经部分消费的 iterator。
- 可重复 iterable 每次创建新游标；一次性 iterator 把数据源与游标合在同一对象中。
- 双参数 iter(callable, sentinel) 会反复调用 callable，并在结果等于 sentinel 时停止。

## 常见误区

- 在容器的 __iter__ 中 return self，却把游标也存到容器上，导致嵌套循环互相推进。
- 用 list(iterator) 调试后再次消费，忘记 iterator 已耗尽。
- 仅依赖 __getitem__ 回退，负索引、稀疏索引和非整数键会让迭代契约含糊。

## 可运行示例

```python
class RangeView:
    def __init__(self, start, stop):
        self.start, self.stop = start, stop

    def __iter__(self):
        # 每次迭代创建独立会话，因此可以嵌套或重复遍历。
        return RangeCursor(self.start, self.stop)

class RangeCursor:
    def __init__(self, current, stop):
        self.current, self.stop = current, stop

    def __iter__(self):
        return self

    def __next__(self):
        if self.current >= self.stop:
            raise StopIteration
        value = self.current
        self.current += 1
        return value

view = RangeView(0, 3)
assert list(view) == [0, 1, 2]
assert list(view) == [0, 1, 2]
assert list(zip(view, view)) == [(0, 0), (1, 1), (2, 2)]
```

## 搭积木复现

### 先展开 for

手写 iterator = iter(source) 与 while/next/except StopIteration，观察协议最小边界。

### 分离数据与游标

分别实现 RangeView 与 RangeCursor，写重复遍历、嵌套遍历和部分消费测试。

### 验证兼容路径

写一个只有 __getitem__ 的 LegacySequence，记录收到的索引，再补 __iter__ 比较调用链。

## 自检

### 问题

为什么 iterator.__iter__ 返回 self，而容器.__iter__ 通常返回新对象？

### 站内答案

iterator 已经代表一条具体遍历会话，返回 self 让 for、list、zip 等消费方可以统一接收 iterable 和 iterator；容器代表可重复的数据集合，返回新 iterator 才能让多个遍历拥有独立游标。若容器也返回自己，嵌套循环和并发消费者会共享进度。
