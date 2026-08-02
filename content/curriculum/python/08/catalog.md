---
track: "python"
id: "python-08"
order: 8
title: "08 · CPython 执行链与扩展"
goal: "沿源码把文本、token、AST、作用域、字节码、frame、调用与特化连成一条可调试的执行链。"
lab: "构建 CPython debug 版本，跟踪一段程序从 tokenizer 到 CALL，再实现一个有测试的可观测改动。"
interview: "PEG parser 为什么需要 cut？free/cell 如何由 symbol table 决定？vectorcall 少分配了什么？"
officialScope: "https://devguide.python.org/"
sourceScope: "Parser/、Python/ast.c、Python/symtable.c、Python/compile.c、Python/ceval.c、Python/specialize.c"
planningStatus: established
---

# 08 · CPython 执行链与扩展

## python-08-01
title: "源码工作台：仓库地图、debug 构建、测试定位与版本固定"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "编译配置、生成文件、测试分层和可复现源码定位决定后续阅读是否可靠。"
learningValue: "工程必修"
learningValueScore: 5
estimatedMinutes: 100
granularity: "单点精讲"

## python-08-02
title: "从文本到 AST：tokenizer、PEG parser、ASDL 与错误位置"
status: pending
owner: ""
difficulty: "专家"
difficultyReason: "编码、缩进、packrat memo、cut、AST schema 与错误恢复跨越多个前端子系统。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 120
granularity: "合并讲解"

## python-08-03
title: "从名称到 code object：symbol table、scope、basic block、jump fixup 与异常表"
status: pending
owner: ""
difficulty: "专家"
difficultyReason: "local/free/cell 分类会改变编译单元、CFG、指令和异常控制流的生成。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 130
granularity: "合并讲解"

## python-08-04
title: "执行一条调用：interpreter frame、dispatch、eval breaker 与 vectorcall"
status: pending
owner: ""
difficulty: "专家"
difficultyReason: "帧状态、字节码分派、异步中断和参数数组调用要在一个真实调用链中关联。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 130
granularity: "合并讲解"

## python-08-05
title: "自适应解释器：inline cache、specialization、guard、deopt 与基准证据"
status: pending
owner: ""
difficulty: "专家"
difficultyReason: "特化计数、缓存 guard、回退和微基准偏差必须同时验证，不能只看 dis 输出。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 120
granularity: "拆分专题"

## python-08-06
title: "端到端源码改造：加一项可观测性、写回归测试并解释兼容边界"
status: pending
owner: ""
difficulty: "专家"
difficultyReason: "需要跨构建、C API、测试、性能和行为兼容性完成可回退的上游式改动。"
learningValue: "综合实战"
learningValueScore: 5
estimatedMinutes: 150
granularity: "拆分专题"
