---
id: "torch-02-03"
track: "torch"
title: "boolean mask"
depth: "deep"
exampleLanguage: "python"
readingMinutes: 25
sourceMinutes: 25
practiceMinutes: 55
reviewMinutes: 15
---

## 官方入口

title: "PyTorch 2.13 · Tensor Views / boolean indexing"
url: "https://docs.pytorch.org/docs/stable/tensor_view.html#tensor-views"

官方将 mask 归为 advanced indexing：读取返回 copy；掩码必须能与被索引维的形状对应，输出元素数由 True 的数量决定。

## 真实源码

repo: "pytorch/pytorch"
file: "aten/src/ATen/native/TensorAdvancedIndexing.cpp"
symbol: "boolean mask expansion"
language: "cpp"
url: "https://github.com/pytorch/pytorch/blob/v2.13.0/aten/src/ATen/native/TensorAdvancedIndexing.cpp#L1-L27"

### 逐段讲解

- mask 不是“值为零就跳过”的算子参数，而是动态坐标集合的描述。
- 框架把 Bool/Byte mask 展开为 long 坐标，之后走与高级索引相同的 gather 语义。
- mask rank 会消费相应数量输入维，因此 `(B,T)` mask 与 `(B,T,D)`值的组合需要明确剩余 feature 维。
- 内部 unsafe 路径服务编译器优化；eager 代码必须保留范围、dtype、shape 与动态输出检查。

### 源码节选

```cpp
// v2.13.0 文件头说明了 bool/byte mask 的索引语义。
// index 的输入是 Long、Bool、Byte tensor 或 null 的列表。
// Byte/Bool mask 在逻辑上经由 nonzero() 展开成 long indices。
// 一个 mask 会消费与其 rank 相同数量的输入维度。
// 所有 index tensors 随后共同 broadcast 并逐元素迭代。
// 因而输出长度取决于数据中 True 的数目，不能由静态 stride 表达。
Tensor _unsafe_masked_index(
    const Tensor& self, const Tensor& mask,
    const torch::List<std::optional<Tensor>>& indices,
    const Scalar& fill) {
  // 编译器内部路径在 mask=false 时避免读取越界 index。
  auto result = at::_unsafe_index(self, indices);
  return result.masked_fill(at::logical_not(mask), fill);
  // eager 代码不可把 unsafe 当普通 API；它省略了关键检查。
}
```

## 导读

布尔 mask 像筛子，却不只是逐元素 if。`x[mask]`把满足条件的元素压成一维或保留未被 mask 消费的尾维；输出长度依赖实际 True 数。它天然是动态 shape，也就无法像 slice 那样由固定 stride 表示为 view。

读取 mask 是 gather copy，赋值 `x[mask]=v`是 scatter 写回。mask 与比较表达式常一起出现，例如过滤 padding、丢弃坏样本或更新符合条件的参数；因此必须把读写、长度、梯度和重复逻辑拆开审计。

本课独立于通用高级索引，因为 mask 会携带数据相关的输出长度。这个边界会影响 DataLoader 拼批、torch.compile 图捕获、导出 shape 合同与线上内存预算。

## 分章正文

### mask 消费哪些维度

kicker: "01 · SHAPE"

若 `x.shape=(2,3,4)`、`mask.shape=(2,3)`，`x[mask]`选择前两维中每个 True 对应的一整条 feature，结果 shape 为 `(true_count,4)`。若 mask 形状与 x 完全相同，结果通常为一维 `(true_count,)`。先写 mask 消费的维，而非先猜输出。

mask 不可随意把任意尺寸 broadcast 成想要的筛子。应在入口把业务 mask 规范成明确 rank，并用 `torch.broadcast_shapes`或断言提前给出可读错误，避免在大 batch 上才出现不透明的 indexing 异常。

#### 本章结论

mask 的 rank 是索引合同的一部分，True 数是运行时输出维。

### 为何结果必须物化

kicker: "02 · COPY"

True 的地址集合取决于数据，可能是 0、1 或任意多个点，并不构成固定等差地址序列。框架需要枚举坐标并 gather 到一块新 buffer，所以修改 `selected`不应回写 base。

每轮训练若先生成巨大 bool mask 再选出少量元素，既要存 mask 又要存 gather 结果。可比较 `masked_select`、`where`、保留形状的乘法掩码与索引式过滤：它们的计算、显存和下游 shape 合同不同。

#### 本章结论

mask 读取的 copy 是动态稀疏选择的必然结果。

### mask 赋值为何仍是原地 scatter

kicker: "03 · WRITE"

`x[mask]=0`把标量广播给被选位置，直接更新 x；`x[mask]=values`要求 values 能匹配被选位置数或可广播。它并没有先构造 `x[mask]`的 copy 再猜如何回填。

反向与原地写要格外慎重。对需要梯度、且 forward 已保存的 tensor，mask 写会改变版本计数；安全的函数式替代是 `torch.where(mask, replacement, x)`，它分配新结果但保留清晰的数据流。

#### 本章结论

mask read 是 gather，mask write 是 scatter；同一方括号语法隐藏两条反向数据流。

### 动态长度如何影响编译与批处理

kicker: "04 · DYNAMIC"

`true_count`在不同 batch 中变化，后续 `view(batch,-1)`或固定长度 all-gather 很容易失效。需要固定形状时，改用 `where`保留原 shape，或先 top-k/采样并显式 pad 与返回长度。

图编译器可以处理一部分动态形状，却需要 guard 与正确的范围假设。不要为了“让图稳定”把非法样本静默截断；应记录每批 true_count 分布，把异常的全空、全真和极端稀疏作为数据质量信号。

#### 本章结论

动态输出不是麻烦细节，而是 API、编译和通信协议的一部分。

