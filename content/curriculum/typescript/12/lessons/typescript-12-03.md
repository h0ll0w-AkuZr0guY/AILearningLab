---
id: "typescript-12-03"
track: "typescript"
title: "mini-checker 的窄化引擎：truthiness/typeof/instanceof 与控制流事实积累"
depth: "deep"
visualIndex: "../visuals/typescript-12-03.md"
exampleLanguage: "javascript"
readingMinutes: 30
sourceMinutes: 20
practiceMinutes: 30
reviewMinutes: 10
---

## 官方入口

title: "Narrowing · TypeScript Handbook · typeof type guards"
url: "https://www.typescriptlang.org/docs/handbook/2/narrowing.html#typeof-type-guards"

官方文档把 narrowing 描述为从宽类型集合移除不可能成员，并分别讨论 `typeof`、truthiness、equality、`in`、`instanceof` 和用户自定义 predicate。本课只实现其中可独立验证的几种事实，不把运行时检查当成静态类型自动同步。

## 真实源码

repo: "microsoft/TypeScript"
file: "src/compiler/checker.ts"
symbol: "narrowTypeByTypeof; narrowTypeByTruthiness; getNarrowedType; getNarrowedTypeOfSymbol"
language: "typescript"
url: "https://github.com/microsoft/TypeScript/blob/c63de15a992d37f0d6cec03ac7631872838602cb/src/compiler/checker.ts#L29949-L30003"

### 逐段讲解

- `getNarrowedType` 先缓存 `(type,candidate,assumeTrue,checkDerived)`，说明同一控制流事实会反复使用，不能每次都从文本重新推断。
- true 分支会过滤 union 成员并优先保留与 candidate 直接相关的类型；false 分支则排除已经被证明的成员。
- `narrowTypeByTypeof`、truthiness 和 equality 是不同入口；它们得到的 TypeFacts 不应被一个“值不为空”布尔值替代。
- `getNarrowedTypeOfSymbol` 从 Symbol 当前类型开始，再结合 declaration 与 location 读取控制流结果；类型来自符号，事实来自位置。
- 真实 checker 还处理别名、赋值、闭包、循环、switch discriminant 和类型 predicate；mini-checker 将这些省略写成边界。

### 源码节选

```typescript
// TypeScript v5.9.3，src/compiler/checker.ts
function getNarrowedType(type: Type, candidate: Type, assumeTrue: boolean, checkDerived: boolean): Type {
    const key = type.flags & TypeFlags.Union
        ? `N${getTypeId(type)},${getTypeId(candidate)},${(assumeTrue ? 1 : 0) | (checkDerived ? 2 : 0)}`
        : undefined;
    return getCachedType(key) ?? setCachedType(
        key,
        getNarrowedTypeWorker(type, candidate, assumeTrue, checkDerived),
    );
}

function getNarrowedTypeWorker(type: Type, candidate: Type, assumeTrue: boolean, checkDerived: boolean) {
    if (!assumeTrue && type === candidate) return neverType;
    if (type.flags & TypeFlags.AnyOrUnknown) return candidate;
    const isRelated = checkDerived ? isTypeDerivedFrom : isTypeSubtypeOf;
    const narrowedType = mapType(candidate, c => {
        // 真实实现继续按 discriminant 和相关关系过滤 union。
        return mapType(type, t => isRelated(t, c) ? t : neverType);
    });
    return narrowedType;
}
```

## 导读

观察 `function print(value: string | number) { if (typeof value === "string") value.toUpperCase(); else value.toFixed() }`：同一个变量在 if 前有两个可能类型，true 分支只剩 string，false 分支只剩 number。类型没有被“改写成事实”，而是每个位置拥有一个从原始类型推导出的视图。

本课的模型是“类型集合 + 控制流事实”。`typeof value === "string"` 产生一个可证明的候选，窄化器在 true/false 两条边上分别过滤 union；两个分支在 join 处重新合并。该模型可以预测一个常见错误：只在 true 分支更新全局变量的类型，会把分支外的类型错误地收窄。

本课与 `typescript-01-05` 的 JavaScript 闭包语义相接，但只处理静态分析中的位置和事实；下一课会把泛型调用点收集成候选约束。

