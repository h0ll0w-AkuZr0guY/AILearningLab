---
lesson: "typescript-01-02"
track: "typescript"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 逐帧对比「Property Key、Descriptor、内部方法与对象形状」的状态边界

id: "typescript-01-02-main"
kind: "state"
placement: "chapter:2"
summary: "JavaScript 对象可先理解成“Property Key 到 property record 的映射”，但 property record 不只保存值。数据属性还保存 writable、enumerable、configurable；访问器属性保存 get、set、enumerable、configurable。obj.x = 1、Object.defineProperty、对象字面量、class field 看起来都在“加属性”"
caption: "左右状态卡只压缩本课的前态、现态与不变量；对象身份、生命周期或队列结论仍要用正文中的代码和源码分支验证。"
actionLabel: "播放状态变化"

#### 步骤

- 属性语法先把输入转换为 String | 属性语法先把输入转换为 String/Symbol Property Key，再选择 [[Get]]、[[Set]]、[[DefineOwnProperty]] 等内部方法。
- 内部方法读取 own descrip | 内部方法读取 own descriptor、原型与 receiver；普通对象和 exotic object 可使用不同算法。
- ValidateAndApplyPr | ValidateAndApplyPropertyDescriptor 把 extensible、current descriptor 与 requested descriptor 组合成合法或失败的状态迁移。
- V8 用 Map/Descripto | V8 用 Map/DescriptorArray 表示常见 named property 形状，用 elements store 处理整数索引，并在动态变化时选择 dictionary。
- 优化器以 Map check 等运行 | 优化器以 Map check 等运行时证据加速固定 offset 访问；TypeScript 静态结构类型不直接决定引擎形状。

#### 观察重点

- 认为 Object.defineProperty 省略 attributes 等同于对象字面量默认值；实际新属性缺省为 false。
- 把 Property Descriptor 的字段缺席与字段值 undefined 混为一谈，导致 data/accessor 分类或更新语义错误。
