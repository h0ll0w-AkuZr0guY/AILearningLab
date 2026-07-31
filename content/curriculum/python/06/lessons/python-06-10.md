---
id: "python-06-10"
track: "python"
title: "venv、site、sys.path 初始化与可重建环境"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-06-10.md"
---

## 官方入口

title: "venv · How virtual environments work"
url: "https://docs.python.org/3/library/venv.html#how-venvs-work"

venv 由 pyvenv.cfg 指向 base Python；sys.prefix 指向环境，sys.base_prefix 指向基础安装，激活主要修改 PATH。

## 导读

venv 不是完整复制解释器。它用 pyvenv.cfg、环境解释器入口与独立 site-packages 在基础 Python 上建立隔离前缀；是否处于 venv 应比较 sys.prefix 与 sys.base_prefix，而非依赖可选的 VIRTUAL_ENV。

解释器启动先构造核心 sys.path，再由 site 处理 site-packages、.pth 与 sitecustomize/usercustomize。激活脚本主要把环境 Scripts/bin 放到 PATH 前面；直接调用 .venv/Scripts/python 同样有效。

脚本 shebang 与配置包含绝对路径，环境通常不可搬迁。可靠交付应保存锁定依赖、Python 版本与构建条件，随时删除并重建环境，而非归档整个 .venv。

## 核心机制

- pyvenv.cfg 的 home 指向 base 安装，include-system-site-packages 控制继承。
- sys.prefix/sys.exec_prefix 表示当前环境，base_* 表示基础解释器。
- .pth 文件可添加路径甚至执行 import 行，属于供应链审计面。
- PYTHONPATH、用户 site 与启动 flags 会改变隔离结果。

## 常见误区

- 把 .venv 提交或复制到另一机器，绝对路径和二进制 ABI 失效。
- 只看 shell prompt 判断环境，实际 python/pip 来自不同前缀。
- 忽略 .pth/sitecustomize，排查 sys.path 污染时只看环境变量。

## 可运行示例

```python
import site
import sys

state = {
    "in_venv": sys.prefix != sys.base_prefix,
    "prefix": sys.prefix,
    "base_prefix": sys.base_prefix,
    "site_packages": site.getsitepackages(),
    "user_site_enabled": site.ENABLE_USER_SITE,
    "executable": sys.executable,
}

for key, value in state.items():
    print(f"{key}: {value}")

# 用 sys.executable -m pip 保证 pip 与当前解释器一致。
```

## 搭积木复现

### 追踪路径来源

打印 sys.path，每一项标注来自 executable、stdlib、PYTHONPATH、.pth、user site 或 venv site。

### 验证工具一致性

比较 sys.executable、python -m pip --version 与命令行 pip 所属前缀。

### 做冷重建

从空目录创建 venv、按锁文件安装、运行 smoke test，删除后重复以验证可重现。

## 自检

### 问题

为什么激活 venv 不是使用它的必要条件？

### 站内答案

激活主要修改 PATH 和提示符，让 python 命令解析到环境解释器；直接执行环境中的 python 路径同样会读取 pyvenv.cfg 并设置正确 prefix/site-packages。脚本的绝对 shebang 也可直接选择该解释器。
