---
id: "typescript-01-14"
track: "typescript"
title: "Node ESM/CJS 互操作、解析与缓存边界"
depth: "deep"
visualIndex: "../visuals/typescript-01-14.md"
exampleLanguage: "typescript"
readingMinutes: 50
sourceMinutes: 35
practiceMinutes: 70
reviewMinutes: 15
---

## 官方入口

title: "Node.js Packages · Conditional exports"
url: "https://nodejs.org/api/packages.html#conditional-exports"

title: "Node.js ECMAScript modules · Interoperability with CommonJS"
url: "https://nodejs.org/api/esm.html#interoperability-with-commonjs"

title: "Node.js CommonJS modules · Loading ECMAScript modules using require()"
url: "https://nodejs.org/api/modules.html#loading-ecmascript-modules-using-require"

title: "ECMAScript Language Specification · Module Namespace Exotic Objects"
url: "https://tc39.es/ecma262/multipage/ordinary-and-exotic-objects-behaviours.html#sec-module-namespace-exotic-objects"

Node 的包文档规定了 `.mjs`、`.cjs`、最近的 `package.json` `type` 和 `exports` 条件如何参与解析；ESM 文档说明从 ESM 导入 CJS 时 default 与静态分析出的 named exports 的边界；CommonJS 文档说明新版本 Node 可同步 `require()` 无 top-level await 的 ESM。本文以 Node.js `v26.5.1` 为资料版本，强调 Node 的宿主决定与 ECMAScript Module Record 语义之间的分工。官方文档使用稳定章节锚点，版本历史随文档页面更新，源码与测试证据固定到下方 commit。

## 真实源码

repo: "nodejs/node"
file: "lib/internal/modules/esm/translators.js"
symbol: "createCJSModuleWrap / cjsPreparseModuleExports"
language: "javascript"
url: "https://github.com/nodejs/node/blob/9e6bf8dbdeb890cbb09385b065f1c352128cd439/lib/internal/modules/esm/translators.js#L204-L274"

### 逐段讲解

- `createCJSModuleWrap` 先用 `cjsPreparseModuleExports` 取得静态可推断的 export names，再为 CJS 模块建立 ESM loader 的 ModuleWrap；这解释了为什么 ESM 可以写 named import，却不能保证它看见所有运行时新增属性。
- 预解析结果先写入 CJS cache，遇到 re-export 时递归预解析依赖并合并名字；它是兼容性分析，不是执行 `module.exports` 后得到的完整运行时快照。
- 模块真正执行后，Node 从 `module.exports` 读取已知属性并调用 `setExport`，同时无条件提供 `default` 和 `module.exports` 两个桥接出口。
- `resolve.js` 的 `resolvePackageTarget` 按 `exports` 对象的属性顺序尝试 `import`、`require`、`default` 等条件；`cjs/loader.js` 的 `Module._load` 则以 resolved filename 查 `Module._cache`，两条 loader 通道并不共享同一个身份表。
- `esm/loader.js` 的 `importSyncForRequire` 在同步加载 ESM 前调用 `throwIfAsyncGraph`；若整个模块图含 top-level await，Node 抛出 `ERR_REQUIRE_ASYNC_MODULE`，调用者必须改用动态 `import()`。

### 源码节选

```javascript
function createCJSModuleWrap(url, translateContext, parentURL) {
  const { format: sourceFormat } = translateContext;
  let { source } = translateContext;
  const isMain = parentURL === undefined;
  const filename = urlToFilename(url);

  source = stringify(source ?? getSourceSync(new URL(url)).source);
  const { exportNames, module } =
    cjsPreparseModuleExports(filename, source, sourceFormat);
  cjsCache.set(url, module);

  const wrapperNames = [...exportNames];
  if (!exportNames.has('default')) wrapperNames.push('default');
  if (!exportNames.has('module.exports')) {
    wrapperNames.push('module.exports');
  }

  return new ModuleWrap(url, undefined, wrapperNames, function() {
    if (!module.loaded) {
      loadCJSModuleWithModuleLoad(
        module, source, url, filename, Boolean(isMain), translateContext);
    }

    const { exports } = module;
    for (const exportName of exportNames) {
      if (exportName === 'default' || exportName === 'module.exports' ||
          !ObjectPrototypeHasOwnProperty(exports, exportName)) continue;
      this.setExport(exportName, exports[exportName]);
    }
    this.setExport('default', exports);
    this.setExport('module.exports', exports);
  }, module);
}
```

