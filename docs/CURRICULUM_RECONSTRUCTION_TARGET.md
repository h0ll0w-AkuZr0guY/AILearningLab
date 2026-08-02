# AILearningLab 课程重构目标与恢复手册

本文件保存当前可执行的课程状态、质量队列与发布门禁。它不记录过期批次流水；课程的贡献时间线只保留在各自 Markdown 的 `## 更新日志` 中，历史记录不得改写。

## 当前状态

| 路线 | 最终课题 | curated | pending | 说明 |
| --- | ---: | ---: | ---: | --- |
| Python | 41 | 10 | 31 | 已从 102 篇首轮短文压缩为 8 个模块的最终课题。 |
| TypeScript | 20 | 13 | 7 | 已有课程需要修复源码版本与历史日志。 |
| LangGraph | 20 | 20 | 0 | 已完成当前目录。 |
| Transformer | 10 | 10 | 0 | 现有 foundation 短文的状态与深度不匹配，等待重构决定。 |
| PyTorch | 20 | 20 | 0 | 已完成当前目录。 |
| LangChain | 12 | 5 | 7 | 等待后续深化。 |
| vLLM | 11 | 11 | 0 | 已完成当前目录。 |
| Nuxt / Deep Agents / LoRA | 0 | 0 | 0 | 全部模块仍为 draft，不能认领。 |

普通审计以当前 `catalog.md` 与正文文件为准；严格审计只有在所有 established 路线没有 pending 后才会通过。不得通过删减 pending、降低审计阈值、把 fallback 标为 curated 或保留旧短文来伪造完成度。

## Python 压缩重构

Python 的旧版目录将大量互相依赖的机制拆成 102 篇 foundation 短文，同时却缺少固定源码、完整示例、站内答案、时间预算和有根据的视觉决策。它们已从索引中撤下，不能作为深度课程或参考样例。

最终路线定义在 [`content/curriculum/python/track.md`](../content/curriculum/python/track.md)：

- 8 个 established 模块，41 个最终课题。
- 模块 01 与模块 02 各五篇课程已按当前完整契约重写并通过普通审计。
- 余下课程全部 `pending`；它们必须逐课使用第一方资料重写，而不能从旧短文机械扩写。
- 最新完成批次为 `python-02-01` 至 `python-02-05`：属性主路径、descriptor 优先级、函数绑定、C3/super、对象形状演化。下一 pending 是模块 03 的 `python-03-01` 至 `python-03-05`。

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

已配置的 `AILearningLab 课程深化与发布` 自动任务优先完成 Python 的 31 个 pending 终题，之后按照 established 模块的动态候选池继续其他路线。它使用与手动批次相同的恢复、证据、审计、PR、合并与 Pages 门禁；调度只是唤醒来源，不能放宽质量标准。
