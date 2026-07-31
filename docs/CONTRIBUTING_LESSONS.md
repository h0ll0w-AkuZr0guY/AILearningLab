# 贡献单课内容

深度课程采用“一节课一个 Markdown 文件”的边界：

```text
content/
└─ curriculum/
   └─ torch/
      ├─ track.md
      ├─ 01/
      │  ├─ catalog.md
      │  └─ lessons/
      │     └─ torch-01-01.md
      └─ 02/
         ├─ catalog.md
         └─ lessons/
```

`track.md` 只保存路线身份和官方入口；每个模块的 `catalog.md` 保存模块目标、源码范围、课题顺序、认领人和状态；`lessons/` 只保存已经进入写作阶段的单课正文；可选的 `visuals/` 保存与单课同名的视觉索引。`app/data/curriculum.ts` 仅在构建期加载这些 Markdown。稳定的 `track + lesson id` 负责关联 URL，因此修改正文或错别字时无需触碰 TypeScript。

正文模板位于 [`content/templates/deep-lesson.md`](../content/templates/deep-lesson.md)，视觉索引模板位于 [`content/templates/lesson-visuals.md`](../content/templates/lesson-visuals.md)，成品参考见 [`docs/LESSON_REFERENCE_SET.md`](LESSON_REFERENCE_SET.md)，插图、动画、交互演示与 ImageGen 决策见 [`docs/VISUAL_LESSON_STANDARD.md`](VISUAL_LESSON_STANDARD.md)。分支、提交、代码贡献和 PR 规范统一遵循仓库根目录的 [`CONTRIBUTING.md`](../CONTRIBUTING.md)。

## 规划或调整模块

公共模块目录模板位于 [`content/templates/module-catalog.md`](../content/templates/module-catalog.md)。建立或重构一个模块时按以下顺序进行：

1. 阅读路线 `track.md`、前后模块目录和现有优质课，确认模块在整条路线中的输入与输出。
2. 联网核验当前官方文档目录、规范或论文，再查看真实上游仓库的包边界、核心入口、调用链和测试。
3. 估算哪些机制值得独立成课，哪些内容应合并；课题数由证据和可独立验证的学习目标决定。
4. 先只提交或调整该模块的 `catalog.md`。新增课题初始状态为 `pending`，目录仍需讨论时使用 `planningStatus: draft`。
5. 目录稳定后改为 `planningStatus: established`。后续贡献者通过修改单个课题的 `status` 和 `owner` 认领工作。

课题状态只有三种：

- `pending`：尚未认领，`owner` 必须为空。
- `claimed`：正在设计或精写，`owner` 必须填写；正文可以处于工作中，但不会进入线上 curated 索引。
- `curated`：正文、示例、审计与页面验收全部完成；对应 `lessons/<lesson-id>.md` 必须存在。

拆分、合并、改名或调序时只修改目标模块目录，并在 PR 中给出旧 id 到新 id 的映射。已经公开的 URL 不应无说明地消失。

## 修改已有课程

1. 从网页 URL 读出 `track`、模块编号和 `lesson id`。例如 `/tracks/torch/lessons/torch-01-04` 对应 `content/curriculum/torch/01/lessons/torch-01-04.md`。
2. 只编辑这一个 Markdown。普通正文可直接修改；代码保留在 fenced code block 中。
3. 运行：

```bash
corepack pnpm run curriculum:audit
corepack pnpm generate
```

审计会检查文件路径、稳定 id、课程题名、重复内容、章节密度、源码、时间预算和站内答案。构建会验证 Markdown 能被 Nuxt 同时用于 SSR、客户端 hydration 和静态页面生成。

## 创建一节 pending 课程

先从模块 `catalog.md` 中选择 pending lesson id 并认领：

```bash
corepack pnpm curriculum:claim torch torch-02-06 @your-name
corepack pnpm curriculum:new torch torch-02-06
```

认领会把该课状态改成 `claimed` 并写入 `owner`，防止两名贡献者重复开工。脚手架直接读取公共模板，只在对应模块的 `lessons/` 创建缺失文件，永远不会覆盖已有课程。模板中的占位内容全部完成、示例和页面验证通过后，把目录状态改成 `curated`；审计会拒绝状态与正文不一致。

只预览渲染后的模板、不写文件：

```bash
corepack pnpm curriculum:new torch torch-02-06 --stdout
```

## Markdown 契约

Frontmatter 固定保存索引和学习时间：

```yaml
---
id: "torch-01-01"
track: "torch"
title: "课程题名"
depth: "deep"
exampleLanguage: "python"
readingMinutes: 40
sourceMinutes: 30
practiceMinutes: 55
reviewMinutes: 15
---
```

正文使用以下二级标题；深度课程必须完整提供：

- `## 官方入口`
- `## 真实源码`
- `## 导读`
- `## 分章正文`
- `## 核心机制`
- `## 常见误区`
- `## 实现变体`
- `## 可运行示例`
- `## 搭积木复现`
- `## 自检`

分章、变体、积木和自检子项使用三级或四级标题。可以增删章节，但不要修改上述机器契约标题。解析器位于 `app/data/lesson-markdown.ts`，索引层位于 `app/data/topic-guides.ts`。

视觉是逐课可选项，不属于正文的机器契约标题。先完成正文，再判断是否存在“仅靠文字仍难以追踪”的变化；有需要时复制视觉索引模板，在正文 frontmatter 登记 `visualIndex`，并将一个或多个视觉块锚定到相邻章节。默认选择最合适的 `state`、`flow`、`graph`、`tensor` 或 `playground`，只有现实场景和空间类比才使用 `image`。需要真实 UI 或运行时演示时，在 `app/components/lesson-visuals/<lesson-id>/` 增加独立 Vue 组件。完整目录层级、固定锚点、ImageGen 提示词、无障碍和 PR 清单以视觉标准为准。

## 为什么保留薄 TypeScript 层

页面仍需要类型、稳定索引、重复检测和构建期错误。TypeScript 层只完成解析与组装，不存放路线、模块、课题目录或单课正文。Vite 通过 `import.meta.glob(..., { eager: true, query: '?raw' })` 在构建期收集 Markdown；新增目录和文件会自动进入索引，无需手写 import。

设计依据可参考 [Vite Glob Import](https://vite.dev/guide/features.html#glob-import) 与 [Vite Raw Asset Import](https://vite.dev/guide/assets.html#importing-asset-as-string)。
