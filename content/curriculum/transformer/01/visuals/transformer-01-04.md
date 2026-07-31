---
lesson: "transformer-01-04"
track: "transformer"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 把「矩阵乘法形状」落到可见张量

id: "transformer-01-04-main"
kind: "tensor"
placement: "overview"
summary: "判断矩阵乘法能否执行，只看相邻的两个内维是否相等。A[m,k] @ B[k,n] 中 k 被消去，结果留下外侧的 m 和 n。"
caption: "格子按阶段追踪 shape、数值、stride、storage 或计算边界；精确结论必须继续用维度、数值和断言验证。"
actionLabel: "播放张量变化"

#### 步骤

- 判断矩阵乘法能否执行，只看相邻的两个 | 判断矩阵乘法能否执行，只看相邻的两个内维是否相等。A[m,k] @ B[k,n] 中 k 被消去，结果留下外侧的 m 和 n。
- 推 shape 时不要从元素总数猜结 | 推 shape 时不要从元素总数猜结果。先在纸上写出每条轴的业务名称，再把参与收缩的轴圈出来；Transformer 中最常被收缩的是 hidden dimension 或 head dimension。
- 高维 matmul 对最后两个轴执行 | 高维 matmul 对最后两个轴执行矩阵乘法，前面的轴按 broadcast 规则对齐，因此 Q[B,H,T,Dh] @ Kᵀ[B,H,Dh,T] 得到 [B,H,T,T]。

#### 观察重点

- 点击下一阶段前，先写下你预测的 shape、数值、状态或控制流变化。
- 图示结论必须能被本页可运行示例和至少一个失败用例验证。
