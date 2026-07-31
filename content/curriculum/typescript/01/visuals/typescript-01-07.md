---
lesson: "typescript-01-07"
track: "typescript"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 逐帧对比「prototype、new、class fields 与 private brand」的状态边界

id: "typescript-01-07-main"
kind: "state"
placement: "chapter:2"
summary: "class 不是与 prototype 无关的第二套对象模型。每次 class 定义求值会创建 constructor function 和 prototype object，把实例方法定义在 prototype 上，把静态方法定义在 constructor 上；extends 又同时连接两条链：Child.prototype 的 [[Prototype]] 指向 Parent.prototype，而 Child 自身的 [[Proto"
caption: "左右状态卡只压缩本课的前态、现态与不变量；对象身份、生命周期或队列结论仍要用正文中的代码和源码分支验证。"
actionLabel: "播放状态变化"

#### 步骤

- ClassDefinitionEva | ClassDefinitionEvaluation 同时创建 constructor、prototype、private environment 与字段初始化记录。
- extends 设置 Child→P | extends 设置 Child→Parent 的静态原型链和 Child.prototype→Parent.prototype 的实例原型链。
- OrdinaryConstruct  | OrdinaryConstruct 以 NewTarget 选择实例 prototype，并在正确阶段调用 InitializeInstanceElements。
- 公开 field 经 DefineF | 公开 field 经 DefineField 创建自有数据属性，不触发继承链上的同名 setter。
- Private Name 按 cla | Private Name 按 class evaluation 身份区分，PrivateGet/Set 或 brand check 验证 receiver 已经过对应初始化。

#### 观察重点

- 把 class 视为纯语法糖并用 function/prototype 转写证明完全等价，遗漏 strict、TDZ、字段和私有名称。
- 只画 Child.prototype→Parent.prototype，忘记 Child→Parent 的静态继承链。
