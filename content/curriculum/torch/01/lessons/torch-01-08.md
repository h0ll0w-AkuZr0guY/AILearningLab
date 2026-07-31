---
id: "torch-01-08"
track: "torch"
title: "expand 与 repeat：零 stride 广播和真实物化"
depth: "deep"
visualIndex: "../visuals/torch-01-08.md"
exampleLanguage: "python"
readingMinutes: 25
sourceMinutes: 45
practiceMinutes: 60
reviewMinutes: 20
---

## 官方入口

title: "PyTorch 2.13 · torch.Tensor.expand"
url: "https://docs.pytorch.org/docs/stable/generated/torch.Tensor.expand.html#torch.Tensor.expand"

expand 把 size 为 1 的维扩到更大范围并把该维 stride 置为 0，不分配新内存；官方警告 expanded view 的原地写会让多个逻辑元素写同一地址。

## 真实源码

repo: "pytorch/pytorch"
file: "aten/src/ATen/native/TensorShape.cpp"
symbol: "expand"
language: "cpp"
url: "https://github.com/pytorch/pytorch/blob/v2.13.0/aten/src/ATen/native/TensorShape.cpp#L1297-L1324"

### 逐段讲解

- 入口要求目标 rank 不小于输入 rank，并拒绝不支持 stride 概念的 sparse layout。
- inferExpandGeometry 从末维对齐，只有 size=1 的旧维可以扩张；`-1`保留已有维度。
- 可扩张的维写入 stride=0，使任何该轴索引贡献同一地址。
- as_strided 返回 view；真正的 full materialization 由 repeat、clone 或需要输出的下游算子承担。

### 源码节选

```cpp
Tensor expand(const Tensor& self, c10::IntArrayRef size, bool /*unused*/) {
  TORCH_CHECK(size.size() >= (size_t)self.dim(), "expand rank is too small");
  TORCH_CHECK(!self.is_sparse() && !at::sparse_csr::is_sparse_compressed(self),
              "expand is unsupported for this layout");
  // 新 size 与 0-stride 由广播规则推导；不读取或复制元素。
  auto geometry = inferExpandGeometry_dimvector(self.sizes(), self.strides(), size);
  // 与 permute 相同，as_strided 创建共享同一 Storage 的 view。
  return self.as_strided(geometry.sizes, geometry.strides);
  // geometry 包含目标 size 与每一维新 stride。
  // singleton 扩张维的 stride 会被设为 0。
  // 此处不运行 repeat、memcpy 或 allocator。
  // 下游可选择直接消费或另行物化。
  // 普通 strided view 继续共享 Storage。
}
```

## 导读

广播是“让一个标量或一行逻辑上出现在许多位置”，并不要求先把它复制成大矩阵。`expand`把原 size=1 的轴映射成 stride 0：无论该轴索引是 0 还是 999，地址增量都是 0。读操作因而廉价，地址重复却让写语义失去一一对应。

`repeat`的目标外观常与 expand 相同，物理策略相反：它把数据平铺到新 Storage。选择由所有权和写需求决定。只读偏置、mask、条件向量适合 expand；需要逐元素独立写、导出独立缓冲区或向不支持零 stride 的外部库交接时，repeat/clone 的 copy 是合同的一部分。

本课把 expand 与 repeat 合并，是因为二者只有对照才显出“广播”与“物化”的边界；单讲 expand 容易把零 stride 当成小技巧，单讲 repeat 又会掩盖不必要的显存成本。


## 分章正文

### 零 stride 不是零大小

kicker: "01 · ZERO STRIDE"

`x.shape=(3,1)`、stride `(1,1)`执行 `expand(3,4)`后 size 为 `(3,4)`、stride 为 `(1,0)`。逻辑 `(2,0)`与 `(2,3)`都映射到元素 2；numel 从 3 变 12，Storage 字节仍只覆盖 3 个元素。

把零 stride 代入地址公式比记规则可靠：`offset=i×1+j×0`。这也解释了为什么输出的多个位置值同步变化，它们根本不是多个存储槽位。

