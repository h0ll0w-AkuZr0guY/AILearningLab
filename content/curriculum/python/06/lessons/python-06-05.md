---
id: "python-06-05"
track: "python"
title: "ModuleSpec、create_module 与 exec_module"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "importlib.machinery.ModuleSpec"
url: "https://docs.python.org/3/library/importlib.html#importlib.machinery.ModuleSpec"

ModuleSpec 在 finder 与 loader 之间传递名称、loader、origin、包搜索位置和 loader_state。

## 导读

ModuleSpec 是加载计划而非模块本体。finder 描述“由谁、从哪里、是否为包、携带什么私有状态”加载，import machinery 统一负责对象创建、标准属性、sys.modules 预插入、执行与失败回滚。

create_module 可为扩展模块或代理模块自定义对象，返回 None 表示使用默认 ModuleType；exec_module 只初始化传入对象，不应私自换掉身份。拆开创建与执行让多阶段 C 扩展和子解释器拥有清晰生命周期。

## 核心机制

- submodule_search_locations 为 None 表示普通模块，为序列表示包，namespace package 可由多路径组成。
- module_from_spec 调 create_module 并设置 __spec__、__loader__、__package__ 等属性。
- exec_module 运行时对象已在 sys.modules，可支持递归导入。
- loader_state 可传递 finder 计算出的不可公开加载数据。

## 常见误区

- exec_module 新建另一个 module 并替换引用，破坏先拿到预插入对象的循环依赖方。
- 用 __file__ 判断所有模块来源，内建与 namespace package 可能没有它。
- 把 spec.origin 与 module.__file__ 当作自动同步字段，运行时修改一边不会更新另一边。

## 可运行示例

```python
import importlib.abc
import importlib.util
import sys

class ConfigLoader(importlib.abc.Loader):
    def create_module(self, spec):
        return None                           # 使用默认 ModuleType
    def exec_module(self, module):
        module.value = module.__spec__.loader_state["value"]

spec = importlib.util.spec_from_loader("config_demo", ConfigLoader())
spec.loader_state = {"value": 42}
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
try:
    spec.loader.exec_module(module)
    assert module.value == 42
    assert module.__spec__ is spec
finally:
    sys.modules.pop(spec.name, None)
```

## 搭积木复现

### 定义加载计划

spec 保存 name、loader、origin、is_package 与 loader_state，禁止 finder 执行代码。

### 统一 machinery

按 create→标准属性→预缓存→exec→失败回滚实现加载器驱动。

### 验证身份

让 exec 期间递归取得 sys.modules[name]，断言与传入 module 是同一对象。

## 自检

### 问题

为什么现代 loader 分成 create_module 与 exec_module？

### 站内答案

创建负责对象身份和底层分配，执行负责初始化既有对象。import machinery 能在执行前统一设置属性并预插入缓存，循环导入看到稳定身份；C 扩展还能把模块创建与每个解释器的执行阶段分开，改善子解释器隔离。
