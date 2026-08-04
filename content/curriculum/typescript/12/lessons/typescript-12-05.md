---
id: "typescript-12-05"
track: "typescript"
title: "mini-checker 的错误报告与诊断：精确定位源码位置并给出可操作信息"
depth: "deep"
visualIndex: "../visuals/typescript-12-05.md"
exampleLanguage: "javascript"
readingMinutes: 25
sourceMinutes: 15
practiceMinutes: 15
reviewMinutes: 5
---

## 官方入口

title: "Using the Compiler API · A minimal compiler"
url: "https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API#a-minimal-compiler"

官方最小编译器示例创建 `Program`，合并 `getPreEmitDiagnostics` 与 emit 诊断，并用 `file`、`start`、`getLineAndCharacterOfPosition` 与 `messageText` 输出位置化错误。本课以这条公开 API 链为边界，构建不会伪装成完整 tsc 的诊断器。

## 真实源码

repo: "microsoft/TypeScript"
file: "src/compiler/program.ts; src/compiler/checker.ts; src/compiler/types.ts; src/compiler/programDiagnostics.ts"
symbol: "getPreEmitDiagnostics; error; Diagnostic; DiagnosticMessageChain; createDiagnosticExplainingFile"
language: "typescript"
url: "https://github.com/microsoft/TypeScript/blob/c63de15a992d37f0d6cec03ac7631872838602cb/src/compiler/program.ts#L634-L643"

### 逐段讲解

- `getPreEmitDiagnostics` 按配置、选项、语法、全局和语义诊断依次合并，说明“一个红线”背后可能有多种阶段来源。
- checker 的 `error` 先把 Node 转成 Diagnostic，再放入 diagnostics collection；诊断生成和关系算法的失败原因可以分开组织。
- `Diagnostic` 携带 category、code、file、start、length、messageText 和 relatedInformation；仅保存字符串会失去编辑器和自动修复所需的范围。
- `DiagnosticMessageChain` 表示分层解释，适合把“属性不存在”与“期望类型/实际类型”组合成主消息和 related messages。
- `programDiagnostics.ts` 还能解释文件被纳入 program 的原因；mini-checker 不实现 project graph，但要保留“来源阶段”字段。

### 源码节选

```typescript
// TypeScript v5.9.3，src/compiler/program.ts
export function getPreEmitDiagnostics(program: Program, sourceFile?: SourceFile): readonly Diagnostic[] {
    let diagnostics: Diagnostic[] | undefined;
    diagnostics = addRange(diagnostics, program.getConfigFileParsingDiagnostics());
    diagnostics = addRange(diagnostics, program.getOptionsDiagnostics());
    diagnostics = addRange(diagnostics, program.getSyntacticDiagnostics(sourceFile));
    diagnostics = addRange(diagnostics, program.getGlobalDiagnostics());
    diagnostics = addRange(diagnostics, program.getSemanticDiagnostics(sourceFile));
    return diagnostics || emptyArray;
}

// src/compiler/checker.ts
function error(location: Node | undefined, message: DiagnosticMessage, ...args: DiagnosticArguments): Diagnostic {
    const diagnostic = createError(location, message, ...args);
    diagnostics.add(diagnostic);
    return diagnostic;
}

// src/compiler/types.ts
export interface DiagnosticRelatedInformation {
    category: DiagnosticCategory;
    code: number;
    file: SourceFile | undefined;
    start: number | undefined;
    length: number | undefined;
    messageText: string | DiagnosticMessageChain;
}
```

## 导读

用户看到 `Type 'string' is not assignable to type 'number'`，真正需要的通常还有文件、行列、错误码、源类型、目标类型和修复方向。若 checker 只返回一个字符串，编辑器无法选中错误范围，聚合器也无法区分 parser failure、config failure 和 semantic failure。

本课把诊断看成一条数据管线：关系算法产生结构化 failure，诊断层绑定 Node span，格式化层转换 line/column 和 message chain，批处理层按阶段聚合。核心模型是“诊断是带证据位置的值，不是日志副作用”。它能预测一个工程反例：同一错误在一次 run 中重复产生时，若没有稳定 key，用户会看到成倍红线；若把多个阶段混成一个列表，修复顺序会被误导。

本课承接前四课的 Type AST、关系、窄化与推断失败；下一课 `12-06` 才把 parse、check、report 串成一个完整命令。

## 分章正文

### 从“报错了”进入：三个最小诊断

kicker: "01 · OBSERVE"

