---
id: "python-06-03"
track: "python"
title: "sys.meta_path 与 MetaPathFinder"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "The import system · The meta path"
url: "https://docs.python.org/3/reference/import.html#the-meta-path"

未命中缓存后，import 依次询问 sys.meta_path 中 finder.find_spec(fullname, path, target)。

## 真实源码

repo: "python/cpython"
file: "Lib/importlib/_bootstrap.py"
symbol: "_find_spec"
language: "python"
url: "https://github.com/python/cpython/blob/main/Lib/importlib/_bootstrap.py#L1192"

### 逐段讲解

- 先复制 meta_path，避免 finder 执行期间修改列表导致当前遍历视图漂移。
- 每个 finder 返回 None 表示不负责，首个非 None ModuleSpec 胜出；顺序因此就是优先级。
- finder 执行可能间接完成模块加载，非 reload 情况要再次检查 sys.modules 并优先采用实际模块的 spec。

### 源码节选

```python
def _find_spec(name, path, target=None):
    meta_path = list(sys.meta_path)
    is_reload = name in sys.modules

    for finder in meta_path:
        spec = finder.find_spec(name, path, target)
        if spec is not None:
            if not is_reload and name in sys.modules:
                module_spec = getattr(sys.modules[name], "__spec__", None)
                return module_spec or spec
            return spec
    return None
```

## 导读

MetaPathFinder 是全局路由层，可处理内建、冻结、文件系统、zip、内存、远程或策略阻断模块。顶层导入 path=None；查找 package.child 时 path 是父包的 submodule_search_locations。

返回 None 表示“我不处理”，抛 ModuleNotFoundError/ImportError 则终止搜索。自定义 finder 应只认领明确 namespace，并避免做昂贵网络请求拖慢所有 import。

## 核心机制

- finder 只负责产出 ModuleSpec，不应自行执行模块。
- target 主要用于 reload，允许 finder参考现有模块。
- sys.meta_path 顺序影响覆盖和安全策略。
- invalidate_caches 广播给支持该方法的 finder。

## 常见误区

- 自定义 finder 对未知名称抛错，阻断后续标准 finder。
- 把 finder 插到最前且拦截宽泛前缀，覆盖标准库或供应链模块。
- find_spec 内执行用户模块，破坏加载器的缓存与回滚责任。

## 可运行示例

```python
import importlib.abc
import importlib.util
import sys

SOURCES = {"memory_demo": "answer = 42"}

class MemoryLoader(importlib.abc.Loader):
    def exec_module(self, module):
        exec(SOURCES[module.__name__], module.__dict__)

class MemoryFinder(importlib.abc.MetaPathFinder):
    def find_spec(self, fullname, path, target=None):
        if fullname not in SOURCES:
            return None
        return importlib.util.spec_from_loader(fullname, MemoryLoader())

finder = MemoryFinder()
sys.meta_path.insert(0, finder)
try:
    import memory_demo
    assert memory_demo.answer == 42
finally:
    sys.meta_path.remove(finder)
    sys.modules.pop("memory_demo", None)
```

## 搭积木复现

### 限制命名空间

finder 仅接受固定前缀或 registry 中的完整名，其他请求立即 None。

### 只返回 spec

把源码/字节获取状态放 loader_state，真正执行交给 loader。

### 覆盖协议矩阵

测试顶层 path=None、子模块 path、reload target、unknown name 和 invalidate。

## 自检

### 问题

自定义 MetaPathFinder 对不认识的模块名应返回 None 还是抛 ModuleNotFoundError？

### 站内答案

通常返回 None，让后续 finder 继续尝试；只有它明确拥有该 namespace 且确定目标无效时才应抛错终止。把“不负责”误写成“找不到”会使标准库和其他插件的导入被全局拦截。
