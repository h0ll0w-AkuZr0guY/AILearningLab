---
track: "python"
id: "python-03"
order: 3
title: "03 · 函数、作用域与生成器"
goal: "把函数看作带 code、环境与调用合同的对象，并能解释暂停、恢复和委派。"
lab: "用 inspect、dis 与可运行生成器实现观察 closure、参数绑定、装饰器和 yield from。"
interview: "late binding 如何发生？装饰器为何破坏签名？生成器 send 的第一次调用为何受限？"
officialScope: "https://docs.python.org/3.14/reference/executionmodel.html#resolution-of-names"
sourceScope: "Objects/funcobject.c、Objects/frameobject.c、Objects/genobject.c、Python/ceval.c"
planningStatus: established
---

# 03 · 函数、作用域与生成器

## python-03-01
title: "函数对象与执行环境：code、globals、defaults、frame 与局部变量"
status: pending
owner: ""
difficulty: "专家"
difficultyReason: "函数定义时环境、调用时 frame、默认值和局部变量同步处在不同时间点。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 110
granularity: "合并讲解"

## python-03-02
title: "闭包与参数绑定：cell、freevar、late binding 与调用签名"
status: pending
owner: ""
difficulty: "专家"
difficultyReason: "名称解析层级、cell 共享、默认参数快照和 positional/keyword 绑定需要同时推演。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 110
granularity: "合并讲解"

## python-03-03
title: "装饰器合同：求值顺序、带参工厂、__wrapped__ 与签名保真"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "装饰发生在定义期，调用发生在运行期；透明包装还要维护 introspection 边界。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 90
granularity: "单点精讲"

## python-03-04
title: "迭代与生成器：惰性启动、StopIteration、send、throw 与 close"
status: pending
owner: ""
difficulty: "专家"
difficultyReason: "迭代协议、暂停帧、PEP 479、异常注入和 GeneratorExit 形成完整状态机。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 120
granularity: "合并讲解"

## python-03-05
title: "委派与资源作用域：yield from、contextmanager 与返回值通道"
status: pending
owner: ""
difficulty: "专家"
difficultyReason: "委派会转交 send/throw/close，contextmanager 又把异常送回 yield 点，失败路径不可拆开。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 110
granularity: "合并讲解"
