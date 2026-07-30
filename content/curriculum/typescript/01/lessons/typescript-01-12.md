---
id: "typescript-01-12"
track: "typescript"
title: "循环依赖、SCC 求值与 TDZ 失败路径"
depth: "deep"
exampleLanguage: "typescript"
readingMinutes: 44
sourceMinutes: 36
practiceMinutes: 60
reviewMinutes: 15
---

## 官方入口

title: "ECMAScript Language Specification · InnerModuleEvaluation"
url: "https://tc39.es/ecma262/multipage/ecmascript-language-scripts-and-modules.html#sec-innermoduleevaluation"

InnerModuleEvaluation 用 DFSIndex、DFSAncestorIndex 和显式 stack 遍历 Cyclic Module Records。遇到回边时更新 ancestor index；当节点成为强连通分量根，整组模块才从 evaluating 转为 evaluated 或 evaluating-async。

## 真实源码

repo: "v8/v8"
file: "src/objects/source-text-module.cc"
symbol: "SourceTextModule::InnerModuleEvaluation"
language: "cpp"
url: "https://github.com/v8/v8/blob/main/src/objects/source-text-module.cc#L1243-L1450"

### 逐段讲解

- 入口先处理 evaluating/evaluating-async/evaluated：回边再次访问正在求值的模块是 no-op，不会递归执行第二遍；errored 则重新抛出已记录异常。
- linked 模块进入 evaluating，写入 dfs_index 与 dfs_ancestor_index，随后压入显式 stack。两个索引对应 Tarjan strong-connect 算法的发现序号与 low-link。
- 算法递归求值每个 evaluation-phase dependency。依赖仍为 evaluating 说明存在回边，当前模块把 ancestor index 降到依赖的 ancestor index。
- 若依赖已完成一个 component，则后续错误和 async cycle root 从该 component root 传播；这避免把环内每个 Module Record 当成互相独立的生命周期。
- 同步模块在依赖处理后 ExecuteModule；真正的 JavaScript 顶层代码到这里才运行。link 阶段建立 Cell，不保证此刻环上所有 Cell 已初始化。
- 只有 dfs_ancestor_index==dfs_index 的 SCC root 才负责把 stack 上直到自身的模块整体 transition。环因此不会让状态永远停在 evaluating。
- 当前 V8 还包含 defer/source-phase import 与 top-level await 分支；本课源码节选保留同步循环主线，异步字段留给下一课。

### 源码节选

```cpp
// 摘自 V8 main/src/objects/source-text-module.cc。
// 保留 InnerModuleEvaluation 的同步 SCC 主线；省略 defer import 与 TLA 分支。
MaybeDirectHandle<Object> SourceTextModule::InnerModuleEvaluation(
    Isolate* isolate,
    Handle<SourceTextModule> module,
    ZoneForwardList<Handle<SourceTextModule>>* stack,
    unsigned* dfs_index) {
  STACK_CHECK(isolate, MaybeDirectHandle<Object>());
  int module_status = module->status();

  // 已在 DFS 栈中表示遇到回边；不能再次执行模块。
  if (module_status == kEvaluatingAsync ||
      module_status == kEvaluating ||
      module_status == kEvaluated) {
    return isolate->factory()->undefined_value();
  } else if (module_status == kErrored) {
    isolate->Throw(module->exception());
    return MaybeDirectHandle<Object>();
  }

  CHECK_EQ(module_status, kLinked);
  module->SetStatus(kEvaluating);
  module->set_dfs_index(*dfs_index);
  module->set_dfs_ancestor_index(*dfs_index);
  (*dfs_index)++;
  stack->push_front(module);

  // 真实实现先整理 evaluation-phase dependencies。
  for (Handle<Module> requested_module : evaluation_list) {
    Handle<SourceTextModule> required_module(
        Cast<SourceTextModule>(*requested_module), isolate);
    RETURN_ON_EXCEPTION(
        isolate,
        InnerModuleEvaluation(
            isolate, required_module, stack, dfs_index));

    int required_status = required_module->status();
    if (required_status == kEvaluating) {
      // Tarjan low-link：回边把当前节点连入同一个 SCC。
      module->set_dfs_ancestor_index(std::min(
          module->dfs_ancestor_index(),
          required_module->dfs_ancestor_index()));
    } else {
      required_module = required_module->GetCycleRoot(isolate);
      if (required_module->status() == kErrored) {
        isolate->Throw(required_module->exception());
        return MaybeDirectHandle<Object>();
      }
    }
  }

  // 所有同步依赖处理后才执行当前模块顶层代码。
  MaybeDirectHandle<Object> exception;
  DirectHandle<Object> result;
  if (!ExecuteModule(isolate, module, &exception).ToHandle(&result)) {
    isolate->Throw(*exception.ToHandleChecked());
    return MaybeDirectHandle<Object>();
  }

  // 只有 SCC root 会把环内整组节点从 stack 弹出并完成状态迁移。
  CHECK(MaybeTransitionComponent(
      isolate, module, stack, kEvaluated));
  return result;
}
```

