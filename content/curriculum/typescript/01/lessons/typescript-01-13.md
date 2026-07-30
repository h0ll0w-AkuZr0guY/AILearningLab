---
id: "typescript-01-13"
track: "typescript"
title: "top-level await、异步模块图与启动阻塞"
depth: "deep"
exampleLanguage: "typescript"
readingMinutes: 48
sourceMinutes: 40
practiceMinutes: 67
reviewMinutes: 15
---

## 官方入口

title: "ECMAScript Language Specification · ExecuteAsyncModule"
url: "https://tc39.es/ecma262/multipage/ecmascript-language-scripts-and-modules.html#sec-execute-async-module"

含 top-level await 的模块通过 PromiseCapability 执行。依赖它的父模块增加 PendingAsyncDependencies 并登记到 AsyncParentModules；依赖完成后按 AsyncEvaluation 次序唤醒可执行祖先，拒绝则沿父图传播。

## 真实源码

repo: "v8/v8"
file: "src/objects/source-text-module.cc"
symbol: "ExecuteAsyncModule / AsyncModuleExecutionFulfilled"
language: "cpp"
url: "https://github.com/v8/v8/blob/main/src/objects/source-text-module.cc#L969-L1205"

### 逐段讲解

- ExecuteAsyncModule 只接受 evaluating/evaluating-async 且 has_toplevel_await 的模块，并创建专属 Promise capability。
- V8 构造 onFulfilled/onRejected 内建回调，把当前 SourceTextModule 放进 context；随后用 PerformPromiseThen 订阅 capability 的完成。
- InnerExecuteAsyncModule 把 capability 安装到 JSAsyncFunctionObject，并恢复模块的隐式 async function。顶层 await 因而复用 async function 暂停/恢复机制。
- AsyncModuleExecutionFulfilled 把当前模块置 evaluated，并先 resolve 自己的 top-level capability。
- GatherAvailableAncestors 递减父模块的 pending async dependency；归零的父模块进入按 async_evaluation_ordinal 排序的 exec list。
- 父模块自身有 TLA 时继续 ExecuteAsyncModule；没有 TLA 但被异步依赖拖入 async evaluation 时同步 ExecuteModule，完成后继续解锁上游。
- 任一异步模块拒绝会调用 AsyncModuleExecutionRejected，把同一错误递归传播给 AsyncParentModules，并拒绝 cycle root 的 top-level capability。
- V8 的 ordinal、pending count 与 parent list 是规范状态机的直接落地；Promise job 何时运行仍由上一课的 host microtask checkpoint 调度。

### 源码节选

```cpp
// 摘自 V8 main/src/objects/source-text-module.cc。
// 保留异步模块启动与完成传播主线；省略 tracing、终止检查和部分断言。
Maybe<bool> SourceTextModule::ExecuteAsyncModule(
    Isolate* isolate,
    DirectHandle<SourceTextModule> module) {
  CHECK(module->status() == kEvaluating ||
        module->status() == kEvaluatingAsync);
  DCHECK(module->has_toplevel_await());

  // 每个 async module 用 capability 承接其顶层执行结果。
  DirectHandle<JSPromise> capability =
      isolate->factory()->NewJSPromise();
  DirectHandle<Context> context =
      isolate->factory()->NewBuiltinContext(
          isolate->native_context(),
          ExecuteAsyncModuleContextSlots::kContextLength);
  context->SetNoCell(
      ExecuteAsyncModuleContextSlots::kModule, *module);

  // 内建回调最终进入 AsyncModuleExecutionFulfilled/Rejected。
  DirectHandle<JSFunction> on_fulfilled =
      Factory::JSFunctionBuilder{
          isolate,
          isolate->factory()
              ->source_text_module_execute_async_module_fulfilled_sfi(),
          context}
          .Build();
  DirectHandle<JSFunction> on_rejected =
      Factory::JSFunctionBuilder{
          isolate,
          isolate->factory()
              ->source_text_module_execute_async_module_rejected_sfi(),
          context}
          .Build();

  DirectHandle<Object> args[] = {on_fulfilled, on_rejected};
  Execution::CallBuiltin(
      isolate, isolate->perform_promise_then(),
      capability, base::VectorOf(args));

  // 恢复模块对应的 JSAsyncFunctionObject，遇到 await 时再次暂停。
  MAYBE_RETURN(
      InnerExecuteAsyncModule(isolate, module, capability),
      Nothing<bool>());
  return Just(true);
}

Maybe<bool> SourceTextModule::AsyncModuleExecutionFulfilled(
    Isolate* isolate,
    Handle<SourceTextModule> module) {
  DCHECK_EQ(module->status(), kEvaluatingAsync);
  module->set_async_evaluation_ordinal(kAsyncEvaluateDidFinish);
  module->SetStatus(kEvaluated);

  if (!IsUndefined(module->top_level_capability())) {
    DirectHandle<JSPromise> top_level(
        Cast<JSPromise>(module->top_level_capability()), isolate);
    JSPromise::Resolve(
        top_level, isolate->factory()->undefined_value())
        .ToHandleChecked();
  }

  AvailableAncestorsSet exec_list;
  GatherAvailableAncestors(isolate, module, &exec_list);
  for (DirectHandle<SourceTextModule> parent : exec_list) {
    if (parent->has_toplevel_await()) {
      MAYBE_RETURN(
          ExecuteAsyncModule(isolate, parent), Nothing<bool>());
    } else {
      // 父模块本身同步，但此前必须等待异步依赖。
      MaybeDirectHandle<Object> exception;
      if (!ExecuteModule(isolate, parent, &exception).is_null()) {
        parent->SetStatus(kEvaluated);
      } else {
        AsyncModuleExecutionRejected(
            isolate, parent, exception.ToHandleChecked());
      }
    }
  }
  return Just(true);
}
```

