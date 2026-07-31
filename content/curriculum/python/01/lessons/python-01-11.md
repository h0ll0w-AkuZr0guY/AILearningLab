---
id: "python-01-11"
track: "python"
title: "对象生命周期实验"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-01-11.md"
---

## 官方入口

title: "Data model · Object finalization"
url: "https://docs.python.org/3/reference/datamodel.html#object.__del__"

对象生命周期由创建、强引用所有权、可达性、终结与内存释放共同构成；__del__ 时机和解释器关闭环境存在限制。

## 导读

生命周期实验的目标不是背“引用计数归零就销毁”，而是把创建、别名、容器持有、引用环、弱引用通知、finalizer 和 allocator 行为放到同一时间线。每一步都应有可观察证据。

__del__ 表示对象终结钩子，不等同于内存已经归还操作系统。对象还可能在 __del__ 中复活；CPython 会确保同一对象的 finalizer 不被重复执行，但复活后的真实状态需要谨慎设计。

生产诊断要分层：weakref 判断对象是否仍存活，gc 工具分析引用图，tracemalloc 追踪 Python 分配栈，RSS 则还受 pymalloc 与系统分配器影响。单看任务管理器无法判定 Python 泄漏。

## 核心机制

- 构造完成后，强引用图决定对象可达性；引用计数处理无环释放，GC 补充处理不可达环。
- 弱引用和 finalize 提供不拥有对象的观察点，适合记录终结事件。
- __del__ 可能在任意触发最后一次 DECREF 的线程和代码位置运行，不能依赖完整模块全局环境。
- 对象释放后内存可回到 Python allocator 的池中复用，未必立刻让进程 RSS 下降。

## 常见误区

- 在实验变量中保存被测对象或 traceback，观察代码本身让对象继续存活。
- 用 sleep 等待析构而不控制引用图，得到依赖实现和调度的脆弱测试。
- 把 RSS 不降直接归因于泄漏，没有检查对象数量、快照差分和 allocator 缓存。

## 可运行示例

```python
import gc
import weakref

timeline = []

class Probe:
    def __del__(self):
        timeline.append("finalized")

obj = Probe()
watch = weakref.ref(obj)
timeline.append("created")

del obj
gc.collect()

assert watch() is None
assert timeline == ["created", "finalized"]
```

## 搭积木复现

### 建立事件时间线

记录 created、alias added、container removed、finalized，并让断言描述顺序而非打印后凭感觉判断。

### 加入环与复活

分别测试普通对象、引用环、__del__ 复活，比较 weakref 与 gc.collect 的观察结果。

### 加入内存证据

用 tracemalloc 快照差分定位分配栈，再与对象存活数量和 RSS 对照，区分泄漏与 allocator 保留。

## 自检

### 问题

为什么“对象已经被回收”和“进程内存立即下降”是两个不同命题？

### 站内答案

对象回收表示其生命周期结束、存储可被复用；CPython 的 pymalloc 和系统 allocator 常把释放块留在池或 arena 中服务后续分配，未必马上归还操作系统。应使用 weakref、对象图和 tracemalloc 判断存活，再单独分析 RSS。
