---
id: "python-10-10"
track: "python"
title: "specialization：counter、guard、cache 与 deopt"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-10-10.md"
---

## 官方入口

title: "PEP 659 · Specializing Adaptive Interpreter"
url: "https://peps.python.org/pep-0659/"

自适应解释器先执行通用语义并收集反馈，再把稳定站点替换为带 guard/cache 的专用形式；假设失效时回退。当前实现细节以对应版本源码为准。

## 真实源码

repo: "python/cpython"
file: "Python/specialize.c · Python/bytecodes.c"
symbol: "_Py_Specialize_*"
language: "c"
url: "https://github.com/python/cpython/blob/main/Python/specialize.c"

### 逐段讲解

- 可专门化站点先带 warmup/counter，避免冷代码立即支付分析和重写成本；达到阈值后检查实际对象类型与可缓存形状。
- 成功时 inline cache 保存 type version、descriptor/index 或其他快速路径证据，执行时 guard 命中便跳过通用协议；cache 位于指令邻近 code units，提高局部性。
- guard miss 会计数、deopt 或重新专门化。所有 specialized opcode 必须与通用 opcode 可观察语义相同，异常、descriptor 和用户自定义 hook 都不能被错误绕过。

### 源码节选

```c
# 教学版 inline cache，不修改真正 bytecode
MISS = object()

class AttrCache:
    def __init__(self):
        self.owner = None
        self.name = None
        self.slot = None

    def load(self, obj, name):
        # guard：类型与属性名仍是训练时的稳定形状
        if type(obj) is self.owner and name == self.name:
            value = self.slot(obj)
            if value is not MISS:
                return value

        # slow path：完整 getattr 保留 descriptor/__getattr__ 语义
        value = getattr(obj, name)
        if hasattr(obj, "__dict__") and name in obj.__dict__:
            self.owner, self.name = type(obj), name
            self.slot = lambda current: current.__dict__.get(name, MISS)
        return value
```

## 导读

动态语言的同一 LOAD_ATTR 可以遇到任意类型和自定义协议，通用实现必须检查很多分支；真实程序的单个调用站点却往往反复看见相同形状，例如循环里每次都是同一类实例字段。specialization 利用“全局动态、局部稳定”，为具体站点生成带假设的快捷路径。

inline cache 保存证明快捷路径仍正确所需的最小证据，例如 type version、字典 index、keys version 或 callable 信息。guard 先验证证据，命中才直接取值；任何可能改变查找语义的事件都必须让版本变化或 guard 失败。缓存的是可撤销假设，不是把动态语义永久改成静态。

为何需要 counter 与 deopt？冷站点的反馈不足，立即特化会浪费编译时间；多态站点在 A/B 类型间来回切换，反复重写会抖动。计数器控制观察窗口、失败退避和重试，deopt 回到永远正确的通用形式。这套状态机比“见一次类型就缓存”复杂，却是生产自适应系统的稳定性核心。

## 核心机制

- quickening 在 code object 可执行副本上调整指令/cache，原始语义和反汇编接口需保留可解释性。
- family 把 adaptive、specialized 与 instrumented 形式关联到同一基础 opcode。
- type/dict/function version tag 将许多失效事件折叠成整数 guard。
- megamorphic 站点应退避，避免 specialization thrashing 比通用路径更慢。
- dis(adaptive=True, show_caches=True) 可观察当前运行时状态，但 opcode 名和阈值不是稳定 API。

## 常见误区

- 把 specialization 等同 JIT 机器码生成；CPython 这层首先是专用 bytecode 与 inline cache。
- 缓存 obj.__dict__[name] 却忽略 data descriptor 优先级、__getattribute__ 和字典 keys 变化。
- 在微基准中只测热态最好结果，不报告 warmup、deopt 和输入多态性。

## 可运行示例

```python
import dis

class Point:
    def __init__(self, x):
        self.x = x

def read_x(point):
    return point.x + 1

p = Point(10)
for _ in range(20_000):
    read_x(p)       # 让调用站点积累稳定反馈

dis.dis(read_x, adaptive=True, show_caches=True)

# 再传入拥有 property 或自定义 __getattribute__ 的对象，
# 观察语义仍正确，并比较 cache/deopt 状态（具体名称随版本变化）。
```

## 搭积木复现

### 实现状态机

为一个 LOAD_ATTR 站点实现 COLD → ADAPTIVE → SPECIALIZED → BACKOFF，记录执行、命中、miss 与 rewrite 次数。

### 定义正确 guard

先列出通用属性查找链，再证明缓存了哪些前提；若无法证明，就不要进入 fast path。

### 加入失效

修改实例字段、类 descriptor、__getattribute__ 或传入第二类型，确保 miss 后回到完整 getattr 而非返回旧值。

### 设计多态实验

比较单态、双态、megamorphic 输入的 warmup、命中率、总耗时和重写次数，解释何时优化反而亏损。

## 自检

### 问题

inline cache 为什么必须保存 guard 证据，而不能只保存上一次查到的值或地址？

### 站内答案

属性、全局变量和调用目标会因实例/类字典修改、descriptor 替换、类型变化等事件改变。缓存结果只有在一组结构假设仍成立时才等价于通用语义；guard 用 version/type/index 等证据验证这些假设。没有 guard 的旧结果会把合法动态修改变成静默错误。