## 导读

top-level await 允许 ESM 顶层直接 await。它不会阻塞操作系统线程或浏览器 event loop；当前模块的执行上下文暂停，Promise jobs、输入和其他任务仍可运行。真正被“阻塞”的是模块图中的求值依赖：静态 importer 在其异步依赖完成前不能执行自己的顶层代码，应用入口、SSR 请求或 worker ready 因此可能迟迟不进入可用状态。

一个没有写 await 的模块也可能成为 async-evaluating。只要某个静态依赖含 TLA 或依赖的下游仍异步，该父模块的 PendingAsyncDependencies 就大于零，并登记到依赖的 AsyncParentModules。依赖完成后，运行时递减计数，归零才允许父模块执行；失败则沿父图传播并拒绝入口 Evaluate 返回的 promise。

本课会把同步 SCC evaluator 扩展为异步调度器：HasTLA、pending count、async parents、evaluation ordinal、fulfilled/rejected 传播、启动 timeout 和 trace 全部可观察。你还会复现串行 waterfall、并行启动、动态 import 等待环与 SSR 全局启动阻塞，并给出把 TLA 收敛到边界层的工程规则。

## 分章正文

### TLA 暂停模块执行，不暂停 event loop

kicker: "01 · SUSPENSION"

含 TLA 的 source text module 被标记 [[HasTLA]]=true。ExecuteModule 接收 PromiseCapability，模块代码像隐式 async function 一样运行：遇到未完成 await 保存执行状态并返回，promise settle 后由 job 恢复。顶层声明在越过相应语句后才初始化。

暂停期间浏览器仍能处理 task、microtask 与渲染，Node 也继续驱动 I/O。静态 import 它的父模块却不能越过自己的 evaluation barrier，因为父模块的顶层代码可能读取依赖导出，必须等依赖完成或失败。

因此“top-level await 阻塞线程”与“top-level await 阻塞模块启动”是两个命题。前者通常错误，后者可能沿静态 importer 图放大到整个应用 entry。性能监控要区分 main-thread blocking time 与 module evaluation latency。

模块 Evaluate 无论同步或异步都返回 promise；同步图可立即 resolve，异步图在 cycle root 完成后 resolve。dynamic import 也以 namespace promise 暴露同一完成边界。

#### 代码

```typescript
// config.ts
const response = await fetch("/runtime-config.json")
if (!response.ok) throw new Error("config load failed")
export const config = await response.json()

// app.ts 的顶层代码要等 config.ts 完成，但浏览器仍可处理事件与绘制。
import { config } from "./config.js"
startApplication(config)
```

#### 本章结论

TLA 释放 JavaScript 执行栈，却把模块求值完成变成异步依赖屏障；线程响应与应用 ready 要分别测量。

### 没有 await 的 importer 也会进入 async evaluation

kicker: "02 · ASYNC TRANSITIVITY"

