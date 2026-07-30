---
track: "python"
id: "python-07"
order: 7
title: "07 · 类型系统与 API 设计"
goal: "把注解、泛型、协议、variance 当作静态契约而非运行时魔法。"
lab: "为事件总线和 repository 定义可推断的泛型 API。"
interview: "Protocol 与 ABC 的适用边界是什么？"
officialScope: "https://docs.python.org/3/"
sourceScope: "Lib/typing.py"
planningStatus: established
---

# 07 · 类型系统与 API 设计

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

## python-07-01

title: "注解求值：3.14 lazy scopes、annotationlib 与 future"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "Python 3.14 默认惰性求值改变了定义期/读取期边界，还需兼容 future 字符串化与运行时反射工具。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 110
granularity: "拆分专题"

## python-07-02

title: "TypeVar：约束、bound、default 与解算结果"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "约束集合会提升到候选成员，bound 保留最具体子类型，default 只在无法推断时参与；三者不能混用同一心智模型。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 85
granularity: "单点精讲"

## python-07-03

title: "泛型函数推断、overload 与实现签名"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "涉及多参数候选收集、约束求解、overload 首个匹配、Any/Union 回退与实现签名不可见边界。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 110
granularity: "拆分专题"

## python-07-04

title: "Protocol 结构子类型与 runtime_checkable 边界"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "静态成员合同与运行时仅检查属性存在完全不同，data protocol、泛型方差和可变成员还会影响兼容性。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 90
granularity: "单点精讲"

## python-07-05

title: "ABC 名义子类型、register 与 __subclasshook__"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "继承、虚拟注册和自定义结构判定共同影响 issubclass，但 register 不注入实现也不改变 MRO。"
learningValue: "进阶关键"
learningValueScore: 4
estimatedMinutes: 80
granularity: "单点精讲"

## python-07-06

title: "协变、逆变、不变与可变性证明"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "必须用读写位置和替换原则证明安全性，Python 3.12+ 还会按类型参数用途推断类的方差。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 115
granularity: "拆分专题"

## python-07-07

title: "ParamSpec、Concatenate 与装饰器签名"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "参数列表包含位置/关键字结构，ParamSpec 负责整体转发，Concatenate 只能表达前缀变换且有严格位置限制。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 85
granularity: "单点精讲"

## python-07-08

title: "TypedDict：Required、NotRequired、ReadOnly 与演进"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "它约束 dict 的静态键集合，total 与单键必需性、只读项、结构兼容和运行时无验证需要联合设计。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 80
granularity: "单点精讲"

## python-07-09

title: "TypeGuard、TypeIs 与双分支收窄"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "用户谓词可承诺超出实现真实能力；TypeIs 要求结果与输入兼容并收窄两侧，TypeGuard 主要收窄真分支。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 80
granularity: "单点精讲"

## python-07-10

title: "mypy、pyright 差异与类型回归测试"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "类型规范允许实现差异，版本、配置、typeshed 与插件都会改变诊断；公共 API 需以多 checker 样例做兼容门。"
learningValue: "进阶关键"
learningValueScore: 4
estimatedMinutes: 90
granularity: "单点精讲"
