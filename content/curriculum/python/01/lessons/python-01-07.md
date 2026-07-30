---
id: "python-01-07"
track: "python"
title: "分代 GC 与循环检测"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "gc · Garbage Collector interface"
url: "https://docs.python.org/3/library/gc.html"

循环 GC 是引用计数的补充，只追踪可能参与引用环的容器对象，并通过代际策略减少扫描成本。

## 导读

引用环让每个对象都至少被环内另一个对象引用，即使程序已无法从根访问它们，引用计数也不会归零。循环 GC 周期性检查“可能成环”的追踪对象，识别只剩内部引用的孤岛。

核心思想类似做账：先把对象当前引用计数复制为 gc_refs，再减去候选集合内部的引用。仍有外部引用的节点是可达根，从这些根传播即可保留整个可达子图；剩余节点属于不可达环。

代际假设认为大多数对象寿命短。新对象更频繁被检查，存活对象逐步进入扫描频率更低的老年代。具体代数和阈值会随 CPython 版本演进，课程关注可达性算法与成本模型。

## 核心机制

- 只有实现 traverse/clear 协议的容器类型才参与循环检测，纯数字等原子对象无需追踪。
- tp_traverse 枚举对象指向的 PyObject 边，GC 用它构造候选子图的内部引用关系。
- 不可达对象若带 finalizer，现代 CPython 按 PEP 442 处理安全终结，再尝试打破引用环。
- 频繁手动 gc.collect 可能把全局扫描成本放进请求热路径，诊断应先看分配率和代际统计。

## 常见误区

- 把 GC 暂停等同于所有 Python 对象回收。多数无环对象仍由引用计数立即释放。
- 看到内存不回落就认定对象未释放，忽略 pymalloc、系统 allocator 和 RSS 回收策略。
- 用对象数量替代可达性分析，遗漏 callback、全局缓存和 traceback 对对象图的真实持有。

## 可运行示例

```python
import gc
import weakref

class Node:
    def __init__(self):
        self.peer = None

left, right = Node(), Node()
left.peer, right.peer = right, left
probe = weakref.ref(left)

del left, right
assert probe() is not None       # 环仍让引用计数大于零
gc.collect()
assert probe() is None
```

## 搭积木复现

### 构造最小引用环

用两个节点互相引用，并用 weakref 观察对象是否存活，避免观察变量本身增加强引用。

### 手写候选扣减算法

为小型有向图保存 external_count，减去集合内部边后，从正计数节点传播可达性。

### 对照 gc 统计

使用 gc.get_stats、gc.get_referrers 和 tracemalloc 区分不可达环、仍可达缓存与 allocator 保留。

## 自检

### 问题

循环 GC 为什么不能简单地回收“引用计数长期不变”的对象？

### 站内答案

长期不变不代表不可达，模块单例、缓存和仍在使用的对象都可能稳定存在。GC 必须判断候选子图是否仍有集合外引用，并从这些外部根传播可达性；只有没有外部进入边的孤岛才可回收。
