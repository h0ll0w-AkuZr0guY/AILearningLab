---
id: "python-09-06"
track: "python"
title: "采样 profiler、火焰图与生产诊断"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-09-06.md"
---

## 官方入口

title: "profiling · Python profilers"
url: "https://docs.python.org/3/library/profiling.html"

采样 profiler 周期性观察正在执行的栈，开销与调用次数弱相关；火焰图用宽度表达样本占比而非时间顺序。

## 导读

采样 profiler 每隔一段时间获取栈，函数占 CPU 的比例越高越可能被采到。它适合长时间、生产和混合 Python/native 栈；很短或罕见函数可能完全漏采，采样频率也会与周期性 workload 产生 aliasing。

火焰图横向宽度是聚合样本数，纵向是调用深度，相邻块不表示时间先后。CPU flame graph 看 on-CPU 热点，wall/off-CPU profiler 才能显示睡眠、锁、I/O 等等待。

## 核心机制

- 统计误差约随样本数增加而降低，低占比热点需更长采集。
- native frame、GIL state 和线程选择取决于工具能力与权限。
- 火焰图 top-down 看入口，bottom-up/callee 看共同叶热点。
- 连续 profiling 应限采样率并保护符号/源码敏感信息。

## 常见误区

- 把火焰宽度理解为单次函数耗时。
- CPU sampling 看不到数据库等待，就断言数据库无关。
- 只采主线程，遗漏 executor、worker 或 C 扩展线程。

## 可运行示例

```python
# 生产诊断记录模板（配合 py-spy/perf 等外部采样器）：
profile_contract = {
    "target": "pid / container / worker set",
    "clock": "cpu or wall",
    "duration_s": 60,
    "rate_hz": 99,          # 避免与常见 100 Hz 周期完全同频
    "threads": "all",
    "native_frames": True,
    "workload_window": "request rate and p99 attached",
}

# 结果解释必须同时附相同时间窗的 CPU、吞吐、延迟、I/O wait；
# 火焰图单独无法证明因果。
```

## 搭积木复现

### 定义采样合同

目标进程/线程、CPU 或 wall、频率、时长、native frames、负载窗口。

### 先聚合再下钻

找最宽调用塔，再按线程、请求类型或阶段拆分。

### 用另一证据验证

对候选热点加指标、trace 或 deterministic micro profile，确认因果。

## 自检

### 问题

为什么火焰图中两个横向相邻的函数不代表它们按这个顺序执行？

### 站内答案

火焰图把相同栈前缀的样本聚合并按工具规则排列，横向位置用于容纳宽度，不是时间轴。宽度近似该栈占采样比例；要分析时序需 timeline trace 或事件记录。
