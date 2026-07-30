---
id: "typescript-01-01"
track: "typescript"
title: "ECMAScript 值、规范 Reference 与相等算法"
depth: "deep"
exampleLanguage: "typescript"
readingMinutes: 25
sourceMinutes: 20
practiceMinutes: 35
reviewMinutes: 10
---

## 官方入口

title: "ECMAScript Language Specification · Types, Identity and Equality"
url: "https://tc39.es/ecma262/multipage/ecmascript-data-types-and-values.html#sec-ecmascript-language-types"

ECMAScript 语言值包含 Undefined、Null、Boolean、String、Symbol、Number、BigInt 和 Object；Reference 是规范为了描述求值过程使用的内部记录，并不是可存进变量的 JavaScript 值。

## 真实源码

repo: "v8/v8"
file: "src/objects/objects.cc · src/objects/objects.h"
symbol: "Object::SameValue / Object::SameValueZero"
language: "cpp"
url: "https://chromium.googlesource.com/v8/v8/+/refs/heads/main/src/objects/objects.cc"

### 逐段讲解

- 入口先处理对象身份或立即数完全相同的最快路径；对象是否相等不会递归比较属性。
- Number 分支单独识别 NaN 和正负零，因为 IEEE-754 的普通 == 无法同时表达两套 ECMAScript 需求。
- String、BigInt 等无对象身份的值按内容语义比较；普通 Object、Symbol 等有身份值只在同一身份时相等。
- SameValueZero 与 SameValue 的唯一 Number 差异是把 +0 和 -0 视为同一个值，因此适合 Map、Set 与 includes 的键语义。

### 源码节选

```cpp
// 依据 V8 Object::SameValue / SameValueZero 压缩的教学实现。
// 省略 Tagged/Smi/HeapNumber 等存储表示，只保留规范分派。
bool SameNumberValue(double left, double right) {
  if (std::isnan(left) && std::isnan(right)) return true; // NaN 与自身同值
  if (left == 0.0 && right == 0.0) {
    return std::signbit(left) == std::signbit(right);      // 区分 +0 / -0
  }
  return left == right;
}

bool SameNumberValueZero(double left, double right) {
  if (std::isnan(left) && std::isnan(right)) return true;
  return left == right;                                   // 合并 +0 / -0
}

bool SameValue(Tagged<Object> left, Tagged<Object> right) {
  if (left == right) return true;                          // 同一身份/立即数
  if (IsNumber(left) && IsNumber(right)) {
    return SameNumberValue(NumberValue(left), NumberValue(right));
  }
  if (IsString(left) && IsString(right)) {
    return StringEquals(left, right);                      // 字符串按 code unit
  }
  return false;                                           // 其余有身份值不同
}
```

## 导读

“基本类型按值传递，对象按引用传递”只能当入门助记，继续推导就会误导。ECMAScript 的函数调用一律把一个语言值交给参数 binding。对象本身也是一个值，只是它具有不可描述、不可伪造的 identity，并且属性可变；把同一个对象值绑定给两个名称后，两边观察到同一身份上的修改。语言并没有一种名为 Reference 的对象指针值暴露给程序。

规范里的 Reference 是求值器使用的临时记录，描述“某个 base 上名为 referencedName 的位置”，还携带 strict、thisValue 等信息。表达式 obj.x 先产生 Reference，GetValue 才读取属性值；赋值 obj.x = 1 则把 Reference 交给 PutValue。普通变量保存的是 GetValue 后的语言值，无法把 Reference 存进数组或作为参数传走。

TypeScript 只在编译阶段为这些值建立静态近似，emit 后仍由 JavaScript 算法运行。类型相同不能推出对象相等，readonly 不能冻结对象身份上的状态，结构类型也不会让两个结构相同的对象获得同一 identity。掌握这层边界后，alias、Map key、React/Vue 更新、memoization 和不可变数据的许多问题会落到同一张图上。

## 分章正文

### 从“盒子”模型换成 binding 与 value

kicker: "01 · RUNTIME MODEL"

执行 let a = object 时，运行时在当前 Environment Record 中找到 a 的 binding，并把 object 这个语言值写入 binding。随后 let b = a 会先对 a 的 Reference 执行 GetValue，再把得到的同一个对象值写进 b。这里没有复制对象的属性图，也没有把“变量 a 的地址”塞进 b。

