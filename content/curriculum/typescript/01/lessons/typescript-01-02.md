---
id: "typescript-01-02"
track: "typescript"
title: "Property Key、Descriptor、内部方法与对象形状"
depth: "deep"
visualIndex: "../visuals/typescript-01-02.md"
exampleLanguage: "typescript"
readingMinutes: 40
sourceMinutes: 30
practiceMinutes: 50
reviewMinutes: 15
---

## 官方入口

title: "ECMAScript Language Specification · Object Internal Methods and Property Descriptors"
url: "https://tc39.es/ecma262/multipage/ecmascript-data-types-and-values.html#sec-object-internal-methods-and-internal-slots"

规范用 Property Key、Property Descriptor 与 [[GetOwnProperty]]、[[DefineOwnProperty]]、[[Get]]、[[Set]] 等内部方法描述对象行为。内部方法是语义接口，不要求引擎按相同的数据结构实现；普通对象、Proxy、数组、TypedArray 与模块命名空间可使用不同算法，但必须守住共同不变量。

## 真实源码

repo: "v8/v8"
file: "src/objects/js-objects.cc"
symbol: "JSReceiver::DefineOwnProperty / OrdinaryDefineOwnProperty"
language: "cpp"
url: "https://github.com/v8/v8/blob/main/src/objects/js-objects.cc"

### 逐段讲解

- JSReceiver::DefineOwnProperty 先按接收者种类分派：Array、Proxy、TypedArray、ModuleNamespace 等 exotic object 各自进入专用实现，普通对象才走 OrdinaryDefineOwnProperty。
- 普通路径构造只查 own property 的 LookupIterator，读取当前 descriptor；读取动作可能触发 interceptor 或 accessor 并改变对象 Map，因此真实源码会重启 iterator。
- 引擎随后读取对象是否 extensible，把目标属性、当前 descriptor、新 descriptor 与 shouldThrow 一起交给 ValidateAndApplyPropertyDescriptor。
- ValidateAndApplyPropertyDescriptor 对照规范处理“属性不存在”“不可配置”“data/accessor 互转”“writable 从 true 降为 false”等状态迁移，再选择创建字段、改常量或重配 backing store。
- LookupIterator、Map transition 与 properties/elements backing store 是 V8 的实现层；Property Descriptor 与内部方法不变量属于 ECMAScript 语义层，阅读时要把两层分别标色。

### 源码节选

```cpp
// 摘自 V8 src/objects/js-objects.cc 的主分派，删去少量低频分支并补充中文注释。
// 函数签名、分派顺序和 Ordinary 路径来自真实上游实现。
Maybe<bool> JSReceiver::DefineOwnProperty(
    Isolate* isolate,
    DirectHandle<JSReceiver> object,
    DirectHandle<Object> key,
    PropertyDescriptor* desc,
    Maybe<ShouldThrow> should_throw) {
  if (IsJSArray(*object)) {
    // 数组还要维护 length 与整数索引之间的规范约束。
    return JSArray::DefineOwnProperty(
        isolate, Cast<JSArray>(object), key, desc, should_throw);
  }
  if (IsJSProxy(*object)) {
    // Proxy trap 的返回值仍需经过 target invariant 校验。
    return JSProxy::DefineOwnProperty(
        isolate, Cast<JSProxy>(object), key, desc, should_throw);
  }
  if (IsJSTypedArray(*object)) {
    // TypedArray 的 canonical numeric index 有越界、detached buffer 等规则。
    return JSTypedArray::DefineOwnProperty(
        isolate, Cast<JSTypedArray>(object), key, desc, should_throw);
  }
  if (IsJSModuleNamespace(*object)) {
    // 模块命名空间暴露 live binding，descriptor 行为不能按普通对象处理。
    return JSModuleNamespace::DefineOwnProperty(
        isolate, Cast<JSModuleNamespace>(object), key, desc, should_throw);
  }

  // 普通对象进入规范 OrdinaryDefineOwnProperty 路径。
  return OrdinaryDefineOwnProperty(
      isolate, Cast<JSObject>(object), key, desc, should_throw);
}

Maybe<bool> JSReceiver::OrdinaryDefineOwnProperty(
    Isolate* isolate,
    DirectHandle<JSObject> object,
    const PropertyKey& key,
    PropertyDescriptor* desc,
    Maybe<ShouldThrow> should_throw) {
  LookupIterator it(isolate, object, key, LookupIterator::OWN);

  PropertyDescriptor current;
  MAYBE_RETURN(GetOwnPropertyDescriptor(&it, &current), Nothing<bool>());

  // 上一步可能运行 interceptor/accessor 并改变对象形状，所以重新定位。
  it.Restart();
  bool extensible = JSObject::IsExtensible(isolate, object);

  return ValidateAndApplyPropertyDescriptor(
      isolate, &it, extensible, desc, &current, should_throw, {});
}
```

