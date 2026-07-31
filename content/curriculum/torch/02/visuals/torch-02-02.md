---
lesson: "torch-02-02"
track: "torch"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 沿时间线推演「advanced indexing」

id: "torch-02-02-main"
kind: "flow"
placement: "chapter:3"
summary: "`x[[0,2]]`和`x[0:3:2]`都挑两行，底层却完全不同。slice 的地址可由一个 stride 表示；列表中的每个元素都可能跳到任意行，框架只能将选择到的元素 gather 到新输出。这就是“高级索引读取是 copy”的物理理由。"
caption: "箭头表达本课讨论的因果与执行顺序，不承诺真实墙钟时长；并行、失败和回退分支仍以源码与可运行实验为准。"
actionLabel: "播放执行流程"

#### 步骤

- Long/Int index ten | Long/Int index tensor 先广播为共同迭代域。
- 读取按每个位置 gather，输出通 | 读取按每个位置 gather，输出通常拥有独立 Storage。
- 混合不相邻 index 可能先重排维 | 混合不相邻 index 可能先重排维度。
- 赋值走 indexput/scatt | 赋值走 index_put_/scatter，目标仍是原 tensor。
- 运行时坐标表打破仿射地址，gathe | 运行时坐标表打破仿射地址，gather copy 是语义所需，不是偶然优化缺失。

#### 观察重点

- 把两个 `(n,)` index 误当 n×n 笛卡尔积。
- 把 `x[idx]`的 copy 语义套到 `x[idx]=v`。
