---
id: "typescript-01-11"
track: "typescript"
title: "ESM 实例化、Module Environment 与 live binding"
depth: "deep"
visualIndex: "../visuals/typescript-01-11.md"
exampleLanguage: "typescript"
readingMinutes: 42
sourceMinutes: 34
practiceMinutes: 54
reviewMinutes: 15
---

## 官方入口

title: "ECMAScript Language Specification · Source Text Module Record · InitializeEnvironment"
url: "https://tc39.es/ecma262/multipage/ecmascript-language-scripts-and-modules.html#sec-source-text-module-record-initialize-environment"

InitializeEnvironment 为模块建立 Module Environment Record，创建本地声明 binding，并把每个 import 建成指向目标模块 binding 的 immutable indirect binding。导入方不能重新赋值，但每次读取都会取得导出方当前值。

## 真实源码

repo: "v8/v8"
file: "src/objects/source-text-module.cc"
symbol: "CreateExport / GetCell / LoadVariable / StoreVariable"
language: "cpp"
url: "https://github.com/v8/v8/blob/main/src/objects/source-text-module.cc#L135-L180"

### 逐段讲解

- CreateExport 为一个 regular export 分配 Cell，并把所有导出别名都映射到同一个 Cell。同一本地 binding 用多个名称导出时，不会复制多个值。
- cell_index 的正负编码区分 regular export 与 regular import；GetCell 据此从 regular_exports 或 regular_imports 取出 Cell。
- LoadVariable 不关心当前索引来自 import 还是 export，只读取共享 Cell 的 value，因此 importer 天然观察到 exporter 后续写入。
- StoreVariable 只允许 kExport 索引。import binding 在语义上不可赋值，编译器不会为它产生合法的 StoreVariable 路径。
- FinishInstantiate 的 ResolveImport 会递归执行 ResolveExport，取得真正提供该名称的 Cell，并把同一个 Cell 写入 importer 的 regular_imports。
- indirect export 和 star export 也最终解析到 Cell；若多个 star exports 把同名解析到不同 Cell，该名称被标记为 ambiguous，而不是随意选择一个。
- Cell 是 V8 的实现策略；规范层表达为 Module Environment 的 indirect binding。课程会分别说明，避免把某个引擎数据结构误当成语言必须采用的布局。

### 源码节选

```cpp
// 摘自 V8 main/src/objects/source-text-module.cc。
// 真实实现用共享 Cell 落实 live binding；中文注释补充语义分层。
void SourceTextModule::CreateExport(
    Isolate* isolate,
    DirectHandle<SourceTextModule> module,
    int cell_index,
    DirectHandle<FixedArray> names) {
  const uint32_t names_len = names->ulength().value();
  DCHECK_LT(0, names_len);

  // 一个本地导出 binding 对应一个 Cell。
  DirectHandle<Cell> cell = isolate->factory()->NewCell();
  module->regular_exports()->set(ExportIndex(cell_index), *cell);

  Handle<ObjectHashTable> exports(module->exports(), isolate);
  for (uint32_t i = 0; i < names_len; ++i) {
    DirectHandle<String> name(Cast<String>(names->get(i)), isolate);
    DCHECK(IsTheHole(exports->Lookup(name)));
    // export { value, value as alias } 都指向同一个 Cell。
    exports = ObjectHashTable::Put(isolate, exports, name, cell);
  }
  module->set_exports(*exports);
}

Tagged<Cell> SourceTextModule::GetCell(int cell_index) {
  DisallowGarbageCollection no_gc;
  Tagged<Object> cell;
  switch (SourceTextModuleDescriptor::GetCellIndexKind(cell_index)) {
    case SourceTextModuleDescriptor::kImport:
      // 链接阶段已把目标模块的 Cell 放入 regular_imports。
      cell = regular_imports()->get(ImportIndex(cell_index));
      break;
    case SourceTextModuleDescriptor::kExport:
      cell = regular_exports()->get(ExportIndex(cell_index));
      break;
    case SourceTextModuleDescriptor::kInvalid:
      UNREACHABLE();
  }
  return Cast<Cell>(cell);
}

Handle<Object> SourceTextModule::LoadVariable(
    Isolate* isolate,
    DirectHandle<SourceTextModule> module,
    int cell_index) {
  // import 与 export 都读 Cell 当前值，而非链接时快照。
  return handle(module->GetCell(cell_index)->value(), isolate);
}

void SourceTextModule::StoreVariable(
    DirectHandle<SourceTextModule> module,
    int cell_index,
    DirectHandle<Object> value) {
  DisallowGarbageCollection no_gc;
  // 只有本模块自己的导出 binding 可写；import binding 不可重绑定。
  DCHECK_EQ(SourceTextModuleDescriptor::GetCellIndexKind(cell_index),
            SourceTextModuleDescriptor::kExport);
  module->GetCell(cell_index)->set_value(*value);
}
```

