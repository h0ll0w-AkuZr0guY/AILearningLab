# AILearningLab 课程深度重构目标与恢复手册

> 本文件是课程重构工作的长期恢复锚点。聊天记录、活动目标或网络状态不可用时，以当前工作树、本文件、课程审计结果和实际页面为准继续工作。
>
> 最后更新：2026-07-29

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

### 2.4 真实上游源码

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

### 2.5 搭积木式复现

- 困难课至少 5 个复现步骤。
- 专家课至少 6 个复现步骤。
- 第一步建立最小数据模型或协议。
- 后续逐步加入成功路径、错误路径、状态、组合和上游对照。
- 每一步都说明要实现什么、为什么现在加入、如何验证。
- 最终给出一份可运行的组合示例。
- 代码需要中文注释解释设计选择，而不仅解释语法。
- 对复杂实现可在课程间复用之前完成的函数，避免重复粘贴。
- 实践允许参考站内正文和上游源码。目标是学习与复现，不是无参考背写框架。

### 2.6 变体、边界与工程取舍

每课至少提供 2 种真实的实现或设计变体，并分别说明：

- 适用场景。
- 获得的能力或便利。
- 复杂度、性能、可靠性或维护代价。
- 不能使用的边界。

同时列出高价值陷阱。陷阱应能够通过反例或测试验证，避免只写“注意性能”“注意异常”。

### 2.7 练习、自检答案与面试实战

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

### 4.1 TypeScript 长篇课程样例

- 值、Reference 与相等算法：
  - `app/data/guides/typescript/runtime.ts`
  - 适合参考：规范类型与引擎实现分层、反例、三种设计变体。
- Property Descriptor、内部方法与 V8 对象形状：
  - `app/data/guides/typescript/runtime.ts`
  - 适合参考：135 分钟专家课、7 章正文、真实 V8 分派源码、规范与 HiddenClass 分层。
- GC、WeakRef 与 FinalizationRegistry：
  - `app/data/guides/typescript/gc.ts`
  - 适合参考：底层算法、并发不变量、真实 collector 源码、可手写 tracing collector。
- Execution Context、Environment Record、TDZ：
  - `app/data/guides/typescript/contexts.ts`
  - 适合参考：官方规范中文重构、binding 生命周期、V8 bytecode 对照。
- 闭包与 per-iteration environment：
  - `app/data/guides/typescript/closures.ts`
  - 适合参考：困难课的动态粒度、binding identity、循环复现和 retained path。

### 4.2 Python 源码课程样例

- CPython 从 tokenizer 到解释器与 specialization：
  - `app/data/guides/python/cpython.ts`
  - 适合参考：按源码流水线拆分课程、真实函数入口、构建与调试实验。
- asyncio 与并发控制：
  - `app/data/guides/python/asyncio.ts`
  - 适合参考：状态、取消、失败传播与工程验证。
- 类型系统与 API 设计：
  - `app/data/guides/python/typing.ts`
  - 适合参考：语言语义、静态类型能力边界和变体。

### 4.3 Transformer 当前样例

- 线性代数与张量记号的已精写内容：
  - `app/data/lesson-content.ts`
  - 当前仍属于早期兼容内容，后续应迁移到 `app/data/guides/transformer/`，并按本文件的新长课标准继续扩写。

## 5. 内容模型与页面入口

- 课程目录与题目元数据：
  - `app/data/curriculum.ts`
- 专题内容类型、导入与 track 映射：
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

新增 guide 文件后，必须在 `app/data/topic-guides.ts` 中导入并合并到正确 track，否则页面仍会使用模板 fallback。

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
rg -n "unit\\(|title:" app/data/curriculum.ts
```

定位某条路线：

```powershell
rg -n "typescript:|langchain:|langgraph:|deepagents:|nuxt:|transformer:|torch:|vllm:|lora:" app/data/curriculum.ts
```

定位已有精写题名：

```powershell
rg -n "^  '[^']+': \\{" app/data/guides
```

确认某个课程题目是否已有专属 guide：

```powershell
rg -n "完整课题标题" app/data/guides app/data/topic-guides.ts
```

若只在 `curriculum.ts` 中出现，而未在 `app/data/guides/<track>/` 中出现，该课题仍未精写。

### 6.3 推荐的恢复后第一条任务

1. 运行 `corepack pnpm run curriculum:audit`。
2. 找到当前 `in_progress` 路线中最靠前的 pending 课题。
3. 阅读该模块前一篇已完成 guide，确认叙事连续性。
4. 在线核对官方文档和真实上游源码。
5. 根据真实复杂度决定维持、拆分或合并课程。
6. 写入专属 guide，并在 `topic-guides.ts` 注册。
7. 运行普通审计。
8. 打开对应页面做 DOM 与截图验收。
9. 完成一个模块后运行 `corepack pnpm generate`。

截至 2026-07-28 最近一次内容审计：

```text
全站：135 / 1090 已精写，955 待完成
Python：102 / 102
TypeScript：13 / 114
LangGraph：5 / 132
Transformer：10 / 120
PyTorch：5 / 120
```

当前应继续的课题是：

```text
PyTorch / 01 · Tensor、Storage 与 Stride
transpose、permute 与 movedim：只改维度解释的零拷贝重排
```

若工作树中该课已经精写，则继续本模块下一个 pending 课题，不依赖上述快照。

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
7. 已启用独立本地自动化 `ailearninglab`（“AILearningLab 每日五课深度精写”），按本地时区每天 12:00 运行：
   - 候选只限 LangGraph、LangChain、PyTorch。
   - 已达到 100% curated 的路线永久退出候选池。
   - 首次自动内容批次优先 LangGraph，随后从仍有 pending 的候选随机选择。
   - 每次只净增 5 个 curated 课题，完成审计、生成、浏览器验收和 draft PR 后停止。
   - 若前一自动 PR 未合并，新批次以其 head 为起点创建堆叠 PR，避免从 main 重复写同一课。
   - 本地宿主、Codex 自动化权限/额度与 GitHub 凭据必须在运行时可用；工作树存在无法安全归属的用户改动时自动停止，不覆盖文件。

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
