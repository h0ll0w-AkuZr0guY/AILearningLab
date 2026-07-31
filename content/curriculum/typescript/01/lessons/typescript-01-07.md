---
id: "typescript-01-07"
track: "typescript"
title: "prototype、new、class fields 与 private brand"
depth: "deep"
visualIndex: "../visuals/typescript-01-07.md"
exampleLanguage: "typescript"
readingMinutes: 48
sourceMinutes: 37
practiceMinutes: 50
reviewMinutes: 15
---

## 官方入口

title: "ECMAScript Language Specification · ClassDefinitionEvaluation"
url: "https://tc39.es/ecma262/multipage/ecmascript-language-functions-and-classes.html#sec-runtime-semantics-classdefinitionevaluation"

ClassDefinitionEvaluation 建立 constructor、prototype、extends 两条原型链、私有名称环境与字段初始化器；真正构造实例时，OrdinaryConstruct 和 InitializeInstanceElements 再依次安装私有方法、私有字段与公开字段。

## 真实源码

repo: "v8/v8"
file: "src/interpreter/bytecode-generator.cc"
symbol: "BuildPrivateBrandInitialization / BuildInstanceMemberInitialization"
language: "cpp"
url: "https://github.com/v8/v8/blob/main/src/interpreter/bytecode-generator.cc#L4001-L4058"

### 逐段讲解

- BuildPrivateBrandInitialization 先从 class scope 读取唯一 brand symbol。快速路径能直接取得 class context register，于是用 DefineKeyedOwnProperty 把 brand 安装到 receiver。
- super() 出现在嵌套 arrow 或 eval 时，当前栈上未必追踪 class context register；慢路径把 receiver、brand、当前 context 和 depth 交给 Runtime_AddPrivateBrand 沿 context chain 定位。
- BuildInstanceMemberInitialization 从 constructor 加载编译器生成的 class fields initializer；无实例成员时它可以是 undefined，从而跳过调用。
- 存在 initializer 时，instance 作为唯一参数调用它。字段定义顺序、computed key、公开字段 DefineField 和私有字段写入都已编入这个隐藏函数。
- 派生构造器在 super() 返回并绑定 this 后才执行 brand 与 instance member 初始化；因此基类字段先于基类 constructor body，派生字段则在 super() 之后、派生 constructor 剩余语句之前出现。

### 源码节选

```cpp
// 摘自 V8 main/src/interpreter/bytecode-generator.cc。
// 保留真实控制流并补充中文注释；builder() 生成 Ignition bytecode。
void BytecodeGenerator::BuildPrivateBrandInitialization(
    Register receiver, Variable* brand) {
  // class scope 中的 brand 是每次 class 求值创建的唯一私有名称凭证。
  BuildVariableLoad(brand, HoleCheckMode::kElided);
  int depth = execution_context()->ContextChainDepth(brand->scope());
  ContextScope* class_context = execution_context()->Previous(depth);

  if (class_context) {
    // 快速路径：class context 已在寄存器中，直接定义 brand property。
    Register brand_reg = register_allocator()->NewRegister();
    FeedbackSlot slot = feedback_spec()->AddDefineKeyedOwnICSlot();
    builder()
        ->StoreAccumulatorInRegister(brand_reg)
        .LoadAccumulatorWithRegister(class_context->reg())
        .DefineKeyedOwnProperty(
            receiver, brand_reg,
            DefineKeyedOwnPropertyFlag::kNoFlags,
            feedback_index(slot));
  } else {
    // 慢路径：super() 位于嵌套 arrow/eval，运行时沿 context chain 找 brand。
    RegisterList brand_args = register_allocator()->NewRegisterList(4);
    builder()
        ->StoreAccumulatorInRegister(brand_args[1])
        .MoveRegister(receiver, brand_args[0])
        .MoveRegister(execution_context()->reg(), brand_args[2])
        .LoadLiteral(Smi::FromInt(depth))
        .StoreAccumulatorInRegister(brand_args[3])
        .CallRuntime(Runtime::kAddPrivateBrand, brand_args);
  }
}

void BytecodeGenerator::BuildInstanceMemberInitialization(
    Register constructor, Register instance) {
  RegisterList args = register_allocator()->NewRegisterList(1);
  Register initializer = register_allocator()->NewRegister();
  FeedbackSlot slot = feedback_spec()->AddLoadICSlot();
  BytecodeLabel done;

  builder()
      // 编译器把实例字段整理为挂在 constructor 上的隐藏 initializer。
      ->LoadClassFieldsInitializer(constructor, feedback_index(slot))
      .JumpIfUndefined(&done)
      .StoreAccumulatorInRegister(initializer)
      .MoveRegister(instance, args[0])
      // 以 instance 为参数执行，按源码顺序定义公开字段与私有字段。
      .CallProperty(
          initializer, args,
          feedback_index(feedback_spec()->AddCallICSlot()))
      .Bind(&done);
}
```