括号不完整是 syntactic，`strict` 选项不合法是 options，`string` 不能赋给 `number` 是 semantic。三者都可以出现在同一个 Program 的诊断结果里，却需要不同修复入口。最小报告至少包含 stage、message、file、start 和 length。

#### 本章结论

诊断阶段是证据的一部分；先分类，再格式化，不能只记录一段错误文本。

### Node span 如何变成行列

kicker: "02 · SPAN"

AST 节点保存字符位置，诊断保存 start/length。行列是展示层的派生值，应从 source text 的换行表计算，不能在 checker 内到处拼接。对 UTF-16 code unit、CRLF 和行尾位置的处理要遵守所用运行时合同。

#### 代码

```javascript
function lineAndColumn(text, offset) {
  const before = text.slice(0, offset)
  const lines = before.split(/\r?\n/)
  return { line: lines.length, column: lines.at(-1).length + 1 }
}
const source = "let x = \"oops\"\nconst y = x"
const point = lineAndColumn(source, source.indexOf("x", 10))
console.assert(point.line === 2)
console.assert(point.column === 11)
```

#### 本章结论

start/length 是机器证据，line/column 是可读派生值；同一个 span 应在所有输出格式中保持一致。

### Diagnostic 的数据模型

kicker: "03 · MODEL"

mini-checker 使用 `{ stage, code, category, file, start, length, messageText, relatedInformation }`。主 message 说明直接失败，related information 携带期望/实际类型、约束来源或建议。category 可以分 error、warning、suggestion，不能通过颜色决定严重性。

诊断对象应尽量不可变，并由稳定的 key 去重。key 可以由 stage、file、start、length、code 和展开后的 message 组成；同一代码位置出现两种独立错误时不应过度去重。

#### 本章结论

诊断是可测试的数据结构；范围、码、阶段、等级和关系证据都要保留。

### 错误产生与格式化分离

kicker: "04 · SEPARATE"

前一课的 assignability 返回 `{ reason, path, source, target }`，本课的 `makeDiagnostic` 把 path 映射到具体 Node。这样关系算法可以被单测，格式化器也能独立处理颜色、JSON、plain text 和 editor protocol。

真实 checker 的 `error(location, message, ...args)` 负责把定位节点转换为 Diagnostic 并放入 collection；它不是 `console.error`。如果生成函数直接写日志，批处理无法聚合、测试无法断言、编辑器也没有范围。

#### 代码

```javascript
function makeDiagnostic(failure, node, sourceFile) {
  return Object.freeze({
    stage: "semantic",
    category: "error",
    code: 2322,
    file: sourceFile,
    start: node.start,
    length: node.length,
    messageText: `${failure.actual} is not assignable to ${failure.expected}`,
    relatedInformation: [{ messageText: failure.path.join("."), start: node.start }]
  })
}
const diag = makeDiagnostic({ actual: "string", expected: "number", path: ["value"] }, { start: 4, length: 1 }, "main.ts")
console.assert(diag.file === "main.ts" && diag.start === 4)
```

#### 本章结论

错误产生与诊断格式化应解耦；定位由 Node 提供，关系证据由 checker 提供，输出格式由 presentation 层决定。

### message chain 与可操作建议

kicker: "05 · MESSAGE"

复杂错误往往需要主句和子句：`Argument of type string is not assignable...` 下方再说明参数位置、约束和候选类型。DiagnosticMessageChain 用 next 表示层级；formatter 应保留层级，不能把所有文本拼成没有结构的长句。

建议应绑定证据，例如“为调用传入 number”或“提供显式类型参数”，不能在没有分析依据时生成泛化建议。建议本身可以是 suggestion category，不能冒充已经验证的修复。

#### 本章结论

message chain 承载因果层级；可操作建议必须来自具体失败证据，并与 error/warning 分开。

### 分阶段聚合与去重

kicker: "06 · AGGREGATE"

官方 `getPreEmitDiagnostics` 将配置、选项、语法、全局、语义结果依次合并。mini-checker 可用数组模拟，但应保留阶段顺序，并用 Map 去除完全重复的 key。若语义检查依赖 parse 成功，parser failure 可以让后续语义阶段跳过，不能把“没有语义结果”误报为通过。

#### 代码

```javascript
function collectDiagnostics(groups) {
  const result = []
  const seen = new Set()
  for (const group of groups) {
    for (const diagnostic of group) {
      const key = [diagnostic.stage, diagnostic.file, diagnostic.start, diagnostic.code].join(":")
      if (!seen.has(key)) { seen.add(key); result.push(diagnostic) }
    }
  }
  return result
}
const one = { stage: "semantic", file: "a.ts", start: 1, code: 2322 }
console.assert(collectDiagnostics([[one], [one]]).length === 1)
```

