---
id: "typescript-12-02"
track: "typescript"
title: "mini-checker 的类型兼容性检查：从结构类型到函数参数逆变"
depth: "deep"
visualIndex: "../visuals/typescript-12-02.md"
exampleLanguage: "javascript"
readingMinutes: 30
sourceMinutes: 20
practiceMinutes: 30
reviewMinutes: 10
---

## 官方入口

title: "Type Compatibility · TypeScript Handbook"
url: "https://www.typescriptlang.org/docs/handbook/type-compatibility.html#starting-out"

官方文档从结构类型开始：TypeScript 比较对象的成员，而不是要求名义上的 class 身份；文档也单独讨论函数参数、返回值和 soundness 取舍。本课固定 mini-checker 的规则子集，不把 TypeScript 的全部特殊例外误写成“普通结构类型”。

## 真实源码

repo: "microsoft/TypeScript"
file: "src/compiler/checker.ts; src/compiler/types.ts"
symbol: "isTypeAssignableTo; isTypeRelatedTo; checkTypeRelatedTo; Type; Signature"
language: "typescript"
url: "https://github.com/microsoft/TypeScript/blob/c63de15a992d37f0d6cec03ac7631872838602cb/src/compiler/checker.ts#L21218-L21220"

### 逐段讲解

- `isTypeAssignableTo` 不自己遍历每个字段，而是把判断交给 `isTypeRelatedTo` 与 assignable relation；关系类型和缓存策略因此是内部实现的一部分。
- `checkTypeRelatedTo` 接收 source、target、relation 和 error node，说明“能否赋值”和“如何生成错误”在源码中相互靠近但仍是两个职责。
- `Type` 的 flags、symbol 和复合类型字段为递归判定提供入口；mini-checker 只保留 primitive、union、object、function 四种。
- `Signature` 保存参数、typeParameters 和返回类型，函数兼容性不能把整段签名当作一个字符串比较。
- 生产 checker 还会处理 any、unknown、never、可选参数、重载、上下文签名和 method bivariance；本课用失败测试明确哪些被省略。

### 源码节选

```typescript
// TypeScript v5.9.3，src/compiler/checker.ts
function isTypeAssignableTo(source: Type, target: Type): boolean {
    return isTypeRelatedTo(source, target, assignableRelation);
}

function checkTypeRelatedTo(
    source: Type,
    target: Type,
    relation: Map<string, RelationComparisonResult>,
    errorNode: Node | undefined,
    headMessage?: DiagnosticMessage,
) {
    // 真实实现继续处理递归关系、缓存和诊断。
    return checkTypeRelatedToAndOptionallyElaborate(
        source, target, relation, errorNode, undefined, headMessage,
    );
}

// src/compiler/types.ts
export interface Signature {
    declaration?: SignatureDeclaration | JSDocSignature;
    typeParameters?: readonly TypeParameter[];
    parameters: readonly Symbol[];
    returnType?: Type;
}
```

## 导读

把 `const point = { x: 1, y: 2 }` 传给只需要 `{ x: number }` 的函数时，代码通常能通过；把 `x` 改成 string 就失败。这个现象说明兼容性问题不是“两个类型名字是否相等”，而是 target 要求的每个成员能否在 source 中找到，并且值域是否足够。

本课建立一个可递归的关系判定器：`assignable(source, target)`。核心模型是“source 提供能力，target 描述最低需求”。对象按 target 成员检查，union 让 source 或 target 的一侧承担分支选择，函数比较参数与返回值时必须考虑调用方和被调用方的方向。该模型能预测反例：若把函数参数也按协变比较，`(Dog) => void` 会被错误地当成 `(Animal) => void`，调用方传入 Cat 时产生运行时风险。

本课不处理控制流事实和泛型候选；下一课会让同一个 Type 在 if 分支中被过滤，第四课才把 type parameter 当作待求解变量。

## 分章正文

### 从结构类型的可观察赋值开始

kicker: "01 · OBSERVE"

定义 `need({ id: number })`，传入 `{ id: number, name: string }` 能通过，而 `{ name: string }` 失败。额外成员不是问题，因为调用方只要求 target 的最小能力；缺少 required member 才是硬失败。

这条规则与 JavaScript 的对象传递相符，但不能扩张为“所有对象都兼容”。属性存在后仍要递归比较属性类型，嵌套对象、数组和函数都要继续进入关系算法。

#### 本章结论

结构兼容性检查 target 的必要成员和每个成员的类型，不要求 source 与 target 拥有同一个名字。

### 对象关系：target 是需求集合

kicker: "02 · OBJECT"

