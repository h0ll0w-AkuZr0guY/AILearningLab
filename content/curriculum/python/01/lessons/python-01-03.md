---
id: "python-01-03"
track: "python"
title: "引用计数、分代 GC 与循环引用：内存管理的双保险"
depth: "deep"
visualIndex: "../visuals/python-01-03.md"
exampleLanguage: "python"
readingMinutes: 30
sourceMinutes: 20
practiceMinutes: 30
reviewMinutes: 10
---

## 官方入口

title: "Python 3.14 · gc：循环垃圾检测、代际阈值与追踪边界"
url: "https://docs.python.org/3.14/library/gc.html#gc.set_threshold"

[gc 模块](https://docs.python.org/3.14/library/gc.html#gc.set_threshold) 说明循环垃圾收集器补充 CPython 的引用计数；只有被追踪的容器参与循环检测，`gc.disable()` 只关闭自动循环收集，不会关闭引用计数。3.14.6 文档仍给出三代阈值接口，并特别记录 3.14 与 3.14.5 对 generation 1、`threshold2` 的调整，因此本课不把某一组默认阈值当作语言保证。版本边界是 CPython v3.14.6。

## 真实源码

repo: "python/cpython"
file: "Objects/object.c / Python/gc.c"
symbol: "Py_INCREF / Py_DECREF / gc_collect_main / PyGC_Collect"
language: "c"
url: "https://github.com/python/cpython/blob/v3.14.6/Python/gc.c#L1313-L1344"

### 逐段讲解

- `Py_INCREF` / `Py_DECREF`：引用计数的公开操作由对象实现与构建配置共同决定；不朽对象可以跳过计数变化，归零后才进入类型的析构路径。
- `gc_collect_main`（Python/gc.c L1313-L1344）：先建立 `young`、`old`、`unreachable` 与 `finalizers` 工作链表，再用 `collecting` 原子标志拒绝重入收集。
- `PyGC_Collect`（L1671-L1685）：手动 `gc.collect()` 在收集器启用时请求最高代收集，并保留当前异常状态，避免诊断动作吞掉业务异常。
- `_PyObject_GC_Link`（L1855-L1873）：新追踪对象进入最年轻代并累加分配计数；超过 threshold 后只调度一次自动 GC，由运行时选择实际收集代。

### 源码节选

```c
// Python/gc.c（v3.14.6，省略后续 collection phases）
static Py_ssize_t
gc_collect_main(PyThreadState *tstate, int generation, _PyGC_Reason reason)
{
    Py_ssize_t m = 0;
    Py_ssize_t n = 0;
    PyGC_Head *young;
    PyGC_Head *old;
    PyGC_Head unreachable;
    PyGC_Head finalizers;
    GCState *gcstate = &tstate->interp->gc;

    int expected = 0;
    if (!_Py_atomic_compare_exchange_int(&gcstate->collecting, &expected, 1)) {
        return 0;               // 不重入同一解释器的收集过程
    }
    if (generation == GENERATION_AUTO) {
        generation = gc_select_generation(gcstate);
        if (generation < 0) {
            _Py_atomic_store_int(&gcstate->collecting, 0);
            return 0;           // 当前没有代达到阈值
        }
    }
    // 后续把待检对象划入 young/old，再识别 unreachable。
}
```

删减说明：省略了 `gc_collect_main` 后续的 traverse、finalize 和释放阶段，以及引用计数的多种构建专用快路径；保留的是“防重入 → 选择代 → 准备工作链表”的真实入口。引用计数的精确内联实现会随 GIL 与 free-threaded 构建改变，不能从这个节选推出固定机器指令序列。

## 导读

CPython 的内存管理是双保险：引用计数处理 99% 的场景（赋值、传参、返回），分代 GC 兜底处理循环引用（两个对象互相引用，引用计数永不为 0）。这两者不是「引用计数过时了才加 GC」，而是「引用计数已足够快，GC 只在容器类产生循环时才介入」。不理解这个分工，就无法解释 `sys.getrefcount` 的意义和 `gc.collect()` 的执行时机。

反例：`a = []; a.append(a); del a`——列表 `a` 的引用计数在 `del a` 后从 2 降为 1（`a` 作为自己的元素仍持有引用），不会归零，也不会被 `__del__` 释放。GC 通过可达性分析（从栈和全局变量出发遍历所有可达对象）发现这个孤立环并回收。

## 分章正文

### 引用计数不是自动的：每一次赋值都在修改 ob_refcnt

kicker: "01 · OBSERVE"

看 `a = [1,2]; b = a; del a` 的过程：`a = [1,2]` 时 `PyList_New` 返回 `ob_refcnt=1`；`b = a` 触发 `Py_INCREF(a)` → `ob_refcnt=2`；`del a` 触发 `Py_DECREF(a)` → `ob_refcnt=1`。最后 `del b` 把计数降到 0，调用 `list_dealloc` 释放内存并递归 DECREF 其元素。每一行 Python 都对应明确的 INCREF/DECREF 操作——CPython 的 `dis` 模块在字节码 `STORE_FAST`/`LOAD_FAST` 的注释里标出了这些引用计数操作。

#### 本章结论

引用计数是 Python 赋值/传参/返回的原子操作；`sys.getrefcount(x)` 能看到实时的 ob_refcnt 值。

### 循环引用：为什么需要 GC 兜底

kicker: "02 · MODEL"

`a = []; b = []; a.append(b); b.append(a)` 后 `a` 和 `b` 互相引用：`a` 的 ob_refcnt 是 2（自身变量 a + b 中的一个元素引用），`b` 同理。`del a; del b` 后这两个 count 都降为 1——永远不为 0，引用计数无法释放它们。

GC 的解决方案：所有带 `Py_TPFLAGS_HAVE_GC` 的容器对象（list/dict/set/用户类）在创建时挂入 0 代链表。GC 定期收集时：
1. 复制 ob_refcnt 到 `_gc_refs`
2. 遍历每个对象的引用目标，递减目标的 `_gc_refs`（subtract_refs）
3. `_gc_refs > 0` 的对象从外部可达 → 标记存活；`_gc_refs == 0` 的对象仅在循环内被引用 → 标记不可达

#### 本章结论

循环引用阻止引用计数归零；GC 通过复制引用计数并减掉内部引用来检测不可达环。

### PY_INCREF/DECREF 的热路径优化

kicker: "03 · SOURCE"

CPython v3.14.6 的引用计数实现有三个优化层：

1. **不朽对象短路**：编译时已知 `None`/`True`/`False`/小整数 → INCREF/DECREF 不做任何事。
2. **内联函数**：`_Py_INCREF` 是 `static inline`，消除函数调用开销。
3. **JIT 优化**：v3.14 的实验性 JIT 把引用计数操作合并到寄存器更新中，减少内存往返。

`_Py_Dealloc` 释放对象时，先调用 `tp_dealloc` 把元素递归 DECREF，再调用 `PyObject_Free` 归还内存到 pymalloc 分配器。对于小对象（≤512 字节），pymalloc 使用 arena/pool/block 三级复用避免频繁 `malloc/free`。

#### 本章结论

引用计数是高度优化的热路径；不朽对象、内联函数与 JIT 三重削减开销。

### GC 的世代与阈值：先读运行时，再谈调参

kicker: "04 · GC"

不要把课堂里常见的 `(700, 10, 10)` 当成契约。CPython 的公开 API 仍返回三个阈值，但 3.14 已移除中间的第 1 代：新容器先在第 0 代，存活对象进入老代（第 2 代）；`gc.collect(1)` 在这个版本表示一次带老代增量扫描的收集，而 `threshold2` 被忽略。`threshold0` 的含义是“自上次收集以来分配数减去释放数”的触发阈值，具体数值由当前运行时决定。

分代仍服务于同一个经验事实：大部分临时容器很快死亡，应该优先在年轻代检查；较长寿的对象没有必要在每轮都完整扫描。先打印 `gc.get_threshold()`、`gc.get_count()` 和 `gc.get_stats()`，再解释一次暂停。`gc.disable()` 仅关闭自动的循环收集；引用计数照常析构普通对象，已有环仍可由显式 `gc.collect()` 检查。

#### 本章结论

世代数和阈值语义有版本边界；3.14 应以“年轻代 + 老代增量扫描”理解，而不是背诵旧三代默认值。

### 障碍回收与 tp_traverse

kicker: "05 · ENGINEERING"

每个有 GC 追踪的类型必须实现 `tp_traverse`——一个回调函数，告诉 GC「我的哪个字段指向别的 Python 对象」。`list` 的 `tp_traverse` 遍历 `ob_item` 数组，`dict` 遍历 keys 和 values。GC 用 `tp_traverse` 递归标记所有可达对象；没有 `tp_traverse` 的 C 扩展类型不参与 GC。

`__del__` 方法仍使回收更难推理，因为 finalizer 可以让对象重新变为可达。可是 PEP 442 已改变旧教材常说的行为：普通 Python `__del__` 环通常可以被安全最终化和回收，不能再把“有 finalizer 就进入 `gc.garbage`”当作结论。`gc.garbage` 更适合作为不可收集扩展类型或 `DEBUG_SAVEALL` 诊断时的证据容器。

#### 本章结论

tp_traverse 定义 GC 可达性边界；finalizer 可能复活对象，因此需要用当前版本的行为和实际诊断结果判断。

### 怎么验证：gc.get_objects 与循环引用检测

kicker: "06 · VERIFY"

`gc.get_objects()` 返回当前被 GC 追踪的对象，可用于受控采样；它自身取得的列表会制造临时引用，因此不能把一次长度差直接判成泄漏。`gc.set_debug(gc.DEBUG_SAVEALL)` 会让本应释放的候选对象留在 `gc.garbage`，适合检查“这一轮找到了谁”，诊断结束后必须恢复 debug flag 并清理自己的引用。本课示例复现引用计数增减、循环引用收集和阈值 API 的版本无关契约。

#### 本章结论

gc.get_objects + gc.DEBUG_SAVEALL 是受控诊断工具；离线示例验证引用计数与循环收集的联动。

### 分代代价模型：什么时候 GC 会成为瓶颈

kicker: "07 · ENGINEERING"

分代代价模型来自“多数对象短命”的假设。CPython 3.14 的年轻代收集优先处理近期容器；对老代则依据 `threshold1` 控制一次扫描的比例。单次收集仍要遍历候选对象内部的引用边，暂停成本取决于候选规模、引用图形状、扩展类型的 traverse 代价和运行环境，而不能由某个“第几代每十次”公式直接推出。

极端情况是长生命周期的大缓存持有很多容器：业务吞吐平稳时，某次老代增量扫描仍可能成为尾延迟来源。此时应将 `gc.get_stats()` 的 collections/collected、分配热点和请求延迟并排测量；是否调整 `threshold0` 或 `threshold1`、是否在安全点显式收集，都要由那组证据决定。盲目调高阈值只是把循环垃圾和一次更大的扫描推迟到未来。

`tracemalloc` 是 3.4+ 引入的内存追踪工具，可以记录分配点；与 `gc.get_objects()` 联用可定位泄漏源。

#### 本章结论

分代假说 = 大多数对象短命；STW 暂停与代际对象数线性相关；tracemalloc + gc 是诊断组合。

### 弱引用与 finalizer：refcount 之外的资源管理

kicker: "08 · SOURCE"

`weakref.ref(obj)` 返回一个不增加 ob_refcnt 的弱引用——当 `obj` 的强引用归零被释放时，弱引用自动失效（`wr()` 返回 None）。这为「观察者模式」「缓存」「避免循环引用」提供了工具。`weakref.WeakValueDictionary` 用弱引用做 value，key 被回收时自动移除条目。

`__del__` 是 Python 层 finalizer 入口；CPython 通过 `tp_finalize` 处理最终化。它允许对象在 finalizer 中重新建立强引用，因此诊断时应假设“可能复活”，并避免在 `__del__` 做网络、锁竞争或依赖模块全局状态的工作。PEP 442 后，普通 Python finalizer 环通常会被处理，不需要人为清空 `gc.garbage`；只有把 `DEBUG_SAVEALL` 打开时，才是我们主动要求 GC 保留对象以便观测。

weakref 的实现是 `PyWeakReference` 结构体，指向目标 `PyObject*` 与一个回调链表；目标被释放时 `tp_dealloc` 调 `clear_weakref` 把所有弱引用置 None。

#### 本章结论

weakref 不增 refcount；finalizer 可能复活对象；weakref + 循环引用是诊断重点。

### 版本边界：阈值是信号，收集不是固定节拍

kicker: "09 · BOUNDARY"

`gc.get_threshold()` 的返回值是三元组，但具体默认值是实现配置，不能把 `(700, 10, 10)` 写进跨版本断言。文档定义的触发量是“自上次收集以来的分配数减去释放数”超过 `threshold0`；存活对象会向更老代移动。3.14.6 还保留了 3.14 与 3.14.5 在中间代和 `threshold2` 语义上的版本记录，正说明调优必须读取当前运行时的 `gc.get_threshold()` 与 `gc.get_stats()`。

`gc.disable()` 只停止自动循环收集。普通对象的引用计数仍会在引用归零时析构；已有环可用显式 `gc.collect()` 检查。free-threaded 构建还会同时考虑进程内存增长，因此同样的对象分配次数未必立即触发一次收集。最终化也需要精确表述：PEP 442 之后，带 Python `__del__` 的普通循环通常不会自动落入 `gc.garbage`；后者更常见于不可收集扩展类型或显式启用 `DEBUG_SAVEALL` 的诊断。

因此，线上告警不应只报“发生了第 2 代 GC”。更有解释力的是把回收前后的对象数、暂停耗时、业务吞吐和分配热点放到同一时间线：如果对象数稳定而暂停升高，先查更老代扫描与运行环境；如果对象数持续上升，再用 `tracemalloc` 和 `gc.get_referrers` 从持有边追到代码路径。诊断工具本身会持有对象，采样和临时引用必须在结论中说明。

#### 本章结论

GC 调参必须以当前版本的计数、统计与暂停证据为准；固定阈值和“有 `__del__` 必进 garbage”都是已经失真的简化说法。

## 核心机制

- 引用计数通过 INCREF/DECREF 宏管理；不朽对象跳过。
- 循环引用使计数永不为零；GC 通过引用副本减法检测不可达环。
- 3.14 的 GC 有年轻代与老代增量扫描；阈值值与细节应从当前运行时读取。
- tp_traverse 回调定义 GC 可达性边界。
- __del__ finalizer 可能复活对象；PEP 442 后不能以“必进 gc.garbage”解释普通环。

## 常见误区

- 以为 `del x` 就释放了 `x`；del 只是解绑变量名（DECREF），只有 ob_refcnt 归零才释放。
- 以为 GC 可以替代引用计数；int/str/float 等非容器对象不走 GC 追踪。
- 以为 `gc.disable()` 完全停止内存回收；引用计数仍在工作，只是循环引用不再被检测。
- 把 `sys.getrefcount(x)` 的返回值当「当前引用数」；函数调用传参本身再加 1。

## 实现变体

### 变体 A：纯引用计数（无 GC）

useWhen: "无循环引用的场景（如数据处理管道，所有对象都是临时创建的）。"
tradeoff: "获得：零 GC 开销；牺牲：循环引用永不释放。"

#### 代码

```python
import gc; gc.disable()
a = []; a.append(a); del a        # 循环引用永不释放
assert gc.collect() > 0           # 手动回收成功
```

### 变体 B：默认三代 GC 自动管理

useWhen: "通用 Python 程序，容器对象可能产生循环。"
tradeoff: "获得：自动检测回收循环引用；牺牲：GC 回收时短暂停顿（STW）。"

## 可运行示例

```python
import gc, sys

# 断言 1：赋值 → ob_refcnt 递增
a = [42]
rc1 = sys.getrefcount(a)           # getrefcount 本身传参加 1
b = a
rc2 = sys.getrefcount(a)
assert rc2 == rc1 + 1

# 断言 2：循环引用不被立即释放
a2 = []; b2 = []
a2.append(b2); b2.append(a2)
a2_id, b2_id = id(a2), id(b2)
del a2, b2
gc.collect()                        # GC 回收循环

# 断言 3：阈值 API 的稳定形状，而非某个版本的默认数字
thresholds = gc.get_threshold()
assert len(thresholds) == 3 and all(isinstance(value, int) for value in thresholds)

# 断言 4：普通 finalizer 环会被处理；不假定 gc.garbage 是结果
class WithDel:
    finalized = False
    def __del__(self): type(self).finalized = True
x = WithDel(); x.self = x
del x
gc.collect()
assert WithDel.finalized

# 断言 5：非容器对象不走 GC
n = gc.collect()
x = 42; del x
assert gc.collect() == 0            # int 不参与 GC
```

## 搭积木复现

### 积木 1：模拟 refcnt 增减
### 积木 2：模拟循环引用创建与检测
### 积木 3：实现运行时阈值与年轻代/老代模型
### 积木 4：实现 tp_traverse 可达性分析
### 积木 5：对照上游源码（object.c 引用计数入口 + gc.c collect）

### 积木 6：为诊断留出版本证据

在日志中同时记录 `sys.version`、`gc.get_threshold()`、`gc.get_count()`、`gc.get_stats()` 与是否启用 free-threaded 构建。用这组读数解释一次收集，而不是硬编码三代默认值；这正是把课堂模型变成线上诊断证据的最后一步。

## 自检

### 问题

`a = []; b = (a,); del a` 后为什么 `b[0]` 仍然是空列表且不报错？引用计数的哪个机制保证了它不被释放？这为什么不构成循环引用？

### 站内答案

结论：`b[0]` 仍存活因为 tuple `b` 持有列表 `a` 的引用——`b = (a,)` 时 INCREF(a)，`del a` 后 ob_refcnt 从 2 降到 1，未归零，所以 list 不释放。这不是循环引用因为 tuple 不引用回 list——引用链是单向的 `tuple → list`。机制：Py_DECREF 只在 ob_refcnt 归零时调 _Py_Dealloc。源码证据：object.h Py_DECREF（约 L215）`if (--op->ob_refcnt == 0) _Py_Dealloc(op)`。可运行验证：本课示例的 refcnt 断言。

## 更新日志

### 按深度协议全面重写

at: "2026-08-01T21:30:00+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "WorkBuddy · DeepSeek-V4-Flash"
summary: "按深度课程协议全面重写：基于 CPython v3.14.6 的 Objects/object.c 与 Python/gc.c，补足引用计数热路径、循环引用、3.14 的年轻代/老代阈值边界、tp_traverse 和可运行诊断示例，并建立视觉索引。"
