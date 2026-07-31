---
id: "python-06-11"
track: "python"
title: "pyproject、build frontend/backend 与 wheel"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-06-11.md"
---

## 官方入口

title: "PyPA · The Packaging Flow"
url: "https://packaging.python.org/en/latest/flow/"

build frontend 读取 pyproject 的 build-system，在隔离环境调用声明的 backend hooks 生成 sdist/wheel；installer 选择兼容 wheel 并安装。

## 导读

pyproject.toml 的 [build-system] 声明构建 backend 与构建依赖，[project] 提供标准核心元数据。pip/build 属于 frontend：创建隔离构建环境、安装 build-system.requires、调用 backend hook，而非假设项目必须使用 setuptools。

sdist 是可重新构建的源码分发，wheel 是已构建安装归档。wheel 文件名标签描述 Python implementation、ABI 与 platform；纯 Python 常为 py3-none-any，含扩展的 wheel 只在匹配环境可安装。

构建隔离解决“构建工具依赖污染用户环境”，却不自动保证可重复：动态版本、网络下载、未固定编译器和时间戳仍会改变产物。课程实践要检查 wheel 内容、METADATA、RECORD 与导入名/发行名差异。

## 核心机制

- frontend 调 get_requires_for_build_*、prepare_metadata_for_build_wheel、build_wheel 等 hooks。
- distribution name 用于索引安装，import package name 可以不同。
- wheel 安装主要解包文件并按 .data scheme 放置，同时验证 RECORD。
- src layout 减少在仓库根目录意外导入未安装源码的问题。

## 常见误区

- 运行 python setup.py bdist_wheel，绕开标准 frontend 与隔离。
- 只测试仓库根目录 import，发布 wheel 缺包仍未发现。
- 把运行依赖放进 build-system.requires，或反过来遗漏构建插件。

## 可运行示例

```python
# pyproject.toml
[build-system]
requires = ["hatchling>=1.27"]
build-backend = "hatchling.build"

[project]
name = "review-lab-example"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = ["typing-extensions>=4.12"]

[tool.hatch.build.targets.wheel]
packages = ["src/review_lab_example"]

# 构建与验收：
# python -m build
# python -m zipfile -l dist/*.whl
# 在全新 venv 中 python -m pip install dist/*.whl，再从仓库外 import。
```

## 搭积木复现

### 实现 mini frontend

解析 build-system，创建隔离环境并通过 subprocess 调用 backend build_wheel，记录 hook 输入输出。

### 审计 wheel

把 wheel 当 zip 检查 package、dist-info/METADATA、WHEEL tags、RECORD 哈希。

### 做安装态测试

从空 venv、仓库目录之外安装 wheel，运行 import、CLI 和资源读取 smoke test。

## 自检

### 问题

为什么 pyproject.toml 中要区分 build frontend 与 build backend？

### 站内答案

frontend 负责通用流程，如隔离环境、依赖安装、产物管理和用户界面；backend 负责项目如何从源码生成元数据与 wheel。协议分离让 pip/build 能驱动 setuptools、hatchling、flit 等实现，也让构建依赖不污染运行环境。
