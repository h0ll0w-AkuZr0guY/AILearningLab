---
id: "torch-01-03"
track: "torch"
title: "shape、numel、dtype、device 与 layout：张量合同的正交坐标"
depth: "deep"
exampleLanguage: "python"
readingMinutes: 35
sourceMinutes: 30
practiceMinutes: 65
reviewMinutes: 15
---

## 官方入口

title: "PyTorch 2.13 · Tensor Attributes"
url: "https://docs.pytorch.org/docs/stable/tensor_attributes.html#tensor-attributes"

官方分别定义 dtype、device 与 layout，并说明 strided Tensor 是 Storage 的多维带步长视图。属性组合决定可表示值、内存位置和布局类别；layout API 仍含 beta 部分，后端支持范围必须按算子核验。

## 真实源码

repo: "pytorch/pytorch"
file: "c10/core/TensorImpl.h"
symbol: "TensorImpl attribute accessors"
language: "cpp"
url: "https://github.com/pytorch/pytorch/blob/v2.13.0/c10/core/TensorImpl.h#L684-L710"

### 逐段讲解

- `sizes()`返回各逻辑维长度，`numel_`通常缓存其乘积；自定义 sizes policy 允许 Tensor subclass 覆写这一行为。
- `dtype()`返回 TypeMeta，itemsize 将元素 offset 转成字节 offset，也决定许多算子的数值范围与 kernel。
- `device()`通常来自 TensorImpl 的 device_opt；自定义 device policy 说明后端对象不必完全遵守普通字段布局。
- `layout()`会结合 dispatch key 判断 strided/sparse 等类别，layout 进而决定 stride、storage 与算子是否有意义。
- 这些 accessor 看似只读属性，实际也是 dispatcher、autograd、compiler guard 与序列化合同的输入；修改任一项常意味着真实转换。

### 源码节选

```cpp
// PyTorch v2.13.0 · c10/core/TensorImpl.h
// 从真实类中选取属性访问器；顺序按教学合同重排。
int64_t numel() const {
  if (C10_UNLIKELY(matches_policy(SizesStridesPolicy::CustomSizes))) {
    return numel_custom();
  }
  return numel_;
}

IntArrayRef sizes() const {
  if (C10_UNLIKELY(matches_policy(SizesStridesPolicy::CustomSizes))) {
    return sizes_custom();
  }
  return sizes_and_strides_.sizes_arrayref();
}

const caffe2::TypeMeta dtype() const {
  return data_type_;
}

Device device() const {
  if (C10_UNLIKELY(device_policy_)) {
    return device_custom();
  }
  return device_opt_.value();
}

Layout layout() const {
  if (C10_UNLIKELY(layout_policy_)) {
    return layout_custom();
  }
  return key_set_.has(DispatchKey::Sparse)
      ? Layout::Sparse
      : Layout::Strided;
}

size_t itemsize() const {
  TORCH_CHECK(dtype_initialized(), "dtype is not initialized");
  return data_type_.itemsize();
}
```

## 导读

shape、numel、dtype、device、layout 常被并排打印，于是容易被当成一组“描述信息”。它们分别回答五个问题：坐标域多大、逻辑元素多少、每个元素怎样编码、数据/计算位于何处、整体用哪类结构组织。将它们当作正交坐标，可以更准确判断某个转换是否只改元数据、是否复制、是否支持。

例如 `(2,3)` float32 CPU strided Tensor 与同 shape 的 int64 CUDA Tensor 有相同坐标域和 numel，却在元素宽度、数值语义、地址空间和 kernel 上完全不同。同 shape 的 sparse COO Tensor 甚至不用普通 stride 表达全部值。shape 相同只足以讨论某些代数兼容，远不足以说明可交换。

本课把这些属性组成可执行合同：输入检查不只写“Tensor”；要明确允许的 rank/shape、dtype 集、device 同置规则、layout 与是否需要真实数据。这样错误能在算子入口暴露，编译器 guard、测试矩阵和部署能力也有共同语言。

## 分章正文

### shape 描述坐标域，不描述内存顺序

kicker: "01 · SHAPE"

`torch.Size([B,T,D])`给出每一维的合法坐标范围，并赋予维度业务语义。相同数字 `(2,3)` 可以表示样本×特征，也可以表示行×列；程序若只靠位置猜语义，在 transpose、batching 和导出后容易静默出错。