## 导读

JavaScript 对象可先理解成“Property Key 到 property record 的映射”，但 property record 不只保存值。数据属性还保存 writable、enumerable、configurable；访问器属性保存 get、set、enumerable、configurable。obj.x = 1、Object.defineProperty、对象字面量、class field 看起来都在“加属性”，它们选择的默认 attributes 和触发的内部方法并不完全相同。

规范中的 [[Get]]、[[Set]]、[[DefineOwnProperty]] 是多态语义接口。普通对象沿原型链读写，数组还要守住 length，TypedArray 要解释整数索引，Proxy 把操作交给 trap 后继续验证不变量。把对象简单等同于 HashMap 会遗漏 getter 的 this、原型 setter、不可配置属性和 exotic object；把 V8 HiddenClass 当作规范概念，又会把某个引擎的优化策略误认成语言保证。

V8 为常见对象建立 Map（工程文章常称 HiddenClass）和 DescriptorArray。相同属性、相同添加顺序的对象通常能共享形状，优化器可据此把“按名字查属性”缩成“检查 Map 后按固定 offset 读值”。频繁增删、稀疏索引或特殊 descriptor 可能切换到 dictionary 表示。这个变化通常不改变 JavaScript 可观察语义，却会改变内存、inline cache 和热路径性能。


## 分章正文

### Property Key 只有 String 与 Symbol

kicker: "01 · KEY NORMALIZATION"

对象属性键的规范类型只有 String 和 Symbol。obj[1] 中的 1 会经 ToPropertyKey 变成字符串 "1"；obj[true] 变成 "true"；普通对象作为 key 会先 ToPrimitive，再常常得到 "[object Object]"。Symbol 不做字符串化，因此可创建不会与普通字符串冲突的属性键。Map 则直接以语言值为键，数字 1 与字符串 "1" 是两个键，对象键也按 identity 区分。

Property access 的语法形式不会改变最终 key：obj.name 直接给出字符串 "name"，obj[expr] 先计算 expr 再 ToPropertyKey。private field 的 #name 属于 Private Name/PrivateElement 机制，不是 Property Key，Reflect.ownKeys、Proxy ownKeys trap 与普通属性枚举都看不到它。

常见枚举顺序要拆成三组理解：符合 array index 定义的字符串键先按数值升序，其余字符串通常按创建顺序，Symbol 再按创建顺序。Object.keys 还会过滤不可枚举与 Symbol；Reflect.ownKeys 返回 own string 和 Symbol；for...in 还涉及原型链和重复键过滤。依赖“对象就是插入顺序字典”会在整数样式 key 上出错。

#### 要点

- Record 风格、键固定的数据适合普通对象；任意值做键、频繁增删或需要 size/迭代协议时优先考虑 Map。
- Object.hasOwn(obj, key) 检查 own property；key in obj 同时检查原型链；读取 obj[key] 无法区分“不存在”和“存在且值为 undefined”。
- Symbol.for 使用全局 symbol registry，Symbol("x") 每次创建新 identity；两者都不同于字符串 "Symbol(x)"。

