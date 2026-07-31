---
id: "torch-01-04"
track: "torch"
title: "Stride 地址代数与连续性：从索引公式到 memory_format"
depth: "deep"
visualIndex: "../visuals/torch-01-04.md"
exampleLanguage: "python"
readingMinutes: 40
sourceMinutes: 40
practiceMinutes: 80
reviewMinutes: 20
---

## 官方入口

title: "PyTorch 2.13 · torch.layout and strided tensors"
url: "https://docs.pytorch.org/docs/stable/tensor_attributes.html#torch-layout"

官方说明每个 strided Tensor 都关联 Storage，stride[k] 表示第 k 维前进一个元素所需的内存步长。连续性是某种 memory format 下的排列性质，transpose 等 view 可以共享 Storage 同时变为非连续。

## 真实源码

repo: "pytorch/pytorch"
file: "c10/core/TensorImpl.cpp"
symbol: "TensorImpl::compute_contiguous and compute_non_overlapping_and_dense"
language: "cpp"
url: "https://github.com/pytorch/pytorch/blob/v2.13.0/c10/core/TensorImpl.cpp#L259-L312"

### 逐段讲解

- 普通 contiguous、2D channels-last、3D channels-last 分别缓存判断，说明“连续”必须带 memory format 语境。
- 所有判断先拒绝 sparse，因为 sparse layout 不遵守普通 size/stride 到单一 Storage 的地址合同。
- `_compute_contiguous`检查 sizes/strides/numel 是否满足默认行主序的连续遍历，不通过并不表示 Tensor 无法读取或算子一定失败。
- channels-last 判断使用同一 sizes/strides 但按 NCHW/NCDHW 的专用物理顺序验证，layout 仍是 strided。
- non-overlapping-and-dense 是另一性质：索引映射不重叠且覆盖一个稠密区域，可包含转置等非默认连续排列；不要用单一布尔量替代全部布局能力。

### 源码节选

```cpp
// PyTorch v2.13.0 · c10/core/TensorImpl.cpp
bool TensorImpl::compute_contiguous() const {
  if (is_sparse()) {
    return false;
  }
  return _compute_contiguous<int64_t>(
      sizes_and_strides_.sizes_arrayref(),
      sizes_and_strides_.strides_arrayref(),
      numel_);
}

bool TensorImpl::compute_channels_last_contiguous_2d() const {
  if (is_sparse()) {
    return false;
  }
  return _compute_channels_last_contiguous_2d<int64_t>(
      sizes_and_strides_.sizes_arrayref(),
      sizes_and_strides_.strides_arrayref());
}

bool TensorImpl::compute_channels_last_contiguous_3d() const {
  if (is_sparse()) {
    return false;
  }
  return _compute_channels_last_contiguous_3d<int64_t>(
      sizes_and_strides_.sizes_arrayref(),
      sizes_and_strides_.strides_arrayref());
}

bool TensorImpl::compute_non_overlapping_and_dense() const {
  if (is_sparse()) {
    return false;
  }
  return _compute_non_overlapping_and_dense<int64_t>(
      sizes_and_strides_.sizes_arrayref(),
      sizes_and_strides_.strides_arrayref());
}
```

## 导读

stride 是把多维坐标压到一维 Storage 的系数。它与线性代数中的基向量很像：每个维度前进一步，相当于在物理元素序号上加一个固定向量。理解这个地址代数后，transpose、slice、expand、diagonal 和 view 的行为都能手算，而不再靠记 API。

连续性经常被误解为“内存中有一整块”。所有普通 Storage 都是字节缓冲区，关键在于逻辑索引按某种约定顺序遍历时，地址是否无洞地递增。默认 contiguous 与 channels_last 使用不同遍历约定；转置可能 non-overlapping-and-dense，却不满足默认 contiguous。

性能也不能简化成连续真/假。kernel 可能原生接受任意 stride，TensorIterator 会合并维度并选择遍历顺序；GPU coalescing、CPU cache locality 和向量化取决于内层 stride、shape 与算子。`.contiguous()`是一笔真实复制，只有 profile 证明后续收益覆盖成本时才值得。


## 分章正文

### 把索引变成元素 offset 的仿射映射

kicker: "01 · AFFINE MAP"

公式 `offset(i)=storage_offset+Σ i[k]×stride[k]`是仿射映射：storage_offset 是常量项，stride 是每维系数。对 shape `(2,3,4)`的默认连续张量，stride 为 `(12,4,1)`；索引 `(1,2,3)`映射 12+8+3=23。

