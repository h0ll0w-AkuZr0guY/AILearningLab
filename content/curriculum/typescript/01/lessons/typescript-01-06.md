---
id: "typescript-01-06"
track: "typescript"
title: "this、arrow、call/apply/bind、new 与 super"
depth: "deep"
exampleLanguage: "typescript"
readingMinutes: 45
sourceMinutes: 35
practiceMinutes: 50
reviewMinutes: 15
---

## 官方入口

title: "ECMAScript Language Specification · EvaluateCall"
url: "https://tc39.es/ecma262/multipage/ecmascript-language-expressions.html#sec-evaluatecall"

EvaluateCall 先判断被调用表达式是否产生 property Reference：若是，则用 GetThisValue(ref) 得到 receiver；否则 thisValue 为 undefined。后续 OrdinaryCallBindThis、Bound Function [[Call]]、[[Construct]] 与 GetSuperBase 分别处理普通函数、绑定函数、构造调用和 super。

## 真实源码

repo: "v8/v8"
file: "src/builtins/x64/builtins-x64.cc"
symbol: "Generate_CallBoundFunctionImpl / Generate_ConstructBoundFunction"
language: "cpp"
url: "https://github.com/v8/v8/blob/main/src/builtins/x64/builtins-x64.cc#L2783-L2866"

### 逐段讲解

- 通用 Call builtin 已按对象类型确认 target 是 JSBoundFunction，随后进入 Generate_CallBoundFunctionImpl；此时栈上已经有 receiver 与调用参数。
- 普通调用分支读取 JSBoundFunction::bound_this_ 并覆盖 receiver，再把 [[BoundArguments]] 压到现有参数之前；这对应规范 Bound Function [[Call]] 的参数拼接和 boundThis。
- 调用分支最后把 target 换成 bound_target_function_，尾调用通用 Call；多次 bind 因而形成可递归展开的 bound function 链，参数按由外到内的绑定顺序前置。
- 构造分支同样前置 [[BoundArguments]]，但完全不读取 bound_this_。若 newTarget 就是当前 bound function，它会被替换为 [[BoundTargetFunction]]，保持目标构造器的默认 prototype 选择。
- 两个分支都重新进入通用 Call/Construct 分派，所以 Proxy、另一层 bound function、JSFunction 和 exotic callable 继续走各自实现；这里展示的是规范不变量的机器级落点，不等于规范本身。

### 源码节选

```cpp
// 摘自 V8 main/src/builtins/x64/builtins-x64.cc。
// 保留真实函数、字段和分派顺序，只把寄存器状态注释压缩并补充中文解释。
void Builtins::Generate_CallBoundFunctionImpl(MacroAssembler* masm) {
  // rax: 实参数量；rdi: 已确认是 JSBoundFunction 的 target。
  __ AssertBoundFunction(rdi);

  // 普通调用必须使用 [[BoundThis]]，覆盖调用点原本传入的 receiver。
  StackArgumentsAccessor args(rax);
  __ LoadTaggedField(
      rbx,
      FieldOperand(rdi, offsetof(JSBoundFunction, bound_this_)));
  __ movq(args.GetReceiverOperand(), rbx);

  // 把 [[BoundArguments]] 放在本次调用参数之前。
  Generate_PushBoundArguments(masm);

  // 取出 [[BoundTargetFunction]]，重新进入通用 Call 分派。
  __ LoadTaggedField(
      rdi,
      FieldOperand(
          rdi, offsetof(JSBoundFunction, bound_target_function_)));
  __ TailCallBuiltin(Builtins::Call());
}

void Builtins::Generate_ConstructBoundFunction(MacroAssembler* masm) {
  // rax: 实参数量；rdx: new.target；rdi: bound constructor。
  __ AssertConstructor(rdi);
  __ AssertBoundFunction(rdi);

  // 构造调用只前置参数，不读取 [[BoundThis]]。
  Generate_PushBoundArguments(masm);

  // new boundFn() 时，把默认 newTarget 修正为真正目标函数。
  {
    Label done;
    __ cmpq(rdi, rdx);
    __ j(not_equal, &done, Label::kNear);
    __ LoadTaggedField(
        rdx,
        FieldOperand(
            rdi, offsetof(JSBoundFunction, bound_target_function_)));
    __ bind(&done);
  }

  // 以原始 newTarget 或修正后的 target 继续 Construct。
  __ LoadTaggedField(
      rdi,
      FieldOperand(
          rdi, offsetof(JSBoundFunction, bound_target_function_)));
  __ TailCallBuiltin(Builtin::kConstruct);
}
```

