---
id: "python-09-08"
track: "python"
title: "dis、inline cache 与 specializing interpreter"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "dis · adaptive bytecode and inline caches"
url: "https://docs.python.org/3/library/dis.html"

3.11+ 解释器可把通用 bytecode quicken 为 guarded specialized instructions；dis(adaptive=True, show_caches=True) 显示运行态指令和缓存。

## 导读

编译器产生通用 bytecode；运行后 adaptive opcode 统计命中，观察稳定类型/对象 shape 后改写为更窄操作并把版本、偏移等 guard 数据存在相邻 inline cache。guard 失败会退化或重新 specialization。

specialization 优化动态查找的常见稳定情况，不改变 Python 语义。多态热点让 cache 反复失败/退化，解释了相同源码在稳定与高度混合输入下的性能差异。bytecode 是版本内部细节，不应成为库兼容合同。

## 核心机制

- CACHE 逻辑上属于前一条指令，普通 dis 默认隐藏。
- warmup 后 adaptive=True 才能观察实际 specialized opcode。
- type/version tags 等 guard 证明缓存仍有效。
- monomorphic/polymorphic/megamorphic 描述调用点 shape 稳定程度。

## 常见误区

- 只 dis 冷函数，得出 specialization 没发生。
- 修改 raw co_code 或硬编码 offset 跨 Python 版本。
- 为了 specialization 重写清晰代码，却未测端到端收益。

## 可运行示例

```python
import dis

class Point:
    def __init__(self, x):
        self.x = x

def total(points):
    result = 0
    for point in points:
        result += point.x
    return result

points = [Point(i) for i in range(20)]
for _ in range(20_000):
    total(points)                           # 热身稳定 shape

dis.dis(total, adaptive=True, show_caches=True)
# 观察 LOAD_ATTR/CALL/BINARY_OP 是否 specialized；
# opcode 名随 CPython 版本变化，不写死断言。
```

## 搭积木复现

### 实现 adaptive slot

通用 opcode + counter，达到阈值后安装 guard/cache/specialized handler。

### 实现 deopt

类型/version guard 失败回通用路径，累计失败后降级。

### 比较 shape 稳定性

同型对象与混合 descriptor/proxy 输入比较 cache stats 和性能。

## 自检

### 问题

inline cache 为什么必须带 guard，而不能直接永远复用第一次查到的属性偏移？

### 站内答案

类字典、descriptor、实例 shape 和继承关系可动态改变；旧偏移可能返回错误值。cache 只在 type/version 等条件仍成立时有效，guard 失败必须走通用语义并更新或退化，性能不能牺牲动态语言正确性。
