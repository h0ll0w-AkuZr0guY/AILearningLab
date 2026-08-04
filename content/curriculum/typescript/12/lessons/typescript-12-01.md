---
id: "typescript-12-01"
track: "typescript"
title: "mini-checker 的 Type AST：如何表示 number/string/union/object/function 类型"
depth: "deep"
visualIndex: "../visuals/typescript-12-01.md"
exampleLanguage: "javascript"
readingMinutes: 25
sourceMinutes: 15
practiceMinutes: 15
reviewMinutes: 5
---

## 官方入口

title: "Using the Compiler API · Creating and Printing a TypeScript AST"
url: "https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API#creating-and-printing-a-typescript-ast"

官方示例把 source text 解析为 `SourceFile`，再用 factory 创建节点、用 printer 输出节点。该页面是 TypeScript 官方 wiki，文档本身声明 Compiler API 仍可能演化；本课把它当作 v5.9.3 的实验入口，不把内部对象字段当成跨版本稳定合同。

## 真实源码

repo: "microsoft/TypeScript"
file: "src/compiler/types.ts; src/compiler/parser.ts; src/compiler/binder.ts"
symbol: "Node; SourceFile; Type; Symbol; Signature; parseSourceFile; bindSourceFile"
language: "typescript"
url: "https://github.com/microsoft/TypeScript/blob/c63de15a992d37f0d6cec03ac7631872838602cb/src/compiler/types.ts#L941-L955"

### 逐段讲解

- `Node` 用 `kind`、位置范围、flags 和 parent 把语法树节点接成可遍历结构；kind 是语法分类，不能把一个节点的文本直接当作类型。
- `SourceFile` 是根节点，同时拥有 statements、文件名和结束 token；它保存的是一次解析后的语法树入口，不等于 checker 已经计算出的类型环境。
- `Type`、`Symbol` 和 `Signature` 是 checker 的语义层数据；Type AST 只表示“要检查什么”，Symbol 和 Type 才表示“名称解析后是什么”。
- `parseSourceFile` 负责从文本建立 SourceFile，`bindSourceFile` 再把声明连接到符号表；把两步合并成一个 parse 函数会无法解释同名声明和作用域边界。
- mini-checker 只保留可验证的类型节点和声明引用，省略 JSX、装饰器、增量解析、JSDoc 与完整模块解析；因此它能教学但不具备生产编译器的语法覆盖率。

### 源码节选

```typescript
// TypeScript v5.9.3，src/compiler/types.ts
export interface Node extends ReadonlyTextRange {
    readonly kind: SyntaxKind;
    readonly flags: NodeFlags;
    readonly transformFlags: TransformFlags;
    readonly parent: Node;
}

export interface SourceFile extends Declaration, LocalsContainer {
    readonly kind: SyntaxKind.SourceFile;
    readonly statements: NodeArray<Statement>;
    readonly endOfFileToken: Token<SyntaxKind.EndOfFileToken>;
    fileName: string;
}

export interface Type {
    flags: TypeFlags;
    id: TypeId;
    checker: TypeChecker;
    symbol: Symbol;
}

export interface Symbol {
    flags: SymbolFlags;
    escapedName: __String;
    declarations?: Declaration[];
    members?: SymbolTable;
}
```

## 导读

当一个 checker 看到 `let x: string | number`，它至少要回答三个不同问题：文本被切成了哪些节点，`x` 这个名字绑定到哪一个声明，以及这个声明的类型如何参与兼容性判断。若把三者压缩成一张 `{ name, type }` 表，最早的 demo 也许能通过，遇到联合类型、对象属性或函数参数就会丢失结构。

本课建立 mini-checker 的第一块积木：用不可变的 Type AST 表示 primitive、union、object 和 function，再用声明表把名字连接到类型。核心心智模型是“语法树描述形状，符号表描述身份，类型节点描述可比较的合同”。这个模型能预测一个反例：两个变量都叫 `x`，只要作用域不同，它们可以拥有不同 Symbol，即使文本名称相同。

本课只负责表示，不实现 assignability、flow narrowing、generic inference 和 diagnostic formatting。前一条 TypeScript 路线已解释 JavaScript 的值、对象和模块运行时；本课把那些运行时事实转成静态 checker 的输入。下一课才把 Type 节点送进关系判定器。

## 分章正文

### 从一个错误开始：为什么字符串类型不够

kicker: "01 · OBSERVE"