对象类型用 `Map<string, Type>` 表示。对 target 的每个属性，先从 source 查找；找不到返回 missing-property，找到后递归调用 assignable。可选属性、索引签名和 readonly 需要额外合同，本课先拒绝这些节点而不猜测。

为了避免比较顺序影响结果，属性遍历可以按 target 的稳定键顺序进行；错误结果保存路径 `root.user.id`，这样下一课的诊断能指出最小失败位置。

#### 代码

```javascript
const P = name => ({ kind: "primitive", name })
const O = properties => ({ kind: "object", properties: new Map(Object.entries(properties)) })

function assignObject(source, target, path = []) {
  for (const [name, wanted] of target.properties) {
    const actual = source.properties.get(name)
    if (!actual) return { ok: false, reason: "missing-property", path: [...path, name] }
    if (!assignable(actual, wanted).ok) return { ok: false, path: [...path, name] }
  }
  return { ok: true }
}

function assignable(source, target) {
  if (source.kind === "primitive" && target.kind === "primitive") {
    return { ok: source.name === target.name }
  }
  if (source.kind === "object" && target.kind === "object") return assignObject(source, target)
  return { ok: false, reason: "unsupported-relation" }
}

const actual = O({ id: P("number"), label: P("string") })
console.assert(assignable(actual, O({ id: P("number") })).ok)
console.assert(!assignable(actual, O({ id: P("boolean") })).ok)
```

#### 本章结论

这里的“额外成员可以保留”描述的是普通结构赋值的需求方向，不能直接推出 fresh object literal、索引签名或 excess property check 的全部行为。真实 TypeScript 会在表达式来源不同、目标有 index signature 或属性带 optional 标记时走额外分支。mini-checker 暂时把这些情况标为 unsupported，让模型在边界处停下，而不是用一个含糊的“结构类型都一样”覆盖版本差异。

对象关系从 target 的需求出发递归查找 source；额外成员可以保留，缺少或类型不对的 required member 必须失败。

### primitive、union 与 never 的分支规则

kicker: "03 · SUM"

primitive 只有相同名称才兼容，`never` 可赋给任意 target，因为它代表不会产生值；`unknown` 可以接收任意 source，却不能反向赋给具体类型。union 要明确位于 source 还是 target：`A | B` 作为 source 时每个成员都必须能赋给 target；作为 target 时只需有一个成员能接收 source。

这不是集合运算的装饰，而是调用合同：source union 表示运行时可能提供多个形状，target 必须覆盖全部可能；target union 表示调用者接受多个形状，source 只需落在其中一个。

#### 本章结论

source union 需要逐成员通过，target union 需要存在一个可接收分支；`unknown` 和 `never` 的方向必须单独编码。

### 函数类型：参数方向由调用位置决定

kicker: "04 · FUNCTION"

设 target 是 `(Animal) => void`。任何合法 source 函数都可能被 target 调用方传入一个 Animal，因此 source 函数必须能接收 Animal；这要求 target parameter assignable to source parameter，方向与返回值相反。返回值则由 source 产出、target 消费，source return 必须 assignable to target return。

教学实现采用 strict function types 的安全规则。真实 TypeScript 对 method 与 callback 的历史兼容有特殊处理，不能用本课函数规则概括所有库类型；实现变体会比较安全模式与宽松模式的边界。

#### 代码

```javascript
const F = (params, returns) => ({ kind: "function", params, returns })
function assignable(source, target) {
  if (source.kind === "primitive" && target.kind === "primitive") return { ok: source.name === target.name }
  if (source.kind === "function" && target.kind === "function") {
    if (source.params.length !== target.params.length) return { ok: false, reason: "arity" }
    for (let i = 0; i < target.params.length; i++) {
      if (!assignable(target.params[i], source.params[i]).ok) return { ok: false, reason: "parameter" }
    }
    return assignable(source.returns, target.returns)
  }
  return { ok: false }
}

const animal = { kind: "object", properties: new Map([["name", { kind: "primitive", name: "string" }]]) }
const dog = { kind: "object", properties: new Map([["name", { kind: "primitive", name: "string" }], ["bark", { kind: "primitive", name: "boolean" }]]) }
console.assert(assignable(F([animal], animal), F([dog], animal)).ok === false)
```

#### 本章结论

函数参数比较要反向检查，返回值正向检查；仅比较参数个数或把两个方向都写成协变会误判调用安全。

### 递归关系与循环保护

kicker: "05 · RECURSION"

对象可嵌套对象，函数可以返回自己，类型别名还可能形成递归图。关系判定器需要 `seen` 集合保存 `(source,target)` 对，遇到已处理的 pair 时返回暂定结果或走固定的递归规则；否则一个合法递归类型就会无限递归。