#### 本章结论

expand 扩张坐标域，零 stride 让新坐标复用旧地址。

### 为何向 expanded view 原地写危险

kicker: "02 · WRITE"

向一个逻辑 `(3,4)`张量逐元素写入，直觉要求 12 个独立地址；zero stride 只给 3 个地址，向量化 in-place 操作的结果依赖迭代顺序。官方将此定义为可能不正确的行为，并建议写前 clone。

某些操作会主动拒绝内部重叠，拒绝并不等于所有操作都安全。工程规范应更强：凡结果要独立可写，先 `clone()`或直接构造目标 Tensor；不要以“当前版本没报错”作为正确性证据。

#### 本章结论

read-only 广播安全，独立写需要独立 Storage。

### backward 为什么会 sum 回 singleton 轴

kicker: "03 · AUTOGRAD"

forward 将一个 bias `(C,1,1)`应用到 `(N,C,H,W)`，同一 bias 元素参与 N×H×W 个加法。反向对该 bias 的梯度必须沿广播的三个维度求和，这不是优化细节，而是同一地址在计算图上被使用多次的链式法则。

自己实现广播算子时，先右对齐 shape，记录哪些轴是新加或旧 size=1，backward 对这些轴 reduce_sum，再 reshape 回原输入 shape。只靠 PyTorch 自动广播写测试不足以学会该不变量。

#### 本章结论

zero stride 的地址别名与 backward 的梯度归约，是同一个多对一映射的两面。

### repeat、clone 与 expand_copy 的取舍

kicker: "04 · MATERIALIZE"

repeat 以重复因子描述目标并产生独立元素，适合后续会修改每一份的场景；它不要求原维 size=1。`expand().clone()`通常得到紧凑独立副本，表达“先按广播逻辑定义结果，再取得所有权”。

如果外部算子只接受 contiguous，明确物化能把代价放在边界处；若消费者本就支持 broadcast stride，提前 repeat 只会把带宽和峰值内存扩大。profile 应报告逻辑 shape、真实 storage bytes 与物化发生点。

#### 本章结论

相同数值形状不等于相同所有权；API 名称必须携带是否 materialize 的意图。

### 布局与后端边界

kicker: "05 · DEPLOYMENT"

expand 的 native 实现拒绝 sparse/sparse-compressed，文档也提示某些操作会被迫 materialize。自定义 C++/CUDA kernel 若对每个输出索引直接按输入 stride 取址，可以支持 zero stride；若假定地址唯一或线性递增，必须拒绝或复制。

图编译与导出路径同样要把 stride/alias 视为输入合同。用连续训练样本捕获到的图，换成 expanded 输入后可能落到不同 kernel、触发 guards 或产生 hidden copy；部署回归要包含这类布局。

#### 本章结论

广播支持是算子能力的一部分，接口应声明而非暗中猜测。

### 用三组观测分辨广播收益与隐藏复制

kicker: "06 · MEASURE"

第一组观测是地址：对 `(C,1,1)` bias expand 后，比较 `untyped_storage().data_ptr()`并枚举同一通道不同 H/W 的地址，确认它们相同。第二组是所有权：对 `repeat`和 `expand().clone()`确认地址不同，并在一个逻辑位置写入后检查邻居不再同步。第三组才是性能：分别计时 view 创建、消费者 kernel 和显存峰值，不能把三段累计成“expand 的耗时”。

广播正确性还可手推一个反向例子。令 `b=[[2]]`扩展到 `(2,3)`并计算 `loss=(expanded * w).sum()`，则 `db`必须等于 w 六个位置之和。若自定义 kernel 或扩展把 expanded 输入当作普通连续数组读取，前向值可能看似正确，反向却会错过该归约；这正是 stride 作为算子合同的原因。

部署端的保守策略是：算子明确支持任意 strided/broadcast 输入时保留 expand；接口要求写入、唯一地址、连续缓冲区或跨运行长期持有时，在明确边界物化，并把 bytes 写进 telemetry。看见 hidden copy 后应先确认消费者约束，再决定改布局或改 kernel。

