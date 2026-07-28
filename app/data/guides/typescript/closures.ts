import type { TopicGuide } from '../../topic-guides'

export const typescriptClosureGuides: Record<string, TopicGuide> = {
  '闭包、捕获绑定与 per-iteration environment': {
    official: {
      title: 'ECMAScript Language Specification · OrdinaryFunctionCreate and CreatePerIterationEnvironment',
      url: 'https://tc39.es/ecma262/multipage/ecmascript-language-statements-and-declarations.html#sec-createperiterationenvironment',
      note: '函数对象的 [[Environment]] 保存创建函数时的 Environment Record；调用时 NewFunctionEnvironment 把它作为 [[OuterEnv]]。for 头部使用 let/const 时，CreatePerIterationEnvironment 会为指定名称建立新的 binding，并从上一轮 binding 复制当前值，因此每轮闭包可以观察不同 binding。'
    },
    source: {
      repo: 'v8/v8',
      file: 'src/runtime/runtime-scopes.cc',
      symbol: 'Runtime_NewFunctionContext / Runtime_PushBlockContext',
      language: 'cpp',
      url: 'https://github.com/v8/v8/blob/main/src/runtime/runtime-scopes.cc',
      walkthrough: [
        'Runtime_NewFunctionContext 接收编译期生成的 ScopeInfo，以当前 isolate context 为 outer，交给 Factory 创建保存函数级捕获变量的 Context。',
        'ScopeInfo 描述哪些名称真正需要 context slot、slot 索引与变量模式；未逃逸局部无需因为源码中存在闭包就全部搬入 heap。',
        'Runtime_PushBlockContext 为需要物化的 block lexical scope 建立新 Context，并把 current context 作为 previous；catch/with 使用各自专用 Context。',
        'for-let 每轮语义上创建新的 Declarative Environment；V8 可通过 bytecode/context slot 复制实现等价行为，优化器还可在闭包不逃逸时消除实际分配。',
        '函数对象持有创建时 Context；只要任一返回函数、监听器或异步任务仍可达，该 Context 中被捕获 slot 及其对象图就可能继续存活。'
      ],
      code: `// 摘自 V8 src/runtime/runtime-scopes.cc；函数签名与 Factory 调用为真实源码，
// 只增加中文注释。Context 是 V8 对需要物化的词法环境的一种实现。
RUNTIME_FUNCTION(Runtime_NewFunctionContext) {
  HandleScope scope(isolate);
  DCHECK_EQ(1, args.length());

  // ScopeInfo 来自 parser/scope analysis，记录需要进入 Context 的 binding。
  DirectHandle<ScopeInfo> scope_info = args.at<ScopeInfo>(0);

  // 当前 Context 成为新函数 Context 的 outer/previous。
  DirectHandle<Context> outer(isolate->context(), isolate);
  return *isolate->factory()->NewFunctionContext(outer, scope_info);
}

RUNTIME_FUNCTION(Runtime_PushBlockContext) {
  HandleScope scope(isolate);
  DCHECK_EQ(1, args.length());

  DirectHandle<ScopeInfo> scope_info = args.at<ScopeInfo>(0);
  DirectHandle<Context> current(isolate->context(), isolate);

  // 需要跨闭包存活的 block-scoped binding 放入新的 BlockContext。
  return *isolate->factory()->NewBlockContext(current, scope_info);
}

RUNTIME_FUNCTION(Runtime_PushCatchContext) {
  HandleScope scope(isolate);
  DCHECK_EQ(2, args.length());
  DirectHandle<Object> thrown_object = args.at(0);
  DirectHandle<ScopeInfo> scope_info = args.at<ScopeInfo>(1);
  DirectHandle<Context> current(isolate->context(), isolate);
  return *isolate->factory()->NewCatchContext(
      current, scope_info, thrown_object);
}`
    },
    overview: [
      '闭包不是“函数加一份变量快照”。创建普通函数对象时，规范把当时的 LexicalEnvironment 写入函数的 [[Environment]]；调用该函数时，新 Function Environment 的 [[OuterEnv]] 指向这个环境。函数体里的 Identifier 因而能沿环境链找到创建位置的 binding。若 binding 后续被修改，所有捕获它的闭包都看到新值。',
      'for (let i = ...) 的经典结果来自 CreatePerIterationEnvironment。每轮会建立新的环境和新的 i binding，把上一轮 i 的当前值复制进新 binding，再执行 increment；当轮创建的闭包保存当轮环境。for (var i = ...) 只有函数级共享 binding，全部回调在真正执行时读取同一个最终值。差别落在 binding identity，而非异步 API 特判。',
      '实现层不会机械保存整个调用栈。V8 的 scope analysis 找出逃逸 binding，把它们分配进 heap Context slot；未捕获或可证明不逃逸的局部仍可留在寄存器，甚至被优化器消除。闭包的表达力与生命周期成本来自“函数对象让环境继续可达”，所以监听器、缓存、Promise 队列与大对象捕获都要从 retained path 审查。'
    ],
    chapters: [
      {
        title: '函数捕获的是 binding，不是创建时的值',
        kicker: '01 · BINDING CAPTURE',
        paragraphs: [
          'OrdinaryFunctionCreate 接收 env，并把它保存到新函数的 [[Environment]]。函数调用不会在调用点重新决定外层作用域，因此 JavaScript 使用 lexical scoping：名称解析依据函数写在哪里，而不是从哪里调用。call/apply 能改变 this 与参数，不能替换 [[Environment]]。',
          '多个闭包可以持有同一 environment，从而共享同一个 mutable binding。counter 的 read 和 increment 不是各有一份 count；increment 执行 SetMutableBinding 后，read 再次 GetBindingValue 得到更新值。若想得到快照，应主动创建新值或新 binding，例如函数参数、块级 const 或结构化克隆。',
          '闭包也能捕获对象值所在 binding。重新给 binding 赋新对象与修改原对象属性仍是两类操作；是否让其他闭包看见取决于它们读取同一 binding，还是早已把当时对象值传入另一个参数 binding。'
        ],
        code: `function makeCell(initial: number) {
  let value = initial
  return {
    read: () => value,
    write: (next: number) => { value = next }
  }
}

const cell = makeCell(1)
console.assert(cell.read() === 1)
cell.write(2)
console.assert(cell.read() === 2)

let current = { version: 1 }
const readBinding = () => current
const readSnapshot = ((snapshot) => () => snapshot)(current)
current = { version: 2 }
console.assert(readBinding().version === 2)
console.assert(readSnapshot().version === 1)`,
        language: 'typescript',
        takeaway: '分析闭包时画 binding identity：哪些函数共享同一 binding，哪些只是收到某次 GetValue 的结果。'
      },
      {
        title: '调用环境通过函数的 [[Environment]] 接回创建环境',
        kicker: '02 · FUNCTION ENVIRONMENT',
        paragraphs: [
          '调用 ECMAScript function 时，NewFunctionEnvironment 创建 Function Environment，[[OuterEnv]] 取 F.[[Environment]]，随后 FunctionDeclarationInstantiation 创建参数、arguments、函数体声明等 binding。动态调用位置的 LexicalEnvironment 不会插进这条链。',
          '嵌套函数每次执行外层函数都会创建新的环境，因此两次 makeCounter 得到独立状态。相反，把闭包缓存在模块级 Map 中会让对应调用环境跨请求存活；若 key 永不淘汰，环境也不会释放。',
          '命名函数表达式会额外建立只在函数内部可见的 immutable name binding，使递归不依赖外部同名变量。箭头函数仍保存 lexical environment，但 this/arguments/super 的解析规则不同，将在下一课单独推导。'
        ],
        code: `function makeCounter() {
  let count = 0
  return () => ++count
}

const first = makeCounter()
const second = makeCounter()
console.assert(first() === 1)
console.assert(first() === 2)
console.assert(second() === 1) // 两次调用对应两个外层环境

const factorial = function inner(n: number): number {
  return n <= 1 ? 1 : n * inner(n - 1)
}
console.assert(factorial(5) === 120)
// typeof inner === "undefined"：名称只在表达式内部环境可见`,
        language: 'typescript',
        takeaway: '闭包的外层环境在函数创建时确定；每次执行创建语句是否产生新环境，决定状态是共享还是隔离。'
      },
      {
        title: 'for let 每轮复制值到新 binding',
        kicker: '03 · PER-ITERATION ENVIRONMENT',
        paragraphs: [
          'ForBodyEvaluation 从 for 头部的 lexical declaration 得到 perIterationBindings。进入循环前和每轮 body 结束后调用 CreatePerIterationEnvironment：取上一轮环境的 outer，创建新 Declarative Environment，为每个名称建立 mutable binding，再读取上一轮值并 Initialize 新 binding。',
          'increment expression 在新环境中执行，所以它更新的是将供下一轮 test/body 使用的 binding。当轮 body 创建的闭包已经保存旧环境，不受下一轮 ++i 影响。for-of/for-in 的 lexical declaration 也为每次迭代建立绑定，但具体求值算法与三段式 for 不同。',
          'const 可用于 for-of 的每轮 binding，因为每一轮都是新的 immutable binding；传统 for (const i = 0; ...; i++) 则无法更新同一 binding。continue、break 和 abrupt completion 都由循环算法决定是否创建下一轮环境，不能简单理解成把 let 包进 body 花括号。'
        ],
        code: `const withLet: Array<() => number> = []
for (let i = 0; i < 3; i++) {
  withLet.push(() => i)
}
console.assert(withLet.map(read => read()).join(",") === "0,1,2")

const withVar: Array<() => number> = []
for (var j = 0; j < 3; j++) {
  withVar.push(() => j)
}
console.assert(withVar.map(read => read()).join(",") === "3,3,3")

const values = [10, 20, 30]
const withConst: Array<() => number> = []
for (const value of values) withConst.push(() => value)
console.assert(withConst[1]() === 20)`,
        language: 'typescript',
        takeaway: 'for-let 的关键是每轮 binding identity 不同；“let 是块级作用域”本身还不足以解释三个回调为何得到三个值。'
      },
      {
        title: '异步只推迟读取，不改变闭包规则',
        kicker: '04 · ASYNC CALLBACK',
        paragraphs: [
          'setTimeout、Promise reaction、事件回调只是让函数在之后调用。函数仍读取自己创建时保存的环境；for-var 问题之所以在异步示例中显眼，是因为回调执行前循环已把共享 j 更新到终值。即使同步地把这些回调存入数组、循环后再调用，结果同样是共享终值。',
          '修复方式的共同本质是制造新 binding：for-let 由语言算法完成；IIFE 的参数在每次调用创建新 parameter binding；数组 map 的 callback 参数也每次新建调用环境。bind(null, i) 则把当次 i 值写入 bound arguments 列表，效果类似值快照。',
          '异步回调还会延长捕获对象生命周期。等待网络、长定时器或永不 settle 的协调结构可能保留 request、buffer 与组件实例。取消操作不仅停止副作用，也应移除队列/监听器对 callback 的强引用。'
        ],
        code: `const callbacks: Array<() => number> = []
for (var i = 0; i < 3; i++) {
  callbacks.push(((snapshot: number) => () => snapshot)(i))
}
console.assert(callbacks.map(fn => fn()).join(",") === "0,1,2")

const viaMap = [0, 1, 2].map(value => () => value)
console.assert(viaMap[2]() === 2)

function snapshot(value: number) { return value }
const viaBind = [0, 1, 2].map(value => snapshot.bind(null, value))
console.assert(viaBind[1]() === 1)`,
        language: 'typescript',
        takeaway: '异步不是闭包的另一套语义。先确定何时创建函数和 binding，再把回调调用时间放进事件时间线。'
      },
      {
        title: 'V8 只物化需要逃逸的 Context',
        kicker: '05 · V8 CONTEXT',
        paragraphs: [
          'scope analysis 为每个变量确定是否被内层函数引用、是否赋值以及 location。普通局部可映射到 Ignition register；被捕获 binding 进入 Context slot，函数对象保存 Context。ScopeInfo 让运行时按索引访问，不需要用变量名反复查哈希表。',
          'Context 的 previous 指针近似规范 [[OuterEnv]] 链，但 V8 可以跳过无需物化的词法层、合并信息或把值提升进优化代码。BlockContext、CatchContext、WithContext 分别服务需要实际运行时环境的块、catch 与动态对象环境。',
          'TurboFan 若证明闭包不逃逸，可内联函数、标量替换环境或消除 Context 分配；debugger、eval、with 会增加可观察性并限制优化。性能结论必须看 allocation profile 与优化日志，不能见到箭头函数就断言“每次都昂贵创建闭包”。'
        ],
        points: [
          '语义上存在 Environment Record，不代表 heap 中一定有一一对应的对象。',
          '捕获一个小值也可能让同一 Context 中其他 slot 或相关对象继续存活，具体布局依实现和优化而变。',
          '热路径是否复用 callback 应由 identity 需求、下游订阅 API 与 profile 决定。'
        ],
        code: `function noEscape(items: number[]) {
  // 回调可能被内联，闭包/环境分配可被优化器消除。
  return items.map(value => value * 2)
}

function escape(large: Uint8Array) {
  // 返回函数让 captured binding 跨调用存活。
  return () => large.byteLength
}

const retained = escape(new Uint8Array(1024 * 1024))
console.assert(retained() === 1024 * 1024)`,
        language: 'typescript',
        takeaway: '规范决定结果，逃逸分析决定表示。优化闭包前先证明函数 identity 或捕获环境真的成为瓶颈。'
      },
      {
        title: '从 retained path 处理闭包泄漏',
        kicker: '06 · LIFETIME DESIGN',
        paragraphs: [
          '闭包泄漏通常不是“闭包有 bug”，而是 owner 生命周期不清。EventTarget 保存 listener，listener 的 [[Environment]] 保存组件 binding，组件引用 DOM/cache，于是全图被 retained。只把组件局部变量设为 null，若 listener 捕获的是其他别名或整个 state，路径仍存在。',
          '设计 API 时让订阅返回 dispose，组合 AbortSignal，或让 owner 在统一 lifecycle scope 注册清理函数。缓存闭包时设置容量与淘汰；避免在长寿命 callback 中捕获完整 request/context，只提取所需 primitive 或最小对象。',
          'heap snapshot 应沿 GC root→listener collection→function→context→payload 查 retaining path，再验证 unsubscribe 后路径消失。测试可以断言 listener count、dispose 幂等、abort 后队列清空，并做多轮 mount/unmount 的 GC 后基线。'
        ],
        code: `class SubscriptionScope {
  private readonly cleanups = new Set<() => void>()

  add(cleanup: () => void): () => void {
    this.cleanups.add(cleanup)
    return () => {
      if (this.cleanups.delete(cleanup)) cleanup()
    }
  }

  dispose(): void {
    for (const cleanup of this.cleanups) cleanup()
    this.cleanups.clear()
  }

  get size() { return this.cleanups.size }
}

const scope = new SubscriptionScope()
scope.add(() => console.log("remove listener"))
scope.dispose()
console.assert(scope.size === 0)`,
        language: 'typescript',
        takeaway: '闭包生命周期应从“谁持有函数、何时释放”设计。dispose、取消和容量边界比盲目避免闭包更有效。'
      }
    ],
    mechanisms: [
      '函数创建时把当前 LexicalEnvironment 保存到 [[Environment]]；调用环境以它作为 outer。',
      'Identifier 读取捕获环境中的 binding，因此后续赋值对共享该 binding 的闭包可见。',
      'for-let 的 CreatePerIterationEnvironment 每轮创建新 binding，并从上一轮复制当前值。',
      'V8 scope analysis 把逃逸 binding 放入 Context slot，函数对象保持 Context 可达。',
      'listener、任务队列和缓存持有函数时，也间接保持捕获环境与对象图存活。'
    ],
    pitfalls: [
      '说闭包“保存变量值的副本”，无法解释共享计数器与赋值后的新值。',
      '只用块级作用域解释 for-let，不说明每轮新 binding 与 increment 所在环境。',
      '把 for-var 的结果归咎于 setTimeout，忽略循环后同步调用同样读取共享终值。',
      '认为所有局部都会因闭包进入 heap，忽略捕获集合、逃逸分析与优化。',
      '为了减少闭包复用一个可变 callback/state，反而制造 identity 与并发串扰。',
      '发现大对象 retained 后只把局部设 null，没有移除真正持有 callback 的 listener/cache。'
    ],
    variants: [
      {
        title: '共享 mutable binding',
        useWhen: '多个操作确实属于同一状态单元，需要看到彼此更新，例如私有计数器或模块状态。',
        tradeoff: '封装简单；并发异步、重入与测试隔离需要明确协议。',
        code: `function cell<T>(initial: T) {
  let value = initial
  return {
    get: () => value,
    set: (next: T) => { value = next }
  }
}`,
        language: 'typescript'
      },
      {
        title: '参数 binding 快照',
        useWhen: '每个 callback 应固定创建时输入，不应观察外层变量后续重赋值。',
        tradeoff: '语义清楚；对象值仍可能共享内部 mutation，真正隔离需复制或不可变数据。',
        code: `const handlers = inputs.map(input => {
  const snapshot = structuredClone(input)
  return () => snapshot
})`,
        language: 'typescript'
      },
      {
        title: '显式状态对象',
        useWhen: '状态需要被调试、序列化、替换、注入或由多个组件组合，而隐藏 closure state 不利于观测。',
        tradeoff: '依赖与状态更可见；调用面更宽，需要管理对象所有权和 mutation。'
      }
    ],
    studyPlan: {
      readingMinutes: 30,
      sourceMinutes: 20,
      practiceMinutes: 40,
      reviewMinutes: 10
    },
    exampleLanguage: 'typescript',
    example: `type Binding<T> = { value: T }
type Environment = {
  outer: Environment | null
  bindings: Map<string, Binding<unknown>>
}

type Closure<Args extends unknown[], Result> = {
  environment: Environment
  call: (environment: Environment, ...args: Args) => Result
}

function resolve<T>(environment: Environment, name: string): Binding<T> {
  const binding = environment.bindings.get(name)
  if (binding) return binding as Binding<T>
  if (environment.outer) return resolve<T>(environment.outer, name)
  throw new ReferenceError(name)
}

function createClosure<Args extends unknown[], Result>(
  environment: Environment,
  body: Closure<Args, Result>["call"]
): (...args: Args) => Result {
  const closure: Closure<Args, Result> = {
    environment,
    call: body
  }
  return (...args) => closure.call(closure.environment, ...args)
}

function nextIteration(
  previous: Environment,
  names: string[]
): Environment {
  const current: Environment = {
    outer: previous.outer,
    bindings: new Map()
  }
  for (const name of names) {
    current.bindings.set(name, {
      value: resolve(previous, name).value
    })
  }
  return current
}

const outer: Environment = { outer: null, bindings: new Map() }
let iteration: Environment = {
  outer,
  bindings: new Map([["i", { value: 0 }]])
}

const readers: Array<() => number> = []
for (let step = 0; step < 3; step++) {
  readers.push(createClosure(
    iteration,
    environment => resolve<number>(environment, "i").value
  ))

  iteration = nextIteration(iteration, ["i"])
  resolve<number>(iteration, "i").value++
}

console.assert(readers.map(read => read()).join(",") === "0,1,2")`,
    buildSteps: [
      { title: '积木 1：实现共享 binding cell', body: '让两个 closure 通过同一 Binding 对象读写，证明捕获不是数值快照。' },
      { title: '积木 2：保存创建环境', body: '函数对象显式保存 environment，调用时从该环境解析名称；从另一个动态环境调用也不得改变结果。' },
      { title: '积木 3：实现 per-iteration 环境复制', body: '为指定名称建立新 Binding，并复制上一轮 GetBindingValue；用三个 reader 验证 0/1/2。' },
      { title: '积木 4：加入 var 共享反例', body: '让三次创建都保存同一个函数环境 binding，循环后读取 3/3/3，并用参数 binding 修复。' },
      { title: '积木 5：做 retained path 实验', body: '监听器捕获 10MB buffer，heap snapshot 找到 listener→function→context→buffer；dispose 后重复快照验证释放。' }
    ],
    selfCheckQuestion: 'for (let i = 0; i < 3; i++) 创建的三个闭包为什么分别读到 0、1、2？为什么说“let 是块级作用域”仍不是完整答案？',
    selfCheckAnswer: 'for 头部的 lexical declaration 让 i 进入 perIterationBindings。ForBodyEvaluation 在进入循环并在每轮 body 后调用 CreatePerIterationEnvironment：为 i 创建新的 mutable binding，把上一轮 binding 当前值复制进去，然后 increment 在新环境中更新它。当轮创建的闭包把当轮 LexicalEnvironment 保存到 [[Environment]]，所以三个函数最终沿不同环境读取三个不同 binding。仅说“块级作用域”只说明 i 不在函数级 var 环境，无法解释同一个循环 body 的不同迭代为什么仍不共享一个块 binding。'
  }
}