#### 代码

```typescript
const objectKey = { id: 1 }
const record: Record<PropertyKey, unknown> = {}

record[1] = "number becomes string"
record["1"] = "same property"
record[objectKey as unknown as PropertyKey] = "coerced object key"

const token = Symbol("token")
record[token] = 42

console.assert(Reflect.ownKeys(record).includes("1"))
console.assert(Reflect.ownKeys(record).includes("[object Object]"))
console.assert(Reflect.ownKeys(record).includes(token))

const orderProbe = { b: 1, 10: "ten", 2: "two", a: 2 }
console.log(Reflect.ownKeys(orderProbe)) // ["2", "10", "b", "a"]
```

#### 本章结论

看到方括号先问 ToPropertyKey 产生什么；需要保留任意值 identity 时，普通对象和 Map 解决的是两类问题。

### Descriptor 是带“字段是否存在”状态的记录

kicker: "02 · PROPERTY DESCRIPTOR"

Property Descriptor 不是一个只有六个固定字段的普通业务对象。规范记录要区分字段缺席与字段存在且值为 false/undefined。例如 Object.defineProperty(target, "x", { value: 1 }) 中 writable、enumerable、configurable 均缺席，Create/Validate 算法为新属性补成 false；对象字面量 { x: 1 } 创建的数据属性则默认三者为 true。

Data descriptor 使用 [[Value]] 与 [[Writable]]，accessor descriptor 使用 [[Get]] 与 [[Set]]。一个 descriptor 不能同时是 data 与 accessor，{ value: 1, get() {} } 会抛 TypeError。仅含 enumerable/configurable 的 generic descriptor 可更新两类属性的公共 attributes，而不主动改变其 data/accessor 种类。

Object.getOwnPropertyDescriptor 把内部记录 reify 成普通对象；Object.defineProperty 再通过 ToPropertyDescriptor 把输入普通对象转回规范记录。转换会读取 value、writable、get、set 等属性，因此输入若有 getter 或 Proxy，这一步本身就能执行用户代码。工程上不要把不可信 descriptor 输入当作无副作用的 JSON。

#### 代码

```typescript
const target = {}

Object.defineProperty(target, "hidden", { value: 1 })
const hidden = Object.getOwnPropertyDescriptor(target, "hidden")!
console.assert(hidden.writable === false)
console.assert(hidden.enumerable === false)
console.assert(hidden.configurable === false)

const literal = { visible: 1 }
const visible = Object.getOwnPropertyDescriptor(literal, "visible")!
console.assert(visible.writable && visible.enumerable && visible.configurable)

let backing = 0
Object.defineProperty(target, "score", {
  get() { return backing },
  set(value: number) { backing = Math.max(0, value) },
  enumerable: true,
  configurable: true
})
```

#### 本章结论

写 defineProperty 时要逐个写明 attributes；缺省值不是对象字面量的默认值，字段缺席也不是字段等于 undefined。

### 内部方法把“对象操作”定义成多态协议

kicker: "03 · INTERNAL METHODS"

表达式 obj[key] 不等价于直接查一张表。规范会执行 ToObject/ToPropertyKey，再调用 obj.[[Get]](key, receiver)。普通 [[Get]] 先取 own descriptor：数据属性返回 [[Value]]；访问器属性调用 getter；own 不存在则沿 [[GetPrototypeOf]] 继续找，同时保留最初的 receiver。

赋值 obj[key] = value 调用 [[Set]]。若原型上找到 writable data property，最终可能在 receiver 上创建 own property；若找到 setter，则以 receiver 为 this 调用；若遇到 non-writable data 或没有 setter 的 accessor，严格模式抛 TypeError，非严格脚本可能静默失败。Object.defineProperty 则直接调用 [[DefineOwnProperty]]，不会走 setter。

