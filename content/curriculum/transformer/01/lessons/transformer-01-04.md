---
id: "transformer-01-04"
track: "transformer"
title: "矩阵乘法形状"
depth: "foundation"
exampleLanguage: "python"
---

## 导读

判断矩阵乘法能否执行，只看相邻的两个内维是否相等。A[m,k] @ B[k,n] 中 k 被消去，结果留下外侧的 m 和 n。

推 shape 时不要从元素总数猜结果。先在纸上写出每条轴的业务名称，再把参与收缩的轴圈出来；Transformer 中最常被收缩的是 hidden dimension 或 head dimension。

高维 matmul 对最后两个轴执行矩阵乘法，前面的轴按 broadcast 规则对齐，因此 Q[B,H,T,Dh] @ Kᵀ[B,H,Dh,T] 得到 [B,H,T,T]。

## 可运行示例

```python
import torch

Q = torch.randn(2, 8, 16, 64)          # [B,H,T,Dh]
K = torch.randn(2, 8, 16, 64)
scores = Q @ K.transpose(-2, -1)        # [B,H,T,T]

assert scores.shape == (2, 8, 16, 16)
```