## 导读

ES module 不是把被导入文件的文本粘贴到当前文件，也不是执行一次后复制 exports 对象。宿主先解析模块得到 Module Record，解析其静态 ModuleRequests，加载依赖图，再执行 linking/instantiation 建立环境与 binding，最后才 evaluate 顶层代码。把“创建连接”和“运行初始化代码”分开，循环依赖、提前校验缺失导出和 live binding 才有可靠语义。

import { count } from "./counter.js" 创建的是本地名称 count 到目标模块 binding 的间接连接。导入方不能 count=7，因为 import binding immutable；导出方执行 count++ 后，同一 import 再读会取得新值。这里的 immutable 约束的是连接不能被导入方改指，目标 binding 本身可由 exporter 按 let/var 规则更新。

本课按 Parse → LoadRequestedModules → Link/InitializeEnvironment → Evaluate 四阶段重建 ESM。你会手写 ModuleRecord、Cell、ResolveExport、ModuleEnvironment、namespace view 和 linker，覆盖缺失导出、重复 binding、TDZ、别名再导出和 single evaluation。下一课再在此基础上加入强连通分量、top-level await 与 Node ESM/CJS 互操作。


## 分章正文

### Module parse goal 先建立静态图所需的记录

kicker: "01 · PARSE MODULE"

同一段源码以 Script goal 和 Module goal 解析会得到不同合同。Module 默认是 strict mode，顶层 this 为 undefined，静态 import/export 只允许出现在模块语法允许的位置；重复导出、无法在语法层绑定的名称等问题可在执行前成为 early error。解析产物不是普通 AST alone，还会整理 [[RequestedModules]]、[[ImportEntries]]、[[LocalExportEntries]]、[[IndirectExportEntries]] 和 [[StarExportEntries]]。

静态 import 的 specifier 必须在解析后可枚举，宿主因此能在任何顶层语句运行前加载完整依赖图。if 条件里的按需加载要使用 import()，它返回 promise 并走宿主动态加载流程；它不创建当前模块词法作用域中的静态 import binding。

ModuleRequest 不直接等于最终文件。浏览器通常按 URL 与 import map 解析，Node 还根据 package exports、type、extension 和条件决定格式；bundler 可以使用自己的解析图。ECMAScript 从 HostLoadImportedModule 接收解析后的 Module Record，语言规范不规定 node_modules 搜索。

工程上应把 specifier、resolved identity、format 和 load attributes 分开保存。同一文本通过不同 URL query 可能成为不同模块实例；重写路径别名时若编译器和运行时规则不一致，类型检查成功仍会在部署时加载失败。

#### 代码

```typescript
type ImportEntry = {
  specifier: string
  importName: string | "*"   // "*" 表示 namespace request
  localName: string
}

type ExportEntry =
  | { kind: "local"; exportName: string; localName: string }
  | {
      kind: "indirect"
      exportName: string
      specifier: string
      importName: string
    }
  | { kind: "star"; specifier: string }

type ParsedModule = {
  requests: string[]
  imports: ImportEntry[]
  exports: ExportEntry[]
  execute: (env: ModuleEnvironment) => void
}
```

#### 本章结论

Module goal 在执行前提取依赖与导入导出记录；specifier 到 Module Record 的解析仍由宿主负责。

### Load、Link 与 Evaluate 是三种不同失败边界

kicker: "02 · MODULE PIPELINE"

LoadRequestedModules 让宿主递归取得依赖 Module Records。失败可能来自 URL 解析、网络、权限、MIME、文件格式或 parse error。加载完成只说明图的节点可得，不代表顶层副作用已经发生。

Link 对模块图执行 InitializeEnvironment。此阶段创建本地 binding，解析每个 import/re-export 指向哪个目标 binding，并拒绝 missing/ambiguous export。因为链接发生在 evaluate 前，import { missing } 的失败不会先运行依赖模块一半的顶层副作用。

Evaluate 才执行模块顶层代码，初始化 let/const/class、运行表达式与副作用。同步图中的依赖按规范 DFS/SCC 顺序求值，每个 Module Record 对同一实例只求值一次。evaluate 失败被模块记录保存，之后访问同一失败实例不会像普通函数那样从头重试。