节选保留了“预解析名字 → 执行 CJS → 读取已知属性 → 写入 ESM namespace”的主线，省略了 hooks、builtin、source map、循环兼容和异常诊断分支。它不能推出 CJS 在执行后新增的任意属性都会成为 named export，也不能把 `default` 误读成 ESM 的 live binding。条件 exports 的具体分派见固定版本 `resolve.js#L482-L547`，同步 `require(esm)` 的异步图拒绝见 `module_job.js#L302-L315`，Node 自己的 CJS named-export 回归测试见 `test/es-module/test-esm-cjs-exports.js#L10-L27`。

## 导读

“把项目改成 ESM”经常只改了 `package.json`，然后在某个入口收到 `ERR_PACKAGE_PATH_NOT_EXPORTED`、named export 不存在，或在测试中发现同一个 singleton 被初始化两次。它们都不是 TypeScript 类型检查能够消除的错误，因为真正决定结果的是宿主的解析条件、文件 URL、loader 通道和模块格式。

本课用一条可追踪的路径拆开四个判断：先由文件扩展名和最近的 `type` 决定如何解析，再由包名和 `exports` 条件选择目标文件，接着由 import/require 的入口决定桥接方向，最后由 URL 或 filename 决定是否命中对应缓存。可以把它想成机场转机：登机牌上的包名先经分流柜台选航站楼，航站楼决定 ESM 或 CJS 安检，最后才到各自的候机名单。只看“导出了什么”而不看“从哪条通道到达”，无法预测同包的 import 与 require 是否拿到同一份状态。

前一课已经解释模块图的 link/evaluate、SCC 与 top-level await；本课只消费这些概念，转向 Node 的 host resolution 与双格式生态。后续类型系统课程不再重复 Node loader 细节。`typescript-01-14` 保持一个最终课题，因为 package format、conditional exports、CJS namespace、require(esm) 和 cache identity 必须在同一条故障链中验证；拆成“配置课”和“互操作课”会丢失条件解析到运行时状态的因果闭环。

## 分章正文

### 从一个包的两个入口观察分流

kicker: "01 · OBSERVE"

准备一个 `dual-pkg`，在 `package.json` 中声明：

```json
{
  "name": "dual-pkg",
  "type": "module",
  "exports": {
    ".": {
      "import": "./index.mjs",
      "require": "./index.cjs"
    }
  }
}
```

ESM 入口 `import 'dual-pkg'` 得到 `index.mjs`，CJS 入口 `require('dual-pkg')` 得到 `index.cjs`。两个文件都可以导出 `{ mode, marker }`，但 `mode` 的值故意不同。于是“包名相同”只说明进入同一个 exports map，不说明最终文件、执行格式或 singleton 相同。

如果从包外直接 `import 'dual-pkg/internal.js'`，它会因为没有列在 `exports` 中而失败，即使那个文件确实存在。`exports` 是公开入口表和封装边界，不只是构建工具提示。

#### 代码

```typescript
// esm-consumer.mjs
import { mode, marker } from "dual-pkg"
console.log(mode, marker)

// cjs-consumer.cjs
const { mode, marker } = require("dual-pkg")
console.log(mode, marker)
```

#### 本章结论

同一 package specifier 先经过调用方式对应的条件分派；要解释结果，必须同时记录调用方格式、`exports` 分支和目标扩展名。