这种协议解释了 Proxy 为什么能拦截 get、set、defineProperty、ownKeys 等不同动作，也解释了 trap 之间必须互相一致。Reflect 系列函数接近内部方法的显式入口，返回值与异常策略通常比 Object API 更适合写底层转发代码。后续 Receiver 专题会单独推导 getter、setter、super 与 Proxy 的 this 传播。

#### 要点

- obj.x = v、Reflect.set(obj, "x", v) 与 Object.defineProperty(obj, "x", {value:v}) 语义不同，尤其在原型 setter 与不可写属性上。
- Object.create(null) 没有 Object.prototype，适合纯字符串字典，但仍要处理 Property Key 强制转换与 descriptor。
- 内部 slot 不是属性，无法由 obj["[[Map]]"] 读取，也不参与 Proxy property trap。

#### 代码

```typescript
const events: string[] = []
const proto = {
  set value(next: number) {
    events.push(`setter:${next}:this=${this === child ? "child" : "other"}`)
  }
}
const child = Object.create(proto)

child.value = 3 // [[Set]] 找到原型 setter，以 child 作为 receiver
Object.defineProperty(child, "value", {
  value: 4,
  writable: true,
  configurable: true
})               // [[DefineOwnProperty]]，不调用 setter

console.assert(events.length === 1)
console.assert(Object.hasOwn(child, "value"))
console.assert(child.value === 4)
```

#### 本章结论

遇到属性问题先写出调用的是 [[Get]]、[[Set]] 还是 [[DefineOwnProperty]]，再分析 own descriptor、prototype 与 receiver。

### ValidateAndApply 是 descriptor 的状态机

kicker: "04 · INVARIANT"

configurable=false 的含义比“不能 delete”更强：属性通常不能切换 data/accessor 种类，enumerable 不能改变，configurable 不能恢复 true。non-configurable data property 若 writable=true，还允许更新 value，并允许单向降成 writable=false；一旦 writable=false，value 只能以 SameValue 保持不变。

对象 non-extensible 时不能创建新 own property，但仍可在规则允许范围内更新已有属性。Object.preventExtensions 只关闭新增；seal 在此基础上把全部 own property 设为 non-configurable；freeze 还把数据属性设为 non-writable。它们都不递归，也不让 getter 停止返回变化值。

Proxy 的 defineProperty/getOwnPropertyDescriptor/ownKeys trap 不能撒破坏不变量的谎。若 target 有 non-configurable property，trap 不能报告它不存在；target 不可扩展时不能凭空报告新 key。规范在 trap 返回后检查 target descriptor，并在不一致时抛 TypeError，这也是“元编程能力”仍需要安全边界的原因。

#### 代码

```typescript
const state = {}
Object.defineProperty(state, "version", {
  value: 1,
  writable: true,
  enumerable: true,
  configurable: false
})

Object.defineProperty(state, "version", { value: 2 })        // 合法
Object.defineProperty(state, "version", { writable: false }) // 合法的单向收紧

for (const change of [
  () => Object.defineProperty(state, "version", { value: 3 }),
  () => Object.defineProperty(state, "version", { configurable: true }),
  () => Object.defineProperty(state, "version", { get: () => 2 }),
]) {
  try {
    change()
    console.assert(false, "应违反 non-configurable invariant")
  } catch (error) {
    console.assert(error instanceof TypeError)
  }
}
```

#### 本章结论

把 descriptor 变化画成有方向的状态图：许多属性可以从宽松收紧，却不能从已公开的强保证重新放宽。

### V8 Map/HiddenClass 把名字查找变成形状检查

kicker: "05 · OBJECT SHAPE"

ECMAScript 没有 HiddenClass 这个可观察概念。V8 的 Map 保存对象的形状元数据，例如原型、实例大小、property 数量和 DescriptorArray。对象按相同顺序添加相同 named properties 时，通常沿相同 transition tree 到达同一 Map；属性值可以不同，形状仍可共享。

优化后的 property load 常被理解为两步：先检查 receiver 的 Map 是否是预期形状，再从已知 field offset 读取。单一形状是 monomorphic；少量形状可做 polymorphic inline cache；形状过多可能 megamorphic，代码退回更通用的 lookup。确切阈值属于引擎版本细节，课程只依赖“稳定形状给优化器更强证据”这一原则。

