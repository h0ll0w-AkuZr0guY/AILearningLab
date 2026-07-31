---
lesson: "transformer-01-07"
track: "transformer"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 把「softmax 性质」落到可见张量

id: "transformer-01-07-main"
kind: "tensor"
placement: "overview"
summary: "softmax 把一组任意实数转换成和为 1 的正数分布。它先对每个值取指数，再除以整组指数之和，因此较大的 logit 会得到更高权重。"
caption: "格子按阶段追踪 shape、数值、stride、storage 或计算边界；精确结论必须继续用维度、数值和断言验证。"
actionLabel: "播放张量变化"

#### 步骤

- softmax 把一组任意实数转换成 | softmax 把一组任意实数转换成和为 1 的正数分布。它先对每个值取指数，再除以整组指数之和，因此较大的 logit 会得到更高权重。
- 直接计算 exp(x) 可能溢出 | 直接计算 exp(x) 可能溢出。减去同一行最大值不会改变结果，因为分子分母同时乘了相同常数，却能把最大指数稳定在 exp(0)=1。
- axis 决定“哪一组数竞争” | axis 决定“哪一组数竞争”。attention score [B,H,T,T] 通常沿最后一维归一化，表示每个 query 在所有 key 上分配权重。

#### 观察重点

- 点击下一阶段前，先写下你预测的 shape、数值、状态或控制流变化。
- 图示结论必须能被本页可运行示例和至少一个失败用例验证。

### 把概率分配想成一束可重新分配的光

id: "transformer-01-07-metaphor"
kind: "image"
placement: "overview"
summary: "一束固定来源的光落到多个阅读对象上，最亮处代表较大的归一化权重；它帮助建立分配直觉，但不承担公式证明。"
caption: "概念类比：softmax 把一组分数映射为总和为 1 的正权重。光束只表达“相对强调与总量约束”，温度、指数运算和数值稳定性仍以本页公式实验为准。"
asset: "/visuals/transformer/transformer-01-07/softmax-attention-metaphor.png"
alt: "深色图书馆中，一束顶灯将不同强度的光分配到五本打开的书上，中央书最亮，其余书保持较弱照明"
credit: "OpenAI ImageGen 生成；课程作者审核后作为概念类比使用。"

#### 观察重点

- 图像只负责建立“相对权重重新分配”的空间类比，不表示真实注意力计算拓扑。
- 若类比与公式、可运行数值或官方定义冲突，应以可验证证据为准。