## 导读

JavaScript 的 this 不是函数定义处某个普通局部变量，也不是永远指向“拥有该函数的对象”。更准确的推导从调用表达式开始：obj.method() 求值时保留一个包含 base=obj 的 Reference Record；EvaluateCall 从这个 Reference 取出函数值，同时把 base 作为 thisValue。const f = obj.method; f() 先执行 GetValue 丢掉 Reference，调用时只能传入 undefined。严格函数保持 undefined，非严格函数才把它替换成 globalThis。

arrow、bind 与 new 又分别改写调用协议的不同层。arrow 的 [[ThisMode]] 是 lexical，它根本不执行普通 this 绑定，而是沿词法环境寻找外层 Function Environment 的 this；bind 创建 Bound Function exotic object，把 target、boundThis、boundArguments 存进内部槽；new 走 [[Construct]]，创建实例、传递 NewTarget，并对构造器返回值应用专门规则，构造调用 bound function 时还会忽略 boundThis。

super 同时依赖两个坐标：方法创建时记录的 [[HomeObject]] 决定从哪个原型开始查属性，当前调用的 this 决定 getter、setter 或父方法内部操作哪个实例。把这些机制压成“谁调用 this 就是谁”会在脱离方法、箭头回调、bind 后 new、继承方法复制和 derived constructor 中连续出错。本课用规范记录、V8 builtin 与一个教学运行时把整条链复现出来。

## 分章正文

### this 的第一现场是 Reference，不是函数对象

kicker: "01 · CALL-SITE REFERENCE"

MemberExpression obj.read 的求值结果在规范中先是 Reference Record，可把它理解为尚未解引用的定位凭证：[[Base]] 是 obj，[[ReferencedName]] 是 read，[[Strict]] 记录严格模式，super reference 还带 [[ThisValue]]。圆括号调用触发 EvaluateCall 时，GetValue(ref) 取得函数，而 GetThisValue(ref) 取得 receiver。函数值自身无需记住它从哪个对象读出。

一旦先赋值给变量、作为普通参数传递、结构赋值或通过逗号表达式取值，GetValue 会把 Reference 压成纯函数值。f() 的 callee Reference 是环境记录中的名称 binding，它不是 property Reference，因此 thisValue 为 undefined。obj.method?.() 仍保留 member Reference；(0, obj.method)()、const { method } = obj 和 [obj.method][0]() 则分别得到 undefined、undefined 和数组作为 receiver。

这个模型也解释 getter：obj.getter 先执行属性读取，getter 的 receiver 来自属性 Reference；getter 返回的函数若随后用 () 调用，是否仍保留 obj 取决于语法是否形成新的 property Reference，而不取决于函数最初由哪个 getter 返回。调试时应先给调用表达式画出 Reference，再讨论函数内部 this。

#### 代码

```typescript
const account = {
  balance: 7,
  read() { return this.balance }
}

console.assert(account.read() === 7)

const detached = account.read
// ES module / strict function 中，普通调用的 this 是 undefined。
try {
  detached()
  console.assert(false)
} catch (error) {
  console.assert(error instanceof TypeError)
}

const another = { balance: 11, read: account.read }
console.assert(another.read() === 11)
console.assert((0, account.read).call(another) === 11)
```

#### 本章结论

先判断调用前是否仍有 property Reference；同一个函数值可以因不同 Reference 得到不同 receiver。

### OrdinaryCallBindThis 区分 lexical、strict 与 global 三种模式

kicker: "02 · THIS MODE"

ECMAScript function object 的 [[ThisMode]] 有 lexical、strict、global 三种。arrow 是 lexical；普通严格函数是 strict；非严格普通函数是 global。进入 [[Call]] 后，PrepareForOrdinaryCall 先建立新的 Function Environment，OrdinaryCallBindThis 再根据 [[ThisMode]] 初始化环境里的 this binding，随后才进行参数与函数体声明实例化。

