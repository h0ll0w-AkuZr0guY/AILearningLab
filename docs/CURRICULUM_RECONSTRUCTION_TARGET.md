# AILearningLab 课程深度重构目标与恢复手册

> 本文件是课程重构工作的长期恢复锚点。聊天记录、活动目标或网络状态不可用时，以当前工作树、本文件、课程审计结果和实际页面为准继续工作。
>
> 最后更新：2026-08-01

## 1. 最终目标

逐课程、逐模块、逐课题完成以下 10 条技术路线的深度内容重构：

1. Python
2. TypeScript
3. LangChain
4. LangGraph
5. Deep Agents
6. Nuxt
7. Transformer
8. PyTorch
9. vLLM
10. LoRA / PEFT

完成一条课程的含义并非“课程表中有标题”，也并非“页面能够打开”，而是每个课题都具有专属、可学习、可复现、可验证的内容。学习者完成整条路线后，应能：

- 不依赖教程示例，解释语言或框架的核心运行机制。
- 从稳定接口和关键不变量出发，手写一个教学版核心实现。
- 阅读真实上游源码，识别入口、状态、分派、错误与性能路径。
- 解释为什么采用当前设计、替代方案是什么、适用边界在哪里。
- 用测试、日志、指标、profile 或故障实验证明自己的判断。
- 回答真实面试中的原理、源码、工程取舍与现场编码追问。

课程数量不能预先机械固定。复杂概念应拆分，过于简单且强相关的概念应合并。难度、学习价值和预计用时必须依据真实认知负担，而非为了形成整齐目录。

## 2. 单个课题的内容契约

每个精写课题至少包含以下结构。

### 2.1 元数据与评估

- 唯一且具体的课题标题。
- 难度：`简单 / 中等 / 困难 / 专家`。
- 难度理由：指出真正困难的状态、算法、抽象层或工程边界。
- 学习价值标签和 1–5 分学习价值评分。
- 预计总时间。
- 粒度说明：合并讲解、单点精讲或拆分专题。
- 四段时间预算：
  - 正文阅读
  - 源码阅读
  - 动手实践
  - 复盘与面试

四段时间之和必须严格等于课题预计总时间。

### 2.2 官方资料的站内重构

- 使用官方规范、官方文档、官方设计文档或官方论文作为事实基线。
- `official.url` 必须定位到对应章节锚点，不能只给文档首页。
- `official.note` 需要准确说明该章节约束了什么。
- 正文用自然、通俗、递进的中文重构官方内容，让用户不跳出本站也能完成主要学习。
- 可以翻译概念、算法步骤、字段语义与短小必要片段；避免成段机械复制受版权保护的文档。
- 每章需要加入自己的解释、反例、运行过程、工程语境和验证办法。
- 对随版本变化的内容标明实现版本或只讲稳定不变量。

### 2.3 长篇知识正文

正文的推荐叙事顺序：

1. 先用具体问题或反例建立直觉。
2. 给出准确术语和官方语义边界。
3. 手推输入、状态与输出。
4. 给出成功路径和失败路径。
5. 解释设计原因与获得的能力。
6. 对照替代设计和适用场景。
7. 落到工程诊断、性能、安全或可靠性。

正文要求：

- 困难课至少 5 个实质章节。
- 专家课至少 7 个实质章节。
- 每章围绕独立问题展开，避免把一句话拆成多个假章节。
- 章节应包含叙述、反例、必要代码、关键结论中的至少两类。
- 抽象概念应使用具体对象图、状态机、时间线、调用路径或最小运行示例落地。
- 禁止使用“它位于某模块的设计边界上”一类无法教学的空泛模板。
- 不得用课程标题替换定义，不得假定读者已经理解目录中的上位概念。
- 内容量必须与预计阅读时间匹配。当前审计下限为每分钟正文至少 70 个中文字符，同时保留困难课 2000 字、专家课 2800 字的绝对下限。

### 2.4 视觉实验与可观察演示

- curated 课程必须先判断视觉是否能解决明确学习障碍；允许不添加视觉，禁止按赛道配额批量生成。
- 首先写清学习者读完正文后仍无法观察的状态、数据流、shape、拓扑或 UI 结果，再选择媒介。
- 对象与生命周期使用状态图，顺序管线使用流程动画，节点与消息使用图结构，张量与显存使用格子或矩阵，属性切换使用真实 playground。
- 精确机制优先使用可验证的 HTML、SVG 和 Vue 状态；ImageGen 只用于现实场景、复杂空间关系或概念类比。
- 非图片实验至少三个可交互步骤，默认静止，并提供上一步、下一步、暂停和重置。
- 图示中的每一步必须能回到正文、源码或可运行示例验证。
- 正文保持独立完整；可选视觉写入同模块 `visuals/<lesson-id>.md`，由正文 `visualIndex` 双向索引，并通过固定 `placement` 锚点就地展示。
- 一个试题允许多个视觉块与多个 kind，每个块都必须含文字 summary、caption、步骤或观察任务。
- 图片必须存入 `public/visuals/<track>/<lesson-id>/`，提供中文 alt、来源/生成模型、事实边界和类比声明。
- 页面必须支持键盘、窄屏和 `prefers-reduced-motion`，禁止无法停止的循环动画。
- 完整契约和决策树见 `docs/VISUAL_LESSON_STANDARD.md`。

### 2.5 真实上游源码

每课必须选择与课题直接对应的真实函数、类或核心文件：

- 给出真实仓库、文件、符号和可定位链接。
- 页面内直接展示稳定的关键源码节选，不强迫用户跳转后自行搜索。
- 保留真实函数签名、主分派顺序和核心算法。
- 允许删除版本兼容、日志、低频参数与平台分支，但必须说明删掉了什么。
- 给源码补充中文注释，区分：
  - 规范语义
  - 框架设计
  - 引擎或平台实现
  - 性能优化
