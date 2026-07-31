---
lesson: "typescript-01-04"
track: "typescript"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 沿时间线推演「执行上下文、Environment Record、TDZ 与 hoisting」

id: "typescript-01-04-main"
kind: "flow"
placement: "chapter:3"
summary: "“var 会提升，let 不提升”会让人误以为引擎把文本搬到文件顶部。更准确的过程是：代码真正逐句求值前，声明实例化算法先收集声明并建立 binding。var binding 通常立即初始化为 undefined，函数声明可直接初始化为函数对象；let/const/class binding 也已经创建，却保持 uninitialized，直到执行到声明的 BindingInitialization。所谓 TDZ 就是从作用域开始到初"
caption: "箭头表达本课讨论的因果与执行顺序，不承诺真实墙钟时长；并行、失败和回退分支仍以源码与可运行实验为准。"
actionLabel: "播放执行流程"

#### 步骤

- 解析产生声明集合与 scope 信息 | 解析产生声明集合与 scope 信息；对应 declaration instantiation 在求值前创建并检查 binding。
- ResolveBinding 沿 L | ResolveBinding 沿 LexicalEnvironment 的 [[OuterEnv]] 调用 HasBinding，命中后 Reference/GetValue 读取具体 binding。
- lexical binding 经  | lexical binding 经 Create→Initialize→Get/Set 生命周期；TDZ 是命中 uninitialized binding 时的 ReferenceError。
- var/function/lexic | var/function/lexical/import 按 Script、Function、Block、Module 与 Global Environment 的不同算法实例化。
- execution context  | execution context 保存求值状态与环境指针；函数调用、generator 挂起和 async job 会 push、suspend、resume。

#### 观察重点

- 把 hoisting 解释成源代码移动，无法回答 initializer、副作用和同名冲突的真实顺序。
- 说“let 不提升”，却解释不了声明前为何遮蔽外层同名 binding 并触发 TDZ。