strict 模式原样保存 thisArgument，所以 fn.call(3) 中 this 可以是原始 number，fn() 中可以是 undefined。global 模式遇到 null 或 undefined 时使用函数 Realm 的 globalThis；其他 primitive 经 ToObject 包装。这里是“被调用函数所属 Realm”，跨 iframe 调用时未必是调用者窗口。class body、ES module 和许多现代代码天然严格，不能用旧脚本的 window 经验推断。

this binding 有独立生命周期。普通函数可在体内读取它；derived constructor 的状态最初是 uninitialized；箭头函数的 Environment Record 不提供自己的 this binding。把 this 当成隐式的第零个参数有助于理解 call，但仍要记住 lexical arrow 与 derived constructor 是这幅类比的边界。

#### 要点

- 严格性属于函数代码，call-site 无法把一个 strict function 临时改成 sloppy。
- 非严格 receiver 的 primitive 包装是调用语义，不等于原始值被永久转成对象。
- ES module 顶层 this 为 undefined；浏览器经典 script 顶层规则受 Global Environment 约束。

#### 代码

```typescript
function strictProbe(this: unknown) {
  "use strict"
  return this
}

const sloppyProbe = Function("return this") as () => unknown

console.assert(strictProbe.call(3) === 3)
console.assert(strictProbe.call(undefined) === undefined)
console.assert(sloppyProbe.call(undefined) === globalThis)

const boxed = (Function(
  "return Object.prototype.toString.call(this)"
) as Function).call(3)
console.assert(boxed === "[object Number]")
```

#### 本章结论

receiver 先由调用表达式产生，普通函数再按自身 [[ThisMode]] 决定保留、全局替换或装箱。

### 箭头函数跳过 this 绑定，并沿词法环境取值

kicker: "03 · LEXICAL THIS"

创建 arrow function 时，OrdinaryFunctionCreate 使用 lexical thisMode。调用它时 OrdinaryCallBindThis 会直接返回，call、apply、bind 传入的 thisArgument 都不会建立新 binding。箭头体里的 this 解析到外层最近提供 this binding 的 Function Environment；若一路到 module 顶层，则得到 undefined。

箭头同时没有自己的 arguments、super binding 和 new.target。它们作为词法名称沿外层环境解析，因此对象方法内创建的箭头适合把当前实例带进 callback；但把箭头放进 prototype 或用作需要动态 receiver 的事件监听器会失去复用能力。箭头也没有 [[Construct]]，new arrow() 必须抛 TypeError，是否存在 prototype 属性只是可观察结果之一，根因是没有构造内部方法。

class field arrow 每个实例都会执行 initializer 并创建新函数，天然固定 this，便于把方法裸传给 UI；代价是每实例函数 identity、额外分配、无法被子类通过 prototype 上的 super.method 正常覆盖。prototype method 共享一个函数且支持动态多态，交给回调时则需要包装或显式 bind。选择依据应是 identity、覆盖协议和生命周期。

#### 代码

```typescript
class Counter {
  value = 0

  prototypeMethod() {
    return ++this.value
  }

  fieldArrow = () => ++this.value
}

const counter = new Counter()
const looseMethod = counter.prototypeMethod
const stableArrow = counter.fieldArrow

console.assert(stableArrow.call({ value: 100 }) === 1)
console.assert(counter.value === 1)
console.assert(
  new Counter().fieldArrow !== new Counter().fieldArrow
)
console.assert(
  Counter.prototype.prototypeMethod ===
  Counter.prototype.prototypeMethod
)
```

#### 本章结论

箭头固定的是词法 this 解析路径；它解决回调 receiver 丢失，同时放弃动态 receiver、构造能力和共享 prototype identity。

### call、apply 与 bind 操作的是不同时间点

kicker: "04 · EXPLICIT BINDING"

Function.prototype.call 立即调用目标：第一个参数成为 thisArgument，后续参数逐个组成 argumentsList。apply 也立即调用，但从 array-like 创建参数列表；null 或 undefined 表示空列表，其他值必须能按 length 和整数索引读取。spread 由可迭代协议取值，与 apply 的 array-like 协议并不相同。

bind 不执行目标。BoundFunctionCreate 创建 exotic object，内部保存 [[BoundTargetFunction]]、[[BoundThis]] 和 [[BoundArguments]]。之后 [[Call]] 拼接 boundArgs 与本次 args，并以 boundThis 调用 target。再次 bind 只能继续前置参数，不能覆盖内层已经决定的 this，因为外层最终仍以某个 this 调用“内层 bound function”，而内层会再次换回自己的 boundThis。

