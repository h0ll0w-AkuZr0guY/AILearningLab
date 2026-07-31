---
id: "python-09-11"
track: "python"
title: "缓存命中、失效、stampede 与内存预算"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-09-11.md"
---

## 官方入口

title: "functools.lru_cache"
url: "https://docs.python.org/3/library/functools.html#functools.lru_cache"

lru_cache 以可哈希参数为 key，线程安全维护结构并持有参数/结果强引用；并发首次 miss 仍可能重复计算。

## 导读

缓存把计算换成查找与内存，正确性取决于 key 是否覆盖所有影响结果的输入、结果允许陈旧多久、依赖变化如何失效。TTL 只是时间近似，版本/事件失效表达更精确因果。

并发 miss 可能产生 stampede：多个请求同时计算同一 key。single-flight 让一个 owner 计算，其余等待同一 Future；失败、超时和取消必须决定是否共享、是否负缓存以及何时允许重试。

maxsize 只限制 entry 数，不限制结果深层字节；缓存还持有 key/arguments 强引用。必须度量 hit/miss/eviction、compute saved、entry bytes 和 stale rate。

## 核心机制

- LRU 优化最近性假设，扫描/大流量可污染热集。
- typed=False 仍可能把某些不同类型分成键，关键字顺序也可能形成不同 entry。
- 负缓存可保护持续不存在资源，但 TTL 应较短。
- 分布式缓存还需序列化、网络、租户隔离和一致性策略。

## 常见误区

- 缓存依赖全局配置/权限的函数却未把版本放 key。
- 无界 @cache 保存用户高基数输入和大对象。
- single-flight owner 被取消后，所有 waiter 永远等待未完成 Future。

## 可运行示例

```python
import asyncio

class SingleFlight:
    def __init__(self):
        self._inflight = {}
        self._lock = asyncio.Lock()

    async def get(self, key, factory):
        async with self._lock:
            task = self._inflight.get(key)
            if task is None:
                task = asyncio.create_task(factory())
                self._inflight[key] = task
        try:
            return await asyncio.shield(task)
        finally:
            if task.done():
                async with self._lock:
                    if self._inflight.get(key) is task:
                        del self._inflight[key]
```

## 搭积木复现

### 定义 key 与 freshness

列出参数、配置/模型/权限版本、租户和 locale，明确 TTL/事件失效。

### 实现 single-flight

每 key 共享 Task；owner 失败/取消/timeout 后唤醒全部 waiter 并允许重试。

### 建立预算

entry count + estimated deep bytes + hit saved latency；扫描污染时选择 admission policy。

## 自检

### 问题

为什么 lru_cache 声明线程安全，仍可能对同一参数并发执行函数多次？

### 站内答案

线程安全保证内部字典/链表结构一致，不保证 miss 计算期间全局持锁。两个线程可同时看见 miss、各自计算，再写入相同 key。昂贵或有副作用的工作需要额外 per-key single-flight/幂等约束。
