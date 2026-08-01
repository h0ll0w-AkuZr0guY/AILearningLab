---
track: "typescript"
id: "typescript-12"
order: 12
title: "12 · 手撸 mini-checker：从类型系统到可运行的静态分析器"
goal: "用前 11 个模块学到的类型系统知识，实现一个能检查类型不匹配、属性不存在、函数参数数量错误的 mini TypeScript checker。"
lab: "实现三阶段：类型表示（Type AST）→ 类型检查（assign/unify/narrow）→ 错误报告。"
interview: "如果让你设计一个最简 TypeScript checker，核心数据结构和算法是什么？"
officialScope: "https://github.com/microsoft/TypeScript/tree/main/src/compiler/checker.ts"
sourceScope: "src/compiler/checker.ts"
planningStatus: draft
---

# 12 · 手撸 mini-checker

> 本模块是 TypeScript 路线的终极实践：把类型系统知识（结构类型、泛型、控制流窄化、条件类型）变成可运行的代码。Mindset 从「我怎么用 TS」切换到「TS checker 怎么实现」。

## typescript-12-01

title: "mini-checker 的 Type AST：如何表示 number/string/union/object/function 类型"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "树形数据结构的类型表示是静态分析器的第一块积木；概念直接，实现需要细心。"
learningValue: "基础必修"
learningValueScore: 5
estimatedMinutes: 60
granularity: "单点精讲"

## typescript-12-02

title: "mini-checker 的类型兼容性检查：从结构类型到函数参数逆变"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "需要实现 isAssignableTo/checkType 递归算法，处理 union/intersection/函数、并正确实现参数逆变。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 90
granularity: "单点精讲"

## typescript-12-03

title: "mini-checker 的窄化引擎：truthiness/typeof/instanceof 与控制流事实积累"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "沿控制流积累类型事实并在每个分支点窄化变量类型；事实如何在 join 点合并是难点。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 90
granularity: "单点精讲"

## typescript-12-04

title: "mini-checker 的泛型推断：从调用点收集约束到代入求解"
status: pending
owner: ""
difficulty: "专家"
difficultyReason: "需要在调用点从实参类型推断泛型参数的具体类型，并处理默认值、约束上限和多参数场景。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 100
granularity: "拆分专题"

## typescript-12-05

title: "mini-checker 的错误报告与诊断：精确定位源码位置并给出可操作信息"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "从 AST 节点回溯源码位置、格式化类型为可读字符串、组织错误信息：技术不深但对用户体验至关重要。"
learningValue: "基础必修"
learningValueScore: 4
estimatedMinutes: 60
granularity: "单点精讲"

## typescript-12-06

title: "mini-checker 的全体组装：从 parse→check→report 的完整管线"
status: pending
owner: ""
difficulty: "专家"
difficultyReason: "把前五课的积木（Type AST/类型检查/窄化/泛型/错误）串成一条命令就能启动的管线，并验证其正确性。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 120
granularity: "拆分专题"