重新赋值 b = other 只改变 b 对应的 binding；修改 b.count 则通过对象 identity 找到同一对象并改属性。若 a 与 b 当前持有同一对象值，a.count 会观察到变化。两个行为之所以不同，根源在 binding 更新和对象内部状态更新是两类操作。

字符串、数字等值没有可变 identity。对 string 做看似属性访问时，规范可以临时装箱以完成方法调用，但不会把原始 string 变成可修改对象。new String("x") 则真正创建 wrapper Object，它与原始 string 在 typeof、=== 和 identity 上都不同。

#### 要点

- 参数传递、返回值、解构与赋值都传递语言值；是否共享可变状态由这个值是否具有 identity 决定。
- const 限制 binding 再赋值，不冻结对象；Object.freeze 限制自有属性描述符，也不递归冻结整张对象图。
- TypeScript 的 readonly 主要是静态写入限制，经过 alias、类型断言或外部 JavaScript 仍可能修改运行时对象。

#### 代码

```typescript
const state = { count: 0 }
const alias = state

alias.count += 1
console.assert(state.count === 1) // 两个 binding 持有同一对象值

let current = state
current = { count: 100 }
console.assert(state.count === 1) // 只更新 current binding

const frozen = Object.freeze({ nested: { count: 0 } })
frozen.nested.count += 1          // freeze 是浅层
console.assert(frozen.nested.count === 1)
```

#### 本章结论

不要问“对象是按值还是按引用传递”，先画出 binding 指向哪些语言值，再标出哪些值有 identity、哪些内部状态可变。

### 规范 Reference 是求值过程，不是用户可见指针

kicker: "02 · SPECIFICATION TYPE"

标识符 x、属性表达式 obj.x 和 super.x 的求值结果在规范算法中都可能是 Reference Record。它至少记录 [[Base]]、[[ReferencedName]]、[[Strict]]，某些形式还携带 [[ThisValue]]。GetValue 根据 base 是 Environment Record 还是对象，选择读取 binding 或执行对象 [[Get]]。

调用表达式也利用 Reference 决定 this。obj.method() 中被调用表达式保留 base=obj，EvaluateCall 能把 obj 作为 thisValue；先执行 const fn = obj.method 会通过 GetValue 丢掉 base，随后 fn() 不再自动绑定 obj。这比“点号左边就是 this”更精确，因为 optional chaining、super 和 with 等路径都要经过 Reference 算法。

JavaScript 不能返回“变量位置”让调用者在之后写回。return x 返回的是 GetValue(x)；若希望模拟引用参数，需要显式传入对象容器、getter/setter 对或回调。代理对象可以拦截属性内部方法，却仍不能把 lexical binding 变成用户可见指针。

#### 代码

```typescript
const meter = {
  value: 7,
  read() { return this.value }
}

console.assert(meter.read() === 7) // Reference 保留 base=meter

const detached = meter.read        // GetValue 后只剩 Function value
try {
  detached()                       // ESM/strict 下 this 为 undefined
} catch (error) {
  console.assert(error instanceof TypeError)
}

const rebound = detached.bind(meter)
console.assert(rebound() === 7)
```

#### 本章结论

Reference Record 解释了读取、赋值和调用之间的联系。它属于规范的抽象机器，不应被画成堆里可传递的指针对象。

### 八类语言值与 TypeScript 类型的错位

kicker: "03 · LANGUAGE TYPES"

规范层的语言类型是 Undefined、Null、Boolean、String、Symbol、Number、BigInt 和 Object。function、array、date、regexp 都属于 Object 的不同内部行为；typeof 的返回字符串又是历史兼容接口，例如 typeof null 为 "object"，它并不直接暴露这八类规范类型。

TypeScript 的类型系统更丰富：union、intersection、literal、tuple、enum、never、unknown 等大多没有同名运行时分类。它们用于描述可能值集合或静态证明状态，emit 后通常消失。反向也存在差距：NaN、-0、property descriptor、realm、proxy internal slot 很难仅凭普通 TS 类型完整表达。

number 表示 IEEE-754 binary64 数值集合，不存在独立 int/float 运行时类型。BigInt 是另一语言类型，Number 与 BigInt 的算术混用通常抛 TypeError。String 按 UTF-16 code unit 序列定义，视觉字符、Unicode code point 和 length 并非总是一一对应。

#### 要点

- 永远使用 string/number/boolean 描述 primitive，String/Number/Boolean 是 wrapper object 相关类型。
- typeof、instanceof、Array.isArray 和自定义 predicate 各观察不同证据，不能互换。
- 跨 iframe/realm 时 instanceof 依赖构造器 identity，结构检查或 brand API 往往更合适。