### 建立 Node 解析模型与不变量

kicker: "02 · MODEL"

把一次加载抽象为：

`(parent URL, specifier, request kind, package scope) → (resolved URL, format, cache domain)`。

四个量分别回答“从哪里解析”“请求什么”“谁在请求”“放入哪张缓存表”。有三个需要牢牢记住的不变量：

1. `.mjs` 永远按 ESM 处理，`.cjs` 永远按 CJS 处理；`.js` 由最近的 `package.json` `type` 决定。
2. `exports` 条件对象按键顺序匹配；`import` 与 `require` 互斥，`default` 应放在兜底位置。
3. ESM 读取 CJS 时，default 指向 CJS 的 `module.exports` 对象，named exports 只在 Node 能静态识别并在执行后读到对应属性时可用。

`import()` 在 CJS 中也能加载 ESM，但返回 Promise；Node v26.5.1 允许 `require()` 同步加载无 TLA 的 ESM，并返回 module namespace object。含 TLA 的图仍必须通过动态 import。这个版本边界很重要：不能把今天 Node 的 `require(esm)` 能力回填给旧版本，也不能把“可同步加载”理解成两个 loader 共享所有运行时缓存。

#### 代码

```typescript
type RequestKind = "import" | "require"
type CacheDomain = "esm-url" | "cjs-filename"

type LoadKey = {
  parent: string
  specifier: string
  request: RequestKind
  format: "module" | "commonjs"
  cache: CacheDomain
}

function sameIdentity(left: LoadKey, right: LoadKey): boolean {
  return left.request === right.request &&
    left.format === right.format && left.cache === right.cache
}

const esmLoad: LoadKey = {
  parent: "file:///app/esm-consumer.mjs",
  specifier: "dual-pkg",
  request: "import",
  format: "module",
  cache: "esm-url"
}
console.assert(!sameIdentity(esmLoad, {
  ...esmLoad, request: "require", format: "commonjs",
  cache: "cjs-filename"
}))
```

#### 本章结论

模块身份不是 package name；至少要把 resolved URL/filename、格式、请求入口和 cache domain 一起记录，才足以解释重复初始化或错误分支。

### 沿 Node 源码走 package exports 与 CJS namespace

kicker: "03 · SOURCE"

Node ESM resolver 进入 `packageExportsResolve` 后，先把 shorthand `"exports": "./index.js"` 规范成 `{".": "./index.js"}`，再按 subpath 查找目标。遇到条件对象时，`resolvePackageTarget` 遍历对象自身键；只有 `default` 或当前 conditions 集合包含的键才继续递归。属性顺序因此成为公开行为，`default` 放早了会吞掉后面的 `require`。

目标 URL 得到以后，ESM loader 根据格式建立 ModuleJob。若目标是 CJS，`createCJSModuleWrap` 调用 `cjsPreparseModuleExports`，其底层 cjs lexer 只做静态名字分析；Node 然后执行 CJS，将静态名字对应的当前属性值写进 ESM namespace，同时把整个 exports 对象挂到 default。`exports.late = 1` 这种执行后才出现、静态分析没看见的名字，不应作为稳定 named import 合同。

反方向的 `require(esm)` 走 `importSyncForRequire`。Node 需要让整张 ESM 依赖图已实例化并确认没有异步图，再同步运行并把 namespace 返回给 CJS。这个桥接能解决一部分迁移，但没有把 ESM 变成 CJS：它仍受 module namespace、TLA、循环不变量和版本开关约束。

#### 本章结论

Node 的互操作是两个明确的 facade：CJS→ESM 由静态预解析名字加 default 对象组成，ESM→CJS 由同步 ModuleJob 返回 namespace；两者都不会抹平格式差异。

### 失败路径：名字、路径与异步图

kicker: "04 · FAILURE"