输入 `let amount: number = "3"`，运行时字符串确实存在，但 checker 需要在执行前拒绝赋值。若只保存 `name -> "number"`，遇到 `number | string`、`{ id: number }` 或 `(x: number) => string` 就只能继续增加特殊字符串，最终没有递归结构可走。

因此观察对象要从“类型名字”升级为“类型树”。一个联合类型包含多个成员，一个对象类型包含属性表，一个函数类型包含参数列表和返回类型。错误信息所指向的原始节点仍来自 Node，而兼容性使用的是 Type。

#### 本章结论

可比较的类型必须保留结构；文本名称、声明身份和类型形状不能混为一个字段。

### 建立四类最小 Type AST

kicker: "02 · MODEL"

mini-checker 先选择封闭的数据模型：`primitive` 保存 `number/string/boolean/unknown/never`；`union` 保存去重后的成员；`object` 保存属性名到 Type 的映射；`function` 保存参数和返回类型。每个节点都有 `kind`，这样后续算法可以用显式分派而不是猜字段。

#### 代码

```javascript
const type = {
  primitive: name => Object.freeze({ kind: "primitive", name }),
  union: members => Object.freeze({ kind: "union", members: [...members] }),
  object: properties => Object.freeze({
    kind: "object",
    properties: new Map(Object.entries(properties))
  }),
  fn: (params, returns) => Object.freeze({
    kind: "function", params: [...params], returns
  })
}

const User = type.object({ id: type.primitive("number") })
const Result = type.union([User, type.primitive("string")])
console.assert(Result.members.length === 2)
```

#### 本章结论

Type AST 的不变量是 `kind` 决定字段集合，复合节点只引用其他 Type 节点；后续算法可递归而不依赖文本解析。

### Node 与 Type 分工：同一段文本的两条轨道

kicker: "03 · TWO TRACKS"

`type User = { id: number }` 的 `TypeLiteralNode` 记录源码结构与位置，checker 归一后得到 object Type。`User` 的 `Symbol` 记录它由哪个声明产生、在哪个符号表可见。Node 适合定位与遍历，Symbol 适合名字身份，Type 适合关系计算。

TypeScript 源码的 `SourceFile` 继承声明和 locals 容器，说明根节点会参与后续绑定；但内部 Node 还带 parent、flags 和 transform 信息，教学版只保留必要子树，不能据此声称与生产对象布局相同。

#### 代码

```javascript
const source = {
  kind: "type-alias",
  name: "User",
  typeNode: { kind: "object-type", members: [
    { kind: "property", name: "id", typeNode: { kind: "keyword", name: "number" } }
  ] }
}
const symbol = { name: "User", declaration: source }
const semanticType = type.object({ id: type.primitive("number") })
console.assert(symbol.declaration.typeNode.members[0].name === "id")
console.assert(semanticType.properties.get("id").name === "number")
```

#### 本章结论

一个声明至少有语法轨道和语义轨道；把 Node 当 Type 会丢失名字身份，把 Type 当 Node 会丢失源码范围。

### 从 SourceFile 到声明表：绑定是第二阶段

kicker: "04 · BIND"

官方 Compiler API 的 `SourceFile` 只是 AST 根。TypeScript 的 binder 读取节点，为声明创建或合并 Symbol，并把 locals 放进作用域容器。mini-checker 可以用一个显式 scope 栈模拟这一边界：进入 block 创建子表，离开 block 丢弃；查找从内向外回退。

同名声明是否合并取决于语言规则，不能简单用 `Map.set` 覆盖。为了保持本课边界，mini-checker 只允许同一 scope 中一个值声明，重复时产生结构化冲突，模块/namespace 合并留给后续课程。

#### 本章结论

parse 产出节点，bind 建立声明身份；作用域查找决定同名文本是否指向同一个 Symbol。

### 复合类型的规范化与不变量

kicker: "05 · NORMALIZE"

如果 `number | (string | number)` 保留嵌套结构，兼容性算法要反复处理同一分支；如果对象属性顺序影响比较，两个等价类型也会得到不一致结果。构造器因此需要展平 union、按名称读取 object 属性，并在输出中稳定排序。

规范化不是“变得更聪明”，它只是在不改变语义的前提下固定表示。不能把 `any` 直接归为 `unknown`，也不能把函数参数反转，因为这些行为属于后续关系算法的语义决策。

#### 代码

