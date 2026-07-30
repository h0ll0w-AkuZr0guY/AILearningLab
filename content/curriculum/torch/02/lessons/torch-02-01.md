---
id: "torch-02-01"
track: "torch"
title: "basic indexing"
depth: "deep"
exampleLanguage: "python"
readingMinutes: 25
sourceMinutes: 30
practiceMinutes: 50
reviewMinutes: 15
---

## 官方入口

title: "PyTorch 2.13 · Tensor Views / basic indexing"
url: "https://docs.pytorch.org/docs/stable/tensor_view.html#tensor-views"

稳定文档明确列出 basic slicing/indexing 为 view；它借用底层 Storage，而不是把选择到的值收集到新缓冲区。

## 真实源码

repo: "pytorch/pytorch"
file: "aten/src/ATen/TensorIndexing.h"
symbol: "applySlicing / handleDimInMultiDimIndexing"
language: "cpp"
url: "https://github.com/pytorch/pytorch/blob/v2.13.0/aten/src/ATen/TensorIndexing.h#L452-L590"

### 逐段讲解

- 整数索引先进入 `applySelect`：检查边界、处理负下标，把该维坐标写进 offset 并删除该维。
- slice 进入 `applySlice`：半开区间与 step 共同决定新 size、stride、storage_offset；它仍是一条仿射地址公式。
- `dim` 只在 slice 后增加，因为 select 已移除一个维；混淆这条计数规则会造成多维索引错位。
- 当没有 tensor index 被累积时，后续 `get_item` 直接返回 sliced 的 alias；只有收集到 tensor index 才转入高级索引分派。

### 源码节选

```cpp
// v2.13.0：Python/C++ 基本索引逐 token 改写 view 几何。
inline Tensor handleDimInMultiDimIndexing(
    const Tensor& previous, const Tensor& original,
    const TensorIndex& index, int64_t* dim,
    int64_t* specified_dims, int64_t real_dim,
    std::vector<Tensor>& tensor_indices, bool disable_slice_optimization,
    const at::Device& device,
    const std::optional<SymIntArrayRef>& sizes) {
  if (index.is_integer()) {
    // select 固定一个坐标，删除该逻辑维，仍引用 previous 的 Storage。
    return impl::applySelect(previous, *dim, index.integer(), real_dim, device, sizes);
  } else if (index.is_slice()) {
    Tensor result = impl::applySlice(previous, *dim, index.slice().start(),
        index.slice().stop(), index.slice().step(), disable_slice_optimization, device, sizes);
    (*dim)++; // slice 保留维度，下一 token 消费下一个逻辑维。
    return result;
  } else if (index.is_ellipsis()) {
    *dim += original.dim() - *specified_dims; // ... 吸收未指定维度。
    return previous;
  }
  return previous;
}
```

## 导读

`x[1, 2:5:2]`看起来像从数组里“拿出值”，更准确的模型是一台坐标变换器：整数把一条坐标固定，slice 缩小坐标域并可能放大 stride。输出因此能继续引用 x 的 Storage。这个模型能预测写传播、连续性和窗口为何会钉住大 buffer。

基本索引由整数、slice、冒号、`...`和`None`构成。它不需要为每个输出元素保存独立地址表，所以普通 strided Tensor 能用 size、stride、offset 表达结果。下标列表、LongTensor 或 bool mask 则需要逐元素寻址，属于下一课的高级索引。

本课把整数和 slice 合并，因为它们共享一条地址公式；`select`相当于固定一个坐标，`slice`相当于保留一段坐标。拆开会重复解释同一个 Storage 合同，却掩盖“降维”和“保留维”的关键差异。

## 分章正文

### 先把索引还原成地址

kicker: "01 · ADDRESS"

对连续 `x.shape=(3,5)`、`stride=(5,1)`，`x[1,1:5:2]`输出 shape 为 `(2,)`，其 offset 从 0 变为 `1×5+1=6`，stride 变为 `(2,)`。输出逻辑坐标 1 的地址是 8，也就是原 x[1,3]。这份等式比“看起来相等”可靠。

