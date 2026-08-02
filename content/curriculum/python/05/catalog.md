---
track: "python"
id: "python-05"
order: 5
title: "05 · 导入、类型与发布"
goal: "从 import 的缓存与 loader 走到注解、静态契约和可重建的包发布边界。"
lab: "实现最小 finder/loader，复现循环导入；为一个公共 API 写 Protocol、泛型和类型回归测试。"
interview: "为什么循环导入能看到半初始化模块？Protocol 和 ABC 怎样选择？注解会在何时求值？"
officialScope: "https://docs.python.org/3.14/reference/import.html#importsystem"
sourceScope: "Lib/importlib/_bootstrap.py、Python/import.c、Lib/typing.py、Lib/annotationlib.py"
planningStatus: established
---

# 05 · 导入、类型与发布

## python-05-01
title: "import 主路径：ModuleSpec、finder、loader、sys.modules 与失败回滚"
status: pending
owner: ""
difficulty: "专家"
difficultyReason: "模块缓存预插入、create/exec 分离、失败删除与名称绑定必须按顺序推演。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 120
granularity: "拆分专题"

## python-05-02
title: "包边界：__main__、相对导入、namespace package 与循环依赖方向"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "运行入口、__package__、多路径包与半初始化可见性共同决定可部署性。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 100
granularity: "合并讲解"

## python-05-03
title: "可重建发布：venv、pyproject、build backend、wheel 与依赖隔离"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "构建环境、运行环境、元数据与 wheel 安装顺序是不同层的可复现合同。"
learningValue: "工程必修"
learningValueScore: 5
estimatedMinutes: 100
granularity: "合并讲解"

## python-05-04
title: "注解与泛型：lazy annotations、TypeVar、ParamSpec 与类型推断边界"
status: pending
owner: ""
difficulty: "专家"
difficultyReason: "运行时延迟求值、静态替换、装饰器参数转发和 checker 推断不能混为一层。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 120
granularity: "合并讲解"

## python-05-05
title: "结构化 API 契约：Protocol、TypedDict、variance、TypeIs 与类型回归"
status: pending
owner: ""
difficulty: "专家"
difficultyReason: "结构子类型、可变性证明、数据 schema 演进和双分支收窄需要同时验证。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 120
granularity: "合并讲解"