#### 代码

```typescript
const primitive = "lab"
const boxed = new String("lab")

console.assert(typeof primitive === "string")
console.assert(typeof boxed === "object")
console.assert(primitive == boxed)       // coercion 后相等
console.assert(!(primitive === boxed))   // 类型不同，严格不等

console.assert(typeof null === "object") // 历史行为，不是规范类型真相
console.assert(0n === BigInt(0))
// 0n + 1 // TypeError: 不能混用 BigInt 与 Number
```

#### 本章结论

静态类型名、typeof 标签和规范语言类型是三张不同地图。回答问题时先说明当前使用哪一层。

### ===、Object.is 与 SameValueZero 的分工

kicker: "04 · EQUALITY"

严格相等 === 使用 IsStrictlyEqual。不同语言类型直接 false；Number 中 NaN 与任何值都不相等，+0 与 -0 相等；对象仅比较 identity。它不执行 string/number 等类型强制转换，因此通常是业务判断的默认选择。

Object.is 暴露 SameValue：NaN 与 NaN 为 true，+0 与 -0 为 false。它适合检测状态是否真的保持同一值，React 的依赖比较和一些 descriptor 不变量会关心这些边界。SameValueZero 则同时让 NaN 相等并合并正负零，Array.prototype.includes、Map 和 Set 使用这类键语义。

宽松相等 == 调用 IsLooselyEqual，包含 Boolean、String、Number、BigInt、null/undefined 和对象转 primitive 的多分支转换。成熟代码可以在极窄意图下使用 x == null 同时匹配 null/undefined，但面试回答需要能写出转换路径，不能只说“== 会转换类型”。

#### 代码

```typescript
const rows = [
  ["NaN", NaN === NaN, Object.is(NaN, NaN), [NaN].includes(NaN)],
  ["+0/-0", +0 === -0, Object.is(+0, -0), new Set([+0, -0]).size === 1],
] as const

console.table(rows)

const first = { id: 1 }
const second = { id: 1 }
console.assert(!(first === second)) // 结构相同不改变 identity
console.assert(first === first)

console.assert(null == undefined)
console.assert(!(null === undefined))
```

#### 本章结论

选择相等算法等于选择边界语义。把 NaN、正负零和对象 identity 写进测试，才能知道自己真正选了什么。

### alias、不可变更新与 TypeScript 能力边界

kicker: "05 · ENGINEERING"

alias 的风险来自多个组件持有同一有 identity 且可变的值。局部 mutation 本身不邪恶，问题在所有权不清：调用者是否还会读取，缓存是否以 identity 判断变化，异步任务是否共享，API 是否承诺不修改输入。所有权合同比“永远深拷贝”更可扩展。

不可变更新创建新 identity，并在未变化子树上保留结构共享。它让 shallow equality 成为便宜的变化证据，适合状态管理和 memoization；代价是分配、短命对象、实现复杂度与误用浅拷贝。展开运算符只复制一层，嵌套对象仍共享 identity。

TypeScript 可用 readonly、Readonly<T>、品牌类型和 API 边界减少误写，却无法监控运行时 JavaScript、反射和深层 alias。真正需要运行时不变量时，要配合冻结、封装、持久化数据结构或 defensive copy，并明确成本。

#### 要点

- 输入拥有权：borrow、consume、clone、share 四种意图应在命名、类型和文档中至少表达一种。
- 缓存键：按 identity、稳定主键、内容 hash 或版本号选择，失败模式完全不同。
- 更新证据：若框架以 Object.is/shallow equality 判断变化，原地 mutation 可能让真实变化不可见。

#### 代码

```typescript
type User = Readonly<{
  id: string
  profile: Readonly<{ name: string; tags: readonly string[] }>
}>

function rename(user: User, name: string): User {
  return {
    ...user,
    profile: { ...user.profile, name } // 只复制变化路径
  }
}

const before: User = {
  id: "u1",
  profile: { name: "旧名", tags: ["staff"] }
}
const after = rename(before, "新名")

console.assert(before !== after)
console.assert(before.profile !== after.profile)
console.assert(before.profile.tags === after.profile.tags) // 安全结构共享
```

#### 本章结论

是否复制由所有权、变化检测与并发边界决定。readonly 提供静态护栏，运行时正确性仍要靠清晰协议和验证。

## 核心机制