诊断日志应给每个 resolved module identity 记录 parsed、loaded、linking、linked、evaluating、evaluated/errored 状态与原因。只打印“import failed”会把解析器、resolver、链接器和用户顶层异常混在一起，导致错误的重试与缓存策略。

#### 代码

```typescript
type ModuleStatus =
  | "new"
  | "loaded"
  | "linking"
  | "linked"
  | "evaluating"
  | "evaluated"
  | "errored"

type ModuleTrace = {
  url: string
  status: ModuleStatus
  error?: unknown
}

// resolver/load 失败、link 失败、evaluate 失败必须分别报告。
async function importWithTrace(url: string): Promise<unknown> {
  performance.mark(url + ":import:start")
  try {
    return await import(url)
  } finally {
    performance.mark(url + ":import:end")
  }
}
```

#### 本章结论

load 取得图，link 建 binding，evaluate 才运行顶层代码；三阶段有不同错误、缓存和副作用边界。

### Module Environment 同时保存直接 binding 与间接 binding

kicker: "03 · ENVIRONMENT RECORD"

InitializeEnvironment 创建新的 Module Environment Record，其 [[OuterEnv]] 通常连接 realm 的 Global Environment。模块顶层 var、let、const、class、function 都是模块环境中的 binding，不会像 Script 顶层 var 那样成为 globalThis property。模块环境的 GetThisBinding 返回 undefined。

本地声明使用 Declarative Environment 的可变或不可变 binding 协议。binding 可以已创建但未初始化，读取会抛 ReferenceError；let/const/class 要到 evaluation 执行相应声明才初始化，顶层 function declaration 可在实例化阶段建立可调用值。这个时序形成模块 TDZ，并直接影响循环依赖。

CreateImportBinding(env,N,M,N2) 创建已初始化、不可重绑定的 indirect binding。它保存目标 Module Record M 与目标名称 N2；GetBindingValue 遇到 indirect binding 时进入 M.[[Environment]].GetBindingValue(N2,true)，所以读取发生在使用时，而不是 link 时复制。

“import 是 const”只表达不能在 importer 里赋值，却遗漏了 indirect 读取。真正模型是一块不可改线的标签：本地名称永远连向指定目标 binding；目标 binding 若由 exporter 更新，下一次沿线读取就看到新值。

#### 代码

```typescript
const UNINITIALIZED = Symbol("uninitialized")

class BindingCell<T = unknown> {
  value: T | typeof UNINITIALIZED = UNINITIALIZED

  read(name: string): T {
    if (this.value === UNINITIALIZED) {
      throw new ReferenceError(name + " is not initialized")
    }
    return this.value
  }
}

type DirectBinding = {
  kind: "direct"
  mutable: boolean
  cell: BindingCell
}

type ImportBinding = {
  kind: "import"
  targetModule: MiniModule
  targetName: string
}
```

#### 本章结论

模块本地声明是 direct binding，import 是已初始化的 immutable indirect binding；两者都可能最终读取目标 Cell。

### ResolveExport 解析的是 binding 身份，不是当前值

kicker: "04 · RESOLVE EXPORT"

export { local as public } 把 export name public 映射到当前模块 local binding；export { name } from "./dep.js" 是 indirect export，当前模块没有可读取的本地 name；export * from 会在请求名称时遍历依赖，但不转发 default。三种表面语法最终都要回答“这个 export name 由哪个模块的哪个 binding 提供”。

ResolveExport(module,exportName,resolveSet) 递归寻找唯一 Resolution Record。resolveSet 记录已经访问的 module/name 对，防止 star re-export 环无限递归。若没有匹配得到 null；若多条 star 路径得到不同目标 binding，则返回 ambiguous；若都落到同一 binding，即使路径不同也仍是唯一解析。

linker 对每个 ImportEntry 调被请求模块的 ResolveExport。missing 与 ambiguous 必须在 link 阶段报 SyntaxError 类失败，不能等读取时返回 undefined。这个区别让重构或包升级在应用启动时暴露接口不兼容。

default 只是 export name "default"，语法糖的本地 binding 细节因声明形式不同。不要把 default 与 namespace object 本身混为一谈；import * as ns 得到 namespace exotic object，ns.default 才是目标的 default export。

#### 代码

