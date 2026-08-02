---
lesson: "python-01-05"
track: "python"
decision: "读完扩容公式后，学习者仍很难把逻辑长度、allocated 容量、ob_item 地址变化和 tuple 的固定长度分开追踪。张量格子能让一次 append 或 shrink 的物理后果成为可预测、可回到源码的读数。"
---

## 视觉实验

### 观察 list 的长度与容量如何分叉

id: "python-01-05-list-capacity"
kind: "tensor"
placement: "chapter:2"
summary: "用槽位格展示 PyListObject 的 ob_size 与 allocated：append 在空闲槽存在时只改逻辑长度，容量不足时 list_resize 分配更大的指针数组；tuple 则在构造时按固定元素数申请空间。"
caption: "每一格代表一个 PyObject* 槽，格内并不保存 Python 值本身。增长序列和半容量缩容条件来自 CPython v3.14.6 Objects/listobject.c L108-L141；实际 bytes 以当前构建的 sys.getsizeof 为准。"
actionLabel: "推进容量变化"

#### 步骤

- 空列表 | ob_size=0、allocated=0，PyListObject 没有元素指针数组，下一次 append 必须进入 resize 路径。
- 首次扩容 | append 第一个元素后，list_resize 计算四个槽的对齐容量；ob_size=1，余下三个槽只是预留空间。
- 原地追加 | append 到第四个元素时仍有同一块 ob_item 数组，ob_size 增长但分配地址不需要改变。
- 容量耗尽 | 第五个元素触发新的 over-allocation，元素指针被复制到更大的数组；append 的单次成本升高但摊还成本保持常数级。
- 缩容边界 | pop 后只要 newsize 不低于 allocated 的一半，源码绕过 realloc；低于边界才收缩，避免 append/pop 抖动。
- 固定 tuple | tuple 在创建时按 ob_size 分配元素指针空间，之后没有 append 路径；它省去容量余量，却把任何结构变化变成创建新对象。

#### 观察重点

- 在第五步前预测：为什么逻辑长度变化不必然意味着 ob_item 地址变化。
- 运行 list_growth 与 sys.getsizeof 实验，比较增长点是否符合源码的四槽对齐序列，而不是硬背某个平台的字节数。