第一类失败是 named export 假阳性：CJS 动态执行 `module.exports[name] = value`，ESM 端写静态 named import 时，Node 可能根本没有这个名字。即使名字被识别，属性也可能在导入时是 `undefined`，因为 CJS namespace 是执行后从已知属性读取的桥接结果，不能承诺对后续 reassignment 做完整 live tracking。

第二类失败是路径封装：`exports` 存在时，包内未列出的子路径即使物理存在也不可从包名访问。用绝对路径绕开它会丢失公共 API 的兼容承诺，也会产生另一份 URL/缓存身份，不应当被当作修复。

第三类失败是 `require(esm)` 遇到 TLA。Node 的 `throwIfAsyncGraph` 在整个 ModuleJob 图含异步状态时抛 `ERR_REQUIRE_ASYNC_MODULE`；捕获这个错误再重复 `require()`不会让 promise 变同步。应把 CJS 边界改为 `await import()`，或把可选的异步初始化移出模块求值阶段。

#### 代码

```typescript
function chooseLoad(error: unknown): "dynamic-import" | "fix-export" | "fail" {
  const code = (error as { code?: string }).code
  if (code === "ERR_REQUIRE_ASYNC_MODULE") return "dynamic-import"
  if (code === "ERR_PACKAGE_PATH_NOT_EXPORTED") return "fix-export"
  if (error instanceof SyntaxError) return "fix-export"
  return "fail"
}

console.assert(chooseLoad({ code: "ERR_REQUIRE_ASYNC_MODULE" }) ===
  "dynamic-import")
console.assert(chooseLoad({ code: "ERR_PACKAGE_PATH_NOT_EXPORTED" }) ===
  "fix-export")
console.assert(chooseLoad(new Error("credentials")) === "fail")
```

#### 本章结论

错误码对应不同修复层：异步图改变调用方式，路径错误改变公开 exports，静态名字错误改变 import 合同；把它们都包成“重试”会掩盖根因。

### 缓存与所有权：同一个包名不保证同一个 singleton

kicker: "05 · IDENTITY"

CommonJS 的 `Module._cache` 以 resolved filename 为关键字，命中后返回同一个 `module.exports`。ESM 以 URL 作为 Module Map 身份；查询参数、不同 URL 形式、不同 worker/realm 都可能建立不同 Module Record。Node 的 ESM 文档还明确指出 ESM 没有 `require.cache` 这一 CJS API。

双格式 package 若让 `import` 和 `require` 分别指向 `index.mjs`、`index.cjs`，两个入口在通常情况下拥有两个模块实例。它们各自维护连接池、注册表或全局计数，就会出现“开发环境只有一次，生产混合入口却两次”的问题。

资源所有权要跟格式边界一起设计：最底层导出无副作用的工厂，上层 composition root 只选择一次入口并注入共享资源；如果必须共享，使用显式 IPC、外部存储或同一 loader domain 中的单一入口。不要依赖 `globalThis` 作为跨 worker/realm 的隐含 singleton，也不要用清空 `require.cache` 伪造 ESM 的 reset。

#### 代码

```typescript
type Resource = { owner: string; closed: boolean }

function createResource(owner: string): Resource {
  return { owner, closed: false }
}

function closeResource(resource: Resource): void {
  if (resource.closed) throw new Error("double close")
  resource.closed = true
}

const esmResource = createResource("esm-entry")
const cjsResource = createResource("cjs-entry")
console.assert(esmResource !== cjsResource)
closeResource(esmResource)
closeResource(cjsResource)
```

#### 本章结论

loader cache 是资源生命周期的一部分；双入口方案必须明确谁创建、谁关闭、是否允许两份状态，以及如何在测试中隔离它们。

### 从兼容方案比较工程取舍

kicker: "06 · ENGINEERING"

变体 A 是双入口 package：`exports.import` 指向 ESM，`exports.require` 指向 CJS。它给旧调用方最直接的迁移路径，但需要维护两套构建产物、测试两套入口，并处理两个 singleton 的风险。若两份实现不是行为等价的 facade，版本发布就可能出现条件分支漂移。