## 导读

循环依赖的定义很朴素：从模块 A 沿静态依赖边能到 B，又能从 B 的后继回到 A。它并不自动表示错误。ESM 在链接阶段先为整个强连通分量建立 binding，再在求值阶段按 DFS 运行模块，所以函数声明或延迟读取可以安全穿过环；真正危险的是顶层代码过早读取环上尚未初始化的 let、const 或 class。

普通拓扑排序要求有向无环图，模块图却允许环。ECMAScript 使用与 Tarjan strongly connected components 相同的 DFSIndex、DFSAncestorIndex 和 stack 思想：回边降低 low-link；到达一个 component root 时，才把栈上整组 Module Records 一起完成状态迁移。这样既能阻止无限递归，也能让环拥有一致的 lifecycle root。

本课会把上一课的 MiniModule linker 改造成 SCC-aware evaluator。你会手算 A→B→C→A 与 C→D 两类边，比较 function/var/let/class 的初始化时机，复现 TDZ、partial initialization 和 barrel cycle，并用 dependency inversion、第三模块抽取与延迟调用拆除真正有害的环。

## 分章正文

### 环是依赖图的结构，失败来自求值时访问时机

kicker: "01 · CYCLE VERSUS FAILURE"

A import B 且 B import A 只说明图中存在一个 strongly connected component。linker 可以先遍历整个 component，为 A、B 的导出创建 Cell，再让 import bindings 指向目标 Cell。因此“两个文件互相 import 必定 undefined”并不符合 ESM 模型。

失败要定位到某次 GetBindingValue。若 A 顶层在 B 尚未初始化 b 时执行 console.log(b)，读取目标 Cell 的 UNINITIALIZED 会抛 ReferenceError；若 A 只定义 function useB(){return b}，函数创建时不执行函数体，等整个图求值后调用就能成功。

图结构、声明种类、顶层读取位置共同决定结果。同一个环把 export const 改为 export function 可能工作，把调用从顶层移动到 start() 也可能工作；这种“修复”必须解释初始化时序，不能只归因于导入顺序玄学。

模块图由 resolved identity 构成。源码看似 A→B，barrel index.ts、path alias、package export 或 side-effect import 可能补出隐蔽回边。诊断要从构建器/metafile/loader trace 获取最终图，而不是只看当前两个文件。

#### 代码

```typescript
// safe-a.ts
import { readA } from "./safe-b.js"
export const valueA = "A"
export function callB() {
  return readA() // 调用被延迟到图求值完成之后
}

// safe-b.ts
import { valueA } from "./safe-a.js"
export function readA() {
  return valueA
}

// dangerous-b.ts 若在顶层执行 read：
// export const snapshot = valueA
// 结果取决于求值路径，可能在 valueA 初始化前抛 ReferenceError。
```

#### 本章结论

循环只是 SCC；TDZ 失败来自具体顶层读取发生在目标 binding 初始化之前。

### 为什么普通拓扑排序不够，Tarjan low-link 如何收拢 SCC

kicker: "02 · STRONGLY CONNECTED COMPONENT"

DAG 可用入度为零的 Kahn algorithm 排序；包含环时，环内每个节点都有入边，队列无法取出。正确做法是先把每个 SCC 压缩为一个 component，得到的 condensation graph 一定是 DAG，再按 component 依赖顺序求值。

