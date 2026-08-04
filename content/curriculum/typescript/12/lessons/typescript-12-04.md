---
id: "typescript-12-04"
track: "typescript"
title: "mini-checker 的泛型推断：从调用点收集约束到代入求解"
depth: "deep"
visualIndex: "../visuals/typescript-12-04.md"
exampleLanguage: "javascript"
readingMinutes: 40
sourceMinutes: 25
practiceMinutes: 25
reviewMinutes: 10
---

## 官方入口

title: "Generics · Hello World of Generics and Generic Constraints"
url: "https://www.typescriptlang.org/docs/handbook/2/generics.html#hello-world-of-generics"

官方文档先用 identity 说明类型参数必须出现在输入和输出的关系中，再用 constraints 限制可接受的类型集合。本课把调用点的推断压缩为“收集候选 → 合并候选 → 检查约束 → 代入返回类型”，不把复杂 conditional type inference 当作本课的隐藏前提。

## 真实源码

repo: "microsoft/TypeScript"
file: "src/compiler/checker.ts; src/compiler/types.ts"
symbol: "inferTypes; inferFromTypes; inferFromSignature; TypeParameter; InferenceInfo"
language: "typescript"
url: "https://github.com/microsoft/TypeScript/blob/c63de15a992d37f0d6cec03ac7631872838602cb/src/compiler/checker.ts#L26690-L26738"

### 逐段讲解

- `inferTypes` 接收 inference records、source、target、priority 和 contravariant 标记，说明推断是关系过程，不是把一个字符串替换成另一个字符串。
- `inferFromTypes` 先判断 target 是否可能包含 type variables，再沿 alias、union 和复合类型递归收集候选。
- source/target 的位置关系决定候选方向；函数参数位置可能是 contravariant，不能把每个出现位置当成同一权重。
- 真实 checker 还处理 priority、template literal、variances、defaults、constraints 和 no-infer barrier；mini-checker 逐项标注省略边界。
- inference record 与最后的 instantiate 必须分开，这样约束失败可以在代入前报告，而不是生成一个错误类型后再猜原因。

### 源码节选

```typescript
// TypeScript v5.9.3，src/compiler/checker.ts
function inferTypes(
    inferences: InferenceInfo[],
    originalSource: Type,
    originalTarget: Type,
    priority = InferencePriority.None,
    contravariant = false,
) {
    let bivariant = false;
    let propagationType: Type;
    let inferencePriority = InferencePriority.MaxValue;
    inferFromTypes(originalSource, originalTarget);

    function inferFromTypes(source: Type, target: Type): void {
        if (!couldContainTypeVariables(target) || isNoInferType(target)) {
            return;
        }
        if (source === wildcardType || source === blockedStringType) {
            propagationType = source;
            inferFromTypes(target, target);
            return;
        }
        if (source.aliasSymbol && source.aliasSymbol === target.aliasSymbol) {
            // 真实实现继续递归比较 alias type arguments。
        }
    }
}
```

## 导读

调用 `first(42)` 时，人类会自然地把 `T` 想成 number；调用 `pair("id", 3)` 时，推断器必须知道两个参数约束如何汇合；调用 `get("id")` 时，没有实参能提供 T，系统必须选择显式类型参数、默认值或失败。推断的本质是“从已知类型反推出未知变量”，而不是让返回值凭空决定输入。

本课用 `TypeVar` 表示待求解变量，用 candidate list 保存约束，用 variance 标记区分正向和反向位置。核心心智模型是一个小型约束求解器：先收集事实，再选择一个满足事实的类型，最后替换 type variable。它能预测一个反例：若只记录最后一个候选，`pair("id", 3)` 会悄悄丢掉前一个约束；若忽略函数参数逆变，回调推断可能选择过窄类型。

本课承接 `typescript-12-01` 的 Type AST 与 `12-02` 的关系判定，使用 `12-03` 的窄化类型作为普通输入；`12-05` 会把 inference failure 变成带位置的 Diagnostic。

## 分章正文

### 从 identity 的成功与缺失开始

kicker: "01 · OBSERVE"

`identity(42)` 的输入类型 number 给出 T=number，返回类型也被代入为 number。`identity()` 没有候选，若没有默认值或显式类型参数，就不能凭空选择。两个现象共同说明 inference 的输入边界必须被记录。

#### 本章结论

推断需要从调用点收集候选；缺少候选时必须走默认值、显式参数或失败策略。

### TypeVar 与约束记录

kicker: "02 · MODEL"

mini-checker 的 `TypeVar("T", constraint=unknown, default=none)` 保存变量名、约束上限、默认值和候选。`inferFrom(source, pattern)` 只负责收集，不直接返回最终 Type。每一条 candidate 同时带来源路径和 variance，后续可以解释冲突。

#### 代码