设 A 静态 import B，B 含 TLA。InnerModuleEvaluation 先遍历 B；B 标记 AsyncEvaluation 并执行到 await。回到 A 时，A 发现 requiredModule 的 AsyncEvaluation 为 true，于是 PendingAsyncDependencies 加一，并把 A 加入 B.AsyncParentModules。

A 自己没有 await，仍不能立即 ExecuteModule。它处于 evaluating-async，等待计数归零。B fulfilled 后 GatherAvailableAncestors 收集 A，A 作为同步父模块执行，随后继续唤醒更上层 importer。

若 A 同时依赖 B 与 C 两个异步分支，pending count 初始为 2。先完成一个只减到 1，不执行 A；两个都完成才归零。兄弟分支可并发推进，父模块形成 join barrier。

async contagion 沿静态 evaluation-phase edges 传播，却不要求所有模块本身都有 HasTLA。设计图时应把“contains await”和“is delayed by async dependency”标成两个字段。

#### 代码

```typescript
type AsyncState = {
  hasTLA: boolean
  pendingAsyncDependencies: number
  asyncParents: Set<string>
}

function registerAsyncDependency(
  parent: ModuleNode,
  dependency: ModuleNode
): void {
  parent.pendingAsyncDependencies += 1
  dependency.asyncParents.add(parent)
}
```

#### 本章结论

HasTLA 是模块自身属性，AsyncEvaluation 是传递状态；同步父模块也可能等待多个异步子模块形成 join。

### ordinal 保住可观察的启动次序

kicker: "03 · EVALUATION ORDER"

异步依赖完成时，可能同时解锁多个祖先。规范记录模块被标记 AsyncEvaluation 的顺序，并让可用祖先按该顺序执行，避免 promise 完成竞态任意改变无 await 父模块的顶层副作用顺序。

V8 使用 async_evaluation_ordinal 落地这一顺序；完成后写特殊 finished 值。GatherAvailableAncestors 递减计数并把归零祖先放进有序集合，随后依次 ExecuteAsyncModule 或同步 ExecuteModule。

这不代表两个真正含 await 的兄弟模块不会交错。每个模块在 await 处分段，promise 完成先后决定恢复时刻；保证关注依赖约束与可用祖先排序，不是把整图串行化。

测试不要只断言最终 exports。记录 start、before await、after await、parent execute 的时间线，才能证明兄弟并发、父 join 与顺序稳定。

#### 代码

```typescript
const trace: string[] = []

// b.ts
trace.push("B:start")
await gateB
trace.push("B:done")

// c.ts
trace.push("C:start")
await gateC
trace.push("C:done")

// a.ts 静态依赖 B/C，只有两者 done 后才运行。
trace.push("A:execute")
```

#### 本章结论

异步分支可交错，依赖屏障与 async ordinal 保证可用祖先的确定启动顺序。

### rejection 会沿 AsyncParentModules 传播并固化

kicker: "04 · ERROR PROPAGATION"

TLA await 的 promise reject、恢复后的顶层 throw 或依赖异步失败都会进入 AsyncModuleExecutionRejected。当前模块保存 EvaluationError、转 evaluated/errored，并递归处理所有 async parents。

父模块不会执行一半再收到错误；它还在等待 dependency barrier，错误直接让其 evaluation 失败。入口 Module Record 的 TopLevelCapability 被 reject，dynamic import promise 也拒绝，调用者应在真正加载边界处理。

同一 Module Record 的错误被缓存。重试 import 不会重新 fetch 配置或再次连接数据库；若失败来源可恢复，应把操作移进显式 async function，让调用者控制 retry、backoff、timeout 与 cancellation。

错误应附带 module URL、阶段、dependency chain 与 cause。只显示顶层“failed to fetch dynamically imported module”会丢掉真正的 TLA rejection；浏览器跨源与 source map 还需单独配置。

#### 代码

```typescript
// 不把可重试网络事务固化为模块求值失败。
let cached: Promise<Config> | undefined

export function loadConfig(options: {
  signal: AbortSignal
  force?: boolean
}): Promise<Config> {
  if (!cached || options.force) {
    cached = fetchConfig(options.signal).catch(error => {
      cached = undefined // 明确允许下一次重试
      throw error
    })
  }
  return cached
}
```

#### 本章结论

异步模块失败沿父图传播且被实例缓存；需要重试的业务 I/O 应放进显式函数状态机。