## 分章正文

### 先看 union 变量的两个可见结果

kicker: "01 · OBSERVE"

对 `string | number` 直接调用 `toUpperCase` 或 `toFixed` 都可能失败，因为调用点没有提供足够证据。检查器必须在读取操作前问“当前位置上哪些成员仍然可能”，而不是只看变量最初的声明类型。

#### 本章结论

没有控制流证据时保留 union；每个成员都必须支持的操作才可在宽类型上调用。

### 把类型看成集合，把事实看成过滤器

kicker: "02 · MODEL"

mini-checker 的 `union([string, number, null])` 是一组可能成员。truthy 事实移除 null，`typeof === string` 把集合过滤到 string；false 分支保留与条件相反的成员。过滤器不能凭空添加原类型之外的成员。

#### 代码

```javascript
const P = name => ({ kind: "primitive", name })
const U = members => ({ kind: "union", members })
function names(type) { return type.kind === "union" ? type.members.map(item => item.name) : [type.name] }
function filter(type, predicate) {
  const members = names(type).filter(predicate).map(P)
  return members.length === 1 ? members[0] : U(members)
}
const value = U([P("string"), P("number"), P("null")])
console.assert(names(filter(value, name => name !== "null")).join("|") === "string|number")
console.assert(names(filter(value, name => name === "string")).join("|") === "string")
```

#### 本章结论

这一步还解释了为什么“读取时再看一次运行时值”不是静态窄化的替代品。checker 在编译阶段只有语法和可推导事实，无法执行用户的网络请求、随机数或 getter；它只能把已证明的候选保存到当前位置。运行时 guard 负责真实值，静态 fact 负责允许哪些成员被安全使用，两者互相校验却不共享同一份可变状态。

窄化是从原始候选集合中删掉不可能成员；它不是运行时赋值，也不应创造未经证据支持的新类型。

### typeof、truthiness 与 equality 产生不同事实

kicker: "03 · GUARDS"

`typeof value === "string"` 是类型标签事实；`if (value)` 是 truthiness 事实；`value === other` 可能建立两个表达式的相等约束。它们都能触发过滤，却不是同一个 predicate。特别是 `typeof null === "object"` 的 JavaScript 历史行为，说明窄化器必须遵循真实运行时规则而不是名称直觉。

为了可测试，事实可以显式编码为 `{ variable, operator, value, polarity }`。不要直接修改 Symbol 的 declaredType，否则离开分支后无法恢复原 union。

#### 本章结论

事实的来源决定过滤算法；把所有 if 都降成 truthy 会误判 `typeof`、equality 和 null 的边界。

### 在控制流图上保存分支快照

kicker: "04 · FLOW"

每一个 block 进入时都有一个 fact map；true edge 与 false edge 复制父快照并应用不同过滤器。进入 join 时，对同名变量的结果做 union，除非某一条路径不可达而得到 never。这样可以解释“分支内精确、分支外恢复”的现象。

#### 代码

```javascript
const cloneFacts = facts => new Map(facts)
const join = (left, right) => {
  const result = new Map()
  for (const name of new Set([...left.keys(), ...right.keys()])) {
    const a = left.get(name) ?? []
    const b = right.get(name) ?? []
    result.set(name, [...new Set([...a, ...b])])
  }
  return result
}
const entry = new Map([["value", ["string", "number"]]])
const yes = cloneFacts(entry); yes.set("value", ["string"])
const no = cloneFacts(entry); no.set("value", ["number"])
console.assert(join(yes, no).get("value").join("|") === "string|number")
```

#### 本章结论

对一个多出口函数，join 还要考虑 return、throw 和 never。抛出异常的边不可达，因此不会把异常路径上的候选带回正常出口；提前 return 的分支同样可以从合并集合中移除。mini-checker 可以先把这些边简化为“可达/不可达”标记，但必须保留该标记，否则学习者会误以为所有语法分支都会回到同一个 join。

控制流事实属于边和位置；分支外通过 join 合并候选，不能把某一条路径的窄类型泄漏到所有路径。

### discriminant 和 instanceof 是结构证据

kicker: "05 · STRUCTURE"

