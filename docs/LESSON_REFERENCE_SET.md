# 优质课程参考集

公共模板规定最低结构，下面四节课展示不同类型的高质量成品。贡献者和 AI 在扩写前应至少精读一节与目标课相近的参考课，学习论证方式和证据密度，不照抄措辞。

## 源码驱动的运行时课程

正文：[`langgraph-01-03.md`](../content/curriculum/langgraph/01/lessons/langgraph-01-03.md)<br>
视觉索引：[`visuals/langgraph-01-03.md`](../content/curriculum/langgraph/01/visuals/langgraph-01-03.md)

`Pregel super-step：Plan、Execute、Update 与 BSP barrier` 展示如何从调度现象进入 BSP 模型，再沿真实 runtime 源码解释 barrier、pending writes、interrupt 和恢复边界。适合作为框架运行时、状态机、调度器课程的参照。

它的 `graph` 视觉实验把 super-step 切成可点击节点，适合作为图拓扑和消息流课程的视觉参考。

## 内存与所有权课程

正文：[`torch-01-05.md`](../content/curriculum/torch/01/lessons/torch-01-05.md)<br>
视觉索引：[`visuals/torch-01-05.md`](../content/curriculum/torch/01/visuals/torch-01-05.md)

`view、reshape 与 flatten：零拷贝兼容条件和复制回退` 把 shape 相同但所有权不同的问题落到 stride、Storage identity、源码分派与可运行断言。适合作为张量、数据库 buffer、零拷贝和生命周期课程的参照。

它的 `flow` 视觉实验沿 `infer_size → computeStride → alias/copy` 推演，并要求继续用 `data_ptr`、stride 和断言验证，适合作为“图示不替代数值证据”的参考。

## 规范与实现共同约束的语言课程

[`content/curriculum/typescript/01/lessons/typescript-01-11.md`](../content/curriculum/typescript/01/lessons/typescript-01-11.md)

`ESM 实例化、Module Environment 与 live binding` 同时连接 ECMAScript 规范、引擎实现、循环依赖和可运行模块实验。适合作为语言规范、编译器、模块系统和跨运行时兼容课程的参照。

TypeScript 的专属交互参考另见正文 [`typescript-01-10.md`](../content/curriculum/typescript/01/lessons/typescript-01-10.md)、[视觉索引](../content/curriculum/typescript/01/visuals/typescript-01-10.md)和[独立 Vue 组件](../app/components/lesson-visuals/typescript-01-10/event-loop-queues.vue)：它用 playground 展示 task、microtask、渲染机会和 TS/JS 切换。

Python 的机制可视化参考：

- descriptor 优先级：[正文](../content/curriculum/python/02/lessons/python-02-04.md)、[视觉索引](../content/curriculum/python/02/visuals/python-02-04.md)、[独立 Vue 组件](../app/components/lesson-visuals/python-02-04/descriptor-priority.vue)。
- try 控制流矩阵：[正文](../content/curriculum/python/05/lessons/python-05-05.md)、[视觉索引](../content/curriculum/python/05/visuals/python-05-05.md)、[独立 Vue 组件](../app/components/lesson-visuals/python-05-05/try-flow-matrix.vue)。
- asyncio 单轮调度：[正文](../content/curriculum/python/08/lessons/python-08-01.md)、[视觉索引](../content/curriculum/python/08/visuals/python-08-01.md)、[独立 Vue 组件](../app/components/lesson-visuals/python-08-01/event-loop-turn.vue)。

三者分别展示查找优先级、控制流分支和队列轮次。贡献者可以复用无课程文案的交互原语，但课程状态、证据说明与组件路径仍按 lesson-id 隔离。

## ImageGen 概念类比参考

正文：[`transformer-01-07.md`](../content/curriculum/transformer/01/lessons/transformer-01-07.md)<br>
视觉索引：[`visuals/transformer-01-07.md`](../content/curriculum/transformer/01/visuals/transformer-01-07.md)

`softmax 性质` 同时提供确定性的张量步骤和一张 ImageGen 类比图。图片 caption 明确声明光束只表示相对权重与总量约束，公式和数值稳定性仍由可运行实验负责。

## 阅读参考课时要提取什么

- 本课从哪个可观察问题进入，而非从哪个名词进入。
- 官方文档与源码分别承担什么证据职责。
- 章节如何逐步增加变量，避免一次灌入全部概念。
- 教学实现删掉了哪些生产分支，删减理由是否透明。
- 示例怎样证明所有权、状态、失败或复杂度，而非只打印结果。
- 自检答案能否脱离外部文档复述完整机制。
- 视觉实验解决了哪一个“读完仍看不见”的变化，状态能否被代码验证。
- 若使用 ImageGen，caption 是否明确区分概念类比与真实执行证据。
