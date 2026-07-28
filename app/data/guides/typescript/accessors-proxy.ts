import type { TopicGuide } from '../../topic-guides'

export const typescriptAccessorProxyGuides: Record<string, TopicGuide> = {
  'getter、setter、Proxy、Reflect 与 Receiver': {
    official: {
      title: 'ECMAScript Language Specification · OrdinaryGet',
      url: 'https://tc39.es/ecma262/multipage/ordinary-and-exotic-objects-behaviours.html#sec-ordinary-object-internal-methods-and-internal-slots-get-p-receiver',
      note: 'OrdinaryGet 把“在哪个 holder 上找到 descriptor”和“把哪个 Receiver 交给 accessor”分开；Proxy [[Get]] 接收 target、property key 与同一个 Receiver，trap 缺失时必须按原参数转发，并受不可配置属性不变量约束。'
    },
    source: {
      repo: 'v8/v8',
      file: 'src/builtins/proxy-get-property.tq',
      symbol: 'ProxyGetProperty',
      language: 'cpp',
      url: 'https://github.com/v8/v8/blob/main/src/builtins/proxy-get-property.tq',
      walkthrough: [
        'builtin 入口已经拿到 proxy、property key、receiverValue 和缺失属性策略；receiverValue 不一定等于 proxy，例如从原型链经过 proxy 查到 getter 时仍是最初实例。',
        '先读取 [[ProxyHandler]]。revocable proxy 被撤销后 handler 为 null，任何 get 都在 trap 查找之前抛 TypeError；target 则来自 [[ProxyTarget]]。',
        'GetInterestingMethod 读取 handler.get。没有 trap 时调用 GetPropertyWithReceiver(target, name, receiverValue)，保留原 Receiver 而非退化为 target[name]。',
        '存在 trap 时以 handler 为 trap 的 this，并传入 target、name、receiverValue；trap 返回值随后进入 CheckGetSetTrapResult。',
        '不变量检查会读取 target 自有 descriptor：不可配置且不可写数据属性不能被 trap 报告成另一值，不可配置且 getter 缺失的 accessor 只能报告 undefined。'
      ],
      code: `// 摘自 V8 main/src/builtins/proxy-get-property.tq。
// Torque 会生成 builtin；这里只增加中文注释并保留真实分派与不变量检查。
transitioning builtin ProxyGetProperty(
    implicit context: Context)(
    proxy: JSProxy,
    name: PropertyKey,
    receiverValue: JSAny,
    onNonExistent: Smi): JSAny {
  PerformStackCheck();
  dcheck(TaggedIsNotSmi(name));
  dcheck(Is<Name>(name));
  dcheck(!IsPrivateSymbol(name));

  // 被 revoke 后 [[ProxyHandler]] 为 null，所有操作立即失败。
  let handler: JSReceiver;
  typeswitch (proxy.handler) {
    case (Null): {
      ThrowTypeError(MessageTemplate::kProxyRevoked, 'get');
    }
    case (h: JSReceiver): {
      handler = h;
    }
  }

  const target = Cast<JSReceiver>(proxy.target) otherwise unreachable;

  // handler.get 缺失时透明转发；关键是继续传 receiverValue。
  const trap: Callable =
      GetInterestingMethod(handler, GetStringConstant())
      otherwise return GetPropertyWithReceiver(
          target, name, receiverValue, onNonExistent);

  // trap 的 this 是 handler，三个显式参数依次为 target、key、receiver。
  const trapResult =
      Call(context, trap, handler, target, name, receiverValue);

  // 强制执行不可配置/不可写数据属性及无 getter accessor 的不变量。
  CheckGetSetTrapResult(
      target, proxy, name, trapResult, kProxyGet);
  return trapResult;
}`
    },
    overview: [
      '读取 obj.x 看似只有对象和键，规范内部却携带三个角色：Receiver 是最初发起读取的对象，holder 是当前查找到 descriptor 的对象，descriptor 决定返回存储值还是调用 getter。若 x 在 Parent.prototype 上是 getter，而读取 child.x，holder 是 Parent.prototype，getter 的 this 仍是 child。这个分离支撑继承、super、Reflect 和 Proxy 的一致组合。',
      '写入更加微妙。OrdinarySetWithOwnDescriptor 可能调用 holder 上的 setter，也可能在 Receiver 上创建或更新自有数据属性；只读 descriptor、不可扩展 Receiver、已有 accessor 与代理对象都会改变结果。严格赋值语句在 [[Set]] 返回 false 时抛 TypeError，Reflect.set 则把这个 Boolean 直接交给调用者，因此它适合实现可组合的元对象操作。',
      'Proxy 不只是“拦截点集合”。它用 handler traps 替换 target 的内部方法，再以一组不变量阻止 handler 谎报会破坏对象模型的事实。正确透明转发通常需要 Reflect.get(target, key, receiver) 或 Reflect.set(target, key, value, receiver)，但带 #private、Map/Set 内部槽、DOM brand check 的对象又可能要求把 receiver 改回 target。这些边界决定 Proxy 是可靠 membrane、调试器还是一层隐蔽 bug。'
    ],
    chapters: [
      {
        title: 'descriptor 决定属性是存储单元还是行为入口',
        kicker: '01 · DATA AND ACCESSOR',
        paragraphs: [
          'Property Descriptor 分为 data 与 accessor 两类。data descriptor 拥有 [[Value]]、[[Writable]]；accessor descriptor 拥有 [[Get]]、[[Set]]。二者共享 [[Enumerable]]、[[Configurable]]，同一 descriptor 不能同时拥有 value/writable 与 get/set。普通赋值创建的属性通常 writable、enumerable、configurable 都为 true，Object.defineProperty 省略标志时默认 false。',
          'getter 在读取时执行，setter 在写入时执行；它们不是函数值字段。Object.getOwnPropertyDescriptor 能取到真实 getter 函数而不执行它，Object.keys 只看 enumerable 也不会为了列键调用 getter。对象展开与 Object.assign 读取每个 enumerable property 的值，因此会触发 getter并把结果变成目标上的 data property。',
          'configurable 为 false 后，descriptor 的类别不能再任意切换，enumerable 不能修改，不可写数据值只能保持 SameValue。理解这些状态转换是 Proxy invariants、Object.freeze 和库级 observable property 的基础。'
        ],
        code: `let reads = 0
const source = {}
Object.defineProperty(source, "value", {
  enumerable: true,
  configurable: false,
  get() {
    reads++
    return 7
  }
})

const descriptor = Object.getOwnPropertyDescriptor(source, "value")!
console.assert(typeof descriptor.get === "function")
console.assert(reads === 0)

const copied = { ...source }
console.assert(reads === 1)
console.assert(copied.value === 7)
console.assert("value" in copied)
console.assert(!("get" in Object.getOwnPropertyDescriptor(copied, "value")!))`,
        language: 'typescript',
        takeaway: '先读取 descriptor，再判断当前操作是否会执行 getter、调用 setter、复制值或改变属性状态。'
      },
      {
        title: 'OrdinaryGet 沿 holder 查找，却把 Receiver 交给 getter',
        kicker: '02 · GET HOLDER RECEIVER',
        paragraphs: [
          'OrdinaryGet(O, P, Receiver) 先调用 O.[[GetOwnProperty]]。无自有 descriptor 时取 parent=O.[[GetPrototypeOf]]，再执行 parent.[[Get]](P, Receiver)，因此原型递归时 Receiver 不变。找到 data descriptor 直接返回 [[Value]]；找到 accessor descriptor 则以 Receiver 调用 getter。',
          '这解释了 prototype getter 为什么读取子实例字段，也解释了 super.x：查找起点是 HomeObject 的原型，Receiver 是当前 this。若错误地用 parent.x 代替 Reflect.get(parent, "x", this)，getter 的 this 会变成 parent，结果和副作用都可能落在错误对象。',
          'getter 内再次读取 this.other 会启动新的属性查找，可能经过同一 Proxy 或触发另一 getter。响应式系统需要用 active effect 去重并检测递归；序列化、日志和 debugger 展示也应警惕“读属性”会执行任意用户代码。'
        ],
        code: `const parent = {
  get summary() {
    return this.name + ":" + this.score
  }
}

const child = Object.create(parent) as {
  name: string
  score: number
  summary: string
}
child.name = "Ada"
child.score = 9

console.assert(child.summary === "Ada:9")
console.assert(
  Reflect.get(parent, "summary", child) === "Ada:9"
)
console.assert(
  Reflect.get(parent, "summary", parent) === "undefined:undefined"
)`,
        language: 'typescript',
        takeaway: 'holder 回答“descriptor 在哪里”，Receiver 回答“accessor 把谁当 this”；两者经常不同。'
      },
      {
        title: 'OrdinarySet 在 holder 规则与 Receiver 存储之间协调',
        kicker: '03 · SET AND RECEIVER',
        paragraphs: [
          'OrdinarySet(O, P, V, Receiver) 先找 O 的自有 descriptor；没有时沿原型调用 parent.[[Set]]，仍保留 Receiver。找到 accessor descriptor 时，以 Receiver 调用 setter。找到 writable data descriptor 时，不会直接覆写 holder，而会检查 Receiver 的已有 descriptor并在 Receiver 上更新或创建自有 data property。',
          '因此 child.x = 2 遇到 parent 上 writable data x，通常在 child 创建 own x，parent.x 保持不变；遇到 parent setter 则执行 setter，setter 可选择写入 child._x。若 Receiver 不是 object、不可扩展、已有只读属性或 accessor 无 setter，[[Set]] 返回 false。',
          '赋值表达式在 strict code 中遇到 false 会抛错，sloppy code 可能静默失败；Reflect.set 始终返回 Boolean。库实现应使用返回值判断真正写入与否，不能看到 trap 没抛错就假定状态已经改变。'
        ],
        code: `const parent = { x: 1 }
const child = Object.create(parent)

console.assert(Reflect.set(parent, "x", 2, child))
console.assert(child.x === 2)
console.assert(parent.x === 1)
console.assert(Object.hasOwn(child, "x"))

const sealed = Object.preventExtensions({})
console.assert(Reflect.set(parent, "y", 3, sealed) === false)

const readonly = {}
Object.defineProperty(readonly, "fixed", {
  value: 1,
  writable: false
})
console.assert(Reflect.set(readonly, "fixed", 2) === false)`,
        language: 'typescript',
        takeaway: 'Set 的查找规则来自 holder，最终 setter this 或新属性落点来自 Receiver；Boolean 是写入是否成立的证据。'
      },
      {
        title: 'Reflect 暴露内部方法形状，便于透明转发和组合',
        kicker: '04 · REFLECT',
        paragraphs: [
          'Reflect.get(target, key, receiver=target) 对应 target.[[Get]](key, receiver)，Reflect.set 对应 [[Set]] 并返回 Boolean。Reflect.defineProperty、deleteProperty、preventExtensions 等也返回内部方法结果，不像 Object.defineProperty 那样在 false 时统一抛错。它们因此更适合作为 Proxy trap 的默认实现。',
          'Reflect API 与 Proxy trap 名称高度对齐，但并非所有 Object 方法都只是同名包装。例如 Object.keys 组合 [[OwnPropertyKeys]] 与 [[GetOwnProperty]] 并过滤 enumerable string keys；in 使用 [[HasProperty]]，Object.hasOwn 只查 [[GetOwnProperty]]。选择错误的操作会让继承属性、symbol 或不可枚举属性混入结果。',
          '透明 get trap 应写 Reflect.get(target, key, receiver)，直接 target[key] 会把 target 变成 getter this。透明 set trap同理要传 receiver；Reflect.set(target,key,value) 默认 receiver=target，会把本应落在派生对象的写入错误地写回 target。'
        ],
        code: `const target = {
  _value: 1,
  get value() { return this._value },
  set value(next) { this._value = next }
}

const receiver = { _value: 9 }
console.assert(Reflect.get(target, "value", receiver) === 9)
console.assert(Reflect.set(target, "value", 10, receiver))
console.assert(receiver._value === 10)
console.assert(target._value === 1)

console.assert(Reflect.defineProperty(receiver, "fixed", {
  value: 3,
  configurable: false
}))`,
        language: 'typescript',
        takeaway: 'Reflect 让代码显式携带 Receiver 与 Boolean 结果，是实现 trap、super-like 操作和元对象工具的基础积木。'
      },
      {
        title: 'Proxy get/set trap 替换内部方法，但默认路径仍应转发 Receiver',
        kicker: '05 · PROXY DISPATCH',
        paragraphs: [
          'new Proxy(target, handler) 创建 exotic object，保存 [[ProxyTarget]] 与 [[ProxyHandler]]。proxy.x 进入 Proxy [[Get]]：若 handler.get 是 undefined，调用 target.[[Get]](x, receiver)；存在 trap 则 Call(trap, handler, [target,x,receiver])。trap 的 this 是 handler，不是 proxy 或 target。',
          '当 proxy 作为读取起点时 receiver 通常是 proxy；当 proxy 位于另一个对象的 prototype chain，receiver 可以是该派生对象。正确 forwarding 保留 receiver，getter 内的 this 因此观察真实发起者。set trap 也收到 receiver，返回值会 ToBoolean 并在严格赋值中决定是否抛错。',
          'trap 内使用 Reflect.get(...arguments) 是常见最小转发，但要避免再次对同一个 proxy 操作导致无限递归。logging trap 应记录 key、receiver identity 与结果，同时对 Symbol、检查工具读取、Promise thenable 探测等高频隐式访问设置过滤，避免日志本身改变系统行为。'
        ],
        code: `const target = {
  get label() {
    return this.name
  }
}

const events: PropertyKey[] = []
const proxy = new Proxy(target, {
  get(target, key, receiver) {
    events.push(key)
    return Reflect.get(target, key, receiver)
  }
})

const child = Object.create(proxy)
child.name = "child"
console.assert(child.label === "child")
console.assert(events.includes("label"))

// 若写 return target[key as keyof typeof target]，
// label getter 的 this 会错误地变成 target。`,
        language: 'typescript',
        takeaway: 'Proxy trap 拦截的是内部方法调用；透明性来自保留原 operation 的全部参数，尤其是 Receiver。'
      },
      {
        title: 'Proxy invariants 限制 handler 对对象事实的谎报',
        kicker: '06 · INVARIANTS',
        paragraphs: [
          'get trap 不能把 target 上不可配置且不可写 data property 报告成不同值；也不能让不可配置且 getter 为 undefined 的 accessor 返回非 undefined。V8 的 CheckGetSetTrapResult 在 trap 执行后检查这些事实。即使 handler 返回成功，违反不变量仍由引擎抛 TypeError。',
          '其他 trap 也有对应约束：ownKeys 不能遗漏不可配置 own keys，target 不可扩展时必须准确报告所有 own keys；getOwnPropertyDescriptor 不能凭空把不可配置属性变可配置；isExtensible/preventExtensions 必须与 target 真状态一致。它们共同保证 freeze/seal、反射和优化仍能相信稳定事实。',
          '不变量并不保证 handler 业务正确。可配置属性仍可被 get trap 返回任意值，set trap 可能声称 true 却不写入，只要没有触犯特定 target descriptor 约束。membrane、校验器与审计代理仍需自行定义一致性、权限、事务和异常策略。'
        ],
        code: `const target = {}
Object.defineProperty(target, "fixed", {
  value: 1,
  writable: false,
  configurable: false
})

const liar = new Proxy(target, {
  get() { return 2 }
})

try {
  void liar.fixed
  console.assert(false)
} catch (error) {
  console.assert(error instanceof TypeError)
}

const honest = new Proxy(target, {
  get(target, key, receiver) {
    return Reflect.get(target, key, receiver)
  }
})
console.assert(honest.fixed === 1)`,
        language: 'typescript',
        takeaway: 'Proxy 能改写行为，不能破坏 target 已承诺的不可配置事实；invariant 是对象模型的护栏。'
      },
      {
        title: '内建内部槽与 #private 让透明代理出现 receiver 边界',
        kicker: '07 · BRAND CHECKED RECEIVERS',
        paragraphs: [
          'Map.prototype.get、Set.prototype.add、Date 方法等会检查 this 是否拥有相应内部槽。proxy 包装 Map 时，proxy.get("x") 先经 proxy 取得原型方法，随后方法调用的 this 是 proxy；proxy 没有 MapData 内部槽，于是抛 TypeError。透明 forwarding get trap 并不能自动转移内部槽。',
          '#private 也做品牌检查。class 方法从 proxy 上调用时，this 是 proxy，而 private elements 在 target 上，所以 this.#x 失败。常见修复是在 get trap 中对函数返回 value.bind(target)，但它会改变方法 identity、让动态 receiver 消失、可能把本应保留 proxy 的普通 getter/method 也绑错，并造成每次读取新函数。',
          '工程上应按能力设计 wrapper：为 Map 显式暴露 get/set/size API，或在 trap 中只绑定已知需要 target brand 的成员并缓存结果。membrane 若需要保持 wrapper identity，还要双向 WeakMap 缓存 target↔proxy，包装入参/返回值并处理 this、prototype、错误与撤销。'
        ],
        code: `const map = new Map<string, number>([["x", 1]])
const naive = new Proxy(map, {})

try {
  naive.get("x")
  console.assert(false)
} catch (error) {
  console.assert(error instanceof TypeError)
}

const methodCache = new Map<PropertyKey, Function>()
const wrapped = new Proxy(map, {
  get(target, key) {
    const value = Reflect.get(target, key, target)
    if (typeof value !== "function") return value
    let bound = methodCache.get(key)
    if (!bound) {
      bound = value.bind(target)
      methodCache.set(key, bound)
    }
    return bound
  }
})
console.assert(wrapped.get("x") === 1)
console.assert(wrapped.get === wrapped.get)`,
        language: 'typescript',
        takeaway: 'Receiver 透明性与内部槽品牌兼容有时冲突；按已知协议包装并缓存，比“所有函数都 bind”更可靠。'
      },
      {
        title: 'revocable membrane、性能与安全都需要显式边界',
        kicker: '08 · ENGINEERING MEMBRANE',
        paragraphs: [
          'Proxy.revocable 返回 proxy 与 revoke。revoke 把内部 target/handler 置空，后续所有代理内部方法抛 TypeError；它适合租约式能力和插件卸载，但已经从代理读出的裸函数、对象引用或 primitive 不会被追溯收回。真正 membrane 必须递归包装跨边界对象。',
          '权限代理不能只拦 get/set。defineProperty、deleteProperty、ownKeys、getOwnPropertyDescriptor、setPrototypeOf、apply、construct 等都可能绕过策略；原始 target 泄漏也会完全旁路代理。安全模型还需控制闭包、模块导入、原型污染、I/O 与资源预算，Proxy 只能成为其中一个对象能力边界。',
          '引擎对普通稳定对象的 inline cache 更容易优化，Proxy trap 通常要求进入通用分派并执行用户代码。不要仅凭“Proxy 慢”拒绝它，也不要把它放进每个数值访问热循环；用真实 workload 的 trace/benchmark 测量 trap 次数、分配、去优化和延迟，把粗粒度 API 边界与细粒度数据路径分开。',
          '测试 membrane 时不能只断言一次属性读取。至少要覆盖同一 target 是否得到稳定 proxy identity、跨边界返回的嵌套对象是否继续包装、异常是否泄漏原始对象、不可配置 descriptor 是否仍满足不变量、revoke 后旧 wrapper 是否全部失败，以及被提前取出的引用是否仍存活。还要把每次 trap 的输入、结果与异常记入审计轨迹。这样才能把“看起来能拦截”提升为可以陈述和验证的能力合同。'
        ],
        code: `function lease<T extends object>(target: T) {
  const { proxy, revoke } = Proxy.revocable(target, {
    get(target, key, receiver) {
      return Reflect.get(target, key, receiver)
    }
  })
  return { value: proxy, close: revoke }
}

const capability = lease({ read: () => 7 })
const escaped = capability.value.read
console.assert(capability.value.read() === 7)
capability.close()

try {
  capability.value.read
  console.assert(false)
} catch (error) {
  console.assert(error instanceof TypeError)
}
console.assert(escaped() === 7) // 已泄漏的函数不会被 revoke`,
        language: 'typescript',
        takeaway: '撤销只切断代理路径；可靠 membrane 必须控制所有跨边界引用、所有相关 traps 与原始 target 泄漏。'
      }
    ],
    mechanisms: [
      'descriptor 决定数据读取、getter 调用、setter 调用和属性可重配置边界。',
      'OrdinaryGet/Set 沿 holder/prototype 查规则，同时把最初 Receiver 传给 accessor 或最终存储。',
      'Reflect.get/set 显式暴露 Receiver 并返回内部方法结果，适合透明转发。',
      'Proxy internal methods 先检查 revocation，再选择 trap 或目标默认路径。',
      'trap 结果经过 invariants 校验，不能与 target 的不可配置事实冲突。',
      '内建内部槽和 #private brand 可能拒绝 proxy Receiver，需要协议化绑定或专用 wrapper。',
      'revocable membrane 还需身份缓存、递归包装、全 trap 策略与泄漏控制。'
    ],
    pitfalls: [
      '认为 getter 的 this 是 descriptor 所在 prototype，而不是最初 Receiver。',
      '在 get trap 中写 target[key] 丢失 Receiver，导致继承 getter 和 super-like 读取错误。',
      '忽略 Reflect.set 的 false 返回，误以为未抛错就代表写入成功。',
      '把 Object.defineProperty 与 Reflect.defineProperty 的失败协议当成完全一致。',
      'trap 内再次访问 proxy 同一属性，制造无限递归或重复副作用。',
      '以为 Proxy 可以谎报任何值，忽略不可配置/不可写和 ownKeys 等 invariants。',
      '用空 handler 包装 Map/#private 实例并期待所有方法透明工作。',
      '对所有函数每次 get 都 bind target，破坏方法 identity 与动态 receiver。',
      '把 Proxy 当完整安全沙箱，只实现 get/set，仍泄漏 target 或其他反射路径。'
    ],
    variants: [
      {
        title: '访问器属性',
        useWhen: '行为局部属于单个对象/原型属性，需要维持普通对象反射与继承语义。',
        tradeoff: '边界清楚、引擎容易优化；只能拦截已声明属性，无法统一观察所有 keys。',
        code: `const state = {
  _value: 0,
  get value() { return this._value },
  set value(next: number) {
    if (next < 0) throw new RangeError("negative")
    this._value = next
  }
}`,
        language: 'typescript'
      },
      {
        title: '透明 forwarding Proxy',
        useWhen: '需要记录、依赖追踪或跨对象统一策略，且 target 不依赖难以转发的内部槽品牌。',
        tradeoff: '覆盖面广；trap、invariant、identity 与性能路径更复杂，必须保留 receiver。',
        code: `const observed = new Proxy(target, {
  get(target, key, receiver) {
    track(target, key)
    return Reflect.get(target, key, receiver)
  },
  set(target, key, value, receiver) {
    const changed = Reflect.set(target, key, value, receiver)
    if (changed) trigger(target, key)
    return changed
  }
})`,
        language: 'typescript'
      },
      {
        title: '显式 capability wrapper',
        useWhen: '安全、内部槽或稳定类型边界比任意属性透明性重要。',
        tradeoff: '可审计、不会意外暴露反射面；需要手写并维护 API，无法自动代理新增成员。',
        code: `const mapCapability = {
  read(key: string) { return map.get(key) },
  write(key: string, value: number) {
    map.set(key, value)
  }
}`,
        language: 'typescript'
      }
    ],
    studyPlan: {
      readingMinutes: 45,
      sourceMinutes: 35,
      practiceMinutes: 45,
      reviewMinutes: 15
    },
    exampleLanguage: 'typescript',
    example: `type DataDescriptor = {
  kind: "data"
  value: unknown
  writable: boolean
  configurable: boolean
}

type AccessorDescriptor = {
  kind: "accessor"
  get?: (this: RuntimeObject) => unknown
  set?: (this: RuntimeObject, value: unknown) => void
  configurable: boolean
}

type Descriptor = DataDescriptor | AccessorDescriptor

type RuntimeObject = {
  prototype: RuntimeObject | null
  properties: Map<PropertyKey, Descriptor>
  extensible: boolean
}

function ordinaryGet(
  holder: RuntimeObject,
  key: PropertyKey,
  receiver: RuntimeObject
): unknown {
  const descriptor = holder.properties.get(key)
  if (!descriptor) {
    return holder.prototype
      ? ordinaryGet(holder.prototype, key, receiver)
      : undefined
  }

  if (descriptor.kind === "data") return descriptor.value
  return descriptor.get?.call(receiver)
}

function ordinarySet(
  holder: RuntimeObject,
  key: PropertyKey,
  value: unknown,
  receiver: RuntimeObject
): boolean {
  const descriptor = holder.properties.get(key)
  if (!descriptor) {
    if (holder.prototype) {
      return ordinarySet(holder.prototype, key, value, receiver)
    }
    if (!receiver.extensible) return false
    receiver.properties.set(key, {
      kind: "data",
      value,
      writable: true,
      configurable: true
    })
    return true
  }

  if (descriptor.kind === "accessor") {
    if (!descriptor.set) return false
    descriptor.set.call(receiver, value)
    return true
  }

  if (!descriptor.writable) return false
  const receiverDescriptor = receiver.properties.get(key)
  if (receiverDescriptor) {
    if (receiverDescriptor.kind !== "data" ||
        !receiverDescriptor.writable) return false
    receiverDescriptor.value = value
    return true
  }
  if (!receiver.extensible) return false
  receiver.properties.set(key, {
    kind: "data",
    value,
    writable: true,
    configurable: true
  })
  return true
}

type GetTrap = (
  target: RuntimeObject,
  key: PropertyKey,
  receiver: RuntimeObject
) => unknown

function proxyGet(
  target: RuntimeObject,
  key: PropertyKey,
  receiver: RuntimeObject,
  trap?: GetTrap
): unknown {
  if (!trap) return ordinaryGet(target, key, receiver)
  const result = trap(target, key, receiver)
  const descriptor = target.properties.get(key)

  // 教学版复现 Proxy [[Get]] 最重要的两个 invariant。
  if (descriptor && !descriptor.configurable) {
    if (descriptor.kind === "data" &&
        !descriptor.writable &&
        !Object.is(result, descriptor.value)) {
      throw new TypeError("get trap violated fixed data property")
    }
    if (descriptor.kind === "accessor" &&
        !descriptor.get &&
        result !== undefined) {
      throw new TypeError("get trap violated getter-less accessor")
    }
  }
  return result
}

const parent: RuntimeObject = {
  prototype: null,
  extensible: true,
  properties: new Map()
}
const child: RuntimeObject = {
  prototype: parent,
  extensible: true,
  properties: new Map()
}

child.properties.set("name", {
  kind: "data",
  value: "Ada",
  writable: true,
  configurable: true
})
parent.properties.set("label", {
  kind: "accessor",
  configurable: true,
  get() {
    return "user:" + ordinaryGet(this, "name", this)
  }
})

console.assert(ordinaryGet(child, "label", child) === "user:Ada")
console.assert(ordinarySet(parent, "score", 9, child))
console.assert(ordinaryGet(child, "score", child) === 9)

parent.properties.set("fixed", {
  kind: "data",
  value: 1,
  writable: false,
  configurable: false
})
try {
  proxyGet(parent, "fixed", child, () => 2)
  console.assert(false)
} catch (error) {
  console.assert(error instanceof TypeError)
}`,
    buildSteps: [
      { title: '积木 1：实现 data/accessor descriptor', body: '用互斥联合表达两类 descriptor，拒绝同时出现 value 与 getter，并测试默认属性标志。' },
      { title: '积木 2：实现 ordinaryGet(holder,key,receiver)', body: '沿 prototype 递归时保持 receiver 不变；用父 getter 读取子字段证明 holder 与 Receiver 分离。' },
      { title: '积木 3：实现 ordinarySet', body: '覆盖父 data property、父 setter、只读属性、不可扩展 receiver 与 receiver 已有 accessor 五条分支。' },
      { title: '积木 4：封装 Reflect-like 操作', body: '显式接收 receiver 并返回 Boolean；对照赋值语句展示失败协议差异。' },
      { title: '积木 5：实现 Proxy get dispatch', body: '加入 handler/trap 缺失转发、trap this=handler、target/key/receiver 参数顺序与 revoke 状态。' },
      { title: '积木 6：加入 get invariants', body: '构造不可配置不可写 data descriptor 和 getter 缺失 accessor，让 liar trap 稳定抛 TypeError。' },
      { title: '积木 7：复现 branded receiver 失败', body: '用真实 Map 或 #private class 对比 proxy 与 target receiver，再只为白名单方法做缓存 bind。' },
      { title: '积木 8：建立最小 membrane', body: '用双向 WeakMap 保持 wrapper identity，递归包装入参/返回值，补 revoke 后访问和已泄漏引用的对照测试。' }
    ],
    selfCheckQuestion: '为什么 Proxy get trap 中 return target[key] 与 return Reflect.get(target, key, receiver) 在普通 data property 上结果相同，却会在继承 getter、super-like 转发或响应式代理中出现不同结果？又为什么对 Map/#private 对象有时反而需要 receiver=target？',
    selfCheckAnswer: 'data descriptor 直接返回 [[Value]]，所以 Receiver 暂时不可见；accessor descriptor 会以 Receiver 调用 getter。target[key] 启动一次以 target 为 Receiver 的普通读取，丢掉原操作传入的 receiver；Reflect.get(target,key,receiver) 则继续传递最初 receiver，因此父 getter能读子实例状态，经过多层代理/原型的依赖追踪也能落在正确对象。Map 方法和 #private 方法的实现会检查 this 是否拥有 target 的内部槽或 private brand，而 proxy 自身没有这些槽，透明 receiver 会触发 TypeError。这时需要专用 wrapper 或对白名单成员使用 Reflect.get(target,key,target) 并缓存绑定函数。两种需求相冲突，说明“透明”必须相对于具体对象协议定义，无法用一条通用 trap 覆盖所有对象。'
  }
}
