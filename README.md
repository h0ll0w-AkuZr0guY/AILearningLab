# Review Lab

面向技术面试与源码复现的 Nuxt 学习工作台。课程围绕官方文档和上游源码设计为“机制解释 → 最小实验 → 真实源码 → 教学复现 → 练习与答案 → 面试追问”，覆盖：

- Python、TypeScript 与 Nuxt
- Transformer、PyTorch、vLLM 与 LoRA / PEFT
- LangChain、LangGraph 与 Deep Agents

课程总纲会根据真实知识复杂度动态拆分或合并课题，不用固定课时数倒推内容。当前深度精写进度与恢复入口见 [`docs/CURRICULUM_RECONSTRUCTION_TARGET.md`](docs/CURRICULUM_RECONSTRUCTION_TARGET.md)。

课程按“路线 → 模块 → 目录 → 单课正文”组织在 `content/curriculum/`。每个模块的 `catalog.md` 保存课题规划、状态和认领人，curated 课程正文独立放在 `lessons/<lesson-id>.md`；可选视觉以同名索引放在 `visuals/<lesson-id>.md`，再按章节锚点动态插入页面。修正文案只需编辑对应单课，修改视觉文字也无需触碰正文或 TypeScript。公共模板、认领流程和优质课索引见 [`docs/CONTRIBUTING_LESSONS.md`](docs/CONTRIBUTING_LESSONS.md)，插图、动画、交互演示与 ImageGen 选择规则见 [`docs/VISUAL_LESSON_STANDARD.md`](docs/VISUAL_LESSON_STANDARD.md)，完整分支、提交与 PR 规范见 [`CONTRIBUTING.md`](CONTRIBUTING.md)。

## 启动

```bash
corepack pnpm install
corepack pnpm dev
```

打开终端显示的本地地址。生成 GitHub Pages 静态产物：

```bash
corepack pnpm generate
```

`.github/workflows/deploy.yml` 会在推送到 `main` 后自动部署到 GitHub Pages。工作流根据仓库名设置 `NUXT_APP_BASE_URL`，因此课程直达链接、上一题 / 下一题和静态资源都能在项目子路径下工作。Pages 发布源使用 **GitHub Actions**。

## 持续维护节奏

发布基线建立后，每个内容批次默认深度精写 5 节。每节都要完成正文、官方锚点、上游源码、带中文注释的教学复现、练习答案、面试实战、内容审计与浏览器验收。第 5 节完成后创建 PR 并暂停，等待下一次课程方向或产品需求。页面缺陷与新组件可以插入维护，但不会被虚报为已完成课程。

## AI 教练

点击页面右上角 **配置 AI**，选择服务商并填入兼容 Chat Completions API 的 Base URL、模型名与 Key。默认不会持久化 Key；只有用户主动勾选时，才会把它保存在当前浏览器的本地存储中。Key 不会进入构建产物或 Git 历史。

静态网页必须由浏览器直连模型 API。因此：

- 服务商支持浏览器 CORS 时，可以直接使用。
- 服务商不支持 CORS 时，可填入本地 OpenAI-compatible 代理或本地模型地址。
- 未配置 AI 时，练习区仍可使用规则化审阅，检查实现入口、验证、失败路径和问题规模。

## 同步官方源码参考

```bash
corepack pnpm references:sync
```

该脚本通过浅克隆与稀疏检出，把课程相关的 CPython、TypeScript、LangChain、LangGraph、Deep Agents、Nuxt、Vue、PyTorch、Transformers 源码关键目录放进未追踪的 `references/`。大型仓库不会自动进入前端构建。
