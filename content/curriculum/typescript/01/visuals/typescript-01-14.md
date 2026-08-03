---
lesson: "typescript-01-14"
track: "typescript"
decision: "读完第二至第五章后，学习者仍难以把同一个 package name 依次追踪为条件 exports 目标、ESM/CJS facade、同步 require 失败和两套缓存身份；用静止默认 flow 将这条故障链拆成可单步验证的五个状态，比再增加一段线性文字更容易保持入口与身份的对应关系。"
---

## 视觉实验

### 让同一个 package name 穿过解析、互操作与缓存边界

id: "typescript-01-14-main"
kind: "flow"
placement: "chapter:2"
summary: "学习者沿同一个 `dual-pkg` 请求观察 `import` 与 `require` 如何先命中不同的 exports 条件，再进入各自的模块格式桥接；随后用 CJS named-export 静态分析和 `require(esm)` 的异步图限制解释失败，最后把 resolved URL 与 filename 对应到两张不同的身份表。"
caption: "箭头只表达本课 fixture 的因果顺序，不代表所有 bundler 或自定义 loader 都使用同一条路径；条件键顺序、CJS 静态名字、异步图错误和 cache identity 仍需回到 Node 固定源码与示例断言验证。"
actionLabel: "推进解析与加载流程"

#### 步骤

- 请求入口 | `import 'dual-pkg'` 与 `require('dual-pkg')` 带着不同 request kind 进入同一 package boundary。
- 条件目标 | `exports` 按对象键顺序为 `import` 选择 `index.mjs`，为 `require` 选择 `index.cjs`。
- 格式桥接 | ESM 读取 CJS 时通过静态推断的 named exports 加上 `default`/`module.exports` facade；双入口仍可能有不同模块身份。
- 同步失败 | CJS `require()` 遇到含 top-level await 的 ESM 图，`throwIfAsyncGraph` 抛出 `ERR_REQUIRE_ASYNC_MODULE`，应改用动态 `import()`。
- 身份落定 | CJS 以 filename 查 `Module._cache`，ESM 以 URL 管理 ModuleMap；package name 相同不等于 singleton 相同。

#### 观察重点

- 推进前先预测 `import` 和 `require` 是否会命中同一个文件、同一个 facade 以及同一个 cache。
- 用固定示例验证条件目标、异步失败和实例初始化次数；CJS 动态新增属性与自定义 loader 仍回到源码边界核对。
