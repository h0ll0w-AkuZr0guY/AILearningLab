# 优质课程参考集

公共模板规定最低结构，下面三节课展示不同类型的高质量成品。贡献者和 AI 在扩写前应至少精读一节与目标课相近的参考课，学习论证方式和证据密度，不照抄措辞。

## 源码驱动的运行时课程

[`content/curriculum/langgraph/01/lessons/langgraph-01-03.md`](../content/curriculum/langgraph/01/lessons/langgraph-01-03.md)

`Pregel super-step：Plan、Execute、Update 与 BSP barrier` 展示如何从调度现象进入 BSP 模型，再沿真实 runtime 源码解释 barrier、pending writes、interrupt 和恢复边界。适合作为框架运行时、状态机、调度器课程的参照。

## 内存与所有权课程

[`content/curriculum/torch/01/lessons/torch-01-05.md`](../content/curriculum/torch/01/lessons/torch-01-05.md)

`view、reshape 与 flatten：零拷贝兼容条件和复制回退` 把 shape 相同但所有权不同的问题落到 stride、Storage identity、源码分派与可运行断言。适合作为张量、数据库 buffer、零拷贝和生命周期课程的参照。

## 规范与实现共同约束的语言课程

[`content/curriculum/typescript/01/lessons/typescript-01-11.md`](../content/curriculum/typescript/01/lessons/typescript-01-11.md)

`ESM 实例化、Module Environment 与 live binding` 同时连接 ECMAScript 规范、引擎实现、循环依赖和可运行模块实验。适合作为语言规范、编译器、模块系统和跨运行时兼容课程的参照。

## 阅读参考课时要提取什么

- 本课从哪个可观察问题进入，而非从哪个名词进入。
- 官方文档与源码分别承担什么证据职责。
- 章节如何逐步增加变量，避免一次灌入全部概念。
- 教学实现删掉了哪些生产分支，删减理由是否透明。
- 示例怎样证明所有权、状态、失败或复杂度，而非只打印结果。
- 自检答案能否脱离外部文档复述完整机制。