## 导读

class 不是与 prototype 无关的第二套对象模型。每次 class 定义求值会创建 constructor function 和 prototype object，把实例方法定义在 prototype 上，把静态方法定义在 constructor 上；extends 又同时连接两条链：Child.prototype 的 [[Prototype]] 指向 Parent.prototype，而 Child 自身的 [[Prototype]] 指向 Parent。new Child() 随后通过 [[Construct]]、NewTarget 和字段初始化器把这份“类描述”落实为具体实例。

class field 与 constructor 里的普通赋值也不能互换。公开字段使用 DefineField，在实例上创建自有数据属性，不会调用继承 setter；基类字段在 constructor body 之前初始化，派生类字段在 super() 返回后初始化。computed field name 在 class 定义时求值，initializer expression 则在每次构造实例时求值。初始化时序决定了虚方法调用、setter、副作用和未初始化状态。

#private 进一步超出字符串属性模型。源码中的 #x 解析成 class evaluation 独有的 Private Name；实例需要先拥有该名称对应的 private element 或 brand，PrivateGet/PrivateSet 才允许访问。相同拼写的两个 class #x 互不兼容，Proxy 也不能伪造品牌。V8 可以把 brand 优化成内部 symbol/property 与 IC，但可观察语义仍是不可枚举、不可反射、基于声明身份的检查。


## 分章正文

### 对象只有原型链，class 提供声明与初始化协议

kicker: "01 · OBJECT MODEL"

ordinary object 的 [[Get]] 在自身找不到属性时递归调用 [[GetPrototypeOf]] 得到原型，再继续查找；最终传入的 Receiver 仍是最初对象，所以原型 getter 的 this 指向实例。方法共享来自属性位于 prototype，不来自某种“类内存区”。Object.getPrototypeOf(instance) 才是运行时原型，constructor.prototype 只是 new 默认用来选择该原型的普通属性。

class C {} 求值后，C 是可构造函数，C.prototype 是普通对象，prototype.constructor 非枚举地指回 C。实例方法的属性描述符默认 writable、configurable、non-enumerable；class body 永远按 strict code 执行。与 function declaration 不同，class binding 在初始化前处于 TDZ，且 class 不能不带 new 普通调用。

把 class 粗略转写为 function 加 prototype 赋值能解释共享方法，却会漏掉 strict、TDZ、不可调用、字段时序、私有名称、derived constructor 与准确属性描述符。教学复现应先保留原型查找，再逐项加入 class 的额外协议，而不是声称二者完全等价。

#### 代码

```typescript
class User {
  greet() { return "hello " + this.name }
  constructor(public name: string) {}
}

const user = new User("Ada")
const descriptor = Object.getOwnPropertyDescriptor(
  User.prototype,
  "greet"
)!

console.assert(!Object.hasOwn(user, "greet"))
console.assert(Object.getPrototypeOf(user) === User.prototype)
console.assert(descriptor.enumerable === false)
console.assert(descriptor.writable === true)
console.assert(User.prototype.constructor === User)
```