#### 本章结论

诊断聚合保留阶段顺序并按稳定证据去重；前置阶段失败时要明确跳过策略。

### 失败路径：无文件位置与 detached diagnostic

kicker: "07 · FAILURE"

配置错误可能没有一个用户源文件节点，global diagnostic 也可能只有文件名或没有 start。公共 `DiagnosticRelatedInformation` 允许 `file`、`start` 和 `length` 为空；formatter 必须先处理这种 detached 情况，不能访问空文件导致二次崩溃。

另一个边界是错误恢复：parser 可能创建 missing node，位置范围并不代表用户写了一个真实 token。课程工具要展示 `synthetic` 或 `recovered` 标记，避免把恢复节点当作精确语法证据。

#### 本章结论

诊断位置可以缺失或来自恢复节点；缺失位置也是可观察状态，格式化器必须安全处理。

### 工程取舍：人类文本、JSON 与编辑器协议

kicker: "08 · ENGINEERING"

plain text 适合命令行，JSON 适合 CI，LSP/编辑器协议需要范围、severity、relatedInformation 和稳定 code。核心 Diagnostic 不应夹带颜色和终端控制符；不同 formatter 消费同一结构。

生产 tsc 还要处理 localization、链式消息、related information、suppressions、incremental diagnostics 和 watch 失效。mini-checker 只实现确定性的内存数组，但要求示例覆盖正常无诊断、单错误、重复错误和无位置错误。

#### 本章结论

把诊断核心与输出媒介分离，既能服务终端也能服务编辑器；精度取决于 span 与来源证据，漂亮文案不能替代它们。

## 核心机制

- Program 按阶段聚合 diagnostics；语法、配置、全局和语义错误有不同来源。
- Diagnostic 保存 category、code、file、start、length、messageText 与 related information。
- Node span 是机器定位证据，line/column 和字符串是派生展示。
- checker 的 error 负责把失败绑定到 Node 并进入 collection，不直接写日志。
- message chain、去重 key 和 detached location 决定错误是否可解释、可编辑和可稳定回归。

## 常见误区

- 把所有失败都拼成字符串，丢掉 stage、code 和 range。
- 把 line/column 当作 checker 的原始真相，忽略 start/length 才是统一机器证据。
- 看到同一个 code 就全部去重，掩盖不同文件和不同位置的错误。
- 诊断生成函数直接 `console.error`，让 JSON、编辑器和单测无法复用。
- 对无 file 的配置错误直接访问 sourceFile，导致错误处理器再次崩溃。

## 实现变体

### 变体 A：稳定结构 + 多 formatter

useWhen: "命令行、CI 和编辑器需要消费同一批诊断时。"
tradeoff: "核心数据可测试、输出可替换；需要为每种 formatter 定义缺失字段和链式消息规则。"

#### 代码

```javascript
const formatPlain = d => `${d.file ?? "<config>"}:${d.start ?? 0} ${d.code} ${d.messageText}`
const formatJson = d => JSON.stringify(d)
const diagnostic = { file: "a.ts", start: 3, code: 2322, messageText: "type mismatch" }
console.assert(formatPlain(diagnostic).startsWith("a.ts:3"))
console.assert(formatJson(diagnostic).includes("2322"))
```

### 变体 B：诊断 builder 与 related chain

useWhen: "错误需要逐步添加期望/实际类型、调用栈或修复建议。"
tradeoff: "构造过程能保留因果链；builder 生命周期更复杂，必须防止重复 add 和共享可变数组。"

#### 代码

```javascript
function diagnosticBuilder(file, start, code) {
  const children = []
  return {
    add(messageText) { children.push({ messageText }); return this },
    build(messageText) { return Object.freeze({ file, start, code, messageText, next: [...children] }) }
  }
}
const built = diagnosticBuilder("a.ts", 2, 2322).add("actual: string").add("expected: number").build("assignment failed")
console.assert(built.next.length === 2)
```

## 可运行示例