- 困难课真实源码节选至少 14 个非空行。
- 专家课真实源码节选至少 20 个非空行。
- `source.walkthrough` 至少 4 步，按调用顺序解释入口、分派、状态、不变量和失败路径。

源码内容不得只展示函数名或 `...`。若生产实现过大，应先在前序课程中实现小积木，当前课使用已经完成的函数名组合，并明确依赖关系。

### 2.6 搭积木式复现

- 困难课至少 5 个复现步骤。
- 专家课至少 6 个复现步骤。
- 第一步建立最小数据模型或协议。
- 后续逐步加入成功路径、错误路径、状态、组合和上游对照。
- 每一步都说明要实现什么、为什么现在加入、如何验证。
- 最终给出一份可运行的组合示例。
- 代码需要中文注释解释设计选择，而不仅解释语法。
- 对复杂实现可在课程间复用之前完成的函数，避免重复粘贴。
- 实践允许参考站内正文和上游源码。目标是学习与复现，不是无参考背写框架。

### 2.7 变体、边界与工程取舍

每课至少提供 2 种真实的实现或设计变体，并分别说明：

- 适用场景。
- 获得的能力或便利。
- 复杂度、性能、可靠性或维护代价。
- 不能使用的边界。

同时列出高价值陷阱。陷阱应能够通过反例或测试验证，避免只写“注意性能”“注意异常”。

### 2.8 练习、自检答案与面试实战

- 每个正文中的提问都必须有“查看参考答案”。
- 每课提供自检问题和无需 AI 的站内参考答案。
- 实践区提供验收标准，要求最小测试、失败路径和上游差异说明。
- 面试题基于公开面经关注点重新设计，不复制第三方平台原文。
- 面试答案先给结论，再推演机制，随后给源码、代码、测试或指标证据，最后说明适用边界。
- AI 可生成扩展答案，第一次生成后允许保存到浏览器反复查看。
- AI 评阅与 AI 助教是不同能力：
  - 评阅：检查已完成方案。
  - 助教：读取当前工作区代码并回答实现问题。
- 无 AI 时仍必须有完整站内答案和规则审阅。

## 3. 动态拆分与合并规则

### 3.1 应拆分的信号

出现任一情况时，优先拆成多个课题：

- 同一标题包含两个以上独立状态机。
- 官方规范入口分属不同章节，且各自需要独立反例。
- 源码需要跨越多个核心子系统才能解释。
- 一篇正文超过约 160–180 分钟仍无法形成清晰章节。
- 实践任务必须一次实现多个尚未学习的基础积木。
- 面试追问会自然分成语义、实现、性能、安全等独立方向。

拆分后，每课仍要有完整学习闭环，不能把前半课变成纯定义、后半课才给全部实践。

### 3.2 应合并的信号

出现以下情况时，可以合并：

- 多个概念共享同一状态、源码入口和验证实验。
- 单个概念只有定义和一两个机械 API，没有独立设计取舍。
- 分开后会重复大段相同正文和代码。
- 面试中通常作为一个推演链出现。

合并后应在章节内明确分层，不能把多个名词堆在一个段落中。

### 3.3 难度校准

- `简单`：单一规则，状态少，失败边界直观。
- `中等`：存在组合、变体或一到两个非直觉边界。
- `困难`：需要跨抽象层推演，或包含重要反例、控制流、类型/内存语义。
- `专家`：规范、框架和底层实现需要联动，存在并发、生命周期、优化、安全、恢复或多状态机。

难度不是课程顺序。基础模块中也可以出现专家课，后期工程模块也可以有简单但高价值的工具课。

## 4. 已完成样例与推荐参照

新作者或新 AI 接手时，应先完整阅读至少一个同类型样例，再开始写作。

- 公共深度课程模板：`content/templates/deep-lesson.md`
- 公共视觉索引模板：`content/templates/lesson-visuals.md`
- 优质课程参考集：`docs/LESSON_REFERENCE_SET.md`
- 单课贡献说明：`docs/CONTRIBUTING_LESSONS.md`
- 仓库级贡献与 PR 规范：`CONTRIBUTING.md`

参考集当前覆盖三类写法：LangGraph 运行时调度、PyTorch 内存与所有权、TypeScript 规范与引擎实现。参考文件直接指向真实课程 Markdown，不维护容易过期的副本。

## 5. 内容模型与页面入口

- 路线与模块课程目录：
  - `content/curriculum/<track>/track.md`
  - `content/curriculum/<track>/<module>/catalog.md`
- 单课知识内容：
  - `content/curriculum/<track>/<module>/lessons/<lesson-id>.md`
- 可选视觉索引：
  - `content/curriculum/<track>/<module>/visuals/<lesson-id>.md`
- 公共模板：
  - `content/templates/deep-lesson.md`
  - `content/templates/lesson-visuals.md`
- Markdown 类型与解析：
  - `app/data/curriculum-markdown.ts`
  - `app/data/guide-types.ts`
  - `app/data/lesson-markdown.ts`
- 构建期自动索引与 track 映射：
  - `app/data/topic-guides.ts`
- 课程详情聚合与 fallback：
  - `app/data/lesson-content.ts`
- LeetCode 风格课程工作台：
  - `app/pages/tracks/[track]/lessons/[lesson].vue`
- 工作台样式：
  - `app/assets/css/workbench.css`
- 全局 AI 配置与顶部课程导航：
  - `app/layouts/default.vue`
- 应用根布局：
  - `app/app.vue`
- 内容审计：
  - `scripts/audit-curriculum.mjs`