#### 本章结论

class 把 constructor、prototype 属性描述符与实例初始化打包；运行时方法查找仍沿普通对象原型链完成。

### extends 同时连接实例侧与静态侧两条原型链

kicker: "02 · DUAL PROTOTYPE CHAINS"

ClassDefinitionEvaluation 先求值 extends expression。若没有 extends，prototypeParent 为 Object.prototype，constructorParent 为 Function.prototype；若 extends null，prototypeParent 为 null。若父值不是 constructor 或 null，定义 class 时立即抛 TypeError。父构造器的 prototype 若不是 object/null 也不能作为实例原型父级。

对于 class Child extends Parent，Child.prototype.[[Prototype]] = Parent.prototype，支持实例方法继承；Child.[[Prototype]] = Parent，支持静态方法和静态 getter 继承。instanceof 通常沿实例原型链检查 Parent.prototype 是否出现；它不检查 constructor 名称，也不要求对象真由 Parent 执行过，Symbol.hasInstance 还可自定义规则。

运行时修改 Object.setPrototypeOf(Child.prototype, Other.prototype) 会改变实例方法解析，修改 Object.setPrototypeOf(Child, Other) 会改变静态解析；两者是独立操作。生产代码应避免热路径反复改原型，因为引擎对稳定 shape/prototype chain 的假设会失效，缓存与内联可能被撤销。

#### 代码

```typescript
class Parent {
  static category() { return "parent-static" }
  method() { return "parent-instance" }
}
class Child extends Parent {}

console.assert(Object.getPrototypeOf(Child) === Parent)
console.assert(
  Object.getPrototypeOf(Child.prototype) === Parent.prototype
)
console.assert(Child.category() === "parent-static")
console.assert(new Child().method() === "parent-instance")

class NullBase extends null {}
console.assert(Object.getPrototypeOf(NullBase.prototype) === null)
```

#### 本章结论

继承不是一根链：prototype 对象链服务实例成员，constructor 对象链服务 static 成员。

### new、NewTarget 与 prototype 选择组成实例诞生协议

kicker: "03 · ORDINARY CONSTRUCT"

new C(args) 调用 C.[[Construct]](args, C)。对于 base constructor，OrdinaryConstruct 先以 NewTarget 选择 prototype 并分配实例，再创建函数执行环境、绑定 this、执行 InitializeInstanceElements，最后运行 constructor body。constructor 返回 object 时可替换实例，返回 primitive 则忽略；class derived constructor 的返回规则更严格。

prototype 的读取来自 NewTarget，不一定来自实际执行的 target。Reflect.construct(Parent, args, Child) 会执行 Parent 的代码，却用 Child.prototype 建立实例。这让派生构造器 super() 能把最初的 new.target 透传给祖先，最终对象一次就拥有最派生原型，而无需构造后再改原型。

若 NewTarget.prototype 不是 object，OrdinaryCreateFromConstructor 使用相应 Realm 的默认 intrinsic prototype。手写 new 时还要检查 IsConstructor、处理 Proxy construct trap、bound constructor、内建 exotic 分配与字段初始化；简单 Object.create(C.prototype) + C.apply 只适合解释一个受限子集。

#### 代码

```typescript
class Parent {
  constructor() {
    Object.defineProperty(this, "seenNewTarget", {
      value: new.target?.name
    })
  }
}
class Child extends Parent {}

const child = new Child() as Child & { seenNewTarget: string }
console.assert(child.seenNewTarget === "Child")
console.assert(Object.getPrototypeOf(child) === Child.prototype)

const reflected = Reflect.construct(Parent, [], Child)
console.assert(Object.getPrototypeOf(reflected) === Child.prototype)
```

#### 本章结论

Target 决定执行哪段构造逻辑，NewTarget 决定默认原型与最派生构造身份。

