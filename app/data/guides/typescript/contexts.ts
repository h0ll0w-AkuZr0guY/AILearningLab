import type { TopicGuide } from '../../topic-guides'

export const typescriptContextGuides: Record<string, TopicGuide> = {
  '执行上下文、Environment Record、TDZ 与 hoisting': {
    official: {
      title: 'ECMAScript Language Specification · Environment Records and Execution Contexts',
      url: 'https://tc39.es/ecma262/multipage/executable-code-and-execution-contexts.html#sec-environment-records',
      note: 'Environment Record 是规范用来关联 Identifier 与 binding 的抽象记录，具有 [[OuterEnv]] 链和 Create/Initialize/Get/Set 等方法；execution context 保存当前代码求值状态、LexicalEnvironment、VariableEnvironment、PrivateEnvironment、Realm 与活动函数。两者都是规范模型，不要求与引擎栈帧或某个 JavaScript 对象一一对应。'
    },
    source: {
      repo: 'v8/v8',
      file: 'src/interpreter/bytecode-generator.cc',
      symbol: 'BytecodeGenerator::BuildVariableLoad / BuildThrowIfHole',
      language: 'cpp',
      url: 'https://github.com/v8/v8/blob/main/src/interpreter/bytecode-generator.cc',
      walkthrough: [
        'V8 在 scope analysis 后已经为变量选择 LOCAL、PARAMETER、CONTEXT、UNALLOCATED/global、LOOKUP、MODULE 等 location；BuildVariableLoad 据此生成不同字节码，而不是每次都遍历字符串字典。',
        'LOCAL/PARAMETER 从寄存器载入 accumulator；被闭包捕获或跨挂起点存活的 CONTEXT 变量通过 context chain depth 和 slot 读取。',
        'UNALLOCATED 通常生成 LoadGlobal 并附 feedback slot，LOOKUP 用于 eval/with 等动态解析，MODULE 走 module variable 索引；这些路径体现静态可解析名称与动态名称的成本差异。',
        '若 scope analysis 判定读取可能发生在初始化之前，生成器在 load 后发出 BuildThrowIfHole；V8 用内部 the_hole sentinel 表示 uninitialized，而 JavaScript 的 undefined 是合法已初始化值。',
        '同一 basic block 中首次检查通过后，V8 可用 bitmap 记住结果并省略重复 TDZ check；优化只删除冗余检查，不改变 ReferenceError 语义。'
      ],
      code: `// 摘自 V8 src/interpreter/bytecode-generator.cc，保留真实 location 分派与 TDZ 检查。
// 省略动态 lookup 的低频分支和 feedback 细节。
void BytecodeGenerator::BuildVariableLoad(
    Variable* variable,
    HoleCheckMode hole_check_mode,
    TypeofMode typeof_mode) {
  switch (variable->location()) {
    case VariableLocation::LOCAL: {
      Register source(builder()->Local(variable->index()));
      builder()->LoadAccumulatorWithRegister(source);
      if (VariableNeedsHoleCheckInCurrentBlock(variable, hole_check_mode)) {
        BuildThrowIfHole(variable);
      }
      break;
    }
    case VariableLocation::PARAMETER: {
      Register source = variable->IsReceiver()
          ? builder()->Receiver()
          : builder()->Parameter(variable->index());
      builder()->LoadAccumulatorWithRegister(source);
      if (VariableNeedsHoleCheckInCurrentBlock(variable, hole_check_mode)) {
        BuildThrowIfHole(variable);
      }
      break;
    }
    case VariableLocation::CONTEXT: {
      int depth = execution_context()->ContextChainDepth(variable->scope());
      builder()->LoadContextSlot(
          execution_context()->reg(), variable, depth);
      if (VariableNeedsHoleCheckInCurrentBlock(variable, hole_check_mode)) {
        BuildThrowIfHole(variable);
      }
      break;
    }
    case VariableLocation::UNALLOCATED: {
      FeedbackSlot slot = GetCachedLoadGlobalICSlot(typeof_mode, variable);
      builder()->LoadGlobal(
          variable->raw_name(), feedback_index(slot), typeof_mode);
      break;
    }
    case VariableLocation::MODULE: {
      int depth = execution_context()->ContextChainDepth(variable->scope());
      builder()->LoadModuleVariable(variable->index(), depth);
      if (VariableNeedsHoleCheckInCurrentBlock(variable, hole_check_mode)) {
        BuildThrowIfHole(variable);
      }
      break;
    }
    default:
      builder()->LoadLookupSlot(variable->raw_name(), typeof_mode);
  }
}

void BytecodeGenerator::BuildThrowIfHole(Variable* variable) {
  // the_hole 代表 binding 已创建但尚未 InitializeBinding。
  builder()->ThrowReferenceErrorIfHole(variable->raw_name());
  RememberHoleCheckInCurrentBlock(variable);
}`
    },
    overview: [
      '“var 会提升，let 不提升”会让人误以为引擎把文本搬到文件顶部。更准确的过程是：代码真正逐句求值前，声明实例化算法先收集声明并建立 binding。var binding 通常立即初始化为 undefined，函数声明可直接初始化为函数对象；let/const/class binding 也已经创建，却保持 uninitialized，直到执行到声明的 BindingInitialization。所谓 TDZ 就是从作用域开始到初始化完成之间，名称解析已命中这个 binding、读取却必须抛 ReferenceError 的区间。',
      '名称、binding、值与属性必须分开。Identifier 通过当前 LexicalEnvironment 的 HasBinding/GetBindingValue 沿 [[OuterEnv]] 查找；global script 的 var/function 可能落在 global object 相关的 Object Environment Record，顶层 let/const 落在 DeclarativeRecord；ES module 的顶层 binding 位于 Module Environment Record，通常不是 globalThis 属性。不同来源的“全局变量”因此有不同可删除性、重声明规则和反射行为。',
      'V8 会把未逃逸局部放进寄存器/栈帧位置，把被闭包捕获的 binding 放进 heap Context slot，用内部 hole 值实现 TDZ。规范 Environment Record 与 V8 Context 有对应直觉，却不是逐字段等价物。理解这层转换后，闭包、loop binding、eval 性能、async 挂起、模块 live binding 和调试器显示都能落到同一套 binding 生命周期上。'
    ],
    chapters: [
      {
        title: '解析、声明实例化、逐句求值是三个阶段',
        kicker: '01 · PHASES',
        paragraphs: [
          'parse 首先决定语法是否合法，并建立 lexical/var scoped declaration 等静态信息。重复 let、let 与同作用域 var 冲突、非法 return 等错误可在任何语句执行前抛出。解析成功不代表已经创建运行时 binding；不同 Script、Module、Function、Block 在进入求值时调用各自的 declaration instantiation。',
          'GlobalDeclarationInstantiation、FunctionDeclarationInstantiation、BlockDeclarationInstantiation 会检查重声明限制，按规范顺序创建 var/lexical/function binding。这个阶段可实例化函数对象，也可把 var 初始化为 undefined；let/const 只创建未初始化 binding。之后 Evaluation 才按控制流逐句执行 initializer 和语句副作用。',
          '“提升”只是多种实例化结果的总称，没有一个统一 Hoist 操作。回答面试题应分别说函数声明、var、let、const、class、import 在哪种环境创建、何时初始化、初始化前读取什么结果，以及 Script/Module/sloppy Annex B 是否改变行为。',
          '初始化表达式仍保留原来的控制流位置。let value = sideEffect() 的 binding 虽已存在，sideEffect 只会在执行到该语句时运行；若前面的 return、throw 或分支绕过声明，initializer 不会神秘地提前执行。把“binding 建立”和“initializer 求值”分开，是解释副作用顺序的关键。'
        ],
        code: `const events: string[] = []

events.push(typeof declaredFunction) // "function"：实例化阶段已有函数对象
events.push(String(varValue))        // "undefined"：var 已初始化

function declaredFunction() {}
var varValue = 1

try {
  // lexicalValue 的 binding 已创建，所以不会退回外层同名变量；
  // 但仍未初始化，读取触发 TDZ ReferenceError。
  events.push(typeof lexicalValue)
} catch (error) {
  events.push(error instanceof ReferenceError ? "tdz" : "other")
}
let lexicalValue = 2`,
        language: 'typescript',
        takeaway: '不要画“代码搬家”。画一张表：声明在实例化阶段创建什么 binding、初值是什么、执行到 initializer 时又发生什么。'
      },
      {
        title: 'Environment Record 是名称解析协议',
        kicker: '02 · ENVIRONMENT CHAIN',
        paragraphs: [
          'Declarative Environment Record 直接保存由语法声明产生的 binding；Function Environment 额外保存 this、new.target 与 super 相关状态；Module Environment 保存本地与 import live binding；Object Environment 把某个对象的 property 暴露为名称，with 和 global object 部分会用到；Global Environment 同时组合 DeclarativeRecord 与 ObjectRecord。',
          'ResolveBinding 从当前 LexicalEnvironment 调用 HasBinding，未命中就沿 [[OuterEnv]] 继续。命中后得到 Reference Record，GetValue 再调用该环境的 GetBindingValue。shadowing 的本质是内层 HasBinding 已经 true，因此即使内层 binding 未初始化，也不会跳过它读取外层值。',
          'Environment Record 不可被用户直接取得。闭包“捕获环境”也不表示把整个调用栈原样复制；实现可通过 scope analysis 只 materialize 需要逃逸的 binding。直接 eval、with 和调试器会迫使引擎保留更动态的查询能力。'
        ],
        points: [
          'LexicalEnvironment 用于当前 Identifier 解析，VariableEnvironment 指向 var declaration 目标；多数简单函数开始时二者相同，进入 block 后可分离。',
          'catch parameter、for block、class static block 都可能创建新的 Declarative Environment。',
          'Realm 决定 intrinsic 与 global object，Environment chain 决定名称；两者解决不同问题。'
        ],
        code: `const label = "outer"

function probe() {
  try {
    // 内层 label binding 已存在但未初始化，不会读取外层 "outer"。
    return label
  } catch (error) {
    console.assert(error instanceof ReferenceError)
  }
  let label = "inner"
}

probe()

// 顶层 Script 的声明来源也不同：
var scriptVar = 1
let scriptLet = 2
console.assert(globalThis.scriptVar === 1) // 浏览器经典 script 中通常成立
console.assert(!("scriptLet" in globalThis))`,
        language: 'typescript',
        takeaway: 'shadowing 在 binding 创建时已经生效。TDZ 读取命中的是内层未初始化 binding，而不是“找不到变量”。'
      },
      {
        title: 'Create、Initialize、Get、Set 构成 binding 生命周期',
        kicker: '03 · BINDING STATE',
        paragraphs: [
          'CreateMutableBinding/CreateImmutableBinding 只创建名称和元数据，状态仍是 uninitialized。InitializeBinding 第一次放入语言值并离开 TDZ；SetMutableBinding 修改已初始化 mutable binding；GetBindingValue 在未初始化时抛 ReferenceError。const 禁止后续 Set，不妨碍其引用对象内部发生 mutation。',
          'undefined 与 uninitialized 必须是两个状态。let x; 执行声明时 InitializeBinding(x, undefined)，此后读取合法；在声明前读取则命中 hole 并抛错。typeof undeclaredName 对不可解析 Reference 返回 "undefined"，但 typeof tdzName 仍需 GetBindingValue，因此抛 ReferenceError。',
          'class binding 也有 TDZ，且 class body 求值涉及 private environment、extends 表达式、method definition 与 static initialization。派生构造器的 this 在 super() 前处于特殊未初始化状态；重复 super 又触发相反检查。V8 的 BuildThrowIfHole 对普通 lexical 与 this 生成不同 bytecode。'
        ],
        code: `console.assert(typeof trulyMissing === "undefined")

{
  try {
    console.log(typeof presentButUninitialized)
    console.assert(false)
  } catch (error) {
    console.assert(error instanceof ReferenceError)
  }

  let presentButUninitialized
  console.assert(presentButUninitialized === undefined)
}

class Base {}
class Derived extends Base {
  constructor() {
    // console.log(this) // super() 前访问 this：ReferenceError
    super()
    console.assert(this instanceof Derived)
  }
}`,
        language: 'typescript',
        takeaway: 'TDZ 是 binding 状态检查，不是时间计时器。控制流若永远未执行初始化，binding 就一直不能读。'
      },
      {
        title: 'var、function 与 global object 的边界',
        kicker: '04 · GLOBAL INSTANTIATION',
        paragraphs: [
          '函数内 var 的作用域是 VariableEnvironment，不随普通 block 创建新 binding；initializer 仍在原位置执行。重复 var 通常复用同一 binding。FunctionDeclarationInstantiation 会处理参数、函数声明、arguments 与 var 的冲突；默认参数还可能需要独立 parameter environment，避免 body declaration 改变参数 initializer 的解析。',
          '经典 browser Script 的顶层 var/function 由 Global Environment 的 ObjectRecord 与全局对象属性机制协作；顶层 lexical declaration 位于 DeclarativeRecord。全局对象可能有不可配置属性，GlobalDeclarationInstantiation 必须先检查 restricted global/redeclaration 冲突，再决定能否创建 binding。',
          'ES Module 顶层始终是严格语义，var 也不会成为 globalThis property，import binding 只读但 live，声明实例化与模块链接在执行前完成。Node CommonJS 又把文件包在函数作用域。讨论“顶层 var 是否全局”必须先说明 host 与代码类型。'
        ],
        points: [
          '函数声明在 block 中的历史兼容行为受 strict/module 与 Annex B 影响，不应只背某一浏览器 sloppy script 结果。',
          'delete identifier 与 delete globalThis.property 不是同一语义，global binding 的可删除性由创建方式决定。',
          'eval 是否 direct、strict 以及调用处环境会改变 var/lexical binding 的落点。'
        ],
        code: `function varScope(flag: boolean) {
  if (flag) {
    var message = "created in function VariableEnvironment"
  }
  return message // flag=false 时也是已初始化的 undefined
}

console.assert(varScope(false) === undefined)

export const moduleValue = 1
// 在 ESM 中：
console.assert(!("moduleValue" in globalThis))

function parameterScope(
  value = () => bodyVariable
) {
  var bodyVariable = 1
  return value
}
// parameterScope()() 会因默认参数环境无法解析 bodyVariable 而失败。`,
        language: 'typescript',
        takeaway: '“全局、函数、块”还不够；先确定 Script/Module/CommonJS、strict/sloppy 与 declaration kind，再推导 binding 落点。'
      },
      {
        title: 'Execution Context 不等于操作系统线程或固定栈帧',
        kicker: '05 · EXECUTION CONTEXT',
        paragraphs: [
          'execution context 是规范记录，跟踪当前 code evaluation state、Function、Realm，以及 ECMAScript code 的 LexicalEnvironment、VariableEnvironment、PrivateEnvironment。调用普通函数通常 push 新 context，return 后 pop；running execution context 位于当前 agent 的 context stack 顶部。',
          'generator/async 让控制流不再始终 LIFO。generator yield 时保存求值状态并挂起 context，之后 next 可恢复；await 把后续包装成 job，当前 async 调用先返回 Promise，恢复时再次执行保存的状态。实现可以把需要跨挂起存活的值 spill 到 heap frame/context，并非把原生线程栈冻结在那里。',
          'microtask 切换不是“继续原调用栈”：同步调用栈已退回，Promise reaction job 在之后建立执行上下文。错误 stack、AsyncLocalStorage/context propagation 与调试器会尝试重建逻辑链，但它们是宿主/工具层能力。课程后续 event loop 与 async 专题会继续区分 execution context、job、task 与线程。'
        ],
        code: `const trace: string[] = []

async function flow() {
  trace.push("flow:start")
  await 0
  trace.push("flow:resume")
}

trace.push("script:before")
const promise = flow()
trace.push("script:after")

await promise
console.assert(trace.join("|") ===
  "script:before|flow:start|script:after|flow:resume")`,
        language: 'typescript',
        takeaway: 'await 保存的是可恢复求值状态，恢复由 job 调度；它不是另开线程，也不是让原同步调用栈一直挂着。'
      },
      {
        title: 'V8 把 binding 分配到 register、Context 与 global/module slot',
        kicker: '06 · ENGINE IMPLEMENTATION',
        paragraphs: [
          'scope analysis 解析每个 VariableProxy 指向哪个 Variable，判断是否被赋值、是否被内层函数捕获、是否需要 context、是否可能有 TDZ 读取。未逃逸 local/parameter 可映射到 Ignition register；捕获变量或需要跨调用存活的 binding 放进 Context slot，Context 通过 previous 链连接。',
          'BuildVariableLoad 不做统一哈希查找。LOCAL/PARAMETER 生成 register load，CONTEXT 计算 chain depth 后 LoadContextSlot，global 使用带 feedback 的 LoadGlobal，module 使用索引，动态 lookup 为 eval/with 保留慢路径。优化器可基于静态 location 和 feedback 继续内联或常量折叠。',
          'lexical binding 创建时，V8 可把 slot 设为内部 the_hole；可能在初始化前发生的 load 后生成 ThrowReferenceErrorIfHole。若控制流证明同一 basic block 已检查，bitmap 可省去重复检查。这里的 hole 与 array hole、undefined 都不同，用户代码无法直接制造它。'
        ],
        points: [
          '闭包只捕获 binding，不是捕获某次读取的值；后续 SetMutableBinding 对其他 closure 可见。',
          '是否分配 Context 是引擎优化决定，不能通过业务代码依赖具体布局。',
          'direct eval/with 破坏静态名称解析假设，常迫使更多动态 lookup 与保守 materialization。'
        ],
        code: `function makeCounter() {
  let count = 0 // 被闭包捕获，概念上进入共享 environment binding

  return {
    read: () => count,
    increment: () => ++count
  }
}

const counter = makeCounter()
console.assert(counter.read() === 0)
console.assert(counter.increment() === 1)
console.assert(counter.read() === 1) // 两个 closure 观察同一 binding`,
        language: 'typescript',
        takeaway: '规范 environment 解释语义，V8 variable location 解释成本。把两层对齐，但不要把寄存器/Context 当作跨版本承诺。'
      },
      {
        title: 'TypeScript 只做静态近似，运行时仍由 ECMAScript 初始化',
        kicker: '07 · TYPESCRIPT CONTRACT',
        paragraphs: [
          'TypeScript 的 definite assignment analysis、strictPropertyInitialization 与 control-flow narrowing 尝试在编译期发现“可能未赋值”，但不会改变 JavaScript TDZ。属性声明 field!: T 使用 definite assignment assertion 关闭检查，运行时不会自动初始化一个有效 T；useDefineForClassFields 决定 emit 更接近 define semantics，也不替你建立业务不变量。',
          '类型声明顺序与运行时初始化顺序需要一起审查。derived class field 在 super 后初始化，static fields/blocks 按文本顺序运行，访问后声明 static private/field 可能遇到未初始化。循环 import 又让模块 binding 的初始化顺序更复杂，单靠类型 checker 无法证明所有运行时路径安全。',
          '工程上把“创建但未 ready”的对象建模成显式状态，或使用工厂一次性返回完成对象，比散落的 ! 更可靠。若必须两阶段初始化，应让未初始化状态有独立类型、收窄函数与运行时断言，同时写出重入和异常中断测试。'
        ],
        code: `type Loading = { state: "loading" }
type Ready<T> = { state: "ready"; value: T }
type Failed = { state: "failed"; error: Error }
type Resource<T> = Loading | Ready<T> | Failed

function read<T>(resource: Resource<T>): T {
  if (resource.state === "ready") return resource.value
  if (resource.state === "failed") throw resource.error
  throw new Error("resource 尚未初始化")
}

// 与 value!: T 相比，未 ready 在类型和运行时都可见。
const resource: Resource<string> = { state: "loading" }
console.assert(resource.state === "loading")`,
        language: 'typescript',
        takeaway: 'checker 能降低漏初始化概率，无法替代运行时 binding/field 顺序。复杂生命周期应建模成状态，而不是用 ! 抹掉证据。'
      }
    ],
    mechanisms: [
      '解析产生声明集合与 scope 信息；对应 declaration instantiation 在求值前创建并检查 binding。',
      'ResolveBinding 沿 LexicalEnvironment 的 [[OuterEnv]] 调用 HasBinding，命中后 Reference/GetValue 读取具体 binding。',
      'lexical binding 经 Create→Initialize→Get/Set 生命周期；TDZ 是命中 uninitialized binding 时的 ReferenceError。',
      'var/function/lexical/import 按 Script、Function、Block、Module 与 Global Environment 的不同算法实例化。',
      'execution context 保存求值状态与环境指针；函数调用、generator 挂起和 async job 会 push、suspend、resume。',
      'V8 scope analysis 把 binding 映射到 register、Context、global/module slot，并用 hole check 保持 TDZ 语义。'
    ],
    pitfalls: [
      '把 hoisting 解释成源代码移动，无法回答 initializer、副作用和同名冲突的真实顺序。',
      '说“let 不提升”，却解释不了声明前为何遮蔽外层同名 binding 并触发 TDZ。',
      '把 uninitialized 当作 undefined，或认为 typeof 对所有未声明/未初始化名称都安全。',
      '把顶层 var/let 的行为跨经典 Script、ESM、Node CommonJS 和 REPL 一概而论。',
      '认为 closure 复制了值，忽略多个 closure 共享一个可变 binding。',
      '把 execution context、call stack、event loop task、线程和 V8 Context 混为同一个概念。'
    ],
    variants: [
      {
        title: '一次性工厂初始化',
        useWhen: '对象必须满足完整不变量后才能对外可见，创建失败应直接返回错误或拒绝 Promise。',
        tradeoff: '状态面小、调用者简单；复杂依赖可能让工厂承担较多 I/O 与组装职责。',
        code: `type Client = Readonly<{ endpoint: URL; token: string }>

async function createClient(endpoint: string): Promise<Client> {
  const token = await loadToken()
  return Object.freeze({ endpoint: new URL(endpoint), token })
}`,
        language: 'typescript'
      },
      {
        title: '显式状态机两阶段初始化',
        useWhen: '生命周期确实需要 loading/ready/failed、重试、取消或热更新，调用者必须观察中间状态。',
        tradeoff: '能表达真实过程；每个消费者都要穷尽状态，转移和并发重入需要集中管理。'
      },
      {
        title: 'definite assignment assertion',
        useWhen: '框架或反射保证 checker 无法看见的注入，且已有运行时断言和集成测试证明初始化先于读取。',
        tradeoff: '改动最少；! 会永久删除静态证据，框架配置变化后容易把 undefined 伪装成 T。',
        code: `class Injected {
  service!: Service

  assertReady(): asserts this is this & { service: Service } {
    if (!this.service) throw new Error("service injection missing")
  }
}`,
        language: 'typescript'
      }
    ],
    studyPlan: {
      readingMinutes: 45,
      sourceMinutes: 35,
      practiceMinutes: 50,
      reviewMinutes: 15
    },
    exampleLanguage: 'typescript',
    example: `const UNINITIALIZED = Symbol("uninitialized")

type Binding = {
  mutable: boolean
  initialized: boolean
  value: unknown | typeof UNINITIALIZED
}

class Environment {
  private readonly bindings = new Map<string, Binding>()

  constructor(readonly outer: Environment | null = null) {}

  create(name: string, mutable: boolean): void {
    if (this.bindings.has(name)) {
      throw new SyntaxError(\`重复声明：\${name}\`)
    }
    this.bindings.set(name, {
      mutable,
      initialized: false,
      value: UNINITIALIZED
    })
  }

  initialize(name: string, value: unknown): void {
    const binding = this.own(name)
    if (binding.initialized) throw new ReferenceError(\`\${name} 已初始化\`)
    binding.value = value
    binding.initialized = true
  }

  get(name: string): unknown {
    const owner = this.resolve(name)
    if (!owner) throw new ReferenceError(\`\${name} 未声明\`)
    const binding = owner.own(name)
    if (!binding.initialized) {
      throw new ReferenceError(\`\${name} 位于 TDZ\`)
    }
    return binding.value
  }

  set(name: string, value: unknown): void {
    const owner = this.resolve(name)
    if (!owner) throw new ReferenceError(\`\${name} 未声明\`)
    const binding = owner.own(name)
    if (!binding.initialized) throw new ReferenceError(\`\${name} 位于 TDZ\`)
    if (!binding.mutable) throw new TypeError(\`\${name} 是 immutable binding\`)
    binding.value = value
  }

  private resolve(name: string): Environment | null {
    if (this.bindings.has(name)) return this
    return this.outer?.resolve(name) ?? null
  }

  private own(name: string): Binding {
    const binding = this.bindings.get(name)
    if (!binding) throw new ReferenceError(\`\${name} 不在当前环境\`)
    return binding
  }
}

const outer = new Environment()
outer.create("value", true)
outer.initialize("value", "outer")

const block = new Environment(outer)
block.create("value", true)

try {
  block.get("value") // 命中内层 binding，但尚未初始化
  console.assert(false)
} catch (error) {
  console.assert(error instanceof ReferenceError)
}

block.initialize("value", "inner")
console.assert(block.get("value") === "inner")
console.assert(outer.get("value") === "outer")`,
    buildSteps: [
      { title: '积木 1：实现 binding 状态', body: '用独立 sentinel 区分 uninitialized 与 undefined，实现 create、initialize、get、set 和 mutable/immutable 错误。' },
      { title: '积木 2：加入 environment chain', body: '实现 HasBinding/resolve 与 outer 链，写外层值、内层同名 TDZ、初始化后 shadow 三段测试。' },
      { title: '积木 3：模拟声明实例化', body: '输入 var/function/let/const 声明表：var 初始化 undefined，function 初始化 callable，lexical 保持 hole；再按 statement 顺序求 initializer。' },
      { title: '积木 4：拆分 Lexical/Variable Environment', body: '进入 block 只更新 LexicalEnvironment；var 写入 VariableEnvironment。用 if/for/catch 验证 binding 落点。' },
      { title: '积木 5：加入 closure capture', body: '函数对象保存创建时 environment；调用建立 Function Environment，证明两个 closure 共享同一 captured binding。' },
      { title: '积木 6：对照 V8 bytecode', body: '用 node --print-bytecode 或 d8 观察 local、captured context、global、module 与 TDZ 示例，映射到 BuildVariableLoad 分支。' },
      { title: '积木 7：建立初始化顺序回归矩阵', body: '覆盖 typeof undeclared/TDZ、class extends/static field、默认参数访问 body var、ESM 循环依赖与 async 挂起后的 binding。' }
    ],
    selfCheckQuestion: '为什么“let 不会提升”是一个有害简化？请用外层同名变量、typeof 和 V8 hole check 三个证据说明。',
    selfCheckAnswer: 'let binding 在进入其 block 的 BlockDeclarationInstantiation 时已经创建，所以从 block 起就遮蔽外层同名 binding；只是它保持 uninitialized，直到执行声明的 BindingInitialization。因名称已解析到内层 binding，声明前读取不会退回外层；typeof 也必须对该 Reference 执行 GetBindingValue，因此抛 ReferenceError，而真正不可解析名称的 typeof 才返回 "undefined"。V8 会为可能提前读取的 local/context/module load 生成 ThrowReferenceErrorIfHole，以内部 the_hole 区分未初始化与合法 undefined。这些都说明 binding 被提前建立了，“不提升”无法解释真实状态。'
  }
}