新增模块或课程 Markdown 后无需手写 import。`curriculum.ts` 与 `topic-guides.ts` 使用 Vite glob 在构建期自动读取；目录状态、文件路径、frontmatter id 和目录题名不一致时审计会失败。

## 6. 快速定位未完成目标

### 6.1 首选：运行课程审计

```powershell
corepack pnpm run curriculum:audit
```

输出会列出每条路线：

- `lessons`：课程表课题数。
- `curated`：已经存在专属 guide 的课题数。
- `pending`：仍使用 fallback 的课题数。
- `coverage`：精写覆盖率。

严格完成验收使用：

```powershell
corepack pnpm run curriculum:audit:strict
```

只要仍有任一未精写课题，严格审计就必须失败。不得通过删除课程、降低统计范围或把 fallback 标成 curated 来获得通过。

### 6.2 检查当前课程顺序

```powershell
rg -n "^## |^title:|^status:|^owner:" content/curriculum/*/*/catalog.md
```

定位某条路线：

```powershell
Get-ChildItem content/curriculum/<track> -Directory
```

定位已有精写题名：

```powershell
rg -n "^status: curated" content/curriculum/*/*/catalog.md
```

确认某个课程题目是否已有专属 Markdown：

```powershell
rg -n "完整课题标题" content/curriculum/<track>
```

`status: pending` 表示尚未认领，`status: claimed` 必须同时填写 `owner`，`status: curated` 必须存在对应正文。目录状态是协作入口，审计会核对它与文件是否一致。

### 6.3 推荐的恢复后第一条任务

1. 运行 `corepack pnpm run curriculum:audit`。
2. 找到当前 `in_progress` 路线中最靠前的 pending 课题。
3. 阅读公共模板、参考集和该模块前一篇已完成 Markdown，确认叙事连续性。
4. 在线核对官方文档和真实上游源码。
5. 根据真实复杂度决定维持、拆分或合并课程。
6. 用 `corepack pnpm curriculum:claim <track> <lesson-id> <owner>` 认领，再用 `corepack pnpm curriculum:new <track> <lesson-id>` 创建专属 Markdown。
7. 运行普通审计。
8. 打开对应页面做 DOM 与截图验收。
9. 完成一个模块后运行 `corepack pnpm generate`。

截至 2026-08-01 最近一次内容审计：

```text
全站：175 / 1090 已精写，915 待完成
Python：102 / 102
TypeScript：13 / 114
LangGraph：20 / 132
Transformer：10 / 120
PyTorch：20 / 120
LangChain：5 / 120
vLLM：5 / 92
```

当前应继续的课题是：

```text
vLLM / vllm-01-06
request shape（模块 01「推理服务的性能模型」前五课 vllm-01-01 ~ vllm-01-05 已全部精写并上线，下一 pending 入口为 vllm-01-06；PyTorch 的下一入口仍为 torch-03-01 requires_grad）
```

若工作树中该课已经精写，则继续本模块下一个 pending 课题，不依赖上述快照。

截至 2026-08-01 的视觉覆盖复审：

```text
全站 curated：175
当前视觉规范覆盖：非 Python 73 / 73
TypeScript：13 / 13
LangGraph：20 / 20
Transformer：10 / 10
PyTorch：20 / 20
LangChain：5 / 5
vLLM：5 / 5
Python：102 篇首轮正文保留，视觉索引撤回；该路线需按当前长课、证据和视觉决策规范逐模块重构。
视觉文件不计入 curated 数量；“覆盖”只表示存在经过决策的伴随索引，不表示每课使用同一种媒介。
```

## 7. 验证命令与完成证据

### 7.1 内容结构审计

```powershell
corepack pnpm run curriculum:audit
```

### 7.2 Nuxt 静态生成

```powershell
corepack pnpm generate
```

必须看到：

- client build 成功。
- server build 成功。
- 所有静态路由 prerender 成功。
- `.output/public` 生成完成。

### 7.3 浏览器验收

每个新内容模型或 UI 变更至少检查：

- 课程标题完整可读。
- 上一题/下一题正确。
- 难度、价值、时间、粒度和精写状态正确。
- 官方章节链接带准确锚点。
- 正文章节目录可跳转。
- 代码块语言标记、行号、复制按钮正确。
- 源码复现与知识正文不是同一份占位内容。
- 自检和面试答案可展开。
- 左右分栏可拖动，滚动条无原生粗糙样式。
- AI 配置只有右上角统一入口。
- AI 助教读取当前代码，AI 评阅检查当前代码。
- 页面无 Vue/Nuxt hydration、inject 或 runtime warning。
- 桌面宽屏与较窄窗口均无关键内容遮挡。

### 7.4 全部完成的严格条件

只有同时满足以下条件，才能声明整个目标完成：

1. 10 条路线普通审计均为 100% curated。
2. `curriculum:audit:strict` 退出码为 0。
3. 不存在模板化、跨题复用的伪专属正文。
4. 每课的答案、源码、实践和面试内容都能在页面中访问。
5. `corepack pnpm generate` 成功。
6. 对全部 track 首页和代表性课程页完成浏览器验收。
7. 修复浏览器控制台和页面截图中发现的错误与明显反人类交互。

## 8. 写作与事实边界

- 技术概念必须优先查官方规范、官方文档、官方仓库、官方论文。
- 涉及版本变化时重新联网核对，不依赖模型记忆。
- 源码节选以当前锁定或明确注明的上游版本为准。
- 第三方面经只用于发现关注点，题目和答案必须重新设计。
- 不编造源码函数、文件路径、参数或性能阈值。
- 无法确认的实现细节应明确写成“实现可能”“当前版本”或留待核验。
- 不为追求篇幅重复同义句。内容密度通过更多推导、反例、实验与源码路径增加。

