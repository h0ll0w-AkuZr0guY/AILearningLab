---
lesson: "{{LESSON_ID}}"
track: "{{TRACK_ID}}"
decision: "TODO：说明学习者读完哪一段文字后，仍无法追踪哪一种变化，以及视觉为何比再加一段文字更有效。"
---

<!--
视觉索引是课程正文的可选伴随文件，保存到：
content/curriculum/<track>/<module>/visuals/<lesson-id>.md

正文 frontmatter 同时登记：
visualIndex: "../visuals/<lesson-id>.md"

一个索引可以包含多个视觉块，也可以混用 kind。每个块都必须用 placement 就地插入：
overview | chapter:<从 1 开始的章序号> | mechanisms | build | example

如果视觉没有解决明确障碍，删除索引文件和正文 visualIndex。不要保留空文件或 TODO。
-->

## 视觉实验

### TODO：用动作句命名，例如“让一次请求穿过缓存状态机”

id: "{{LESSON_ID}}-main"
kind: "TODO：state | flow | graph | tensor | playground"
placement: "TODO：overview | chapter:2 | mechanisms | build | example"
summary: "TODO：用完整文字说明学习者能看见什么，它解决相邻正文中的哪个抽象难点。"
caption: "TODO：写清符号含义、信息边界，以及应回到哪段源码、公式或断言验证。"
actionLabel: "TODO：播放状态变化 / 推进图执行 / 切换参数"

#### 步骤

- TODO：输入 | TODO：给出具体输入、shape、状态或触发事件。
- TODO：核心变换 | TODO：描述这一帧真正发生的可验证变化。
- TODO：输出或失败 | TODO：描述最终结果、回退、异常或不变量。

#### 观察重点

- TODO：点击下一步前，先预测哪个量会变、哪个量必须不变。
- TODO：指出一个会让视觉简化与真实代码产生差异的边界条件。

<!--
需要第二种视觉时，继续增加同级 ### 块。只有满足 image 决策条件时才使用以下字段：

### TODO：概念类比标题

id: "{{LESSON_ID}}-metaphor"
kind: "image"
placement: "chapter:2"
summary: "TODO：图片建立哪一种直觉。"
caption: "概念类比：TODO。这里不表示 TODO；精确机制以 TODO 公式、源码或实验为准。"
asset: "/visuals/<track>/<lesson-id>/<descriptive-name>.webp"
alt: "TODO：直接描述主体、空间关系和教学重点。"
credit: "TODO：OpenAI ImageGen 生成并经作者审核；或填写真实来源、作者与许可证。"

#### 观察重点

- TODO：图中哪些部分对应课程概念。
- TODO：哪些部分只是视觉类比，不能据此推出工程结论。
-->
