---
id: "python-09-04"
track: "python"
title: "可重复基准：timeit、pyperf、噪声与效应量"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-09-04.md"
---

## 官方入口

title: "timeit · Measure execution time"
url: "https://docs.python.org/3/library/timeit.html"

timeit 重复执行小段代码并默认禁用 GC，以减少常见计时陷阱；复杂可靠基准仍需进程级校准和统计。

## 导读

基准是实验。应固定语义、输入、解释器版本、依赖、硬件/电源策略，隔离 setup 与 measured region，并用多进程多值分布报告中位数、方差和置信区间。

CPython specialization、缓存、分配器和操作系统 page cache 都需要热身。只取 min 可近似无干扰下界，却掩盖真实尾延迟；优化结论还需给绝对差、相对差和业务效应量。

## 核心机制

- perf_counter_ns 适合墙钟短区间，但函数调用本身有测量开销。
- timeit 默认关闭 GC，若 workload 的 GC 成本真实存在应显式开启。
- pyperf 可校准循环、进程热身、保存 JSON 并比较结果。
- 输入构造、随机生成与结果校验应在计时外，除非它们属于目标路径。

## 常见误区

- 只跑一次，或从同一进程连续测 A 再 B 产生顺序偏差。
- 优化器/缓存让被测结果未消费，测到不真实路径。
- 5% 微基准提升换来 p99、内存或可维护性恶化。

## 可运行示例

```python
import gc
import statistics
import time

def benchmark(fn, data, repeat=15):
    samples = []
    for _ in range(repeat):
        gc.collect()
        started = time.perf_counter_ns()
        result = fn(data)
        elapsed = time.perf_counter_ns() - started
        assert result is not None              # 保持真实消费/语义检查
        samples.append(elapsed)
    return {
        "median_ns": statistics.median(samples),
        "p90_ns": sorted(samples)[int(repeat * .9) - 1],
        "samples": samples,
    }
```

## 搭积木复现

### 先写等价测试

属性/边界/随机输入证明候选实现相同，再允许比较性能。

### 隔离实验变量

随机交错 A/B，固定环境并记录 warmup、GC、输入分布。

### 设决策门槛

预先定义至少提升多少、置信区间、内存和尾延迟预算。

## 自检

### 问题

为什么 timeit 的最小值有时有意义，却不能代表生产延迟？

### 站内答案

外部调度和噪声通常只会增加时间，最小值可估计最少干扰的执行成本；生产关心 GC、竞争、缓存冷态与排队造成的分布，尤其 p95/p99。应按问题选择下界或真实分布，而非把 min 当普遍答案。