## 9. 当前执行顺序

以下顺序是当前人工规划快照，不是自动化候选白名单。自动化每次从 `content/curriculum/*/track.md`、模块目录和普通审计动态发现除 Python 外的全部未完成路线；未来新增且目录合法的 Java 等路线会自动进入候选池。

1. Python：已完成首轮 100% 精写，后续仍可按新长课标准复审。
2. TypeScript：当前主线，先完成模块 01，再逐模块推进。
3. Nuxt。
4. LangChain。
5. LangGraph。
6. Deep Agents。
7. Transformer。
8. PyTorch。
9. vLLM。
10. LoRA / PEFT。

实际执行中可以根据依赖调整。例如 Transformer 与 PyTorch、vLLM 与 LoRA 之间可交叉补充，但任何路线都不能因调整顺序而从最终范围中消失。

## 10. 持续维护批次与发布纪律

自 2026-07-28 起，项目按持续维护方式推进：

1. 当前批次在完成 `top-level await、异步模块图与启动阻塞` 后停止新增课程，并先发布 GitHub Pages。
2. 后续每个内容批次默认精写 5 个课题。5 个课题可以来自同一路线，也可以由用户指定切换到其他课程。
3. 页面 Bug、交互修复和新需求组件可以插入内容批次；是否计入 5 章由本批次目标明确记录，默认只有完成一门可审计的精写课题才计作一章。
4. 每完成 5 个课题：
   - 运行普通内容审计。
   - 运行静态生成。
   - 浏览器验收本批代表页面与所有 UI 改动。
   - 创建一个独立分支、提交并发起 draft PR。
   - 更新本文件的覆盖率、完成清单、下一 pending 课题和 PR 链接。
   - 暂停任务，等待用户确认下一批的课程方向或产品需求。
5. 未获得用户“继续下一批”的明确确认前，不自动开启第 6 个课题。
6. 紧急 Bug 修复可以形成独立小 PR，不必等待凑满 5 章；修复后仍回到原批次剩余章数。
7. 已启用独立本地自动化 `ailearninglab`（“AILearningLab 五课动态深化发布”）：
   - 自动调度只是一次唤醒来源，不构成自然日限制；资源允许时可以重复手动触发。
   - 每次从仓库当前 `track.md`、`catalog.md` 与普通审计动态发现除 Python 外的全部未完成路线，不维护固定 track 白名单。
   - 已达到 100% curated 的路线退出候选池；后来新增且具有合法目录的 Java 等路线自动进入。
   - 正常批次随机选择一门能够形成五个真实最终课题的路线，并让 curated 净增恰好 5；不足五课的尾批次不得模板化拆分凑数。
   - 批次以 track id 和五个最终 lesson id 标识，不以日期标识。同一批未合并时只恢复该批；上一批完整发布后，下一次触发可以立即开始新批。
   - 每课同时满足长篇正文、第一方事实核验、真实源码、可运行示例、完整站内答案、视觉决策、资料图谱反向定位与“人类 × AI”更新日志，并完成本地和 Pages 双重验收。
   - 完整规则统一以根目录 `CONTRIBUTING.md` 的“自动化五课批次契约”为准。

当前发布基线：

```text
课程精写：125 / 1090
Python：102 / 102
TypeScript：13 / 114
Transformer：10 / 120
GitHub 仓库：https://github.com/h0ll0w-AkuZr0guY/AILearningLab
GitHub Pages：https://h0ll0w-akuzr0guy.github.io/AILearningLab/
基线提交：2b83aa1 Initial Review Lab learning platform
部署修复：160a4dd Fix Pages package manager setup
成功部署：https://github.com/h0ll0w-AkuZr0guY/AILearningLab/actions/runs/30347664499
线上验收：首页、TypeScript 第 13 节、官方锚点、8 章正文、上下题链接和 4 个静态资源均返回正确内容；交互已在同构本地构建中完成浏览器验收。
当前内容批次：已完成并发布，任务暂停，等待用户指定下一批 5 章或产品需求
下一候选课题：Node ESM/CJS 互操作、解析与缓存边界
```

当前维护批次：

```text
分支：agent/langgraph-batch-01
课程：LangGraph
curated 变化：0 / 132 → 5 / 132
全站变化：125 / 1090 → 130 / 1090
01：函数链为何不足：显式图、状态机与执行日志边界
02：StateGraph Builder 与 compile：从 schema 到 CompiledStateGraph
03：Pregel super-step：Plan、Execute、Update 与 BSP barrier
04：START、END 与静态边：入口、终止、fan-out 和 join
05：节点执行契约：Runnable、同步/异步、返回更新与副作用
源码基线：langchain-ai/langgraph 1.2.9 / 30c4d58db86455128e42ddec96b1ba53c553ba22
下一 pending：状态快照与执行元数据：values、tasks、next 与 config
PR：https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/1
```

当前一次性自动化维护批次：

