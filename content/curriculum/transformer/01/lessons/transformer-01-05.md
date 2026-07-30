---
id: "transformer-01-05"
track: "transformer"
title: "broadcast 规则"
depth: "foundation"
exampleLanguage: "python"
---

## 导读

broadcast 让不同 shape 的张量在不真实复制数据的情况下参与逐元素运算。比较 shape 时从最后一维向前看，两条轴相等或其中一条为 1 才兼容。

例如 [B,T,D] 加 [D] 时，[D] 会被理解成 [1,1,D]，同一偏置应用到所有 batch 和 token。broadcast 改变的是索引规则，expand 得到的维度可能拥有 stride 0。

隐式 broadcast 很方便，也容易掩盖轴写反。关键代码应先写 shape 断言，并在注释里写清哪条轴被扩展。

## 可运行示例

```python
import torch

x = torch.randn(2, 3, 4)   # [B,T,D]
bias = torch.randn(4)      # [D] -> [1,1,D]
y = x + bias

assert y.shape == (2, 3, 4)
```
