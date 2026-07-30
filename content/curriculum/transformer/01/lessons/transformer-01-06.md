---
id: "transformer-01-06"
track: "transformer"
title: "范数与归一化"
depth: "foundation"
exampleLanguage: "python"
---

## 导读

范数把一个向量压缩成描述“大小”的标量。L2 范数是各分量平方和再开方；归一化通常用向量除以范数，使方向保留而尺度受控。

神经网络里的 LayerNorm 并非简单 L2 归一化。它沿指定特征轴计算均值与方差，再用可学习的缩放和偏移恢复表达能力。

必须明确沿哪条轴归一化。对 [B,T,D] 的隐藏状态，LayerNorm 通常沿 D 处理每个 token，而不会把不同 batch 或 token 混在一起。

## 可运行示例

```python
import torch

x = torch.tensor([3.0, 4.0])
norm = torch.linalg.vector_norm(x)
unit = x / norm

assert norm.item() == 5.0
assert torch.allclose(torch.linalg.vector_norm(unit), torch.tensor(1.0))
```