```typescript
type Resolution = {
  module: MiniModule
  localName: string
}

type ResolveResult = Resolution | "ambiguous" | null

function sameResolution(a: Resolution, b: Resolution): boolean {
  return a.module === b.module && a.localName === b.localName
}

// export * 冲突必须显式变为 ambiguous。
function mergeResolution(
  current: ResolveResult,
  next: ResolveResult
): ResolveResult {
  if (next === null) return current
  if (current === null) return next
  if (current === "ambiguous" || next === "ambiguous") return "ambiguous"
  return sameResolution(current, next) ? current : "ambiguous"
}
```

#### 本章结论

ResolveExport 沿 local、indirect、star 路径寻找唯一 binding 身份；缺失和歧义应在 link 时失败。

### live binding 让更新可见，但不共享普通对象之外的赋值权限

kicker: "05 · LIVE BINDING"

counter.js 中 export let count=0; export function inc(){count++}。consumer 导入 count 与 inc，调用 inc 后再读 count 得到 1。importer 没有执行“同步变量”的回调；两处读取都命中 exporter 的同一 binding/Cell，第二次自然取得新值。

若导出的是 const settings={theme:"dark"}，importer 不能给 settings 重新赋值，但双方仍引用同一个普通对象，任一有权限的代码可修改 settings.theme，除非对象被冻结或 API 隐藏可变引用。binding immutability 与对象深层不可变性属于两个维度。

使用 const snapshot=count 会在当前执行时复制数值，之后 snapshot 不再 live；对象解构 const {x}=namespace 也会读取一次 property。测试 live binding 时应从 import binding 或 namespace property 重新读取，不能先复制到局部再期待自动更新。

编译器可能把 ESM 变换成 getter、runtime helper 或内部 slot，只要可观察语义保持。tree shaking 则依赖静态 export 图与副作用分析；它不是 live binding 的定义，也不能因为某个 bundler 输出了对象属性就推断原生 ESM 只是一份 exports object。

#### 代码

```typescript
// counter.ts
export let count = 0
export function increment() {
  count += 1
}

// consumer.ts
import { count, increment } from "./counter.js"

console.assert(count === 0)
increment()
console.assert(count === 1) // 再读同一目标 binding

const snapshot = count
increment()
console.assert(count === 2)
console.assert(snapshot === 1) // 普通局部值不会 live
```

#### 本章结论

live 的是 import 到目标 binding 的读取关系；赋值给普通局部后就是快照，对象内部可变性也另行决定。

### Module Namespace Exotic Object 是只读的 live view

kicker: "06 · NAMESPACE OBJECT"

import * as ns from "./counter.js" 或 import() 完成后得到 Module Namespace Exotic Object。它的字符串键来自 GetExportedNames 后的唯一可解析 exports，按规范排序；对象通常不可扩展、原型为 null，并带 Symbol.toStringTag="Module"。它看起来像对象，却有专用 [[Get]]、[[Set]]、[[DefineOwnProperty]] 等内部方法。

读取 ns.count 会解析 export 并从目标 Module Environment 取当前 binding 值，所以 namespace property 同样 live。写 ns.count=3 在 module strict code 中失败；defineProperty 也不能把它改成独立数据槽。Property descriptor 表面可能显示 writable:true，这是为了与动态值兼容，不代表 [[Set]] 允许写。

namespace object 的 identity 对同一 Module Record 通常稳定，dynamic import 多次可返回同一 namespace view；但 resolved URL、query、realm/loader cache 边界会决定是否真是同一 Module Record。业务缓存应使用规范化模块 identity，而不是只比较原始 specifier 字符串。

API 不应把 namespace 当作普通配置对象 clone/merge 后再假设仍 live。需要可变 facade 时显式建立自己的对象和更新协议；需要只读观察时 namespace 正好表达导出面。

#### 代码

```typescript
import * as counter from "./counter.js"

console.assert(Object.getPrototypeOf(counter) === null)
console.assert(Object.isExtensible(counter) === false)
console.assert(
  Object.prototype.toString.call(counter) === "[object Module]"
)

const before = counter.count
counter.increment()
console.assert(counter.count === before + 1)

try {
  // TypeScript 通常先报类型错，运行时的 namespace [[Set]] 也会拒绝。
  ;(counter as { count: number }).count = 99
} catch (error) {
  console.assert(error instanceof TypeError)
}
```

#### 本章结论

namespace 是稳定、不可扩展、不可写的导出 live view；它的内部方法不同于普通对象。

### TDZ 与声明初始化时机解释“能链接却不能读”

