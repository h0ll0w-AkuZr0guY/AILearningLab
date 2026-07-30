---
id: "transformer-01-10"
track: "transformer"
title: "数值稳定性"
depth: "foundation"
exampleLanguage: "python"
---

## 导读

浮点数只能表示有限精度和范围。数学上等价的表达式，在计算机里可能因为溢出、下溢或舍入顺序得到不同结果。

稳定实现会主动重写公式，例如 softmax 先减最大值、log(sum(exp(x))) 使用 logsumexp、方差计算避免两个大数相减。

混合精度训练进一步放大范围问题，需要 loss scaling、合适的累加 dtype，并用有限值检查及时暴露 NaN/Inf。

## 可运行示例

```python
import torch

x = torch.tensor([1000.0, 1001.0])

unstable = torch.log(torch.exp(x).sum())   # 可能得到 inf
stable = torch.logsumexp(x, dim=0)

assert torch.isfinite(stable)
print({"unstable": unstable, "stable": stable})
```