```text
自动化：ailearninglab-2 / AILearningLab 一次性自动唤醒验收
随机选择：PyTorch（随机原始值 2726560484，索引 2）
分支：agent/curriculum-torch-2026-07-28-01
课程：PyTorch
curated 变化：0 / 120 → 5 / 120
全站变化：130 / 1090 → 135 / 1090
01：Tensor 双层模型：TensorImpl 元数据如何解释同一块字节
    粒度：把 Tensor metadata 与 Storage 入口合并为两层模型，先建立后续所有 view 推理的共同地址合同。
02：UntypedStorage、DataPtr 与别名生命周期：共享、所有权和序列化
    粒度：从普通 Storage 课拆出所有权、allocator、指针差异和序列化别名保真，避免把字节地址当生命周期。
03：shape、numel、dtype、device 与 layout：张量合同的正交坐标
    粒度：合并原 dtype/device 与 shape/numel，并补 layout/meta/sparse；五个属性共同形成算子入口合同。
04：Stride 地址代数与连续性：从索引公式到 memory_format
    粒度：把 stride 计算拆成专家专题，覆盖地址集合、默认/channels-last 连续性、重叠、洞和性能取证。
05：view、reshape 与 flatten：零拷贝兼容条件和复制回退
    粒度：把 view/reshape 从笼统连续性中拆出，沿 computeStride、view_impl 与 reshape 真实分派复现复制边界。
源码基线：pytorch/pytorch v2.13.0（2026-07-08 发布）
本地运行时：PyTorch 2.10.0+cu126；五个 CPU 合同示例全部通过
普通审计：135 / 1090；PyTorch 5 / 120（4.2%）
冻结安装：pnpm 11.17.0 --frozen-lockfile 通过
静态生成：Nuxt 4.5.1 / Nitro 2.13.4，2204 路由通过
浏览器：本批五页标题、官方锚点、源码、复制、练习/面试答案、上下题、1440px 分栏、960px 堆叠和控制台通过
下一 pending：transpose、permute 与 movedim：只改维度解释的零拷贝重排
PR：https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/2
```

上一每日自动化维护批次：

```text
自动化：ailearninglab / AILearningLab 每日五课深度精写
运行日期：2026-07-29（Asia/Shanghai）
随机选择：LangGraph（随机原始值 145556775，索引 0）
分支：agent/curriculum-langgraph-2026-07-29-01
课程：LangGraph
curated 变化：5 / 132 → 10 / 132（7.6%）
全站变化：135 / 1090 → 140 / 1090
01：状态快照与执行元数据：values、tasks、next 与 config
    粒度：把业务 channel 值、下一任务、checkpoint 地址和历史因果拆成一张可验证快照合同。
02：可重放执行：checkpoint、pending writes 与恢复边界
    粒度：独立解释 task 级 pending writes、step 级一致快照及外部副作用崩溃窗口。
03：确定性：reducer 顺序、任务排序与外部 I/O
    粒度：分开归并顺序、同一次运行恢复一致性和跨运行复现，并补观察/副作用协议。
04：拓扑验证与迁移：孤立节点、循环和 interrupt 兼容
    粒度：把当前图静态自洽与存量 checkpoint 兼容拆成两道上线门禁。
05：递归限制、停机条件与生产保护
    粒度：把业务停机、进展检测、步数预算、deadline、取消和受控恢复组织成多层护栏。
源码基线：langchain-ai/langgraph 1.2.10 / 41341457342327166d72fc11952ab28fb61ec0bf
普通审计：140 / 1090；LangGraph 10 / 132（7.6%）
冻结安装：pnpm 11.17.0 --frozen-lockfile 通过
可运行示例：examples/langgraph/06–10 五个 Python 合同实验通过
静态生成：Nuxt 4.5.1 / Nitro 2.13.4，2210 路由通过
浏览器：本批五页标题、官方锚点、1.2.10 源码、复制、练习/面试答案、上下题、宽屏可调分栏、960px 堆叠、长标题和控制台通过
下一 pending：TypedDict state
PR：https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/4
```

当前每日自动化维护批次：

```text
自动化：ailearninglab / AILearningLab 每日五课深度精写
运行日期：2026-07-30（Asia/Shanghai）
恢复：发现同日自动化分支的未提交 PyTorch 内容；确认与文件命名、修改时间一致后恢复，不新增第 6 节。
分支：agent/curriculum-torch-2026-07-30-01
课程：PyTorch
curated 变化：5 / 120 → 10 / 120（8.3%）
全站变化：140 / 1090 → 145 / 1090
01：transpose、permute 与 movedim：只改维度解释的零拷贝重排
    粒度：把三种轴重排 API 合并为同一地址合同，重点验证 axis 语义、stride 置换和下游物化边界。
02：slice、select 与 narrow：storage_offset 和步长切片
    粒度：合并共享 size/stride/offset 合同的 basic indexing，并把 gather copy、读写差异与 Storage 生命周期作为边界。
03：expand 与 repeat：零 stride 广播和真实物化
    粒度：以零 stride 的多对一地址映射串联只读广播、梯度归约、独立写入和 hidden copy 取舍。
04：as_strided：滑窗能力、越界检查与重叠写未定义行为
    粒度：独立为专家课，覆盖范围证明、overlap、autograd scatter-add、后端限制和审查门禁。
05：clone、contiguous 与 to：显式物化、所有权和设备迁移
    粒度：合并三类 copy 决策，分清独立 Storage、目标 memory format、dtype/device 变换与计算图身份。
源码基线：pytorch/pytorch v2.13.0；官方文档 2.13 稳定页与对应 ATen 源码交叉核验。
本地运行时：五个 CPU 合同示例（examples/torch/06–10）通过。
普通审计：145 / 1090；PyTorch 10 / 120（8.3%）。
冻结安装：pnpm 11.17.0 --frozen-lockfile 通过。
验证状态：普通审计、冻结安装、五个示例、Nuxt 静态生成与本地浏览器验收已通过；PR 创建、合并与 Pages 部署待本批继续完成。
下一 pending：basic indexing 与 advanced indexing：view/copy 边界与赋值 scatter
PR：https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/5
```

同日发布后质量修复：

