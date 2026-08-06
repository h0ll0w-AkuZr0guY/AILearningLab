# AILearningLab 课程重构目标与恢复手册

本文件保存当前可执行的课程状态、质量队列与发布门禁。它不记录过期批次流水；课程的贡献时间线只保留在各自 Markdown 的 `## 更新日志` 中，历史记录不得改写。

## 当前状态

| 路线 | 最终课题 | curated | pending | 说明 |
| --- | ---: | ---: | ---: | --- |
| Python | 41 | 41 | 0 | 已从 102 篇首轮短文压缩为 8 个模块的最终课题，并完成全量深化。 |
| TypeScript | 20 | 14 | 6 | 已有课程需要修复源码版本与历史日志。 |
| LangGraph | 20 | 20 | 0 | 已完成当前目录。 |
| Transformer | 10 | 10 | 0 | 现有 foundation 短文的状态与深度不匹配，等待重构决定。 |
| PyTorch | 20 | 20 | 0 | 已完成当前目录。 |
| LangChain | 12 | 10 | 2 | 本地批次已通过普通审计，等待署名确认与发布闭环。 |
| vLLM | 11 | 11 | 0 | 已完成当前目录。 |
| Nuxt / Deep Agents / LoRA | 0 | 0 | 0 | 全部模块仍为 draft，不能认领。 |

普通审计以当前 `catalog.md` 与正文文件为准；严格审计只有在所有 established 路线没有 pending 后才会通过。不得通过删减 pending、降低审计阈值、把 fallback 标为 curated 或保留旧短文来伪造完成度。

## Python 压缩重构

Python 的旧版目录将大量互相依赖的机制拆成 102 篇 foundation 短文，同时却缺少固定源码、完整示例、站内答案、时间预算和有根据的视觉决策。它们已从索引中撤下，不能作为深度课程或参考样例。

最终路线定义在 [`content/curriculum/python/track.md`](../content/curriculum/python/track.md)：

