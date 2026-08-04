---
lesson: "typescript-12-03"
track: "typescript"
decision: "文字能描述 narrowing 是过滤候选集合，却难以追踪事实在分支、赋值和 join 点的生命周期；静止 state 视觉用快照展示事实增加、失效与重新合并。"
---

## 视觉实验

### 观察 FlowFacts 如何经过分支与 join

id: "typescript-12-03-main"
kind: "state"
placement: "chapter:2"
summary: "把 `string | number | null` 的候选集合与当前控制流事实分开显示，观察 typeof/truthiness 过滤、assignment invalidation 和 join 合并。"
caption: "候选集合是声明允许的类型，事实快照是当前位置可证明的子集。视觉省略完整 FlowNode、alias、闭包和循环 fixed point；验证入口是 getNarrowedType、getNarrowedTypeOfSymbol 与本课示例。"
actionLabel: "推进控制流事实"

#### 步骤

- 入口 | 声明候选为 `{string, number, null}`，当前位置没有额外事实。
- typeof 分支 | `typeof value === "string"` 的 true edge 把当前事实过滤为 `{string}`，false edge 保留 `{number, null}`。
- truthiness 分支 | 对仍可达的候选排除 `null`，事实与声明候选分离保存。
- 赋值失效 | `value = 1` 写入新事实，旧的 string snapshot 被清除，读取重新从当前位置计算。
- join | 两条仍可达路径合并，结果只包含各路径的可达候选，例如 `{number, null}`，不会复活已经不可达的 string。

#### 观察重点

- 预测任务：分支改变事实，赋值改变事实来源，join 合并可达路径；声明 union 本身不随点击消失。
- 证据任务：运行 `examples/typescript/typescript-12-03.mjs`，断言 assignment 会撤销旧窄化，join 不会错误复用过期快照。

#### 交互边界

- 默认静止；通用渲染器提供上一步、下一步、暂停、重置、键盘按钮和 aria-live 状态文本。
- 步骤文字是窄屏替代说明，系统减弱动态偏好时保持离散状态，不依赖 hover。