```text
恢复原因：以当前普通课程审计重新验收时，第一节轴重排课约 1927 个中文字符，低于困难课 2000 字绝对下限；旧运行记录中的“审计通过”不再作为权威证据。
分支：agent/curriculum-torch-2026-07-30-audit-fix
修复内容：为“transpose、permute 与 movedim”补充排列复合、逆排列恒等式、语义适配器和非对称 shape 回归；不新增第 6 节。
curated：PyTorch 10 / 120（8.3%），全站 145 / 1090，均保持不变。
本地验证：普通审计、冻结安装、examples/torch/06–10、Nuxt 静态生成（2210 routes）与本批五页浏览器验收通过。
下一 pending：basic indexing 与 advanced indexing：view/copy 边界与赋值 scatter
PR：https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/6
```

当前每日自动化维护批次（待发布）：

```text
自动化：ailearninglab
运行日期：2026-07-30（Asia/Shanghai）
随机选择：PyTorch（索引 2）
分支：agent/curriculum-torch-2026-07-30-02
curated 变化：10 / 120 → 15 / 120（12.5%）
全站变化：145 / 1090 → 150 / 1090
01：basic indexing
02：advanced indexing
03：boolean mask
04：ellipsis None
05：broadcast alignment
源码基线：pytorch/pytorch v2.13.0；稳定文档 Tensor Views 与 Broadcasting semantics。
下一 pending：expand 与 repeat
PR：https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/7
```

当前 LangChain 自动化维护批次（2026-07-31）：

```text
恢复：网络中断后发现同日分支已有 2 篇未提交正文；核对分支、修改时间与目录认领后继续原批次，只补齐至 5 节。
分支：agent/curriculum-langchain-2026-07-31-01
课程：LangChain
curated 变化：0 / 120 → 5 / 120（4.2%）
全站变化：150 / 1090 → 155 / 1090
01：消息角色与 content blocks
    粒度：合并角色信封、标准 content blocks 与 provider 原生块，先建立跨 provider 的消息协议边界。
02：BaseMessage 不变量
    粒度：独立讲 content、type、provider payload、响应元数据与可重放持久化之间的责任分离。
03：ChatModel 输入输出
    粒度：围绕 _convert_input 与 invoke，收敛字符串、消息序列和 PromptValue，并区分四类失败。
04：Prompt 变量绑定
    粒度：把变量环境、递归消息展开、history placeholder 与一次性求值组织成模板编译器心智模型。
05：Runnable invoke
    粒度：以 RunnableSequence 为主线，同时推演业务值流、config/追踪树、失败短路和副作用幂等边界。
源码基线：langchain-ai/langchain 725489f135458c37c668919b0d08652ebd04f131；langchain-core 1.5.3。
官方基线：LangChain OSS Python Models / Messages 文档与 langchain-core Python Reference。
视觉：本批 5 篇均建立课程级索引，分别覆盖消息转换、字段生命周期、输入归一化、模板绑定与 Runnable 执行时间线。
可运行示例：examples/langchain/01–05 五个离线合同实验。
下一 pending：batch 与 stream（langchain-01-06）
PR：https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/11
```

当前视觉与资料图谱重构（2026-07-31）：

```text
分支：codex/knowledge-graph-visuals
范围：产品架构与视觉质量，不新增 curated 课程。
Python：撤回 102 个批量视觉索引和 3 个旧专属组件；保留首轮正文，等待后续按新规范重构。
非 Python：升级通用 state / flow / graph / tensor / playground 的信息层次，并为 Pregel barrier、PyTorch stride 增加课程专属可计算实验。
源码地图：PR #12 首轮加入源码/官方文档双通道；后续修正不再把课程层级当成上游资料关系。
顶部导航：增加 GitHub 仓库身份、main 分支标记和直接入口。
下一内容 pending：LangChain / batch 与 stream（langchain-01-06）
PR：https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/12
```

球状上游资料图谱修正（2026-07-31）：

```text
分支：codex/spherical-source-graph
范围：产品信息架构修正，不新增 curated 课程。
源码地图：改为确定性力导向球状网络；围绕官方仓库的目录、文件、符号，以及官方文档的域名、页面、章节锚点构图。
课程关系：课程不再充当图谱父节点，只作为源码/文档节点的反向学习入口；路线页与单课页增加资料图谱快捷定位。
下一内容 pending：LangChain / batch 与 stream（langchain-01-06）
PR：https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/13
```

当前自动化五课批次（2026-07-31，待发布）：

```text
自动化：ailearninglab
随机候选池：deepagents、langchain、langgraph、lora、nuxt、torch、transformer、typescript、vllm；Python 按规则排除。
随机选择：LangGraph（随机原始值 1456515371）。
分支：agent/curriculum-langgraph-langgraph-02-01-to-langgraph-02-05
curated 变化：LangGraph 10 / 132 → 15 / 132；全站 155 / 1090 → 160 / 1090。
课程：langgraph-02-01 TypedDict state；langgraph-02-02 MessagesState；langgraph-02-03 Annotated reducer；langgraph-02-04 append 与 replace；langgraph-02-05 自定义 reducer。
粒度：将 schema、消息身份、通用聚合、字段时间语义和领域 reducer 分开，避免把“字段存在”“按 ID 修订”与“并发合并”混为一课。
源码与文档基线：langchain-ai/langgraph b2926a0ff9589c28c7e01fe7cdbb337b86d5a4b4；Graph API 的 State、MessagesState 与 Reducers 精确锚点。
视觉决策：五个课程级 state/flow 索引分别演示 schema 投影、消息 ID upsert、并行归并、append/replace 时间语义和版本冲突；无 ImageGen 资产。
协作署名：@h0ll0w-AkuZr0guY × WorkBuddy · Hy3。
可运行示例：examples/langgraph/11–15 五个离线合同实验。
下一 pending：langgraph-02-06 消息 ID。
PR：https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/15
```

当前自动化五课批次（2026-07-31，待发布）：