变体 B 是单一 ESM 核心，CJS 侧用 `await import()` 或 Node 版本允许时用同步 `require(esm)`。它让状态与实现只有一份，代价是 CJS 调用边界可能变成异步，旧 API 的同步合同不能静默改变。对库作者而言，显式 `async create()` 往往比让 `require()` 偶尔同步、偶尔报 TLA 错误更容易测试。

变体 C 是 CJS 核心，ESM 侧 `import default` 或使用 `module.createRequire()`。它适合历史包，但 named export 依赖静态分析，CJS 动态改写 exports 时不要把它当类型级合同。选择标准应写在 package 文档：支持的 Node 版本、入口条件、同步/异步、singleton 所有权和失败码。

#### 本章结论

互操作方案的核心取舍是“兼容入口”与“单一状态/单一实现”之间的关系；条件 exports 不是免费兼容层，必须随入口矩阵和资源合同发布。

### 用入口矩阵和固定 fixture 验证发布边界

kicker: "07 · VERIFY"

验证顺序应从最小 fixture 开始，而不是直接在大型 monorepo 猜解析过程：

1. `import` 与 `require` 是否命中预期条件文件，输出中记录 `mode` 和 `marker`。
2. 包外访问未导出 subpath 是否得到 `ERR_PACKAGE_PATH_NOT_EXPORTED`。
3. ESM 导入 CJS 的 default 与 named export 是否符合静态识别边界。
4. CJS `require()` 同步加载无 TLA 的 ESM 是否返回 namespace；含 TLA 的 ESM 是否明确失败，并能改用动态 import。
5. 同一个进程内重复访问的实例数、资源 close 次数和启动顺序是否符合所有权合同。

Node 自己的 `test-esm-cjs-exports.js` 使用独立子进程并分别断言成功输出和无效 named export 的 SyntaxError；本课示例沿用“子进程隔离 + 明确 exit code”的证据形态。真实项目还应在 Node 版本矩阵中覆盖 `exports` 条件、`module-sync` 版本边界、bundler 的条件选择和 package manager 的 symlink 解析。

#### 本章结论

互操作的验收对象是入口矩阵、错误码、namespace 内容和资源次数，不是某次开发机上“能 import 成功”。

## 核心机制

- `.mjs`、`.cjs` 和最近 `package.json` 的 `type` 共同决定 Node 对 `.js` 的格式判断。
- `exports` 把 package specifier 映射到受封装的 public subpath，并按条件对象键顺序选择 `import`、`require` 或 `default`。
- ESM 导入 CJS 时，Node 用 cjs lexer 静态推断名字；default 与 `module.exports` 仍指向 CJS exports 对象。
- `require(esm)` 在支持的 Node 版本中同步运行无 TLA 的 ESM 图并返回 namespace；异步图抛 `ERR_REQUIRE_ASYNC_MODULE`。
- CJS filename cache 与 ESM URL Module Map 是两条身份域；双入口 package 可能创建两个 singleton。
- 解析成功、格式转换、执行完成和资源所有权是四个不同验收点，不能只用一个“导入成功”断言覆盖。

## 常见误区

- 以为 package name 相同就一定命中同一文件和同一个 cache。
- 把 `exports` 当作 TypeScript `paths`；前者是 Node 运行时 public boundary，后者可能只改变编译器解析。
- 把 CJS named export 当成可靠 live binding，忽略静态分析和执行时属性读取边界。
- 以为 `require(esm)` 能加载任意 ESM；含 TLA 的依赖图仍不能同步返回。
- 用绝对路径绕开 `ERR_PACKAGE_PATH_NOT_EXPORTED`，却没有承认这改变了公共合同和缓存身份。
- 为了兼容而维护两套带副作用的 singleton，却只测试 ESM 或只测试 CJS 入口。