输入本身已经是 slice 或 transpose 时，不能重新假定它连续。任何 basic index 都从输入现有的 size、stride、offset 继续演算；因此应在调试日志里同时打印三者，避免用 shape 猜物理布局。

#### 本章结论

基本索引改写几何，不收集元素；地址公式是别名事实的最小证明。

### 整数索引为何会降维

kicker: "02 · INTEGER"

`x[1]`等价于沿第 0 维 select：坐标 1 已被固定，输出再没有可变化的第 0 维，于是 rank 减一。负下标要先按当前 size 规范化，再检查边界；它不是“从内存尾部倒着走”。

保留维度的写法是 `x[1:2]`，它输出 shape `(1,5)`并保留该维的 stride。模型 batch 维若被误用整数选掉，后续广播常会让程序继续运行，却把样本维当 feature 维，因此入口断言 rank 比只看 numel 更有价值。

#### 本章结论

integer 固定坐标并删维；长度为一的 slice 保留坐标域，两者的 shape 合同完全不同。

### step 同时改变跨度与可 view 性

kicker: "03 · SLICE"

slice 的 stop 是半开边界。`1:5:2`选到 1 和 3，不含 5；步长 2 会把该维 stride 乘以 2，而不是复制出间隔元素。结果的 numel 很小也可能覆盖很大的原始地址范围。

这解释了为何对 step slice 直接 `view(-1)`常失败：逻辑元素之间有洞，不能把多个维合成一个连续 chunk。若后续 kernel 真要线性布局，显式 `contiguous()`把复制放在可测边界；若它支持 stride，保留 view 可省带宽。

#### 本章结论

step 是地址增量的一部分；小 shape 不等于紧凑 Storage。

### 如何证明 view，又如何管理生命周期

kicker: "04 · ALIAS"

对同 device 的普通 tensor，比 `untyped_storage().data_ptr()`能证明同一底层 Storage；对有 offset 的 slice，`data_ptr()`本身可以不同。再写入一个唯一坐标并观察 base 对应位置，是第二个可读证据。

但别名并不天然正确：把一个 4KB 的 window 放入长期队列，可能让数百 MB base 永远存活。短链路计算借用 view，跨请求缓存或异步队列则 `clone()`固定所有权，并将复制字节计入容量预算。

#### 本章结论

别名、对象 identity、数据指针和生命周期是四个不同问题，必须分别验收。

### 读取与赋值应拆成两条合同

kicker: "05 · WRITE"

`y=x[1:3]`创建可写 view，`y.add_(1)`会影响 x；这让预分配 buffer 的填充很高效，也使无意的 in-place 修改更危险。对 requires_grad 的叶子及其 view，autograd 版本计数会拒绝某些写入，不能把报错当作随机限制。

API 设计应声明返回的是只读借用还是独立结果。若调用者可以写，返回 clone；若要零拷贝，文档写明 alias 并用测试验证写传播、非连续输入、负下标和空 slice。这样上游改 layout 时，错误会停在索引边界。

#### 本章结论

基本索引的性能来自共享，工程安全来自把共享写进接口合同。

### 把索引事故还原为可重复的几何报告

kicker: "06 · DEBUG"

线上出现“切出的小块突然很慢”时，第一步不是盲目调用 contiguous，而是记录输入与输出的 shape、stride、storage_offset、dtype、device、is_contiguous 和 Storage 指针。第二步用同一输入分别测 basic slice 的创建时间、下游算子时间和显式 contiguous 的复制时间。创建 view 几乎不搬运数据，真正成本常藏在后来不接受该布局的 kernel；把三段合成一个总耗时会让优化方向倒置。