stride 单位为元素，不是字节。真实字节地址再乘 element_size。这个设计允许同一几何逻辑用于 float16、float32 和 int64，不必为 dtype 改写 stride。`storage_offset`同样按元素计。

手算函数要先验证 rank、每个索引范围和 Storage 边界。教学版可以只支持非负 stride；PyTorch 普通 Tensor 不支持 NumPy 那种负 stride view，`torch.from_numpy`遇到负 stride 数组通常要求先复制。

#### 代码

```python
def storage_index(tensor, index):
    if len(index) != tensor.dim():
        raise ValueError("rank mismatch")
    if any(i < 0 or i >= size for i, size in zip(index, tensor.shape)):
        raise IndexError(index)
    return tensor.storage_offset() + sum(
        i * stride for i, stride in zip(index, tensor.stride())
    )
```

#### 本章结论

地址公式是后续所有 view 推理的共同积木；先用元素单位推导，再换算字节。

### 默认连续 stride 怎样从后往前生成

kicker: "02 · CONTIGUOUS"

行主序默认排列让最后一维相邻：最末 stride 为 1，向前每一维 stride 等于后一维 stride×后一维 size。shape `(2,3,4)`因此得到 `(12,4,1)`。size 为 1 的维度只有一个坐标，其 stride 在某些判断中可被忽略。

零元素 Tensor 的 stride 存在约定性，因为没有任何地址会被真实访问。源码对零 numel 采用兼容规则；测试不要把空 Tensor 的某个 stride 数字当跨版本业务语义，应验证 shape、numel 和操作结果。

`is_contiguous()`是缓存属性，元数据改变后 TensorImpl 必须 refresh。手写扩展若改 sizes 却忘记 stride/contiguity 标志，会让 kernel 走错误快速路径，这也是应使用正规构造 API 的原因。

#### 本章结论

默认连续是特定递推关系，不是“Storage 存在”；空维和 size-1 维需要按可观察语义处理。

### 转置为什么只置换 size 与 stride

kicker: "03 · PERMUTATION"

对 `(2,3,4)` Tensor 做 `permute(0,2,1)`，新 shape 是 `(2,4,3)`，新 stride 是 `(12,1,4)`。逻辑 `(b,d,t)`代入后仍访问原 `(b,t,d)`的同一元素。Storage、dtype 和 offset 都不变。

新 Tensor 最内层维 stride 为 4，顺序访问会跨过三个元素；默认 contiguous 为 false。但它仍 non-overlapping-and-dense：所有逻辑坐标映射到 24 个唯一地址，并覆盖整个区域，只是访问顺序改变。

若后续矩阵乘或自定义 kernel 支持该 stride，直接消费可避免复制；若 kernel 要求内层 stride 1，contiguous 会重排字节。选择应包含复制一次与每次非理想访问的总成本，而非看到 false 就立即复制。

#### 代码

```python
base = torch.arange(24).reshape(2, 3, 4)
p = base.permute(0, 2, 1)
assert p.shape == (2, 4, 3)
assert p.stride() == (12, 1, 4)
assert p[1, 2, 1].item() == base[1, 1, 2].item() == 18
```

#### 本章结论

permute 是坐标轴与 stride 系数的同步置换；逻辑顺序变了，字节没有搬。

### 切片如何制造洞与非零 offset

kicker: "04 · HOLES"

`x[:, ::2]`保留每隔一个元素，相关维 stride 乘 2；`x[1:]`把 storage_offset 前移。两者都能零拷贝，却可能让逻辑元素分布在更大地址跨度中。Tensor 的第一个逻辑元素不必位于 Storage 起点。

带洞 view 通常不是 dense，因为合法地址之间有未被当前 Tensor 使用的元素。某些逐元素 kernel 仍能按 stride 正确执行；reshape 若想把跨洞子空间合并，就无法只改元数据。

调试时枚举小 Tensor 的所有 storage index，观察排序、重复和间隙。大 Tensor 不能全枚举，可用 shape/stride 推导边界和重叠性质，或依赖框架已有 overlap 检查。

#### 本章结论

非连续可能来自轴重排，也可能来自洞和 offset；它们对 view 兼容与性能的影响不同。

### channels_last 是另一种连续约定

kicker: "05 · CHANNELS LAST"

PyTorch 图像逻辑 shape 通常仍写 NCHW，但 channels_last memory format 让 C 维物理相邻，便于某些卷积 kernel。`is_contiguous(memory_format=torch.channels_last)`可能为真，同时默认 `is_contiguous()`为假。

转换使用 `.contiguous(memory_format=...)`或 `.to(memory_format=...)`，是否复制取决于当前排列。模块和输入应维持一致布局流；在每层来回 NCHW/NHWC 会用重排吞掉 kernel 收益。