## 实现变体

### 变体 A：条件 exports 的双入口 facade

useWhen: "需要同时保留旧 CJS 同步调用与新的 ESM 静态 import，并能维护两套入口测试矩阵时。"
tradeoff: "兼容迁移路径清晰；要维护两种格式、两套缓存身份和可能重复的资源生命周期。"

#### 代码

```json
{
  "type": "module",
  "exports": {
    ".": {
      "import": "./index.mjs",
      "require": "./index.cjs",
      "default": "./index.mjs"
    }
  }
}
```

### 变体 B：单一 ESM 核心 + 显式异步工厂

useWhen: "新库可以定义异步初始化合同，优先保证一份实现、一个资源所有者和可测试的启动协议时。"
tradeoff: "状态与实现只有一份；CJS 调用方需要迁移到动态 import 或 async factory，不能保留任意同步语义。"

#### 代码

```typescript
// ESM 核心只导出工厂，不在模块顶层打开连接。
export async function createClient(url: string) {
  const connection = await connect(url)
  return {
    request: (input: string) => connection.send(input),
    close: () => connection.close()
  }
}

// CJS 边界明确承认异步。
async function main() {
  const { createClient } = await import("./client.mjs")
  const client = await createClient("https://example.invalid")
  await client.close()
}
```

## 可运行示例

```javascript
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

const root = mkdtempSync(join(tmpdir(), "typescript-01-14-"))
const packageDir = join(root, "node_modules", "dual-pkg")
mkdirSync(packageDir, { recursive: true })

try {
  writeFileSync(join(packageDir, "package.json"), JSON.stringify({
    name: "dual-pkg",
    type: "module",
    exports: { ".": { import: "./index.mjs", require: "./index.cjs" } }
  }))
  writeFileSync(join(packageDir, "index.mjs"),
    "export const mode = 'esm'; export const marker = 11;\n")
  writeFileSync(join(packageDir, "index.cjs"),
    "module.exports = { mode: 'cjs', marker: 22 };\n")
  writeFileSync(join(root, "esm-consumer.mjs"),
    "import { mode, marker } from 'dual-pkg';\n" +
    "if (mode !== 'esm' || marker !== 11) process.exit(2);\n")
  writeFileSync(join(root, "cjs-consumer.cjs"),
    "const pkg = require('dual-pkg');\n" +
    "if (pkg.mode !== 'cjs' || pkg.marker !== 22) process.exit(3);\n")
  writeFileSync(join(root, "async.mjs"),
    "await new Promise(() => {}); export const ready = true;\n")
  writeFileSync(join(root, "require-async.cjs"),
    "require('./async.mjs');\n")

  const esm = spawnSync(process.execPath, ["esm-consumer.mjs"], {
    cwd: root, encoding: "utf8"
  })
  assert.equal(esm.status, 0)

  const cjs = spawnSync(process.execPath, ["cjs-consumer.cjs"], {
    cwd: root, encoding: "utf8"
  })
  assert.equal(cjs.status, 0)

  const asyncFailure = spawnSync(process.execPath, ["require-async.cjs"], {
    cwd: root, encoding: "utf8"
  })
  assert.notEqual(asyncFailure.status, 0)
  assert.match(
    asyncFailure.stderr + asyncFailure.stdout,
    /ERR_REQUIRE_ASYNC_MODULE|ERR_REQUIRE_ESM/
  )

  console.log("conditional exports, CJS/ESM bridges, and async failure passed")
} finally {
  rmSync(root, { recursive: true, force: true })
}
```

示例正常路径分别断言 `import` 与 `require` 命中不同条件文件；失败路径让 CJS 同步加载含 TLA 的 ESM，断言 Node 拒绝同步图。它没有声称两个入口共享状态，也没有把 `require(esm)` 的版本能力扩展到旧 Node；发布前仍需在项目支持的 Node 版本矩阵上复跑。