构造阶段统一初始化字段能减少形状分叉。即便某字段暂时没有值，也可设为 undefined，让同类实例沿同一添加顺序。反复 delete 属性、根据输入随机添加字段、用同一热函数处理许多互不相关形状，会降低共享与 inline cache 命中；但性能结论仍应通过真实 workload、V8 trace/CPU profile 验证。

#### 代码

```typescript
type Point = { x: number; y: number; label: string | undefined }

function stablePoint(x: number, y: number, label?: string): Point {
  // 所有实例以相同顺序建立相同字段。
  return { x, y, label }
}

function unstablePoint(flag: boolean) {
  const point: Record<string, unknown> = {}
  if (flag) {
    point.x = 1
    point.y = 2
  } else {
    point.y = 2
    point.x = 1 // 属性集合相同，transition 路径仍可能不同
  }
  return point
}

const points = Array.from({ length: 10_000 }, (_, i) => stablePoint(i, i))
console.assert(points.every(point => point.label === undefined))
```

#### 本章结论

形状是优化器的运行时证明，不是类型声明。TypeScript interface 相同不保证 V8 Map 相同，Map 相同也不要求属性值类型永远相同。

### named properties、elements 与 dictionary 是不同存储域

kicker: "06 · STORAGE"

V8 通常把整数索引属性放进 elements backing store，把其他 named properties 放进 in-object fields 或 properties store。DescriptorArray 记录 named property 的名称、attributes 与位置；elements 则按 PACKED/HOLEY、SMI/double/object 等 element kind 优化连续访问。数组既可同时拥有 elements，也可拥有普通 named property。

in-object property 直接占实例空间，访问链最短；超出预留空间的 fast property 可放入独立 properties store；大量动态增删时可能退化为 self-contained dictionary，key、value 和 attributes 放在字典条目中。dictionary 更适合变化，却通常失去基于共享 DescriptorArray 的快速 offset 访问。

稀疏大索引数组可能使用 dictionary elements；给数组索引定义特殊 non-configurable descriptor 也需要能保存每个元素的 attributes。孔洞 hole 与值 undefined 不同：hole 表示 own property 不存在，某些数组算法会跳过它，读取时还可能继续查原型链。

#### 要点

- 不要用 delete arr[i] 表示紧凑删除；它留下 hole。需要重排长度时用 splice，需要字典语义时用 Map。
- arr["0"] 与 arr[0] 命中同一 Property Key，但 arr["01"] 通常不是 array index。
- elements kind 会随写入值与孔洞发生迁移，具体优化会变；算法正确性不得依赖 V8 当前表示。

#### 代码

```typescript
const values = [10, 20, 30]
delete values[1]

console.assert(values.length === 3)
console.assert(!Object.hasOwn(values, 1))
console.assert(values[1] === undefined)

values.meta = "named property" // TypeScript 默认不允许，运行时对象可以拥有
console.log(Reflect.ownKeys(values))

const sparse: unknown[] = []
sparse[100_000] = "far"
console.assert(sparse.length === 100_001)
console.assert(Object.keys(sparse).length === 1)
```

#### 本章结论

“属性值为 undefined”和“该 key 没有 own property”必须用 Object.hasOwn/descriptor 区分；数组 length 也不能代表实际元素数量。

### 用 descriptor 设计 API，而不是炫技

kicker: "07 · ENGINEERING DESIGN"

descriptor 最有价值的场景是表达运行时契约：库可把内部版本标记设为 non-enumerable，避免序列化泄漏；可用 accessor 校验写入或维持派生值；可把不应被插件替换的能力设为 non-configurable。每增加一个特殊 attribute，也增加调试和用户认知成本，公共 API 必须在文档与类型中说明。