```text
自动化：ailearninglab
随机候选池：deepagents、langchain、langgraph、lora、nuxt、torch、transformer、typescript、vllm；Python 按规则排除。
随机选择：LangGraph。
分支：agent/curriculum-langgraph-langgraph-02-06-to-langgraph-02-10
curated 变化：LangGraph 15 / 132 → 20 / 132；全站 160 / 1090 → 165 / 1090。
课程：langgraph-02-06 消息 ID；langgraph-02-07 状态迁移；langgraph-02-08 不可变思维；langgraph-02-09 schema 演进；langgraph-02-10 state 校验。
粒度：消息身份、checkpoint 因果迁移、Python 别名/回放、持久化兼容和输入/业务验证分别具有独立失败模型，不能合并为“State 进阶”一课。
源码与文档基线：langchain-ai/langgraph 1.0.5（84023451a2bd5987b1d4df530f4145d503d75ccb）；Graph API、Persistence、Pregel runtime 与 Backward compatibility 精确锚点。
视觉决策：五个 state/flow 索引依次呈现同 ID 修订、checkpoint 分叉、别名污染、schema drain 与三层校验；无 ImageGen 资产。
协作署名：@h0ll0w-AkuZr0guY × WorkBuddy · Hy3。
可运行示例：五个 Markdown 内嵌的离线 Python 合同实验，分别覆盖正常与失败断言。
下一 pending：langgraph-03-01。
PR：https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/16（已 squash 合并为 de97775，Pages 部署 run 30624292986 成功）。
```

最近一次自动化五课批次（2026-08-01，已上线）：

```text
自动化：ailearninglab
随机候选池：deepagents、langchain、langgraph、lora、nuxt、torch、transformer、typescript、vllm；Python 已 102 / 102 且按规则永久排除。
随机选择：PyTorch。
分支：agent/curriculum-torch-torch-02-06-to-torch-02-10
curated 变化：PyTorch 15 / 120 → 20 / 120；全站 165 / 1090 → 170 / 1090。
课程：torch-02-06 index_put_ 与索引赋值；torch-02-07 in-place 约束；torch-02-08 type promotion；torch-02-09 einsum；torch-02-10 operator dispatch。
粒度：原目录的 torch-02-06「expand 与 repeat」与模块 01 已精写的 torch-01-08 完全重题，按合并规则并入 torch-01-08，空出的最终课题改为「索引写回」，它是 torch-02-02 高级索引「读」路径的对偶「写」路径且全站无覆盖；其余四课分别对应写回约束、dtype 归并、方程降解与 kernel 选择四套互不重叠的失败模型，不能合并为「张量操作进阶」。torch-02-10 只讲「一次调用如何选出 kernel」这一语义层，DispatchKey 全量枚举与自定义算子注册留给模块 10。
源码与文档基线：pytorch/pytorch v2.13.0（cf30153c4c131c8164ee7798e5022d810682e2cb）；引用符号 _index_put_impl_（TensorAdvancedIndexing.cpp L962-1025）、has_internal_overlap（MemoryOverlap.cpp L11-54）、combine_categories/result_type（TypeProperties.cpp L83-146）、sumproduct_pair（Linear.cpp L166-273）、computeDispatchKeySet（DispatchKeyExtractor.h L24-47）；官方文档锚点分别指向 Tensor.index_put_、Autograd mechanics 的 in-place 小节、Type promotion 文档、torch.einsum 与 Extending torch native API。
视觉决策：五个课程级索引依次为 tensor（重复下标覆盖 vs 累加分叉）、flow（原地写的三道门）、tensor（type promotion 三桶归并）、flow（方程降解成 bmm 的五个阶段）、flow（一次 add_ 的键集合并与逐层清位）；均为可计算实验，无 ImageGen 资产。
协作署名：@h0ll0w-AkuZr0guY × WorkBuddy · Hy3。
可运行示例：examples/torch/16_index_put_accumulate.py、17_inplace_constraints.py、18_type_promotion.py、19_einsum_lowering.py、20_dispatch_keyset.py，五个脚本均在本机 torch 2.13.0+cpu 上通过，且各自同时包含正常路径与失败路径断言。
本地检查：curriculum:audit 通过；五个示例全部 PASS；pnpm install --frozen-lockfile 无漂移；nuxt generate EXIT=0（2235 个文件、11 条轨道全量预渲染、0 error）；git diff --check 干净；密钥扫描 0 命中；dist/.output/.nuxt/node_modules/.pnpm-store 均已忽略。
下一 pending：torch-03-01 requires_grad（模块 02 已 10 / 10 完成）。
PR：https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/17（已 squash 合并为 05e634c2dfe9ebd31d824f0c54db677301b765d9，远程分支已删除，Pages 部署 run 30686165035 成功）。
线上校验：五个 URL 均 HTTP 200，标题、分章、视觉块、署名与 v2.13.0 基线齐全。
```

当前自动化五课批次（2026-08-01，vLLM，已上线）：