Tarjan DFS 为首次访问节点分配 index，并令 lowLink=index，压入 stack。遍历边 u→v：v 未访问则递归后 low[u]=min(low[u],low[v])；v 仍在 stack 说明是通往当前活跃路径的回边，low[u]=min(low[u],index[v])。若 low[u]==index[u]，u 是 SCC root，持续弹栈直到 u。

ECMAScript 字段名 DFSIndex 与 DFSAncestorIndex 对应 index 与 lowLink。规范的 stack 只包含正在 linking/evaluating 的 Module Records；状态检查非常重要，指向已经完成 component 的边不能把两个 SCC 错误合并。

算法复杂度 O(V+E)，每个模块和依赖边只处理常数次。实际模块系统还要将 import phase、synthetic module、async evaluation 和错误传播叠加在同一遍历上，但 SCC 不变量仍是理解入口。

#### 代码

```typescript
function stronglyConnected<T>(
  nodes: readonly T[],
  edges: (node: T) => readonly T[]
): T[][] {
  let nextIndex = 0
  const index = new Map<T, number>()
  const low = new Map<T, number>()
  const stack: T[] = []
  const onStack = new Set<T>()
  const components: T[][] = []

  const visit = (node: T) => {
    index.set(node, nextIndex)
    low.set(node, nextIndex++)
    stack.push(node)
    onStack.add(node)

    for (const target of edges(node)) {
      if (!index.has(target)) {
        visit(target)
        low.set(node, Math.min(low.get(node)!, low.get(target)!))
      } else if (onStack.has(target)) {
        low.set(node, Math.min(low.get(node)!, index.get(target)!))
      }
    }

    if (low.get(node) !== index.get(node)) return
    const component: T[] = []
    while (true) {
      const member = stack.pop()!
      onStack.delete(member)
      component.push(member)
      if (member === node) break
    }
    components.push(component)
  }

  for (const node of nodes) if (!index.has(node)) visit(node)
  return components
}
```

#### 本章结论

low-link 把所有互相可达的活跃节点收进一个 SCC；压缩后的 component graph 才能拓扑排序。

### Link 与 Evaluate 各跑一次 SCC 状态机

kicker: "03 · TWO GRAPH PASSES"

linking pass 递归依赖并调用 InitializeEnvironment。遇到 linking 节点表示回边，更新 ancestor index；SCC root 完成后，环内所有节点成为 linked。若某个 import 缺失、star export 歧义或初始化环境失败，stack 上相关模块退回/记录错误，不能留下半链接状态供后续使用。

evaluation pass 从 entry 再做 DFS。模块进入 evaluating 后先处理依赖；遇到已 evaluating 节点直接返回 index，阻止递归第二遍。依赖处理完成后 ExecuteModule 当前顶层代码。到 SCC root 时，栈上 component 成员一起转 evaluated，或在 TLA 情况转 evaluating-async。

“依赖先执行”对跨 SCC 的 DAG 边成立；环内没有一个能同时满足所有边的全序。DFS 后序给出某个确定执行路径，但模块代码必须遵守可初始化时机，不应依赖把 entry 换掉后偶然仍相同的环内顺序。

同一个 Module Record 只执行一次。若 A 与 B 都从不同入口被 import，第二次 Evaluate 看到 evaluated/errored 状态并复用结果。模块顶层因此不应承担需要按调用重试的事务；失败恢复应该由显式函数与新业务状态完成。

#### 代码

```typescript
type EvalStatus =
  | "linked"
  | "evaluating"
  | "evaluated"
  | "errored"

type EvalNode = {
  id: string
  deps: EvalNode[]
  status: EvalStatus
  dfsIndex: number
  ancestorIndex: number
  execute(): void
}

// 回边只更新 low-link，不再次 execute。
function seeDependency(owner: EvalNode, dependency: EvalNode): void {
  if (dependency.status === "evaluating") {
    owner.ancestorIndex = Math.min(
      owner.ancestorIndex,
      dependency.ancestorIndex
    )
  }
}
```

#### 本章结论

链接和求值都要对循环图做 component 级状态迁移；环内不能套用简单的“所有依赖严格先于当前模块”。