对 `{ kind: "text", value: string } | { kind: "count", value: number }`，检查 `item.kind === "text"` 能选择对应成员，因为 discriminant 属性与 union 成员之间存在稳定映射。`instanceof` 则依赖构造函数和 prototype，不能只把类名当作 primitive。

教学实现可先把 discriminant 映射成 `key -> member`；真实 checker 会处理泛型、可选属性、private brand 和跨 realm 行为，必须在边界中说明。

#### 本章结论

结构型证据可以比 primitive 标签更精确，但必须有稳定的属性值或运行时 prototype 语义。

### 失败路径：赋值与闭包会撤销事实

kicker: "06 · FAILURE"

若 `value` 在窄化后重新赋值，旧事实不能继续使用；若一个可变变量被闭包捕获并在未知位置改写，checker 需要保守恢复。mini-checker 只支持同一 block 内显式 assignment invalidation：写入变量后删除该变量的窄化 fact。

另一个失败是把 `any` 当成所有候选都已证明。生产 TypeScript 对 any、unknown 和类型 predicate 有特殊边界；本课遇到未实现的 alias/closure effect 时返回 `unknown-fact`，不伪造精确结论。

#### 本章结论

事实必须有有效期；写入和无法追踪的副作用会使旧窄化失效，保守恢复优于错误通过。

### 工程取舍：精度、缓存和可解释性

kicker: "07 · ENGINEERING"

每次从根节点重算容易实现但成本高；为每个 FlowNode 缓存事实能提高速度，却需要在赋值、循环和函数边界上正确失效。精确的 fact map 也让诊断能说明“因为 kind===text，所以 value 被收窄为 string”。

先实现可解释的显式快照，再为稳定节点加缓存。不要先做复杂 CFG 而没有断言；窄化器的正确性优先通过每个分支的输入、输出和 join 结果验证。

#### 本章结论

在实践中，最容易观察到的错误不是窄化算法本身，而是缓存失效：源码被编辑后仍沿用旧 FlowNode，或同一个节点在不同 compiler option 下共享结果。任何缓存 key 都必须包含足以区分输入文本、类型选项和控制流前驱的信息。教学版先不做增量缓存，换取每次运行都能从同一输入重放的确定性。

窄化引擎的工程核心是 fact 生命周期；缓存只有在失效规则明确后才有价值。

## 核心机制

- union 是可能类型集合，窄化用事实过滤集合。
- `typeof`、truthiness、equality、discriminant 与 `instanceof` 产生不同证据。
- true/false 分支各自保存快照，join 用 union 合并可达路径。
- 重新赋值、闭包副作用和未知语义会使旧事实失效。
- 真实 checker 为 narrowed type 缓存并结合 Type/Symbol/FlowNode；mini-checker 用显式 fact map 模拟核心不变量。

## 常见误区

- 认为 if 会永久改变变量声明类型，忽略分支外的 join。
- 把 truthiness 与 `typeof` 当成同一规则，漏掉 null 与空字符串边界。
- 只看变量名称而不追踪赋值，导致旧事实越过 mutation。
- 把 `instanceof` 的类名当作结构类型，忽略 prototype 和跨 realm。
- 用 any/unknown 隐藏未实现路径，让 checker 生成过度自信的结果。

## 实现变体

### 变体 A：快照式 FlowFacts

useWhen: "教学、静态报告和需要复现每一步事实的工具。"
tradeoff: "状态清楚、调试容易；分支复制和 join 在大型 CFG 上会占用更多内存。"

#### 代码

```javascript
function narrowSnapshot(facts, name, allowed) {
  const next = new Map(facts)
  next.set(name, [...allowed])
  return next
}
const base = new Map([["x", ["string", "number"]]])
console.assert(narrowSnapshot(base, "x", ["string"]).get("x")[0] === "string")
console.assert(base.get("x").length === 2)
```

### 变体 B：FlowNode 链与惰性查询

useWhen: "CFG 很大、多个语法节点共享同一前驱事实时。"
tradeoff: "减少复制、适合缓存；读取时要追溯链并处理循环，错误证据也更难直接展示。"

#### 代码

```javascript
const entry = { parent: null, fact: ["string", "number"] }
const branch = { parent: entry, fact: ["string"] }
function current(node) { return node.fact ?? current(node.parent) }
console.assert(current(branch).join("|") === "string")
```

