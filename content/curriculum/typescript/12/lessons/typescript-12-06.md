---
id: "typescript-12-06"
track: "typescript"
title: "mini-checker 的全体组装：从 parse→check→report 的完整管线"
depth: "deep"
visualIndex: "../visuals/typescript-12-06.md"
exampleLanguage: "javascript"
readingMinutes: 40
sourceMinutes: 30
practiceMinutes: 35
reviewMinutes: 15
---

## 官方入口

title: "Using the Compiler API · A minimal compiler"
url: "https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API#a-minimal-compiler"

官方最小编译器示例把 <code>createProgram</code>、<code>program.emit()</code>、<code>getPreEmitDiagnostics</code> 和位置化格式化串成一条公开入口；同一页的 [Type Checker APIs](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API#type-checker-apis) 解释 <code>Program</code>、<code>Symbol</code>、<code>Type</code> 和 <code>getTypeChecker()</code> 的职责。该 Wiki 明确提醒 Compiler API 仍可能演化，因此本课只把这些公开调用当作 v5.9.3 的观察入口，不把内部对象字段当作跨版本稳定合同。

官方入口约束的是“如何从根文件建立 Program、取得阶段诊断并格式化结果”，没有承诺我们写的 mini-checker 覆盖完整 TypeScript 语法、模块解析、增量构建或 emit。本课的目标是复现一条可测试的 <code>parse → bind → check → report</code> 数据管线，并把省略的生产保证写在边界处。

## 真实源码

repo: "microsoft/TypeScript"
file: "src/compiler/program.ts; src/compiler/parser.ts; src/compiler/binder.ts; src/compiler/checker.ts; src/compiler/types.ts; src/compiler/programDiagnostics.ts"
symbol: "createProgram; parseSourceFile; bindSourceFile; bind; error; getPreEmitDiagnostics; DiagnosticRelatedInformation; createProgramDiagnostics"
language: "typescript"
url: "https://github.com/microsoft/TypeScript/blob/c63de15a992d37f0d6cec03ac7631872838602cb/src/compiler/program.ts#L1499-L1526"

本课统一使用 TypeScript v5.9.3 tag 对应的 commit <code>c63de15a992d37f0d6cec03ac7631872838602cb</code>。关键证据入口如下：

- [parseSourceFile](https://github.com/microsoft/TypeScript/blob/c63de15a992d37f0d6cec03ac7631872838602cb/src/compiler/parser.ts#L1587-L1615) 按文件名确定脚本种类，再初始化解析状态、调用 worker、清理状态并返回 <code>SourceFile</code>。
- [bindSourceFile 与 bind](https://github.com/microsoft/TypeScript/blob/c63de15a992d37f0d6cec03ac7631872838602cb/src/compiler/binder.ts#L510-L515) 和 [bind](https://github.com/microsoft/TypeScript/blob/c63de15a992d37f0d6cec03ac7631872838602cb/src/compiler/binder.ts#L2730-L2782) 把 AST 节点送入 binder，并把声明放入 exports、members 或 locals 表。
- [checker.error](https://github.com/microsoft/TypeScript/blob/c63de15a992d37f0d6cec03ac7631872838602cb/src/compiler/checker.ts#L2496-L2505) 把节点位置和诊断消息交给 <code>createError</code>，再加入诊断集合。
- [getPreEmitDiagnostics](https://github.com/microsoft/TypeScript/blob/c63de15a992d37f0d6cec03ac7631872838602cb/src/compiler/program.ts#L631-L643) 按配置、选项、语法、全局、语义和必要的声明阶段合并并去重诊断。
- [DiagnosticRelatedInformation](https://github.com/microsoft/TypeScript/blob/c63de15a992d37f0d6cec03ac7631872838602cb/src/compiler/types.ts#L7197-L7204) 允许关联信息没有 <code>file</code>、<code>start</code> 或 <code>length</code>，所以 formatter 必须处理 detached diagnostic。
- [createProgramDiagnostics](https://github.com/microsoft/TypeScript/blob/c63de15a992d37f0d6cec03ac7631872838602cb/src/compiler/programDiagnostics.ts#L88-L104) 保存 Program 级文件纳入和配置诊断状态，说明生产实现还要维护项目图与复用边界。

### 逐段讲解

- <code>createProgram</code> 的公开合同把 root files、compiler options、host、old program 和配置诊断组合成一个 <code>Program</code>；实现先规范化参数，再建立文件、checker 和 <code>programDiagnostics</code> 状态。mini-checker 用一个不可变的 <code>ParsedProgram</code> 对应它，省略 host、模块闭包和增量复用。
- <code>parseSourceFile</code> 的主路径有“确定脚本种类 → 初始化状态 → 解析 worker → 清理状态”的资源边界。mini-parser 也必须在返回前把源文本和节点范围保存下来，不能让后续诊断依赖已经销毁的临时扫描器。
- <code>bindSourceFile</code> 只是 binder 的外层计时包装；递归的 <code>bind</code> 决定声明进入哪个 symbol table。mini-binder 用一个 scope 栈表达同样的所有权关系：进入 block 推入表，离开 block 弹出表，内层同名声明不能覆盖外层身份。
- checker 的 <code>error</code> 返回一个 Diagnostic 并写入 collection，而非直接 <code>console.error</code>。mini-checker 的 <code>makeDiagnostic</code> 也只创建值，最后由 <code>report</code> 决定 plain text 或 JSON 输出。
- <code>getPreEmitDiagnostics</code> 的阶段顺序是公开示例背后的重要不变量。mini-checker 先处理 parse/bind，再处理 semantic；前置阶段失败时跳过依赖它的检查，并用结构化状态说明“没有语义诊断”不等于“检查通过”。

### 源码节选

```typescript
// TypeScript v5.9.3: src/compiler/program.ts
export function createProgram(rootNames: readonly string[], options: CompilerOptions,
    host?: CompilerHost, oldProgram?: Program,
    configFileParsingDiagnostics?: readonly Diagnostic[]): Program;
export function createProgram(_rootNamesOrOptions: readonly string[] | CreateProgramOptions,
    _options?: CompilerOptions, _host?: CompilerHost,
    _oldProgram?: Program,
    _configFileParsingDiagnostics?: readonly Diagnostic[]): Program {
    let _createProgramOptions = isArray(_rootNamesOrOptions)
        ? createCreateProgramOptions(_rootNamesOrOptions, _options!, _host,
            _oldProgram, _configFileParsingDiagnostics)
        : _rootNamesOrOptions;
    const { rootNames, options, configFileParsingDiagnostics,
        projectReferences, typeScriptVersion, host } = _createProgramOptions;
    const programDiagnostics = createProgramDiagnostics(
        getCompilerOptionsObjectLiteralSyntax);
```

这段节选保留了真实签名和“参数规范化 → Program 级诊断状态”的关键分派，删去了文件系统解析、默认库、重定向、增量复用和 emit 细节。删减后仍能解释本课的数据入口，但不能据此声称 mini-checker 能替代 <code>tsc</code>。

```typescript
// TypeScript v5.9.3: parser.ts / binder.ts / program.ts
export function parseSourceFile(
    fileName: string, sourceText: string, languageVersion: ScriptTarget,
    syntaxCursor: IncrementalParser.SyntaxCursor | undefined,
    setParentNodes = false, scriptKind?: ScriptKind): SourceFile {
    scriptKind = ensureScriptKind(fileName, scriptKind);
    initializeState(fileName, sourceText, languageVersion, syntaxCursor,
        scriptKind, jsDocParsingMode);
    const result = parseSourceFileWorker(languageVersion, setParentNodes,
        scriptKind, setExternalModuleIndicator, jsDocParsingMode);
    clearState();
    return result;
}

export function bindSourceFile(file: SourceFile, options: CompilerOptions): void {
    binder(file, options);
}

function bind(node: Node | undefined): void {
    if (!node) return;
    setParent(node, parent);
    bindWorker(node);
}

export function getPreEmitDiagnostics(program: Program,
    sourceFile?: SourceFile): readonly Diagnostic[] {
    let diagnostics: Diagnostic[] | undefined;
    diagnostics = addRange(diagnostics, program.getConfigFileParsingDiagnostics());
    diagnostics = addRange(diagnostics, program.getOptionsDiagnostics());
    diagnostics = addRange(diagnostics, program.getSyntacticDiagnostics(sourceFile));
    diagnostics = addRange(diagnostics, program.getGlobalDiagnostics());
    diagnostics = addRange(diagnostics, program.getSemanticDiagnostics(sourceFile));
    return sortAndDeduplicateDiagnostics(diagnostics || emptyArray);
}
```

节选压缩了参数和取消令牌，但保留了四个本课必须观察的事实：解析有清理边界、绑定递归建立身份、声明进入不同表、诊断按阶段合并。完整版本还包含 JSON、JSDoc、模块、声明文件、缓存和语言服务分支。

## 导读

把输入保存到 <code>input.ts</code>：

```typescript
type User = { id: number };
const user: User = { id: 7 };
const label: string = user.id;
const missing: string = user.name;
```

学习者只调用 <code>check(source)</code> 时容易把所有问题压成一个布尔值：第一行是类型声明，第二行需要名字绑定，第三行是可判定的类型不匹配，第四行还涉及对象属性查找。它们的失败证据不在同一层，修复动作也不同。

本课的心智模型是“一条带门槛的证据管线”：文本先产出带 span 的节点，绑定阶段产出 Symbol，检查阶段只消费稳定的 Type 与 Symbol，报告阶段只格式化 Diagnostic。每个阶段都把输入、输出和失败保留下来。这个模型能预测一个反例：若 parse 阶段发现缺少分号却仍把半截节点送入 checker，后续的“属性不存在”可能只是恢复节点造成的噪声。

本课是模块 12 的收束课。前五课分别提供 Type AST、关系判定、窄化、推断和诊断结构；本课把它们组合成一次可运行的扫描。继续拆出“parse 课”“check 课”“report 课”会重复前五课的主路径，因而保留一个完整组装课，不为五课批次数量制造新的 id。

## 分章正文

### 从一条命令看见四种产物

kicker: "01 · OBSERVE"

运行 <code>node examples/typescript/typescript-12-06.mjs</code>，示例会对正常输入和失败输入分别打印诊断。正常输入得到空的 <code>diagnostics</code>，失败输入得到带 <code>stage</code>、<code>code</code>、文件、字符范围和消息的记录。

| 阶段 | 输入 | 输出 | 失败证据 |
| --- | --- | --- | --- |
| parse | 源文本与文件名 | 节点、原始 span、parse diagnostics | 语法无法形成可用节点 |
| bind | 节点与 scope 栈 | Symbol 表、声明冲突 | 同一作用域重复声明 |
| check | Symbol、Type、表达式节点 | semantic failure | 类型不匹配或属性不存在 |
| report | 所有 Diagnostic | 文本或 JSON | 位置缺失时仍安全输出 |

#### 本章结论

“没有诊断”只有在 parse、bind、check 都完成且结果为空时才表示通过；任何前置阶段被跳过都必须有可观察状态。

### 建立管线状态与不变量

kicker: "02 · MODEL"

mini-checker 采用如下状态：

```javascript
{
  sourceFile: { fileName, text, statements },
  symbols: Map<string, { kind: "type" | "value", type, node }>,
  diagnostics: Diagnostic[],
  completed: ["parse", "bind", "check", "report"]
}
```

三个不变量贯穿全程：

1. 每个可定位的节点保存绝对字符范围；后续报告只能引用原始范围，不能重新搜索同名文本。
2. Symbol 是声明身份，Type 是可比较形状；同名但不同 scope 的 Symbol 不可互换，重复使用的 Type 可以共享。
3. 阶段只追加自己的诊断。parse 失败时不伪造 semantic 通过，bind 失败时不让不完整的符号表进入 check。

#### 代码

```javascript
const phase = (name, state) => ({
  ...state,
  completed: [...state.completed, name]
})

const initial = { sourceFile: null, symbols: new Map(), diagnostics: [], completed: [] }
const afterParse = phase("parse", { ...initial, sourceFile: { fileName: "input.ts" } })
console.assert(afterParse.completed.join("→") === "parse")
console.assert(afterParse.diagnostics.length === 0)
```

#### 本章结论

阶段状态是数据而不是日志；只要状态中保留完成序列和诊断来源，就能区分“通过”和“没有运行到这里”。

### parse：从文本建立可消费的 SourceFile

kicker: "03 · PARSE"

真实 <code>parseSourceFile</code> 会确定 <code>ScriptKind</code>，初始化 scanner/parser 状态，调用 <code>parseSourceFileWorker</code>，再清理状态并返回 <code>SourceFile</code>。它没有在这一层完成类型兼容性检查。mini-parser 只实现三类语句：单字段 type alias、带注解的变量声明和简单表达式，但也保存每条语句的绝对起点。

解析阶段的资源边界很具体：源文本是后续 span 的所有权来源，临时扫描状态必须在返回前清理，节点不能只保存 <code>line/column</code> 的一次性格式化结果。若遇到无法解析的语句，返回 parse diagnostic 并停止语义阶段，比返回一个“猜出来的节点”更安全。

#### 代码

```javascript
function parseLine(line, offset) {
  const typeMatch = line.match(/^type\s+(\w+)\s*=\s*\{\s*(\w+)\s*:\s*(\w+)\s*\};$/)
  if (typeMatch) return { kind: "type", name: typeMatch[1], property: typeMatch[2], propertyType: typeMatch[3], start: offset, length: line.length }
  const valueMatch = line.match(/^(const|let)\s+(\w+)\s*:\s*(\w+)\s*=\s*(.+);$/)
  if (valueMatch) return { kind: "value", name: valueMatch[2], declared: valueMatch[3], expression: valueMatch[4], start: offset, length: line.length }
  return { kind: "parse-error", start: offset, length: line.length, messageText: "无法识别的语句" }
}

const parsed = parseLine("const count: number = 1;", 0)
console.assert(parsed.kind === "value" && parsed.start === 0)
console.assert(parseLine("const broken: number = 1", 0).kind === "parse-error")
```

#### 本章结论

parse 的交付物是“带位置的结构”，不是类型结论；语法失败应在产生错误的阶段结束，而不是让 checker 猜测。

### bind：把声明连接到可查找的身份

kicker: "04 · BIND"

真实 binder 的 <code>bind</code> 会把节点送入 exports、members 或 locals 表。mini-binder 用两个 <code>Map</code> 模拟 type namespace 与 value namespace，再用一个 <code>symbols</code> 表保存声明身份。type alias <code>User</code> 进入 type 表，<code>const user</code> 进入 value 表；名称相同不代表可以覆盖另一种声明的证据。

重复声明是绑定失败，而不是类型不匹配。内层 scope 的 <code>user</code> 应创建新的 Symbol，离开 scope 后恢复外层查找。示例为保持短小只使用单层 scope，但搭积木会实现 scope 栈并断言身份独立。

#### 本章结论

绑定阶段的目标是稳定的名字身份；如果没有可用的 Symbol，check 阶段不能把字符串名称当作已解析声明。

### check：沿声明关系计算表达式类型

kicker: "05 · CHECK"

check 只消费已绑定的 symbols 和可递归 Type。字面量直接得到 primitive Type；<code>user.id</code> 先查 value Symbol，再解析它的 object Type，最后按属性名查找。赋值检查比较表达式 Type 与注解 Type：相同类型通过，结构不匹配产生 semantic diagnostic，未知属性产生另一个 semantic diagnostic。

这一步沿着前五课的边界组合，而不重复实现它们的全部算法：联合、函数、窄化和泛型仍由前课的关系函数处理。组装课只要求调用合同稳定：<code>checkExpression</code> 返回 <code>{ type }</code> 或 <code>{ failure }</code>，<code>makeDiagnostic</code> 把 failure 绑定到声明节点。

#### 代码

```javascript
const primitive = name => ({ kind: "primitive", name })
const objectType = properties => ({ kind: "object", properties: new Map(Object.entries(properties)) })

function assignable(actual, expected) {
  if (actual.kind === "primitive" && expected.kind === "primitive") return actual.name === expected.name
  if (actual.kind === "object" && expected.kind === "object") {
    return [...expected.properties].every(([name, wanted]) => actual.properties.has(name) && assignable(actual.properties.get(name), wanted))
  }
  return false
}

console.assert(assignable(primitive("number"), primitive("number")))
console.assert(!assignable(primitive("string"), primitive("number")))
console.assert(assignable(objectType({ id: primitive("number"), label: primitive("string") }), objectType({ id: primitive("number") })))
```

#### 本章结论

check 阶段只使用身份和结构，不重新解析文本；表达式解析、名字查找和 assignability 必须返回可定位的失败理由。

### report：把失败转换成可消费的诊断

kicker: "06 · REPORT"

真实 checker 的 <code>error(location, message, ...args)</code> 把错误绑定到 Node，再加入 collection；<code>getPreEmitDiagnostics</code> 负责跨阶段聚合。mini-report 保留 <code>stage</code>、<code>code</code>、<code>file</code>、<code>start</code>、<code>length</code>、<code>messageText</code> 和可选 <code>relatedInformation</code>，然后提供 plain text 与 JSON formatter。

<code>start/length</code> 是机器证据，行列只是从源文本派生的展示值。配置或全局错误可能没有 <code>file</code>、<code>start</code>、<code>length</code>，因此 formatter 使用 <code>&lt;config&gt;</code> 等占位显示，不访问空节点。相关信息可以指出“期望 number、实际 string”，但不能把建议文本伪装成已经验证的修复。

#### 代码

```javascript
function formatDiagnostic(diagnostic, sourceText) {
  const prefix = diagnostic.file
    ? diagnostic.file + ":" + lineColumn(sourceText, diagnostic.start).line
    : "<config>"
  return prefix + " " + diagnostic.code + " " + diagnostic.messageText
}

const detached = { code: 6046, file: undefined, start: undefined, messageText: "选项无效" }
console.assert(formatDiagnostic(detached, "") === "<config> 6046 选项无效")
```

#### 本章结论

report 是纯转换层：它不改变 checker 结果，也不丢掉位置和因果信息；输出格式可以替换，Diagnostic 合同不能随终端颜色变化。

### 失败路径、恢复策略与所有权边界

kicker: "07 · FAILURE"

四类失败要保持可区分：

- **parse failure**：文本不符合 mini grammar，<code>completed</code> 停在 parse，不能生成 semantic 误报。
- **bind failure**：同一 scope 中重复声明或别名未完成，<code>completed</code> 停在 bind，原始 Node 仍可用于报告。
- **semantic failure**：类型不匹配或属性不存在，继续检查其他独立声明，让一次运行发现多个真实问题。
- **report failure**：诊断没有位置、消息链为空或重复；formatter 应安全降级，不能覆盖原始诊断。

资源归属也影响恢复：source text 与节点范围由 <code>ParsedProgram</code> 持有，Symbol 表只引用节点，不复制整段文本；Diagnostic 只保存必要 span 和消息，不持有可变 scanner。若未来加入增量缓存，缓存键必须包含文件身份、版本和编译选项，不能把上一轮的 Type 结果无条件复用到新文本。

#### 本章结论

恢复策略必须写成合同：独立 semantic 错误可以继续收集，依赖缺失的 parse/bind 证据必须显式跳过；任何失败都不能静默变成“通过”。

### 从教学管线到工程选择

kicker: "08 · ENGINEERING"

变体选择取决于边界：

1. **显式内存管线**适合学习、单元测试和无文件系统的 playground。每个阶段返回不可变值，失败路径简单，代价是语法覆盖率低，不能自动处理 imports、默认库和项目引用。
2. **Compiler API adapter** 适合工具已经需要 TypeScript 真实 AST、Program 和 checker 的场景。它能复用 parser、binder、module resolution 和 diagnostics，但 Compiler API 页面本身提醒版本会演化，升级时必须重新核对签名和行区间。
3. **增量/Builder 管线**适合大型项目。<code>oldProgram</code>、文件版本、缓存和 watcher 可以减少重复工作，代价是失效条件更复杂，错误恢复与证据版本必须一起测试。

本课选择显式内存管线作为完整示例，是为了让读者看见每个阶段的输入输出；源码沿 <code>createProgram</code> 解释生产边界，避免把教学实现包装成完整 <code>tsc</code>。模块 12 到此收束，后续若研究语言服务或增量编译，应另立课题，不把实现细节倒灌进本课。

#### 本章结论

先用显式阶段建立不变量，再按项目规模选择 Compiler API 或 Builder；生产方案获得覆盖率与复用能力，也必须承担版本、缓存和宿主边界。

## 核心机制

- <code>parse</code> 产生带源范围的 AST；<code>bind</code> 把声明连接到 Symbol 表；<code>check</code> 消费 Type 与 Symbol；<code>report</code> 只格式化 Diagnostic。
- 阶段顺序构成门槛：前置阶段失败会阻止依赖检查，但不会伪造空诊断。
- <code>Program</code> 是根文件、选项、宿主和诊断状态的组合；mini-checker 用内存 <code>ParsedProgram</code> 解释同一职责，省略完整项目图。
- <code>start/length</code> 是稳定机器证据，line/column、plain text 和 JSON 都从 Diagnostic 派生。
- 生产 TypeScript 还包含默认库、模块解析、错误恢复、JSDoc、emit、增量缓存和语言服务；删减处决定了教学实现的适用边界。

## 常见误区

- 把 <code>parse</code> 成功理解成类型检查成功，忽略 AST 还没有 Symbol 和 semantic Type。
- 用变量名字符串代替 Symbol，导致不同 scope 的同名声明互相覆盖。
- parse 或 bind 失败后继续运行 check，并把恢复节点造成的噪声当成用户错误。
- 只返回 <code>messageText</code>，丢掉 code、stage、span 和 related information。
- 为了让错误数量看起来少而跨阶段粗暴去重，掩盖不同位置的真实失败。
- 把 mini-checker 的 grammar 当成 TypeScript 全部语法，忽略 v5.9.3 Compiler API 的版本边界。

## 实现变体

### 变体 A：失败即停的显式阶段管线

useWhen: "教学、单元测试和错误必须阻断后续不安全推理的工具。"
tradeoff: "阶段边界最清晰，错误来源容易定位；一次输入只展示最早失败，用户需要多轮修复。"

#### 代码

```javascript
function failFast(source) {
  const parsed = parse(source)
  if (parsed.diagnostics.length) return report(parsed.diagnostics, ["parse"])
  const bound = bind(parsed)
  if (bound.diagnostics.length) return report(bound.diagnostics, ["parse", "bind"])
  const checked = check(bound)
  return report(checked.diagnostics, ["parse", "bind", "check"])
}
```

### 变体 B：阶段聚合但保留依赖门槛

useWhen: "命令行或编辑器希望一次显示多个独立 semantic 错误，同时不消费损坏的 AST。"
tradeoff: "用户一次得到更多可修复信息；需要为每个阶段声明依赖关系，并区分 skipped 与 passed。"

#### 代码

```javascript
function collectIndependent(source) {
  const parsed = parse(source)
  const diagnostics = [...parsed.diagnostics]
  if (parsed.diagnostics.length) return report(diagnostics, ["parse", "bind-skipped", "check-skipped"])
  const bound = bind(parsed)
  diagnostics.push(...bound.diagnostics)
  if (bound.diagnostics.length) return report(diagnostics, ["parse", "bind", "check-skipped"])
  const checked = check(bound)
  diagnostics.push(...checked.diagnostics)
  return report(diagnostics, ["parse", "bind", "check"])
}
```

两种变体都保留失败的阶段标签；差别只在是否继续收集与当前证据独立的错误。不能为了“聚合更多”而把未绑定的节点送进关系算法。

## 可运行示例

完整示例位于 [examples/typescript/typescript-12-06.mjs](../../../../../examples/typescript/typescript-12-06.mjs)，不依赖网络、第三方包或 TypeScript 本身。它实现了一个有意缩小的 grammar：type alias 只有一个属性，变量有显式 primitive/alias 注解，表达式支持 primitive literal、object literal 和一层 property access。

示例覆盖：

- 正常路径：parse、bind、check、report 全部完成，诊断为空。
- semantic 失败：错误的 primitive 赋值和未知属性各产生一个定位诊断，独立错误会一起返回。
- bind 失败：重复声明保留两个节点的来源，check 被标记为 skipped。
- parse 失败：缺少分号不生成 semantic 误报，报告中明确显示 parse 阶段。
- detached 诊断：没有文件范围的选项错误仍能格式化为 <code>&lt;config&gt;</code>。

运行方式：

```text
node examples/typescript/typescript-12-06.mjs
```

正常与失败断言都在同一个文件执行；最后输出 <code>typescript-12-06: PASS</code> 才表示完整管线和边界用例均通过。

## 搭积木复现

### 积木 1：定义带 span 的节点

先让每个 statement 保存 <code>kind</code>、<code>start</code>、<code>length</code>，再写一个断言证明报告不需要重新搜索变量名。使用同名变量时，两个节点的范围必须不同。

### 积木 2：实现 parse 门槛

把 type alias、变量声明和表达式解析成节点；缺少分号、未知语句或空 RHS 返回 parse diagnostic。断言 parse 失败时 <code>check-skipped</code>，不能返回空的“通过”。

### 积木 3：实现 type/value 两张表

绑定 type alias 和 value declaration，重复键产生 bind diagnostic。再加入 <code>enterScope</code>、<code>leaveScope</code>、<code>lookup</code>，断言内层同名 Symbol 与外层独立。

### 积木 4：接入表达式检查

先检查 literal，再处理 <code>name.property</code>。如果名称不存在，返回 <code>unknown-symbol</code>；如果属性不存在，返回 <code>missing-property</code>；如果注解与实际类型不兼容，返回 <code>type-mismatch</code>。

### 积木 5：把关系失败绑定到诊断

让 <code>checkDeclaration</code> 返回 actual、expected、node 和 reason，<code>makeDiagnostic</code> 再写入 file/start/length。断言同一段文本改变后，诊断范围仍来自本轮节点而非旧缓存。

### 积木 6：实现 report 与 detached 分支

提供 plain text 和 JSON 两个 formatter。对没有 file/start/length 的 options diagnostic 使用 <code>&lt;config&gt;</code>，并断言 formatter 本身不会抛异常。

### 积木 7：对照真实 Program 主路径

把 mini 的 <code>parse → bind → check → report</code> 与 v5.9.3 的 <code>createProgram → parseSourceFile → bindSourceFile → checker → getPreEmitDiagnostics</code> 对照。列出 mini 省略的 host、默认库、模块解析、JSDoc、错误恢复、emit、oldProgram 和增量缓存。

### 积木 8：加入版本回归断言

固定官方 commit 与示例输出快照；升级 TypeScript 时重新读取官方 Wiki、检查源码签名和行区间，再决定哪些断言是语言合同、哪些只是内部实现。不要把可变 main 链接写进课程。

## 自检

### 问题

一个输入同时包含缺少分号、重复声明和类型不匹配。请决定哪些阶段可以继续，哪些阶段必须跳过；再说明为什么 <code>getPreEmitDiagnostics</code> 的阶段顺序与 mini-checker 的 <code>completed</code> 序列都应被测试。回答必须引用真实源码证据并说明诊断的所有权与位置边界。

### 站内答案

结论：parse 失败时 bind 和 check 都必须标记 skipped；若 parse 成功而 bind 发现重复声明，check 不能消费不确定的 Symbol 表；只有 parse、bind 都完成后，独立的 semantic 类型不匹配才可以继续收集。机制：AST 节点是后续阶段的输入，Symbol 表建立名字身份，Type 关系算法依赖已解析身份，Diagnostic 则把失败与源范围绑定；<code>completed</code> 是把这些门槛从隐含控制流变成可断言数据的方法。源码证据：v5.9.3 的 <code>parseSourceFile</code> 在初始化和清理状态后返回 <code>SourceFile</code>（<code>parser.ts#L1587-L1615</code>），<code>bindSourceFile</code> 调用 binder（<code>binder.ts#L510-L515</code>），<code>bind</code> 把声明放入 locals/members/exports 之一（<code>binder.ts#L2730-L2782</code>），<code>getPreEmitDiagnostics</code> 按 config/options/syntax/global/semantic 顺序合并（<code>program.ts#L631-L643</code>）。验证方法：运行示例的 parse、bind、semantic 三组失败断言，检查 skipped 阶段与 <code>file/start/length</code>，再检查 detached diagnostic 能格式化。取舍：fail-fast 的错误来源最单一，聚合变体能一次展示更多独立 semantic 问题，但依赖图更复杂。边界：mini grammar 不覆盖完整 TypeScript；真实 Program 还受 host、模块、默认库、配置、emit 和版本影响。

### 练习

把示例中的 <code>const label: string = user.id;</code> 改成 <code>const label: number = user.id;</code>，再加入 <code>const other: string = "ok";</code>。预测最终诊断数量、每条诊断的阶段和哪些变量会进入 Symbol 表。最后用示例断言验证预测。

### 练习答案

结论：<code>label</code> 的赋值不再产生类型不匹配，<code>other</code> 也通过，因此 semantic diagnostics 为空。机制：<code>user.id</code> 解析为 <code>number</code>，目标注解也是 <code>number</code>；字符串字面量 <code>"ok"</code> 的类型为 <code>string</code>，与 <code>other</code> 的注解一致。<code>user</code>、<code>label</code> 和 <code>other</code> 都在 value Symbol 表中，<code>User</code> 在 type Symbol 表中。验证方法：运行示例对应的正常 fixture，断言 <code>completed</code> 为 <code>parse → bind → check → report</code>、诊断长度为 0，并检查四个声明身份均可查找。边界：如果把 <code>other</code> 改成无分号，失败发生在 parse，不能把“没有 semantic error”解读为成功。

### 面试实战

为什么一个 checker 要把 <code>error</code> 做成返回 Diagnostic 的纯数据函数，而不是在发现错误时立即打印？如果要支持编辑器和 CI，最少保留哪些字段？

### 面试实战答案

结论：错误应先成为结构化值，再由不同 formatter 输出；至少保留 stage、category、code、file、start、length、messageText 和 related information。机制：纯数据让同一失败同时服务终端、JSON、编辑器、去重和单元测试，也能在 <code>getPreEmitDiagnostics</code> 的阶段合并中保持顺序；立即打印会丢掉聚合和消费方选择。源码证据：v5.9.3 checker 的 <code>error(location, message, ...args)</code> 调用 <code>createError</code> 并写入 collection（<code>checker.ts#L2496-L2505</code>），<code>DiagnosticRelatedInformation</code> 明确允许 file/start/length 为空（<code>types.ts#L7197-L7204</code>），<code>getPreEmitDiagnostics</code> 最后统一合并和去重（<code>program.ts#L631-L643</code>）。验证方法：示例把 semantic 诊断和 detached options 诊断交给两个 formatter，断言相同对象可输出纯文本和 JSON，且没有位置的诊断不会导致异常。取舍：结构化诊断增加字段合同和版本维护成本，却换来可定位、可聚合、可回归；日志字符串实现更快，但无法稳定支持编辑器和自动修复。边界：真实 tsc 还包含 localization、message chain、related info、watch 和增量失效策略，mini 只复现核心数据边界。

## 更新日志

<!-- 最新记录始终放在最上面；历史记录禁止改写或删除。 -->

### 恢复批次并确认当前会话署名

at: "2026-08-06T11:01:28+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "Codex Desktop · gpt-5.6-luna"
summary: "恢复网络中断后的发布批次，复核本课的本地构建与浏览器证据，并确认固定 v5.9.3 源码入口。"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/40"
commit: "35e9d5f9092014c0515ba780ab1e01103c7c4dd9"

### 核准署名并收紧 v5.9.3 源码证据

at: "2026-08-05T15:58:25+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "Codex Desktop · gpt-5.6-luna"
summary: "按本次会话确认的署名更新日志，并将 parse、bind、check、diagnostic 与 Program 的源码链接收紧到固定提交的真实行区间。"

### 完成 mini-checker 的 parse 到 report 管线

at: "2026-08-04T12:15:50+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "Codex Desktop · gpt-5.6-luna"
summary: "串联带 span 的解析、作用域绑定、类型检查与结构化诊断，增加正常/失败断言、双管线变体和 flow 视觉。"
