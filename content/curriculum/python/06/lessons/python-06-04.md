---
id: "python-06-04"
track: "python"
title: "PathFinder、sys.path_hooks 与 importer cache"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-06-04.md"
---

## 官方入口

title: "The import system · The path based finder"
url: "https://docs.python.org/3/reference/import.html#the-path-based-finder"

PathFinder 遍历 sys.path 或包 __path__，通过 path hooks 为每个路径条目创建并缓存 PathEntryFinder。

## 真实源码

repo: "python/cpython"
file: "Lib/importlib/_bootstrap_external.py"
symbol: "PathFinder._path_importer_cache"
language: "python"
url: "https://github.com/python/cpython/blob/main/Lib/importlib/_bootstrap_external.py#L1209"

### 逐段讲解

- 每个 path entry 先查询 sys.path_importer_cache，避免反复运行所有 path hooks。
- 未命中时逐个调用 hook；hook 以 ImportError 表示“不支持这个路径格式”，首个成功 finder 被缓存。
- 找不到 finder 也缓存 None；新增 hook 后需清理对应缓存或 invalidate_caches。

### 源码节选

```python
@classmethod
def _path_importer_cache(cls, path):
    if path == "":
        path = os.getcwd()                    # 空串动态表示当前目录
    try:
        finder = sys.path_importer_cache[path]
    except KeyError:
        finder = cls._path_hooks(path)        # 依次尝试 sys.path_hooks
        sys.path_importer_cache[path] = finder # None 也缓存，避免反复探测
    return finder

@staticmethod
def _path_hooks(path):
    for hook in sys.path_hooks:
        try:
            return hook(path)
        except ImportError:                   # 这个 hook 不支持该路径
            continue
    return None
```

## 导读

PathFinder 本身是 meta path finder，内部再把每个路径条目交给 PathEntryFinder。默认 FileFinder 根据目录内容和 suffix→loader 表决定 .py、.pyc、扩展模块或包如何产生 spec。

这里至少有 sys.path、sys.path_importer_cache 与 FileFinder 目录缓存三层状态。动态创建文件、修改 hooks 或切换 cwd 后，“文件存在却导入不到”常是缓存未失效，而非语法问题。

## 核心机制

- 顶层搜索 sys.path，子模块搜索 parent.__path__。
- path hook 接收单个条目并返回 finder，不支持时抛 ImportError。
- FileFinder 按目录 mtime 刷新文件名缓存，存在时间粒度竞态。
- importlib.invalidate_caches 通知 finder，并清理部分相对路径/None 缓存。

## 常见误区

- 修改 sys.path_hooks 后不清 sys.path_importer_cache。
- 并发创建模块文件后立刻 import，命中 FileFinder 的旧目录缓存。
- 把应用工作目录依赖隐含在 sys.path[0]，换启动方式就导入不同包。

## 可运行示例

```python
import importlib
import sys
import tempfile
from pathlib import Path

with tempfile.TemporaryDirectory() as directory:
    sys.path.insert(0, directory)
    try:
        try:
            import generated_module
        except ModuleNotFoundError:
            pass

        Path(directory, "generated_module.py").write_text("value = 7", encoding="utf-8")
        importlib.invalidate_caches()
        import generated_module
        assert generated_module.value == 7
    finally:
        sys.path.remove(directory)
        sys.modules.pop("generated_module", None)
```

## 搭积木复现

### 实现 path hook

让 mem://name 条目映射到专属 PathEntryFinder，普通路径抛 ImportError。

### 实现 importer cache

缓存 finder 与 None，增加 invalidate 后重新运行 hooks 的测试。

### 模拟目录缓存竞态

先查找失败再创建模块，验证失效前后结果，并记录 cwd 空路径特殊语义。

## 自检

### 问题

为什么 sys.path_importer_cache 会缓存 None？

### 站内答案

None 表示所有 path hook 都不支持该条目，缓存它能避免每次导入都重复运行整组 hooks。代价是后来安装新 hook 或让路径变得可识别时，旧 None 仍会阻断重新探测，因此必须清理该键或调用合适的缓存失效机制。