```javascript
function union(...members) {
  const flat = members.flatMap(item => item.kind === "union" ? item.members : [item])
  const seen = new Set()
  const result = []
  for (const member of flat) {
    const key = JSON.stringify(member, (_, value) => value instanceof Map ? [...value] : value)
    if (!seen.has(key)) { seen.add(key); result.push(member) }
  }
  return { kind: "union", members: result }
}

const number = type.primitive("number")
const normalized = union(number, type.union([type.primitive("string"), number]))
console.assert(normalized.members.length === 2)
```

#### 本章结论

规范化要保持结构语义，只消除嵌套和不稳定顺序；它不能提前替关系判定器做取舍。

### 失败路径：未支持的语法必须显式失败

kicker: "06 · FAILURE"

真实 TypeScript 语法远大于 mini-checker 的覆盖范围。遇到 conditional type、mapped type、decorator 或 JSX 时，静默把它当作 `unknown` 会产生“检查通过”的假安全。教学实现应返回 `UnsupportedTypeNode`，同时带上 Node 的 kind 和位置，让上层决定是报错、降级还是交给真正的 `tsc`。

失败对象应区分 parse failure、bind failure 和 type-model failure。三者的修复动作不同：括号错误要改文本，重复声明要改作用域，未知 Type 语法要扩展模型。只返回一个布尔值，后续诊断无法解释机制。

#### 本章结论

未知输入必须可观察地失败；显式拒绝比伪造一个过宽类型更安全。

### 工程边界：教学 AST 与生产编译器

kicker: "07 · ENGINEERING"

生产 TypeScript 还要处理增量解析、错误恢复、JSDoc、装饰器、JS 文件、模块解析、缓存、transform flags 和编译选项。源码中的 Node 有更多内部字段，Type 还与 checker、Symbol links 和缓存相连。本课删掉这些分支，是为了让学习者先能运行一条稳定的“parse → bind → model”主路径。

变体选择遵循一个规则：需要快速实验时用显式对象 Type AST；需要和真实 TypeScript 交互时让官方 parser 生成 SourceFile，再用自己的语义层做投影。前者容易断言，后者覆盖语法更广，但受版本和 Compiler API 稳定性约束。

#### 本章结论

教学实现的价值在于暴露不变量，不在于复制完整编译器；生产工具必须把版本、语法覆盖和恢复策略写进合同。

## 核心机制

- Node 记录语法、范围和父子关系，Type 记录可比较的语义形状，Symbol 记录声明身份。
- `SourceFile` 是解析结果的根，binder 另行建立 locals 与 Symbol；解析和绑定有不同失败边界。
- primitive、union、object、function 四类 Type 可以递归组成 mini-checker 的最小语言。
- 规范化只负责固定结构，不提前替 assignability、narrowing 或 inference 做语义判断。
- 不支持的节点返回结构化失败，不能静默降成 `unknown`。

## 常见误区

- 认为 `type: "number"` 能表示所有类型，遇到 object 和 function 就靠字符串拼接。
- 把 AST 节点直接当作 Symbol，导致两个作用域中的同名声明错误合并。
- 把 `unknown` 当成“暂时不会处理”，让未支持语法错误地通过。
- 认为对象属性的书写顺序影响结构类型，忽略稳定的属性表查找。
- 只测试成功构造，不测试空 union、重复成员和未知节点的失败行为。

## 实现变体

### 变体 A：判别联合 Type AST

useWhen: "课程实验、序列化、调试和需要直接观察每个类型字段时。"
tradeoff: "分派清楚、断言容易；运行时对象较多，且需要手动维护规范化与相等性。"

#### 代码

```javascript
const primitive = name => ({ kind: "primitive", name })
const object = properties => ({ kind: "object", properties })
const show = t => t.kind === "primitive" ? t.name : "object"
console.assert(show(primitive("string")) === "string")
console.assert(show(object(new Map())) === "object")
```

### 变体 B：不可变构造器与缓存

useWhen: "需要大量重复构造类型、比较 identity 或模拟 compiler cache 时。"
tradeoff: "相同结构可以共享实例，减少重复遍历；缓存 key 设计和失效策略会增加复杂度。"

#### 代码

```javascript
const cache = new Map()
function primitiveCached(name) {
  if (!cache.has(name)) cache.set(name, Object.freeze({ kind: "primitive", name }))
  return cache.get(name)
}
console.assert(primitiveCached("number") === primitiveCached("number"))
```

## 可运行示例