```javascript
const assert = (value, message) => { if (!value) throw new Error(message) }

function lineAndColumn(text, offset) {
  const lines = text.slice(0, offset).split(/\r?\n/)
  return { line: lines.length, column: lines.at(-1).length + 1 }
}

function makeDiagnostic({ stage, code, category = "error", file, start, length, messageText, relatedInformation = [] }) {
  return Object.freeze({ stage, code, category, file, start, length, messageText, relatedInformation })
}

function collect(groups) {
  const result = []
  const seen = new Set()
  for (const group of groups) {
    for (const diagnostic of group) {
      const key = [diagnostic.stage, diagnostic.file, diagnostic.start, diagnostic.code, diagnostic.messageText].join(":")
      if (!seen.has(key)) { seen.add(key); result.push(diagnostic) }
    }
  }
  return result
}

const text = "const count: number = \"oops\"\n"
const start = text.indexOf("\"oops\"")
const semantic = makeDiagnostic({
  stage: "semantic", code: 2322, file: "main.ts", start, length: 6,
  messageText: "Type 'string' is not assignable to type 'number'.",
  relatedInformation: [{ messageText: "assignment target", start: text.indexOf("count") }]
})
const detached = makeDiagnostic({
  stage: "options", code: 6046, file: undefined, start: undefined, length: undefined,
  messageText: "Compiler option is not supported."
})
const diagnostics = collect([[semantic], [semantic, detached]])
assert(diagnostics.length === 2, "identical diagnostics are deduplicated")
assert(lineAndColumn(text, semantic.start).line === 1, "span converts to line/column")
assert(diagnostics.find(item => item.file === undefined), "detached diagnostic is retained")
assert(diagnostics.every(item => item.code && item.stage), "diagnostic keeps machine fields")

console.log(`${diagnostics[0].file}:${lineAndColumn(text, diagnostics[0].start).column}: ${diagnostics[0].messageText}`)
console.log("typescript-12-05: PASS")
```

## 搭积木复现

### 积木 1：定义 Diagnostic

加入 stage、category、code、file、start、length、messageText；先验证正常语义错误和无 file 的 options 错误都能表达。

### 积木 2：从 span 计算行列

处理 LF 与 CRLF，固定 offset 的 line/column 断言；展示层永远从 span 计算，不在算法中缓存重复字符串。

### 积木 3：把关系失败绑定到 Node

沿用上一课的 path/reason，将 Node 的 start/length 和 source/target 写入 relatedInformation；验证错误位置在最小失败节点。

### 积木 4：实现 message chain

主消息说明结论，子消息说明 actual、expected 和路径；formatter 保留 next 层级，避免把因果链压扁。

### 积木 5：分阶段聚合

按 config/options/syntax/global/semantic 顺序合并；写一个 parser failure 时跳过 semantic 的测试，并记录跳过原因。

### 积木 6：实现稳定去重

用 stage/file/start/code/message 构造 key，重复 add 不增加数量；对同 code 不同位置保持两条诊断。

### 积木 7：对照上游 Program 与 checker

把 `getPreEmitDiagnostics` 的阶段合并、checker `error` 的 Node 绑定、Diagnostic 字段和 message chain 对照，列出 localization、watch、related info 与恢复节点的生产边界。

## 自检

### 问题

为什么诊断对象必须保留 `file/start/length/code/category`，而不能只保留 `messageText`？当一个配置错误没有 file 时，formatter 应如何工作？请同时引用 `getPreEmitDiagnostics`、checker 的 `error` 和 `DiagnosticRelatedInformation`。

### 站内答案

结论：messageText 只适合人读，位置、码、等级和阶段才让诊断可定位、可聚合、可被编辑器消费。机制：关系失败绑定到 Node 生成 file/start/length，code/category 供稳定回归和展示策略使用，relatedInformation 保留期望/实际类型等因果证据；无 file 时保留 undefined，用 `<config>` 或全局标签格式化，不能访问空 sourceFile。源码证据：v5.9.3 `getPreEmitDiagnostics` 依次合并 config/options/syntax/global/semantic 诊断；checker `error(location, message)` 调 `createError` 后放入 collection；`DiagnosticRelatedInformation` 明确允许 file/start/length 为空并支持 message chain。验证方法：运行示例，重复诊断被稳定 key 去重，semantic span 转成 line/column，detached options 诊断仍保留。取舍：结构化对象支持 plain/JSON/editor 多 formatter，但需要字段和去重合同；字符串实现快，却无法安全处理同码多位置和自动修复。边界：本课没有实现完整 parser recovery、localization、watch invalidation 和 LSP 转换。

## 更新日志

### 建立 mini-checker 的诊断课程

at: "2026-08-04T09:50:10+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "Codex Desktop · GPT-5.6 luna"
summary: "新增诊断数据模型、源码 span、分阶段聚合、related information、去重与 flow 视觉索引。"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/38"
