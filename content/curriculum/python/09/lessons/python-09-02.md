---
id: "python-09-02"
track: "python"
title: "list、deque 与紧凑/分块存储取舍"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "collections.deque"
url: "https://docs.python.org/3/library/collections.html#collections.deque"

deque 为两端 append/pop 提供近似 O(1)，中间随机访问会向较近一端遍历；list 是连续指针数组。

## 真实源码

repo: "python/cpython"
file: "Objects/listobject.c"
symbol: "list_resize"
language: "c"
url: "https://github.com/python/cpython/blob/main/Objects/listobject.c#L93"

### 逐段讲解

- allocated 已足够且新长度不小于一半时只修改逻辑长度，避免每次缩短都 realloc。
- 增长按约 1/8 加常数做 over-allocation，使连续 append 获得摊销 O(1)。
- list 存的是 PyObject* 连续数组，不内联元素对象；连续的是引用，因此遍历仍需间接寻址。

### 源码节选

```c
static int
list_resize(PyListObject *self, Py_ssize_t newsize)
{
    size_t allocated = self->allocated;
    if (allocated >= newsize && newsize >= (allocated >> 1)) {
        Py_SET_SIZE(self, newsize);          // 容量足够，只改逻辑长度
        return 0;
    }

    // 温和过量分配：0, 4, 8, 16, 24, 32, 40, 52...
    size_t new_allocated = ((size_t)newsize + (newsize >> 3) + 6) & ~(size_t)3;
    if (newsize - Py_SIZE(self) > new_allocated - newsize)
        new_allocated = ((size_t)newsize + 3) & ~(size_t)3;

    // 重新分配连续 PyObject* 数组；具体对象仍在别处。
    PyObject **items = PyMem_Realloc(self->ob_item,
                                     new_allocated * sizeof(PyObject *));
    self->ob_item = items;
    self->allocated = new_allocated;
    Py_SET_SIZE(self, newsize);
    return 0;
}
```

## 导读

list 的连续引用数组带来 O(1) 随机索引、优秀线性遍历局部性和尾部 append 摊销 O(1)，但头部插删需 memmove 全部引用。deque 用固定大小 block 双向链连接，减少逐元素节点开销并支持两端常数操作。

deque 的中间索引仍需跨 block 行走；list 即使头部 pop(0) 复杂度更差，小规模时也可能因连续布局更快。选择应看操作比例、最大长度与延迟分布。

## 核心机制

- list capacity 与 len 分离，sys.getsizeof 可观察阶梯增长。
- 切片创建新 list 并增加元素引用，不复制元素本体。
- deque maxlen 在满时自动从另一端淘汰。
- queue.Queue/asyncio.Queue 是同步协议，不等于裸 deque。

## 常见误区

- 用 list.pop(0) 实现长期生产队列。
- 只凭 O(1) 认为 deque 任意索引都快。
- 把容器浅大小当作包含所有元素的总内存。

## 可运行示例

```python
from collections import deque
import sys

items = []
capacities = []
for value in range(40):
    before = sys.getsizeof(items)
    items.append(value)
    after = sys.getsizeof(items)
    if after != before:
        capacities.append((len(items), after))

assert len(capacities) < len(items)  # append 并非每次 realloc

fifo = deque(items)
assert fifo.popleft() == 0
assert fifo.pop() == 39
```

## 搭积木复现

### 复现 dynamic array

实现 size/capacity/growth，统计 append 的 realloc 次数和复制引用数。

### 实现 block deque

固定数组 block + left/right index，覆盖跨块 append/pop。

### 按操作混合基准

随机访问、两端操作、遍历与内存分别测，不做单一“谁更快”结论。

## 自检

### 问题

list.append 平均 O(1)，为什么某一次 append 仍可能明显变慢？

### 站内答案

容量耗尽时需要申请更大连续指针数组并复制现有引用，这一次是 O(n)；过量分配让随后多次 append 无需扩容，把总复制成本分摊后得到摊销 O(1)。尾延迟敏感系统仍应关注扩容尖峰。