TypeScript 的 mapped type 能描述 readonly/optional，却不能精确表示 enumerable/configurable，也不能证明对象在运行时已 freeze。若框架依赖 descriptor，应该提供创建函数和运行时断言，例如读取 getOwnPropertyDescriptor 验证，而不是只导出一个看似 readonly 的 interface。

性能设计先从数据模型开始：固定 schema 的实体用 class/工厂统一字段；用户扩展数据放进独立 extras Map，避免污染核心实例形状；高频读取与低频动态 metadata 分开。最后用 benchmark 和 profiler 验证，不能把“不要 delete”“总按同一顺序赋值”变成脱离场景的仪式。

#### 代码

```typescript
const INTERNAL = Symbol("reviewlab.internal")

type Course = {
  id: string
  title: string
  readonly createdAt: number
  [INTERNAL]?: { revision: number }
}

function createCourse(id: string, title: string): Course {
  const course = { id, title } as Course
  Object.defineProperties(course, {
    createdAt: {
      value: Date.now(),
      writable: false,
      enumerable: true,
      configurable: false
    },
    [INTERNAL]: {
      value: { revision: 0 },
      writable: false,
      enumerable: false,
      configurable: false
    }
  })
  return course
}

const course = createCourse("ts-01", "对象模型")
console.assert(JSON.stringify(course).includes("createdAt"))
console.assert(!JSON.stringify(course).includes("revision"))
```

#### 本章结论

类型负责静态使用体验，descriptor 负责运行时属性合同，shape 负责引擎实现效率。三层可以协作，但没有一层自动替代另一层。

## 核心机制

- 属性语法先把输入转换为 String/Symbol Property Key，再选择 [[Get]]、[[Set]]、[[DefineOwnProperty]] 等内部方法。
- 内部方法读取 own descriptor、原型与 receiver；普通对象和 exotic object 可使用不同算法。
- ValidateAndApplyPropertyDescriptor 把 extensible、current descriptor 与 requested descriptor 组合成合法或失败的状态迁移。
- V8 用 Map/DescriptorArray 表示常见 named property 形状，用 elements store 处理整数索引，并在动态变化时选择 dictionary。
- 优化器以 Map check 等运行时证据加速固定 offset 访问；TypeScript 静态结构类型不直接决定引擎形状。

## 常见误区

- 认为 Object.defineProperty 省略 attributes 等同于对象字面量默认值；实际新属性缺省为 false。
- 把 Property Descriptor 的字段缺席与字段值 undefined 混为一谈，导致 data/accessor 分类或更新语义错误。
- 把 interface/class 名称当成 HiddenClass，或把 V8 Map 当作跨浏览器规范保证。
- 只比较 obj[key] === undefined 判断属性不存在，遗漏 own undefined、原型属性与 getter。
- 看到动态对象慢就盲目改写；没有 profile、shape trace 和真实输入分布，优化结论无法成立。

## 实现变体

### 固定字段工厂或 class

useWhen: "领域实体字段集合稳定、实例多、热函数反复读取同一组属性。"
tradeoff: "字段顺序与形状更可预测；可选扩展字段容易膨胀核心实例，版本演进需保持初始化纪律。"

#### 代码

```typescript
class Job {
  status: "queued" | "running" | "done"
  result: unknown

  constructor(
    readonly id: string,
    readonly createdAt: number
  ) {
    this.status = "queued"
    this.result = undefined
  }
}
```

### 核心对象 + extras Map

useWhen: "核心读取路径固定，但插件、租户或实验字段高度动态。"
tradeoff: "核心 shape 稳定，任意值键与增删清楚；访问扩展数据多一次 Map lookup，序列化需显式转换。"

#### 代码

```typescript
type Entity = {
  id: string
  extras: Map<PropertyKey, unknown>
}

const entity: Entity = { id: "e1", extras: new Map() }
entity.extras.set(Symbol.for("trace"), { sampled: true })
```

### Object.create(null) 字符串字典

