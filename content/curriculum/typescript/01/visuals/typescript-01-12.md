---
lesson: "typescript-01-12"
track: "typescript"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 展开「循环依赖、SCC 求值与 TDZ 失败路径」的节点与依赖

id: "typescript-01-12-main"
kind: "graph"
placement: "chapter:2"
summary: "循环依赖的定义很朴素：从模块 A 沿静态依赖边能到 B，又能从 B 的后继回到 A。它并不自动表示错误。ESM 在链接阶段先为整个强连通分量建立 binding，再在求值阶段按 DFS 运行模块，所以函数声明或延迟读取可以安全穿过环；真正危险的是顶层代码过早读取环上尚未初始化的 let、const 或 class。"
caption: "节点和连线表示依赖关系与当前可观察阶段；真实图中的条件边、并行合并、失败与重放必须回到源码逐项核对。"
actionLabel: "推进节点状态"

#### 步骤

- 循环模块先在 linking pas | 循环模块先在 linking pass 建立整个 SCC 的 bindings，再在 evaluation pass 执行顶层代码。
- DFSIndex 记录发现次序，DF | DFSIndex 记录发现次序，DFSAncestorIndex/low-link 记录能回到的最早活跃节点。
- 遇到 evaluating 依赖是回 | 遇到 evaluating 依赖是回边，递归立即返回并降低当前 ancestor index。
- 只有 low-link 等于自身 i | 只有 low-link 等于自身 index 的 root 才弹出 stack 并完成整个 component 状态迁移。
- 跨 SCC 依赖能拓扑排序 | 跨 SCC 依赖能拓扑排序；SCC 内不存在满足所有依赖边的严格全序。

#### 观察重点

- 看到双向 import 就断言一定返回 undefined，混淆 ESM TDZ 与 CommonJS partial exports。
- 用普通拓扑排序处理含环图，剩余节点无法出队却没有 component 语义。
