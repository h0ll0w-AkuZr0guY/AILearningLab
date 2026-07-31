---
id: "transformer-01-09"
track: "transformer"
title: "计算复杂度"
depth: "foundation"
visualIndex: "../visuals/transformer-01-09.md"
exampleLanguage: "python"
---

## 导读

复杂度估算回答规模扩大后计算量和内存如何增长。A[m,k] @ B[k,n] 需要大约 m·k·n 次乘加，结果本身占 m·n 个元素。

标准 self-attention 的 score 矩阵形状为 [T,T]，因此序列长度 T 翻倍时，score 相关计算和显存约增长到四倍。隐藏维和 head 数则影响常数与投影开销。

工程优化前应先找主导项，再结合硬件判断真正瓶颈。相同 FLOPs 可能受计算吞吐、内存带宽或 kernel launch 限制。


## 可运行示例

```python
def matmul_flops(m: int, k: int, n: int) -> int:
    # 每个输出元素执行 k 次乘法和约 k 次加法
    return 2 * m * k * n

assert matmul_flops(128, 768, 768) == 2 * 128 * 768 * 768
```