### TLA waterfall 来自 await 的启动时机

kicker: "05 · WATERFALL"

独立操作连续 `const a=await loadA(); const b=await loadB()` 会让 B 在 A 完成后才启动，形成网络或初始化 waterfall。模块图再把这段延迟传播给所有 importer，冷启动代价放大。

若两项没有数据依赖，应先 `const pa=loadA(); const pb=loadB();` 再 `await Promise.all([pa,pb])`。静态兄弟依赖的执行也可并发暂停，但模块内顺序 await 仍由代码决定。

TLA 还会影响 bundler chunk evaluation、SSR 首请求与 test discovery。大型共享模块中的全局 await 把低频能力变成所有入口的冷启动依赖；把它移动到 feature dynamic import 或显式 ready promise 可缩小 blast radius。

优化要测 resolve/load/link/evaluate 各段，不能只看 network waterfall。CPU parse、模块数量、source map、loader hook 和 await I/O 都可能占据启动关键路径。

#### 代码

```typescript
// 串行：约等于两段延迟相加
// const locale = await loadLocale()
// const flags = await loadFlags()

// 并行启动，再统一形成模块 ready barrier。
const localePromise = loadLocale()
const flagsPromise = loadFlags()

export const [locale, flags] = await Promise.all([
  localePromise,
  flagsPromise
])
```

#### 本章结论

TLA 本身不要求串行；先启动独立 promise 再 join，才能避免把 waterfall 传播到整个 importer 图。

### 等待环可能越过静态图，运行时无法替你消除死锁

kicker: "06 · ASYNC DEADLOCK"

静态 SCC 算法能处理模块依赖环，却看不见任意 promise 的业务等待关系。A 的 TLA await 一个只有 B 顶层执行后才 resolve 的 gate，而 B 又静态等待 A 完成，双方可永久 pending。

危险写法还包括在模块 TLA 中 `await import()` 一个求值依赖最终回到当前模块的模块。dynamic import promise 要等目标 evaluation 完成，目标又等待当前 root，形成跨静态/动态边的等待环。

规范维持 pending，不会为任意 promise 建 wait-for graph 并抛 deadlock error。Node 对永不完成的入口 TLA有进程退出行为，但服务内 worker、浏览器页面或嵌套 dynamic import 仍可能表现为永久 loading。

工程保护包括启动 deadline、ready 状态机、wait-for trace、禁止模块顶层等待应用事件，以及将双向握手移到图求值后的 orchestration phase。timeout 只能暴露问题，不能自动恢复半初始化全局状态。

#### 代码

```typescript
export async function bootWithDeadline(
  boot: Promise<void>,
  timeoutMs: number
): Promise<void> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error("module boot deadline exceeded")),
      timeoutMs
    )
  })
  await Promise.race([boot, timeout])
}
```

#### 本章结论

模块 SCC 只处理静态依赖；promise wait-for edge 能形成永久 pending，需显式 deadline 与启动协议。

### SSR、CLI 与 Worker 的 ready 边界不同

kicker: "07 · HOST STARTUP"

浏览器 entry module TLA 未完成时，依赖它的模块不执行，但 DOM 已存在、其他独立脚本和事件循环可继续。UI 应先有静态 shell 与 loading/error state，避免把首屏全部藏在入口完成之后。

SSR server 若在共享模块顶层 await 数据库连接，进程启动会等待一次；若模块按 tenant/request 动态生成 identity，可能把连接等待复制多次。请求态初始化不应塞进进程级 Module Record。

CLI 入口可以自然 await 配置和命令执行，但要给 stderr、exit code 与 signal cancellation。Worker 可用首条 ready/error message 暴露模块图完成，主线程设置 timeout 并在失败时 terminate。

库作者尤其应谨慎发布含 TLA 的公共入口，因为同步加载方、旧 bundler、测试 runner 与 CJS require 可能无法消费。可提供同步核心入口与显式 async init，或在 package exports 中分开条件入口。

#### 代码

```typescript
// worker-entry.ts
try {
  const runtime = await createRuntime()
  postMessage({ type: "ready" })
  onmessage = event => runtime.handle(event.data)
} catch (error) {
  postMessage({
    type: "startup-error",
    message: error instanceof Error ? error.message : String(error)
  })
}
```

#### 本章结论