## 可运行示例

```javascript
const assert = (value, message) => { if (!value) throw new Error(message) }
const union = members => [...new Set(members)]

function narrow(type, guard, assumeTrue) {
  const result = type.filter(member => assumeTrue ? guard(member) : !guard(member))
  return result.length ? result : ["never"]
}

function analyze() {
  const entry = ["string", "number", "null"]
  const trueBranch = narrow(entry, value => value === "string", true)
  const falseBranch = narrow(entry, value => value === "string", false)
  assert(trueBranch.join("|") === "string", "typeof guard selects string")
  assert(falseBranch.join("|") === "number|null", "false edge retains other candidates")

  const truthy = narrow(entry, value => value !== "null", true)
  assert(truthy.join("|") === "string|number", "truthy removes null")

  const join = union([...trueBranch, ...falseBranch])
  assert(join.join("|") === "string|number|null", "join restores every reachable member")

  const facts = new Map([["value", entry]])
  const narrowed = new Map(facts)
  narrowed.set("value", trueBranch)
  assert(facts.get("value").length === 3, "branch snapshot does not mutate entry")
  assert(narrowed.get("value").length === 1, "branch gets its own fact")

  narrowed.delete("value")
  assert(!narrowed.has("value"), "assignment invalidates stale fact")
}

try {
  analyze()
  console.log("typescript-12-03: PASS")
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
```

## 搭积木复现

### 积木 1：表示 union 候选

用稳定字符串表示 primitive，先实现去重、包含和空集；空集固定命名为 never，并写一条“不可达分支”的断言。

### 积木 2：实现 typeof 过滤

把 `typeof x === tag` 编译成 predicate，分别计算 assumeTrue 与 false；加入 null 的特殊测试，防止把 object 标签当作 null 排除证据。

### 积木 3：实现 truthiness 过滤

先只删除 null，再补充 undefined、false、0 和空字符串的版本边界；每次扩展都更新运行时合同。

### 积木 4：保存 true/false 快照

用 Map clone 复制事实，证明一条路径的窄化不会改写入口；实现 join 并验证两个分支重新得到原 union。

### 积木 5：加入 assignment invalidation

在赋值节点删除变量的 fact；构造“先 typeof、再赋值、后调用”的失败用例，证明旧窄化不能跨过写入。

### 积木 6：对照真实 checker

把 `getNarrowedType` 的 candidate、assumeTrue、checkDerived 与 mini 的 predicate/edge/join 对照，列出省略的 FlowNode、alias、closure、switch 和缓存。

## 自检

### 问题

变量 `value: string | number | null` 在 true 分支经过 `typeof value === "string"`，随后重新赋值为 number，再离开分支。为什么 checker 不能继续把 value 当 string？join 点应得到什么候选？请说明真实源码的过滤与 mini 实验的验证方式。

### 站内答案

结论：赋值使旧事实失效，join 只能合并仍可达的候选。机制：初始 union 有三项，typeof true edge 过滤为 string；赋值是新的写入事实，后续读取必须以 number 或声明允许的类型重新计算，不能复用旧 string snapshot；如果另一条路径仍可到达 null，join 结果包含 number 与 null。源码证据：v5.9.3 的 `getNarrowedType` 按 candidate、assumeTrue 和 checkDerived 计算/缓存，`getNarrowedTypeWorker` 过滤 union，并由 `getNarrowedTypeOfSymbol` 从 Symbol 当前类型结合 location 取得结果。验证方法：运行示例，入口 Map 保持三项，分支 Map 只有 string，assignment 删除 fact，join 再合并可达项。取舍：快照易解释但复制更多，FlowNode 链省内存但读取和失效更复杂。边界：本课没有实现完整闭包 effect、循环 fixed point、复杂 alias 和 all TypeScript FlowNode 类型。

## 更新日志

### 建立 mini-checker 的控制流窄化课程

at: "2026-08-04T09:50:10+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "Codex Desktop · GPT-5.6 luna"
summary: "新增 truthiness/typeof 窄化、事实快照、assignment invalidation、join 失败边界与 state 视觉索引。"