零维 Tensor 的 shape 是 `[]`且 numel 为 1，它表示标量；含零长度维度的 `(2,0,3)` numel 为 0。两者都可能没有可读取元素，却在广播、输出 shape 和梯度上不同。`len(tensor)`对零维报错，也不能替代 rank/shape 检查。

动态 shape 场景中某些维度是 SymInt，源码会避免过早把它强制成普通整数。业务代码把 `int(x.shape[0])`写入 Python 分支可能制造 graph break 或过度 guard；应尽量把 shape 约束表达为张量/导出合同。

#### 本章结论

shape 是逻辑坐标和业务轴的合同；stride 决定内存顺序，命名和断言决定业务语义。

### numel 是乘积缓存，不是内存容量

kicker: "02 · NUMEL"

对普通 dense Tensor，numel 是 sizes 的乘积，标量为 1，任一维为 0 时为 0。TensorImpl 缓存 numel，修改 size 后必须刷新它；源码专门维护这一不变量，避免每次查询都重复乘法。

numel 统计逻辑元素。expand 可以让百万个逻辑坐标重复映射到一个地址；带洞切片的地址跨度可以大于 numel；sparse Tensor 的 numel 仍表示完整稠密坐标域，而实际存储非零数量用 `_nnz()`观察。

计算 FLOPs 或激活量时 numel 很有用，估算 Storage 容量、真实带宽和稀疏压缩率时必须换指标。把所有内存公式写成 numel×itemsize，会在 view、sparse 和量化表示上失真。

#### 代码

```python
dense = torch.zeros(2, 3)
expanded = torch.ones(1).expand(2, 3)
sparse = torch.sparse_coo_tensor(
    torch.tensor([[0], [2]]), torch.tensor([7.0]), (2, 3)
)

assert dense.numel() == expanded.numel() == sparse.numel() == 6
assert expanded.untyped_storage().nbytes() == expanded.element_size()
assert sparse._nnz() == 1
```

#### 本章结论

numel 回答“逻辑上有多少坐标”，不回答“分配了多少字节”或“有多少唯一存储值”。

### dtype 同时决定编码、范围和分派

kicker: "03 · DTYPE"

dtype 不只是 itemsize。float16、bfloat16 都占两字节，却有不同指数和尾数分配；int8 的算术与量化 scale/zero-point 又是两层合同。选择 dtype 会改变溢出、舍入、累加精度、可用 kernel 与模型稳定性。

类型提升规则决定混合输入的输出 dtype；默认 dtype 又会影响由 Python 浮点创建的 Tensor。隐藏的 float64 常把 GPU kernel 和参数变成另一条路径。入口应显式构造或转换 dtype，并用 `torch.result_type`/`can_cast`理解组合。

`view(dtype)`可以重新解释同一字节，但对最后一维 stride、offset 与元素宽度有严格整除条件；`.to(dtype)`则按数值转换并通常分配。把位解释与数值转换混淆，会得到“形状对了、值全错”的危险结果。

#### 本章结论

dtype 是数值语义与 kernel 合同；相同 itemsize 不能说明可互换，重新解释字节也不等于转换数值。

### device 规定地址空间和执行位置

kicker: "04 · DEVICE"

`torch.device`包含类型和可选索引，例如 cpu、cuda:1、mps、meta。大多数二元算子要求输入同 device；把一个小常量留在 CPU 会触发错误，框架通常不会偷偷跨设备搬运，因为隐式传输会破坏性能可预测性。

`.to(device)`若目标属性与当前完全相同，可以返回自身；否则产生新 Tensor/Storage 并执行传输。`non_blocking=True`只表达允许条件，真正异步还依赖 pinned memory、后端和 stream。检查对象 identity、Storage 指针与同步时间，才能判断是否复制。

meta device 没有数值数据，适合模块初始化规划和 shape 推导。不能从 meta 直接 `.to("cpu")`恢复未知值，必须由 `to_empty`或重新初始化参数提供真实 Storage。device 因而也可能表示“抽象执行域”，不只是一块硬件。

#### 本章结论