```javascript
const T = name => ({ kind: "typevar", name })
const P = name => ({ kind: "primitive", name })
const fn = (params, returns) => ({ kind: "function", params, returns })
const record = variable => ({ variable, candidates: [], constraints: [], defaultType: null })

const info = record(T("T"))
info.candidates.push({ type: P("number"), path: "arg0", variance: "covariant" })
console.assert(info.candidates[0].path === "arg0")
```

#### 本章结论

候选记录的 path 还承担审计职责：当两个参数提供冲突类型时，报告可以告诉用户冲突来自 arg0 和 arg1，而不是只显示一个抽象的“不能推断 T”。这也是为什么真实实现保存 InferenceInfo，而不是在递归函数里直接返回一个 Type。先保存证据，再选择结果，才能让推断器被单测和调试器观察。

候选记录必须携带来源和方向；收集阶段不应提前覆盖候选或生成最终类型。

### 沿 Type AST 找到 type variable

kicker: "03 · COLLECT"

对 pattern `Array<T>` 与 source `Array<number>`，推断器把对应 type argument 配成 T→number。对 `{ value: T }` 与 `{ value: string }`，则沿 object property 递归。若 target 中没有 type variable，递归可以停止；这正是上游 `couldContainTypeVariables` 检查的价值。

联合类型和函数类型需要额外规则：联合 target 可能先选择可匹配分支，函数参数位置通常反向收集。mini 版本只实现 named object 和同长度 tuple，避免把“递归”误写成“任意类型都能推断”。

#### 代码

```javascript
function collect(source, pattern, info, path = "root", variance = "covariant") {
  if (pattern.kind === "typevar") {
    info.candidates.push({ type: source, path, variance })
    return
  }
  if (pattern.kind === "object" && source.kind === "object") {
    for (const [name, child] of pattern.properties) {
      const actual = source.properties.get(name)
      if (actual) collect(actual, child, info, `${path}.${name}`, variance)
    }
  }
}

const source = { kind: "object", properties: new Map([["value", { kind: "primitive", name: "string" }]]) }
const pattern = { kind: "object", properties: new Map([["value", T("T")]]) }
const info = record(T("T")); collect(source, pattern, info)
console.assert(info.candidates[0].type.name === "string")
```

#### 本章结论

推断沿 source/target 的结构对齐收集候选；没有 type variable 的分支可以停止，无法对齐的结构必须保留失败证据。

### 多候选的合并与冲突

kicker: "04 · SOLVE"

`combine("id", 3)` 可能让 T 收集到 string 与 number。合并策略取决于参数位置和函数签名：有的 API 选择 union，有的需要同一 T 而报告冲突，有的使用上下界求一个共同类型。mini-checker 把策略设为显式 `union` 或 `same`，不隐藏在最后一次赋值里。

如果一个 candidate 来自 contravariant 位置，取值域的方向可能改为求共同上界；这与上一课的函数参数逆变相连。只有 candidate 合并完成、约束检查通过后，才能 instantiate。

#### 本章结论

多候选不是简单覆盖；合并策略和 variance 必须写进推断合同，并对冲突给出失败。

### 约束、默认值与显式类型参数

kicker: "05 · BOUNDARY"

`T extends { id: number }` 不是一个候选，而是候选必须满足的上限。候选不满足约束时应返回 constraint failure；没有候选时才能考虑 default；调用者写出 `<string>` 时则跳过推断但仍要检查显式类型参数是否满足约束。

把默认值当作“推断成功”会掩盖调用者没有提供信息的事实。诊断应区分 `no-candidate`、`constraint-mismatch` 与 `explicit-argument-invalid`，它们的修复方向不同。

#### 本章结论

约束检查也必须使用前一课的 relation，而不是比较 type name。`T extends { id: number }` 的候选可能是一个结构更大的 object；只要它提供 id:number，就应当通过这个约束。反过来，primitive 名称恰好相同并不代表所有 object constraint 都满足。推断器因此要调用关系层，不能自行复制第二套兼容性规则。

候选、约束、默认值和显式参数是四种不同输入；约束检查发生在选择之后，默认值只填补信息缺口。

### instantiate：把 TypeVar 替换回结果

kicker: "06 · INSTANTIATE"

求解得到 `{ T: number }` 后，`Box<T>` 通过 substitution 生成 `Box<number>`，返回类型和后续关系检查都消费这个具体 Type。替换必须递归穿过 union、object、function 和 tuple；未求解的 TypeVar 不能偷偷变成 string。

#### 代码

```javascript
function substitute(type, solution) {
  if (type.kind === "typevar") return solution.get(type.name) ?? type
  if (type.kind === "function") return {
    kind: "function",
    params: type.params.map(item => substitute(item, solution)),
    returns: substitute(type.returns, solution)
  }
  return type
}
const result = substitute(fn([T("T")], T("T")), new Map([["T", P("number")]]))
console.assert(result.params[0].name === "number")
console.assert(result.returns.name === "number")
```