不能仅凭 stride 猜后端一定更快。硬件、dtype、卷积形状与 kernel 库共同决定结果。建立端到端 benchmark，记录重排次数、吞吐和显存，再选择 memory format。

#### 本章结论

连续性必须带遍历约定；channels_last 改物理相邻轴，不改 NCHW 的逻辑轴语义。

### non-overlapping、dense 与 contiguous 的关系

kicker: "06 · OVERLAP"

non-overlapping 表示不同逻辑坐标不映射同一地址；dense 表示映射覆盖一段无洞区域。默认连续一定满足二者，纯 permute 也常满足，而 step slice 有洞，expand 以零 stride 产生重叠。

原地写安全首先要求没有内部重叠，还要考虑与其他 Tensor 的外部别名。一个 view 自身 non-overlapping，不代表它与 base 或另一个 view 不交叠。并发写还需同步协议。

公开 API 没有为所有组合承诺一个稳定高层判据；工程设计应尽量通过正规 view 操作表达，并在写边界 clone。内部 overlap 工具可用于诊断，却不宜成为长期公共接口。

#### 本章结论

contiguous 是强排列条件；non-overlapping/dense 拆开了唯一性和覆盖性，更接近写安全与 view 能力。

### 用访问模式而非布尔标签解释性能

kicker: "07 · PERFORMANCE"

CPU 最内层 stride 1通常利于 cache line 与 SIMD，GPU 相邻线程访问相邻地址有利于 coalescing。但 reduction、matrix multiply 和 convolution 会重新组织迭代；高性能库可能专门支持转置标志而无需复制。

profile 应把显式/隐式 copy 与目标 kernel 分开计时。一次 contiguous 后重复执行百次 kernel 可能值得；只执行一次的短算子，复制常比非连续访问更贵。warmup、同步与相同数值输入是可靠 benchmark 的前提。

API 层最好传递布局而非到处物化。只有在稳定边界，例如数据加载完成、模型入口或缓存写入时统一 memory format，才能让布局选择可观测、可回滚。

还要区分“访问次序不理想”和“内部重叠导致语义不安全”。前者可能只是慢，后者在向量化原地写时可能让同一地址被多个逻辑元素竞争。性能优化前先证明地址集合唯一，再讨论 cache 与合并访问；否则更快的 kernel 可能只是更快地产生不确定结果。

一个可复用的布局报告应给出最内层非 size-1 维、对应 stride、地址跨度、是否存在重复地址、默认/channels-last 连续性，以及本次物化字节数。小 Tensor 可穷举验证，大 Tensor用排序后的 stride 与 size 推导。报告让评审者看到选择依据，而不只是一句“non-contiguous 很慢”。

#### 本章结论

stride 决定访问序列，性能来自硬件与 kernel 对序列的利用；contiguous 只是一个常用快速路径信号。

### 用地址集合实验区分四类布局

kicker: "08 · FAILURE LAB"

准备连续矩阵、transpose、step slice 和 expand 四个输入。对每个小 Tensor 穷举所有逻辑坐标，计算 storage index，随后统计集合大小、最小/最大值和排序后间隙。连续矩阵地址唯一且无洞；transpose 地址仍唯一无洞但遍历乱序；step slice 唯一有洞；expand 出现重复地址。

这四类结果对应不同决策。transpose 可能被支持任意 stride 的 kernel直接消费；step slice 可能需要按 stride读取或物化；expand 的只读广播很便宜，写前必须 clone；连续矩阵才可直接套默认线性扫描。把实验写成断言后，任何新 view 操作都能落到同一分类，而无需背诵 API 清单。

地址集合实验还应验证 storage_offset 非零的子视图。只比较最大 offset 与 numel 会漏掉起点，正确边界是 Storage 元素容量内的最小和最大可达地址。若未来扩展到允许负 stride 的外部数组，最小值不再必然等于 offset，边界公式也必须同时考虑正负系数。

#### 本章结论

唯一性、洞、遍历顺序和起点四项证据足以解释大多数 strided view 的读写与物化决策。

## 核心机制

- strided Tensor 使用 storage_offset 加索引与 stride 点积得到元素地址。
- 默认 contiguous stride 从最后一维开始按 size 累乘生成。
- permute/transpose 同步置换 sizes 与 strides，不移动 Storage。
- slice 可增加 storage_offset、放大 stride 并形成地址洞。
- channels_last 是 strided layout 下另一种连续 memory format。
- non-overlapping、dense、contiguous 分别描述地址唯一性、覆盖性和特定顺序。
- TensorImpl 缓存多种 contiguity 属性，元数据更新必须刷新。

