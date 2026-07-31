---
id: "python-06-07"
track: "python"
title: "绝对/相对导入、__package__ 与 __main__"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-06-07.md"
---

## 官方入口

title: "The import system · Package relative imports"
url: "https://docs.python.org/3/reference/import.html#package-relative-imports"

显式相对导入由前导点和 __package__/__spec__.parent 解析；直接文件执行往往没有已知父包。

## 导读

from . import sibling 的点不是文件系统“当前目录”，而是模块完整名中的包层级。一个点表示当前 package，两个点上升一层；解析依赖 __package__，现代实现通常由 __spec__.parent 初始化。

python file.py 把文件作为 __main__ 直接执行，package 上下文通常为空；python -m pkg.file 先按导入系统找到 spec，再以 __main__ 执行，因此相对导入可用。入口设计应优先薄 __main__.py 或 console script。

## 核心机制

- 绝对导入从顶层 sys.path 解析，不相对当前源文件。
- 相对导入只允许 from 形式，level 来自点数。
- __name__ == "__main__" 与真实 spec.name 可以不同。
- runpy 与 -m 能保留包解析语义，同时提供入口身份。

## 常见误区

- 把包内部文件直接运行，遇到 attempted relative import with no known parent package。
- 通过修改 sys.path 修补入口，掩盖真实安装和包结构问题。
- 模块既作库又在顶层执行大量 CLI 逻辑，导入测试时产生副作用。

## 可运行示例

```python
# 推荐目录：
# app/
#   __init__.py
#   __main__.py       -> from .cli import main; main()
#   cli.py            -> from .service import run
#   service.py
#
# 从项目安装环境执行：
#   python -m app
#
# 此时 __main__.__package__ == "app"，相对导入有稳定父包。

import importlib.util
spec = importlib.util.find_spec("xml.etree.ElementTree")
assert spec.name == "xml.etree.ElementTree"
assert spec.parent == "xml.etree"
```

## 搭积木复现

### 打印执行身份

分别 direct file 与 -m 运行，记录 __name__、__package__、__spec__、sys.path[0]。

### 实现 resolve_name

根据 package 片段与 level 裁剪父路径，覆盖越过顶层与空 package。

### 重构入口

业务逻辑放可导入模块，__main__.py 只解析参数并调用 main。

## 自检

### 问题

同一个文件用 python file.py 运行时相对导入失败，用 python -m pkg.file 却成功，根因是什么？

### 站内答案

直接执行只把文件命名为 __main__，通常没有包 spec/parent；-m 先通过 import machinery 找到 pkg.file 的 ModuleSpec，再以入口身份执行，__package__ 被设为 pkg。相对导入按模块身份解析，不按磁盘目录猜测。