- 8 个 established 模块，41 个最终课题。
- 模块 01 与模块 02 各五篇课程已按当前完整契约重写并通过普通审计。
- 模块 01 与模块 02 的课程已先行完成；其余 31 个最终课题在本次全量深化批次中完成，Python 不再有 pending。
- 上一批 `python-02-01` 至 `python-02-05` 已合并为 [PR #26](https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/26)；本批发布信息记录在下方的全量收口节。

压缩依据是独立失败模型和可验证边界：对象头、比较/hash、循环可达性、静态复用、序列布局彼此不能合并；属性读取、descriptor、绑定和 MRO 共享同一解析链；生成器、异常、异步协议、导入、类型、并发、诊断和解释器执行链分别形成更高层的完整学习闭环。

## 单课完成契约

每个 `curated` 课程必须同时满足：

- 基于当前第一方官方文档、规范、论文和真实上游源码核验；官方 URL 精确到章节锚点，源码 URL 固定 tag 或 commit、真实文件、符号与行区间。
- 中文正文从可观察现象进入，解释数据模型、主路径、失败路径、工程取舍、版本边界和本课拆分/合并理由。
- 真实源码节选保留关键签名与分派，明确删减了哪些生产保证；复杂度与难度匹配。
- 至少两种真实变体、完整可运行示例、正常与失败断言、搭积木复现、全部自检/练习/面试实战的站内标准答案。
- 先写出“文字之后仍看不见什么”，再按视觉标准决定是否建立伴随索引。视觉不是配额；有视觉时必须双向索引、固定 placement、至少三步、文字替代、键盘、窄屏与 reduced-motion 支持。
- 正文在 `## 更新日志` 顶部追加真实的“人类 × AI”协作记录。历史记录是审计证据，禁止删除、压缩或统一模型名。

完整格式以 [`CONTRIBUTING.md`](../CONTRIBUTING.md)、[`docs/CONTRIBUTING_LESSONS.md`](CONTRIBUTING_LESSONS.md)、[`docs/VISUAL_LESSON_STANDARD.md`](VISUAL_LESSON_STANDARD.md) 和公共模板为准。

## 存量课程检阅与队列

每个深化批次开始前，对目标路线及一条相邻路线的所有 established 模块 curated 课程运行轻量检阅：CJK 密度、官方锚点、固定源码与行区间、视觉步骤/观察重点、时间预算、更新日志。发现项不阻塞当前批次，但必须列入队列。

### P1 规则偏差

- TypeScript 13 篇 curated 课程的源码 URL 尚未全部固定到 tag/commit 并复核行区间。
- Transformer 10 篇 `foundation` 短文仍被标为 curated；需要重写为深度课，或经用户批准调整状态。
- Python 的旧 102 篇首轮短文已撤出索引；只有 41 个最终课题可代表新的完成目标。

### P2 历史欠账

- TypeScript 13 篇、LangGraph 模块 01 的 10 篇、PyTorch 14 篇、Transformer 10 篇、LangChain 5 篇缺少课程更新日志。只在下一次实质修改时，以可靠 Git/PR 证据追加，不追溯编造。

### P3 观察项

- API 参考页或单页官方博客没有子锚点时，正文需要说明页面定位的约束；它不是其他课程省略锚点的理由。
- 阅读密度、源码时间与实践时间需要随实质重写一起校准，不能批量凭感觉修改。

## 批次恢复与发布门禁

1. 先检查工作树、origin/main、远端分支、开放 PR、Actions 和 Pages。发现同一自动化的未合并批次时，只恢复该批。
2. 正常批次只完成五个真实最终 lesson id；catalog 与全站普通审计的 curated 数量净增恰好五。尾批不为凑数拆分。
3. 运行 `CI=true corepack pnpm install --frozen-lockfile`、`corepack pnpm run curriculum:audit`、本批全部示例、`corepack pnpm generate`、`git diff --check`、敏感信息扫描和构建产物检查。
4. 用浏览器验收标题、官方锚点、源码、复制、答案、前后导航、长标题、阅读布局、视觉交互、键盘、窄屏、reduced motion、资料图谱入口和控制台。
5. 从最新 `origin/main` 建立独立分支，先创建 draft PR，回写 URL 后复核 diff；检查通过、无冲突且权限足够时 squash merge。
6. Pages 成功后直接访问每个线上课程页复验正文、源码、答案、导航、贡献日志和本批视觉。线上失败时保留证据并停止。

## 自动深化任务

已配置的 `AILearningLab 课程深化与发布` 自动任务现在对所有路线采用同一动态候选池。Python 已完成 41/41，不再优先；它与未来新增的 Java、Go 或其他合法路线一样，只在审计出现真实 pending 时参与普通候选。任务每次重新读取 track、catalog、审计和 GitHub 状态，使用与手动批次相同的恢复、证据、署名确认、审计、PR、合并与 Pages 门禁；调度只是唤醒来源，不能放宽质量标准。

## Python 31 课全量收口批次（2026-08-02）

- 路线与计数：Python `10/41 → 41/41`；全站普通审计 `89/134 → 120/134`。本批一次完成模块 03 至模块 08 的 31 个最终课题，保留 TypeScript 7 个与 LangChain 7 个 pending 作为后续 TODO。
- 课题：`python-03-01` 函数对象与执行环境、`python-03-02` 闭包与参数绑定、`python-03-03` 装饰器合同、`python-03-04` 迭代与生成器、`python-03-05` 委派与资源作用域；`python-04-01` 异常控制流、`python-04-02` 异常因果与多失败、`python-04-03` 同步资源管理、`python-04-04` await 协议、`python-04-05` 异步资源生命周期；`python-05-01` import 主路径、`python-05-02` 包边界、`python-05-03` 可重建发布、`python-05-04` 注解与泛型、`python-05-05` 结构化 API 契约；`python-06-01` 事件循环与 Task、`python-06-02` 取消与截止时间、`python-06-03` 并发收敛、`python-06-04` 背压与资源上限、`python-06-05` 跨执行边界；`python-07-01` 数据结构与复杂度、`python-07-02` 可重复基准、`python-07-03` CPU 诊断、`python-07-04` 内存诊断、`python-07-05` 解释器与并行性能；`python-08-01` 源码工作台、`python-08-02` 从文本到 AST、`python-08-03` 从名称到 code object、`python-08-04` 执行一条调用、`python-08-05` 自适应解释器、`python-08-06` 端到端源码改造。
- 拆分/合并理由：按函数执行、异常/资源协议、导入/类型发布、异步调度、性能证据与 CPython 执行链的独立失败模型拆分；每课保留可单独运行的主路径、失败路径和版本边界，没有为凑数拆分，也没有把互不兼容的状态机合并。
- 证据版本：官方 Python 文档按 3.14 章节锚点核验；CPython 源码统一固定到 `v3.14.6` tag、真实文件、符号和行区间；示例均位于 `examples/python/` 并逐个运行。
- 视觉决策：31 课均建立独立 `visuals/<lesson-id>.md`，按文字仍不可见的状态迁移、调用流、对象图、张量/缓存关系和可操作实验选择 `state`、`flow`、`graph`、`tensor` 或 `playground`；每个索引含双向 `visualIndex`、固定 placement、5 步观察重点及键盘/窄屏/reduced-motion 约束。
- 署名协作对：`human: @h0ll0w-AkuZr0guY`；`ai: WorkBuddy · DeepSeek-V4-Flash`。每课更新日志只追加本批记录，历史记录保持不变。
- 启动检阅：目标路线模块 03–08 的 CJK 密度、官方锚点、固定源码、视觉步骤、时间和更新日志均通过；相邻 TypeScript 模块 01 的历史源码版本/更新日志欠账及两课密度偏低已记录为 P1/P2，不阻塞本批授课。
- 发布：分支 `agent/curriculum-python-03-01-to-python-08-06`；[PR #27](https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/27) 已创建为 draft，回写至 31 个课程日志；合并后再回写 commit SHA。Pages 部署与 31 个线上页面验收结果在发布完成后补录。
- 下一 pending：Python 无 pending；全站下一候选为 TypeScript 7 个或 LangChain 7 个，按动态候选池和五课批次规则选择。

## Python PR #26/#27 署名纠正（本次修正）

- 范围：只纠正本自动化实际提交的 Python PR #26 与 #27，合计 41 节课程；其他路线和其他历史 PR 不改。
- 纠正：原批次日志中的 `WorkBuddy · DeepSeek-V4-Flash` 不是本次对话的真实运行身份；本次会话由 Codex Desktop 执行，用户确认精确模型为 `OpenAI Codex · GPT-5.6 Luna`。历史记录保留，41 节课各自只在日志顶部追加纠正记录。
- 防错规则：新增 [`docs/PR_SIGNATURE_CONFIRMATION.md`](PR_SIGNATURE_CONFIRMATION.md)。以后必须优先读取当前 session/interface 的真实身份；接口未暴露完整 `model_id` 时，PR 前展示确认表并取得用户明确确认，不能从仓库历史、模板示例、自动化默认值或“最新模型”推断。
- 自动任务：`AILearningLab 课程深化与发布` 已同步上述署名门禁，并将运行模型配置为 `gpt-5.6-luna`；每批、每次会话和模型切换都重新确认。
- 纠正 PR：[PR #28](https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/28) 已 squash 合并为 `47616c97f0479a7aded9ed689e5bd890b7b05f90`；URL 与 commit 已回写 41 节最新日志。Pages 部署运行 [30746697549](https://github.com/h0ll0w-AkuZr0guY/AILearningLab/actions/runs/30746697549) 成功，41 个线上课程 URL 全部 HTTP 200，并复验新旧署名与 PR 链接。

## LangChain 动态深化批次：langchain-01-06 至 langchain-01-10（PR #31 发布闭环）

- 启动证据：`origin/main` 与本地 `main` 均为 `56e3a6fe3f751cc418cf475ab214170d54183229`；工作树启动时仅有应保留的 `.pnpm-store/v11/index.db` 缓存，无无法区分的用户改动。开放 PR 为 0，同 lesson-id 未合并批次为 0；上一批 Pages 运行 [30747971834](https://github.com/h0ll0w-AkuZr0guY/AILearningLab/actions/runs/30747971834) 成功。
- 候选池：只统计 `planningStatus: established` 模块中 catalog 的 pending 最终课题。LangChain 有 7 个合法 pending；TypeScript 只有 `typescript-01-14` 属于 established 模块，另 6 个 pending 来自 draft 模块，不进入正常候选池；其余 established 路线没有合法 pending。池为 `["langchain"]`，随机证据为 `bytes=c66865ac7dcbc31a6bc7ced6d9881db9, index=0, selected=langchain, utc=2026-08-02T12:41:41.703Z`。
- 课题与理由：`langchain-01-06` batch 与 stream、`langchain-01-07` config 传播、`langchain-01-08` callback 事件、`langchain-01-09` 序列化边界、`langchain-01-10` 错误语义。五课分别对应 Runnable 的执行批处理、配置合并、生命周期观察、可执行配置持久化和失败分类边界；它们拥有独立的不变量、失败路径与复现代码，不再拆分或合并。路线模块已经 established，catalog 认领后转为 curated，未修改其他路线。
- 资料版本：官方 LangChain Models 的 invocation、invocation config、connection resilience 章节及 LangChain Core API reference 已在线核验；源码统一固定到上游 commit `725489f135458c37c668919b0d08652ebd04f131`，覆盖 `Runnable.batch`、`batch_as_completed`、`stream`、`with_config`、`_call_with_config`、`ensure_config`、`patch_config`、`merge_configs`、callback 生命周期、`dumps`/`dumpd`/`Serializable.to_json`、`load` 与 `OutputParserException` 的真实文件及行区间。
- 视觉决策：五课先写“文字之后仍看不见什么”，建立同模块独立 `visuals/<lesson-id>.md`。`01-06`、`01-08`、`01-09`、`01-10` 使用静态默认 flow 展示执行/事件/序列化/异常路径，`01-07` 使用 state 展示 config 合并；每个索引 5 步、固定 placement、观察重点、文字替代，并依赖通用渲染器的单步、暂停、重置、键盘、窄屏和 `prefers-reduced-motion` 契约。没有新增自定义 Vue 组件或装饰图。
- 本地验证：`CI=true corepack pnpm install --frozen-lockfile` 成功；`corepack pnpm run curriculum:audit` 成功，LangChain `5/12 → 10/12`，全站 `120/134 → 125/134`，视觉 `120/120 → 125/125`；五门 Python 示例均分别执行了正常与失败断言；`corepack pnpm generate` 成功并预渲染 298 条路由；`git diff --check` 成功。生成期间发现并修复了未创建 PR 的占位链接导致的伪 404 路由，随后创建 draft PR #31 并将真实 URL 回写五门课程日志。
- 浏览器验收：本地静态页已检查标题、官方章节、源码与代码复制入口、上一题/下一题、站内答案展开；视觉索引的单步、播放/暂停、重置均已操作验证。390px 窄视口下标题保持可见且无横向溢出，浏览器 `prefers-reduced-motion: reduce` 命中；一次随后重复刷新被浏览器 URL 策略拦截，未绕过该策略，窄视口下视觉组件本身不作额外断言，待发布后用线上 URL 再验收。
- 启动检阅：LangChain 模块 01 与相邻 TypeScript 模块 01 已运行轻量审计。新五课时间均为 `25+8+10+2=45`，CJK 密度分别为 98、105、104、92、97 字/分钟；TypeScript 的历史源码版本、更新日志和两课密度问题仍留在既有 P1/P2 队列，没有顺手修改。
- 署名确认：用户于 2026-08-02T21:17:19+08:00 明确确认本批署名为 `human: @h0ll0w-AkuZr0guY` × `ai: Codex · gpt-5.6-luna`；来源为用户明确确认。当前 session id 与 runtime model id 仍未由接口暴露，恢复记录分别记为 `未暴露`。确认范围为本批 `langchain-01-06` 至 `langchain-01-10`，未修改范围为其他路线、历史日志、用户缓存及非本批源码。
- 分支与发布：已从当前 `origin/main` 建立并推送分支 `agent/curriculum-langchain-langchain-01-06-to-langchain-01-10`，其 merge-base 为 `56e3a6fe3f751cc418cf475ab214170d54183229`；[PR #31](https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/31) 已完成署名确认、ready 和 squash merge，合并提交为 `f54f99b04b070443bb7b097ffe9f0bcac85f753c`，远端内容分支已删除。Pages 运行 [30749879286](https://github.com/h0ll0w-AkuZr0guY/AILearningLab/actions/runs/30749879286) 成功；合并提交已回写五门课程日志，署名门禁已解除。随后从 `origin/main` 建立 `docs/curriculum-langchain-pr31-commit-writeback`，仅回写上述 commit、Pages 和线上验收证据；[PR #32](https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/32) 已 squash 合并为 `306a34e4227ce30bb811c1bf8467743cd0cf7c3a`，远端 docs 分支已删除；对应 Pages 运行 [30750432008](https://github.com/h0ll0w-AkuZr0guY/AILearningLab/actions/runs/30750432008) 成功。
- 线上验收：五个线上课程页分别确认标题 `batch 与 stream`、`config 传播`、`callback 事件`、`序列化边界`、`错误语义`；官方入口、源码地图、PR #31、参考答案、视觉实验和上一题/下一题均存在。01-06 实际展开参考答案，点击视觉“下一步”观察到 `2/5`，重置回到 `1/5`；01-09 的官方入口为 `https://reference.langchain.com/python/langchain-core/load`，无子锚点限制已在正文说明。线上 390px 视口下 01-10 标题可见且 `scrollWidth=clientWidth=380`；默认控制台未发现页面错误。在线 reduced-motion 模拟调用在浏览器工具层超时并重置连接，未将其伪记为线上通过；本地页面的 `prefers-reduced-motion: reduce` 命中证据已保留在前一条浏览器验收记录中。
- 下一 pending：本地批次完成后 LangChain 合法 pending 为 `langchain-01-11`、`langchain-01-12`；TypeScript 的合法 pending 为 `typescript-01-14`。它们都不足五课，下一次动态池需重新计算并按尾批规则选择，不得用模板化内容凑数。

## TypeScript 尾批本地准备：typescript-01-14（已上线）

- 启动证据：2026-08-03 重新读取项目规则、课程模板、视觉标准、源码/文档图谱和参考课；工作树在 fetch 前干净，`origin/main` 为 `19f8992ce07956d6aebd38d4c6655a510b70f91d`，开放内容 PR 为 0，上一批 Pages 运行 `30750611189` 成功。保留本地 `.pnpm-store/v11/index.db` 缓存，不纳入批次。
- 动态候选池：选择时 established 模块中只有 LangChain 的 `langchain-01-11`、`langchain-01-12` 与 TypeScript 的 `typescript-01-14` 合法 pending；候选路线为 `['langchain', 'typescript']`，其余 established 路线已完成，draft 模块不计入。三课均不足五课；依据各自官方范围、源码入口和独立失败模型判断，继续拆分会把一条完整互操作/异步边界拆成模板化课题，因此按尾批规则选择一课。当前恢复批次已将 `typescript-01-14` 完成并标为 `curated`，新批次候选只剩 LangChain 两课，不能并行开启。
- 随机证据：CSPRNG pool `['langchain','typescript']`，bytes `49d9c3b9b7be6b42419c7aba3084c77f`，index `1`，selected `typescript`，生成时间 `2026-08-03T03:24:04.4059550Z`。本批最终范围为 `typescript-01-14`，不是五课正常批次。
- 课题与边界：`Node ESM/CJS 互操作、解析与缓存边界` 保持单课，覆盖 package `type`/`exports` 条件解析、CJS namespace 静态 named export、`require(esm)` 的同步图限制和 ESM URL/CJS filename cache 身份；前一课已覆盖规范层模块求值与 TLA 状态机，本课只消费该边界，不重复扩写。
- 资料版本：Node.js `v26.5.1` tag 对应 commit `9e6bf8dbdeb890cbb09385b065f1c352128cd439`；已核验 Node Packages `#conditional-exports`、ESM `#interoperability-with-commonjs`、CommonJS `#loading-ecmascript-modules-using-require`、ECMAScript Module Namespace Exotic Objects，及 Node 固定版本 `resolve.js`、`translators.js`、`module_job.js` 和 `test/es-module/test-esm-cjs-exports.js`。
- 本地准备：已在分支 `agent/curriculum-typescript-typescript-01-14-to-typescript-01-14` 完成 catalog、课程正文、`examples/typescript/typescript-01-14.mjs` 与 `visuals/typescript-01-14.md`；示例正常/失败断言通过，`corepack pnpm run curriculum:audit`、`corepack pnpm generate` 与 `git diff --check` 通过。视觉登记为 `flow`、静止默认、5 步、固定 `chapter:2` placement，catalog 状态为 `curated`。
- 视觉决策：正文之后仍难以追踪“同一 package name 如何依次经过条件解析、格式桥接和两张 cache 身份表”，已使用静止默认 `flow` 视觉，5 步展示 request kind → exports target → CJS/ESM facade → namespace/async failure → cache owner；不使用图片或专属组件。线上已复验单步、播放后暂停、重置、窄屏与 reduced motion CSS；原生 button 控件保留键盘语义，浏览器工具的 Enter 事件未改变步骤，未把该次事件伪记为独立推进证据。
- 署名确认：当前 session/interface 元数据披露产品来源 `Codex Desktop`、模型 `gpt-5.6-luna`、session id `019fc5c7-a3b8-7872-b4d3-1226ea6dac8d`；无独立 runtime model id 字段，记录为 `未暴露（接口仅暴露 model 字段）`。用户已明确回复“确认以上署名并允许创建 PR”，确认范围为本批 `typescript-01-14` 及其 catalog、正文、视觉索引、示例和恢复记录；human 为认证 GitHub 用户 `@h0ll0w-AkuZr0guY`，日志写法为 `Codex Desktop · gpt-5.6-luna`，未修改其他路线、历史日志、缓存和构建产物。
- 发布状态：已创建并 ready [PR #34](https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/34)；仓库未配置 PR checks，`gh pr checks` 返回 no checks reported，本地冻结安装、审计、示例、生成、diff、敏感信息、构建产物和浏览器门禁均通过。PR 已 squash 合并为 `21db3c7ddb2479b36d986707ca2f4d579ba56f8a`，远端内容分支已删除，commit 已回写课程日志；`codex` 与 `codex-automation` 标签在仓库中不存在，未强行创建。Pages 运行 [30784649839](https://github.com/h0ll0w-AkuZr0guY/AILearningLab/actions/runs/30784649839) 成功。线上验收 URL 为 [typescript-01-14](https://h0ll0w-akuzr0guy.github.io/AILearningLab/tracks/typescript/lessons/typescript-01-14/)，已确认标题、源码/文档入口、上下题、答案、代码复制、视觉状态、窄屏、reduced motion CSS 和控制台。下一 pending 为 LangChain `langchain-01-11`、`langchain-01-12`；未认领的 TypeScript draft 模块课题不纳入本批。
 - 发布状态：已创建并 ready [PR #34](https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/34)；仓库未配置 PR checks，`gh pr checks` 返回 no checks reported，本地冻结安装、审计、示例、生成、diff、敏感信息、构建产物和浏览器门禁均通过。PR 已 squash 合并为 `21db3c7ddb2479b36d986707ca2f4d579ba56f8a`，远端内容分支已删除，commit 已回写课程日志；`codex` 与 `codex-automation` 标签在仓库中不存在，未强行创建。Pages 运行 [30784649839](https://github.com/h0ll0w-AkuZr0guY/AILearningLab/actions/runs/30784649839) 成功。线上验收 URL 为 [typescript-01-14](https://h0ll0w-akuzr0guy.github.io/AILearningLab/tracks/typescript/lessons/typescript-01-14/)，已确认标题、源码/文档入口、上下题、答案、代码复制、视觉状态、窄屏、reduced motion CSS 和控制台。下一 pending 为 LangChain `langchain-01-11`、`langchain-01-12`；未认领的 TypeScript draft 模块课题不纳入本批。

## LangChain 尾批本地深化：langchain-01-11 至 langchain-01-12（已发布）

- 启动证据：本次会话先读取自动化记忆和全部课程规则；工作树在 fetch 前干净，`origin/main` 与本地 `main` 均为 `fe717f9391d139077dec873fcebbb3e167c99c3d`；开放 PR 为 0；上一批 Pages 运行 [30785876993](https://github.com/h0ll0w-AkuZr0guY/AILearningLab/actions/runs/30785876993) 成功。`git fetch origin --prune` 后无残留自动化远端分支，保留 `.pnpm-store`、`.output`、`dist` 和 `node_modules` 忽略目录。
- 动态候选池：从全部 `track.md` 和 `catalog.md` 重新计算，仅 `planningStatus: established` 模块计入。合法 pending 只有 LangChain `langchain-01-11`、`langchain-01-12`；TypeScript 其余 6 个 pending 来自 draft 模块，其他 established 路线无 pending。候选路线为 `['langchain']`，CSPRNG 证据为 `bytes=1bd2d73db38f28f23fa66a0a46622699`、`index=0`、`selected=langchain`、`utc=2026-08-03T13:58:48.115Z`。
- 批次边界：这是无其他合法五课路线可选的尾批，最终范围为 `langchain-01-11`「同步异步双接口」与 `langchain-01-12`「最小核心复现」。没有继续拆分：双接口课的独立不变量是同步/异步分派与资源边界；最小核心课的独立不变量是协议归一化、顺序组合、batch 失败保位和 stream 缓冲。继续拆出“线程池”“batch”“stream”等标题会复用同一主路径，形成模板化凑数。目标路线 curated `10/12 → 12/12`，全站普通审计 `126/134 → 128/134`，本批净增 2。
- 资料版本：官方模型调用章节为 [LangChain Models · Invocation](https://docs.langchain.com/oss/python/langchain/models#invocation)；官方 `RunnableSequence` API 使用路径级定位并在正文说明无稳定子锚点。源码与测试统一固定到 `langchain-ai/langchain` commit `725489f135458c37c668919b0d08652ebd04f131`，核验 `base.py` 的 `Runnable`、`RunnableLambda`、`RunnableSequence`、`coerce_to_runnable`、`transform` 与 `test_runnable.py` 的 batch/async/stream/失败保位测试。
- 本地改动：catalog 已将两个课题转为 `curated` 并清除 claimed 专用 owner；已完成两篇课程正文、两个无密钥 Python 示例、两个静态默认 flow 视觉索引。`CI=true corepack pnpm install --frozen-lockfile`、`corepack pnpm run curriculum:audit`、两个示例正常/失败断言、`corepack pnpm generate`（298 routes）、`git diff --check`、敏感信息扫描和忽略构建产物检查通过。生成保留仓库既有 bundle 与 Nitro warnings。
- 视觉决策：`langchain-01-11` 用 flow 展示同步入口、executor 回退、原生 `afunc`、sequence 等待和入口失败；`langchain-01-12` 用 flow 展示 callable 归一化、顺序组合、batch 保位、stream 缓冲和失败传播。两者都使用静态默认的通用 flow 实验，不新增专属组件或图片；视觉索引已与正文 frontmatter 双向登记。
- 署名确认：当前 thread id 为 `019fc7e2-fcf0-7b10-8556-9a24c36f6cca`，产品为 `Codex Desktop`，模型为用户明确确认的 `gpt-5.6-luna`，runtime model id 仍未暴露；human 为认证 GitHub 用户 `@h0ll0w-AkuZr0guY`。用户于本次会话明确回复“确认以上署名并允许创建 PR”，确认时间记录为 `2026-08-03T22:23:41+08:00`；范围仅本批两课及其 catalog、正文、视觉、示例和恢复记录。
- 浏览器门禁：生成服务可由本地 PowerShell/curl 返回 HTTP 200，但 Codex in-app Browser 对回环地址返回 `ERR_CONNECTION_REFUSED`/`ERR_EMPTY_RESPONSE`，按浏览器规则未改用 file URL、其他控制面或伪造交互证据。当前仅本地浏览器交互项未验证，线上 Pages 验收仍为发布后硬门禁。
- 分支与恢复：`agent/curriculum-langchain-langchain-01-11-to-langchain-01-12` 已从最新 `origin/main` 创建；内容提交为 `c07761b`，draft [PR #36](https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/36) 已 ready 并 squash 合并为 `725e703517950658b2ad864c973e3da63b2ddda6`，远端内容分支已删除；PR URL 与合并 commit 已回写两课日志。Pages 运行 [30822841087](https://github.com/h0ll0w-AkuZr0guY/AILearningLab/actions/runs/30822841087) 成功。下一合法 pending：LangChain 完成本批后无 established pending；TypeScript draft 模块的 6 个课题仍不认领。
- 线上验收：[`langchain-01-11`](https://h0ll0w-akuzr0guy.github.io/AILearningLab/tracks/langchain/lessons/langchain-01-11/) 与 [`langchain-01-12`](https://h0ll0w-akuzr0guy.github.io/AILearningLab/tracks/langchain/lessons/langchain-01-12/) 均确认标题、官方入口、源码复现页与固定 commit、上下题导航、参考答案、RUNNABLE EXAMPLE 代码复制、flow 单步 `1/5→2/5`、播放后出现暂停、重置回 `1/5`、390px `scrollWidth=clientWidth=380`、reduced-motion 媒体偏好和空的 error/warning 控制台。Enter/Space 在浏览器工具中未独立推进步骤，原生 button 语义存在，因此不把该事件记为独立键盘通过。

### 下一能力模块规划：langchain-02 Provider 与模型适配层（仅规划，不认领）

- 位置与边界：模块 01 现在以 Runnable 的统一执行合同收束；下一能力边界应解释“一个 provider-specific chat model 如何被包装成同一个 Runnable”，因此优先规划模块 02，而不是继续扩写消息或提前进入 Agent Loop。模块 02 当前仍保持 `planningStatus: draft`，本批不修改其 catalog、不创建 pending 课题。
- 建议最终五课：
  1. `langchain-02-01`「init_chat_model 与 provider 选择」：从模型名/provider 参数进入安装、延迟导入和统一构造；不把 provider 列表当作稳定 API。
  2. `langchain-02-02`「BaseChatModel 输入归一化」：追踪字符串、字典、消息列表到标准消息输入的转换，以及输入错误应在哪一层失败。
  3. `langchain-02-03`「_generate、ChatResult 与响应元数据」：沿 provider adapter 的生成合同观察 AIMessage、generation、usage metadata 和异常边界。
  4. `langchain-02-04`「stream、batch 与自动流式」：比较单次生成、逐块输出、批量请求和 callback 事件，明确 provider 原生能力与 Runnable 回退的差别。
  5. `langchain-02-05`「model profile 与能力协商」：用能力画像决定多模态、tool calling、structured output 等路径；把 schema/parser 的用户侧用法留给后续 Prompt/Output 模块，把工具执行留给模块 04。
- 第一方资料入口：LangChain [Models](https://docs.langchain.com/oss/python/langchain/models)、[Providers and models](https://docs.langchain.com/oss/python/concepts/providers-and-models)、[language_models reference](https://reference.langchain.com/python/langchain-core/language_models) 和 [BaseChatModel.bind_tools reference](https://reference.langchain.com/python/langchain-core/language_models/chat_models/BaseChatModel/bind_tools)。下一批必须重新核验官方页面版本，并把源码固定到真实 tag/commit；候选源码范围为 `libs/core/langchain_core/language_models/base.py`、`chat_models.py` 与对应 fake/integration tests。
- 拆分依据：五课分别对应构造、输入、生成结果、时间/并发能力、能力协商五个不变量；不再拆出“OpenAI 参数”“Anthropic 参数”等 provider 清单课，也不把结构化输出、tool call 执行和 Agent loop 重复放入本模块。若源码核验显示 `profile` 与 structured-output 策略仍跨版本不稳定，则把第 05 课降为规划项，不模板化凑数。
- 视觉决策：01 用 flow 展示 provider 选择到统一 Runnable；02 用 flow 展示输入归一化；03 用 state 展示生成结果与元数据；04 用 flow 展示同步/stream/batch 分支；05 用 state 展示 capability profile 到策略选择。均优先通用静态视觉，只有需要实时计算 provider capability 差异时才新增专属组件。
- 建立门槛：下一批启动时重算动态候选池；只有在源码、官方文档、fake/integration tests 和独立学习目标确认五课成立后，才把模块 02 从 `draft` 改为 `established` 并认领课题。本规划不改变当前批次的候选池和 curated 计数。

## TypeScript mini-checker 批次：typescript-12-01 至 typescript-12-05（本地恢复，等待署名确认）

- 启动证据：2026-08-04 从干净 `main`/`origin/main` `ca2176cd781475147bac1087d5a7fef6ef3a4fee` 开始；`git fetch origin --prune` 后无开放 PR、无残留远端自动化内容分支；上一条 Pages 运行 [30825296798](https://github.com/h0ll0w-AkuZr0guY/AILearningLab/actions/runs/30825296798) 成功。根目录 `AGENTS.md` 不存在，`.pnpm-store`、`.output`、`dist`、`node_modules` 为现有忽略目录，未纳入本批。
- 动态候选池：当前 `curriculum:audit` 为 TypeScript `14/20`、全站 `128/134`；Python、LangGraph、Transformer、PyTorch、LangChain、vLLM 等 established 路线均无 pending，draft 模块不计入。因此初始合法池为空。按“draft 模块需要新课题时先经源码/文档分析改为 established”规则，核验 TypeScript `12` 的六个 mini-checker 最终课题后，将该模块建立为 `established`，重新形成唯一候选路线 `typescript`。
- 随机证据：建立模块并重算后的候选路线为 `['typescript']`；CSPRNG bytes `f9d30e00dae18d276f5300595981819e`，index `0`，selected `typescript`，生成时间 `2026-08-04T01:39:16.535Z`。只有一条合法路线，因此随机结果不改变选择。
- 课题与边界：本批认领 `typescript-12-01` Type AST、`typescript-12-02` 结构类型兼容、`typescript-12-03` 控制流窄化、`typescript-12-04` 泛型推断、`typescript-12-05` 诊断与错误报告。它们分别围绕类型表示、关系判定、事实流、约束求解、可定位诊断五个独立不变量；`typescript-12-06` 全体组装必须等前五课完成后再做，保留为下一 pending。没有继续拆分，也没有为凑数改变既有最终课题。
- 资料版本：官方 Compiler API Wiki 的 [minimal compiler](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API#a-minimal-compiler)、[AST](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API#creating-and-printing-a-typescript-ast)、[Type Checker APIs](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API#type-checker-apis) 与 [Using the Type Checker](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API#using-the-type-checker) 已在线核验；TypeScript `v5.9.3` 固定 commit 为 `c63de15a992d37f0d6cec03ac7631872838602cb`，覆盖 `types.ts` 的 `Node`/`SourceFile`/`Type`/`Symbol`/`Signature`、`parser.ts` 的 `parseSourceFile`、`binder.ts` 的 `bindSourceFile`/`bind`、`checker.ts` 的 assignability/narrowing/inference/diagnostic 路径、`program.ts` 的 `createProgram`/`getPreEmitDiagnostics` 和 `programDiagnostics.ts` 的文件诊断证据；固定版本测试基线核验 `assignmentTypeNarrowing.types`、`TypeGuardWithArrayUnion.types`、`contravariantInferenceAndTypeGuard.types` 与 `anyAssignableToEveryType.types`。
- 本地恢复：模块 `12` 已由 `draft` 改为 `established`，前五课已由 `pending` 改为 `curated`，owner 清空。五篇正文、五个独立 JavaScript 示例和五份视觉索引均已完成；五个示例均通过正常/失败断言，`CI=true corepack pnpm install --frozen-lockfile`、`corepack pnpm run curriculum:audit`、`corepack pnpm generate`（298 routes）、`git diff --check`、密钥格式扫描和忽略产物检查通过。当前 TypeScript `19/20`、全站 `133/134`，视觉 `133/133`。
- 视觉决策：五课均先记录“读完文字后仍看不见什么”，建立通用静止默认索引。`12-01` 用 flow 展示 source text → Node → Symbol → Type AST，`12-02` 用 flow 展示 source/target relation 与函数参数逆变，`12-03` 用 state 展示 narrowing fact 在分支、赋值和 join 的迁移，`12-04` 用 flow 展示 candidate → choose → instantiate，`12-05` 用 flow 展示 Node span → Diagnostic → formatted message。每份索引均含 5 步、观察重点、文字替代、固定 `chapter:2` placement，并依赖通用渲染器的单步、暂停、重置、键盘、窄屏和 `prefers-reduced-motion` 契约；没有图片或专属 Vue 组件。
- 署名确认：用户本轮明确提供当前模型为 `GPT-5.6 luna`，确认本批可继续。当前产品来源为 `Codex Desktop`，session id 为 `019fca57-6609-70b2-97ee-169be28cfdba`，runtime model id 未暴露；认证 GitHub 用户为 `@h0ll0w-AkuZr0guY`。课程日志使用 `Codex Desktop · GPT-5.6 luna`，署名证据来源为接口披露的产品/session 与用户明确模型确认。
- 浏览器验收：按照 `control-in-app-browser` 技能尝试连接 Codex in-app Browser，但 Node-backed 浏览器运行时返回 `failed to write kernel assets: 系统找不到指定的路径`，因此没有伪造浏览器交互证据。直接访问线上页面已确认五个 URL HTTP 200，SSR 内容含 H1、官方入口、源码复现 tab、RUNNABLE EXAMPLE、代码复制、参考答案、上一题/下一题、视觉 block、单步/暂停/重置控件、`aria-live`、`prefers-reduced-motion` CSS、PR #38 和署名；source tab 展开、实际点击、键盘事件、窄屏布局和控制台未由浏览器工具独立验证。
- 分支/PR/Pages：内容分支 `agent/curriculum-typescript-typescript-12-01-to-typescript-12-05` 的初始提交为 `4482dea`、PR URL 回写提交为 `cdac339`；[PR #38](https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/38) 已 ready 并 squash 合并为 `b8e72d2702e7dbece46e83a98407a44eda8984f`，远端内容分支已删除。Pages 运行 [30870513731](https://github.com/h0ll0w-AkuZr0guY/AILearningLab/actions/runs/30870513731) 成功；五课日志现已补写合并 commit，当前 docs-only metadata writeback 分支为 `docs/curriculum-typescript-pr38-release-record`。本批不包含 `typescript-12-06`、其他路线、历史日志、缓存、生成产物或用户改动。
- 线上 URL：[`typescript-12-01`](https://h0ll0w-akuzr0guy.github.io/AILearningLab/tracks/typescript/lessons/typescript-12-01/)、[`typescript-12-02`](https://h0ll0w-akuzr0guy.github.io/AILearningLab/tracks/typescript/lessons/typescript-12-02/)、[`typescript-12-03`](https://h0ll0w-akuzr0guy.github.io/AILearningLab/tracks/typescript/lessons/typescript-12-03/)、[`typescript-12-04`](https://h0ll0w-akuzr0guy.github.io/AILearningLab/tracks/typescript/lessons/typescript-12-04/)、[`typescript-12-05`](https://h0ll0w-akuzr0guy.github.io/AILearningLab/tracks/typescript/lessons/typescript-12-05/)。下一 established pending 为 `typescript-12-06`；其他 draft 模块继续不计入候选池。
 - 下一 pending：本地恢复完成后，`typescript-12-06`「mini-checker 的全体组装」仍为唯一 established pending；其余 draft 模块课题继续不计入候选池。

## TypeScript 尾批：typescript-12-06（署名已确认，等待 PR）

- 启动证据：本次运行读取自动化规则、课程模板、视觉标准、参考课、源码/文档图谱与 TypeScript 全部模块目录；工作树在 fetch 前干净。git fetch origin --prune 后本地与 origin/main 均为 bd0efa499420d437e09acff007a5e5a8529c45a，开放内容 PR 为 0，上一条 Pages 工作流 [30870896226](https://github.com/h0ll0w-AkuZr0guY/AILearningLab/actions/runs/30870896226) 成功，远端未保留同 lesson-id 或本自动化未合并分支。根目录 AGENTS.md 不存在；现有缓存和构建目录未进入本批。
- 动态候选池：只统计 planningStatus: established 模块。Python、LangGraph、Transformer、PyTorch、LangChain、vLLM 已 100% curated；TypeScript 12 模块只有 typescript-12-06 一个合法 pending；Nuxt、Deep Agents、LoRA · PEFT 及 TypeScript 02–11 仍为 draft，不计入候选池。候选路线为 ["typescript"]，退出路线为所有其他 established 路线，draft 路线继续保留规划状态。
- 随机证据：CSPRNG bytes f69a2e28914433b9f6ece1ebd9a4b377，index 0，selected typescript，生成时间 2026-08-04T04:15:49.690Z。只有一条合法路线，随机结果不改变选择。
- 批次边界：这是无其他合法五课路线可选的尾批，最终范围只有 typescript-12-06「mini-checker 的全体组装：从 parse→check→report 的完整管线」。该课把前五课的 Type AST、类型关系、窄化、泛型推断和诊断结构接成一条独立可运行的组装管线；继续拆成 parse/check/report 会复用既有主路径，属于模板化凑数，因此没有拆分或合并。TypeScript curated 19/20 → 20/20；全站普通审计 133/134 → 134/134；视觉 133/133 → 134/134。
- 资料版本：官方入口为 TypeScript Wiki Using the Compiler API 的 A minimal compiler，补充核验同页 Type Checker APIs；源码固定为 TypeScript v5.9.3 tag 对应 commit c63de15a992d37f0d6cec03ac7631872838602cb，核对 program.ts 的 createProgram/getPreEmitDiagnostics、parser.ts 的 parseSourceFile、binder.ts 的 bindSourceFile/bind、checker.ts 的 error、types.ts 的 DiagnosticRelatedInformation 和 programDiagnostics.ts 的 createProgramDiagnostics 真实文件、符号与行区间。Compiler API 页面没有承诺内部实现跨版本稳定，本课已标明该边界。
- 本地改动：只修改 typescript-12 catalog、typescript-12-06 正文、同模块视觉索引、examples/typescript/typescript-12-06.mjs 和本恢复记录。示例不依赖第三方包，已分别执行正常路径、两个 semantic 失败、重复绑定、语法失败和 detached diagnostic 断言；普通 curriculum:audit 通过。经固定 v5.9.3 源码复核，正文行区间已收紧至 `createProgram program.ts#L1499-L1526`、`getPreEmitDiagnostics program.ts#L631-L643`、`parseSourceFile parser.ts#L1587-L1615`、`bindSourceFile binder.ts#L510-L515`、`bind binder.ts#L2730-L2782`、`checker.error checker.ts#L2496-L2505`、`DiagnosticRelatedInformation types.ts#L7197-L7204` 和 `createProgramDiagnostics programDiagnostics.ts#L87-L104`。
- 视觉决策：正文仍难以同时追踪源文本、AST、Symbol、Type 与 Diagnostic 的阶段转换，建立同模块独立 flow 索引，固定 placement 为 chapter:3，静止默认、5 步、文字替代和观察重点由通用渲染器提供；没有图片、专属组件或装饰资源。
- 本地浏览器验收（2026-08-04T12:38:32+08:00）：本地静态页标题、官方章节锚点、固定 v5.9.3 源码链接、源码复现 tab、代码复制入口、参考答案展开、上一题导航和最终课无下一题状态均已核验；视觉已操作单步 `1/5 → 2/5`、播放后暂停、重置回 `1/5`。390px 窄视口下 H1 与视觉区可见，`scrollWidth=380`、`clientWidth=380`；`prefers-reduced-motion: reduce` 命中且 CSS 含减弱动态规则；错误/警告控制台为空。Enter 未独立推进步骤，控件为原生 button，未将该事件伪记为独立键盘通过。浏览器测试使用本地临时静态预览，未修改仓库文件。
- 署名身份：当前接口元数据披露产品上下文 Codex Desktop、模型 `gpt-5.6-luna`、session/thread id `019fd058-f871-7300-bb5c-065cfcf3d024`；接口没有独立 runtime model id 字段，记录为未暴露（接口仅暴露 model）。human 为当前认证 GitHub 用户 `@h0ll0w-AkuZr0guY`，课程日志使用 `Codex Desktop · gpt-5.6-luna`。用户于 2026-08-05T15:58:25+08:00 明确回复“确认以上署名并允许创建 PR”，确认范围仅为本批课程、目录、视觉、示例和恢复文档；署名门禁已解除。
- 分支与发布：本地分支 `agent/curriculum-typescript-typescript-12-06-to-typescript-12-06` 已从最新 origin/main 创建；当前尚未创建 draft PR，尚未推送、合并或回写 PR/commit。署名确认后已重新完成冻结依赖、生成和本地静态证据，下一步执行浏览器验收、创建 draft PR 与 Pages 闭环。
- 下一 pending：所有 established 路线均无 pending；TypeScript draft 模块的规划课题不认领、不计入下一批。下一次运行必须重新读取 track/catalog/audit/GitHub 状态，不复用本次候选快照。
- 续作署名确认（2026-08-06T11:01:28+08:00）：当前接口元数据披露 `Codex Desktop · gpt-5.6-luna`、session/thread `019fd4c2-3465-7ba1-aa09-f81765e08876`；runtime model id 未暴露；human 为认证 GitHub 用户 `@h0ll0w-AkuZr0guY`。用户明确回复“确认以上署名并允许创建 PR”，确认范围仅为 `typescript-12-06` 课程、catalog、visual、example 与本恢复文档；现在允许创建 draft PR，其他课程、历史日志、缓存和生成产物保持未修改。
