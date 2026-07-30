---
track: "python"
id: "python-10"
order: 10
title: "10 · CPython 源码阅读"
goal: "将源码输入、语法树、名称分析、控制流、字节码、frame 和调用协议连成可调试的执行链。"
lab: "在 pydebug 构建中跟踪一行 Python 从 token 到 opcode dispatch，并完成一次最小源码修改。"
interview: "解释器为什么要把“读懂代码”和“执行代码”拆成多轮中间表示？"
officialScope: "https://docs.python.org/3/"
sourceScope: "Python/bytecodes.c"
planningStatus: established
---

# 10 · CPython 源码阅读

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

## python-10-01

title: "仓库地图、pydebug 构建与测试定位"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "需要把 Grammar、Parser、Python、Objects、Include、Lib 和测试目录映射到一次可验证的源码修改，并掌握 Debug/Release 的证据边界。"
learningValue: "基础必修"
learningValueScore: 5
estimatedMinutes: 100
granularity: "单点精讲"

## python-10-02

title: "tokenizer：编码、缩进与 token 流"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "编码探测、通用换行、缩进栈、隐式续行、f-string 模式和源码位置都在词法阶段交织，适合拆成状态机复现。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 130
granularity: "拆分专题"

## python-10-03

title: "PEG parser：回溯、memo、cut 与错误规则"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "要同时理解 PEG 有序选择、packrat memoization、lookahead、cut、left recursion 以及 invalid_* 第二遍诊断，源码由 grammar 自动生成。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 145
granularity: "拆分专题"

## python-10-04

title: "ASDL、AST 节点与源码位置"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "需要连接 Parser/Python.asdl、生成的 C 结构、arena 生命周期、构造 action 与 lineno/col_offset 的 UTF-8 字节偏移。"
learningValue: "进阶关键"
learningValueScore: 4
estimatedMinutes: 100
granularity: "单点精讲"

## python-10-05

title: "symbol table：local、global、free 与 cell"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "名称分类依赖两遍分析、嵌套作用域环境传播、global/nonlocal 冲突和 class/comprehension 特例，直接决定后续 opcode。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 145
granularity: "拆分专题"

## python-10-06

title: "compiler unit、basic block 与 CFG"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "AST visitor 先发射带符号操作数的指令，再经 basic block、异常区域、栈深度与控制流优化逐步收敛，跨多个内部文件。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 150
granularity: "拆分专题"

## python-10-07

title: "assembler、jump fixup、exception table 与 code object"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "需要解决跳转偏移的变长编码固定点、line table、exception table、常量/名称索引和 PyCodeObject 不变量。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 150
granularity: "拆分专题"

## python-10-08

title: "interpreter frame、dispatch loop 与 eval breaker"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "解释器帧布局、value stack、instruction pointer、生成指令 case、异常展开、周期性事件检查和版本构建选项共同决定执行。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 160
granularity: "拆分专题"

## python-10-09

title: "vectorcall：参数数组、关键字名称与绑定"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "要从 tp_call 的 tuple/dict 物化成本走到 args 数组、nargsf 标志、kwnames、method fast path 和 Python 函数参数绑定失败矩阵。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 135
granularity: "拆分专题"

## python-10-10

title: "specialization：counter、guard、cache 与 deopt"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "自适应指令要收集类型反馈、安装 inline cache、守卫稳定假设，并在对象形状变化时退化回通用语义；实现随版本快速演进。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 155
granularity: "拆分专题"

## python-10-11

title: "端到端源码改造：新增可观测优化并回归"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "综合语法/编译/执行链、生成文件、C 调试、测试选择、性能基准和兼容性说明，要求把阅读转化为可提交的最小改动。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 210
granularity: "拆分专题"
