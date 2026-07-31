# 课程视觉实验标准

本标准把插图、动画和交互演示视为可选的课程证据。目标是让学习者能够先观察，再预测，再操作，最后回到公式、源码和断言验证。每节课必须作出视觉决策，但“本课不需要视觉”也是有效结论。视觉内容不能只是文章配图，也不能用漂亮动画掩盖未经核验的机制。

课程正文模板位于 [`content/templates/deep-lesson.md`](../content/templates/deep-lesson.md)，视觉索引模板位于 [`content/templates/lesson-visuals.md`](../content/templates/lesson-visuals.md)，视觉渲染器位于 [`app/components/LessonVisualLab.vue`](../app/components/LessonVisualLab.vue)。正文与视觉索引分离，使没有前端背景的贡献者仍能独立修改课程文字。需要专属交互时，每个实验使用独立 Vue 文件，放在 `app/components/lesson-visuals/<lesson-id>/`，视觉索引只登记稳定组件路径。

## 1. 先定义学习障碍

编写视觉内容前先用一句话回答：

> 学习者读完文字后，仍然无法在脑中追踪哪一种变化？

只有答案足够具体，才开始选择媒介。例如：

- “看不见名称 rebinding 后两个对象的引用关系”适合状态图。
- “分不清 task、microtask 和渲染机会的先后”适合可单步动画。
- “不知道 LangGraph super-step 中哪个节点正在执行、何时进入 barrier”适合图节点流。
- “无法从 shape 推断 stride、storage_offset 和复制边界”适合张量格子。
- “不知道属性切换后按钮、布局、路由或服务端渲染会出现什么效果”适合交互 playground。
- “抽象概念缺少空间或现实经验类比”才考虑 ImageGen。

若一句话只剩“让页面更好看”，不应增加视觉块。

## 2. 媒介选择决策树

按以下顺序判断，命中后停止：

1. **真实 UI 或运行结果能直接展示吗？**
   - 能：使用 `playground`。让用户改变参数，并在同一区域立刻看到结果和相关代码。
   - 典型课程：Nuxt 组件、CSS、表单、路由、hydration、TypeScript/JavaScript 行为对比。
2. **知识核心是离散状态随时间变化吗？**
   - 是：对象/生命周期用 `state`，顺序管线用 `flow`，节点拓扑用 `graph`，张量或矩阵用 `tensor`。
3. **只需要一张精确、可缩放且可复核的结构图吗？**
   - 是：仍使用上述代码原生类型并保持静止。简单形状、箭头、坐标、内存格和公式禁止交给 ImageGen。
4. **知识依赖真实外观、历史界面、复杂空间场景或视觉类比吗？**
   - 是：可以使用 `image`，并遵循 ImageGen/来源审计。
5. **没有视觉表达能比文字和代码更清楚吗？**
   - 不增加视觉块。媒介数量不是质量指标。

### 类型速查

| kind | 用于 | 必须让人看见 | 不适合 |
| --- | --- | --- | --- |
| `state` | 对象、绑定、生命周期、队列状态 | 前一状态、当前状态、不变量 | 大规模拓扑 |
| `flow` | 解析、编译、调度、请求、错误传播 | 输入沿阶段推进 | 并行和分支图 |
| `graph` | LangGraph、依赖图、消息流、DAG/SCC | 节点、边、当前执行位置 | 精确数值矩阵 |
| `tensor` | shape、stride、矩阵、概率、梯度 | 维度/格子与当前变换 | 真实 UI |
| `playground` | 参数、属性、UI、运行时模式切换 | 控件、即时结果、代码/状态证据 | 只需阅读的静态概念 |
| `image` | 现实场景、空间类比、历史界面 | 难以代码绘制的整体直觉 | 公式、源码、精确拓扑、文字密集图 |

## 3. 目录层级、索引与展示位置

课程正文必须保持完整，即使移除视觉资源也能从头到尾学习。视觉通过伴随索引动态加入：

```text
content/curriculum/<track>/<module>/
├─ lessons/
│  └─ <lesson-id>.md                 # 完整正文，只登记 visualIndex
└─ visuals/
   └─ <lesson-id>.md                 # 本题全部视觉的文字索引

public/visuals/<track>/<lesson-id>/   # 位图、视频等静态资产
app/components/lesson-visuals/
└─ <lesson-id>/<component>.vue       # 只有真实交互需要代码时才存在
```

正文 frontmatter 只增加一条可选索引：

```yaml
visualIndex: "../visuals/<lesson-id>.md"
```

没有视觉时不写该字段，也不建立空索引。一个索引允许多个视觉块和多个 kind；它们按 `placement` 插入固定叙事锚点：

| placement | 展示位置 | 适合回答的问题 |
| --- | --- | --- |
| `overview` | 导读与核心解释之后 | 先建立全课心智模型 |
| `chapter:N` | 第 N 章正文、代码与本章结论之后 | 紧贴刚解释的局部机制 |
| `mechanisms` | 运行机制清单之后 | 串起多个离散机制 |
| `build` | 搭积木复现之后 | 对照实现阶段和状态 |
| `example` | 完整可运行示例之后 | 操作真实 UI 或运行时结果 |

