---
track: "typescript"
id: "typescript-01"
order: 1
title: "01 · JavaScript 运行时地基"
goal: "先掌握 ECMAScript 的值、引用、环境记录、对象内部方法和 Job，再讨论 TypeScript 能证明什么。"
lab: "写出一组对象、闭包、this、Promise 与模块的可运行反例，并用规范算法解释结果。"
interview: "TS 为什么无法消除所有 JavaScript 运行时风险？"
officialScope: "https://www.typescriptlang.org/docs/"
sourceScope: "src/compiler/parser.ts"
planningStatus: established
---

# 01 · JavaScript 运行时地基

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

## typescript-01-01

title: "ECMAScript 值、规范 Reference 与相等算法"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "需要区分语言值、规范内部 Reference、对象身份以及 IsStrictlyEqual/SameValue/SameValueZero 三套算法；“变量保存引用”这句口号常制造错误模型。"
learningValue: "基础必修"
learningValueScore: 5
estimatedMinutes: 90
granularity: "单点精讲"

## typescript-01-02

title: "Property Key、Descriptor、内部方法与对象形状"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "属性访问连接 ToPropertyKey、data/accessor descriptor、[[Get]]/[[Set]]、Receiver、原型链与引擎 hidden class/inline cache，多层边界必须拆开。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 135
granularity: "拆分专题"

## typescript-01-03

title: "可达性 GC、WeakRef 与 FinalizationRegistry"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "语言只约束可观察 liveness，具体引擎使用分代、增量、并发等策略；弱引用与终结注册还涉及不可预测时机和同一 job 内存活保证。"
learningValue: "进阶关键"
learningValueScore: 4
estimatedMinutes: 135
granularity: "拆分专题"

## typescript-01-04

title: "执行上下文、Environment Record、TDZ 与 hoisting"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "需要从声明实例化、Lexical/Variable Environment、binding 创建与初始化解释 var/let/const/function 的差异，不能用“代码搬到顶部”代替。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 145
granularity: "拆分专题"

## typescript-01-05

title: "闭包、捕获绑定与 per-iteration environment"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "闭包捕获 Environment Record 中的 binding，不是值快照；for let 每轮新 binding、for var 共享 binding 和异步回调共同形成高频反例。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 100
granularity: "单点精讲"

## typescript-01-06

title: "this、arrow、call/apply/bind、new 与 super"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "this 来自 Reference 调用、显式绑定、构造调用或 lexical 捕获；bound function、derived constructor 与 super 又引入 NewTarget/HomeObject。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 145
granularity: "拆分专题"

## typescript-01-07

title: "prototype、new、class fields 与 private brand"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "需要连接 [[Prototype]] 查找、constructor.prototype、OrdinaryCreateFromConstructor、class 严格模式、字段初始化次序和 #private brand 检查。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 150
granularity: "拆分专题"

## typescript-01-08

title: "getter、setter、Proxy、Reflect 与 Receiver"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "accessor 调用的 this 取决于 Receiver，Proxy trap 还必须保持目标对象不变量；错误转发会破坏继承 setter 和私有字段。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 140
granularity: "拆分专题"

## typescript-01-09

title: "Promise resolution、thenable assimilation 与 Job queue"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "Promise 状态与 fate 不同，resolve 可能跟随 thenable；reaction job、异常转拒绝、自解析保护和 job 排序需要按规范算法推演。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 150
granularity: "拆分专题"

## typescript-01-10

title: "HTML event loop：task、microtask、render 与饥饿"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "ECMAScript 只定义 Job，浏览器宿主定义 task source、microtask checkpoint 与渲染时机；无限微任务、timer 最小延迟和 Node 阶段不能混为一套口诀。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 150
granularity: "拆分专题"

## typescript-01-11

title: "ESM 实例化、Module Environment 与 live binding"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "模块先链接后求值，import binding 指向导出 binding 而非值拷贝；TDZ、静态图、namespace exotic object 和异步模块需要联动理解。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 145
granularity: "拆分专题"

## typescript-01-12

title: "循环依赖、SCC 求值与 TDZ 失败路径"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "模块图要用 DFS low-link 识别强连通分量，链接成功仍可能因求值顺序读取未初始化 binding；函数、var、let/class 的初始化时机又不同。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 155
granularity: "拆分专题"

## typescript-01-13

title: "top-level await、异步模块图与启动阻塞"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "TLA 会把同步依赖图变成带 pending async dependency、async parent 与错误传播的异步状态机，还可能形成无法自动检测的等待环。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 170
granularity: "拆分专题"

## typescript-01-14

title: "Node ESM/CJS 互操作、解析与缓存边界"
status: pending
owner: ""
difficulty: "专家"
difficultyReason: "需要同时处理 package type/exports、URL identity、同步 require 约束、CJS namespace 包装、named export 静态分析与两套 cache 的差异。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 170
granularity: "拆分专题"