bound function 的 name 会加 bound 前缀，length 按已绑定参数数目收缩；它通常没有自己的 prototype 数据属性，但若 target 可构造，bound function 仍具有 [[Construct]]。bind 常用于部分应用和稳定 callback identity；若每次 render 都重新 bind，removeEventListener 收到不同函数便无法移除旧监听器。

#### 代码

```typescript
function format(
  this: { prefix: string },
  left: string,
  right: string
) {
  return this.prefix + left + right
}

const receiver = { prefix: ">" }
console.assert(format.call(receiver, "A", "B") === ">AB")
console.assert(format.apply(receiver, ["A", "B"]) === ">AB")

const boundA = format.bind(receiver, "A")
console.assert(boundA("B") === ">AB")

const rebound = boundA.bind({ prefix: "!" }, "B")
console.assert(rebound("") === ">AB") // this 仍是 receiver
console.assert(boundA.length === 1)
```

#### 本章结论

call/apply 立即提供一次调用的 receiver；bind 创建可重复调用的新对象，并永久保存第一层绑定的 receiver 与参数前缀。

### new 进入 [[Construct]]，thisArgument 已不再是主角

kicker: "05 · CONSTRUCT AND NEWTARGET"

new Ctor(args) 先确认 Ctor 有 [[Construct]]，随后调用 Construct(Ctor, args, Ctor)。OrdinaryConstruct 依据 constructorKind 处理 base 或 derived。base constructor 在执行函数体前通过 OrdinaryCreateFromConstructor(newTarget, "%Object.prototype%") 创建对象，并用该对象初始化 this binding；因此 call/apply 不能完整模拟 new，因为它们没有 NewTarget、实例初始化与构造返回规则。

NewTarget 决定默认实例原型。Reflect.construct(Target, args, NewTarget) 可以执行 Target 的构造逻辑，却从 NewTarget.prototype 建立实例原型；这正是内建类继承和转发构造的关键坐标。函数体内 new.target 能观察最初的构造入口，普通调用时是 undefined。箭头词法捕获外层 new.target。

base constructor 显式返回对象时替换预创建实例；返回 primitive 时忽略该值并返回 this。derived constructor 更严格：super() 负责取得并初始化 this；显式返回对象可以绕过 super，但返回 primitive 或在未初始化时结束会抛错。工厂函数与构造器因此有不同可替换性和继承契约。

#### 代码

```typescript
function Base(this: { kind?: string }) {
  this.kind = "base"
}

function Target(this: object) {
  Object.defineProperty(this, "createdBy", {
    value: new.target?.name
  })
}

function Alternate() {}
Alternate.prototype.marker = "alternate"

const value = Reflect.construct(Target, [], Alternate) as {
  createdBy: string
  marker: string
}

console.assert(value.createdBy === "Alternate")
console.assert(Object.getPrototypeOf(value) === Alternate.prototype)
console.assert(value.marker === "alternate")
```

#### 本章结论

构造调用围绕 [[Construct]] 与 NewTarget 组织；“创建空对象后 call 一次”只能模拟最简单 base constructor 的表面结果。

### bound constructor 忽略 boundThis，却保留参数前缀

kicker: "06 · BOUND CONSTRUCT"

若 target 有 [[Construct]]，由它创建的 bound function 也可构造。Bound Function [[Construct]] 把 boundArgs 放在当前 args 前面，然后 Construct(target, args, newTarget)。[[BoundThis]] 完全不参与，因为实例 this 必须由构造协议创建或由父构造器返回。

当 newTarget 正好等于当前 bound function，规范把它替换为 bound target。这样 new BoundPoint() 默认仍从 Point.prototype 建立对象，instanceof Point 为真。若 Reflect.construct(BoundPoint, args, Subclass) 显式提供其他 NewTarget，就必须保留 Subclass，让原型定制继续成立。V8 源码中的 cmp、条件加载与 TailCallBuiltin 正在实现这两步。

bind 后函数没有自己的 prototype 属性，不能把 BoundPoint.prototype 当作配置入口；静态自有属性也不会自动复制到 bound function。设计依赖注入时，用 bind 预填构造参数虽可行，但类名、静态能力、序列化和容器 metadata 可能丢失，显式工厂往往更可控。

