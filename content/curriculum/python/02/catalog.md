---
track: "python"
id: "python-02"
order: 2
title: "02 · 属性、协议与 MRO"
goal: "把所有属性访问还原为查找顺序、descriptor 和绑定语义。"
lab: "实现 property、cached_property 与一个迷你 ORM 字段。"
interview: "data descriptor 为什么能压过实例字典？"
officialScope: "https://docs.python.org/3/"
sourceScope: "Objects/typeobject.c"
planningStatus: established
---

# 02 · 属性、协议与 MRO

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

## python-02-01

title: "实例字典、类字典与查找入口"
status: curated
owner: ""
difficulty: "简单"
difficultyReason: "三个概念共享同一条命名空间查找链，适合通过一次 shadowing 实验合并掌握。"
learningValue: "基础必修"
learningValueScore: 5
estimatedMinutes: 35
granularity: "合并基础课"

## python-02-02

title: "object.__getattribute__ 完整查找链"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "必须串联 MRO 查找、descriptor 类型判定、实例字典、类变量和 AttributeError，适合拆成多步复现。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 100
granularity: "拆分专题"

## python-02-03

title: "__getattr__ 兜底与递归陷阱"
status: curated
owner: ""
difficulty: "中等"
difficultyReason: "入口简单，但要准确区分正常查找失败后的钩子、直接调用差异与递归边界。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 50
granularity: "单点精讲"

## python-02-04

title: "data 与 non-data descriptor 优先级"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "优先级取决于 descriptor 类型是否定义 __set__/__delete__，并与实例同名字段产生反直觉覆盖。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 75
granularity: "单点精讲"

## python-02-05

title: "函数 descriptor、绑定方法与 self 注入"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "需要从 function.__get__ 解释 MethodType 的临时创建、类访问和实例访问差异。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 75
granularity: "单点精讲"

## python-02-06

title: "classmethod 与 staticmethod descriptor"
status: curated
owner: ""
difficulty: "中等"
difficultyReason: "两者都包装函数并改变 __get__ 返回值，适合在同一张绑定矩阵中比较。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 45
granularity: "合并基础课"

## python-02-07

title: "C3 线性化手算与冲突检测"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "需要实现 merge、维护局部优先级和单调性，并解释无合法 head 时为何拒绝类定义。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 105
granularity: "拆分专题"

## python-02-08

title: "super() 与 cooperative inheritance"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "super 绑定的是当前类之后的 MRO 区间，不等于固定父类；多继承还要求统一签名和每层继续转发。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 80
granularity: "单点精讲"

## python-02-09

title: "__set_name__ 与声明式字段收集"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "要连接类体执行、type.__new__、descriptor 回调和继承时字段注册表的复制策略。"
learningValue: "进阶关键"
learningValueScore: 4
estimatedMinutes: 75
granularity: "单点精讲"
