---
id: "python-06-02"
track: "python"
title: "sys.modules 缓存、预插入与失败回滚"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-06-02.md"
---

## 官方入口

title: "The import system · The module cache"
url: "https://docs.python.org/3/reference/import.html#the-module-cache"

sys.modules 是完全限定名到模块对象的缓存；加载器执行前先插入，失败时删除本次插入的条目。

## 真实源码

repo: "python/cpython"
file: "Lib/importlib/_bootstrap.py"
symbol: "_load_unlocked"
language: "python"
url: "https://github.com/python/cpython/blob/main/Lib/importlib/_bootstrap.py#L893"

### 逐段讲解

- module_from_spec 先建立对象和标准属性，spec._initializing 标记半初始化窗口。
- exec_module 前写入 sys.modules，递归导入同名模块才能拿到同一对象而非无限创建。
- exec_module 失败只删除该名称再重抛；成功后保留对象身份，并把条目移动到字典末尾。

### 源码节选

```python
def _load_unlocked(spec):
    module = module_from_spec(spec)
    spec._initializing = True
    try:
        sys.modules[spec.name] = module       # 执行前预插入，打破递归创建
        try:
            if spec.loader is None:
                if spec.submodule_search_locations is None:
                    raise ImportError("missing loader", name=spec.name)
            else:
                spec.loader.exec_module(module)
        except:
            try:
                del sys.modules[spec.name]    # 本次加载失败不得留下坏缓存
            except KeyError:
                pass
            raise
        module = sys.modules.pop(spec.name)
        sys.modules[spec.name] = module
    finally:
        spec._initializing = False
    return module
```

## 导读

sys.modules 的首要职责是身份稳定和避免重复执行。只要完全限定名存在，import 通常直接返回该对象；值为 None 则强制后续导入失败。删除缓存条目会触发新模块对象，但旧引用仍指向旧对象。

执行前预插入产生“存在但未完成”的窗口。它是支持递归/循环导入的必要代价；spec._initializing 与专用错误信息帮助诊断访问了尚未设置的属性。执行失败必须回滚本次名称，否则半成品会永久伪装成成功模块。

## 核心机制

- 缓存键是完整名，alias 只影响当前绑定，不改变 sys.modules 键。
- 预插入发生在 exec_module 前，模块顶层可观察到自身条目。
- 加载失败删除当前条目，副作用导入的其他模块仍保留。
- 每个模块名有导入锁，避免多线程并发初始化同名模块。

## 常见误区

- 直接替换 sys.modules[name] 后期待现存 from-import 引用同步更新。
- 失败加载器忘记回滚缓存，使后续 import 返回不完整对象。
- 测试删除大量 sys.modules 条目，破坏解释器内部共享类型身份。

## 可运行示例

```python
import importlib
import sys

first = importlib.import_module("fractions")
assert sys.modules["fractions"] is first

del sys.modules["fractions"]
second = importlib.import_module("fractions")

assert first is not second                   # 新缓存对象
assert first.Fraction is not second.Fraction # 旧引用没有重绑
assert sys.modules["fractions"] is second
```

## 搭积木复现

### 实现缓存快路

按完全限定名查询，存在时直接返回同一对象，并单独处理 None 哨兵。

### 实现预插入与回滚

创建 module 后先缓存，再 exec；用 try/except 只删除自己插入的失败条目。

### 加入初始化状态与锁

并发任务等待同名模块锁；循环请求可取得半初始化对象但诊断未定义属性。

## 自检

### 问题

为什么模块必须在 exec_module 之前放入 sys.modules？

### 站内答案

模块顶层可能直接或间接再次导入自己。若执行后才缓存，递归导入会不断创建并执行新对象；提前缓存让递归路径复用同一身份。代价是外部可能看到半初始化对象，所以失败要回滚，循环依赖还应避免过早访问属性。
