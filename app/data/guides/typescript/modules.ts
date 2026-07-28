import type { TopicGuide } from '../../topic-guides'

export const typescriptModuleGuides: Record<string, TopicGuide> = {
  'ESM 实例化、Module Environment 与 live binding': {
    official: {
      title: 'ECMAScript Language Specification · Source Text Module Record · InitializeEnvironment',
      url: 'https://tc39.es/ecma262/multipage/ecmascript-language-scripts-and-modules.html#sec-source-text-module-record-initialize-environment',
      note: 'InitializeEnvironment 为模块建立 Module Environment Record，创建本地声明 binding，并把每个 import 建成指向目标模块 binding 的 immutable indirect binding。导入方不能重新赋值，但每次读取都会取得导出方当前值。'
    },
    source: {
      repo: 'v8/v8',
      file: 'src/objects/source-text-module.cc',
      symbol: 'CreateExport / GetCell / LoadVariable / StoreVariable',
      language: 'cpp',
      url: 'https://github.com/v8/v8/blob/main/src/objects/source-text-module.cc#L135-L180',
      walkthrough: [
        'CreateExport 为一个 regular export 分配 Cell，并把所有导出别名都映射到同一个 Cell。同一本地 binding 用多个名称导出时，不会复制多个值。',
        'cell_index 的正负编码区分 regular export 与 regular import；GetCell 据此从 regular_exports 或 regular_imports 取出 Cell。',
        'LoadVariable 不关心当前索引来自 import 还是 export，只读取共享 Cell 的 value，因此 importer 天然观察到 exporter 后续写入。',
        'StoreVariable 只允许 kExport 索引。import binding 在语义上不可赋值，编译器不会为它产生合法的 StoreVariable 路径。',
        'FinishInstantiate 的 ResolveImport 会递归执行 ResolveExport，取得真正提供该名称的 Cell，并把同一个 Cell 写入 importer 的 regular_imports。',
        'indirect export 和 star export 也最终解析到 Cell；若多个 star exports 把同名解析到不同 Cell，该名称被标记为 ambiguous，而不是随意选择一个。',
        'Cell 是 V8 的实现策略；规范层表达为 Module Environment 的 indirect binding。课程会分别说明，避免把某个引擎数据结构误当成语言必须采用的布局。'
      ],
      code: `// 摘自 V8 main/src/objects/source-text-module.cc。
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
}`
    },
    overview: [
      'ES module 不是把被导入文件的文本粘贴到当前文件，也不是执行一次后复制 exports 对象。宿主先解析模块得到 Module Record，解析其静态 ModuleRequests，加载依赖图，再执行 linking/instantiation 建立环境与 binding，最后才 evaluate 顶层代码。把“创建连接”和“运行初始化代码”分开，循环依赖、提前校验缺失导出和 live binding 才有可靠语义。',
      'import { count } from "./counter.js" 创建的是本地名称 count 到目标模块 binding 的间接连接。导入方不能 count=7，因为 import binding immutable；导出方执行 count++ 后，同一 import 再读会取得新值。这里的 immutable 约束的是连接不能被导入方改指，目标 binding 本身可由 exporter 按 let/var 规则更新。',
      '本课按 Parse → LoadRequestedModules → Link/InitializeEnvironment → Evaluate 四阶段重建 ESM。你会手写 ModuleRecord、Cell、ResolveExport、ModuleEnvironment、namespace view 和 linker，覆盖缺失导出、重复 binding、TDZ、别名再导出和 single evaluation。下一课再在此基础上加入强连通分量、top-level await 与 Node ESM/CJS 互操作。'
    ],
    chapters: [
      {
        title: 'Module parse goal 先建立静态图所需的记录',
        kicker: '01 · PARSE MODULE',
        paragraphs: [
          '同一段源码以 Script goal 和 Module goal 解析会得到不同合同。Module 默认是 strict mode，顶层 this 为 undefined，静态 import/export 只允许出现在模块语法允许的位置；重复导出、无法在语法层绑定的名称等问题可在执行前成为 early error。解析产物不是普通 AST alone，还会整理 [[RequestedModules]]、[[ImportEntries]]、[[LocalExportEntries]]、[[IndirectExportEntries]] 和 [[StarExportEntries]]。',
          '静态 import 的 specifier 必须在解析后可枚举，宿主因此能在任何顶层语句运行前加载完整依赖图。if 条件里的按需加载要使用 import()，它返回 promise 并走宿主动态加载流程；它不创建当前模块词法作用域中的静态 import binding。',
          'ModuleRequest 不直接等于最终文件。浏览器通常按 URL 与 import map 解析，Node 还根据 package exports、type、extension 和条件决定格式；bundler 可以使用自己的解析图。ECMAScript 从 HostLoadImportedModule 接收解析后的 Module Record，语言规范不规定 node_modules 搜索。',
          '工程上应把 specifier、resolved identity、format 和 load attributes 分开保存。同一文本通过不同 URL query 可能成为不同模块实例；重写路径别名时若编译器和运行时规则不一致，类型检查成功仍会在部署时加载失败。'
        ],
        code: `type ImportEntry = {
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
}`,
        language: 'typescript',
        takeaway: 'Module goal 在执行前提取依赖与导入导出记录；specifier 到 Module Record 的解析仍由宿主负责。'
      },
      {
        title: 'Load、Link 与 Evaluate 是三种不同失败边界',
        kicker: '02 · MODULE PIPELINE',
        paragraphs: [
          'LoadRequestedModules 让宿主递归取得依赖 Module Records。失败可能来自 URL 解析、网络、权限、MIME、文件格式或 parse error。加载完成只说明图的节点可得，不代表顶层副作用已经发生。',
          'Link 对模块图执行 InitializeEnvironment。此阶段创建本地 binding，解析每个 import/re-export 指向哪个目标 binding，并拒绝 missing/ambiguous export。因为链接发生在 evaluate 前，import { missing } 的失败不会先运行依赖模块一半的顶层副作用。',
          'Evaluate 才执行模块顶层代码，初始化 let/const/class、运行表达式与副作用。同步图中的依赖按规范 DFS/SCC 顺序求值，每个 Module Record 对同一实例只求值一次。evaluate 失败被模块记录保存，之后访问同一失败实例不会像普通函数那样从头重试。',
          '诊断日志应给每个 resolved module identity 记录 parsed、loaded、linking、linked、evaluating、evaluated/errored 状态与原因。只打印“import failed”会把解析器、resolver、链接器和用户顶层异常混在一起，导致错误的重试与缓存策略。'
        ],
        code: `type ModuleStatus =
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
}`,
        language: 'typescript',
        takeaway: 'load 取得图，link 建 binding，evaluate 才运行顶层代码；三阶段有不同错误、缓存和副作用边界。'
      },
      {
        title: 'Module Environment 同时保存直接 binding 与间接 binding',
        kicker: '03 · ENVIRONMENT RECORD',
        paragraphs: [
          'InitializeEnvironment 创建新的 Module Environment Record，其 [[OuterEnv]] 通常连接 realm 的 Global Environment。模块顶层 var、let、const、class、function 都是模块环境中的 binding，不会像 Script 顶层 var 那样成为 globalThis property。模块环境的 GetThisBinding 返回 undefined。',
          '本地声明使用 Declarative Environment 的可变或不可变 binding 协议。binding 可以已创建但未初始化，读取会抛 ReferenceError；let/const/class 要到 evaluation 执行相应声明才初始化，顶层 function declaration 可在实例化阶段建立可调用值。这个时序形成模块 TDZ，并直接影响循环依赖。',
          'CreateImportBinding(env,N,M,N2) 创建已初始化、不可重绑定的 indirect binding。它保存目标 Module Record M 与目标名称 N2；GetBindingValue 遇到 indirect binding 时进入 M.[[Environment]].GetBindingValue(N2,true)，所以读取发生在使用时，而不是 link 时复制。',
          '“import 是 const”只表达不能在 importer 里赋值，却遗漏了 indirect 读取。真正模型是一块不可改线的标签：本地名称永远连向指定目标 binding；目标 binding 若由 exporter 更新，下一次沿线读取就看到新值。'
        ],
        code: `const UNINITIALIZED = Symbol("uninitialized")

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
}`,
        language: 'typescript',
        takeaway: '模块本地声明是 direct binding，import 是已初始化的 immutable indirect binding；两者都可能最终读取目标 Cell。'
      },
      {
        title: 'ResolveExport 解析的是 binding 身份，不是当前值',
        kicker: '04 · RESOLVE EXPORT',
        paragraphs: [
          'export { local as public } 把 export name public 映射到当前模块 local binding；export { name } from "./dep.js" 是 indirect export，当前模块没有可读取的本地 name；export * from 会在请求名称时遍历依赖，但不转发 default。三种表面语法最终都要回答“这个 export name 由哪个模块的哪个 binding 提供”。',
          'ResolveExport(module,exportName,resolveSet) 递归寻找唯一 Resolution Record。resolveSet 记录已经访问的 module/name 对，防止 star re-export 环无限递归。若没有匹配得到 null；若多条 star 路径得到不同目标 binding，则返回 ambiguous；若都落到同一 binding，即使路径不同也仍是唯一解析。',
          'linker 对每个 ImportEntry 调被请求模块的 ResolveExport。missing 与 ambiguous 必须在 link 阶段报 SyntaxError 类失败，不能等读取时返回 undefined。这个区别让重构或包升级在应用启动时暴露接口不兼容。',
          'default 只是 export name "default"，语法糖的本地 binding 细节因声明形式不同。不要把 default 与 namespace object 本身混为一谈；import * as ns 得到 namespace exotic object，ns.default 才是目标的 default export。'
        ],
        code: `type Resolution = {
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
}`,
        language: 'typescript',
        takeaway: 'ResolveExport 沿 local、indirect、star 路径寻找唯一 binding 身份；缺失和歧义应在 link 时失败。'
      },
      {
        title: 'live binding 让更新可见，但不共享普通对象之外的赋值权限',
        kicker: '05 · LIVE BINDING',
        paragraphs: [
          'counter.js 中 export let count=0; export function inc(){count++}。consumer 导入 count 与 inc，调用 inc 后再读 count 得到 1。importer 没有执行“同步变量”的回调；两处读取都命中 exporter 的同一 binding/Cell，第二次自然取得新值。',
          '若导出的是 const settings={theme:"dark"}，importer 不能给 settings 重新赋值，但双方仍引用同一个普通对象，任一有权限的代码可修改 settings.theme，除非对象被冻结或 API 隐藏可变引用。binding immutability 与对象深层不可变性属于两个维度。',
          '使用 const snapshot=count 会在当前执行时复制数值，之后 snapshot 不再 live；对象解构 const {x}=namespace 也会读取一次 property。测试 live binding 时应从 import binding 或 namespace property 重新读取，不能先复制到局部再期待自动更新。',
          '编译器可能把 ESM 变换成 getter、runtime helper 或内部 slot，只要可观察语义保持。tree shaking 则依赖静态 export 图与副作用分析；它不是 live binding 的定义，也不能因为某个 bundler 输出了对象属性就推断原生 ESM 只是一份 exports object。'
        ],
        code: `// counter.ts
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
console.assert(snapshot === 1) // 普通局部值不会 live`,
        language: 'typescript',
        takeaway: 'live 的是 import 到目标 binding 的读取关系；赋值给普通局部后就是快照，对象内部可变性也另行决定。'
      },
      {
        title: 'Module Namespace Exotic Object 是只读的 live view',
        kicker: '06 · NAMESPACE OBJECT',
        paragraphs: [
          'import * as ns from "./counter.js" 或 import() 完成后得到 Module Namespace Exotic Object。它的字符串键来自 GetExportedNames 后的唯一可解析 exports，按规范排序；对象通常不可扩展、原型为 null，并带 Symbol.toStringTag="Module"。它看起来像对象，却有专用 [[Get]]、[[Set]]、[[DefineOwnProperty]] 等内部方法。',
          '读取 ns.count 会解析 export 并从目标 Module Environment 取当前 binding 值，所以 namespace property 同样 live。写 ns.count=3 在 module strict code 中失败；defineProperty 也不能把它改成独立数据槽。Property descriptor 表面可能显示 writable:true，这是为了与动态值兼容，不代表 [[Set]] 允许写。',
          'namespace object 的 identity 对同一 Module Record 通常稳定，dynamic import 多次可返回同一 namespace view；但 resolved URL、query、realm/loader cache 边界会决定是否真是同一 Module Record。业务缓存应使用规范化模块 identity，而不是只比较原始 specifier 字符串。',
          'API 不应把 namespace 当作普通配置对象 clone/merge 后再假设仍 live。需要可变 facade 时显式建立自己的对象和更新协议；需要只读观察时 namespace 正好表达导出面。'
        ],
        code: `import * as counter from "./counter.js"

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
}`,
        language: 'typescript',
        takeaway: 'namespace 是稳定、不可扩展、不可写的导出 live view；它的内部方法不同于普通对象。'
      },
      {
        title: 'TDZ 与声明初始化时机解释“能链接却不能读”',
        kicker: '07 · INITIALIZATION',
        paragraphs: [
          'link 成功只证明 import name 唯一解析到一个 binding，不证明该 binding 已有值。export let answer=42 的 binding 在 InitializeEnvironment 已创建，直到 exporter evaluation 运行声明才 InitializeBinding；过早 GetBindingValue 会抛 ReferenceError。这与 missing export 的 link error 是不同层次。',
          '顶层函数声明通常在模块声明实例化时初始化，因此循环中调用某个已实例化函数有时可行；但函数体若立刻读取尚未初始化的 let，仍会失败。class 与 const/let 继续受 TDZ。用“函数提升所以循环都安全”会掩盖函数依赖的其他 binding。',
          'var binding 在模块环境中建立并初始化为 undefined，随后赋值；它不成为 globalThis 属性。虽然 var 能减少 TDZ 异常，却可能让循环中读取静默得到 undefined，更难诊断。公共模块状态优先用显式初始化顺序和函数 API，而非靠 var 回避错误。',
          '测试应分别覆盖：不存在名称在 link 时失败；存在但未初始化在 evaluate 时 ReferenceError；初始化后读取成功；exporter 更新后 importer 再读更新。四个断言才能证明 linker 同时实现解析正确性和 live binding。'
        ],
        code: `// a.ts
import { readB } from "./b.js"
export const a = readB() // 调用能解析，但 readB 内部可能过早读 b

// b.ts
import { a } from "./a.js"
export function readB() {
  return b
}
export const b = "ready"

// 循环的链接可以成功；求值时 readB 读取未初始化 b，抛 ReferenceError。
// 下一课会用 SCC 和 DFS 求值顺序完整推演这条路径。`,
        language: 'typescript',
        takeaway: 'link 解析 binding 身份，evaluation 初始化 binding 值；missing export 与 TDZ 失败必须分开诊断。'
      },
      {
        title: '模块 API 设计要控制副作用、身份与测试隔离',
        kicker: '08 · ENGINEERING CONTRACT',
        paragraphs: [
          '模块顶层副作用在首次 evaluate 时运行，后续同一实例 import 复用缓存。隐式注册全局 handler、读取环境变量、启动 timer 或连接外部服务会让 import 本身变成隐藏生命周期。更易测试的设计是顶层只声明值与工厂，把启动放入显式 start(config) 并提供幂等 stop。',
          'singleton module state 对同一 loader cache 共享，测试之间可能相互污染；带 query 的 dynamic import、vm context 或不同 worker 又可能创建新实例。可变状态若属于请求、用户或测试，应放进显式对象并通过构造/依赖注入传递，避免把“模块只执行一次”误当成进程级唯一性。',
          'barrel export * 方便聚合，却会扩大图、制造名称歧义、掩盖副作用与形成循环。公共包入口适合显式 re-export 稳定 API；内部性能敏感路径可直接导入定义模块。配合 package exports 限制深层入口，比靠目录习惯更能维护兼容边界。',
          '可观测性至少记录 resolved URL、loader/realm、load/link/evaluate 时长、失败阶段和依赖父节点。生产故障中“开发正常、部署 import 失败”常来自大小写、extension、MIME、条件 exports 或生成产物遗漏；这些都需要 resolver 证据，无法从 TypeScript 类型图推断。'
        ],
        code: `// lifecycle.ts：模块本身不在 import 时连接外部资源。
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
}`,
        language: 'typescript',
        takeaway: '模块缓存适合稳定定义与受控单例；资源、副作用和请求态应有显式生命周期与身份边界。'
      }
    ],
    mechanisms: [
      'Module goal 解析产生 ModuleRequests、ImportEntries 与多类 ExportEntries。',
      '宿主把 specifier 解析/加载为唯一 Module Record；ECMAScript 不规定 node_modules 或 HTTP 细节。',
      'LoadRequestedModules 取得图，Link/InitializeEnvironment 建环境和 binding，Evaluate 才运行顶层代码。',
      'Module Environment 保存 direct binding 与 immutable indirect import binding，顶层 this 为 undefined。',
      'ResolveExport 找到唯一的 module/localName binding 身份，并在缺失或 star 歧义时使链接失败。',
      'import binding 每次读取目标 binding 当前值，导入方不能改线，导出方仍可按声明规则更新。',
      'V8 为 regular export 创建 Cell，并在 FinishInstantiate 让 importer 引用同一个 Cell。',
      'Module Namespace Exotic Object 提供不可扩展、不可写、按 export 名读取的 live view。',
      'binding 创建与初始化分离，link 成功后仍可能在 evaluation 因 TDZ 抛 ReferenceError。',
      '同一 Module Record 通常只 evaluate 一次；resolved identity、loader 与 realm 决定实例边界。'
    ],
    pitfalls: [
      '把 ESM 当成源码文本拼接，无法解释静态图、early error、单次求值和循环链接。',
      '把 import binding 说成值拷贝，导致 exporter 更新后 importer 错误地保留旧值。',
      '把 live binding 等同于深层不可变，忽略导出对象内部仍可能被修改。',
      '把 import 叫 const 后停止解释，遗漏它是 indirect binding 而普通 const 是 direct binding。',
      '在 link 时读取 export 当前值，破坏 TDZ、循环依赖和后续更新可见性。',
      'missing export 返回 undefined，错过规范要求的链接阶段失败。',
      'export * 冲突时按遍历顺序选择，制造构建顺序相关 API。',
      '把 namespace object 当普通对象写入或 clone 后仍期待 live。',
      '认为模块 cache 等于整个进程单例，忽略 URL query、worker、realm 与 loader 边界。',
      '在模块顶层启动不可逆资源，使 import、测试隔离和失败重试都带隐藏副作用。',
      '用 barrel 无限制 export *，形成大图、名称歧义和隐式循环。',
      'TypeScript paths 只改类型/编译解析，却没有让运行时 resolver 使用同一映射。'
    ],
    variants: [
      {
        title: 'named live exports',
        useWhen: '库需要静态可分析的稳定 API，并允许导出方更新少量可观察状态。',
        tradeoff: 'tree shaking 与重构工具友好；公共可变 binding 会制造时序耦合，优先导出函数或只读视图。',
        code: `let status: "idle" | "ready" = "idle"
export { status }
export function markReady() {
  status = "ready"
}`,
        language: 'typescript'
      },
      {
        title: 'namespace capability object',
        useWhen: '一组相关操作需要作为单个依赖传递、替换或 mock，而调用者不需要按 export 静态裁剪。',
        tradeoff: '依赖注入和版本化清晰；属性级 tree shaking 可能更弱，对象内部可变性需要另定合同。',
        code: `export interface Clock {
  now(): number
  sleep(ms: number): Promise<void>
}

export const systemClock: Clock = {
  now: () => Date.now(),
  sleep: ms => new Promise(resolve => setTimeout(resolve, ms))
}`,
        language: 'typescript'
      },
      {
        title: 'dynamic import boundary',
        useWhen: '功能可延迟加载、依赖条件只在运行时已知，或需隔离较大可选模块。',
        tradeoff: '减少初始图并形成异步边界；错误延迟到运行时，还需处理 chunk、缓存、预取与失败 UI。',
        code: `export async function openEditor(kind: "text" | "image") {
  const module = kind === "image"
    ? await import("./image-editor.js")
    : await import("./text-editor.js")
  return module.createEditor()
}`,
        language: 'typescript'
      }
    ],
    studyPlan: {
      readingMinutes: 42,
      sourceMinutes: 34,
      practiceMinutes: 54,
      reviewMinutes: 15
    },
    exampleLanguage: 'typescript',
    example: `const UNINITIALIZED = Symbol("uninitialized")

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
}`,
    buildSteps: [
      {
        title: '积木 1：把 parse 结果变成 ImportEntry 与 ExportEntry',
        body: '不必先写完整 parser；直接构造 records，区分 local export、indirect export、star export 与 namespace import，并用 module id 代替宿主 URL resolver。'
      },
      {
        title: '积木 2：实现带 TDZ 的 Cell',
        body: 'Cell 初始为 UNINITIALIZED；initialize 只能一次，get 在初始化前抛 ReferenceError，set 只允许已初始化 mutable binding。'
      },
      {
        title: '积木 3：建立 ModuleEnvironment',
        body: 'direct binding 保存本地 Cell；import binding 保存 module/localName Resolution。对 import 的 set 必须抛 TypeError，而 get 沿目标 binding 读取。'
      },
      {
        title: '积木 4：实现 ResolveExport',
        body: '先处理 local 与 indirect，再处理 star；用 module/name 访问集切断递归。分别测试 missing、同一 binding 多路径与两个不同 binding 的 ambiguous。'
      },
      {
        title: '积木 5：实现 link 而不执行用户代码',
        body: '创建所有本地 Cell，递归链接依赖，把每个 import 指向唯一 Resolution。加入 execute 计数器，证明 missing export 失败时顶层副作用为零。'
      },
      {
        title: '积木 6：实现 evaluate 与 single execution',
        body: '依赖先 evaluate，当前 execute 初始化 binding；重复 evaluate 不再运行。记录状态转换，并让顶层异常进入 errored 状态作为扩展。'
      },
      {
        title: '积木 7：实现 namespace live view',
        body: '用 getter 按 export name 重新读取目标 Cell，Object.preventExtensions 禁止扩展；测试 exporter 更新后 namespace property 改变，解构快照保持旧值。'
      },
      {
        title: '积木 8：对照 V8 Cell 与规范 indirect binding',
        body: '在图上标出规范的 Module Environment/Resolution 与 V8 regular_exports/regular_imports/Cell。列出教学版未覆盖的 Realm、namespace exotic 内部方法、import attributes 与 host loader。'
      }
    ],
    selfCheckQuestion: '模块 A 执行 export let count=0 并导出 increment；模块 B import { count, increment }。链接结束但求值尚未开始时，B 的 count binding 是否已存在、是否能读取、是否能赋值？求值完成后调用 increment，为什么 B 再读 count 会变化，而 const snapshot=count 不会？请同时用规范 Module Environment 与 V8 Cell 解释。',
    selfCheckAnswer: '链接阶段 B 的本地 import binding 已通过 CreateImportBinding 建立，它是已初始化且不可重绑定的 indirect binding，目标为 A 的 count binding；A 的 count direct binding 也已经创建，但 export let 的值要到 A 求值执行声明时才初始化。因此此时 B 能解析名称，却在读取目标未初始化 binding 时得到 ReferenceError；给 B 的 count 赋值始终因 import binding immutable 而失败。A 求值后，count 的目标 binding/Cell 保存 0。increment 在 A 内更新同一 binding，B 下一次 GetBindingValue 会沿间接 binding 进入 A 环境并读取当前值；V8 对应地让 B 的 regular_imports 与 A 的 regular_exports 保存同一个 Cell，所以 LoadVariable 取得新值。const snapshot=count 则在声明执行时把数值 0 复制进 B 的普通 direct binding，之后没有间接连接，故不会随 A 的 Cell 更新。'
  },
  '循环依赖、SCC 求值与 TDZ 失败路径': {
    official: {
      title: 'ECMAScript Language Specification · InnerModuleEvaluation',
      url: 'https://tc39.es/ecma262/multipage/ecmascript-language-scripts-and-modules.html#sec-innermoduleevaluation',
      note: 'InnerModuleEvaluation 用 DFSIndex、DFSAncestorIndex 和显式 stack 遍历 Cyclic Module Records。遇到回边时更新 ancestor index；当节点成为强连通分量根，整组模块才从 evaluating 转为 evaluated 或 evaluating-async。'
    },
    source: {
      repo: 'v8/v8',
      file: 'src/objects/source-text-module.cc',
      symbol: 'SourceTextModule::InnerModuleEvaluation',
      language: 'cpp',
      url: 'https://github.com/v8/v8/blob/main/src/objects/source-text-module.cc#L1243-L1450',
      walkthrough: [
        '入口先处理 evaluating/evaluating-async/evaluated：回边再次访问正在求值的模块是 no-op，不会递归执行第二遍；errored 则重新抛出已记录异常。',
        'linked 模块进入 evaluating，写入 dfs_index 与 dfs_ancestor_index，随后压入显式 stack。两个索引对应 Tarjan strong-connect 算法的发现序号与 low-link。',
        '算法递归求值每个 evaluation-phase dependency。依赖仍为 evaluating 说明存在回边，当前模块把 ancestor index 降到依赖的 ancestor index。',
        '若依赖已完成一个 component，则后续错误和 async cycle root 从该 component root 传播；这避免把环内每个 Module Record 当成互相独立的生命周期。',
        '同步模块在依赖处理后 ExecuteModule；真正的 JavaScript 顶层代码到这里才运行。link 阶段建立 Cell，不保证此刻环上所有 Cell 已初始化。',
        '只有 dfs_ancestor_index==dfs_index 的 SCC root 才负责把 stack 上直到自身的模块整体 transition。环因此不会让状态永远停在 evaluating。',
        '当前 V8 还包含 defer/source-phase import 与 top-level await 分支；本课源码节选保留同步循环主线，异步字段留给下一课。'
      ],
      code: `// 摘自 V8 main/src/objects/source-text-module.cc。
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
}`
    },
    overview: [
      '循环依赖的定义很朴素：从模块 A 沿静态依赖边能到 B，又能从 B 的后继回到 A。它并不自动表示错误。ESM 在链接阶段先为整个强连通分量建立 binding，再在求值阶段按 DFS 运行模块，所以函数声明或延迟读取可以安全穿过环；真正危险的是顶层代码过早读取环上尚未初始化的 let、const 或 class。',
      '普通拓扑排序要求有向无环图，模块图却允许环。ECMAScript 使用与 Tarjan strongly connected components 相同的 DFSIndex、DFSAncestorIndex 和 stack 思想：回边降低 low-link；到达一个 component root 时，才把栈上整组 Module Records 一起完成状态迁移。这样既能阻止无限递归，也能让环拥有一致的 lifecycle root。',
      '本课会把上一课的 MiniModule linker 改造成 SCC-aware evaluator。你会手算 A→B→C→A 与 C→D 两类边，比较 function/var/let/class 的初始化时机，复现 TDZ、partial initialization 和 barrel cycle，并用 dependency inversion、第三模块抽取与延迟调用拆除真正有害的环。'
    ],
    chapters: [
      {
        title: '环是依赖图的结构，失败来自求值时访问时机',
        kicker: '01 · CYCLE VERSUS FAILURE',
        paragraphs: [
          'A import B 且 B import A 只说明图中存在一个 strongly connected component。linker 可以先遍历整个 component，为 A、B 的导出创建 Cell，再让 import bindings 指向目标 Cell。因此“两个文件互相 import 必定 undefined”并不符合 ESM 模型。',
          '失败要定位到某次 GetBindingValue。若 A 顶层在 B 尚未初始化 b 时执行 console.log(b)，读取目标 Cell 的 UNINITIALIZED 会抛 ReferenceError；若 A 只定义 function useB(){return b}，函数创建时不执行函数体，等整个图求值后调用就能成功。',
          '图结构、声明种类、顶层读取位置共同决定结果。同一个环把 export const 改为 export function 可能工作，把调用从顶层移动到 start() 也可能工作；这种“修复”必须解释初始化时序，不能只归因于导入顺序玄学。',
          '模块图由 resolved identity 构成。源码看似 A→B，barrel index.ts、path alias、package export 或 side-effect import 可能补出隐蔽回边。诊断要从构建器/metafile/loader trace 获取最终图，而不是只看当前两个文件。'
        ],
        code: `// safe-a.ts
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
// 结果取决于求值路径，可能在 valueA 初始化前抛 ReferenceError。`,
        language: 'typescript',
        takeaway: '循环只是 SCC；TDZ 失败来自具体顶层读取发生在目标 binding 初始化之前。'
      },
      {
        title: '为什么普通拓扑排序不够，Tarjan low-link 如何收拢 SCC',
        kicker: '02 · STRONGLY CONNECTED COMPONENT',
        paragraphs: [
          'DAG 可用入度为零的 Kahn algorithm 排序；包含环时，环内每个节点都有入边，队列无法取出。正确做法是先把每个 SCC 压缩为一个 component，得到的 condensation graph 一定是 DAG，再按 component 依赖顺序求值。',
          'Tarjan DFS 为首次访问节点分配 index，并令 lowLink=index，压入 stack。遍历边 u→v：v 未访问则递归后 low[u]=min(low[u],low[v])；v 仍在 stack 说明是通往当前活跃路径的回边，low[u]=min(low[u],index[v])。若 low[u]==index[u]，u 是 SCC root，持续弹栈直到 u。',
          'ECMAScript 字段名 DFSIndex 与 DFSAncestorIndex 对应 index 与 lowLink。规范的 stack 只包含正在 linking/evaluating 的 Module Records；状态检查非常重要，指向已经完成 component 的边不能把两个 SCC 错误合并。',
          '算法复杂度 O(V+E)，每个模块和依赖边只处理常数次。实际模块系统还要将 import phase、synthetic module、async evaluation 和错误传播叠加在同一遍历上，但 SCC 不变量仍是理解入口。'
        ],
        code: `function stronglyConnected<T>(
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
}`,
        language: 'typescript',
        takeaway: 'low-link 把所有互相可达的活跃节点收进一个 SCC；压缩后的 component graph 才能拓扑排序。'
      },
      {
        title: 'Link 与 Evaluate 各跑一次 SCC 状态机',
        kicker: '03 · TWO GRAPH PASSES',
        paragraphs: [
          'linking pass 递归依赖并调用 InitializeEnvironment。遇到 linking 节点表示回边，更新 ancestor index；SCC root 完成后，环内所有节点成为 linked。若某个 import 缺失、star export 歧义或初始化环境失败，stack 上相关模块退回/记录错误，不能留下半链接状态供后续使用。',
          'evaluation pass 从 entry 再做 DFS。模块进入 evaluating 后先处理依赖；遇到已 evaluating 节点直接返回 index，阻止递归第二遍。依赖处理完成后 ExecuteModule 当前顶层代码。到 SCC root 时，栈上 component 成员一起转 evaluated，或在 TLA 情况转 evaluating-async。',
          '“依赖先执行”对跨 SCC 的 DAG 边成立；环内没有一个能同时满足所有边的全序。DFS 后序给出某个确定执行路径，但模块代码必须遵守可初始化时机，不应依赖把 entry 换掉后偶然仍相同的环内顺序。',
          '同一个 Module Record 只执行一次。若 A 与 B 都从不同入口被 import，第二次 Evaluate 看到 evaluated/errored 状态并复用结果。模块顶层因此不应承担需要按调用重试的事务；失败恢复应该由显式函数与新业务状态完成。'
        ],
        code: `type EvalStatus =
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
}`,
        language: 'typescript',
        takeaway: '链接和求值都要对循环图做 component 级状态迁移；环内不能套用简单的“所有依赖严格先于当前模块”。'
      },
      {
        title: 'function、var、let/const/class 的初始化矩阵',
        kicker: '04 · TDZ MATRIX',
        paragraphs: [
          'ModuleDeclarationInstantiation 创建所有 bindings，却按声明类别采用不同初始化。可提升的顶层 function declaration 在环境初始化阶段获得函数对象，因此另一模块有机会在双方顶层代码前读取函数 binding；函数体中对其他 binding 的读取仍发生在调用时。',
          'var 声明的模块 binding 在实例化时初始化为 undefined，evaluate 再执行 initializer 赋值。过早读取不会 ReferenceError，却可能把 undefined 传播进注册表或快照。它通常比 TDZ 的快速失败更隐蔽。',
          'let、const 与 class 在实例化后保持 uninitialized，直到 evaluation 到达声明。class 还包含 extends expression、computed key 与 static initialization 等可执行步骤；循环中导出 class 并被另一模块顶层继承，很容易在 class 尚未初始化时失败。',
          'default export 也要按具体声明分析：export default function 声明与 export default expression 的初始化路径不同。面试推演应先标注 binding 创建点、初始化点和读取点，再谈“hoist”，避免一个词覆盖四种行为。'
        ],
        code: `// declarations-a.ts
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
}`,
        language: 'typescript',
        takeaway: '函数、var 与 lexical/class binding 的初始化点不同；环的安全性必须逐个读取点分析。'
      },
      {
        title: 'barrel、注册表与装饰器会制造难以看见的回边',
        kicker: '05 · HIDDEN CYCLES',
        paragraphs: [
          'index.ts 常用 export * 汇总模块。feature.ts 从 index.ts 导入公共类型或 helper，而 index.ts 又 re-export feature.ts，就形成 feature→index→feature。即使 import type 在 TypeScript emit 后消失，混入一个运行时 value import 就会重新生成边；应同时查看类型图和 emit 后运行时图。',
          '插件注册模式也容易成环：registry 导入所有 plugins 触发自注册，plugin 又导入 registry 调 register。此模式依赖顶层副作用和 partial initialization。更稳的方向是 composition root 显式 import plugins，再调用 register(registry)，让低层插件只依赖接口。',
          '装饰器、ORM model metadata、DI container 与 GraphQL schema 经常在类定义时读取关联类。class binding 的 TDZ 与静态初始化会让循环在测试顺序、bundler 输出或 CJS/ESM 迁移时爆炸。延迟 callback `() => OtherModel` 只有在框架确实晚于图初始化调用时才安全。',
          '工具报告循环不等于必须全部删除。优先处理包含顶层副作用、lexical 读取、继承、静态字段和单例初始化的 SCC；只包含延迟函数调用且合同清晰的小环风险较低，但仍应有回归测试和架构说明。'
        ],
        code: `// 不推荐：plugin.ts 顶层反向导入 registry 并立即注册。
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
}`,
        language: 'typescript',
        takeaway: 'barrel 与自注册把组装职责藏进顶层副作用；composition root 能把回边改成显式的单向依赖。'
      },
      {
        title: '重构环要移动所有权，而非随意延迟一个 import',
        kicker: '06 · REFACTORING',
        paragraphs: [
          '若 A 与 B 共享纯类型/常量，可把真正共同的协议抽到 C：A→C、B→C。C 必须是更底层稳定抽象，不能成为把所有杂物堆进去的 common.ts，否则只是把环变成中心化耦合。',
          '若 A 高层策略需要调用 B 低层实现，而 B 又回调 A，使用依赖倒置：低层定义或共同协议层定义 callback/port，高层在 composition root 注入实现。模块图表达所有权，运行时对象图仍可双向协作。',
          '若依赖只在某个操作发生时需要，可以把读取移到函数调用或使用 dynamic import。dynamic import 会创建异步失败与 chunk 边界，适合真正可延迟功能；只为躲避 TDZ 而随处 dynamic import 会把静态错误推迟到生产并扩大状态空间。',
          '有时最小修复是移除顶层 snapshot：导出 getConfig() 让读取发生在初始化后，或显式 init(deps) 建立状态。必须加入“init 前调用如何失败、重复 init 是否幂等、测试如何 reset”的协议，延迟并不等于问题自动消失。'
        ],
        code: `// ports.ts：稳定的低层合同
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
export { service }`,
        language: 'typescript',
        takeaway: '拆环的本质是重新分配协议与组装所有权；延迟 import 只是其中一种带异步代价的工具。'
      },
      {
        title: '循环错误的证据链：图、状态、读取点与产物',
        kicker: '07 · DIAGNOSTICS',
        paragraphs: [
          '第一条证据是最终运行时依赖图。使用 bundler metafile、madge/dependency-cruiser、Node loader trace 或自建 import analyzer 列出 SCC；保留 resolved path、edge kind 和是否 type-only。只看 IDE “find references”会漏 re-export 与生成代码。',
          '第二条证据是模块状态时间线。为顶层初始化临时加入 module id、before declaration、after declaration 日志，或在 debugger 捕获 ReferenceError 的首次抛出位置。错误栈中的“Cannot access X before initialization”指出读取点，目标声明位置指出未完成的初始化。',
          '第三条证据是构建产物。TypeScript module target、Babel transform、bundler chunking 与 CJS interop 可能改变实现次序却不应随意改变 ESM 语义；若仅某套产物失败，比较模块包装、helper、tree shaking 和 sideEffects 标记。',
          '生产监控要保留部署版本、入口、resolved module URL 与首次 evaluation error。模块错误通常被 cache，单请求重试同一实例不会恢复；回滚、刷新 realm/worker 或修复外部初始化条件才可能改变结果。'
        ],
        code: `type DependencyEdge = {
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
)`,
        language: 'typescript',
        takeaway: '诊断循环要同时证明最终图、未初始化读取点和实际产物；单个文件的 import 顺序不足以定因。'
      },
      {
        title: '测试 SCC 要覆盖不同入口与失败固化',
        kicker: '08 · TEST MATRIX',
        paragraphs: [
          '同一 SCC 从 A 或 B 作为 entry 开始，DFS discovery order 可以不同。可靠模块不应因为测试入口变化就从成功变失败；为每个公共入口单独启动新 realm/process 运行图，能暴露隐含环内顺序依赖。',
          '安全环测试应证明：link 成功；函数 binding 可用；所有 lexical binding 在图完成后可读；重复 import 不重复副作用。有害环测试应断言具体 ReferenceError 与读取位置，而非只断言“import rejected”。',
          '测试模块 cache 时，同一进程第二次 import 可能直接复用第一次结果，无法重新演练初始化。使用隔离 worker、子进程、vm SourceTextModule 或测试运行器 resetModules 时，要说明隔离能力的真实边界，避免 query string workaround 泄漏新实例。',
          '架构 gate 可以禁止新增跨 layer SCC，或对含顶层副作用的 SCC 设为错误。已有环应维护 allowlist、owner 和移除计划；只统计环数量会鼓励把多个文件合并成巨型模块，而没有真正降低耦合。'
        ],
        code: `type CycleCase = {
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
}`,
        language: 'typescript',
        takeaway: '循环测试要改变 entry、隔离 cache、区分 link 与 TDZ，并验证失败是否被模块实例固化。'
      }
    ],
    mechanisms: [
      '循环模块先在 linking pass 建立整个 SCC 的 bindings，再在 evaluation pass 执行顶层代码。',
      'DFSIndex 记录发现次序，DFSAncestorIndex/low-link 记录能回到的最早活跃节点。',
      '遇到 evaluating 依赖是回边，递归立即返回并降低当前 ancestor index。',
      '只有 low-link 等于自身 index 的 root 才弹出 stack 并完成整个 component 状态迁移。',
      '跨 SCC 依赖能拓扑排序；SCC 内不存在满足所有依赖边的严格全序。',
      'function 在实例化阶段可初始化，var 初始 undefined，let/const/class 保持 TDZ 到求值声明。',
      'link 成功只说明 binding 可解析；顶层 GetBindingValue 仍可能因目标未初始化而 ReferenceError。',
      'barrel、re-export、自注册与静态 class metadata 会在源码表面之外增加运行时回边。',
      '拆环通常通过抽取稳定协议、依赖倒置、composition root 或显式延迟读取改变所有权。',
      '同一失败 Module Record 会复用 errored 状态，重复 import 不是事务重试。'
    ],
    pitfalls: [
      '看到双向 import 就断言一定返回 undefined，混淆 ESM TDZ 与 CommonJS partial exports。',
      '用普通拓扑排序处理含环图，剩余节点无法出队却没有 component 语义。',
      'Tarjan 处理指向已完成节点的边时仍更新 low-link，错误合并两个 SCC。',
      '回边再次 execute 模块，造成无限递归或重复顶层副作用。',
      '把 link 完成当作所有 Cell 已初始化，漏掉 evaluation TDZ。',
      '只用“hoisting”解释 function/var/let/class，没有标注各自初始化点。',
      '用 export * barrel 聚合一切，忽略它增加回边和名称歧义。',
      '以 dynamic import 随机打断环，却没有处理异步失败、加载状态和 chunk 成本。',
      '把共享代码全部塞进 common.ts，环消失但低内聚中心模块继续扩大。',
      '只从单一 entry 测试，隐藏依赖 DFS discovery order 的脆弱顶层读取。',
      '同一进程重复 import 测初始化，实际命中 cache 而没有重新执行。',
      '以 SCC 数量作为唯一架构指标，诱导合并文件而不改善依赖方向。'
    ],
    variants: [
      {
        title: '延迟函数读取',
        useWhen: '两个模块确实互相提供行为，但所有跨环 binding 只在应用启动完成后的函数调用中读取。',
        tradeoff: '保留静态图和同步 API；合同容易被后来新增的顶层调用破坏，需要专门回归测试。',
        code: `import { serviceB } from "./b.js"
export function useB() {
  return serviceB.run()
}`,
        language: 'typescript'
      },
      {
        title: '第三协议模块 + composition root',
        useWhen: '双向依赖来自接口归属或组装职责不清，可以提取稳定 port 并在高层注入。',
        tradeoff: '依赖方向最清楚、测试替换容易；增加接口与组装代码，过度抽象会降低可读性。',
        code: `// contracts.ts <- a.ts, b.ts
// app.ts -> a.ts, b.ts，并负责 connect(a, b)
export interface Receiver {
  receive(message: Message): void
}`,
        language: 'typescript'
      },
      {
        title: 'dynamic import 延迟边',
        useWhen: '依赖确实是可选功能或用户操作之后才需要，异步边界符合产品体验。',
        tradeoff: '从静态 SCC 移除边；引入 Promise、chunk、加载失败、取消和预取策略。',
        code: `export async function openDiagnostics() {
  const { createDiagnostics } = await import("./diagnostics.js")
  return createDiagnostics()
}`,
        language: 'typescript'
      }
    ],
    studyPlan: {
      readingMinutes: 44,
      sourceMinutes: 36,
      practiceMinutes: 60,
      reviewMinutes: 15
    },
    exampleLanguage: 'typescript',
    example: `type Status =
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
}`,
    buildSteps: [
      {
        title: '积木 1：构造可视模块图',
        body: '用 Module 对象与 dependencies 明确表示边，先画 A→B→C→A、C→D；不要在这一阶段执行任何模块代码。'
      },
      {
        title: '积木 2：独立实现 Tarjan SCC',
        body: '为每个节点保存 index、lowLink、onStack，断言得到 {A,B,C} 与 {D} 两个 component，并验证 O(V+E) 访问计数。'
      },
      {
        title: '积木 3：复用 link 阶段 Cell',
        body: '在 evaluation 前为 component 内所有导出创建 Cell 与 import resolution，证明环不会阻止名称解析。'
      },
      {
        title: '积木 4：实现 evaluating 回边处理',
        body: '再次访问 evaluating 节点只更新 ancestorIndex 并返回；加入 execute 计数器，确保每个 Module Record 只执行一次。'
      },
      {
        title: '积木 5：实现 component transition',
        body: '只有 root 的 low-link 等于 index 时才从 stack 弹出直到 root；把整组状态改为 evaluated，并记录 cycle root。'
      },
      {
        title: '积木 6：建立声明初始化矩阵',
        body: '分别模拟预初始化 function、undefined var、UNINITIALIZED let/class，从两个 entry 运行并记录首次读取结果。'
      },
      {
        title: '积木 7：传播 evaluation error',
        body: '顶层读取 TDZ 或 execute throw 时，把当前 component 置 errored；重复 evaluate 应重抛保存原因，不得重复副作用。'
      },
      {
        title: '积木 8：分析真实项目 SCC',
        body: '导出 bundler/metafile 的运行时边，过滤 type-only，找出含顶层副作用/类继承的 SCC，选择一个用 composition root 重构并用入口矩阵回归。'
      }
    ],
    selfCheckQuestion: 'A import B，B import A。A 顶层执行 `export const fromB = readB()`；B 导出 `function readB(){ return valueB }`，并在函数声明之后执行 `export const valueB="B"`。从 A 作为 entry 时，link 为什么能成功？evaluation 是否一定成功？请用 SCC DFS、function 初始化和 valueB 的 TDZ 推演；再说明把 readB 改成只返回字面量，或把 A 的调用移入 start()，分别改变了什么。',
    selfCheckAnswer: 'link 阶段会先遍历 A/B 的 SCC，为两边声明创建 Cell，并把 A 的 readB import 解析到 B 的函数 binding，因此没有 missing/ambiguous export，链接可以成功。evaluation 从 A 进入 evaluating，递归 B；B 遇到对 A 的回边只更新 low-link，不重新执行 A。B 的顶层 function binding 已在实例化阶段初始化，但 B 的 ExecuteModule 会继续运行到 `valueB="B"`，正常情况下 B 执行完成后才回到 A，A 调 readB 时 valueB 已初始化，所以成功。若求值路径或 B 的其他顶层代码在 valueB 初始化前调用 readB，函数虽可调用，函数体读取 valueB 仍会 ReferenceError；安全性取决于读取点而非函数名本身。readB 改成返回字面量后消除了对 lexical Cell 的读取，即使更早调用也无 TDZ。把 A 的调用移入显式 start() 则保留 readB→valueB 依赖，但把读取推迟到整个模块图求值完成以后；需要再定义 start 何时调用、重复调用和失败处理，才能成为完整协议。'
  },
  'top-level await、异步模块图与启动阻塞': {
    official: {
      title: 'ECMAScript Language Specification · ExecuteAsyncModule',
      url: 'https://tc39.es/ecma262/multipage/ecmascript-language-scripts-and-modules.html#sec-execute-async-module',
      note: '含 top-level await 的模块通过 PromiseCapability 执行。依赖它的父模块增加 PendingAsyncDependencies 并登记到 AsyncParentModules；依赖完成后按 AsyncEvaluation 次序唤醒可执行祖先，拒绝则沿父图传播。'
    },
    source: {
      repo: 'v8/v8',
      file: 'src/objects/source-text-module.cc',
      symbol: 'ExecuteAsyncModule / AsyncModuleExecutionFulfilled',
      language: 'cpp',
      url: 'https://github.com/v8/v8/blob/main/src/objects/source-text-module.cc#L969-L1205',
      walkthrough: [
        'ExecuteAsyncModule 只接受 evaluating/evaluating-async 且 has_toplevel_await 的模块，并创建专属 Promise capability。',
        'V8 构造 onFulfilled/onRejected 内建回调，把当前 SourceTextModule 放进 context；随后用 PerformPromiseThen 订阅 capability 的完成。',
        'InnerExecuteAsyncModule 把 capability 安装到 JSAsyncFunctionObject，并恢复模块的隐式 async function。顶层 await 因而复用 async function 暂停/恢复机制。',
        'AsyncModuleExecutionFulfilled 把当前模块置 evaluated，并先 resolve 自己的 top-level capability。',
        'GatherAvailableAncestors 递减父模块的 pending async dependency；归零的父模块进入按 async_evaluation_ordinal 排序的 exec list。',
        '父模块自身有 TLA 时继续 ExecuteAsyncModule；没有 TLA 但被异步依赖拖入 async evaluation 时同步 ExecuteModule，完成后继续解锁上游。',
        '任一异步模块拒绝会调用 AsyncModuleExecutionRejected，把同一错误递归传播给 AsyncParentModules，并拒绝 cycle root 的 top-level capability。',
        'V8 的 ordinal、pending count 与 parent list 是规范状态机的直接落地；Promise job 何时运行仍由上一课的 host microtask checkpoint 调度。'
      ],
      code: `// 摘自 V8 main/src/objects/source-text-module.cc。
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
}`
    },
    overview: [
      'top-level await 允许 ESM 顶层直接 await。它不会阻塞操作系统线程或浏览器 event loop；当前模块的执行上下文暂停，Promise jobs、输入和其他任务仍可运行。真正被“阻塞”的是模块图中的求值依赖：静态 importer 在其异步依赖完成前不能执行自己的顶层代码，应用入口、SSR 请求或 worker ready 因此可能迟迟不进入可用状态。',
      '一个没有写 await 的模块也可能成为 async-evaluating。只要某个静态依赖含 TLA 或依赖的下游仍异步，该父模块的 PendingAsyncDependencies 就大于零，并登记到依赖的 AsyncParentModules。依赖完成后，运行时递减计数，归零才允许父模块执行；失败则沿父图传播并拒绝入口 Evaluate 返回的 promise。',
      '本课会把同步 SCC evaluator 扩展为异步调度器：HasTLA、pending count、async parents、evaluation ordinal、fulfilled/rejected 传播、启动 timeout 和 trace 全部可观察。你还会复现串行 waterfall、并行启动、动态 import 等待环与 SSR 全局启动阻塞，并给出把 TLA 收敛到边界层的工程规则。'
    ],
    chapters: [
      {
        title: 'TLA 暂停模块执行，不暂停 event loop',
        kicker: '01 · SUSPENSION',
        paragraphs: [
          '含 TLA 的 source text module 被标记 [[HasTLA]]=true。ExecuteModule 接收 PromiseCapability，模块代码像隐式 async function 一样运行：遇到未完成 await 保存执行状态并返回，promise settle 后由 job 恢复。顶层声明在越过相应语句后才初始化。',
          '暂停期间浏览器仍能处理 task、microtask 与渲染，Node 也继续驱动 I/O。静态 import 它的父模块却不能越过自己的 evaluation barrier，因为父模块的顶层代码可能读取依赖导出，必须等依赖完成或失败。',
          '因此“top-level await 阻塞线程”与“top-level await 阻塞模块启动”是两个命题。前者通常错误，后者可能沿静态 importer 图放大到整个应用 entry。性能监控要区分 main-thread blocking time 与 module evaluation latency。',
          '模块 Evaluate 无论同步或异步都返回 promise；同步图可立即 resolve，异步图在 cycle root 完成后 resolve。dynamic import 也以 namespace promise 暴露同一完成边界。'
        ],
        code: `// config.ts
const response = await fetch("/runtime-config.json")
if (!response.ok) throw new Error("config load failed")
export const config = await response.json()

// app.ts 的顶层代码要等 config.ts 完成，但浏览器仍可处理事件与绘制。
import { config } from "./config.js"
startApplication(config)`,
        language: 'typescript',
        takeaway: 'TLA 释放 JavaScript 执行栈，却把模块求值完成变成异步依赖屏障；线程响应与应用 ready 要分别测量。'
      },
      {
        title: '没有 await 的 importer 也会进入 async evaluation',
        kicker: '02 · ASYNC TRANSITIVITY',
        paragraphs: [
          '设 A 静态 import B，B 含 TLA。InnerModuleEvaluation 先遍历 B；B 标记 AsyncEvaluation 并执行到 await。回到 A 时，A 发现 requiredModule 的 AsyncEvaluation 为 true，于是 PendingAsyncDependencies 加一，并把 A 加入 B.AsyncParentModules。',
          'A 自己没有 await，仍不能立即 ExecuteModule。它处于 evaluating-async，等待计数归零。B fulfilled 后 GatherAvailableAncestors 收集 A，A 作为同步父模块执行，随后继续唤醒更上层 importer。',
          '若 A 同时依赖 B 与 C 两个异步分支，pending count 初始为 2。先完成一个只减到 1，不执行 A；两个都完成才归零。兄弟分支可并发推进，父模块形成 join barrier。',
          'async contagion 沿静态 evaluation-phase edges 传播，却不要求所有模块本身都有 HasTLA。设计图时应把“contains await”和“is delayed by async dependency”标成两个字段。'
        ],
        code: `type AsyncState = {
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
}`,
        language: 'typescript',
        takeaway: 'HasTLA 是模块自身属性，AsyncEvaluation 是传递状态；同步父模块也可能等待多个异步子模块形成 join。'
      },
      {
        title: 'ordinal 保住可观察的启动次序',
        kicker: '03 · EVALUATION ORDER',
        paragraphs: [
          '异步依赖完成时，可能同时解锁多个祖先。规范记录模块被标记 AsyncEvaluation 的顺序，并让可用祖先按该顺序执行，避免 promise 完成竞态任意改变无 await 父模块的顶层副作用顺序。',
          'V8 使用 async_evaluation_ordinal 落地这一顺序；完成后写特殊 finished 值。GatherAvailableAncestors 递减计数并把归零祖先放进有序集合，随后依次 ExecuteAsyncModule 或同步 ExecuteModule。',
          '这不代表两个真正含 await 的兄弟模块不会交错。每个模块在 await 处分段，promise 完成先后决定恢复时刻；保证关注依赖约束与可用祖先排序，不是把整图串行化。',
          '测试不要只断言最终 exports。记录 start、before await、after await、parent execute 的时间线，才能证明兄弟并发、父 join 与顺序稳定。'
        ],
        code: `const trace: string[] = []

// b.ts
trace.push("B:start")
await gateB
trace.push("B:done")

// c.ts
trace.push("C:start")
await gateC
trace.push("C:done")

// a.ts 静态依赖 B/C，只有两者 done 后才运行。
trace.push("A:execute")`,
        language: 'typescript',
        takeaway: '异步分支可交错，依赖屏障与 async ordinal 保证可用祖先的确定启动顺序。'
      },
      {
        title: 'rejection 会沿 AsyncParentModules 传播并固化',
        kicker: '04 · ERROR PROPAGATION',
        paragraphs: [
          'TLA await 的 promise reject、恢复后的顶层 throw 或依赖异步失败都会进入 AsyncModuleExecutionRejected。当前模块保存 EvaluationError、转 evaluated/errored，并递归处理所有 async parents。',
          '父模块不会执行一半再收到错误；它还在等待 dependency barrier，错误直接让其 evaluation 失败。入口 Module Record 的 TopLevelCapability 被 reject，dynamic import promise 也拒绝，调用者应在真正加载边界处理。',
          '同一 Module Record 的错误被缓存。重试 import 不会重新 fetch 配置或再次连接数据库；若失败来源可恢复，应把操作移进显式 async function，让调用者控制 retry、backoff、timeout 与 cancellation。',
          '错误应附带 module URL、阶段、dependency chain 与 cause。只显示顶层“failed to fetch dynamically imported module”会丢掉真正的 TLA rejection；浏览器跨源与 source map 还需单独配置。'
        ],
        code: `// 不把可重试网络事务固化为模块求值失败。
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
}`,
        language: 'typescript',
        takeaway: '异步模块失败沿父图传播且被实例缓存；需要重试的业务 I/O 应放进显式函数状态机。'
      },
      {
        title: 'TLA waterfall 来自 await 的启动时机',
        kicker: '05 · WATERFALL',
        paragraphs: [
          '独立操作连续 `const a=await loadA(); const b=await loadB()` 会让 B 在 A 完成后才启动，形成网络或初始化 waterfall。模块图再把这段延迟传播给所有 importer，冷启动代价放大。',
          '若两项没有数据依赖，应先 `const pa=loadA(); const pb=loadB();` 再 `await Promise.all([pa,pb])`。静态兄弟依赖的执行也可并发暂停，但模块内顺序 await 仍由代码决定。',
          'TLA 还会影响 bundler chunk evaluation、SSR 首请求与 test discovery。大型共享模块中的全局 await 把低频能力变成所有入口的冷启动依赖；把它移动到 feature dynamic import 或显式 ready promise 可缩小 blast radius。',
          '优化要测 resolve/load/link/evaluate 各段，不能只看 network waterfall。CPU parse、模块数量、source map、loader hook 和 await I/O 都可能占据启动关键路径。'
        ],
        code: `// 串行：约等于两段延迟相加
// const locale = await loadLocale()
// const flags = await loadFlags()

// 并行启动，再统一形成模块 ready barrier。
const localePromise = loadLocale()
const flagsPromise = loadFlags()

export const [locale, flags] = await Promise.all([
  localePromise,
  flagsPromise
])`,
        language: 'typescript',
        takeaway: 'TLA 本身不要求串行；先启动独立 promise 再 join，才能避免把 waterfall 传播到整个 importer 图。'
      },
      {
        title: '等待环可能越过静态图，运行时无法替你消除死锁',
        kicker: '06 · ASYNC DEADLOCK',
        paragraphs: [
          '静态 SCC 算法能处理模块依赖环，却看不见任意 promise 的业务等待关系。A 的 TLA await 一个只有 B 顶层执行后才 resolve 的 gate，而 B 又静态等待 A 完成，双方可永久 pending。',
          '危险写法还包括在模块 TLA 中 `await import()` 一个求值依赖最终回到当前模块的模块。dynamic import promise 要等目标 evaluation 完成，目标又等待当前 root，形成跨静态/动态边的等待环。',
          '规范维持 pending，不会为任意 promise 建 wait-for graph 并抛 deadlock error。Node 对永不完成的入口 TLA有进程退出行为，但服务内 worker、浏览器页面或嵌套 dynamic import 仍可能表现为永久 loading。',
          '工程保护包括启动 deadline、ready 状态机、wait-for trace、禁止模块顶层等待应用事件，以及将双向握手移到图求值后的 orchestration phase。timeout 只能暴露问题，不能自动恢复半初始化全局状态。'
        ],
        code: `export async function bootWithDeadline(
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
}`,
        language: 'typescript',
        takeaway: '模块 SCC 只处理静态依赖；promise wait-for edge 能形成永久 pending，需显式 deadline 与启动协议。'
      },
      {
        title: 'SSR、CLI 与 Worker 的 ready 边界不同',
        kicker: '07 · HOST STARTUP',
        paragraphs: [
          '浏览器 entry module TLA 未完成时，依赖它的模块不执行，但 DOM 已存在、其他独立脚本和事件循环可继续。UI 应先有静态 shell 与 loading/error state，避免把首屏全部藏在入口完成之后。',
          'SSR server 若在共享模块顶层 await 数据库连接，进程启动会等待一次；若模块按 tenant/request 动态生成 identity，可能把连接等待复制多次。请求态初始化不应塞进进程级 Module Record。',
          'CLI 入口可以自然 await 配置和命令执行，但要给 stderr、exit code 与 signal cancellation。Worker 可用首条 ready/error message 暴露模块图完成，主线程设置 timeout 并在失败时 terminate。',
          '库作者尤其应谨慎发布含 TLA 的公共入口，因为同步加载方、旧 bundler、测试 runner 与 CJS require 可能无法消费。可提供同步核心入口与显式 async init，或在 package exports 中分开条件入口。'
        ],
        code: `// worker-entry.ts
try {
  const runtime = await createRuntime()
  postMessage({ type: "ready" })
  onmessage = event => runtime.handle(event.data)
} catch (error) {
  postMessage({
    type: "startup-error",
    message: error instanceof Error ? error.message : String(error)
  })
}`,
        language: 'typescript',
        takeaway: 'TLA 的产品影响取决于宿主 ready 合同；浏览器 shell、SSR 进程、CLI 和 Worker 应分别设计。'
      },
      {
        title: '异步模块测试要控制 gate，而非依赖真实时间',
        kicker: '08 · VERIFICATION',
        paragraphs: [
          '用 deferred promise 控制 B/C 完成顺序，断言父 A 在 pending count 归零前没有执行。测试至少覆盖 B 先完成、C 先完成、一个 reject、永不 resolve 与重复 import。',
          '每个 case 使用新 worker/子进程或独立 vm module graph，避免 module cache 让第二个 case 直接复用 evaluated 状态。fake timers 不能自动完成原生 promise jobs，仍需明确 flush microtasks。',
          '性能测试记录每个模块 evaluation start/end、await reason 与 parent unblock，输出 critical path。总启动时间不是所有模块耗时相加，应找出最长依赖链和未并行启动的 I/O。',
          '发布 gate 可禁止基础库入口新增 HasTLA，或要求标注 startup budget、timeout、fallback 与 CJS compatibility。规则应基于 package 层级和用户影响，不能简单全局禁用。'
        ],
        code: `function deferred<T>() {
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
// 注入 evaluator 后，分别 release 并断言 parent execute 时机。`,
        language: 'typescript',
        takeaway: '用可控 deferred、隔离 module cache 和 critical-path trace 验证异步依赖图，避免靠 sleep 猜时序。'
      }
    ],
    mechanisms: [
      'Source Text Module 的 HasTLA 表示自身包含顶层 await，ExecuteModule 通过 PromiseCapability 暂停与恢复。',
      '依赖异步模块的同步父模块也进入 async evaluation，但自身 HasTLA 仍为 false。',
      '每条未完成异步依赖让父模块 PendingAsyncDependencies 加一，并把父加入依赖的 AsyncParentModules。',
      '计数归零后父模块才可执行，多个异步兄弟形成 join barrier。',
      'AsyncEvaluation ordinal 保留可用祖先的确定执行顺序，兄弟 await 仍可按 promise 完成交错。',
      'AsyncModuleExecutionFulfilled 标记当前模块完成，收集并执行新可用祖先。',
      'AsyncModuleExecutionRejected 沿 async parent 图传播同一错误并拒绝入口 top-level capability。',
      'TLA 释放执行栈，不阻塞 event loop；被延迟的是静态 importer 的顶层求值与应用 ready。',
      '任意 promise wait-for edge 可形成规范无法检测的永久 pending，需 deadline 与启动 trace。',
      '模块实例缓存 evaluated/errored 结果，可重试 I/O 应由显式函数状态机管理。'
    ],
    pitfalls: [
      '说 TLA 阻塞浏览器线程，混淆执行栈释放与模块启动屏障。',
      '只给含 await 的模块标 async，漏掉被异步依赖拖入 evaluating-async 的父模块。',
      '异步依赖完成一个就执行父模块，忽略 PendingAsyncDependencies join 计数。',
      '用 promise 完成竞态任意调度祖先，破坏 async evaluation ordinal 的可观察顺序。',
      '模块 TLA rejection 后反复 import 期待重试，实际复用 errored Module Record。',
      '在公共基础模块连续 await 独立 I/O，制造全图 cold-start waterfall。',
      '在 TLA 中 dynamic import 回到当前 evaluation root，形成永久等待环。',
      '用 timeout 之后继续使用半初始化 singleton，没有失败原子性和清理协议。',
      'SSR 把 request/tenant 初始化放进进程级模块顶层，错误共享生命周期。',
      '库入口无条件使用 TLA，破坏同步 CJS consumer 与部分工具链。',
      '测试依赖 sleep 与真实网络，无法稳定覆盖祖先解锁次序。',
      '只测最终值，不记录 before/after await 与 parent execute 时间线。'
    ],
    variants: [
      {
        title: '边界模块中的受控 TLA',
        useWhen: '应用 entry/worker entry 必须在暴露 ready 前完成一次不可选的异步配置，所有消费者都支持 ESM async evaluation。',
        tradeoff: '调用表面简洁；失败和冷启动传播到整个 importer 图，必须有 timeout、fallback 与 telemetry。',
        code: `const configPromise = fetchConfig()
const localePromise = loadLocale()
export const [config, locale] = await Promise.all([
  configPromise,
  localePromise
])`,
        language: 'typescript'
      },
      {
        title: '显式 ready Promise',
        useWhen: '模块需要同步暴露类型/函数，同时允许调用者决定何时等待初始化。',
        tradeoff: '兼容面更宽并能控制 timeout；调用者可能忘记 await，需要 API guard 或状态检查。',
        code: `export const ready = initialize()
export async function query(input: Input) {
  await ready
  return runtime.query(input)
}`,
        language: 'typescript'
      },
      {
        title: 'async factory',
        useWhen: '初始化需要重试、多个实例、不同租户配置或显式资源释放。',
        tradeoff: '生命周期最清楚；每个调用点要持有实例并处理失败、取消和 close。',
        code: `export async function createClient(
  config: Config,
  signal: AbortSignal
): Promise<Client> {
  const transport = await connect(config, signal)
  return new Client(transport)
}`,
        language: 'typescript'
      }
    ],
    studyPlan: {
      readingMinutes: 48,
      sourceMinutes: 40,
      practiceMinutes: 67,
      reviewMinutes: 15
    },
    exampleLanguage: 'typescript',
    example: `type AsyncStatus =
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
}`,
    buildSteps: [
      {
        title: '积木 1：给 Module Record 加异步字段',
        body: '加入 hasTLA、pendingAsyncDependencies、asyncParents、asyncOrdinal、completion 与 error；区分模块自身 async 与被依赖拖入 async。'
      },
      {
        title: '积木 2：传播 async dependency',
        body: '父模块看到 dependency evaluating-async 时计数加一，并注册到 child.asyncParents；用两兄弟图断言 pending=2。'
      },
      {
        title: '积木 3：启动零依赖 async module',
        body: 'pending=0 且 hasTLA 时立即 execute，executeBody 返回 promise；同步父模块此时仍不得执行。'
      },
      {
        title: '积木 4：实现 fulfilled 解锁',
        body: 'child 完成后递减每个 parent；只收集归零祖先，按 asyncOrdinal 排序后执行，覆盖 B/C 不同完成顺序。'
      },
      {
        title: '积木 5：实现 rejected 传播',
        body: '保存首次 error，拒绝 completion 并递归 asyncParents；父 execute 计数必须保持零，重复 evaluate 复用同一失败。'
      },
      {
        title: '积木 6：制造并诊断 waterfall',
        body: '分别实现连续 await 与先启动后 Promise.all，使用可控 deferred 或本地延迟测量关键路径，解释差值来源。'
      },
      {
        title: '积木 7：加入启动 deadline 与 trace',
        body: '记录 module、await reason、queued/start/finish、pending parents；永不 resolve case 要在 deadline 后给出 wait-for 链。'
      },
      {
        title: '积木 8：设计宿主 ready 合同',
        body: '为浏览器 shell、SSR 进程或 Worker 选择一个场景，实现 ready/error/timeout/cancel，并说明为何这里使用 TLA、ready promise 或 async factory。'
      }
    ],
    selfCheckQuestion: '入口 A 自身没有 await，但静态依赖 B、C；B 与 C 都含 TLA，B 先完成，C 后完成。A 为什么仍属于 async evaluation？B 完成时为什么不能立刻执行 A？C 完成后运行时如何找到并安排 A？若 C reject，A 的顶层代码是否会执行，入口 import 得到什么？',
    selfCheckAnswer: 'InnerModuleEvaluation 处理 A 时发现 B、C 的 AsyncEvaluation 均为 true，于是 A 的 PendingAsyncDependencies 增加到 2，并把 A 分别加入 B、C 的 AsyncParentModules；A 虽然 HasTLA=false，仍转入 evaluating-async，因为它的执行被异步依赖屏障延迟。B fulfilled 后 AsyncModuleExecutionFulfilled 只把 A 的计数减为 1，尚有 C 未完成，因此 A 不可执行。C fulfilled 后计数归零，GatherAvailableAncestors 把 A 放入可执行集合，并按 A 获得 async evaluation ordinal 的顺序安排；由于 A 自身无 TLA，运行时同步 ExecuteModule(A)，完成后继续解锁上游。若 C reject，AsyncModuleExecutionRejected 把同一错误传播给 A 及更上层 async parents，A 的顶层代码保持未执行，entry Module Record 的 TopLevelCapability 被 reject，所以静态入口启动失败，dynamic import 则返回 rejected promise。'
  }
}