#### 代码

```typescript
class Point {
  static category = "geometry"
  constructor(
    public x: number,
    public y: number
  ) {}
}

const fakeThis = { x: 99, y: 99 }
const BoundPoint = Point.bind(fakeThis, 3)
const point = new BoundPoint(4)

console.assert(point.x === 3 && point.y === 4)
console.assert(point instanceof Point)
console.assert(fakeThis.x === 99) // 构造时忽略 boundThis
console.assert(!Object.hasOwn(BoundPoint, "prototype"))
console.assert((BoundPoint as unknown as typeof Point).category === undefined)
```

#### 本章结论

bound function 的 [[Call]] 与 [[Construct]] 是两条协议：前者消费 boundThis，后者只消费 boundArgs 并修正 NewTarget。

### super 用 HomeObject 找起点，用当前 this 做 Receiver

kicker: "07 · HOMEOBJECT AND SUPER"

方法定义求值时，MakeMethod 把方法的 [[HomeObject]] 设为承载它的对象。super.name 的 GetSuperBase 取 homeObject.[[GetPrototypeOf]]() 作为属性查找起点，再以当前 thisValue 作为 Receiver 执行 Get。于是父类 getter 内的 this 仍是子类实例，父方法写 this.x 也写到当前实例。

HomeObject 与函数最初定义位置绑定，call/apply 只能改变当前 this，不能改 super 查找起点。把含 super 的方法从 A.prototype 复制到 unrelated object，调用时仍从 A.prototype 的父级开始查；这是 super 无法用 this.__proto__ 动态替代的原因。对象字面量方法同样能有 HomeObject。

派生构造器的 super(args) 是特殊构造调用：以父构造器为 target，保留当前 newTarget，取得父构造返回对象后 BindThisValue，并初始化实例字段。super() 前读取 this、访问绑定到 this 的字段或执行会读取 this 的箭头都会抛 ReferenceError。父构造器返回替代对象时，该对象会成为派生 this。

#### 代码

```typescript
class Parent {
  get label() {
    return "parent:" + this.name
  }
  speak() {
    return this.label
  }
}

class Child extends Parent {
  name = "child"
  speak() {
    // 属性从 Parent.prototype 开始找，receiver 仍是当前 Child。
    return super.speak()
  }
}

const child = new Child()
console.assert(child.speak() === "parent:child")

const borrowed = Child.prototype.speak
console.assert(borrowed.call({ name: "borrowed" }) === "parent:borrowed")
```

#### 本章结论

super 需要两个坐标：HomeObject 固定查找起点，当前 this 作为 Receiver 贯穿父 getter、setter 与方法。

### TypeScript 的 this 参数把调用契约写进类型系统

kicker: "08 · TYPE-LEVEL CONTRACT"

TypeScript 允许在函数第一个位置写伪参数 this: Type。它只参与类型检查，不出现在生成的 JavaScript 或运行时 arguments 中。调用、call、bind 和回调赋值时，检查器可验证 receiver 是否满足契约；noImplicitThis 能发现对象字面量、回调和嵌套普通函数里隐式 any 的 this。

ThisParameterType<T> 提取显式 this 类型，OmitThisParameter<T> 产生已绑定版本；ThisType<T> 则是 contextual typing marker，常用于对象描述 DSL，让 methods 内 this 同时看到 data 与 methods。类型只防止静态可见的错误，经 any、JavaScript 调用或运行时脱离仍会违反协议，所以公共 API 仍需选择稳定调用形态。

库 API 若不需要动态 receiver，优先普通参数或箭头 callback，降低调用者记忆负担；若 receiver 是协议核心，例如 Array 方法、DOM listener、fluent builder，则用显式 this 类型并在文档中说明 identity 和解绑方式。面试实现 bind 类型时还要处理参数前缀、overload、construct signature；一个简单泛型通常无法完整保留所有重载。

#### 代码

```typescript
type Logger = {
  prefix: string
  write(this: Logger, message: string): string
}

const logger: Logger = {
  prefix: "[app] ",
  write(message) {
    return this.prefix + message
  }
}

function bindReceiver<
  This,
  Args extends unknown[],
  Result
>(
  fn: (this: This, ...args: Args) => Result,
  receiver: This
): (...args: Args) => Result {
  return (...args) => fn.apply(receiver, args)
}

const write = bindReceiver(logger.write, logger)
console.assert(write("ready") === "[app] ready")
```

