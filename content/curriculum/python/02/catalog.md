---
track: "python"
id: "python-02"
order: 2
title: "02 · 属性、描述符与继承"
goal: "把一次属性读取还原为实例、类、descriptor 和 MRO 的确定性解析链。"
lab: "实现极简 object.__getattribute__ 模型，注入 data descriptor、绑定方法与菱形继承失败。"
interview: "为什么 property 会覆盖实例字段？super 为什么不是父类？__slots__ 如何改变属性所有权？"
officialScope: "https://docs.python.org/3.14/reference/datamodel.html#customizing-attribute-access"
sourceScope: "Objects/object.c、Objects/typeobject.c、Objects/descrobject.c"
planningStatus: established
---

# 02 · 属性、描述符与继承

## python-02-01
title: "属性读取主路径：实例、类、__getattribute__ 与 __getattr__"
status: curated
difficulty: "专家"
difficultyReason: "同一读取要跨实例字典、类字典、MRO 与两个钩子的失败回退。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 100
granularity: "拆分专题"

## python-02-02
title: "Descriptor 优先级：data、non-data 与 property 的遮蔽规则"
status: curated
difficulty: "专家"
difficultyReason: "必须从 __get__/__set__ 的存在性推导优先级，并复现实例字段看似失效的原因。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 100
granularity: "拆分专题"

## python-02-03
title: "函数绑定：method、classmethod、staticmethod 与 __set_name__"
status: curated
difficulty: "困难"
difficultyReason: "函数对象自身是 descriptor，绑定接收者与声明时字段收集属于两段不同生命周期。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 90
granularity: "合并讲解"

## python-02-04
title: "C3 MRO 与 super：协作继承的线性化和一次调用合同"
status: curated
difficulty: "专家"
difficultyReason: "要手算 C3 merge、识别不可线性化图，并解释 super 的动态起点而非静态父类。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 110
granularity: "拆分专题"

## python-02-05
title: "对象形状演化：__slots__、weakref、copy 与生命周期边界"
status: curated
difficulty: "专家"
difficultyReason: "slots 布局、弱所有权、浅深拷贝对象图和 finalization 共同决定 API 的演化风险。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 110
granularity: "合并讲解"
