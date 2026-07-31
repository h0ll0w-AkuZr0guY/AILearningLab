---
lesson: "typescript-01-11"
track: "typescript"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 展开「ESM 实例化、Module Environment 与 live binding」的节点与依赖

id: "typescript-01-11-main"
kind: "graph"
placement: "chapter:2"
summary: "ES module 不是把被导入文件的文本粘贴到当前文件，也不是执行一次后复制 exports 对象。宿主先解析模块得到 Module Record，解析其静态 ModuleRequests，加载依赖图，再执行 linking/instantiation 建立环境与 binding，最后才 evaluate 顶层代码。把“创建连接”和“运行初始化代码”分开，循环依赖、提前校验缺失导出和 live binding 才有可靠语义。"
caption: "节点和连线表示依赖关系与当前可观察阶段；真实图中的条件边、并行合并、失败与重放必须回到源码逐项核对。"
actionLabel: "推进节点状态"

#### 步骤

- Module goal 解析产生 M | Module goal 解析产生 ModuleRequests、ImportEntries 与多类 ExportEntries。
- 宿主把 specifier 解析/加 | 宿主把 specifier 解析/加载为唯一 Module Record；ECMAScript 不规定 node_modules 或 HTTP 细节。
- LoadRequestedModul | LoadRequestedModules 取得图，Link/InitializeEnvironment 建环境和 binding，Evaluate 才运行顶层代码。
- Module Environment | Module Environment 保存 direct binding 与 immutable indirect import binding，顶层 this 为 undefined。
- ResolveExport 找到唯一 | ResolveExport 找到唯一的 module/localName binding 身份，并在缺失或 star 歧义时使链接失败。

#### 观察重点

- 把 ESM 当成源码文本拼接，无法解释静态图、early error、单次求值和循环链接。
- 把 import binding 说成值拷贝，导致 exporter 更新后 importer 错误地保留旧值。
