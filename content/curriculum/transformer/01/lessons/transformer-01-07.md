---
id: "transformer-01-07"
track: "transformer"
title: "softmax 性质"
depth: "foundation"
exampleLanguage: "python"
---

## 导读

softmax 把一组任意实数转换成和为 1 的正数分布。它先对每个值取指数，再除以整组指数之和，因此较大的 logit 会得到更高权重。

直接计算 exp(x) 可能溢出。减去同一行最大值不会改变结果，因为分子分母同时乘了相同常数，却能把最大指数稳定在 exp(0)=1。

axis 决定“哪一组数竞争”。attention score [B,H,T,T] 通常沿最后一维归一化，表示每个 query 在所有 key 上分配权重。

## 可运行示例

```python
import torch

def stable_softmax(x, dim=-1):
    shifted = x - x.max(dim=dim, keepdim=True).values
    exp = shifted.exp()
    return exp / exp.sum(dim=dim, keepdim=True)

x = torch.tensor([[1000.0, 1001.0]])
probs = stable_softmax(x)
assert torch.allclose(probs.sum(-1), torch.ones(1))
```