### 公开字段使用 DefineField，时序不同于 constructor 赋值

kicker: "04 · PUBLIC FIELDS"

DefineField 对公开字段调用 CreateDataPropertyOrThrow，在 receiver 上建立 writable、enumerable、configurable 的自有数据属性。this.x = value 则调用 [[Set]]：若原型上存在 x setter，它可能执行 setter 而不创建自有数据属性。因此把字段语法降级为普通赋值会改变父类 setter 可观察行为。

基类的实例字段在 constructor body 开始前按源码顺序初始化；派生类实例字段在 super() 成功返回、this 被绑定之后，且在 constructor 剩余语句之前初始化。父类构造期间调用可覆盖方法时，派生字段尚未初始化；这是“不要在 base constructor 调 virtual method”的 JavaScript 版本。

computed name 表达式在 class 定义求值时执行一次，initializer 在每次 new 时以实例为 this 执行。字段之间可读取先前字段，读取后续字段通常得到 undefined；私有字段若尚未安装则品牌检查失败。static fields 和 static blocks 在 class 定义期间运行，能产生加载时副作用与循环依赖问题。

#### 代码

```typescript
const events: string[] = []
let fieldNameRuns = 0
const key = () => {
  fieldNameRuns++
  return "value"
}

class Base {
  set value(next: number) { events.push("setter:" + next) }
}

class Derived extends Base {
  [key()] = 1 // Define own property，不触发 Base setter
  constructor() {
    super()
    events.push("body:" + this.value)
  }
}

const first = new Derived()
const second = new Derived()
console.assert(fieldNameRuns === 1)
console.assert(Object.hasOwn(first, "value"))
console.assert(Object.hasOwn(second, "value"))
console.assert(events.join(",") === "body:1,body:1")
```

#### 本章结论

字段定义的核心是 DefineField 与初始化时序；它不只是 constructor 顶部的一条 this.x 赋值。

### 私有名称按声明身份区分，private brand 证明合法接收者

kicker: "05 · PRIVATE NAMES"

#x 在词法解析阶段必须属于可见 class private environment，否则直接 SyntaxError。每次执行 class 定义都会创建新的 Private Name，即使源码拼写都叫 #x，也像两把外形相同却齿纹不同的钥匙。PrivateElementFind 按这个身份在对象的 [[PrivateElements]] 中查找，而不是按字符串键查普通属性。

私有 field 自身就是 private element；私有 method/accessor 通常借助 class brand 证明接收者由该 class 初始化。访问不合法对象时抛 TypeError，#x in obj 则返回品牌存在性，适合显式检查。Object.keys、Reflect.ownKeys、JSON.stringify、Proxy ownKeys trap 都看不到 Private Name，因为它不属于 PropertyKey 空间。

私有访问没有沿普通 prototype chain 搜索任意同名成员的语义。父类方法可在子类实例上访问父 #x，因为父构造已经把父 private element 安装到同一个实例；子类不能书写父 #x。通过 call 把方法借给 plain object 会失败，即使对象有名为 "#x" 或 x 的公开属性。

#### 代码

```typescript
class Secret {
  #value = 42

  read() { return this.#value }
  static accepts(value: object) {
    return #value in value
  }
}

const secret = new Secret()
console.assert(secret.read() === 42)
console.assert(Secret.accepts(secret))
console.assert(!Secret.accepts({ "#value": 42 }))
console.assert(Reflect.ownKeys(secret).length === 0)

const read = secret.read
try {
  read.call({ "#value": 42 })
  console.assert(false)
} catch (error) {
  console.assert(error instanceof TypeError)
}
```

#### 本章结论

private brand 是来源证明：对象必须经过当前 class 定义对应的初始化，伪造同名公开属性没有作用。

### 派生构造器在 super 后安装自己的 brand 与字段

kicker: "06 · DERIVED INITIALIZATION"

