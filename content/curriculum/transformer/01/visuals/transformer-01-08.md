---
lesson: "transformer-01-08"
track: "transformer"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 沿时间线推演「Jacobian 直觉」

id: "transformer-01-08-main"
kind: "flow"
placement: "overview"
summary: "普通导数描述一个输入对一个输出的变化率；Jacobian 把“多个输入影响多个输出”的全部偏导排列成矩阵。若 f: Rⁿ→Rᵐ，Jacobian 的形状是 [m,n]。"
caption: "箭头表达本课讨论的因果与执行顺序，不承诺真实墙钟时长；并行、失败和回退分支仍以源码与可运行实验为准。"
actionLabel: "播放执行流程"

#### 步骤

- 普通导数描述一个输入对一个输出的变化 | 普通导数描述一个输入对一个输出的变化率；Jacobian 把“多个输入影响多个输出”的全部偏导排列成矩阵。若 f: Rⁿ→Rᵐ，Jacobian 的形状是 [m,n]。
- 深度学习通常不会显式构造完整 Jac | 深度学习通常不会显式构造完整 Jacobian，因为它可能巨大。反向模式自动微分计算的是向量与 Jacobian 的乘积 VJP，并从标量 loss 向输入高效传播。
- 理解 Jacobian 的价值在于判 | 理解 Jacobian 的价值在于判断梯度 shape 和依赖关系，而非手算大矩阵。每个局部算子的 VJP 会在 autograd 图上按链式法则组合。

#### 观察重点

- 点击下一阶段前，先写下你预测的 shape、数值、状态或控制流变化。
- 图示结论必须能被本页可运行示例和至少一个失败用例验证。
