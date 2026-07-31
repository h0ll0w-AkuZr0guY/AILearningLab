---
id: "python-06-09"
track: "python"
title: "reload、from-import 快照与 monkey patch 可见性"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "importlib.reload"
url: "https://docs.python.org/3/library/importlib.html#importlib.reload"

reload 重新执行模块代码并保留原模块字典；其他位置通过 from-import 或实例保存的引用不会自动重绑。

## 导读

reload(module) 使用原 spec/loader 重新编译并执行代码，通常复用同一个模块对象和字典。新定义覆盖同名键，源码删除的旧键却可能继续残留，除非模块初始化显式清理。

外部 from mod import C 保存的是当时对象引用；reload 后 mod.C 可能是新类，旧 C 与旧实例仍属于旧类。monkey patch 同样只影响后来通过被修改引用进行的查找，已复制或闭包捕获的对象不会追踪更新。

## 核心机制

- reload 不是清空进程状态，模块字典被保留以支持缓存惯例。
- 外部模块 namespace 不会因 reload 自动重执行 from 语句。
- 旧类实例的方法查找仍走旧 class object。
- C 扩展初始化和全局状态未必支持安全重复执行。

## 常见误区

- 把 reload 当作生产热更新方案，形成同名多版本类与注册表。
- 测试 monkey patch 定义处，却被测模块早已 from-import 复制依赖。
- 源码删除变量后期待 reload 删除旧键。

## 可运行示例

```python
import importlib
import math

sqrt_snapshot = math.sqrt
original_module = math

math.sqrt = lambda value: "patched"
assert math.sqrt(9) == "patched"
assert sqrt_snapshot(9) == 3.0         # 已复制引用不跟随模块属性

importlib.reload(math)
assert math is original_module         # 模块身份通常复用
assert math.sqrt(9) == 3.0
assert sqrt_snapshot is not math.sqrt  # 外部快照仍是另一引用
```

## 搭积木复现

### 画引用图

分别标记 module.attr、from-import local、class instance、closure capture 指向哪个对象。

### 做版本实验

临时模块 v1/v2 reload 后比较模块、类、函数、实例身份与旧键残留。

### 设计可替换依赖

把 provider 作为参数或 registry 查询，避免不可控地 patch 被复制的全局引用。

## 自检

### 问题

为什么 reload 后旧实例通常不会变成新定义类的实例？

### 站内答案

reload 在模块字典中把类名重绑到新 class object，但旧实例的 __class__ 仍指向旧 object，外部保存的旧类引用也不变。名称重绑不会遍历堆并重写所有已有引用，因此进程内会同时存在多个同名版本。