优先选择 `chapter:N`，让视觉紧邻其解释。`placement` 是稳定的结构锚点，不引用会随改写变化的标题字符串。课程拆分、合并或调整章节顺序时，贡献者必须复核所有 `chapter:N`。页面缺少资源时保留完整正文；审计会阻止失效索引进入发布。

视觉索引的 frontmatter 记录对应试题与决策理由：

```yaml
---
lesson: "lesson-id"
track: "track-id"
decision: "读完第二章后仍难以追踪 reducer 并行合并，因此用节点图逐步展示。"
---
```

非图片实验最少三个步骤。每个视觉都必须同时提供文字解释，视觉不能成为唯一信息通道。

```markdown
## 视觉实验

### 让一次请求穿过缓存状态机

id: "lesson-id-main"
kind: "state"
placement: "chapter:2"
summary: "学习者能观察命中、回源和写回时，缓存状态与返回路径如何变化。"
caption: "蓝色表示当前阶段；图中省略跨节点一致性，生产结论需回到源码与并发测试。"
actionLabel: "播放状态变化"

#### 步骤

- 未命中 | key 不在缓存中，请求必须进入回源分支。
- 回源中 | 同一 key 建立进行中状态，避免重复穿透。
- 写回完成 | value 与过期时间一起落入缓存，再向调用者返回。

#### 观察重点

- 推进前预测哪一个状态允许第二个请求复用结果。
- 用并发失败用例验证图中省略的异常清理。
```

字段约束：

- `id`：全课唯一，格式建议为 `<lesson-id>-<purpose>`。
- `kind`：只能使用模板列出的六种值。
- `placement`：只使用上表的固定锚点，决定视觉在正文中的展示位置。
- `summary`：解释实验解决的抽象难点，不复述标题。
- `caption`：声明符号含义、信息边界和验证入口。
- `actionLabel`：描述真实动作，例如“推进 super-step”，避免“点击这里”。
- `步骤`：`短标签 | 具体状态变化`。标签短且唯一，右侧必须能被正文、源码或实验验证。
- `观察重点`：至少一条预测任务和一条证据任务。

## 4. 动画与交互要求

动画只在时间顺序本身承载知识时使用。视觉变化应由离散状态驱动，避免连续运动让学习者错把插值过程当作算法。

必须满足：

- 默认静止，由用户主动播放。
- 提供上一步、下一步、暂停和重置；自定义 playground 至少提供单步和重置。
- 当前阶段同时使用文字、位置或形状表达，不能只靠颜色。
- 状态说明通过 `aria-live` 更新，按钮可用键盘操作。
- CSS 尊重 `prefers-reduced-motion`。
- 自动播放不得无限循环；持续运动超过五秒时必须可以暂停或停止。
- 移动端不能依赖 hover，也不能因横向溢出遮住控制按钮。
- 动画结束后的状态必须与逐步点击得到的状态一致。

实现优先使用 Vue 的状态绑定、`<Transition>` 与 CSS。只有路径插值、物理模拟或大量对象协调确实需要时才引入动画库，并在 PR 中解释依赖成本。Vue 官方允许通过状态、CSS class 和内建 Transition 驱动动画；W3C 要求持续运动提供暂停/停止机制，系统减弱动态偏好应通过 `prefers-reduced-motion` 落实：