TLA 的产品影响取决于宿主 ready 合同；浏览器 shell、SSR 进程、CLI 和 Worker 应分别设计。

### 异步模块测试要控制 gate，而非依赖真实时间

kicker: "08 · VERIFICATION"

用 deferred promise 控制 B/C 完成顺序，断言父 A 在 pending count 归零前没有执行。测试至少覆盖 B 先完成、C 先完成、一个 reject、永不 resolve 与重复 import。

每个 case 使用新 worker/子进程或独立 vm module graph，避免 module cache 让第二个 case 直接复用 evaluated 状态。fake timers 不能自动完成原生 promise jobs，仍需明确 flush microtasks。

性能测试记录每个模块 evaluation start/end、await reason 与 parent unblock，输出 critical path。总启动时间不是所有模块耗时相加，应找出最长依赖链和未并行启动的 I/O。

发布 gate 可禁止基础库入口新增 HasTLA，或要求标注 startup budget、timeout、fallback 与 CJS compatibility。规则应基于 package 层级和用户影响，不能简单全局禁用。

#### 代码

```typescript
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok
    reject = fail
  })
  return { promise, resolve, reject }
}

const left = deferred<void>()
const right = deferred<void>()
// 注入 evaluator 后，分别 release 并断言 parent execute 时机。
```

#### 本章结论

用可控 deferred、隔离 module cache 和 critical-path trace 验证异步依赖图，避免靠 sleep 猜时序。

## 核心机制

- Source Text Module 的 HasTLA 表示自身包含顶层 await，ExecuteModule 通过 PromiseCapability 暂停与恢复。
- 依赖异步模块的同步父模块也进入 async evaluation，但自身 HasTLA 仍为 false。
- 每条未完成异步依赖让父模块 PendingAsyncDependencies 加一，并把父加入依赖的 AsyncParentModules。
- 计数归零后父模块才可执行，多个异步兄弟形成 join barrier。
- AsyncEvaluation ordinal 保留可用祖先的确定执行顺序，兄弟 await 仍可按 promise 完成交错。
- AsyncModuleExecutionFulfilled 标记当前模块完成，收集并执行新可用祖先。
- AsyncModuleExecutionRejected 沿 async parent 图传播同一错误并拒绝入口 top-level capability。
- TLA 释放执行栈，不阻塞 event loop；被延迟的是静态 importer 的顶层求值与应用 ready。
- 任意 promise wait-for edge 可形成规范无法检测的永久 pending，需 deadline 与启动 trace。
- 模块实例缓存 evaluated/errored 结果，可重试 I/O 应由显式函数状态机管理。

## 常见误区

- 说 TLA 阻塞浏览器线程，混淆执行栈释放与模块启动屏障。
- 只给含 await 的模块标 async，漏掉被异步依赖拖入 evaluating-async 的父模块。
- 异步依赖完成一个就执行父模块，忽略 PendingAsyncDependencies join 计数。
- 用 promise 完成竞态任意调度祖先，破坏 async evaluation ordinal 的可观察顺序。
- 模块 TLA rejection 后反复 import 期待重试，实际复用 errored Module Record。
- 在公共基础模块连续 await 独立 I/O，制造全图 cold-start waterfall。
- 在 TLA 中 dynamic import 回到当前 evaluation root，形成永久等待环。
- 用 timeout 之后继续使用半初始化 singleton，没有失败原子性和清理协议。
- SSR 把 request/tenant 初始化放进进程级模块顶层，错误共享生命周期。
- 库入口无条件使用 TLA，破坏同步 CJS consumer 与部分工具链。
- 测试依赖 sleep 与真实网络，无法稳定覆盖祖先解锁次序。
- 只测最终值，不记录 before/after await 与 parent execute 时间线。

## 实现变体

### 边界模块中的受控 TLA

useWhen: "应用 entry/worker entry 必须在暴露 ready 前完成一次不可选的异步配置，所有消费者都支持 ESM async evaluation。"
tradeoff: "调用表面简洁；失败和冷启动传播到整个 importer 图，必须有 timeout、fallback 与 telemetry。"

#### 代码

```typescript
const configPromise = fetchConfig()
const localePromise = loadLocale()
export const [config, locale] = await Promise.all([
  configPromise,
  localePromise
])
```

### 显式 ready Promise

useWhen: "模块需要同步暴露类型/函数，同时允许调用者决定何时等待初始化。"
tradeoff: "兼容面更宽并能控制 timeout；调用者可能忘记 await，需要 API guard 或状态检查。"