### function、var、let/const/class 的初始化矩阵

kicker: "04 · TDZ MATRIX"

ModuleDeclarationInstantiation 创建所有 bindings，却按声明类别采用不同初始化。可提升的顶层 function declaration 在环境初始化阶段获得函数对象，因此另一模块有机会在双方顶层代码前读取函数 binding；函数体中对其他 binding 的读取仍发生在调用时。

var 声明的模块 binding 在实例化时初始化为 undefined，evaluate 再执行 initializer 赋值。过早读取不会 ReferenceError，却可能把 undefined 传播进注册表或快照。它通常比 TDZ 的快速失败更隐蔽。

let、const 与 class 在实例化后保持 uninitialized，直到 evaluation 到达声明。class 还包含 extends expression、computed key 与 static initialization 等可执行步骤；循环中导出 class 并被另一模块顶层继承，很容易在 class 尚未初始化时失败。

default export 也要按具体声明分析：export default function 声明与 export default expression 的初始化路径不同。面试推演应先标注 binding 创建点、初始化点和读取点，再谈“hoist”，避免一个词覆盖四种行为。

#### 代码

```typescript
// declarations-a.ts
import { probe } from "./declarations-b.js"

export function fn() { return "ready function" }
export var viaVar = 1
export let viaLet = 2
export class Service {}

probe()

// declarations-b.ts
import { fn, viaVar, viaLet, Service } from "./declarations-a.js"
export function probe() {
  // probe 在何时被调用决定后三个 binding 是否已经初始化。
  console.log(fn())
  console.log(viaVar)
  console.log(viaLet)
  console.log(Service)
}
```

#### 本章结论

函数、var 与 lexical/class binding 的初始化点不同；环的安全性必须逐个读取点分析。

### barrel、注册表与装饰器会制造难以看见的回边

kicker: "05 · HIDDEN CYCLES"

index.ts 常用 export * 汇总模块。feature.ts 从 index.ts 导入公共类型或 helper，而 index.ts 又 re-export feature.ts，就形成 feature→index→feature。即使 import type 在 TypeScript emit 后消失，混入一个运行时 value import 就会重新生成边；应同时查看类型图和 emit 后运行时图。

插件注册模式也容易成环：registry 导入所有 plugins 触发自注册，plugin 又导入 registry 调 register。此模式依赖顶层副作用和 partial initialization。更稳的方向是 composition root 显式 import plugins，再调用 register(registry)，让低层插件只依赖接口。

装饰器、ORM model metadata、DI container 与 GraphQL schema 经常在类定义时读取关联类。class binding 的 TDZ 与静态初始化会让循环在测试顺序、bundler 输出或 CJS/ESM 迁移时爆炸。延迟 callback `() => OtherModel` 只有在框架确实晚于图初始化调用时才安全。

工具报告循环不等于必须全部删除。优先处理包含顶层副作用、lexical 读取、继承、静态字段和单例初始化的 SCC；只包含延迟函数调用且合同清晰的小环风险较低，但仍应有回归测试和架构说明。

#### 代码

```typescript
// 不推荐：plugin.ts 顶层反向导入 registry 并立即注册。
// registry.ts -> plugin.ts -> registry.ts

export interface Plugin {
  name: string
  install(registry: Registry): void
}

// composition-root.ts 负责组装，依赖方向保持单向。
import { registry } from "./registry.js"
import { auditPlugin } from "./audit-plugin.js"
import { metricsPlugin } from "./metrics-plugin.js"

for (const plugin of [auditPlugin, metricsPlugin]) {
  plugin.install(registry)
}
```

#### 本章结论

barrel 与自注册把组装职责藏进顶层副作用；composition root 能把回边改成显式的单向依赖。

### 重构环要移动所有权，而非随意延迟一个 import

kicker: "06 · REFACTORING"

若 A 与 B 共享纯类型/常量，可把真正共同的协议抽到 C：A→C、B→C。C 必须是更底层稳定抽象，不能成为把所有杂物堆进去的 common.ts，否则只是把环变成中心化耦合。

