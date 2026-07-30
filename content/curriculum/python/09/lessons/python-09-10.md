---
id: "python-09-10"
track: "python"
title: "multiprocessing 序列化、启动方式与共享内存"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "multiprocessing · Contexts and start methods"
url: "https://docs.python.org/3/library/multiprocessing.html#contexts-and-start-methods"

spawn、fork、forkserver 拥有不同状态继承与安全边界；Queue/Pipe/Pool 通常 pickle 参数，shared_memory 可避免大 buffer 复制。

## 导读

process 绕过单解释器 GIL，但带来启动、序列化、IPC 和结果合并成本。spawn 启动干净解释器并重新导入 main，跨平台清晰但较慢；fork 复制当前地址空间并利用 copy-on-write，却会继承锁/线程/连接的不安全中间态。

Pool 参数与结果通常 pickle，发送大对象可能比计算更贵。shared_memory 共享字节存储但不共享 Python 对象语义，需要 shape/dtype/所有权/同步协议，并由 creator/unlink owner 防止资源泄漏。

## 核心机制

- __main__ guard 防 spawn 子进程重复创建进程。
- copy-on-write 只在页未写时节省内存，引用计数/allocator 写入会破坏共享。
- chunksize 平衡调度公平与每任务 IPC 开销。
- worker 异常需序列化回父进程，原始本地资源不可自动跨进程清理。

## 常见误区

- 把 lambda、局部函数、打开连接当 spawn 任务参数。
- fork 一个已有多线程的服务进程并继续使用继承锁。
- 共享内存只有 creator close，没有 unlink 或消费者仍在访问时过早 unlink。

## 可运行示例

```python
from concurrent.futures import ProcessPoolExecutor

def cpu_sum(chunk):
    return sum(value * value for value in chunk)

def parallel_sum(values, workers=4):
    size = max(1, len(values) // workers)
    chunks = [values[i:i + size] for i in range(0, len(values), size)]
    with ProcessPoolExecutor(max_workers=workers) as pool:
        return sum(pool.map(cpu_sum, chunks))

if __name__ == "__main__":
    data = list(range(100_000))
    assert parallel_sum(data) == cpu_sum(data)
    # 必须与串行版本比较；小输入通常被启动与 pickle 成本反超。
```

## 搭积木复现

### 建立成本模型

Tstart + serialize bytes/bandwidth + compute + merge，找并行盈亏点。

### 测试三启动方式

记录模块状态、线程锁、随机种子、连接和启动时间差异。

### 实现 shared buffer owner

creator/name/shape/dtype/ref protocol/close/unlink/崩溃恢复全部显式化。

## 自检

### 问题

为什么把 CPU 函数放进 ProcessPool 后可能比串行更慢？

### 站内答案

进程启动、任务排队、pickle 参数/结果、内核 IPC 和合并都是额外固定/线性成本；任务太小或数据太大时并行计算节省不足以覆盖它们。要增大 chunk、减少传输或共享底层 buffer，并实测盈亏点。
