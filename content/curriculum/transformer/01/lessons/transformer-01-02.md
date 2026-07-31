---
id: "transformer-01-02"
track: "transformer"
title: "batch 维度"
depth: "foundation"
visualIndex: "../visuals/transformer-01-02.md"
exampleLanguage: "python"
---

## 导读

batch 是为了同时处理多份彼此独立的数据而增加的外层轴。单句隐藏状态可以是 [T,D]，一次送入 B 句话后就成为 [B,T,D]。B 只表示并行样本数量，句子之间不会因为放进同一个 batch 就互相做 attention。

实现算子时通常把最后几个轴留给核心数学，把前面的轴看作 batch。例如 [B,T,D] @ [D,H] 会对 B 个样本和 T 个 token 复用同一个 [D,H] 投影，得到 [B,T,H]。

batch 里的样本长度可能不同，因此还需要 padding 和 attention mask。shape 对齐只保证程序能算，mask 才保证填充位置不会污染语义。


## 可运行示例

```python
import torch

B, T, D, H = 2, 3, 4, 5
x = torch.randn(B, T, D)
weight = torch.randn(D, H)

# 同一份权重自动应用到每个 batch、每个 token
y = x @ weight
assert y.shape == (B, T, H)
```
