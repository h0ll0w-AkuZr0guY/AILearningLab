---
id: "torch-01-09"
track: "torch"
title: "as_strided：滑窗能力、越界检查与重叠写未定义行为"
depth: "deep"
exampleLanguage: "python"
readingMinutes: 25
sourceMinutes: 45
practiceMinutes: 65
reviewMinutes: 40
---

## 官方入口

title: "PyTorch 2.13 · torch.as_strided"
url: "https://docs.pytorch.org/docs/stable/generated/torch.as_strided.html#torch.as_strided"

as_strided 以显式 size、stride、storage_offset 创建 view。官方建议优先使用高层 view API，并警告越界会报错、重叠 view 的原地操作行为未定义。

## 真实源码

repo: "pytorch/pytorch"
file: "aten/src/ATen/native/TensorShape.cpp"
symbol: "as_strided_tensorimpl"
language: "cpp"
url: "https://github.com/pytorch/pytorch/blob/v2.13.0/aten/src/ATen/native/TensorShape.cpp#L1361-L1375"

### 逐段讲解

- 若调用者省略 offset，入口继承输入 view 的 offset，而不是 Storage 起点。
- 实现用相同 Storage 构造 VIEW 型 TensorImpl，保留 dtype 与 dispatch keys。
- setStrided 安装 size/stride/offset 并进行合法性检查；构造超出底层 Storage 的范围会失败。
- 实现没有也无法为任意地址映射推导业务写语义，因此内部重叠的原地操作被文档列为未定义。

### 源码节选

```cpp
Tensor as_strided_tensorimpl(
    const Tensor& self, IntArrayRef size, IntArrayRef stride,
    std::optional<int64_t> storage_offset_) {
  auto storage_offset = storage_offset_.value_or(self.storage_offset());
  // VIEW 构造保留同一 Storage，而非分配 output buffer。
  auto result = at::detail::make_tensor<TensorImpl>(
      c10::TensorImpl::VIEW, Storage(self.storage()), self.key_set(), self.dtype());
  // 安装调用者给出的地址合同；边界检查由后续 setStrided 路径承担。
  setStrided(result, size, stride, storage_offset);
  return result;
  // 输出 TensorImpl 是 VIEW，Storage 引用仍来自 self。
  // stride 的单位是元素而不是字节。
  // 派生的连续性元数据会随 size/stride 刷新。
  // API 不为 overlap 写入定义次序。
  // 特殊后端可能有自己的实现。
  // 高层 view API 会收窄可构造的映射。
  // 调用者仍需证明范围和别名关系。
  // 数据指针的所有权没有在这里转移。
  // autograd 还会维护额外的 view 元数据。
  // 范围检查、overlap 分类和消费模式应一起进入接口门禁。
  // 读窗口与梯度归约可用，原地写必须有独立所有权。
}
```

## 导读

所有普通 view 都可看作对 size、stride、offset 的受限改写；`as_strided`把这三个旋钮直接交给你。它能用一维信号构造滑动窗口、用图像特征构造局部 patch，也能在一个字符间把多个逻辑元素映射到同一字节。强大来自没有替你选择布局，风险也来自没有替你选择。

安全使用 as_strided 的第一步不是调用 API，而是证明地址范围。对非负 stride，最小 offset 是 storage_offset，最大 offset 是 `storage_offset + Σ((size[i]-1)×stride[i])`。最大值必须小于 Storage 可用元素数；size=0 要单独处理，因为没有任何可读元素。

本课独立成专家专题，因为滑窗、边界、内部重叠、autograd 和后端可移植性属于同一个地址合同。把它并入普通切片会让最危险的写语义在“高级用法”一句话里消失。

## 分章正文

### 三元组怎样定义一个 view

kicker: "01 · CONTRACT"

size 定义每个逻辑轴的合法坐标范围，stride 定义每个坐标增量，offset 定义第一个逻辑元素。对 `base=arange(6)`，`as_strided((4,3),(1,1))`把窗口 0..2、1..3、2..4、3..5 映射到同一 Storage。

这不是复制四个窗口；输出 12 个逻辑位置只引用 6 个物理元素。读窗、卷积 im2col 的教学推导因此可以零拷贝，后续把窗口交给会写或要求不重叠的算子则必须重新评估。

#### 本章结论

as_strided 描述地址映射，不描述“数组形状应该长什么样”。

### 先做范围证明，再构造

kicker: "02 · RANGE"

对所有 stride 非负的普通 Tensor，地址最大端点可按每一维最大坐标累加。再乘 element_size 只是将元素单位换成字节，检查时应和 storage 的元素容量使用同一单位。负 stride、symbolic shape、meta Tensor 与特殊 layout 不应被这份简化证明覆盖。

不能用 `numel`检验范围。size `(2,2)`、stride `(10,1)`只有四个逻辑值，却可能触及 offset 11。也不能只检验首地址；一个合法起点加上宽 stride 一样会越界。让教学实现先拒绝复杂情况，比假装通用更诚实。