#### 本章结论

显式 this 参数能把动态调用约束前移，但不会改变 JavaScript 的 Reference、[[Call]] 或 [[Construct]] 语义。

## 核心机制

- EvaluateCall 从 property Reference 的 base 取得 thisValue；提前 GetValue 会丢失这个 receiver 线索。
- OrdinaryCallBindThis 根据 lexical、strict、global 三种 [[ThisMode]] 初始化 Function Environment 的 this binding。
- arrow 不创建自己的 this、arguments、super 或 new.target binding，而是沿词法环境解析。
- Bound Function [[Call]] 使用 [[BoundThis]] 并前置 [[BoundArguments]]；重复 bind 不能覆盖内层 this。
- [[Construct]] 传递 NewTarget、创建或取得实例并应用构造返回规则；bound constructor 忽略 [[BoundThis]]。
- 方法的 [[HomeObject]] 决定 super 属性查找起点，当前 this 决定父级访问器和方法的 Receiver。
- TypeScript this parameter 只表达静态调用契约，运行时仍完全服从 ECMAScript 调用协议。

## 常见误区

- 背诵“谁调用 this 就是谁”，却无法解释 detached method、(0, obj.m)()、strict/sloppy 与 getter 返回函数。
- 认为 arrow 创建时复制 this 值；它实际沿词法环境解析同一个 this binding。
- 用 call/apply 尝试修改箭头 this，或认为第二次 bind 可以覆盖第一次 boundThis。
- 把 apply 的 array-like 与 spread 的 iterable 当成同一协议，忽略 length、索引读取和迭代副作用。
- 用 Object.create(Ctor.prototype) 加 Ctor.call 模拟所有 new，漏掉 class、NewTarget、内建构造器和返回对象规则。
- 认为 new boundFn 会把新实例写进 boundThis；构造路径根本不读取 [[BoundThis]]。
- 把 super.method 等价改写为 Object.getPrototypeOf(this).method，破坏 HomeObject 起点并可能递归。
- 每次注册与注销监听器时重新 bind，函数 identity 不同导致旧监听器残留。
- 以为 TypeScript 的 this 参数会进入运行时参数列表，或能保护 any/JavaScript 边界。

## 实现变体

### prototype method + 调用点保留 receiver

useWhen: "方法需要被所有实例共享、支持 override/super，并且主要通过 obj.method() 形式调用。"
tradeoff: "内存与多态友好；裸传回调时会丢 Reference，需要 wrapper 或一次性缓存 bind 结果。"

#### 代码

```typescript
class Service {
  run() { return this }
}
const service = new Service()
button.addEventListener("click", () => service.run())
```

### 实例 field arrow

useWhen: "函数经常作为 callback 脱离实例传递，稳定 identity 比 prototype 共享和 super override 更重要。"
tradeoff: "自动保持词法 this；每实例创建函数，占用更多内存，且不形成普通 prototype method 的覆盖链。"

#### 代码

```typescript
class Controller {
  onClick = () => this.submit()
  submit() {}
}
```

### 显式 context 参数

useWhen: "希望调用依赖完全可见、便于函数式组合、序列化任务或跨 worker/RPC 边界。"
tradeoff: "不受 this 调用形态影响，测试简单；调用面更冗长，无法直接复用依赖 receiver 的既有 API。"

#### 代码

```typescript
type Context = { traceId: string }
function handle(context: Context, input: string) {
  return { traceId: context.traceId, input }
}
```

## 可运行示例

