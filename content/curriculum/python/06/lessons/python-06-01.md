---
id: "python-06-01"
track: "python"
title: "import 语句、模块对象与名称绑定"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "The import system · The import statement"
url: "https://docs.python.org/3/reference/import.html#the-import-statement"

import 先查找并初始化模块，再决定在当前作用域绑定顶层包、子模块或被导出的属性。

## 导读

import 同时做两件事：保证目标模块对象已被找到和加载，再在当前 namespace 建立绑定。import pkg.sub 通常绑定 pkg；from pkg import sub 绑定 sub；import pkg.sub as alias 则把目标子模块绑定给 alias。

模块是普通对象，执行模块代码就是向 module.__dict__ 写入名称。一次成功加载后，其他导入通常复用同一 sys.modules 对象，因此模块级可变状态拥有进程级共享范围。

## 核心机制

- __import__ 返回值为兼容语义常是顶层包，importlib.import_module 返回指定模块。
- from x import name 优先读取 x.name，必要时还可能尝试加载 x.name 子模块。
- 模块代码从上到下执行，函数体只定义不调用，装饰器与类体则在导入期运行。
- __all__ 只影响 from module import *，不形成权限边界。

## 常见误区

- 在模块顶层进行网络连接、启动线程或读取不可用配置，使导入变成不可控副作用。
- 认为 import pkg.sub 后局部名称 sub 自动存在。
- 把模块单例当作跨进程共享状态；每个解释器进程有独立 sys.modules。

## 可运行示例

```python
import importlib
import xml.etree.ElementTree

assert "xml.etree.ElementTree" in __import__("sys").modules
assert xml.__name__ == "xml"              # import pkg.sub 绑定顶层 pkg

ET = importlib.import_module("xml.etree.ElementTree")
assert ET.__name__ == "xml.etree.ElementTree"
assert ET is xml.etree.ElementTree

from xml.etree import ElementTree as BoundET
assert BoundET is ET
```

## 搭积木复现

### 记录绑定表

对四种 import 语法列出实际加载名与局部绑定名，用 globals() 断言。

### 实现 mini import statement

把 resolve/load 与 bind 两阶段分成独立函数，禁止混成一个路径查找函数。

### 审计顶层副作用

列出每个模块导入期执行的 I/O、注册和全局实例化，把重操作移到显式初始化。

## 自检

### 问题

为什么 import a.b.c 后当前作用域通常只有 a，而 import a.b.c as cmod 会绑定 cmod？

### 站内答案

查找加载阶段都确保 a、a.b、a.b.c 存在；名称绑定阶段遵循语句形式。无 as 的点名 import 绑定顶层包，便于通过 a.b.c 访问；as 形式明确要求把完整目标模块对象绑定给别名。