还要在接口日志中区分逻辑元素数与实际分配量。一次 repeat 可能把很小的参数扩成整批激活大小；一次 expand 则可能把成本推迟到一个不透明的消费者。两类事件都应有独立计数。

#### 本章结论

广播优化要同时证明别名、梯度归约和端到端物化位置。

## 核心机制

- expand 仅允许把 size=1 维扩张，新增前导维也可出现。
- 扩张维 stride=0，所有该维坐标映射到同一地址。
- repeat 分配新 Storage；expand 保留原 Storage。
- 反向沿 expanded/singleton 维求和，恢复原 shape。

## 常见误区

- 对 expanded view 原地向量化写。
- 把 `numel`增长误认为显存已经增长。
- 用 repeat 代替可被下游直接消费的 expand。
- 假设 sparse 或自定义后端也实现了 zero stride。

## 实现变体

### expand：借用式广播

useWhen: "只读 bias、mask 或参数要被支持 stride 的算子消费。"
tradeoff: "零分配且可省带宽；写入和某些后端不安全。"

### repeat / expand().clone()

useWhen: "每个逻辑位置需要独立所有权或独立原地修改。"
tradeoff: "语义直接且兼容外部缓冲区，代价与扩张后 numel 成正比。"

## 可运行示例

```python
import torch

base = torch.tensor([[10.], [20.], [30.]])
expanded = base.expand(3, 4)
assert expanded.stride() == (1, 0)
assert expanded.untyped_storage().data_ptr() == base.untyped_storage().data_ptr()
assert expanded[2, 0] == expanded[2, 3] == 30

owned = expanded.clone()
owned[2, 3] = -1
assert base[2, 0] == 30  # clone 后写入不回传
repeated = base.repeat(1, 4)
assert repeated.untyped_storage().data_ptr() != base.untyped_storage().data_ptr()
```

## 搭积木复现

### 积木 1：右对齐 shape

实现广播维对齐，拒绝两个非 1 且不相等的维。

### 积木 2：生成 zero stride

把可扩张的 size=1 维写为目标 size 与 stride 0。

### 积木 3：穷举地址

枚举小 expanded view，证明多组索引得到同一 offset。

### 积木 4：实现只读二元算子

让每个输入各自按 stride 取值，避免提前复制。

### 积木 5：实现 backward reduce

对扩张轴求和，和 autograd 的结果逐项对照。

### 积木 6：比较物化

对 expand、repeat、clone 报告 Storage identity、bytes 和写传播。

## 自检

### 问题

为什么 `bias.expand(batch, channels)`的 forward 可以零拷贝，而它对 bias 的梯度却需要 reduce_sum？若业务要修改每个 batch 行的 bias，选择什么实现并如何验证？

### 站内答案

expand 只把 singleton batch 轴的 stride 设为 0，每一行读取同一 bias 地址，因此不用复制；反向中同一 bias 元素影响了每行输出，链式法则要求把每行的贡献相加。需要每行独立写时使用 `repeat`或 `expand(...).clone()`获得新 Storage，验证输出 storage 指针不同，并修改一行后断言其他行与原 bias 不变。还要检查消费者是否接受 zero stride：任意 stride 的逐元素 kernel 可直接读取；假定地址唯一的 kernel 必须拒绝或物化。报告应同时记录 base bytes、物化 bytes、归约轴和复制算子名。一个实用反例是把 `(1,C,1,1)`参数扩成 `(N,C,H,W)`后试图用原地 dropout mask 修改；这会把本应独立的空间位置折叠到同一参数地址。正确做法是在算子内部生成独立输出或先 clone，并用反向梯度与数值的 reference repeat 实现对照。这样既能保留只读广播的带宽优势，也能把写边界变得可审计。对模型参数，重复后的独立 buffer 还会改变 optimizer state 的数量和 checkpoint 大小，因而不能为避开一个 stride bug 就把可学习参数无条件 repeat。每次广播都应写明它是参数共享还是数据复制。
