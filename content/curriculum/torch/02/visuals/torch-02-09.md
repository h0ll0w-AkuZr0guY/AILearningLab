---
lesson: "torch-02-09"
track: "torch"
decision: "读完正文仍看不见「一条方程如何变成一次 bmm」：文字能说清四类维度的定义，却无法让人追踪某一个具体维度在 permute、reshape、bmm、逆 permute 四步里各自落到什么位置。这是一条有严格先后的降解流水线，用 flow 逐步推进 'bij,bjk->bik' 这一具体方程，能把抽象的 lro/lo/ro 分类绑定到看得见的维序变化上。"
---

## 视觉实验

### 追踪一条方程降解成 bmm

id: "torch-02-09-lowering-pipeline"
kind: "flow"
placement: "chapter:4"
summary: "以 'bij,bjk->bik' 为例逐阶段推进：先给每一维贴上收缩维、lro、lo、ro 四类标签，再把左操作数摆成 (lro, lo, sum)、右操作数摆成 (lro, sum, ro)，压成三维后调用一次 bmm，最后用逆置换还原方程要求的维序。"
caption: "每个阶段显示两个操作数当前的 shape 与维度标签；图中省略了 opt_einsum 的多操作数路径规划与 swap_lo_ro 的内存序优化，真实降解仍以 sumproduct_pair 源码与 torch.allclose 对拍为准。"
actionLabel: "推进一个降解阶段"

#### 步骤

- 标注维度 | b 同时出现在左右和输出，是 lro；i 只在左且在输出，是 lo；k 只在右且在输出，是 ro；j 跨操作数且不在输出，是收缩维。
- 摆左操作数 | 按 (lro, lo, sum) 把左侧 permute 成 (b, i, j)，再 reshape 成三维 (b, i, j)，此时 j 已经排到最后一维。
- 摆右操作数 | 按 (lro, sum, ro) 把右侧 permute 成 (b, j, k)，reshape 后 j 排在中间，正好对上 bmm 要求的收缩位置。
- 执行 bmm | 一次批量矩阵乘吃掉 j 维，得到 (b, i, k)，这是整条流水线里唯一真正消耗算力的步骤。
- 还原维序 | 用 opermutation 把 (lro, lo, ro) 摆回方程声明的输出顺序，本例已经是 bik，无需额外搬运。

#### 观察重点

- 推进到「执行 bmm」前先预测：如果把方程改成 'bij,bjk->bki'，哪一步会多出一次 permute，swap_lo_ro 是否会被触发。
- 用示例里的 torch.allclose(torch.einsum('bij,bjk->bik', X, Y), torch.bmm(X, Y)) 核对终态数值，再把 b 换成省略号确认批量维改走广播后结果不变。