#### 本章结论

范围安全是 max reachable offset 与 Storage 容量的比较，而非 numel 比较。

### 为什么滑窗读安全，写却没有单一答案

kicker: "03 · OVERLAP"

滑窗的 `(1,1)`stride 令 output[0,1] 和 output[1,0]同指 base[1]。读取时两次看到同一个值完全合理；若对整个 output 做 in-place 加法，base[1]被加一次还是两次取决于实现遍历与并行化，不能定义成稳定 API。

有些运算通过 overlap 检查拒绝，有些路径可能运行，二者都不能把未定义变成允许。若需要把每个窗口的结果写回，应使用 out-of-place reduction、`unfold`配合明确 scatter/reduce，或 materialize 独立 buffer。

#### 本章结论

地址集合有重复时，读取是多视角，写入则缺少唯一的目标元素。

### 梯度是重叠读的正确归约方式

kicker: "04 · AUTOGRAD"

将重叠窗口参与纯函数计算时，backward 会把多个窗口位置对同一个 base 元素的梯度相加。这正是数学上的 scatter-add，不等价于 forward 对 view 原地写。用 `gradcheck`或手工计数可验证中间元素比边缘元素获得更多贡献。

自定义 Function 保存 as_strided view 时仍要保存必要 metadata 与 base 版本。对 base 或 view 做破坏性原地修改会让 saved tensor 与 forward 不一致；应让 autograd 的版本检查报错，而非用 `.data` 绕开。

#### 本章结论

重叠读的梯度归约有明确数学定义，重叠原地写没有。

### 高层 API 何时更可靠

kicker: "05 · PORTABILITY"

官方建议优先 `view`、`expand`等高层操作，因为某些后端没有一般 stride 概念，as_strided 会失败，且手工布局依赖当前 memory layout。`unfold`能表达常见滑窗并让意图可读；若要部署到多后端，应优先从它开始。

性能层面，zero-copy patch view 可能让后续矩阵乘接收高度非连续、重叠输入并触发隐式 copy。高质量实现应同时测 view 创建、后续 kernel、峰值内存和数值/梯度一致性，而不是只炫耀“创建 O(1)”。

#### 本章结论

as_strided 是底层证明工具；优先可表达同一意图的受限 API。

### 把地址图变成可审计输出

kicker: "06 · DIAGNOSTIC"

调试小 view 时，枚举每个逻辑索引及其 offset，按 offset 分组。单元素组表示无重叠，多元素组表示写风险，排序有缺口表示不 dense；这让 alias 从直觉变成证据。

大 Tensor 不能穷举时，仍记录 Storage bytes、最大可达 offset、读写模式和 materialization。遇到符号 shape 或 subclass 而无法证明时，退回高层 API 或拒绝。

#### 本章结论

小张量穷举建立直觉，运行时门禁保存同一不变量。

### 滑窗算子的可维护接口

kicker: "07 · DESIGN"

业务 API 应暴露 window_size、step、read_only，内部优先 unfold；只有确有额外布局要求时才暴露 as_strided 三元组。调用方不应同时拥有任意 stride 与原地写权限。

测试覆盖最小长度、贴边窗口、空输入、越界、重叠读、梯度计数和非连续 base。优化可以改写内部实现，却必须维持可见的地址、数值与失败合同。

#### 本章结论

把危险自由度封装成受限参数，零拷贝才可维护。

### 让危险原语经过两道证明门

kicker: "08 · REVIEW GATE"

第一道门检查可达范围。教学版只接受非负 stride、普通 strided Storage 与已知整数 shape，逐维累加 `(size_i-1)*stride_i`，再加 storage_offset，并与 Storage 元素容量比较。空维要单独处理，因为它没有可访问元素；不要让 max 公式在空集合上伪造一个地址。真实框架还要面对符号 shape、负 stride 语义和各后端限制，因此业务代码应尽量调用受限高层 API。

第二道门检查写入唯一性。对小输入枚举所有 logical index，按 storage offset 分桶；任一桶出现两个 index 就标为 read-only。生产大张量可采用结构性判断与保守拒绝，宁可让调用方 materialize，也不能用一次没有报错的 in-place 运行证明没有数据竞争。GPU 并行调度会让这类错误比 CPU 循环更不稳定。

代码审查时追问四件事：这个三元组是否可由 `unfold`、`narrow`、`transpose`表达；最大地址是否有测试；输出是否会被写入或传给会写的库；性能测量是否包含随后的消费者。四个答案中任一模糊，就把自由度收回到受限接口。

范围证明还要保留 dtype 与 storage_offset 的上下文：offset 的单位是元素，诊断 bytes 时才乘 element_size。把单位混用会在 float16、int8 或非零 offset 输入上给出貌似合理却错误的安全结论。对于需要跨进程共享缓冲区的场景，也必须把 base 的生命周期和只读约束传递出去，不能只序列化 shape、stride 这两个描述字段。