derived constructor 开始时 this binding 是 uninitialized。super(args) 以父构造器为 target、当前 new.target 为 NewTarget 执行构造；返回实例后 BindThisValue，再为当前派生 class 执行 InitializeInstanceElements。此时才安装派生私有方法品牌和派生字段，所以 super 前任何 this 访问都会抛 ReferenceError。

父 class 的 InitializeInstanceElements 已在父构造进入时运行，因此一个最终实例可以依次携带每层 class 独立的 private elements。初始化顺序大致是祖先字段、祖先 constructor body、下一层字段、下一层 constructor body。若父构造显式返回替代对象，派生 brand 和字段会安装到该替代对象上。

重复执行 super() 会尝试再次 BindThisValue 并失败；规范与 V8 还要阻止同一 brand/私有字段重复初始化。V8 的慢路径尤其处理 super() 藏在 arrow/eval 时如何沿 context chain 找到正确 brand，这说明 brand 身份来自 class lexical scope，而不是从 receiver.constructor 动态推断。

#### 代码

```typescript
const order: string[] = []

class Base {
  baseField = order.push("base field")
  constructor() { order.push("base body") }
}

class Child extends Base {
  #child = order.push("child private field")
  childField = order.push("child public field")
  constructor() {
    order.push("before super")
    super()
    order.push("child body")
  }
  get initialized() { return this.#child > 0 }
}

const value = new Child()
console.assert(value.initialized)
console.assert(order.join(" > ") === [
  "before super",
  "base field",
  "base body",
  "child private field",
  "child public field",
  "child body"
].join(" > "))
```

#### 本章结论

继承层级各自初始化自己的字段与品牌；super 返回点是派生 this 从未初始化转为可用的关口。

### V8 用隐藏 initializer 与内部 brand 保持规范顺序

kicker: "07 · ENGINE LOWERING"

V8 parser/scope analysis 为 class private names 建立作用域变量，bytecode generator 再生成 brand 初始化和字段 initializer 调用。公开字段、私有字段和 computed initializer 可被整理进挂在 constructor 上的隐藏函数，实例创建时只需加载并调用一次。这是实现选择，规范只要求可观察顺序与错误一致。

快速 brand 路径把 class context 与 brand 放在已知寄存器中，通过 DefineKeyedOwnProperty 安装；嵌套 arrow/eval 中的 super 让 context 位置不再直接可用，才进入 Runtime_AddPrivateBrand。引擎内部可用 private symbol、hidden property 或专用 slot 表示，但这些都不能通过 Reflect 暴露为普通 Symbol。

稳定构造顺序会形成相似 object shape，便于 inline cache 按固定 offset 读字段；构造后以不同顺序增删属性、动态改 prototype 或让同一 call-site 混入大量 shape 会增加 polymorphism。优化建议应从 IC/trace 与 heap profile 得证，不能把所有 class field 一概说成比 constructor assignment 快或慢。

#### 要点

- 规范的 Private Name 和 V8 内部 symbol 是抽象与表示的关系，业务代码不能依赖后者。
- 隐藏 initializer 仍必须遵守源码字段顺序、computed key 时机和 abrupt completion。
- 字段 initializer 抛错会中止构造，已经发生的前序副作用不会自动回滚。

#### 代码

```typescript
// 可观察 shape 的实验应固定构造路径，再逐步引入差异。
class StablePoint {
  x = 0
  y = 0
  constructor(x: number, y: number) {
    this.x = x
    this.y = y
  }
}

const points = Array.from(
  { length: 1_000 },
  (_, i) => new StablePoint(i, i + 1)
)
console.assert(points.every(point => "x" in point && "y" in point))

// 真正判断优化状态应配合 V8 trace/DevTools，而非只看一次计时。
console.assert(Object.keys(points[0]).join(",") === "x,y")
```

#### 本章结论

源码阅读要分清可观察语义与引擎表示；shape、IC 和 brand 优化都必须保持 class 初始化协议。