若 A 高层策略需要调用 B 低层实现，而 B 又回调 A，使用依赖倒置：低层定义或共同协议层定义 callback/port，高层在 composition root 注入实现。模块图表达所有权，运行时对象图仍可双向协作。

若依赖只在某个操作发生时需要，可以把读取移到函数调用或使用 dynamic import。dynamic import 会创建异步失败与 chunk 边界，适合真正可延迟功能；只为躲避 TDZ 而随处 dynamic import 会把静态错误推迟到生产并扩大状态空间。

有时最小修复是移除顶层 snapshot：导出 getConfig() 让读取发生在初始化后，或显式 init(deps) 建立状态。必须加入“init 前调用如何失败、重复 init 是否幂等、测试如何 reset”的协议，延迟并不等于问题自动消失。

#### 代码

```typescript
// ports.ts：稳定的低层合同
export interface UserEvents {
  publishCreated(userId: string): void
}

// user-service.ts：只依赖 port
export function createUserService(events: UserEvents) {
  return {
    create(id: string) {
      events.publishCreated(id)
    }
  }
}

// app.ts：composition root 组装双方
const service = createUserService(messageBus)
export { service }
```

#### 本章结论

拆环的本质是重新分配协议与组装所有权；延迟 import 只是其中一种带异步代价的工具。

### 循环错误的证据链：图、状态、读取点与产物

kicker: "07 · DIAGNOSTICS"

第一条证据是最终运行时依赖图。使用 bundler metafile、madge/dependency-cruiser、Node loader trace 或自建 import analyzer 列出 SCC；保留 resolved path、edge kind 和是否 type-only。只看 IDE “find references”会漏 re-export 与生成代码。

第二条证据是模块状态时间线。为顶层初始化临时加入 module id、before declaration、after declaration 日志，或在 debugger 捕获 ReferenceError 的首次抛出位置。错误栈中的“Cannot access X before initialization”指出读取点，目标声明位置指出未完成的初始化。

第三条证据是构建产物。TypeScript module target、Babel transform、bundler chunking 与 CJS interop 可能改变实现次序却不应随意改变 ESM 语义；若仅某套产物失败，比较模块包装、helper、tree shaking 和 sideEffects 标记。

生产监控要保留部署版本、入口、resolved module URL 与首次 evaluation error。模块错误通常被 cache，单请求重试同一实例不会恢复；回滚、刷新 realm/worker 或修复外部初始化条件才可能改变结果。

#### 代码

```typescript
type DependencyEdge = {
  from: string
  to: string
  kind: "static" | "reexport" | "dynamic" | "type-only"
}

function runtimeEdges(edges: readonly DependencyEdge[]) {
  return edges.filter(edge => edge.kind !== "type-only")
}

const components = stronglyConnected(
  modules,
  module => runtimeEdges(edges)
    .filter(edge => edge.from === module)
    .map(edge => edge.to)
)
```

#### 本章结论

诊断循环要同时证明最终图、未初始化读取点和实际产物；单个文件的 import 顺序不足以定因。

### 测试 SCC 要覆盖不同入口与失败固化

kicker: "08 · TEST MATRIX"

同一 SCC 从 A 或 B 作为 entry 开始，DFS discovery order 可以不同。可靠模块不应因为测试入口变化就从成功变失败；为每个公共入口单独启动新 realm/process 运行图，能暴露隐含环内顺序依赖。

安全环测试应证明：link 成功；函数 binding 可用；所有 lexical binding 在图完成后可读；重复 import 不重复副作用。有害环测试应断言具体 ReferenceError 与读取位置，而非只断言“import rejected”。

测试模块 cache 时，同一进程第二次 import 可能直接复用第一次结果，无法重新演练初始化。使用隔离 worker、子进程、vm SourceTextModule 或测试运行器 resetModules 时，要说明隔离能力的真实边界，避免 query string workaround 泄漏新实例。

架构 gate 可以禁止新增跨 layer SCC，或对含顶层副作用的 SCC 设为错误。已有环应维护 allowlist、owner 和移除计划；只统计环数量会鼓励把多个文件合并成巨型模块，而没有真正降低耦合。

#### 代码

