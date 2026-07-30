---
id: "python-09-07"
track: "python"
title: "tracemalloc 快照、对象存活与 RSS 分离"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "tracemalloc"
url: "https://docs.python.org/3/library/tracemalloc.html"

tracemalloc 跟踪经 Python allocator 分配的内存块及其分配 traceback，可比较快照；它不等于对象引用图或进程 RSS。

## 导读

快照差分回答“哪些 Python allocation trace 的存活字节增加”。它不直接回答谁持有对象，也可能看不到未接入 domain 的 C 库/GPU/mmap 内存。对象释放后 allocator 还可保留 arena 供复用，因此 tracemalloc 降低而 RSS 不降并不矛盾。

泄漏诊断要组合三层：tracemalloc 定位分配栈，对象图/weakref/gc 定位所有者，RSS/USS 与 native profiler 定位进程和 C 层。启动越早、traceback depth 越深，证据越完整但开销越高。

## 核心机制

- Snapshot.compare_to 按 lineno/traceback 统计 size_diff/count_diff。
- 过滤 importlib/tracemalloc 噪声后再排名。
- get_traced_memory 区分 current/peak，reset_peak 只重置峰值。
- domain 允许 C 扩展标记其他 allocator 范围。

## 常见误区

- 只看峰值就称泄漏，批处理暂态峰值可能完全释放。
- RSS 不下降就认为 Python 对象仍活着。
- 快照在不同业务负载点采集，差分只是流量差异。

## 可运行示例

```python
import gc
import tracemalloc

tracemalloc.start(10)
before = tracemalloc.take_snapshot()

cache = {index: bytearray(1024) for index in range(1_000)}
after_growth = tracemalloc.take_snapshot()
growth = after_growth.compare_to(before, "lineno")
assert sum(stat.size_diff for stat in growth) > 900_000

cache.clear()
gc.collect()
after_clear = tracemalloc.take_snapshot()
remaining = after_clear.compare_to(after_growth, "lineno")
assert sum(stat.size_diff for stat in remaining) < 0
```

## 搭积木复现

### 固定生命周期点

warmup 后 baseline，重复操作多轮，cleanup+gc 后 end，避免比较不同业务阶段。

### 从 trace 到 owner

对增长类型用 weakref/gc.get_referrers 或领域 registry 找强引用。

### 交叉验证 RSS

同时记录 traced current、object count、RSS/USS、native/GPU 指标。

## 自检

### 问题

tracemalloc 显示内存已释放，但 RSS 为什么可能保持不变？

### 站内答案

对象块已回到 Python/系统 allocator，可被进程后续分配复用；allocator 的 pool/arena 或碎片未必立刻归还 OS。tracemalloc 看活跃被跟踪块，RSS 看进程驻留页，二者处在不同抽象层。