- Identifier/Property 求值先产生 Reference Record，GetValue/PutValue 再执行实际读写。
- 赋值、参数和返回传递语言值；同一对象值写进多个 binding 后形成 alias。
- ===、SameValue、SameValueZero 对 Number 特例不同，对普通 Object 都比较 identity。
- TypeScript 类型在 emit 后大多擦除，运行时仍按 ECMAScript 值和内部方法执行。
- 不可变更新用新 identity 表示变化，通过结构共享控制复制成本。

## 常见误区

- 画出“变量盒子里装对象指针”，随后误以为 JavaScript 能传递 lexical binding 的地址。
- 用 JSON.stringify 比较对象，遗漏 undefined、Symbol、BigInt、循环、原型和 key 顺序语义。
- 认为 const/readonly/Object.freeze 等价于深不可变，或认为结构类型相同就具有同一 identity。
- 用 === 搜索 NaN，或没意识到 Map/Set 会把 +0 与 -0 当作同一键。

## 实现变体

### 原地 mutation + 独占所有权

useWhen: "对象只在一个模块或事务内拥有，性能敏感，调用边界能证明没有外部 alias。"
tradeoff: "分配少、代码直接；一旦所有权证明失效，缓存和并发观察者可能读到中间状态。"

#### 代码

```typescript
function normalizeOwned(record: { count: number }) {
  record.count = Math.max(0, record.count)
  return record
}
```

### 浅不可变更新 + 结构共享

useWhen: "UI/state store 使用 identity 判断变化，数据树大而每次只更新少量路径。"
tradeoff: "变化证据清晰；必须逐层复制变化路径，漏一层仍会原地修改共享子对象。"

#### 代码

```typescript
const next = {
  ...state,
  user: { ...state.user, name: "Ada" }
}
```

### 运行时深冻结/持久化结构

useWhen: "跨插件、租户或不可信边界，需要运行时阻止写入或提供强版本快照。"
tradeoff: "护栏更强，但递归冻结、proxy 或持久化节点带来 CPU、内存和调试成本。"

## 可运行示例

```typescript
type EqualityRow = {
  label: string
  strict: boolean
  sameValue: boolean
  sameValueZero: boolean
}

const sameValueZero = (left: unknown, right: unknown) =>
  left === right || (left !== left && right !== right)

const cases: Array<[string, unknown, unknown]> = [
  ["NaN", NaN, NaN],
  ["zero", +0, -0],
  ["same object", (() => { const x = {}; return x })(), null],
]

const shared = { value: 1 }
cases[2] = ["same object", shared, shared]
cases.push(["same shape", { value: 1 }, { value: 1 }])

const report: EqualityRow[] = cases.map(([label, left, right]) => ({
  label,
  strict: left === right,
  sameValue: Object.is(left, right),
  sameValueZero: sameValueZero(left, right),
}))

console.table(report)
console.assert(report.find(row => row.label === "NaN")?.sameValueZero)
console.assert(!report.find(row => row.label === "same shape")?.strict)
```

## 搭积木复现

### 积木 1：画 binding/value 图

为赋值、参数、返回和属性修改各画一次图，只允许出现 Environment binding、语言值、对象 identity 与属性边，不画“神秘引用盒子”。

### 积木 2：实现三种相等

实现 strictlyEqual、sameValue 和 sameValueZero 的教学版，至少覆盖不同类型、NaN、正负零、String 与 Object identity。

### 积木 3：建立 alias 反例

写一个看似 readonly 的嵌套对象，通过另一条 alias 修改它；分别尝试 shallow copy、deep freeze 和结构共享修复。

### 积木 4：读取 V8 分派

在 Object::SameValue/SameValueZero 中标出 pointer/identity fast path、Number、String 与 fallback，并说明哪些是引擎表示、哪些是规范语义。

### 积木 5：做 API 所有权设计

为一个 normalize 函数分别设计 mutate-owned、copy-on-write 和 defensive-copy 三版，写下调用合同、复杂度与错误用法。

## 自检

### 问题

既然对象常被描述为“引用类型”，为什么说 JavaScript 参数仍然按值传递？这两句话怎样同时成立而不矛盾？

### 站内答案

调用时复制到参数 binding 的是一个 ECMAScript 语言值。若该值是 Object，它携带唯一 identity，复制这个值不会复制对象属性图，因此形参和实参随后持有同一对象值，属性 mutation 彼此可见；给形参重新赋另一个对象只改变形参 binding。规范 Reference Record 则是求值器内部描述位置的临时记录，不是被复制进参数的语言值。