device 是地址可达性、allocator 和 kernel 的联合合同；迁移是否复制和是否异步必须用具体路径验证。

### layout 决定哪一套结构不变量成立

kicker: "05 · LAYOUT"

`torch.strided`是常见 dense 表示，Storage + sizes + strides + offset 地址公式成立。`torch.sparse_coo`把坐标和值分开，可能未 coalesce；CSR/CSC/BSR 等 layout 还有压缩索引结构。一个算子支持 Tensor 类型，不代表支持所有 layout。

layout 与 memory_format 不同。channels_last 仍是 `torch.strided`，只是 stride 排列符合 NHWC 友好模式；sparse_coo 则是另一种 layout。把 channels_last 称为 sparse 或把 layout 当连续性，会让 API 检查失焦。

layout 的部分 API 标注 beta，版本间支持矩阵会变化。课程正文只固定稳定不变量，工程采用某个 sparse kernel 时应在锁定版本上查询官方算子文档并跑数值/梯度测试。

#### 代码

```python
nchw = torch.empty((2, 3, 4, 5))
nhwc_memory = nchw.contiguous(memory_format=torch.channels_last)

assert nchw.layout == torch.strided
assert nhwc_memory.layout == torch.strided
assert nhwc_memory.is_contiguous(memory_format=torch.channels_last)
assert not nhwc_memory.is_contiguous()
```

#### 本章结论

layout 选择结构族，memory_format 选择 strided 族中的典型排列；二者层级不同。

### 把五个属性写成算子入口合同

kicker: "06 · CONTRACT"

假设自定义图像 kernel 只接受 `[N,C,H,W]`、float16/float32、CUDA、strided、channels_last。入口应逐项检查并给出具体错误；只调用 `is_cuda`或 `is_contiguous`会漏掉 rank、dtype 与 memory format。

合同还要决定转换责任。库函数可以严格拒绝，让调用者控制复制；也可以提供 `normalize_input`显式 `.to`与 `.contiguous(memory_format=...)`。后一种更易用，却可能隐藏大拷贝，所以应返回是否物化或记录性能指标。

测试矩阵至少包含允许的两个 dtype、错误 rank、CPU、sparse、NCHW contiguous 与 channels_last。输出还需验证 shape、dtype、device、layout 和数值，而非只检查函数没有报错。

#### 本章结论

好的 Tensor API 把属性组合变成可测试前置条件，并明确谁为转换和复制付费。

### 从属性错配定位常见训练故障

kicker: "07 · DIAGNOSIS"

“Expected all tensors on same device”先枚举模型参数、buffer、输入和新建常量的 device；不要只对报错 Tensor 调 `.cuda()`，那可能掩盖 state_dict 或数据管线的所有权问题。模块内部常量应注册 buffer，使 `.to()`能统一迁移。

dtype mismatch 要区分参数 dtype、autocast 计算 dtype、梯度/优化器状态 dtype。盲目把所有对象 half 化可能破坏 BatchNorm、loss reduction 或 optimizer 精度。记录算子边界实际输入输出 dtype，才能定位自动混精的选择。

layout/contiguity 故障表现为不支持错误或隐式 copy 性能下降。profile 中出现 `contiguous`/`copy_`时回到生产者的 shape、stride、memory_format；修复布局流比在每个消费者前补 `.contiguous()`更节省带宽。

#### 本章结论

属性是诊断坐标：逐层记录合同与实际值，可以把“Tensor 不对”缩小到具体转换边界。

## 核心机制

- shape 给出各维逻辑范围，numel 通常缓存 sizes 乘积。
- dtype 决定元素编码、itemsize、类型提升与 kernel 能力。
- device 决定地址空间、allocator、执行后端与迁移语义。
- layout 选择 strided、sparse 等结构族，memory_format 是 strided 内的排列选择。
- meta Tensor 允许只有抽象属性而没有普通数据。
- Tensor subclass 可通过 policy/custom accessor 覆写 sizes、device、layout 行为。
- 编译 guard、dispatcher 与序列化都会读取这些属性形成执行合同。

## 常见误区