useWhen: "只接收 String/Symbol key，需要对象反射 API 或 JSON 风格输出，又不需要 Object.prototype。"
tradeoff: "避免原型键冲突且比普通对象语义更纯；仍会发生 ToPropertyKey，缺少 Map.size 和任意对象 identity 键。"

#### 代码

```typescript
const counts: Record<string, number> = Object.create(null)
counts["constructor"] = 1
counts["__proto__"] = 2
console.assert(Object.getPrototypeOf(counts) === null)
```

## 可运行示例

```typescript
type DescriptorKind = "data" | "accessor" | "generic"

function descriptorKind(descriptor: PropertyDescriptor): DescriptorKind {
  const data = "value" in descriptor || "writable" in descriptor
  const accessor = "get" in descriptor || "set" in descriptor
  if (data && accessor) throw new TypeError("descriptor 不能同时是 data 与 accessor")
  if (data) return "data"
  if (accessor) return "accessor"
  return "generic"
}

function defineChecked(
  target: object,
  key: PropertyKey,
  descriptor: PropertyDescriptor
): void {
  descriptorKind(descriptor)
  const current = Object.getOwnPropertyDescriptor(target, key)

  if (current && !current.configurable) {
    if (descriptor.configurable === true) {
      throw new TypeError("不可配置属性不能恢复 configurable")
    }
    if ("enumerable" in descriptor &&
        descriptor.enumerable !== current.enumerable) {
      throw new TypeError("不可配置属性不能改变 enumerable")
    }
  }

  Object.defineProperty(target, key, descriptor)
}

const model = {}
defineChecked(model, "id", {
  value: "m1",
  writable: false,
  enumerable: true,
  configurable: false
})

console.assert(Object.keys(model).includes("id"))
console.assert(Reflect.set(model, "id", "m2") === false)
console.assert(Object.getOwnPropertyDescriptor(model, "id")?.value === "m1")
```

## 搭积木复现

### 积木 1：实现 ToPropertyKey 探针

收集 number、boolean、object、Symbol、整数样式字符串与普通字符串作为 key，输出 Reflect.ownKeys，并解释每个最终键和值覆盖行为。

### 积木 2：实现 descriptor 分类器

区分字段缺席，完成 data/accessor/generic 分类；对同时包含 value 与 get 的输入抛出 TypeError，并写出表格测试。

### 积木 3：复现不可配置状态机

先只实现 configurable/enumerable/data-accessor 互转和 writable 单向收紧，再补 SameValue 对 NaN 与正负零的边界。

### 积木 4：写 OrdinaryGet 教学版

用 getOwnPropertyDescriptor 与 getPrototypeOf 递归实现数据属性、getter 和原型查找；显式携带 receiver，暂不处理 Proxy 与 private field。

### 积木 5：对照 V8 分派源码

把 JSReceiver::DefineOwnProperty 的 Array、Proxy、TypedArray、ModuleNamespace 与 Ordinary 五条路径标在调用图上，写明每个分支多维护的一项不变量。

### 积木 6：观察形状与字典退化

构造同顺序、异顺序、频繁 delete 和稀疏索引四组对象，在 Node/V8 调试环境使用 %DebugPrint 或 trace 工具观察 Map/properties/elements；基准必须预热并记录运行时版本。

## 自检

### 问题

为什么 Object.defineProperty(obj, "x", { value: 1 }) 得到的属性与 obj.x = 1 不同？如果 x 已在原型上定义了 setter，两种写法又会发生什么？

### 站内答案

defineProperty 直接请求 obj.[[DefineOwnProperty]] 创建 own data property。对新属性，descriptor 中缺席的 writable、enumerable、configurable 被补为 false；它不会沿原型链调用 setter。赋值表达式调用 [[Set]]：普通路径会检查 own/prototype descriptor，若原型上是 setter，就以最初的 receiver（obj）作为 this 调用 setter，通常不会自动创建 own x；若最终创建普通 own data property，其 writable、enumerable、configurable 通常为 true。两者必须分别测试 own descriptor 与 setter 副作用。