### TypeScript private、#private 与 emit target 具有不同保证

kicker: "08 · TYPESCRIPT BOUNDARY"

TypeScript 的 private 修饰符主要在类型检查阶段限制访问。根据 target/useDefineForClassFields，生成代码可能仍是普通属性，运行时 Reflect、索引或 JavaScript 调用者可访问。ECMAScript #private 在运行时执行品牌检查，无法由类型断言绕过；二者都不等于安全隔离，拥有对象方法或代码执行权的攻击者仍可能间接得到秘密。

useDefineForClassFields 影响旧目标的降级语义：现代设置更接近 DefineField，旧 assignment emit 可能触发基类 setter。装饰器、parameter property 与字段初始化顺序也会随 TS 版本和 decorator 标准演进，库作者应锁定 compilerOptions、测试实际 emit，并避免依赖未声明的初始化副作用。

声明文件中的 private/protected 还会影响结构兼容：含有来自不同声明源的 private member 的两个 class 即使公开形状相同也通常不兼容。#private 在 .d.ts 中可作为名义性标记但不暴露名称。API 设计时，真正需要封装状态可组合 closure/WeakMap/#private；需要测试替换和子类扩展时则应提供 protected/public protocol，而非逼迫调用者绕过私有边界。

#### 代码

```typescript
class CompileTimePrivate {
  private token = "visible at runtime"
}

class RuntimePrivate {
  #token = "brand checked"
  reveal() { return this.#token }
}

const typed = new CompileTimePrivate()
console.assert(
  (typed as unknown as { token: string }).token ===
  "visible at runtime"
)

const runtime = new RuntimePrivate()
console.assert(!Reflect.ownKeys(runtime).includes("#token"))
console.assert(runtime.reveal() === "brand checked")
```

#### 本章结论

先明确需要静态设计约束、运行时品牌检查还是安全边界，再选择 TS private、#private、closure 或 WeakMap。

## 核心机制

- ClassDefinitionEvaluation 同时创建 constructor、prototype、private environment 与字段初始化记录。
- extends 设置 Child→Parent 的静态原型链和 Child.prototype→Parent.prototype 的实例原型链。
- OrdinaryConstruct 以 NewTarget 选择实例 prototype，并在正确阶段调用 InitializeInstanceElements。
- 公开 field 经 DefineField 创建自有数据属性，不触发继承链上的同名 setter。
- Private Name 按 class evaluation 身份区分，PrivateGet/Set 或 brand check 验证 receiver 已经过对应初始化。
- 派生 class 在 super() 返回并绑定 this 后安装自己的 private brand 与实例字段。
- V8 把实例成员编译为隐藏 initializer，并为可直接定位/需遍历 context 的 brand 初始化生成快慢路径。

## 常见误区

- 把 class 视为纯语法糖并用 function/prototype 转写证明完全等价，遗漏 strict、TDZ、字段和私有名称。
- 只画 Child.prototype→Parent.prototype，忘记 Child→Parent 的静态继承链。
- 把 constructor.prototype 当作实例不可修改的内部槽；运行时真正读取的是对象 [[Prototype]]。
- 用 this.x = value 等价替换 public field，意外触发父 setter 或改变属性描述符。
- 在 base constructor 调可覆盖方法，并假定派生字段已经初始化。
- 认为相同拼写 #x 可跨两个 class 互访，或尝试用 Symbol/Proxy/Reflect 伪造 private brand。
- 在派生 constructor 的 super 前读取 this，或重复 super 期待重置父类状态。
- 把 TypeScript private 当运行时保密机制，忽略 emit 后可能只是普通属性。
- 看到 V8 用内部 symbol 表示 brand，就把它误认为用户可枚举的 JavaScript Symbol。

## 实现变体

### prototype method + public state

useWhen: "对象行为需要继承、多态和所有实例共享，状态本身可通过明确公共协议观察。"
tradeoff: "调试与序列化直接；调用者能修改状态，需要验证不变量或改用只读接口。"