## 搭积木复现

### 积木 1：固定 package scope 与文件格式

建立最近 `package.json`、`.mjs`、`.cjs` 和 `.js` 四个 fixture，记录每个文件的实际 format；用 `node --input-type` 的 stdin 实验区分入口参数与文件扩展名。

### 积木 2：实现条件 exports 选择器

把 `exports` 条件对象表示成有序键值列表，实现 `import`/`require`/`default` 的 first-match 规则；加入默认分支提前出现的失败测试。

### 积木 3：加入 public subpath 封装

只公开 `.` 与一个 feature subpath，分别从包名和绝对路径加载；记录 `ERR_PACKAGE_PATH_NOT_EXPORTED`，并说明绝对路径绕过了什么合同。

### 积木 4：模拟 CJS namespace facade

从 CJS 源码静态收集 `exports.name`，执行后把已知属性与 default 对象写进 namespace；加入动态属性和后续 reassignment，观察教学模型与 Node 兼容边界。

### 积木 5：验证双 cache 身份

在 ESM 与 CJS 两个入口各自导出初始化计数，记录 resolved URL/filename、实例数和 close 次数；把资源工厂移到 composition root，再比较结果。

### 积木 6：加入 require(esm) 的同步边界

用一个无 TLA 的 ESM 和一个含 TLA 的 ESM 分别被 CJS 加载，断言前者得到 namespace、后者得到明确错误码；把后者改成动态 `import()` 作为修复。

### 积木 7：对照固定版本源码与 Node 回归测试

逐项对照 `resolvePackageTarget`、`createCJSModuleWrap`、`throwIfAsyncGraph` 的分支，运行 Node 的 CJS named-export 测试思想，并列出教学实现省略的 hooks、loader worker、循环和 source map 处理。

## 自检

### 问题

一个 `type: module` 的包声明：`exports: { ".": { "import": "./index.mjs", "require": "./index.cjs" } }`。ESM 入口和 CJS 入口都加载包后，各自得到 `mode` 与一个全局 registry。为什么同一个 package name 仍可能出现两个 registry？如果 CJS 入口改为 `require("./index.mjs")`，哪些条件下会失败？如何设计一个不靠隐含 global singleton 的发布方案？

### 站内答案

结论是两个 registry 可能分别属于 ESM URL Module Map 和 CJS filename cache 中的两个 Module Record。机制上，`exports` 条件先根据请求入口选择 `index.mjs` 或 `index.cjs`；Node 的 CJS loader 以 resolved filename 查 `Module._cache`，ESM loader 以 URL 管理 ModuleJob，包名只是解析输入，不是实例身份。验证时用入口矩阵记录两个文件的初始化计数、resolved URL/filename 和 close 次数；正常结果应明确看到双入口各执行一次，而不是假设共享。若 CJS 直接 `require("./index.mjs")`，在 Node 支持 `require(esm)` 且该 ESM 及其整张依赖图没有 top-level await 时，可以同步返回 module namespace；若含 TLA、依赖图异步，Node 的 `importSyncForRequire` 会经过 `throwIfAsyncGraph` 抛 `ERR_REQUIRE_ASYNC_MODULE`，应改为 `await import()`。工程上优先选择单一 ESM 核心并导出显式 async factory，让 composition root 创建和关闭 registry；若必须双入口，就把共享状态外置到显式资源 owner、IPC 或存储中，并在 import/require 两套入口与 Node 版本矩阵上测试，不能把 `globalThis` 当跨 realm 的所有权协议。

## 更新日志

### 深化 Node ESM/CJS 互操作、解析与缓存边界

at: "2026-08-03T12:14:48+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "Codex Desktop · gpt-5.6-luna"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/34"
summary: "补齐 Node 条件 exports、CJS namespace、require(esm) 异步边界与双 loader 缓存身份的源码证据、示例、失败断言和 flow 视觉索引。"
