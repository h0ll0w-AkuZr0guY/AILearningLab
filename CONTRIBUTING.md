# 贡献指南

感谢你改进 Review Lab。仓库同时接受课程内容、课程总纲、前端体验、构建工具、文档和测试贡献。所有改动都遵循同一原则：范围清楚、证据可核对、行为可验证、提交可回退。

## 开始之前

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

先阅读与你的改动相关的文件：

- 课程贡献：`content/templates/deep-lesson.md`
- 模块目录设计：`content/templates/module-catalog.md`
- 优质课参考：`docs/LESSON_REFERENCE_SET.md`
- 单课格式说明：`docs/CONTRIBUTING_LESSONS.md`
- 视觉实验标准：`docs/VISUAL_LESSON_STANDARD.md`
- 课程路线与模块目录：`content/curriculum/<track>/track.md`、`content/curriculum/<track>/<module>/catalog.md`
- 课程拆分目标：`docs/CURRICULUM_RECONSTRUCTION_TARGET.md`
- 页面或构建贡献：相关 Vue、TypeScript、脚本及现有 CSS 约定

## 选择贡献类型

### 修正文案或错别字

直接修改对应模块下的 `lessons/<lesson-id>.md`。不要重排无关章节，也不要顺手格式化其他课程。一个小修复应产生一个小 diff。

### 深化或新增课程

先认领模块目录中的 pending 课题，再从公共模板开始：

```bash
corepack pnpm curriculum:claim <track-id> <lesson-id> <owner>
corepack pnpm curriculum:new <track-id> <lesson-id>
```

认领命令只修改对应模块的 `catalog.md`，把状态改为 `claimed` 并记录负责人。也可以手动完成同样修改，再复制 `content/templates/deep-lesson.md`。完成正文和验证后，把状态改为 `curated`。新增文件必须使用模块目录中已有的稳定 id。

扩写前至少阅读 `docs/LESSON_REFERENCE_SET.md` 中一节相近课程。AI 贡献者同样执行这一步。

### 修改模块与课程目录

先根据模块目标、官方文档范围和上游源码边界估算课题，再调整该模块的 `catalog.md`。一个模块一个目录文件，禁止把所有路线重新汇总进大型 TS 文件。目录改动会影响 URL、顺序、上一题/下一题和审计结果，PR 必须列出：

- 原课题与新课题的映射
- 拆分或合并理由
- curated 数量的净变化
- 旧 URL 或标题是否需要兼容

### 修改页面、组件或样式

保持内容层与渲染层分离。课程正文进入 `lessons/<lesson-id>.md`，可选视觉文字进入同模块 `visuals/<lesson-id>.md`，类型、解析和索引进入 `app/data`，页面交互进入 Vue，视觉规则进入 CSS。涉及响应式布局、复制、答案展开或导航时，附桌面与窄屏浏览器证据。

课程插图、动画和演示先遵循 `docs/VISUAL_LESSON_STANDARD.md`。视觉可为空；有明确教学价值时，正文只登记 `visualIndex`，视觉索引通过 `placement` 动态插入固定叙事锚点。一个试题可以拥有多个不同 kind。只有通用渲染器无法表达真实交互时，才在 `app/components/lesson-visuals/<lesson-id>/` 新建组件。ImageGen 资产必须进入 `public/visuals/<track>/<lesson-id>/`，同时提交中文 alt、生成/来源说明和类比边界。

### 修改脚本、构建或部署

说明输入、输出、失败策略和兼容边界。禁止把本地缓存、密钥、生成目录或完整上游仓库提交进 Git。

## 课程证据标准

每一条机制性结论都应能回到以下至少一种证据：

- 当前官方文档的精确章节锚点
- 真实上游仓库的 tag 或 commit、文件路径、核心符号和行区间
- 规范、论文或维护者发布的权威说明
- 可运行的最小实验与断言

禁止根据记忆捏造 API、参数、文件路径、源码函数或版本行为。无法核实的内容应明确标成待验证，不得写成确定事实。教学源码可以删减生产分支，但必须说明删掉了什么以及因此失去哪些保证。

## AI 贡献者工作约束

AI 在写课前必须按顺序完成：

1. 读取本文件、公共模板和一节相近的优质参考课。
2. 读取目标模块的 `catalog.md`、相邻课程和认领状态，确认边界。
3. 联网核验官方文档与真实上游源码。
4. 先在目标 `catalog.md` 认领，再只创建或修改目标 lesson；除非题名或拆分发生变化，不碰其他模块目录。
5. 运行示例、课程审计和静态生成。
6. 若课题存在难以观察的状态、数据流或 UI 结果，按视觉决策树补充可验证实验；禁止默认生成装饰图。
7. 检查 diff，确认没有缩短其他课程、覆盖人工改动或加入构建产物。

一次内容 PR 应保持单一主题。大批量机械迁移与课程扩写分开提交，避免在同一 diff 中混合架构和内容判断。

## 本地检查

课程或通用代码改动至少运行：

```bash
corepack pnpm run curriculum:audit
corepack pnpm generate
```

另外按范围运行：

- 新增示例：逐个执行，并覆盖失败路径
- UI：浏览器验证标题、长正文、源码、复制、答案、上一题/下一题、窄屏和控制台
- 视觉实验：逐步、播放/暂停、重置、键盘、reduced motion、本地图片路径和专属组件
- 构建或依赖：`corepack pnpm install --frozen-lockfile`
- 全部改动：`git diff --check`

`curriculum:audit` 会拒绝重复 id、题名错配、错误路径、残留模板占位符、不满足密度门的深度课程，以及失效的视觉双向索引、章节锚点和资源归属。

## 分支与提交

- 从最新 `main` 创建短生命周期分支。
- 推荐命名：`content/<track>-<topic>`、`fix/<area>-<issue>`、`refactor/<area>`。
- 不直接向 `main` 推送。
- 提交信息使用动词开头并描述结果，例如 `Move curated lessons to Markdown`。
- 每个提交保持可解释；机械迁移、解析器和文档可以分提交，但最终 PR 必须能一起通过检查。
- 不覆盖、reset 或提交他人的未提交文件。

## Pull Request 规范

先以 draft PR 开始，在验证完成后标记 ready。PR 描述必须包含：

- 问题与目标
- 改动范围和明确未改内容
- 关键设计决策及替代方案
- 执行过的命令与结果
- 课程 URL 或页面截图
- 视觉媒介选择、状态证据、图片来源与无动画/减弱动态表现，若适用
- curated 数量变化及下一 pending 课题，若适用
- 风险、兼容性和回退方式

一个 PR 避免同时包含无关重构、依赖升级和课程扩写。审阅者应能从文件列表快速判断边界。

## PR 合并条件

- diff 只包含声明范围内的文件
- 审计、示例和静态生成通过
- 新增事实有官方或源码证据
- 无密钥、个人路径、缓存和构建产物
- UI 改动有浏览器证据
- 所有 review thread 已处理
- 分支与 `main` 无冲突，必需 checks 通过

仓库采用 squash merge；PR 标题应能直接作为主线提交说明。