#### 本章结论

instantiate 是独立阶段；解出的 Type 要递归代入结果结构，未解变量必须保持可见或报告失败。

### 失败路径：反向推断与无信息调用

kicker: "07 · FAILURE"

如果只从返回值反推 T，函数 `make(): T` 会让 checker 任意选择类型，形成不可靠的“猜测”。如果同一 T 同时出现在输入和输出，输入约束优先建立事实，返回位置只用于检查结果一致性。`noInfer` 一类屏障的存在也说明并非所有 type variable 出现都应该贡献候选。

mini-checker 对没有输入候选的 T 返回 `no-candidate`；对冲突候选返回 `conflict`；对约束不满足返回 `constraint-mismatch`。失败被结构化保存，下一课再用源代码位置和参数名格式化。

#### 本章结论

推断不能靠返回值猜输入；无信息、冲突和违反约束必须是不同失败类别。

### 工程取舍：精确推断与可预测 API

kicker: "08 · ENGINEERING"

更强的推断能减少调用者注解，却带来更多优先级、上下界、variance 和缓存状态；API 设计可以通过让 T 出现在输入参数、减少冲突位置和提供 default 来提高可预测性。对公共库，宁可明确拒绝一个歧义调用，也不要依赖隐藏的最后候选。

真实 TypeScript 还支持 overload、contextual typing、mapped/conditional/template literal 类型和跨调用点的 inference priority。mini-checker 的价值在于把“候选从哪里来、何时选定、为什么失败”暴露出来，不在于复制所有语言特性。

判断一次推断是否值得自动完成，还要看 API 的公开承诺。一个函数如果让同一个 T 同时出现在两个互相独立的输入位置，调用者往往希望它们保持同一类型；如果 API 的真实意图是接收不同类型并返回联合结果，就应该显式写出两个类型参数或 union，而不是依赖求解器猜测。对学习者而言，这个设计边界比记住某个优先级常数更重要：推断器是调用合同的执行者，调用合同含糊时，最精确的算法也只能报告含糊。

版本边界同样要记录。TypeScript 的推断行为可能随新语法和 checker 重构变化，课程示例固定在 v5.9.3 的源码证据，示例本身只实现稳定的最小规则；阅读者升级 compiler 后应重新运行正常与失败断言，并把差异标为版本变化，而不是把旧行号或旧错误文案当成永恒事实。

#### 本章结论

泛型 API 的可用性取决于候选位置和冲突规则；推断能力越强，测试和诊断合同也越重。

## 核心机制

- TypeVar 是待求解变量，InferenceInfo 保存候选、来源、约束和方向。
- inferFromTypes 沿 source/target 结构对齐收集候选，目标没有变量时可以停止。
- 多候选通过 union、共同上界或冲突策略合并，variance 会改变合并方向。
- 约束检查、默认值和显式类型参数分别承担不同角色。
- instantiate 把 solution 递归代入结果；失败要区分 no-candidate、conflict 和 constraint mismatch。

## 常见误区

- 把推断当成字符串替换，忽略 Type AST 中的多个出现位置。
- 只保留最后一个 candidate，使多参数调用结果依赖遍历顺序。
- 把约束当作默认值，候选不满足时仍生成一个看似合理的类型。
- 从返回值任意反推输入，导致无信息调用静默通过。
- 把 TypeScript 内部所有优先级和 variance 规则复制成没有测试的黑箱。

## 实现变体

### 变体 A：显式候选列表求解

useWhen: "教学、代码生成和需要把冲突展示给使用者的工具。"
tradeoff: "每条证据可追踪、失败可解释；候选列表与合并策略需要显式管理。"

#### 代码

```javascript
function solveSame(info) {
  const names = new Set(info.candidates.map(item => item.type.name))
  return names.size === 1 ? info.candidates[0].type : { kind: "error", reason: "conflict" }
}
const info = { candidates: [{ type: { name: "number" } }, { type: { name: "number" } }] }
console.assert(solveSame(info).name === "number")
```

### 变体 B：上下界约束求解

useWhen: "函数参数反向位置或需要表达共同上界的 API。"
tradeoff: "能处理更多签名，但上下界、variance 和类型关系耦合，错误解释成本更高。"

#### 代码

```javascript
function solveUnion(info) {
  return { kind: "union", members: [...new Map(info.candidates.map(item => [item.type.name, item.type])).values()] }
}
const union = solveUnion({ candidates: [{ type: { name: "string" } }, { type: { name: "number" } }] })
console.assert(union.members.length === 2)
```

## 可运行示例