真实 checker 还使用 relation map 和 Type id 做缓存。mini-checker 用字符串 id 足以展示不变量，但不能声称与生产缓存的失效和递归策略完全相同。

#### 本章结论

兼容性是图关系而非树遍历；递归 pair 的缓存是正确性和性能的共同边界。

### 失败路径：错误位置跟着关系路径走

kicker: "06 · FAILURE"

当 `User.profile.id` 期望 number 却得到 string，错误应该包含属性路径，而不是只说“User 不兼容”。判定器可以返回 `{ ok, path, reason, source, target }`，formatter 再把它转成人类可读文本。这样算法可以保持纯函数，错误格式也可独立测试。

遇到 unsupported relation 时必须失败并保留原因。若把所有未知关系当作成功，会让诊断表面干净却破坏 soundness；若把所有未知关系当作 `never`，又会产生大量误报。边界应由调用者策略决定。

#### 本章结论

关系结果还可以携带一条可回放的证据链：先记录进入哪个对象属性，再记录 primitive 或函数分派，最后保存 source/target 的格式化结果。这样一次失败既能被终端渲染，也能被测试断言。若算法在深层递归中只返回 false，外层就无法知道是字段缺失、参数方向错误还是版本模式不支持，后续诊断只能重新猜测。

关系算法需要返回证据链；失败原因、属性路径和两侧类型是诊断的输入，不应在递归中丢弃。

### 工程取舍：soundness、兼容性与复杂度

kicker: "07 · ENGINEERING"

严格函数参数规则更安全，却可能拒绝历史 callback API；宽松模式更兼容，却允许调用者把窄函数当成宽函数。生产 TypeScript 通过选项和特定语法例外做折中，mini-checker 应把模式作为显式配置，而不是隐藏在 `if` 中。

在复杂度上，简单对象关系接近 `O(properties)`，联合与递归会乘上分支数量；缓存可以避免重复 pair，但 relation key 必须包含模式和方向。调试时优先打印关系路径与 cache hit，而非只打印最终 boolean。

#### 本章结论

选择安全或兼容模式必须由 API 的调用合同决定；缓存和诊断路径同时影响性能与可解释性。

## 核心机制

- source 提供能力，target 定义最低需求；结构类型比较 target 的成员。
- primitive、object、union、function 使用不同分派；不能用一条字符串相等规则覆盖。
- source union 要每个成员通过，target union 只需一个分支通过；`unknown`/`never` 有特殊方向。
- 函数参数逆变、返回值协变，调用位置决定安全方向。
- 递归关系用 `(source,target,mode)` 缓存避免无限递归，并保留失败路径供诊断使用。

## 常见误区

- 把结构类型误解成“只要有同名类型就兼容”，忽略必需成员和成员值域。
- 把 target union 与 source union 使用同一个 `some` 或 `every` 规则。
- 把函数参数和返回值都按协变处理，导致窄函数接收了更宽的调用输入。
- 只返回 boolean，后面无法说明失败发生在哪个嵌套属性。
- 把 TypeScript 的 method bivariance 例外当成所有函数的安全规则。

## 实现变体

### 变体 A：严格结构关系

useWhen: "内部 API、验证器和希望尽早暴露调用错误的代码。"
tradeoff: "参数规则更安全，可能拒绝旧式 callback；需要给错误路径提供更完整提示。"

#### 代码

```javascript
function parameterRelation(sourceParam, targetParam, strict) {
  return strict
    ? assignable(targetParam, sourceParam)
    : assignable(sourceParam, targetParam)
}
console.assert(parameterRelation({ kind: "primitive", name: "number" }, { kind: "primitive", name: "number" }, true).ok)
```

### 变体 B：带模式的关系引擎

useWhen: "兼容已有 callback API，或需要逐步迁移老代码。"
tradeoff: "可减少迁移阻力，但模式进入 cache key 和诊断，测试矩阵更大。"

#### 代码

```javascript
const relationCache = new Map()
function cachedPair(sourceId, targetId, mode, compute) {
  const key = `${sourceId}|${targetId}|${mode}`
  if (!relationCache.has(key)) relationCache.set(key, compute())
  return relationCache.get(key)
}
console.assert(cachedPair("A", "B", "strict", () => false) === false)
console.assert(cachedPair("A", "B", "strict", () => true) === false)
```

## 可运行示例

