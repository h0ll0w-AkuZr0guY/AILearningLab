---
id: "python-09-05"
track: "python"
title: "cProfile、pstats 与确定性调用图"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "The Python Profilers"
url: "https://docs.python.org/3/library/profile.html"

cProfile 对函数 call/return 事件做确定性统计；pstats 以调用次数、自身时间、累计时间、caller/callee 关系分析。

## 导读

确定性 profiler 记录每次函数进入退出，能完整给出调用图，但 instrumentation 会改变短函数与高频调用成本。tottime 是函数体排除子调用的时间，cumtime 包含子调用；递归时 primitive calls 与 total calls 不同。

异步程序的墙钟等待会归到调用链或 event loop，不能直接等同 CPU 热点。先用整体 profile 定位 subsystem，再用 line profiler、sampling、I/O metrics 或 trace span验证。

## 核心机制

- 按 cumulative 排序找昂贵调用树，按 tottime 找自身 CPU 热点。
- print_callers/print_callees 判断热点来自谁、扩散到哪。
- dump_stats 保存原始 profile，可脱离生产进程分析。
- 内建/C 函数粒度与 Python 函数不同，时间边界需理解。

## 常见误区

- 只看调用次数最多函数，忽略单次极慢路径。
- 把 sleep/I/O 等待归因成函数 CPU 消耗。
- 在微秒级函数上长期开启 tracing profiler并相信绝对数。

## 可运行示例

```python
import cProfile
import pstats

def normalize(rows):
    return [row.strip().lower() for row in rows if row.strip()]

profiler = cProfile.Profile()
profiler.enable()
for _ in range(200):
    normalize([" A ", "", " B "] * 100)
profiler.disable()

stats = pstats.Stats(profiler).strip_dirs()
stats.sort_stats(pstats.SortKey.CUMULATIVE).print_stats(10)
stats.print_callers("normalize")
```

## 搭积木复现

### 画调用树假设

采集前先写预期入口/热点/等待，再用 profile 证伪。

### 双排序分析

cumtime 找树，tottime 找叶，caller/callee 验证传播路径。

### 缩小与复测

抽出热点最小 workload，优化后用相同 profile 与端到端指标复验。

## 自检

### 问题

cProfile 中 tottime 与 cumtime 应如何一起阅读？

### 站内答案

tottime 是函数自身执行，不含子调用；cumtime 包含它调用的所有后代。cumtime 高、tottime 低说明它是昂贵子树入口；两者都高说明函数体本身是热点。只看其中一个容易优化错误层级。