### 用计数与坐标双证据验收

kicker: "05 · TEST"

最小测试应断言 `selected.shape[0] == mask.sum()`，再用坐标编码值检查选择顺序。只断言元素集合会漏掉顺序错误；只测一张全真 mask 会漏掉空输出与 rank 消费边界。

工程测试还要分开测读取不 alias、赋值确实修改 base、requires_grad 的安全替代以及长序列上的峰值内存。对于来自外部请求的 mask，设置最大 true_count 与输出字节预算，防止广播后的 mask 触发非预期大 gather。

#### 本章结论

mask 的正确性证据至少包含 count、值序、所有权与空集边界。

### 为变长选择设计稳定的数据管线

kicker: "06 · PIPELINE"

训练与服务常将 bool mask 同时用于损失、日志和通信。若直接用 `x[mask]`把 token 压缩为 N 条记录，N 会随 batch 波动；随后拼接、分布式 all-gather 或固定预分配 buffer 都必须携带 length。一个稳健协议是同时返回 `selected`、每个 batch 的 count 和可逆的原位置索引，消费者据此决定拼接、pad 或散回。只返回紧凑 tensor 会让下游在 N 恰好为零、或不同 worker 的 N 不同时才暴露错误。

另一条路径是保留 `(B,T,D)`几何：用 `where`填充无效位置，再把 mask 传给 reduction，令分母用有效 token 数而非总长度。它多处理了一些填充值，却让 kernel、编译和通信面对稳定 shape。选择哪条路由取决于有效率和后续算子，而非“mask 更简洁”。基准应记录 true_count 分布、峰值内存、吞吐和梯度是否只来自有效项；验证空 mask 时 loss、归一化和指标都应有明确定义，不能依赖 NaN 恰好暴露数据问题。

#### 本章结论

mask 的核心工程问题是动态长度传播：压缩时携带长度和位置，保形时携带有效性与正确分母。

### 为异常样本保留可解释性

kicker: "07 · FAILURE"

mask 常来自阈值、缺失值检测或业务权限，因此全空未必是正常 batch。日志应区分无有效项、阈值配置过严与 mask shape 错位，记录总元素、true_count、每样本计数及来源版本。调试时不要把大 tensor 转成 Python list，这会同步设备并破坏性能观测；仅抽样坐标、保留聚合统计，再用小样本复现。需要追溯的过滤应保存原位置 index，而非只保存压缩值。

#### 本章结论

mask 的空集既是业务事件也是数值边界，应被显式记录。

### 用同一批数据比较两种流向

kicker: "08 · PRACTICE"

准备含 padding 的 `(B,T,D)`激活和 `(B,T)`mask：一路用 `x[mask]`得到紧凑结果并保存 count 与位置；另一路用 where 保留原 shape，再以 mask 作为 reduction 权重。分别验证有效元素的和与梯度一致，比较空 mask、半满 mask 和几乎全满 mask 的输出 shape、峰值内存与耗时。这个对照会把“压缩减少计算”与“固定形状减少系统复杂度”的边界变成可测证据。

#### 本章结论

练习应同时覆盖压缩和保形路径，才能为真实管线选择 mask 策略。

## 核心机制

- Bool/Byte mask 逻辑上展开为 long 坐标。
- 输出形状由 True 数与未消费的尾维决定。
- 读取 materialize，赋值对原 tensor scatter。
- 数据相关长度会向后传播到编译、拼批与通信。

## 常见误区

- 将 mask 当作可随意广播的普通算子输入。
- 假定 `x[mask]`保持原 rank。
- 在 requires_grad tensor 上随意 mask 原地写。
- 未预算 true_count 导致大临时分配。

## 实现变体

### 压缩选择 `x[mask]`

useWhen: "后续确实只处理满足条件的紧凑集合。"
tradeoff: "计算量可能下降；输出动态且会 gather。"

### 保形选择 `where`

useWhen: "下游需要固定 shape、编译稳定或向量化算子。"
tradeoff: "保留全部位置并计算两支；接口与通信更稳定。"

## 可运行示例

```python
import torch
x = torch.arange(24).reshape(2, 3, 4)
mask = torch.tensor([[True, False, True], [False, True, False]])
y = x[mask]
assert y.shape == (3, 4) and torch.equal(y[1], x[0, 2])
assert y.untyped_storage().data_ptr() != x.untyped_storage().data_ptr()
x[mask] = -1
assert torch.equal(x[0, 0], torch.full((4,), -1))
```

## 搭积木复现

### 积木 1：枚举 True 坐标

把二维 bool list 转为坐标列表并计数。

### 积木 2：实现 gather

按坐标读取新 list，验证输入不变。

### 积木 3：实现 scatter

按坐标回写并检查 values 长度。

### 积木 4：比较 where

保留原 shape，比较结果和内存合同。

### 积木 5：覆盖动态边界

测试全空、全真和高维 mask。

## 自检

### 问题

为何 `(B,T)` mask 作用于 `(B,T,D)`会得到 `(N,D)`，而不能要求永远返回 `(B,T,D)`？固定 shape 管线应怎样改写？

### 站内答案

mask 消费 B、T 两个索引维，N 是实际 True 数；未被消费的 D 维保留，所以读取把稀疏的有效 token 压缩成 `(N,D)`。N 是数据相关的，不能由 `(B,T)`静态推出，因而也不应伪装成固定 shape。若下游要求固定 B、T、D，例如 attention、all-gather 或编译后的块，使用 `torch.where(mask.unsqueeze(-1), x, fill)`或乘以转换后的 mask 保留几何；若确实要压缩，就连同 length、offset 或 padding mask 一起作为协议输出。测试应覆盖 N=0、N=全部、梯度、安全的非原地版本与内存预算。
