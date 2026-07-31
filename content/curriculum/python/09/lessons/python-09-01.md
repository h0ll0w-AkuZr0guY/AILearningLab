---
id: "python-09-01"
track: "python"
title: "复杂度模型、常数项与真实工作负载"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "Python Wiki · TimeComplexity"
url: "https://wiki.python.org/moin/TimeComplexity"

容器操作复杂度是实现与平均/摊销条件下的模型；必须结合真实规模、分布和常数成本验证。

## 导读

Big-O 抹去常数和低阶项，用于回答规模趋大时增长速度；它不回答 N=50 时哪个实现更快，也不包含网络、分配、解释器 dispatch、缓存 miss 与序列化成本。

性能模型应先定义工作负载：输入规模与分布、读写比例、命中率、并发度、尾延迟和内存上限。相同平均 O(1) 的 dict 查询，在昂贵 __hash__/__eq__ 或攻击性冲突下表现完全不同。

## 核心机制

- 摊销分析把偶发 resize 成本分摊到一系列 append/insert。
- 平均复杂度依赖哈希分布等假设，最坏情况仍需安全边界。
- 算法降低次数，数据布局降低每次操作成本，二者可叠加。
- 吞吐、平均延迟、p99、CPU、allocation rate 是不同目标。

## 常见误区

- 用微型 N 证明 O(n²) 优于 O(n log n) 并外推到生产。
- 优化占总时长 1% 的局部函数，违反 Amdahl 上限。
- 基准输入过于规则，使 branch/cache/hash 行为失真。

## 可运行示例

```python
from collections import Counter

def quadratic_duplicates(items):
    return [item for i, item in enumerate(items) if item in items[:i]]

def counted_duplicates(items):
    counts = Counter(items)
    return [item for item in dict.fromkeys(items) if counts[item] > 1]

data = list(range(2_000)) + [7, 9]
assert set(quadratic_duplicates(data)) == {7, 9}
assert set(counted_duplicates(data)) == {7, 9}

# 先验证语义，再用多组 N 和真实重复率画 log-log 曲线；
# 单个 N 的“更快”不能证明增长阶。
```

## 搭积木复现

### 定义成本方程

把总时长拆成调用次数 × 单次成本 + I/O/排队，标出随 N 变化项。

### 构造规模序列

至少跨一个数量级，改变数据分布并验证输出完全等价。

### 决定优化层次

先去掉数量级瓶颈，再优化热点常数，最后审计内存与尾延迟。

## 自检

### 问题

两个方案同为 O(n)，为什么生产性能仍可能相差几十倍？

### 站内答案

O(n) 只说明增长阶。每项可能包含 Python 回调、哈希、对象分配、缓存 miss、系统调用或向量化 C 循环；数据布局与分支命中也改变常数。必须以真实工作负载测量热点与硬件计数，而非由阶数推断绝对速度。