- shape 相同就认为 Tensor 可互换，忽略 dtype、device、layout 与轴语义。
- 用 numel×itemsize 估算所有 view/sparse 的真实 Storage。
- 把 float16 与 bfloat16 因同为两字节而视作相同数值格式。
- 认为 `.to`必复制，或认为 `non_blocking=True`必异步。
- 把 channels_last 当成独立 layout，混淆 memory_format。
- 从 meta Tensor 直接迁移并期待恢复从未存在的数值。
- 在消费者前无条件 contiguous，长期掩盖上游布局抖动和复制。

## 实现变体

### 严格属性合同

useWhen: "底层 kernel、性能关键库或跨团队接口必须让复制与迁移显式。"
tradeoff: "性能可预测、错误局部化；调用者要管理 dtype/device/layout 适配，使用门槛更高。"

### 规范化适配层

useWhen: "应用入口需要接受多种输入并统一到模型内部格式。"
tradeoff: "易用且集中转换；必须暴露复制指标和最大输入预算，避免静默大开销。"

### meta-first 构建

useWhen: "大模型装载、编译或分片规划阶段只需属性和模块结构。"
tradeoff: "显著降低初始化峰值；所有数据依赖初始化、后端差异和 unsupported op 要另行处理。"

## 可运行示例

```python
import torch


def contract(tensor: torch.Tensor) -> dict[str, object]:
    return {
        "shape": tuple(tensor.shape),
        "numel": tensor.numel(),
        "dtype": tensor.dtype,
        "device": tensor.device.type,
        "layout": tensor.layout,
        "stride": tensor.stride() if tensor.layout == torch.strided else None,
    }


dense = torch.zeros((2, 3), dtype=torch.float32)
meta = torch.empty((2, 3), dtype=torch.float32, device="meta")
sparse = torch.sparse_coo_tensor(
    indices=torch.tensor([[0, 1], [2, 0]]),
    values=torch.tensor([4.0, 5.0]),
    size=(2, 3),
)

assert contract(dense)["shape"] == contract(meta)["shape"] == (2, 3)
assert contract(dense)["numel"] == contract(sparse)["numel"] == 6
assert dense.layout == torch.strided
assert sparse.layout == torch.sparse_coo
assert sparse._nnz() == 2
assert sparse.to_dense()[0, 2].item() == 4.0

scalar = torch.tensor(3.0)
empty = torch.empty(2, 0, 3)
assert scalar.shape == torch.Size([]) and scalar.numel() == 1
assert empty.shape == torch.Size([2, 0, 3]) and empty.numel() == 0
```

## 搭积木复现

### 积木 1：建立属性快照

返回 shape、rank、numel、dtype、itemsize、device、layout；仅对 strided Tensor 读取 stride。

### 积木 2：覆盖边界 shape

测试标量、零长度维度和普通矩阵，分别断言 shape 与 numel。

### 积木 3：比较 dtype

对 float16、bfloat16、float32 记录 itemsize、finfo 和一个大/小值舍入实验。

### 积木 4：加入 meta

执行只依赖 shape 的算子，再尝试读取值并捕获预期错误，划出抽象执行边界。

### 积木 5：加入 sparse layout

构造 COO、检查 nnz/coalesce/to_dense，证明 numel 与实际 values 数量不同。

### 积木 6：实现严格入口

为图像 kernel 检查 rank、dtype、device、layout、channels_last，并让每个错误都有专属测试。

## 自检

### 问题

一个图像算子收到 shape 为 `[8,3,224,224]` 的 Tensor，团队便断言它可直接进入 CUDA channels-last float16 kernel。请列出还必须验证的属性，说明 layout 与 memory_format 的区别，并给出“严格拒绝”和“入口规范化”两种 API 设计的取舍。

### 站内答案

还要验证 rank/轴语义确为 NCHW、dtype 在允许集合且数值范围可接受、device 是目标 CUDA 设备、layout 是 torch.strided、stride 符合 channels_last memory_format，以及后端/对齐等 kernel 专属约束。layout 选择 strided 或 sparse 等结构族；channels_last 仍属于 strided，只是 4D stride 排列满足特定 memory format。严格 API 对不匹配直接报错，复制和迁移由调用者显式安排，性能最可预测；规范化 API 可集中调用 `.to(dtype/device)`与 `.contiguous(memory_format=...)`，使用更方便，但可能静默产生大拷贝，必须返回或记录物化、限制输入预算并在测试/profile 中验收。