#### 代码

```typescript
export const ready = initialize()
export async function query(input: Input) {
  await ready
  return runtime.query(input)
}
```

### async factory

useWhen: "初始化需要重试、多个实例、不同租户配置或显式资源释放。"
tradeoff: "生命周期最清楚；每个调用点要持有实例并处理失败、取消和 close。"

#### 代码

```typescript
export async function createClient(
  config: Config,
  signal: AbortSignal
): Promise<Client> {
  const transport = await connect(config, signal)
  return new Client(transport)
}
```

## 可运行示例

```typescript
type AsyncStatus =
  | "linked"
  | "evaluating"
  | "evaluating-async"
  | "evaluated"
  | "errored"

class Deferred<T> {
  readonly promise: Promise<T>
  resolve!: (value: T) => void
  reject!: (reason: unknown) => void

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject
    })
  }
}

class AsyncModuleNode {
  status: AsyncStatus = "linked"
  pendingAsyncDependencies = 0
  readonly asyncParents = new Set<AsyncModuleNode>()
  asyncOrdinal = -1
  error: unknown
  completion = new Deferred<void>()

  constructor(
    readonly id: string,
    readonly hasTLA: boolean,
    readonly dependencies: AsyncModuleNode[],
    readonly executeBody: () => void | Promise<void>
  ) {}
}

class AsyncModuleEvaluator {
  private nextOrdinal = 0
  readonly trace: string[] = []

  evaluate(entry: AsyncModuleNode): Promise<void> {
    this.prepare(entry, new Set())
    return entry.completion.promise
  }

  private prepare(
    module: AsyncModuleNode,
    visiting: Set<AsyncModuleNode>
  ): void {
    if (module.status !== "linked") return
    if (visiting.has(module)) return
    visiting.add(module)
    module.status = "evaluating"
    this.trace.push("visit:" + module.id)

    for (const dependency of module.dependencies) {
      this.prepare(dependency, visiting)
      if (
        dependency.status === "evaluating-async" ||
        dependency.status === "evaluating"
      ) {
        module.pendingAsyncDependencies += 1
        dependency.asyncParents.add(module)
      } else if (dependency.status === "errored") {
        this.reject(module, dependency.error)
        return
      }
    }
    visiting.delete(module)

    if (module.pendingAsyncDependencies > 0 || module.hasTLA) {
      module.status = "evaluating-async"
      module.asyncOrdinal = this.nextOrdinal++
      this.trace.push(
        "async:" + module.id +
        ":pending=" + String(module.pendingAsyncDependencies)
      )
      if (module.pendingAsyncDependencies === 0) {
        void this.execute(module)
      }
    } else {
      void this.execute(module)
    }
  }

  private async execute(module: AsyncModuleNode): Promise<void> {
    this.trace.push("execute:" + module.id)
    try {
      await module.executeBody()
      this.fulfill(module)
    } catch (error) {
      this.reject(module, error)
    }
  }

  private fulfill(module: AsyncModuleNode): void {
    if (module.status === "evaluated") return
    module.status = "evaluated"
    this.trace.push("fulfilled:" + module.id)
    module.completion.resolve()

    const available: AsyncModuleNode[] = []
    for (const parent of module.asyncParents) {
      if (parent.status === "errored") continue
      parent.pendingAsyncDependencies -= 1
      this.trace.push(
        "decrement:" + parent.id +
        "=" + String(parent.pendingAsyncDependencies)
      )
      if (parent.pendingAsyncDependencies === 0) available.push(parent)
    }

    available.sort((a, b) => a.asyncOrdinal - b.asyncOrdinal)
    for (const parent of available) void this.execute(parent)
  }

  private reject(module: AsyncModuleNode, error: unknown): void {
    if (module.status === "errored") return
    module.status = "errored"
    module.error = error
    this.trace.push("rejected:" + module.id)
    module.completion.reject(error)
    // 防止教学示例的未处理 rejection 污染控制台。
    void module.completion.promise.catch(() => {})
    for (const parent of module.asyncParents) {
      this.reject(parent, error)
    }
  }
}

const gateB = new Deferred<void>()
const gateC = new Deferred<void>()
const execution: string[] = []

const bAsync = new AsyncModuleNode("B", true, [], async () => {
  execution.push("B:start")
  await gateB.promise
  execution.push("B:done")
})

const cAsync = new AsyncModuleNode("C", true, [], async () => {
  execution.push("C:start")
  await gateC.promise
  execution.push("C:done")
})

const aParent = new AsyncModuleNode(
  "A",
  false,
  [bAsync, cAsync],
  () => {
    execution.push("A:execute")
  }
)

const evaluatorAsync = new AsyncModuleEvaluator()
const ready = evaluatorAsync.evaluate(aParent)

await Promise.resolve()
console.assert(execution.includes("B:start"))
console.assert(execution.includes("C:start"))
console.assert(!execution.includes("A:execute"))

gateC.resolve()
await Promise.resolve()
await Promise.resolve()
console.assert(!execution.includes("A:execute"))

gateB.resolve()
await ready
console.assert(execution.at(-1) === "A:execute")
console.assert(aParent.status === "evaluated")

// 失败会沿 async parent 传播。
const failure = new Error("config unavailable")
const brokenChild = new AsyncModuleNode(
  "broken-child",
  true,
  [],
  async () => { throw failure }
)
const brokenParent = new AsyncModuleNode(
  "broken-parent",
  false,
  [brokenChild],
  () => { console.assert(false) }
)

try {
  await new AsyncModuleEvaluator().evaluate(brokenParent)
  console.assert(false)
} catch (error) {
  console.assert(error === failure)
  console.assert(brokenParent.status === "errored")
}
```