```javascript
const assert = (value, message) => { if (!value) throw new Error(message) }
const P = name => ({ kind: "primitive", name })
const V = name => ({ kind: "typevar", name })
const record = (variable, constraint = null, defaultType = null) => ({ variable, candidates: [], constraint, defaultType })

function collect(source, pattern, info, path = "arg") {
  if (pattern.kind === "typevar") {
    info.candidates.push({ type: source, path })
    return
  }
  if (pattern.kind === "object" && source.kind === "object") {
    for (const [name, child] of pattern.properties) {
      const actual = source.properties.get(name)
      if (actual) collect(actual, child, info, `${path}.${name}`)
    }
  }
}

function solve(info, mode = "same") {
  if (!info.candidates.length) return info.defaultType ?? { kind: "error", reason: "no-candidate" }
  const unique = [...new Map(info.candidates.map(item => [item.type.name, item.type])).values()]
  if (mode === "same" && unique.length > 1) return { kind: "error", reason: "conflict" }
  const chosen = mode === "union" && unique.length > 1 ? { kind: "union", members: unique } : unique[0]
  if (info.constraint && chosen.kind === "primitive" && chosen.name !== info.constraint.name) {
    return { kind: "error", reason: "constraint-mismatch" }
  }
  return chosen
}

const T = V("T")
const info = record(T)
collect(P("number"), T, info)
assert(solve(info).name === "number", "one candidate solves T")

const pairInfo = record(V("T"))
collect(P("string"), V("T"), pairInfo, "arg0")
collect(P("number"), V("T"), pairInfo, "arg1")
assert(solve(pairInfo).reason === "conflict", "same-mode conflict remains visible")
assert(solve(pairInfo, "union").kind === "union", "union mode preserves both candidates")

const constrained = record(V("T"), P("number"))
collect(P("string"), V("T"), constrained)
assert(solve(constrained).reason === "constraint-mismatch", "constraint failure is distinct")

const missing = record(V("T"), null, P("unknown"))
assert(solve(missing).name === "unknown", "default fills missing evidence")
console.log("typescript-12-04: PASS")
```

## 搭积木复现

### 积木 1：表示 TypeVar 与 inference record

保存变量名、候选数组、constraint、default；给每条候选加 path。先验证重复 candidate 不会被最后一次覆盖。

### 积木 2：实现 primitive pattern 收集

将 source primitive 与 pattern TypeVar 配对，记录 covariant；没有 TypeVar 的 target 直接停止并返回无候选证据。

### 积木 3：实现 object 递归收集

让 `{ value: T }` 对齐 `{ value: number }`，加入缺少属性的失败；将 path 传递到下一层。

### 积木 4：实现 same 与 union 求解

same 模式要求唯一类型，union 模式保留多个成员；用相同调用点验证两种公开合同的差异。

### 积木 5：加入 constraint 与 default

候选选择后检查约束，没有候选时才使用默认值；分别断言 constraint-mismatch 与 no-candidate/default。

### 积木 6：实现 instantiate

写 substitution 递归替换 function、object 和 union 中的 TypeVar，验证返回类型与参数类型都变成具体 Type。

### 积木 7：对照上游 inferTypes

将 mini 的收集、candidate、variance 与 v5.9.3 `inferTypes`/`inferFromTypes` 对照；记录生产实现的 priority、alias、template literal、no-infer 与 type argument defaults。

## 自检

### 问题

对 `pair<T>(left: T, right: T): T` 调用 `pair("id", 3)`，为什么“取最后一个候选”不是合法推断？请分别说明 same、union、constraint 三种策略，以及 TypeScript checker 的 `inferTypes` 如何证明推断是结构关系而非字符串替换。

### 站内答案

结论：最后一次候选依赖遍历顺序，不能代表两个输入的共同合同。机制：同一个 T 在两个参数位置收集到 string 与 number；same 策略报告 conflict，union 策略显式返回 string|number，若 T 有约束则先选择再检查 constraint，默认值只处理 no-candidate。源码证据：v5.9.3 `inferTypes` 接收 source/target、priority 和 contravariant，并由 `inferFromTypes` 沿 type variable、alias、union 等结构递归；这说明它收集关系证据，而非替换文本。验证方法：运行示例，same 返回 conflict，union 返回 union，string 对 number 约束返回 constraint-mismatch。取舍：same 更可预测，union 更宽但可能扩散类型；真实 TypeScript 还加入 inference priority、variance、contextual typing、overload 和 no-infer 边界。适用边界：本课只实现 primitive/object 的最小推断，未覆盖 conditional、mapped、template literal 和完整签名实例化。

## 更新日志

### 建立 mini-checker 的泛型推断课程

at: "2026-08-04T09:50:10+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "Codex Desktop · GPT-5.6 luna"
summary: "新增候选收集、same/union 求解、约束与默认值、instantiate 失败路径及 flow 视觉索引。"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/38"
