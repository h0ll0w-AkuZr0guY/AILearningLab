---
id: "transformer-01-03"
track: "transformer"
title: "einsum 记号"
depth: "foundation"
exampleLanguage: "python"
---

## 导读

einsum 用字母给每条轴命名，再声明哪些轴保留、哪些轴求和。它把 transpose、broadcast、multiply 和 sum 合在一个可检查的字符串中。

公式 "btd,dh->bth" 表示：输入分别拥有 [batch,time,dimension] 与 [dimension,hidden]，d 同时出现但没有出现在输出中，所以沿 d 求和；b、t、h 被保留。

einsum 更接近数学推导，但过长表达式会降低可读性。工程中应让字母与 shape 注释对应，并用普通 matmul 版本作为测试基准。

## 可运行示例

```python
import torch

x = torch.randn(2, 3, 4)      # b t d
weight = torch.randn(4, 5)    # d h

by_einsum = torch.einsum("btd,dh->bth", x, weight)
by_matmul = x @ weight

assert by_einsum.shape == (2, 3, 5)
assert torch.allclose(by_einsum, by_matmul)
```