#### 代码

```typescript
class Counter {
  value = 0
  increment() { return ++this.value }
}
```

### #private field

useWhen: "需要运行时拒绝未品牌化 receiver，并防止反射或普通属性碰撞访问内部状态。"
tradeoff: "封装强、名称无碰撞；测试替换、跨 class 组合、序列化和 Proxy receiver 受到限制。"

#### 代码

```typescript
class Counter {
  #value = 0
  increment() { return ++this.#value }
  snapshot() { return this.#value }
}
```

### WeakMap 外置私有状态

useWhen: "需要在 class 外的同模块 helper 共享私有状态，或兼容缺少 native private field 的目标。"
tradeoff: "品牌效果可手写并避免污染实例；多一次表查找，状态表和实例生命周期设计更复杂。"

#### 代码

```typescript
const states = new WeakMap<object, { value: number }>()
class Counter {
  constructor() { states.set(this, { value: 0 }) }
  increment() {
    const state = states.get(this)
    if (!state) throw new TypeError("invalid receiver")
    return ++state.value
  }
}
```

## 可运行示例

```typescript
type Key = PropertyKey

type RuntimeObject = {
  prototype: RuntimeObject | null
  properties: Map<Key, unknown>
  privateElements: Map<symbol, unknown>
}

type Field = {
  key: Key | symbol
  private: boolean
  initialize: (receiver: RuntimeObject) => unknown
}

type RuntimeClass = {
  name: string
  prototypeObject: RuntimeObject
  parent: RuntimeClass | null
  brand: symbol
  fields: Field[]
  body: (receiver: RuntimeObject, args: unknown[]) => object | void
}

function createObject(prototype: RuntimeObject | null): RuntimeObject {
  return {
    prototype,
    properties: new Map(),
    privateElements: new Map()
  }
}

function getProperty(receiver: RuntimeObject, key: Key): unknown {
  for (let current: RuntimeObject | null = receiver;
       current;
       current = current.prototype) {
    if (current.properties.has(key)) return current.properties.get(key)
  }
  return undefined
}

function defineField(
  receiver: RuntimeObject,
  field: Field
): void {
  const value = field.initialize(receiver)
  if (field.private) {
    const name = field.key as symbol
    if (receiver.privateElements.has(name)) {
      throw new TypeError("private field initialized twice")
    }
    receiver.privateElements.set(name, value)
  } else {
    // 直接定义自有属性；不沿原型查 setter。
    receiver.properties.set(field.key, value)
  }
}

function initializeInstanceElements(
  receiver: RuntimeObject,
  ctor: RuntimeClass
): void {
  // private method/accessor 的教学 brand。
  if (receiver.privateElements.has(ctor.brand)) {
    throw new TypeError("brand initialized twice")
  }
  receiver.privateElements.set(ctor.brand, true)
  for (const field of ctor.fields) defineField(receiver, field)
}

function privateGet<T>(
  receiver: RuntimeObject,
  brand: symbol,
  name: symbol
): T {
  if (!receiver.privateElements.has(brand)) {
    throw new TypeError("invalid private brand")
  }
  if (!receiver.privateElements.has(name)) {
    throw new TypeError("private field missing")
  }
  return receiver.privateElements.get(name) as T
}

function construct(
  target: RuntimeClass,
  args: unknown[],
  newTarget: RuntimeClass = target
): RuntimeObject {
  // 先递归执行最基类；教学版把最终 NewTarget 原型传到最底层分配点。
  if (target.parent) {
    const receiver = construct(target.parent, args, newTarget)
    initializeInstanceElements(receiver, target)
    const returned = target.body(receiver, args)
    return returned instanceof Object && "prototype" in returned
      ? returned as RuntimeObject
      : receiver
  }

  const receiver = createObject(newTarget.prototypeObject)
  initializeInstanceElements(receiver, target)
  const returned = target.body(receiver, args)
  return returned instanceof Object && "prototype" in returned
    ? returned as RuntimeObject
    : receiver
}

const basePrototype = createObject(null)
basePrototype.properties.set("kind", "entity")

const Base: RuntimeClass = {
  name: "Base",
  prototypeObject: basePrototype,
  parent: null,
  brand: Symbol("Base.brand"),
  fields: [{
    key: "baseReady",
    private: false,
    initialize: () => true
  }],
  body: receiver => {
    receiver.properties.set("baseBody", true)
  }
}

const childSecret = Symbol("Child.#secret")
const childPrototype = createObject(Base.prototypeObject)
const Child: RuntimeClass = {
  name: "Child",
  prototypeObject: childPrototype,
  parent: Base,
  brand: Symbol("Child.brand"),
  fields: [{
    key: childSecret,
    private: true,
    initialize: () => 42
  }],
  body: receiver => {
    receiver.properties.set("childBody", true)
  }
}

const instance = construct(Child, [])
console.assert(getProperty(instance, "kind") === "entity")
console.assert(getProperty(instance, "baseReady") === true)
console.assert(privateGet<number>(
  instance,
  Child.brand,
  childSecret
) === 42)

const imposter = createObject(Child.prototypeObject)
try {
  privateGet(imposter, Child.brand, childSecret)
  console.assert(false)
} catch (error) {
  console.assert(error instanceof TypeError)
}
```