## 搭积木复现

### 积木 1：给 Module Record 加异步字段

加入 hasTLA、pendingAsyncDependencies、asyncParents、asyncOrdinal、completion 与 error；区分模块自身 async 与被依赖拖入 async。

### 积木 2：传播 async dependency

父模块看到 dependency evaluating-async 时计数加一，并注册到 child.asyncParents；用两兄弟图断言 pending=2。

### 积木 3：启动零依赖 async module

pending=0 且 hasTLA 时立即 execute，executeBody 返回 promise；同步父模块此时仍不得执行。

### 积木 4：实现 fulfilled 解锁

child 完成后递减每个 parent；只收集归零祖先，按 asyncOrdinal 排序后执行，覆盖 B/C 不同完成顺序。

### 积木 5：实现 rejected 传播

保存首次 error，拒绝 completion 并递归 asyncParents；父 execute 计数必须保持零，重复 evaluate 复用同一失败。

### 积木 6：制造并诊断 waterfall

分别实现连续 await 与先启动后 Promise.all，使用可控 deferred 或本地延迟测量关键路径，解释差值来源。

### 积木 7：加入启动 deadline 与 trace

记录 module、await reason、queued/start/finish、pending parents；永不 resolve case 要在 deadline 后给出 wait-for 链。

### 积木 8：设计宿主 ready 合同

为浏览器 shell、SSR 进程或 Worker 选择一个场景，实现 ready/error/timeout/cancel，并说明为何这里使用 TLA、ready promise 或 async factory。

## 自检

### 问题

入口 A 自身没有 await，但静态依赖 B、C；B 与 C 都含 TLA，B 先完成，C 后完成。A 为什么仍属于 async evaluation？B 完成时为什么不能立刻执行 A？C 完成后运行时如何找到并安排 A？若 C reject，A 的顶层代码是否会执行，入口 import 得到什么？

### 站内答案

InnerModuleEvaluation 处理 A 时发现 B、C 的 AsyncEvaluation 均为 true，于是 A 的 PendingAsyncDependencies 增加到 2，并把 A 分别加入 B、C 的 AsyncParentModules；A 虽然 HasTLA=false，仍转入 evaluating-async，因为它的执行被异步依赖屏障延迟。B fulfilled 后 AsyncModuleExecutionFulfilled 只把 A 的计数减为 1，尚有 C 未完成，因此 A 不可执行。C fulfilled 后计数归零，GatherAvailableAncestors 把 A 放入可执行集合，并按 A 获得 async evaluation ordinal 的顺序安排；由于 A 自身无 TLA，运行时同步 ExecuteModule(A)，完成后继续解锁上游。若 C reject，AsyncModuleExecutionRejected 把同一错误传播给 A 及更上层 async parents，A 的顶层代码保持未执行，entry Module Record 的 TopLevelCapability 被 reject，所以静态入口启动失败，dynamic import 则返回 rejected promise。