```text
自动化：ailearninglab
恢复：发现上一触发已认领 vLLM 模块 01 的 vllm-01-01 ~ vllm-01-05（catalog 已改题名并 claimed、sourceScope 已更新为 vllm/v1/core/sched/scheduler.py），但零提交、无正文；按恢复规则只补齐该批，不新增第 6 课。
分支：agent/curriculum-vllm-vllm-01-01-to-vllm-01-05
curated 变化：vLLM 0 / 92 → 5 / 92；全站 170 / 1090 → 175 / 1090。
课程：vllm-01-01 prefill 与 decode：V1 调度器为什么取消了阶段划分；vllm-01-02 TTFT 与 TPOT：四段区间如何从事件时间戳算出来；vllm-01-03 batching 权衡：token 预算、并发上限与抢占代价；vllm-01-04 显存占用：gpu_memory_utilization 到底以什么为基数；vllm-01-05 显存带宽：decode 为什么算不满 GPU。
粒度：五课分别对应调度语义、延迟指标、批预算与抢占、显存基数、带宽受限五个互不重叠的失败模型；原目录 vllm-01-01「prefill decode」与 vllm-01-02「TTFT TPOT」是名词堆叠，按真实机制改写为可独立学习的课题，vllm-01-03/04/05 沿用原 pending 并扩展为完整论证，未模板化凑数。
源码与文档基线：vllm-project/vllm v0.26.0（568afb3a13806beb53bb2e6bd518269357b237c0，2026-07-27 发布）；引用符号 Scheduler.schedule（scheduler.py L425-530）、_preempt_request（L1212-1234）、waiting 接纳与抢占选择（L571-700）、Request.num_tokens_with_spec（v1/request.py L271）、RequestStatsAccumulator.update_from_finished_request（v1/metrics/stats.py L457-495）、request_memory（v1/worker/utils.py L425-445）、GPUWorker.determine_available_memory（v1/worker/gpu_worker.py L448-615）、get_kv_cache_configs（v1/core/kv_cache_utils.py L2036 起）、MHA.get_read_bytes_breakdown（v1/metrics/perf.py L471-513）；官方锚点分别指向 V1 blog 调度器一节、usage/metrics 的 General Metrics 与 MFU 一节、features/per_request_metrics 的 Response Format、configuration/engine_args 的 SchedulerConfig 与 CacheConfig、benchmarking/cli。
视觉决策：五个课程级索引依次为 flow（预算分配与切块）、flow（事件时间线四区间）、state（抢占生命周期）、tensor（显存预算三租户）、tensor（decode/prefill 算术强度对比）；均为可验证数字步骤，无 ImageGen 资产。
协作署名：@h0ll0w-AkuZr0guY × WorkBuddy · DeepSeek-V4-Flash（本次自动化 model_id 为 deepseek-v4-flash，按实际运行模型署名）。
可运行示例：examples/vllm/01–05 五个离线合同实验（统一预算、延迟区间、抢占与重算、显存基数、roofline），全部通过且各自包含正常与失败路径断言。
本地检查：curriculum:audit 通过（vLLM 5/92、视觉 5/5、全站 175/1090）；五个示例全部 PASS；pnpm 11.17.0 --frozen-lockfile 无漂移；nuxt generate EXIT=0（2214 路由、2234 文件）；git diff --check 干净；敏感信息扫描 0 命中；构建产物均在 .gitignore。
浏览器验收：CDP 驱动 Chrome headless 对五页完成标题、官方锚点、v0.26.0 源码链接与复制、全部答案展开、上一题/下一题、长标题、视觉卡片单步推进与观察任务、键盘可聚焦、reduced-motion 仿真、375px 窄屏与控制台零错误验收，全部通过。
下一 pending：vllm-01-06 request shape。
PR：https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/18（已 squash 合并为 4b121c910072b3135b013b1deea8c9a49af0ee3c，远程分支已删除，Pages 部署 run 30691037221 成功）。
线上校验：五个 URL 均 HTTP 200，标题、源码 tab（v0.26.0 锚点）、署名、视觉卡片、答案与导航齐全。
```

存量课程质量检阅（2026-08-01，覆盖 73 篇非 Python curated）：

```text
范围：TypeScript 13 / LangGraph 20 / Transformer 10 / PyTorch 20 / LangChain 5 / vLLM 5（Python 102 按既定规则除外）。
方法：脚本化采集（审计 + 正文密度 + 源码 URL 版本 + 视觉块统计）+ 人工复核；规则落盘见 docs/CURRICULUM_REVIEW_STANDARD.md。
内容证据：
- 正常：全部 deep 课满足官方锚点（页面有子锚点的均带 #）、四段时间合计 = estimatedMinutes、无占位符与跨课复制。
- P1：TypeScript 13 课源码 URL 指向 v8 `main`/`refs/heads/main` 可变分支（部分缺 #L 行区间），需逐课联网核验 tag/commit 与行区间后修复。
- P1：Transformer 10 课为 depth: foundation 首轮短文（无官方入口/真实源码/分章/时间预算/更新日志）却被标记 curated，且与 Python 豁免处理不一致；待用户确认后决定状态调整或纳入深化批次重写。
- P2：52 篇 curated 课缺 `## 更新日志`（typescript 13、langgraph-01 10、torch 14、transformer 10、langchain 5），属更新日志规则生效前的历史欠账；按下一次实质修改时补录（有 Git/PR 证据）处理。
- P3：langchain-01-04/05（reference.langchain.com API 页）、vllm-01-01（vllm.ai blog）官方 URL 无 # 锚点，属页面无子锚点的可接受情形，note 已说明。
视觉：73 篇全部有伴随索引；非图片视觉均 ≥3 步、有观察重点、placement 合法、无失效组件/空索引/装饰图；72 篇各 1 块、transformer-01-07 双块（tensor+image）合规；单块均锚定正文明确学习障碍，充分性判定规则已落盘。无异常。
时间预算：全部 deep 课四段合计 = estimatedMinutes；阅读密度 typescript 72-110、langgraph-01 73-88、torch 73-136、langchain 91-105、vllm 158-233 字/分钟；代码密度高的课密度低属正常，vllm 阅读时间偏紧但可接受；无严重失真，未批量改动。
署名：检阅未修改任何专题正文，无新增课程日志；vllm 五课 ai 字段为 WorkBuddy · DeepSeek-V4-Flash，历史批次 Hy3 记录保留为审计事实。
队列：P1 TypeScript 源码版本固定（13 课）；P1 Transformer 状态与深度（10 课，待用户决策）；P2 更新日志补录（52 课）。
```
