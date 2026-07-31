---
lesson: "typescript-01-13"
track: "typescript"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 沿时间线推演「top-level await、异步模块图与启动阻塞」

id: "typescript-01-13-main"
kind: "flow"
placement: "chapter:3"
summary: "top-level await 允许 ESM 顶层直接 await。它不会阻塞操作系统线程或浏览器 event loop；当前模块的执行上下文暂停，Promise jobs、输入和其他任务仍可运行。真正被“阻塞”的是模块图中的求值依赖：静态 importer 在其异步依赖完成前不能执行自己的顶层代码，应用入口、SSR 请求或 worker ready 因此可能迟迟不进入可用状态。"
caption: "箭头表达本课讨论的因果与执行顺序，不承诺真实墙钟时长；并行、失败和回退分支仍以源码与可运行实验为准。"
actionLabel: "播放执行流程"

#### 步骤

- Source Text Module | Source Text Module 的 HasTLA 表示自身包含顶层 await，ExecuteModule 通过 PromiseCapability 暂停与恢复。
- 依赖异步模块的同步父模块也进入 as | 依赖异步模块的同步父模块也进入 async evaluation，但自身 HasTLA 仍为 false。
- 每条未完成异步依赖让父模块 Pend | 每条未完成异步依赖让父模块 PendingAsyncDependencies 加一，并把父加入依赖的 AsyncParentModules。
- 计数归零后父模块才可执行，多个异步兄 | 计数归零后父模块才可执行，多个异步兄弟形成 join barrier。
- AsyncEvaluation or | AsyncEvaluation ordinal 保留可用祖先的确定执行顺序，兄弟 await 仍可按 promise 完成交错。

#### 观察重点

- 说 TLA 阻塞浏览器线程，混淆执行栈释放与模块启动屏障。
- 只给含 await 的模块标 async，漏掉被异步依赖拖入 evaluating-async 的父模块。