kicker: "07 · INITIALIZATION"

link 成功只证明 import name 唯一解析到一个 binding，不证明该 binding 已有值。export let answer=42 的 binding 在 InitializeEnvironment 已创建，直到 exporter evaluation 运行声明才 InitializeBinding；过早 GetBindingValue 会抛 ReferenceError。这与 missing export 的 link error 是不同层次。

顶层函数声明通常在模块声明实例化时初始化，因此循环中调用某个已实例化函数有时可行；但函数体若立刻读取尚未初始化的 let，仍会失败。class 与 const/let 继续受 TDZ。用“函数提升所以循环都安全”会掩盖函数依赖的其他 binding。

var binding 在模块环境中建立并初始化为 undefined，随后赋值；它不成为 globalThis 属性。虽然 var 能减少 TDZ 异常，却可能让循环中读取静默得到 undefined，更难诊断。公共模块状态优先用显式初始化顺序和函数 API，而非靠 var 回避错误。

测试应分别覆盖：不存在名称在 link 时失败；存在但未初始化在 evaluate 时 ReferenceError；初始化后读取成功；exporter 更新后 importer 再读更新。四个断言才能证明 linker 同时实现解析正确性和 live binding。

#### 代码

```typescript
// a.ts
import { readB } from "./b.js"
export const a = readB() // 调用能解析，但 readB 内部可能过早读 b

// b.ts
import { a } from "./a.js"
export function readB() {
  return b
}
export const b = "ready"

// 循环的链接可以成功；求值时 readB 读取未初始化 b，抛 ReferenceError。
// 下一课会用 SCC 和 DFS 求值顺序完整推演这条路径。
```

#### 本章结论

link 解析 binding 身份，evaluation 初始化 binding 值；missing export 与 TDZ 失败必须分开诊断。

### 模块 API 设计要控制副作用、身份与测试隔离

kicker: "08 · ENGINEERING CONTRACT"

模块顶层副作用在首次 evaluate 时运行，后续同一实例 import 复用缓存。隐式注册全局 handler、读取环境变量、启动 timer 或连接外部服务会让 import 本身变成隐藏生命周期。更易测试的设计是顶层只声明值与工厂，把启动放入显式 start(config) 并提供幂等 stop。

singleton module state 对同一 loader cache 共享，测试之间可能相互污染；带 query 的 dynamic import、vm context 或不同 worker 又可能创建新实例。可变状态若属于请求、用户或测试，应放进显式对象并通过构造/依赖注入传递，避免把“模块只执行一次”误当成进程级唯一性。

barrel export * 方便聚合，却会扩大图、制造名称歧义、掩盖副作用与形成循环。公共包入口适合显式 re-export 稳定 API；内部性能敏感路径可直接导入定义模块。配合 package exports 限制深层入口，比靠目录习惯更能维护兼容边界。

可观测性至少记录 resolved URL、loader/realm、load/link/evaluate 时长、失败阶段和依赖父节点。生产故障中“开发正常、部署 import 失败”常来自大小写、extension、MIME、条件 exports 或生成产物遗漏；这些都需要 resolver 证据，无法从 TypeScript 类型图推断。

#### 代码

```typescript
// lifecycle.ts：模块本身不在 import 时连接外部资源。
let stopCurrent: (() => Promise<void>) | undefined

export async function start(config: Config): Promise<void> {
  if (stopCurrent) return
  const resource = await connect(config)
  stopCurrent = () => resource.close()
}

export async function stop(): Promise<void> {
  const close = stopCurrent
  stopCurrent = undefined
  await close?.()
}

export function createSession(deps: Dependencies): Session {
  return new Session(deps) // 请求态显式实例化，不塞入模块 singleton
}
```

#### 本章结论

模块缓存适合稳定定义与受控单例；资源、副作用和请求态应有显式生命周期与身份边界。

## 核心机制

- Module goal 解析产生 ModuleRequests、ImportEntries 与多类 ExportEntries。
- 宿主把 specifier 解析/加载为唯一 Module Record；ECMAScript 不规定 node_modules 或 HTTP 细节。
- LoadRequestedModules 取得图，Link/InitializeEnvironment 建环境和 binding，Evaluate 才运行顶层代码。
- Module Environment 保存 direct binding 与 immutable indirect import binding，顶层 this 为 undefined。
- ResolveExport 找到唯一的 module/localName binding 身份，并在缺失或 star 歧义时使链接失败。
- import binding 每次读取目标 binding 当前值，导入方不能改线，导出方仍可按声明规则更新。
- V8 为 regular export 创建 Cell，并在 FinishInstantiate 让 importer 引用同一个 Cell。
- Module Namespace Exotic Object 提供不可扩展、不可写、按 export 名读取的 live view。
- binding 创建与初始化分离，link 成功后仍可能在 evaluation 因 TDZ 抛 ReferenceError。
- 同一 Module Record 通常只 evaluate 一次；resolved identity、loader 与 realm 决定实例边界。