## 搭积木复现

### 积木 1：实现普通原型查找

对象保存 prototype 与 own property map；Get 从 receiver 开始沿链查找，并用缺失属性测试走到 null。

### 积木 2：建立 constructor/prototype 双链

创建 Parent、Child 和各自 prototype object，分别验证静态继承链与实例继承链，避免把两者画成同一根箭头。

### 积木 3：实现 construct(target, newTarget)

从 newTarget.prototype 分配实例，执行 target body，加入 object return 替换与 primitive return 忽略测试。

### 积木 4：实现 DefineField

字段直接写 own property map，不调用原型 setter；对照普通 Set 写一个能观察二者差异的父 setter 反例。

### 积木 5：按继承顺序初始化字段

基类字段→基类 body→派生字段→派生 body；让每步写入 timeline，失败时精确指出尚未出现的状态。

### 积木 6：用 symbol identity 实现 Private Name

每次 defineClass 创建唯一 symbol；两个同名 #x 使用不同 symbol，并证明普通字符串键无法通过 privateGet。

### 积木 7：加入 brand 与重复初始化保护

实例安装 class brand；借用方法到 imposter 时抛 TypeError，同一 class 在同一对象重复初始化也必须失败。

### 积木 8：对照 V8 快慢路径

把 class context 可直接定位视为快速路径，把嵌套 arrow/eval 的 super 视为慢路径；记录教学版未覆盖的 context depth、IC feedback 与 abrupt completion。

## 自检

### 问题

为什么 class Child extends Parent 会形成两条原型链？请进一步解释：父类 constructor 中调用 this.render() 时，为什么能分派到 Child.prototype.render，却可能读不到 Child 的公开字段和 #private 字段？

### 站内答案

Child 自身的 [[Prototype]] 指向 Parent，用于继承 static 成员；Child.prototype 的 [[Prototype]] 指向 Parent.prototype，用于实例方法查找。new Child() 以 Child.prototype 作为最终实例原型，所以父 constructor 里的 this.render() 对同一实例执行 [[Get]] 时，会先在实例和 Child.prototype 找到 override。可此时只完成了父层的 InitializeInstanceElements：派生层字段与 private brand 要等 super() 返回到 Child constructor、this 被绑定后才安装。因此 override 虽已能通过原型链被找到，Child 的 public field 仍是缺失/undefined，访问尚未安装的 #private 则会触发品牌检查 TypeError。这也是基类构造器不应调用可覆盖方法的重要原因。