```javascript
const assert = (value, message) => { if (!value) throw new Error(message) }
const P = name => ({ kind: "primitive", name })
const O = properties => ({ kind: "object", properties: new Map(Object.entries(properties)) })
const F = (params, returns) => ({ kind: "function", params, returns })

function relation(source, target, seen = new Set(), path = []) {
  const pair = `${source.id ?? JSON.stringify(source)}=>${target.id ?? JSON.stringify(target)}`
  if (seen.has(pair)) return { ok: true, path }
  seen.add(pair)
  if (source.kind === "primitive" && target.kind === "primitive") {
    return source.name === target.name ? { ok: true, path } : { ok: false, path, reason: "primitive" }
  }
  if (source.kind === "object" && target.kind === "object") {
    for (const [name, wanted] of target.properties) {
      const actual = source.properties.get(name)
      if (!actual) return { ok: false, path: [...path, name], reason: "missing" }
      const result = relation(actual, wanted, seen, [...path, name])
      if (!result.ok) return result
    }
    return { ok: true, path }
  }
  if (source.kind === "function" && target.kind === "function") {
    if (source.params.length !== target.params.length) return { ok: false, path, reason: "arity" }
    for (let i = 0; i < source.params.length; i++) {
      const result = relation(target.params[i], source.params[i], seen, [...path, `arg${i}`])
      if (!result.ok) return result
    }
    return relation(source.returns, target.returns, seen, [...path, "return"])
  }
  return { ok: false, path, reason: "unsupported" }
}

const source = O({ id: P("number"), label: P("string") })
const target = O({ id: P("number") })
assert(relation(source, target).ok, "extra source member is allowed")
const bad = relation(O({ id: P("string") }), target)
assert(!bad.ok && bad.path.join(".") === "id", "nested mismatch keeps path")
const dog = O({ name: P("string"), bark: P("boolean") })
const animal = O({ name: P("string") })
const narrow = F([dog], animal)
const wide = F([animal], animal)
assert(!relation(narrow, wide).ok, "strict function parameters reject narrow callback")
console.log("typescript-12-02: PASS")
```

## 搭积木复现

### 积木 1：primitive 关系

实现同名 primitive 通过、不同名失败，返回 reason 而不是 boolean；先写 normal 与 failure 两个断言。

### 积木 2：对象成员递归

从 target 属性遍历 source，追加嵌套 path；验证额外属性不影响通过，缺失属性和错误 primitive 都失败。

### 积木 3：union 方向

分别写 `every` 的 source union 与 `some` 的 target union；用 `number | string` 对 `number`、`boolean` 的组合覆盖两种方向。

### 积木 4：函数参数与返回值

先固定同样 arity，再实现参数反向、返回值正向；加入一个窄 callback 失败用例，证明方向不是语法偏好。

### 积木 5：递归 pair 缓存

给 Type 节点分配稳定 id，用 set 记录 pair；构造自引用 object，验证算法结束且没有把正常递归类型误判为失败。

### 积木 6：对照真实 checker

把每个分派连接到 v5.9.3 的 `isTypeAssignableTo`、`checkTypeRelatedTo`、`Type` 与 `Signature`，列出生产实现的 any/unknown、重载、method bivariance 和 relation cache 分支。

## 自检

### 问题

为什么 source 是 `Dog`、target 是 `Animal` 时对象可以结构兼容，但函数 `(Dog) => void` 不能直接当成 `(Animal) => void`？如果把函数参数也按对象属性的正向规则比较，会制造哪一个可运行失败？

### 站内答案

结论：对象是被读取的能力集合，函数参数是调用方将要提供的输入，方向不同。机制：source Dog 拥有 Animal 所需的 name，因此对象赋值安全；target 函数可能把任意 Animal 传给 source 函数，source 若只会接 Dog 就不安全，所以参数需反向检查，返回值仍正向。源码证据：v5.9.3 的 `isTypeAssignableTo` 委托 `isTypeRelatedTo`，关系函数接收 source/target/relation/errorNode；`Signature` 把 parameters 与 returnType 单独保存，证明函数不能按对象单字段处理。验证方法：运行示例，严格模式下窄 callback 关系为 false；若把参数比较改为正向，再传入缺少 bark 的 Animal 并在 callback 内访问 bark，就会出现未定义访问。取舍：严格规则更 sound，宽松规则便于兼容历史 callback；边界：本课不覆盖 TypeScript method bivariance、重载选择和完整 any 传播。

## 更新日志

### 建立 mini-checker 的类型关系课程

at: "2026-08-04T09:50:10+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "Codex Desktop · GPT-5.6 luna"
summary: "新增结构类型、函数参数逆变、递归关系、失败位置、双实现变体与 flow 视觉索引。"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/38"
commit: "b8e72d2702e7dbece46e83a98407a44eda8984f"