## 常见误区

- 把 ESM 当成源码文本拼接，无法解释静态图、early error、单次求值和循环链接。
- 把 import binding 说成值拷贝，导致 exporter 更新后 importer 错误地保留旧值。
- 把 live binding 等同于深层不可变，忽略导出对象内部仍可能被修改。
- 把 import 叫 const 后停止解释，遗漏它是 indirect binding 而普通 const 是 direct binding。
- 在 link 时读取 export 当前值，破坏 TDZ、循环依赖和后续更新可见性。
- missing export 返回 undefined，错过规范要求的链接阶段失败。
- export * 冲突时按遍历顺序选择，制造构建顺序相关 API。
- 把 namespace object 当普通对象写入或 clone 后仍期待 live。
- 认为模块 cache 等于整个进程单例，忽略 URL query、worker、realm 与 loader 边界。
- 在模块顶层启动不可逆资源，使 import、测试隔离和失败重试都带隐藏副作用。
- 用 barrel 无限制 export *，形成大图、名称歧义和隐式循环。
- TypeScript paths 只改类型/编译解析，却没有让运行时 resolver 使用同一映射。

## 实现变体

### named live exports

useWhen: "库需要静态可分析的稳定 API，并允许导出方更新少量可观察状态。"
tradeoff: "tree shaking 与重构工具友好；公共可变 binding 会制造时序耦合，优先导出函数或只读视图。"

#### 代码

```typescript
let status: "idle" | "ready" = "idle"
export { status }
export function markReady() {
  status = "ready"
}
```

### namespace capability object

useWhen: "一组相关操作需要作为单个依赖传递、替换或 mock，而调用者不需要按 export 静态裁剪。"
tradeoff: "依赖注入和版本化清晰；属性级 tree shaking 可能更弱，对象内部可变性需要另定合同。"

#### 代码

```typescript
export interface Clock {
  now(): number
  sleep(ms: number): Promise<void>
}

export const systemClock: Clock = {
  now: () => Date.now(),
  sleep: ms => new Promise(resolve => setTimeout(resolve, ms))
}
```

### dynamic import boundary

useWhen: "功能可延迟加载、依赖条件只在运行时已知，或需隔离较大可选模块。"
tradeoff: "减少初始图并形成异步边界；错误延迟到运行时，还需处理 chunk、缓存、预取与失败 UI。"

#### 代码

```typescript
export async function openEditor(kind: "text" | "image") {
  const module = kind === "image"
    ? await import("./image-editor.js")
    : await import("./text-editor.js")
  return module.createEditor()
}
```

## 可运行示例