```typescript
type CycleCase = {
  entry: string
  expected: "success" | "tdz-error"
}

const cases: CycleCase[] = [
  { entry: "./safe-a.js", expected: "success" },
  { entry: "./safe-b.js", expected: "success" },
  { entry: "./danger-a.js", expected: "tdz-error" }
]

// 每个 case 应在新 worker/进程执行，避免 module cache 污染。
for (const testCase of cases) {
  await runIsolatedModuleCase(testCase)
}
```

#### 本章结论

循环测试要改变 entry、隔离 cache、区分 link 与 TDZ，并验证失败是否被模块实例固化。

## 核心机制

- 循环模块先在 linking pass 建立整个 SCC 的 bindings，再在 evaluation pass 执行顶层代码。
- DFSIndex 记录发现次序，DFSAncestorIndex/low-link 记录能回到的最早活跃节点。
- 遇到 evaluating 依赖是回边，递归立即返回并降低当前 ancestor index。
- 只有 low-link 等于自身 index 的 root 才弹出 stack 并完成整个 component 状态迁移。
- 跨 SCC 依赖能拓扑排序；SCC 内不存在满足所有依赖边的严格全序。
- function 在实例化阶段可初始化，var 初始 undefined，let/const/class 保持 TDZ 到求值声明。
- link 成功只说明 binding 可解析；顶层 GetBindingValue 仍可能因目标未初始化而 ReferenceError。
- barrel、re-export、自注册与静态 class metadata 会在源码表面之外增加运行时回边。
- 拆环通常通过抽取稳定协议、依赖倒置、composition root 或显式延迟读取改变所有权。
- 同一失败 Module Record 会复用 errored 状态，重复 import 不是事务重试。

## 常见误区

- 看到双向 import 就断言一定返回 undefined，混淆 ESM TDZ 与 CommonJS partial exports。
- 用普通拓扑排序处理含环图，剩余节点无法出队却没有 component 语义。
- Tarjan 处理指向已完成节点的边时仍更新 low-link，错误合并两个 SCC。
- 回边再次 execute 模块，造成无限递归或重复顶层副作用。
- 把 link 完成当作所有 Cell 已初始化，漏掉 evaluation TDZ。
- 只用“hoisting”解释 function/var/let/class，没有标注各自初始化点。
- 用 export * barrel 聚合一切，忽略它增加回边和名称歧义。
- 以 dynamic import 随机打断环，却没有处理异步失败、加载状态和 chunk 成本。
- 把共享代码全部塞进 common.ts，环消失但低内聚中心模块继续扩大。
- 只从单一 entry 测试，隐藏依赖 DFS discovery order 的脆弱顶层读取。
- 同一进程重复 import 测初始化，实际命中 cache 而没有重新执行。
- 以 SCC 数量作为唯一架构指标，诱导合并文件而不改善依赖方向。

## 实现变体

### 延迟函数读取

useWhen: "两个模块确实互相提供行为，但所有跨环 binding 只在应用启动完成后的函数调用中读取。"
tradeoff: "保留静态图和同步 API；合同容易被后来新增的顶层调用破坏，需要专门回归测试。"

#### 代码

```typescript
import { serviceB } from "./b.js"
export function useB() {
  return serviceB.run()
}
```

### 第三协议模块 + composition root

useWhen: "双向依赖来自接口归属或组装职责不清，可以提取稳定 port 并在高层注入。"
tradeoff: "依赖方向最清楚、测试替换容易；增加接口与组装代码，过度抽象会降低可读性。"

#### 代码

```typescript
// contracts.ts <- a.ts, b.ts
// app.ts -> a.ts, b.ts，并负责 connect(a, b)
export interface Receiver {
  receive(message: Message): void
}
```

### dynamic import 延迟边

useWhen: "依赖确实是可选功能或用户操作之后才需要，异步边界符合产品体验。"
tradeoff: "从静态 SCC 移除边；引入 Promise、chunk、加载失败、取消和预取策略。"

#### 代码

```typescript
export async function openDiagnostics() {
  const { createDiagnostics } = await import("./diagnostics.js")
  return createDiagnostics()
}
```

## 可运行示例