## 常见误区

- 把 stride 当字节数，重复乘或漏乘 element_size。
- 认为非 contiguous 就不是 view、不能计算或一定很慢。
- 对每个 transpose 立即 contiguous，忽略后续 kernel 可能原生支持。
- 把 channels_last 误作逻辑 NHWC shape 或独立 layout。
- 用 numel 代替地址跨度，漏掉 step slice 的洞。
- 把自身 non-overlapping 推成与所有别名都不重叠。
- 用空 Tensor 的具体 stride 数字建立跨版本业务断言。

## 实现变体

### 保持原 stride 直接计算

useWhen: "kernel 支持任意 stride，操作次数少或复制成本大。"
tradeoff: "避免物化；访问局部性和可用快速路径可能较差，需要 profile 证明。"

### 边界处统一 contiguous

useWhen: "下游多次复用、kernel 明确要求或统一布局能消除多次隐式 copy。"
tradeoff: "后续简单可预测；边界发生一次完整复制，需要纳入峰值和延迟。"

### 端到端 channels_last

useWhen: "卷积模型、支持该格式的硬件和 dtype 经 benchmark 证明收益。"
tradeoff: "可能提升 kernel 吞吐；不支持的算子会重排，调试工具和自定义 op 必须理解 memory format。"

## 可运行示例

```python
import torch


def storage_index(tensor: torch.Tensor, index: tuple[int, ...]) -> int:
    if len(index) != tensor.dim():
        raise ValueError("索引 rank 与 Tensor 不一致")
    if any(i < 0 or i >= size for i, size in zip(index, tensor.shape)):
        raise IndexError(index)
    return tensor.storage_offset() + sum(
        i * stride for i, stride in zip(index, tensor.stride())
    )


base = torch.arange(24).reshape(2, 3, 4)
permuted = base.permute(0, 2, 1)
sliced = base[:, :, ::2]

assert base.stride() == (12, 4, 1)
assert permuted.stride() == (12, 1, 4)
assert sliced.stride() == (12, 4, 2)
assert storage_index(permuted, (1, 2, 1)) == 18
assert permuted[1, 2, 1].item() == 18
assert not permuted.is_contiguous()

materialized = permuted.contiguous()
assert materialized.is_contiguous()
assert torch.equal(materialized, permuted)
assert materialized.untyped_storage().data_ptr() != permuted.untyped_storage().data_ptr()

image = torch.empty((2, 3, 4, 5))
channels_last = image.contiguous(memory_format=torch.channels_last)
assert channels_last.is_contiguous(memory_format=torch.channels_last)
assert not channels_last.is_contiguous()
```

## 搭积木复现

### 积木 1：实现地址函数

检查 rank/范围，按元素 offset 公式返回物理序号，并用连续 3D Tensor 穷举验证。

### 积木 2：生成默认 stride

从 shape 尾部递推 stride，覆盖标量、size-1 维与零元素约定。

### 积木 3：实现 permute 元数据

只置换 shape/stride，证明每个新坐标与原坐标访问同一值。

### 积木 4：加入切片洞

用 step slice 枚举物理地址，计算 logical count、span、holes。

### 积木 5：分类重叠与稠密

对小 Tensor 枚举地址集合，分别识别 contiguous、permute、slice、expand。

### 积木 6：比较 memory format

构造 NCHW contiguous 与 channels_last，打印 stride，并分别调用两种 is_contiguous。

### 积木 7：做复制盈亏实验

比较直接执行非连续算子与先 contiguous 后重复执行的总时间，正确同步并报告拷贝占比。

## 自检

### 问题

Tensor shape 为 `(2,3,4)`、stride 为 `(12,1,3)`、offset 为 0。它是由最后两维转置得到的 view。请算 `(1,2,3)` 的元素 offset，解释为何它默认不连续却可能 non-overlapping-and-dense，并说明什么时候先 `.contiguous()`反而更慢。

### 站内答案

元素 offset 为 `1×12 + 2×1 + 3×3 = 23`。原连续 `(2,4,3)` 的 stride 是 `(12,3,1)`，交换最后两维后 shape `(2,3,4)`、stride `(12,1,3)`；24 个逻辑坐标仍一一映射到 0..23，因而无内部重叠且覆盖稠密区域，但按默认最后一维优先遍历时地址每次加 3，不满足默认 contiguous 递推。若后续算子原生支持该 stride、只执行一两次或 Tensor 很大，contiguous 的完整分配与复制可能超过非连续访问成本；只有下游多次复用或 kernel 快速路径收益足够时物化才划算，需把 copy 与 kernel 分开 benchmark。
