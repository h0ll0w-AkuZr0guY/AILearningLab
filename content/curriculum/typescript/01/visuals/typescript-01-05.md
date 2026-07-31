---
lesson: "typescript-01-05"
track: "typescript"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 逐帧对比「闭包、捕获绑定与 per-iteration environment」的状态边界

id: "typescript-01-05-main"
kind: "state"
placement: "chapter:2"
summary: "闭包不是“函数加一份变量快照”。创建普通函数对象时，规范把当时的 LexicalEnvironment 写入函数的 [[Environment]]；调用该函数时，新 Function Environment 的 [[OuterEnv]] 指向这个环境。函数体里的 Identifier 因而能沿环境链找到创建位置的 binding。若 binding 后续被修改，所有捕获它的闭包都看到新值。"
caption: "左右状态卡只压缩本课的前态、现态与不变量；对象身份、生命周期或队列结论仍要用正文中的代码和源码分支验证。"
actionLabel: "播放状态变化"

#### 步骤

- 函数创建时把当前 LexicalEn | 函数创建时把当前 LexicalEnvironment 保存到 [[Environment]]；调用环境以它作为 outer。
- Identifier 读取捕获环境中 | Identifier 读取捕获环境中的 binding，因此后续赋值对共享该 binding 的闭包可见。
- for-let 的 CreatePe | for-let 的 CreatePerIterationEnvironment 每轮创建新 binding，并从上一轮复制当前值。
- V8 scope analysis  | V8 scope analysis 把逃逸 binding 放入 Context slot，函数对象保持 Context 可达。
- listener、任务队列和缓存持有 | listener、任务队列和缓存持有函数时，也间接保持捕获环境与对象图存活。

#### 观察重点

- 说闭包“保存变量值的副本”，无法解释共享计数器与赋值后的新值。
- 只用块级作用域解释 for-let，不说明每轮新 binding 与 increment 所在环境。