```typescript
type Status =
  | "linked"
  | "evaluating"
  | "evaluated"
  | "errored"

const UNINITIALIZED_CYCLE = Symbol("uninitialized")

class CycleCell<T = unknown> {
  value: T | typeof UNINITIALIZED_CYCLE = UNINITIALIZED_CYCLE

  initialize(value: T): void {
    if (this.value !== UNINITIALIZED_CYCLE) {
      throw new TypeError("binding already initialized")
    }
    this.value = value
  }

  read(name: string): T {
    if (this.value === UNINITIALIZED_CYCLE) {
      throw new ReferenceError(name + " is not initialized")
    }
    return this.value
  }
}

class CycleModule {
  status: Status = "linked"
  dfsIndex = -1
  ancestorIndex = -1
  error: unknown
  readonly bindings = new Map<string, CycleCell>()
  readonly imports = new Map<
    string,
    { module: CycleModule; binding: string }
  >()

  constructor(
    readonly id: string,
    readonly dependencies: CycleModule[],
    readonly executeBody: (module: CycleModule) => void
  ) {}

  createBinding(name: string): CycleCell {
    const cell = new CycleCell()
    this.bindings.set(name, cell)
    return cell
  }

  importBinding(
    localName: string,
    target: CycleModule,
    targetName: string
  ): void {
    this.imports.set(localName, {
      module: target,
      binding: targetName
    })
  }

  read(name: string): unknown {
    const local = this.bindings.get(name)
    if (local) return local.read(this.id + "." + name)
    const imported = this.imports.get(name)
    if (!imported) throw new ReferenceError(name + " is not defined")
    const cell = imported.module.bindings.get(imported.binding)
    if (!cell) throw new ReferenceError("missing export " + imported.binding)
    return cell.read(imported.module.id + "." + imported.binding)
  }
}

class SccEvaluator {
  private nextIndex = 0
  private stack: CycleModule[] = []
  readonly trace: string[] = []

  evaluate(entry: CycleModule): void {
    try {
      this.visit(entry)
    } catch (error) {
      for (const module of this.stack.splice(0)) {
        module.status = "errored"
        module.error = error
      }
      throw error
    }
  }

  private visit(module: CycleModule): void {
    if (module.status === "evaluated") return
    if (module.status === "errored") throw module.error
    if (module.status === "evaluating") return

    module.status = "evaluating"
    module.dfsIndex = this.nextIndex
    module.ancestorIndex = this.nextIndex++
    this.stack.push(module)
    this.trace.push("discover:" + module.id)

    for (const dependency of module.dependencies) {
      if (dependency.status === "linked") {
        this.visit(dependency)
        module.ancestorIndex = Math.min(
          module.ancestorIndex,
          dependency.ancestorIndex
        )
      } else if (dependency.status === "evaluating") {
        // 回边只连向当前活跃 stack。
        module.ancestorIndex = Math.min(
          module.ancestorIndex,
          dependency.dfsIndex
        )
        this.trace.push(
          "back-edge:" + module.id + "->" + dependency.id
        )
      } else if (dependency.status === "errored") {
        throw dependency.error
      }
    }

    this.trace.push("execute:" + module.id)
    module.executeBody(module)

    if (module.ancestorIndex !== module.dfsIndex) return

    const component: string[] = []
    while (true) {
      const member = this.stack.pop()!
      member.status = "evaluated"
      component.push(member.id)
      if (member === module) break
    }
    this.trace.push("component:" + component.join(","))
  }
}

// 先创建节点，再连接依赖，模拟 link 已为整个 SCC 建 Cell。
const modulesById = new Map<string, CycleModule>()

const a = new CycleModule("A", [], module => {
  // A 的函数 Cell 在“实例化阶段”预先初始化，模拟 function declaration。
  module.bindings.get("valueA")!.initialize("A")
  const readB = module.read("readB") as () => string
  module.bindings.get("fromB")!.initialize(readB())
})

const b = new CycleModule("B", [], module => {
  module.bindings.get("valueB")!.initialize("B")
  // readB 函数此前已初始化；调用发生在 A 执行时。
})

a.dependencies.push(b)
b.dependencies.push(a)

a.createBinding("valueA")
a.createBinding("fromB")
b.createBinding("valueB")
const readBCell = b.createBinding("readB")
readBCell.initialize(() => String(b.read("valueB")))

a.importBinding("readB", b, "readB")
b.importBinding("valueA", a, "valueA")

modulesById.set(a.id, a)
modulesById.set(b.id, b)

const evaluator = new SccEvaluator()
evaluator.evaluate(a)

console.assert(a.read("fromB") === "B")
console.assert(a.status === "evaluated")
console.assert(b.status === "evaluated")
console.assert(
  evaluator.trace.some(event => event.startsWith("back-edge:"))
)

// 有害环：X 执行时读取 Y 的 lexical Cell，而 Y 尚未 execute。
const x = new CycleModule("X", [], module => {
  module.bindings.get("x")!.initialize(module.read("y"))
})
const y = new CycleModule("Y", [], module => {
  module.bindings.get("y")!.initialize("ready")
})
x.dependencies.push(y)
y.dependencies.push(x)
x.createBinding("x")
y.createBinding("y")
x.importBinding("y", y, "y")
y.importBinding("x", x, "x")

try {
  new SccEvaluator().evaluate(x)
  console.assert(false)
} catch (error) {
  console.assert(error instanceof ReferenceError)
}
```