再构造一张坐标编码的回归样本：令二维 base 的值为 `100*row+col`，分别执行整数选择、长度一 slice、负下标、步长 slice 和 transpose 后 slice。对每一例断言逻辑值、rank、stride、offset、是否共享 Storage，以及对唯一坐标写入后的 base 变化。这样既能抓住“把 1:2 写成 1”的降维错误，也能抓住测试 shape 对称时被掩盖的轴错误。若输出要越过线程、缓存或请求边界，额外记录 base 的物理字节数和 window 的逻辑字节数；两者相差很大时，clone 是所有权修复而非性能失败。

#### 本章结论

诊断 basic indexing 要同时报告坐标几何、所有权和下游消费，单看输出值无法定位性能或生命周期事故。

### 交付前的最小检查表

kicker: "07 · CHECKLIST"

实现切片工具前，明确它接受逻辑 axis 还是原始 dim，负 index、空窗口和 step 是否允许，返回是否借用以及调用者能否原地写。测试用不等长二维和三维 tensor，故意让输入 transpose 后再切片，检查异常是否停在接口边界。性能报告同时记录输入 stride 与下游算子，不能只给一个孤立的 slice 时间。这样索引从 Python 语法变成可审计的内存合同。

#### 本章结论

写清输入轴、别名和寿命，才能让零拷贝成为可维护的优化。

## 核心机制

- 整数索引固定坐标、增加 offset 并删除维度。
- slice 保留维度，按 step 更新 size/stride/offset。
- 无 tensor index 时返回 alias；高级索引才需要 gather。
- 非连续 view 仍可供许多算子消费，是否物化由下游决定。

## 常见误区

- 把 size=1 slice 当成 integer select。
- 用 `data_ptr()`不同断言 slice 不共享 storage。
- 把小窗口长期保存而忽略被钉住的 base。
- 用 `view`修复 step slice，掩盖布局不兼容。

## 实现变体

### 借用 view

useWhen: "结果只在当前计算链内消费，且下游接受 stride。"
tradeoff: "零拷贝且写传播；必须管理 alias 与 base 生命周期。"

### 边界 clone

useWhen: "结果要跨队列、缓存、线程或需独立可写。"
tradeoff: "所有权稳定；付出完整复制与额外峰值内存。"

## 可运行示例

```python
import torch
x = torch.arange(15).reshape(3, 5)
y = x[1, 1:5:2]
assert y.tolist() == [6, 8] and y.stride() == (2,)
assert y.untyped_storage().data_ptr() == x.untyped_storage().data_ptr()
y[1] = -1
assert x[1, 3].item() == -1
```

## 搭积木复现

### 积木 1：实现 offset

写 `offset+Σ(index*stride)`，手算二维整数索引。

### 积木 2：实现半开 slice

给定 start/stop/step，输出新 size、stride、offset。

### 积木 3：加入 rank 变化

让 integer 删除维，让长度一 slice 保留维。

### 积木 4：验证别名

比较 Storage 指针并做一次唯一坐标写传播。

### 积木 5：验证边界

覆盖负下标、空 slice、step slice 与 transpose 输入。

## 自检

### 问题

为什么 `x[1, 1:5:2]`可以是 view，而 `x[[1, 2]]`通常不是？如何设计一个不会因 alias 造成缓存泄漏的返回 API？

### 站内答案

前者的每个输出坐标都能用固定的 offset 和 stride 映射回 x：integer 固定一维，slice 把另一维的 stride 乘以 step，因此一组有限元数据足够。后者的行号来自运行时列表，地址序列取决于列表内容，必须读取并收集元素，普通 strided view 无法表达。返回 API 若仅作同步计算，可标成 borrowed view，禁止下游原地写并在测试中断言共享 Storage；若结果会进缓存、任务队列或被调用方修改，则应在边界 clone，记录复制字节并把 base 引用释放。验收要用连续、transpose、step slice 和非对称 shape，检查值、shape、stride、Storage identity 与写传播，不能仅比较输出数值。