```typescript
type Callable = {
  call(thisValue: unknown, args: unknown[]): unknown
  construct?: (args: unknown[], newTarget: Callable) => object
}

type Reference = {
  base?: object
  value: Callable
}

type BoundCallable = Callable & {
  target: Callable
  boundThis: unknown
  boundArgs: unknown[]
}

// 对应 EvaluateCall 的核心分叉：property Reference 保留 base。
function evaluateCall(ref: Reference, args: unknown[]): unknown {
  const thisValue = ref.base ?? undefined
  return ref.value.call(thisValue, args)
}

function createBound(
  target: Callable,
  boundThis: unknown,
  boundArgs: unknown[]
): BoundCallable {
  const bound: BoundCallable = {
    target,
    boundThis,
    boundArgs,

    call(_ignoredThis, args) {
      // [[Call]] 忽略调用点 receiver，使用第一层保存的 boundThis。
      return target.call(boundThis, [...boundArgs, ...args])
    }
  }

  if (target.construct) {
    bound.construct = (args, newTarget) => {
      // [[Construct]] 忽略 boundThis；默认 newTarget 修正为 target。
      const forwardedTarget = newTarget === bound ? target : newTarget
      return target.construct!(
        [...boundArgs, ...args],
        forwardedTarget
      )
    }
  }

  return bound
}

const Point: Callable = {
  call(thisValue, [x, y]) {
    const receiver = thisValue as { x?: unknown; y?: unknown }
    receiver.x = x
    receiver.y = y
    return undefined
  },
  construct(args, newTarget) {
    const prototype = (newTarget as Callable & {
      prototype?: object
    }).prototype ?? Object.prototype
    const instance = Object.create(prototype)
    const returned = this.call(instance, args)
    return typeof returned === "object" && returned !== null
      ? returned as object
      : instance
  }
}

;(Point as Callable & { prototype: object }).prototype = {
  kind: "point"
}

const bound = createBound(Point, { ignored: true }, [3])
const point = bound.construct!([4], bound) as {
  x: number
  y: number
  kind: string
}

console.assert(point.x === 3 && point.y === 4)
console.assert(point.kind === "point")

const holder = { value: Point }
evaluateCall(
  { base: holder, value: Point },
  [8, 9]
)
console.assert((holder as { x?: number }).x === 8)
```

## 搭积木复现

### 积木 1：把调用目标建模为 Reference

定义 base 与 value，分别执行 obj.method() 和 detached()；断言只有 property Reference 把 base 交给 call。

### 积木 2：实现三种 this mode

在教学 Function Environment 中加入 lexical/strict/global；覆盖 undefined、null、primitive 与跨 realm 的测试。

### 积木 3：实现 BoundCallable [[Call]]

保存 target、boundThis、boundArgs；调用时忽略外部 receiver，按 boundArgs + args 顺序递归调用 target。

### 积木 4：加入重复 bind 与 identity 测试

对 bound function 再 bind，证明内层 boundThis 胜出、两层参数依次前置，并验证每次 bind 产生不同函数 identity。

### 积木 5：实现 base constructor

新增 construct(args, newTarget)，从 newTarget.prototype 建对象，调用函数体，并实现返回对象替换、primitive 忽略规则。

### 积木 6：实现 BoundCallable [[Construct]]

复用 boundArgs、忽略 boundThis；当 newTarget 等于 bound wrapper 时转成 target，并用自定义 NewTarget 验证原型转发。

### 积木 7：分离 HomeObject 与 Receiver

为 method 保存 homeObject，superGet 从 homeObject 的原型查找 descriptor，却把当前 this 作为 getter Receiver；用 borrowed method 验证两坐标。

### 积木 8：工程化验收

为事件订阅缓存唯一 bound callback，加入 dispose；为动态 receiver API 写显式 this 参数，并记录真实 V8 builtin 与教学实现的差异。

## 自检

### 问题

为什么 const B = A.bind(fakeThis, 1) 后，B.call(other, 2) 使用 fakeThis，而 new B(2) 却创建新实例？同时说明 newTarget 在 new B 与 Reflect.construct(B, [2], C) 两种调用中的转发差异。

### 站内答案

B 是 Bound Function exotic object。普通 [[Call]] 读取 [[BoundThis]]=fakeThis，把 [[BoundArguments]]=[1] 与 [2] 拼接后以 fakeThis 调用 A；外部 call 传入的 other 被丢弃。若 A 可构造，B 的 [[Construct]] 只拼接参数并 Construct(A, [1,2], newTarget)，完全不读取 boundThis。new B(2) 的初始 newTarget 是 B，规范会把它修正为 A，所以默认从 A.prototype 创建实例；Reflect.construct(B, [2], C) 的 newTarget 是显式 C，与 B 不同，必须原样转发，因此实例原型来自 C.prototype。V8 的 CallBoundFunction 覆盖 receiver，而 ConstructBoundFunction 只压入 bound arguments 并条件修正 newTarget，正好对应这两条路径。
