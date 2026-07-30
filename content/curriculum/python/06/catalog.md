---
track: "python"
id: "python-06"
order: 6
title: "06 · 导入、包与运行环境"
goal: "追踪 import 从 finder 到 loader 的完整解析路径。"
lab: "写一个内存模块 finder，并审计循环导入。"
interview: "为什么 import 缓存会改变 monkey patch 的可见性？"
officialScope: "https://docs.python.org/3/"
sourceScope: "Lib/importlib 与 Python/import.c"
planningStatus: established
---

# 06 · 导入、包与运行环境

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

## python-06-01

title: "import 语句、模块对象与名称绑定"
status: curated
owner: ""
difficulty: "中等"
difficultyReason: "需区分查找加载模块与把顶层包/目标属性绑定进当前命名空间两个阶段，常见语法可合并实验。"
learningValue: "基础必修"
learningValueScore: 5
estimatedMinutes: 55
granularity: "合并基础课"

## python-06-02

title: "sys.modules 缓存、预插入与失败回滚"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "模块在执行前写入缓存以打破递归，失败又必须精确删除本次条目；这是循环导入和单例身份的核心不变量。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 105
granularity: "拆分专题"

## python-06-03

title: "sys.meta_path 与 MetaPathFinder"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "要处理顶层/子模块 path 参数、finder 优先级、缓存失效与返回 None/抛错的协议差异。"
learningValue: "进阶关键"
learningValueScore: 4
estimatedMinutes: 80
granularity: "单点精讲"

## python-06-04

title: "PathFinder、sys.path_hooks 与 importer cache"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "包含三层缓存与两级 finder；需要从路径条目到 FileFinder suffix loader 逐步复现。"
learningValue: "进阶关键"
learningValueScore: 4
estimatedMinutes: 110
granularity: "拆分专题"

## python-06-05

title: "ModuleSpec、create_module 与 exec_module"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "finder 与 loader 通过 spec 传递状态，加载器还需遵守创建、预缓存、执行、失败清理和包属性初始化顺序。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 115
granularity: "拆分专题"

## python-06-06

title: "普通包、__path__ 与 namespace package"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "要区分 __init__.py 包、动态子模块搜索位置和跨多个目录聚合的 namespace package。"
learningValue: "高频核心"
learningValueScore: 4
estimatedMinutes: 80
granularity: "单点精讲"

## python-06-07

title: "绝对/相对导入、__package__ 与 __main__"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "相对点数依赖 package 上下文，直接脚本与 python -m 对 __spec__/__package__ 的初始化不同。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 75
granularity: "单点精讲"

## python-06-08

title: "循环导入、半初始化模块与依赖方向"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "需按执行时间线分析缓存中存在但属性尚未绑定的模块，并从架构上消除初始化期双向依赖。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 105
granularity: "拆分专题"

## python-06-09

title: "reload、from-import 快照与 monkey patch 可见性"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "reload 复用模块字典而外部引用不自动重绑，旧实例、旧类和 from-import 名称形成多版本对象图。"
learningValue: "进阶关键"
learningValueScore: 4
estimatedMinutes: 85
granularity: "单点精讲"

## python-06-10

title: "venv、site、sys.path 初始化与可重建环境"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "要连接解释器前缀、pyvenv.cfg、site-packages、.pth、PATH 激活与环境不可搬迁性。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 80
granularity: "单点精讲"

## python-06-11

title: "pyproject、build frontend/backend 与 wheel"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "构建隔离、backend hook、核心元数据、sdist/wheel 标签和安装期解包属于独立发布协议。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 90
granularity: "单点精讲"