```typescript
const UNINITIALIZED = Symbol("uninitialized")

class LinkError extends Error {}

class Cell<T = unknown> {
  private current: T | typeof UNINITIALIZED = UNINITIALIZED

  initialize(value: T): void {
    if (this.current !== UNINITIALIZED) {
      throw new TypeError("binding already initialized")
    }
    this.current = value
  }

  set(value: T): void {
    if (this.current === UNINITIALIZED) {
      throw new ReferenceError("binding is not initialized")
    }
    this.current = value
  }

  get(name: string): T {
    if (this.current === UNINITIALIZED) {
      throw new ReferenceError(name + " is not initialized")
    }
    return this.current
  }
}

type LocalExport = {
  kind: "local"
  exportName: string
  localName: string
}

type IndirectExport = {
  kind: "indirect"
  exportName: string
  from: string
  importName: string
}

type StarExport = {
  kind: "star"
  from: string
}

type ExportSpec = LocalExport | IndirectExport | StarExport

type ImportSpec = {
  from: string
  importName: string
  localName: string
}

type Resolution = {
  module: MiniModule
  localName: string
}

type ResolveResult = Resolution | "ambiguous" | null

class ModuleEnvironment {
  private locals = new Map<string, Cell>()
  private imports = new Map<string, Resolution>()

  createLocal(name: string): Cell {
    if (this.locals.has(name) || this.imports.has(name)) {
      throw new LinkError("duplicate binding: " + name)
    }
    const cell = new Cell()
    this.locals.set(name, cell)
    return cell
  }

  createImport(name: string, target: Resolution): void {
    if (this.locals.has(name) || this.imports.has(name)) {
      throw new LinkError("duplicate binding: " + name)
    }
    this.imports.set(name, target)
  }

  localCell(name: string): Cell {
    const cell = this.locals.get(name)
    if (!cell) throw new LinkError("unknown local binding: " + name)
    return cell
  }

  get(name: string): unknown {
    const local = this.locals.get(name)
    if (local) return local.get(name)

    const target = this.imports.get(name)
    if (!target) throw new ReferenceError(name + " is not defined")
    return target.module.environment.localCell(target.localName).get(name)
  }

  setLocal(name: string, value: unknown): void {
    this.localCell(name).set(value)
  }

  set(name: string, value: unknown): void {
    if (this.imports.has(name)) {
      throw new TypeError("cannot assign to import binding: " + name)
    }
    this.setLocal(name, value)
  }
}

class MiniModule {
  readonly environment = new ModuleEnvironment()
  status: "new" | "linking" | "linked" | "evaluated" = "new"

  constructor(
    readonly id: string,
    readonly localNames: string[],
    readonly imports: ImportSpec[],
    readonly exports: ExportSpec[],
    readonly execute: (env: ModuleEnvironment) => void
  ) {}

  resolveExport(
    name: string,
    seen = new Set<string>()
  ): ResolveResult {
    const visitKey = this.id + "::" + name
    if (seen.has(visitKey)) return null
    seen.add(visitKey)

    for (const entry of this.exports) {
      if (entry.kind === "local" && entry.exportName === name) {
        return { module: this, localName: entry.localName }
      }
      if (entry.kind === "indirect" && entry.exportName === name) {
        return registry.get(entry.from)!.resolveExport(entry.importName, seen)
      }
    }

    if (name === "default") return null
    let result: ResolveResult = null
    for (const entry of this.exports) {
      if (entry.kind !== "star") continue
      const next = registry.get(entry.from)!.resolveExport(name, seen)
      if (next === null) continue
      if (next === "ambiguous") return "ambiguous"
      if (result === null) {
        result = next
      } else if (
        result === "ambiguous" ||
        result.module !== next.module ||
        result.localName !== next.localName
      ) {
        return "ambiguous"
      }
    }
    return result
  }

  link(): void {
    if (this.status === "linked" || this.status === "evaluated") return
    if (this.status === "linking") return // 下一课会用 SCC 完整处理循环
    this.status = "linking"

    for (const name of this.localNames) {
      this.environment.createLocal(name)
    }

    for (const spec of this.imports) {
      const dependency = registry.get(spec.from)
      if (!dependency) throw new LinkError("module not found: " + spec.from)
      dependency.link()
      const target = dependency.resolveExport(spec.importName)
      if (target === null) {
        throw new LinkError("missing export: " + spec.importName)
      }
      if (target === "ambiguous") {
        throw new LinkError("ambiguous export: " + spec.importName)
      }
      this.environment.createImport(spec.localName, target)
    }

    this.status = "linked"
  }

  evaluate(): void {
    if (this.status === "evaluated") return
    if (this.status !== "linked") this.link()
    for (const spec of this.imports) {
      registry.get(spec.from)!.evaluate()
    }
    this.execute(this.environment)
    this.status = "evaluated"
  }

  namespace(): Readonly<Record<string, unknown>> {
    const names = this.exports
      .filter((entry): entry is LocalExport | IndirectExport =>
        entry.kind !== "star"
      )
      .map(entry => entry.exportName)
      .sort()
    const view = Object.create(null) as Record<string, unknown>
    for (const name of names) {
      Object.defineProperty(view, name, {
        enumerable: true,
        configurable: false,
        get: () => {
          const target = this.resolveExport(name)
          if (!target || target === "ambiguous") {
            throw new LinkError("unresolved namespace export: " + name)
          }
          return target.module.environment.localCell(
            target.localName
          ).get(name)
        }
      })
    }
    return Object.preventExtensions(view)
  }
}

const registry = new Map<string, MiniModule>()

const counter = new MiniModule(
  "counter",
  ["count", "increment"],
  [],
  [
    { kind: "local", exportName: "count", localName: "count" },
    { kind: "local", exportName: "increment", localName: "increment" }
  ],
  env => {
    env.localCell("count").initialize(0)
    env.localCell("increment").initialize(() => {
      const next = Number(env.get("count")) + 1
      env.setLocal("count", next)
    })
  }
)

const consumer = new MiniModule(
  "consumer",
  ["observed"],
  [
    { from: "counter", importName: "count", localName: "count" },
    { from: "counter", importName: "increment", localName: "inc" }
  ],
  [{ kind: "local", exportName: "observed", localName: "observed" }],
  env => {
    const inc = env.get("inc") as () => void
    console.assert(env.get("count") === 0)
    inc()
    console.assert(env.get("count") === 1) // live read
    env.localCell("observed").initialize(env.get("count"))

    try {
      env.set("count", 99)
      console.assert(false)
    } catch (error) {
      console.assert(error instanceof TypeError)
    }
  }
)

registry.set(counter.id, counter)
registry.set(consumer.id, consumer)

consumer.link()
consumer.evaluate()

console.assert(consumer.namespace().observed === 1)
console.assert(counter.namespace().count === 1)

// missing export 必须在 link 阶段失败，不能成为 undefined。
const broken = new MiniModule(
  "broken",
  [],
  [{ from: "counter", importName: "missing", localName: "x" }],
  [],
  () => {}
)
registry.set(broken.id, broken)

try {
  broken.link()
  console.assert(false)
} catch (error) {
  console.assert(error instanceof LinkError)
}
```

