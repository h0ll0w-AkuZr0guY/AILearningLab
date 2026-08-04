---
lesson: "typescript-12-02"
track: "typescript"
decision: "文字能解释结构兼容和函数参数逆变，却难以同时看见 source/target 方向、失败成员与函数参数反向检查；静止 flow 把同一 relation engine 的成功与失败路径并排展开。"
---

## 视觉实验

### 让 source type 穿过 assignability relation

id: "typescript-12-02-main"
kind: "flow"
placement: "chapter:2"
summary: "观察对象关系如何从 target 的需求成员开始，如何在缺失成员处失败，以及函数签名为什么对参数和返回值采用不同方向。"
caption: "source 是被检查的实际能力，target 是需要满足的合同；函数参数方向来自调用方可能传入的值。flow 只实现课程子集，any、重载、method bivariance 与 relation cache 需回到 v5.9.3 checker 核对。"
actionLabel: "推进类型关系判定"

#### 步骤

- 输入 | source=`Dog{name,bark}`、target=`Animal{name}`，关系检查保存 source/target 方向。
- 成功 | target 只读取 `name`，source 含有该成员，成员递归检查通过。
- 失败 | target 改为 `Labeled{name,id}`，relation 沿 `id` 记录失败位置，而不是只返回一个无上下文的 false。
- 函数参数 | source=`(Dog)=>void`、target=`(Animal)=>void` 时参数反向检查，拒绝窄函数接收任意 Animal 的调用风险。
- 返回值 | 返回值按正向关系检查；同一签名可能出现“参数失败、返回值尚未检查”的短路路径。

#### 观察重点

- 预测任务：对象关系先问“target 要什么”，函数参数则问“调用方可能给什么”。
- 证据任务：运行 `examples/typescript/typescript-12-02.mjs`，观察严格参数方向的失败断言；把参数方向改成正向会暴露缺少 `bark` 的运行时风险。

#### 交互边界

- 默认静止，单步、暂停、重置和按钮键盘语义由通用渲染器提供；当前阶段同时用文字和路径表达，不能只靠颜色。
- 窄屏保持失败路径和控制按钮可见，`prefers-reduced-motion` 下不自动移动。
