---
id: "python-06-06"
track: "python"
title: "普通包、__path__ 与 namespace package"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "The import system · Packages"
url: "https://docs.python.org/3/reference/import.html#packages"

包通过 __path__/spec.submodule_search_locations 提供子模块搜索位置；namespace package 可聚合多个路径且无 __init__.py。

## 导读

普通包是执行 __init__.py 得到的模块，同时拥有 __path__ 供 PathFinder 查找子模块。导入 parent.child 时，搜索范围来自 parent.__path__，并在成功后把 child 模块设置为 parent.child 属性。

namespace package 没有单一 __init__.py 和固定 origin，它把 sys.path 上多个同名目录贡献合并成搜索位置。这适合大型组织拆分发行包，也带来安装缺片、路径优先级和资源访问的额外诊断成本。

## 核心机制

- spec.submodule_search_locations 非 None 即表示 package。
- 普通包先执行 __init__.py，再开始子模块加载。
- namespace path 会在父搜索路径变化时动态重算。
- importlib.resources 应替代拼接 __file__ 读取包资源。

## 常见误区

- namespace package 中依赖根 __init__.py 注册副作用，它根本不存在。
- 手工覆盖 __path__ 导致其他发行包贡献的 namespace 部分消失。
- 用当前工作目录拼资源路径，打包成 wheel/zip 后失效。

## 可运行示例

```python
import sys
import tempfile
from pathlib import Path

with tempfile.TemporaryDirectory() as left, tempfile.TemporaryDirectory() as right:
    Path(left, "shared_ns").mkdir()
    Path(right, "shared_ns").mkdir()
    Path(left, "shared_ns", "alpha.py").write_text("value='a'", encoding="utf-8")
    Path(right, "shared_ns", "beta.py").write_text("value='b'", encoding="utf-8")
    sys.path[:0] = [left, right]
    try:
        import shared_ns.alpha, shared_ns.beta
        assert set(shared_ns.__path__) == {
            str(Path(left, "shared_ns")), str(Path(right, "shared_ns"))
        }
    finally:
        del sys.path[:2]
        for name in list(sys.modules):
            if name == "shared_ns" or name.startswith("shared_ns."):
                del sys.modules[name]
```

## 搭积木复现

### 比较两类 spec

检查普通包与 namespace package 的 loader、origin、submodule_search_locations、__file__。

### 实现路径聚合

遍历父 path 收集所有同名目录；找到 __init__ 时按普通包优先规则返回。

### 测试分片安装

删除其中一个贡献目录，验证错误信息能指出缺失发行包而非笼统模块不存在。

## 自检

### 问题

namespace package 为什么能跨多个 site-packages 目录组成一个包？

### 站内答案

PathFinder 在父搜索路径的多个条目中收集同名目录贡献，并把它们组成 spec.submodule_search_locations；没有单一 __init__.py 被执行。后续子模块搜索遍历这组位置，因此不同 distribution 可以分别提供同一 namespace 下的子包。
