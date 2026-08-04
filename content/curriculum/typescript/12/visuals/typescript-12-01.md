---
lesson: "typescript-12-01"
track: "typescript"
decision: "文字能说明 AST、Symbol 和 Type 分层，却难以让学习者追踪同一段 source text 如何在 parser、binder 和类型投影之间改变身份；静止 flow 用可验证的阶段边界补足这条观察链。"
---

## 视觉实验

### 让 source text 穿过 parser、binder 与 Type AST

id: "typescript-12-01-main"
kind: "flow"
placement: "chapter:2"
summary: "观察一段声明如何先成为带位置的 Node/SourceFile，再绑定到作用域中的 Symbol，最后投影成可递归比较的 Type；内层同名声明会产生新 Symbol，但可以复用同一个 primitive Type。"
caption: "节点表示语法与 span，Symbol 表示声明身份，Type 表示语义形状。教学 flow 省略完整 parser recovery、JSDoc、模块和增量缓存，验证入口是 v5.9.3 的 parseSourceFile、bindSourceFile 与 types.ts 数据结构。"
actionLabel: "推进 AST 与类型身份"

#### 步骤

- 输入 | `const x = 1` 作为 source text，位置范围仍由原文索引定义。
- 解析 | parser 产出 SourceFile、VariableStatement、Identifier 与 Literal 节点，Node 保存 kind、pos、end 等语法信息。
- 绑定 | binder 进入 scope，为外层 `x` 创建 Symbol；Symbol 指向声明节点，不能被 Type AST 取代。
- 投影 | checker/mini projection 把 literal 归约为 `number` Type，Type 不携带原始声明身份。
- 影子声明 | block 内再次声明 `x` 时创建第二个 Symbol；两个 Symbol 可指向同一个 `number` Type，未支持语法则进入显式失败路径。

#### 观察重点

- 点击下一步前预测：解析阶段变化的是 Node 图，绑定阶段变化的是 Symbol 表，类型投影阶段变化的是 Type 形状。
- 证据任务：运行 `examples/typescript/typescript-12-01.mjs`，断言同名影子变量的 Symbol 不同、primitive Type 可共享；真实边界回到固定 commit 源码。

#### 交互边界

- 默认静止；通用渲染器提供上一步、下一步、暂停和重置，按钮可用键盘操作并通过 aria-live 宣告当前步骤。
- 文字步骤是本实验的替代说明；窄屏不依赖 hover，`prefers-reduced-motion` 下保持离散切换。