## 搭积木复现

### 积木 1：把 parse 结果变成 ImportEntry 与 ExportEntry

不必先写完整 parser；直接构造 records，区分 local export、indirect export、star export 与 namespace import，并用 module id 代替宿主 URL resolver。

### 积木 2：实现带 TDZ 的 Cell

Cell 初始为 UNINITIALIZED；initialize 只能一次，get 在初始化前抛 ReferenceError，set 只允许已初始化 mutable binding。

### 积木 3：建立 ModuleEnvironment

direct binding 保存本地 Cell；import binding 保存 module/localName Resolution。对 import 的 set 必须抛 TypeError，而 get 沿目标 binding 读取。

### 积木 4：实现 ResolveExport

先处理 local 与 indirect，再处理 star；用 module/name 访问集切断递归。分别测试 missing、同一 binding 多路径与两个不同 binding 的 ambiguous。

### 积木 5：实现 link 而不执行用户代码

创建所有本地 Cell，递归链接依赖，把每个 import 指向唯一 Resolution。加入 execute 计数器，证明 missing export 失败时顶层副作用为零。

### 积木 6：实现 evaluate 与 single execution

依赖先 evaluate，当前 execute 初始化 binding；重复 evaluate 不再运行。记录状态转换，并让顶层异常进入 errored 状态作为扩展。

### 积木 7：实现 namespace live view

用 getter 按 export name 重新读取目标 Cell，Object.preventExtensions 禁止扩展；测试 exporter 更新后 namespace property 改变，解构快照保持旧值。

### 积木 8：对照 V8 Cell 与规范 indirect binding

在图上标出规范的 Module Environment/Resolution 与 V8 regular_exports/regular_imports/Cell。列出教学版未覆盖的 Realm、namespace exotic 内部方法、import attributes 与 host loader。

## 自检

### 问题

模块 A 执行 export let count=0 并导出 increment；模块 B import { count, increment }。链接结束但求值尚未开始时，B 的 count binding 是否已存在、是否能读取、是否能赋值？求值完成后调用 increment，为什么 B 再读 count 会变化，而 const snapshot=count 不会？请同时用规范 Module Environment 与 V8 Cell 解释。

### 站内答案

链接阶段 B 的本地 import binding 已通过 CreateImportBinding 建立，它是已初始化且不可重绑定的 indirect binding，目标为 A 的 count binding；A 的 count direct binding 也已经创建，但 export let 的值要到 A 求值执行声明时才初始化。因此此时 B 能解析名称，却在读取目标未初始化 binding 时得到 ReferenceError；给 B 的 count 赋值始终因 import binding immutable 而失败。A 求值后，count 的目标 binding/Cell 保存 0。increment 在 A 内更新同一 binding，B 下一次 GetBindingValue 会沿间接 binding 进入 A 环境并读取当前值；V8 对应地让 B 的 regular_imports 与 A 的 regular_exports 保存同一个 Cell，所以 LoadVariable 取得新值。const snapshot=count 则在声明执行时把数值 0 复制进 B 的普通 direct binding，之后没有间接连接，故不会随 A 的 Cell 更新。