最后加入反例回归：同一套检测必须拒绝越界与重叠写，并允许安全的非重叠只读窗口。

审查记录应保留这次选择的高层替代方案和拒绝原因，使风险判断可以复盘。

#### 本章结论

as_strided 的工程价值来自可证明的读映射；写权限必须另行获得。

## 核心机制

- as_strided 的 VIEW TensorImpl 共享 Storage、dtype 与 dispatch keys。
- 非负 stride 的最高可达 offset 由每维 `(size-1)*stride`累加。
- 不同逻辑索引可映射同一地址，形成 internal overlap。
- 读取与反向累计可以有定义，重叠 in-place 写不具可移植语义。

## 常见误区

- 把 numel 当成 Storage 范围证明。
- 对滑窗 view 做 in-place 或让未知库函数原地写。
- 忽略继承的 storage_offset，误把 view 当成 base 开头。
- 把 CPU 上可运行当成所有后端的 API 承诺。

## 实现变体

### unfold：受限滑窗

useWhen: "需求是沿一个维度以固定 size/step 生成窗口。"
tradeoff: "意图清晰并减少手工错误；不能覆盖任意多维自定义映射。"

### materialize 后写

useWhen: "每个 patch 都要独立变换、原地修改或交给只支持连续输入的库。"
tradeoff: "获得唯一地址与后端兼容，代价是完整复制和峰值内存。"

## 可运行示例

```python
import torch

base = torch.arange(6.0, requires_grad=True)
windows = torch.as_strided(base, size=(4, 3), stride=(1, 1))
assert windows.untyped_storage().data_ptr() == base.untyped_storage().data_ptr()
assert torch.equal(windows[1], torch.tensor([1., 2., 3.]))

loss = windows.sum()
loss.backward()
assert torch.equal(base.grad, torch.tensor([1., 2., 3., 3., 2., 1.]))

try:
    torch.as_strided(base, size=(2, 2), stride=(10, 1))
except RuntimeError:
    pass
else:
    raise AssertionError('越界地址必须被拒绝')
```

## 搭积木复现

### 积木 1：实现非负 stride 地址公式

从 size、stride、offset 得到任意小坐标的 Storage index。

### 积木 2：实现范围检查

计算最大可达 offset，覆盖标量、空 size、越界和 offset 继承。

### 积木 3：构造一维滑窗

用 `(4,3),(1,1)`对照 unfold，逐元素验证。

### 积木 4：检测重叠

枚举小 view 地址，统计重复 index，拒绝写模式。

### 积木 5：实现 out-of-place backward

为每个窗口梯度做 scatter-add，验证三角形计数。

### 积木 6：比较 materialize

比较直接 view 与 clone 后消费的峰值、时间和 kernel 支持。

### 积木 7：加入后端门禁

在接口中声明仅支持 strided CPU/CUDA，并为不支持 layout 报清晰错误。

## 自检

### 问题

一维 Storage 有 6 个元素，`size=(4,3), stride=(1,1), offset=0`为何范围安全却内部重叠？若所有窗口元素求和，base 的梯度为什么是 `[1,2,3,3,2,1]`？

### 站内答案

最高地址为 `(4-1)×1+(3-1)×1=5`，在 0..5 内，所以范围安全。窗口 [0:3]、[1:4]、[2:5]、[3:6] 共享中间地址，因此内部重叠。求和的每个窗口位置梯度为 1，base[0]只被第一个窗读取一次，base[1]被前两个读取两次，中间 2、3 被三个窗读取三次，随后对称减少；这是 out-of-place scatter-add 的数学梯度，不授权对 windows 原地写。若输入本身是 slice，省略 offset 时新 view 继承 slice 起点而非回到 Storage 零号元素。跨后端接口应声明只支持 strided Tensor，否则这个范围证明没有共同语义。更完整的安全门禁先拒绝负 size、rank 不匹配和非整数 stride；其次对非空 view 计算最高可达元素位置；最后在允许写时检测重复 offset。若返回的是只读 view，也把 `may_overlap=true`随对象或日志传递给下游，避免后来维护者把一个合法读窗口误用为可写工作区。任何需要独立 patch 的模型算子，应在边界 materialize，并将那笔 bytes、时间、内存峰值与数值回归一并纳入性能合同。另一个常见误解是以为 as_strided 可替代所有 reshape：reshape 的合法别名路径由连续子空间决定，as_strided 虽能伪造某个 shape，却可能改变逻辑值顺序。教学实现必须先拿 index 到原值的映射做对照，再讨论性能；不能只因输出 shape 正确就接受实现。另一个测试把一个已偏移的 slice 作为输入，分别省略和显式传入 offset，验证两个结果的首元素与最高元素都落在预期位置；这能抓住许多将 offset 当作相对值而非 Storage 绝对元素位置的实现错误。性能对比还必须包含直接 unfold、as_strided view 和 clone 后紧凑 buffer 三条路径，分别报告创建成本、消费成本和峰值内存。