```javascript
const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const primitive = name => Object.freeze({ kind: "primitive", name })
const object = entries => Object.freeze({
  kind: "object",
  properties: new Map(entries)
})
const fn = (params, returns) => Object.freeze({
  kind: "function", params: [...params], returns
})

function flattenUnion(members) {
  return members.flatMap(item => item.kind === "union" ? item.members : [item])
}

function union(members) {
  const unique = []
  const keys = new Set()
  for (const member of flattenUnion(members)) {
    const key = member.kind === "primitive"
      ? `primitive:${member.name}`
      : JSON.stringify(member, (_, value) => value instanceof Map ? [...value] : value)
    if (!keys.has(key)) { keys.add(key); unique.push(member) }
  }
  return Object.freeze({ kind: "union", members: unique })
}

const number = primitive("number")
const string = primitive("string")
const user = object([["id", number]])
const lookup = union([number, union([string, number])])
const callback = fn([user], string)

assert(lookup.members.length === 2, "union should flatten and deduplicate")
assert(user.properties.get("id") === number, "object property retains Type identity")
assert(callback.params[0] === user, "function parameter retains object Type")

try {
  const unsupported = { kind: "conditional", check: number }
  if (unsupported.kind !== "primitive" && unsupported.kind !== "object" && unsupported.kind !== "union" && unsupported.kind !== "function") {
    throw new Error(`unsupported Type AST: ${unsupported.kind}`)
  }
  assert(false, "unsupported type should fail")
} catch (error) {
  assert(error.message.includes("unsupported"), "failure must identify unsupported type")
}

console.log("typescript-12-01: PASS")
```

## 搭积木复现

### 积木 1：定义判别联合

先只实现 primitive、object、union、function 四个 `kind`，每个构造器返回不可变对象。断言未知字段不会改变 kind 到字段的关系。

### 积木 2：加入递归引用

让 object 属性和 function 参数都引用 Type 节点，而不是复制 JSON 字符串。用 `===` 断言重复使用的 number 节点仍保持 identity。

### 积木 3：实现 union 规范化

展平嵌套 union、去重成员，并把空 union 的策略写成明确失败或 `never`。不要在这里偷偷实现 assignability。

### 积木 4：建立 scope 与 Symbol

用栈实现 enter/leave/declare/lookup；同一作用域重复声明抛出 bind error，内层同名声明遮蔽外层但不覆盖外层 Symbol。

### 积木 5：把 Node 投影成 Type

构造 `keyword`、`type-literal`、`function-type` 三种语法节点，写一个投影函数；遇到 conditional 等未知节点返回结构化 Unsupported，而不是 unknown。

### 积木 6：对照上游边界

把 mini 节点与 TypeScript `Node`、`SourceFile`、`Type`、`Symbol` 对照，列出省略的 parent/flags、错误恢复、JSDoc、模块与增量缓存，并验证后续课不依赖这些省略。

## 自检

### 问题

为什么 `SourceFile`、`Symbol` 和 `Type` 不能用一个对象替代？如果内层 block 再声明一个同名变量，哪个对象发生变化，哪个对象必须保持独立？请用上游接口与 mini 实验回答。

### 站内答案

结论：三者职责不同，必须分层。机制：`SourceFile`/`Node` 保存语法树与位置，`Symbol` 绑定声明身份和作用域，`Type` 保存可递归比较的语义形状；内层同名声明创建新的 Symbol，但可以引用相同的 primitive Type。源码证据：v5.9.3 的 `types.ts` 分别定义 `Node`、`SourceFile`、`Type`、`Symbol`，`parser.ts` 的 `parseSourceFile` 负责文本到 SourceFile，`binder.ts` 的 `bindSourceFile`/`bind` 再建立符号关系。验证方法：运行示例的 scope 栈实验，断言两个 `x` 的 Symbol 不同、两者的 number Type 可以相同。取舍：合并对象代码少但会把源码范围、身份和语义缓存耦合，难以解释失败位置；分层实现多几个结构，却能让下一课的 assignability 只接收 Type。边界：本课不覆盖完整语法、模块和增量解析，未知节点必须显式失败。

## 更新日志

### 建立 mini-checker 的 Type AST 课程

at: "2026-08-04T09:50:10+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "Codex Desktop · GPT-5.6 luna"
summary: "新增 Type AST、绑定分层、失败路径、双实现变体、可运行断言与 flow 视觉索引。"