- [Vue Transition](https://vuejs.org/guide/built-ins/transition.html)
- [Vue Animation Techniques](https://vuejs.org/guide/extras/animation)
- [W3C WCAG Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)
- [MDN prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion)

## 5. Playground 与专属 Vue 组件

通用 `playground` 适合三到五个声明式状态。如果课程需要真实按钮、表单、队列、路由或布局行为：

1. 在 `app/components/lesson-visuals/<lesson-id>/` 新建一个短小、独立的 Vue 文件。
2. 文件名使用小写 kebab-case，例如 `event-loop-queues.vue`。
3. 在视觉索引加入 `component: "<lesson-id>/event-loop-queues"`。
4. 组件通过 `visual` prop 读取标题、caption 和步骤，不复制整篇课程内容。
5. 组件只实现本课可观察机制，不加入网络请求、任意代码执行或隐蔽全局状态。
6. TS/JS、参数或样式切换必须改变真实预览或可验证状态，不能只改变标签。
7. 至少提供重置，并为每个关键状态写浏览器验收断言。

一个课程一个组件文件，避免重新形成集中式巨型 TS/Vue 数据文件。若多个课程共享完全相同的交互原语，可以抽取无课程文案的基础组件；课程专属状态和说明仍保留在各自 Markdown。

## 6. ImageGen 使用边界

### 适合 ImageGen

- 真实世界设备、工作环境或历史情境。
- 难以用简单几何构造的空间类比。
- 需要统一风格的课程章节插画。
- 插画本身不承担数值、文字或拓扑精度。

### 禁止交给 ImageGen

- shape、stride、矩阵元素、图边、队列顺序、公式和源码路径。
- 必须逐字正确的界面文字、代码或 API 名。
- 可由 SVG/HTML/CSS 准确生成的简单流程图。
- 任何会被学习者当作真实执行证据的画面。

### 提示词固定结构

```text
Use case: scientific-educational
Asset type: <课程概念类比 / 场景化插画>
Primary request: <想建立的单一心智模型>
Scene/backdrop: <环境>
Subject: <主体及其关系>
Style/medium: <统一风格>
Composition/framing: <横竖比例、视觉流和留白>
Lighting/mood: <必要时填写>
Color palette: <项目色板>
Constraints: no text; no formulas; no logos; no watermark; <事实约束>
Avoid: <容易制造错误理解的元素>
```

流程：

1. 先写视觉目标、事实边界和禁用项，再生成。
2. 每次生成一个不同资产，不能用一次调用混合多个课题。
3. 人工检查主体、空间关系、文字、伪公式、品牌和水印。
4. 只做一项针对性修改后重新检查，避免整张图漂移。
5. 最终资产复制到 `public/visuals/<track>/<lesson-id>/`，使用描述性小写文件名。
6. 优先输出 WebP；保留足以覆盖桌面双栏的尺寸，并控制文件体积。
7. Markdown 填写中文 `alt`、`caption` 和 `credit`。
8. caption 必须明确“这是类比”以及不能据此推出的结论。

图片块示例：

```markdown
### 把概率分配想成一束可重新分配的光

id: "transformer-01-07-metaphor"
kind: "image"
placement: "chapter:2"
summary: "用不同亮度建立相对权重直觉。"
caption: "概念类比：光束只表达相对强调与总量约束；指数运算和数值稳定性仍以公式实验为准。"
asset: "/visuals/transformer/transformer-01-07/softmax-attention-metaphor.webp"
alt: "一束顶灯将不同强度的光分配到五本打开的书上，中央书最亮"
credit: "OpenAI ImageGen 生成；课程作者审核后作为概念类比使用。"

#### 观察重点

- 图像对应相对权重，不表示真实注意力拓扑。
- 若图像与可运行数值冲突，以数值和官方定义为准。
```

## 7. 不同课程的首选模式

- **TypeScript / Nuxt**：真实组件和运行结果常适合 playground；结构类型、控制流与模块关系也可能更适合 state、flow 或 graph。
- **LangGraph / LangChain / Deep Agents**：拓扑常适合 graph；checkpoint 生命周期可用 state，调度与错误传播可用 flow。
- **PyTorch / Transformer / vLLM / LoRA**：数值变换常适合 tensor；调度、复制与内存生命周期也可能需要 flow 或 state。
- **Python**：本轮已有深化课程暂不补视觉。未来若某课确有障碍，仍应重新走决策树，而非根据赛道默认生成。

这些只是首选，不替代课题分析。一节课可以有两个视觉块，但每个块必须解决不同学习障碍。

## 8. AI 编写流程

无论使用 Sol 还是 Terra，严格执行以下顺序：

1. 读取课程 Markdown、官方章节、真实源码和可运行示例。
2. 写出“仍然看不见的变化”一句话。
3. 从决策树选择唯一首选媒介，并解释为何其他媒介更弱。
4. 先在纸面列出 3–5 个离散状态，每个状态绑定一个证据。
5. 复制视觉索引模板，选择 `placement`，将状态与文字写入伴随索引，再运行课程审计。若视觉不优于文字，到此删除索引并记录“不需要”。
6. 只有通用渲染器无法表达真实交互时，才新增独立 Vue 组件。
7. 只有代码原生图无法表达场景或类比时，才调用 ImageGen。
8. 在本地静态构建中，用浏览器逐步点击并检查移动端。
9. PR 描述列出视觉类型、证据来源、交互路径、减弱动态表现和图片来源。
10. Pages 部署后随机抽查至少一节通用视觉、一节专属 playground 和一张图片课程。

模型不得自行跳过步骤，也不能因为上下文不足生成通用装饰图。缺少源码证据时，视觉块保持未完成并停止进入 curated。

## 9. PR 验收清单

- [ ] 已记录视觉决策；选择“不需要”时没有空索引或装饰资产。
- [ ] 有视觉时，visualIndex、伴随文件和 placement 双向对应。
- [ ] 视觉块解决了正文中明确指出的学习障碍。
- [ ] 状态、节点、shape 或交互结果可被代码/源码验证。
- [ ] 非图片实验至少三个步骤，标签唯一。
- [ ] 动画默认静止，可单步、暂停和重置。
- [ ] 键盘、移动端和 reduced motion 可用。
- [ ] 图像有本地资源、中文 alt、credit 和类比边界。
- [ ] 没有把 ImageGen 画面当作公式或源码证据。
- [ ] 专属组件按 lesson-id 分层，没有复制课程正文。
- [ ] `pnpm curriculum:audit` 与 `pnpm generate` 通过。
- [ ] Pages 上的按钮、长标题、分栏、控制台和资源路径正常。
