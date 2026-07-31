---
lesson: "transformer-01-02"
track: "transformer"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 把「batch 维度」落到可见张量

id: "transformer-01-02-main"
kind: "tensor"
placement: "overview"
summary: "batch 是为了同时处理多份彼此独立的数据而增加的外层轴。单句隐藏状态可以是 [T,D]，一次送入 B 句话后就成为 [B,T,D]。B 只表示并行样本数量，句子之间不会因为放进同一个 batch 就互相做 attention。"
caption: "格子按阶段追踪 shape、数值、stride、storage 或计算边界；精确结论必须继续用维度、数值和断言验证。"
actionLabel: "播放张量变化"

#### 步骤

- batch 是为了同时处理多份彼此独 | batch 是为了同时处理多份彼此独立的数据而增加的外层轴。单句隐藏状态可以是 [T,D]，一次送入 B 句话后就成为 [B,T,D]。B 只表示并行样本数量，句子之间不会因为放进同一个 batch 就互相做 attention。
- 实现算子时通常把最后几个轴留给核心数 | 实现算子时通常把最后几个轴留给核心数学，把前面的轴看作 batch。例如 [B,T,D] @ [D,H] 会对 B 个样本和 T 个 token 复用同一个 [D,H] 投影，得到 [B,T,H]。
- batch 里的样本长度可能不同，因 | batch 里的样本长度可能不同，因此还需要 padding 和 attention mask。shape 对齐只保证程序能算，mask 才保证填充位置不会污染语义。

#### 观察重点

- 点击下一阶段前，先写下你预测的 shape、数值、状态或控制流变化。
- 图示结论必须能被本页可运行示例和至少一个失败用例验证。