## 搭积木复现

### 积木 1：构造可视模块图

用 Module 对象与 dependencies 明确表示边，先画 A→B→C→A、C→D；不要在这一阶段执行任何模块代码。

### 积木 2：独立实现 Tarjan SCC

为每个节点保存 index、lowLink、onStack，断言得到 {A,B,C} 与 {D} 两个 component，并验证 O(V+E) 访问计数。

### 积木 3：复用 link 阶段 Cell

在 evaluation 前为 component 内所有导出创建 Cell 与 import resolution，证明环不会阻止名称解析。

### 积木 4：实现 evaluating 回边处理

再次访问 evaluating 节点只更新 ancestorIndex 并返回；加入 execute 计数器，确保每个 Module Record 只执行一次。

### 积木 5：实现 component transition

只有 root 的 low-link 等于 index 时才从 stack 弹出直到 root；把整组状态改为 evaluated，并记录 cycle root。

### 积木 6：建立声明初始化矩阵

分别模拟预初始化 function、undefined var、UNINITIALIZED let/class，从两个 entry 运行并记录首次读取结果。

### 积木 7：传播 evaluation error

顶层读取 TDZ 或 execute throw 时，把当前 component 置 errored；重复 evaluate 应重抛保存原因，不得重复副作用。

### 积木 8：分析真实项目 SCC

导出 bundler/metafile 的运行时边，过滤 type-only，找出含顶层副作用/类继承的 SCC，选择一个用 composition root 重构并用入口矩阵回归。

## 自检

### 问题

A import B，B import A。A 顶层执行 `export const fromB = readB()`；B 导出 `function readB(){ return valueB }`，并在函数声明之后执行 `export const valueB="B"`。从 A 作为 entry 时，link 为什么能成功？evaluation 是否一定成功？请用 SCC DFS、function 初始化和 valueB 的 TDZ 推演；再说明把 readB 改成只返回字面量，或把 A 的调用移入 start()，分别改变了什么。

### 站内答案

link 阶段会先遍历 A/B 的 SCC，为两边声明创建 Cell，并把 A 的 readB import 解析到 B 的函数 binding，因此没有 missing/ambiguous export，链接可以成功。evaluation 从 A 进入 evaluating，递归 B；B 遇到对 A 的回边只更新 low-link，不重新执行 A。B 的顶层 function binding 已在实例化阶段初始化，但 B 的 ExecuteModule 会继续运行到 `valueB="B"`，正常情况下 B 执行完成后才回到 A，A 调 readB 时 valueB 已初始化，所以成功。若求值路径或 B 的其他顶层代码在 valueB 初始化前调用 readB，函数虽可调用，函数体读取 valueB 仍会 ReferenceError；安全性取决于读取点而非函数名本身。readB 改成返回字面量后消除了对 lexical Cell 的读取，即使更早调用也无 TDZ。把 A 的调用移入显式 start() 则保留 readB→valueB 依赖，但把读取推迟到整个模块图求值完成以后；需要再定义 start 何时调用、重复调用和失败处理，才能成为完整协议。
