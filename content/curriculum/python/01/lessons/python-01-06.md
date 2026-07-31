---
id: "python-01-06"
track: "python"
title: "引用计数的增减时机"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-01-06.md"
---

## 官方入口

title: "C API · Reference counting"
url: "https://docs.python.org/3/c-api/refcounting.html"

CPython 用强引用维持大多数对象的生命周期。new、borrowed、stolen reference 描述所有权转移，引用计数数值本身并不是稳定业务接口。

## 导读

引用计数记录当前有多少个强引用承担“让对象继续存活”的责任。创建拥有型引用时执行 INCREF，释放所有权时执行 DECREF；计数到零会同步进入类型的析构路径，因此 DECREF 可能立即执行任意 Python 清理逻辑。

C API 文档中的 new reference 表示调用者获得一份必须释放的所有权，borrowed reference 表示临时观察且不能擅自 DECREF，stolen reference 表示被调用函数接管了调用者的那一份。它们描述责任流转，比记某个时刻的 ob_refcnt 数字重要得多。

现代 CPython 还存在 immortal objects、延迟或合并引用计数等优化空间，所以 sys.getrefcount 适合做实验，不能用于业务分支。正确的扩展代码应按所有权合同配平引用，而非期待一个固定计数。

## 核心机制

- 名称、容器槽位、frame 和部分缓存都可能持有强引用；删除一个名称只释放其中一份。
- Py_DECREF 计数到零后调用 tp_dealloc，析构又可能递归释放其他对象。
- borrowed reference 的有效期受来源对象约束，期间若执行可能删除来源的代码，必须先转成 owned reference。
- 引用泄漏来自少 DECREF，use-after-free 常来自多 DECREF 或借用引用跨越有效期。

## 常见误区

- 把 sys.getrefcount(x) 当作真实计数，忽略函数参数本身临时增加的一次引用。
- 在 DECREF 之后继续读取对象字段，忘记 DECREF 可能已经触发释放和任意析构代码。
- 认为有引用计数就不需要循环 GC。闭环中的每个对象计数都可能大于零。

## 可运行示例

```python
import sys

value = []
baseline = sys.getrefcount(value)

alias = value
assert sys.getrefcount(value) == baseline + 1

holder = [value]
assert sys.getrefcount(value) == baseline + 2

del alias
holder.clear()
assert sys.getrefcount(value) == baseline
```

## 搭积木复现

### 画所有权账本

把名称、容器和临时参数逐一列为强引用来源，只记录增减事件，不依赖某个绝对计数。

### 模拟 new 与 borrowed

写一个小型对象池，用 acquire/release 表示 owned reference，用只读 lookup 表示 borrowed reference。

### 加入析构重入

让 __del__ 修改另一容器，观察为什么底层代码必须在 DECREF 前先把自身状态调整为一致。

## 自检

### 问题

为什么 Py_DECREF 不能被理解为一次纯粹的整数减法？

### 站内答案

计数减到零时它会进入 tp_dealloc，继而运行弱引用回调、finalizer 或递归释放成员；这些路径可能执行用户代码并重新进入当前系统。因此调用 DECREF 前必须让数据结构处于可重入的一致状态，之后也不能再使用可能已释放的指针。
