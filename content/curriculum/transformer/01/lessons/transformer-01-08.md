---
id: "transformer-01-08"
track: "transformer"
title: "Jacobian 直觉"
depth: "foundation"
visualIndex: "../visuals/transformer-01-08.md"
exampleLanguage: "python"
---

## 导读

普通导数描述一个输入对一个输出的变化率；Jacobian 把“多个输入影响多个输出”的全部偏导排列成矩阵。若 f: Rⁿ→Rᵐ，Jacobian 的形状是 [m,n]。

深度学习通常不会显式构造完整 Jacobian，因为它可能巨大。反向模式自动微分计算的是向量与 Jacobian 的乘积 VJP，并从标量 loss 向输入高效传播。

理解 Jacobian 的价值在于判断梯度 shape 和依赖关系，而非手算大矩阵。每个局部算子的 VJP 会在 autograd 图上按链式法则组合。


## 可运行示例

```python
import torch

def f(x):
    return torch.stack([x[0] * x[1], x[0] ** 2])

x = torch.tensor([2.0, 3.0], requires_grad=True)
jacobian = torch.autograd.functional.jacobian(f, x)

assert jacobian.shape == (2, 2)
# [[df0/dx0, df0/dx1], [df1/dx0, df1/dx1]]
print(jacobian)
```
