---
id: "torch-01-01"
track: "torch"
title: "Tensor 双层模型：TensorImpl 元数据如何解释同一块字节"
depth: "deep"
visualIndex: "../visuals/torch-01-01.md"
exampleLanguage: "python"
readingMinutes: 40
sourceMinutes: 30
practiceMinutes: 55
reviewMinutes: 15
---

## 官方入口

title: "PyTorch 2.13 · torch.Storage"
url: "https://docs.pytorch.org/docs/stable/storage.html#torch-storage"

官方把普通张量拆成连续一维字节 Storage，以及 dtype、shape、stride、offset 等解释元数据。多个 Tensor 可以共享同一 Storage；meta、FakeTensor 和部分子类则提醒我们，Tensor 合同并不等价于“必有一段普通数据内存”。

## 真实源码

repo: "pytorch/pytorch"
file: "c10/core/TensorImpl.h"
symbol: "TensorImpl"
language: "cpp"
url: "https://github.com/pytorch/pytorch/blob/v2.13.0/c10/core/TensorImpl.h#L440-L510"

### 逐段讲解

- `torch.Tensor` 的 Python 对象最终持有 C++ Tensor/TensorImpl；数值操作不会从 Python 列表重新解释，而会沿 dispatcher 进入后端 kernel。
- `storage_` 持有 StorageImpl，StorageImpl 再持有 DataPtr、字节数、allocator 与 device。多个 TensorImpl 可以引用同一个 StorageImpl。
- `sizes_and_strides_` 与 `storage_offset_` 属于当前 TensorImpl。两个别名即使共享 storage，也可以拥有不同 shape、stride 和起始元素。
- `data_type_` 把字节解释为元素。地址计算先用 offset/stride 得到元素序号，再乘 itemsize 得到字节偏移。
- 真实类还保存 dispatch key、版本计数、autograd 与 Python 互操作元数据；本节删去这些分支，是为了先固定“存储层 + 解释层”的最小不变量。

### 源码节选

```cpp
// PyTorch v2.13.0 · c10/core/TensorImpl.h
// 保留真实类型、构造签名和核心字段语义；删去兼容态长注释。
struct C10_API TensorImpl : public c10::intrusive_ptr_target {
  TensorImpl() = delete;
  ~TensorImpl() override;

  // 普通 TensorImpl 可以接管一个 Storage，并记录 dispatch keys 与 dtype。
  TensorImpl(
      Storage&& storage,
      DispatchKeySet key_set,
      const caffe2::TypeMeta data_type);

  // view 专用构造仍持有 Storage；视图关系还会由 autograd 层补充。
  TensorImpl(
      ImplType,
      Storage&& storage,
      DispatchKeySet key_set,
      const caffe2::TypeMeta data_type);

  IntArrayRef sizes() const {
    return sizes_and_strides_.sizes_arrayref();
  }

  IntArrayRef strides() const {
    return sizes_and_strides_.strides_arrayref();
  }

  int64_t storage_offset() const {
    return storage_offset_;
  }

 private:
  Storage storage_;                       // 字节所有权与 DataPtr
  impl::SizesAndStrides sizes_and_strides_; // 当前解释的 shape/stride
  int64_t storage_offset_ = 0;            // 单位是元素，不是字节
  caffe2::TypeMeta data_type_;            // 决定元素宽度与标量类型
};
```

## 导读

很多初学者把 Tensor 想成“有 shape 的多维数组”。这个说法能写模型，却不足以解释 transpose 为什么几乎不花时间、切片为什么会改到原张量、reshape 为什么有时复制、有时零拷贝。更可靠的模型是两层：Storage 持有一维字节，TensorImpl 持有如何读取这些字节的元数据。数值来自两层共同作用。

可以把 Storage 类比成一卷没有格子的胶片，Tensor 元数据是一张取景表。shape 规定逻辑坐标范围，stride 规定坐标每走一步跨多少个元素，storage_offset 规定从胶片哪一格起拍，dtype 规定每格有多少字节以及怎样解码。同一卷胶片换一张取景表，便得到 transpose、slice 或 view。

这套模型也有边界。`device="meta"` 的 Tensor 可以携带 shape、dtype 和算子传播信息，却没有普通数据；sparse layout 用索引和值描述稀疏结构；Tensor subclass 还可能自定义语义。因此本课讨论的是最常见的 strided Tensor 表示，并把“不一定有普通 Storage”作为后续编译与扩展课程的防错栏。


## 分章正文

### 一个 Tensor 值为什么需要两层对象

kicker: "01 · TWO LAYERS"

若每个逻辑 Tensor 都独占并按 shape 排列一段内存，转置 10GB 矩阵就要搬动 10GB 数据。PyTorch 允许转置只交换 size 与 stride；新 TensorImpl 继续指向旧 Storage，创建成本只与维数有关。真正需要连续布局的后续算子再决定是否物化。

Storage 只负责字节与所有权，无法单独回答 `x[1, 2]` 的值。TensorImpl 仅有 shape 也不够，因为同样的 `(2, 3)` 可以按行主序、转置视图或带间隔切片映射到不同地址。必须把 storage、dtype、offset、sizes、strides 放进同一地址公式。

Python 变量 `x` 只是绑定 Tensor 对象。`y = x` 共享同一个 Tensor 对象；`y = x.view(...)` 创建另一个 Tensor 解释同一 Storage；`y = x.clone()` 创建新 Storage。对象同一、Storage 同一和值相等是三种不同关系。

#### 代码

```python
import torch

x = torch.arange(12).reshape(3, 4)
same_object = x
view_object = x[:, 1:3]
copy_object = x.clone()

assert same_object is x
assert view_object is not x
assert view_object.untyped_storage().data_ptr() == x.untyped_storage().data_ptr()
assert copy_object.untyped_storage().data_ptr() != x.untyped_storage().data_ptr()
```

#### 本章结论

先问 Python 对象是否相同，再问 Storage 是否共享，最后问逻辑值是否相等；三问不能互相替代。

### 从逻辑索引推到真实字节地址

kicker: "02 · ADDRESS"

对 strided Tensor，逻辑索引 `(i0, i1, …)` 对应的元素位置是 `storage_offset + Σ(ik × stride[k])`。这个结果的单位是元素，再乘 `dtype.itemsize` 并加到 Storage 起始地址，才是字节地址。`Tensor.data_ptr()`通常指当前 Tensor 第一个逻辑元素，`untyped_storage().data_ptr()`指 Storage 起点，所以带 offset 的切片二者可以不同。

例如连续 `(3,4)` 张量 stride 为 `(4,1)`，索引 `(2,1)` 映射到 `0+2×4+1×1=9`。若取 `x[:,1:3]`，shape 变 `(3,2)`，stride 仍 `(4,1)`，offset 变 1；逻辑 `(2,1)` 映射为 `1+8+1=10`。视图没有移动字节，只更换了合法坐标集合。

地址公式还能暴露非法想象：numel 是逻辑元素数量，并不保证这些元素在 Storage 中覆盖一段长度恰为 numel 的连续区间。步长切片可能跨过洞，expand 甚至让不同索引映射同一地址。读取范围、唯一地址数与逻辑元素数要分开计算。

#### 代码

```python
def element_offset(tensor, index):
    return tensor.storage_offset() + sum(
        coordinate * stride
        for coordinate, stride in zip(index, tensor.stride())
    )

base = torch.arange(12).reshape(3, 4)
part = base[:, 1:3]
assert element_offset(base, (2, 1)) == 9
assert element_offset(part, (2, 1)) == 10
assert part[2, 1].item() == 10
```

#### 本章结论

shape 描述坐标域，stride 与 offset 描述坐标到 Storage 的映射；numel 只统计坐标，不统计物理跨度。

### 共享 Storage 会产生哪些可观察行为

kicker: "03 · ALIAS"

两个 Tensor 共享 Storage 时，一方原地写入的字节会被另一方按自己的元数据重新读取。若两者映射区域不相交，例如同一数组的左右半段，写入不会立刻改变另一半的值，但它们仍共享同一所有权对象；只比较首元素 `data_ptr` 会把这种关系误判为独立。

PyTorch 的 autograd 还要跟踪 view 关系与版本计数。需要梯度的叶子及其 view 上不允许某些原地操作，因为 backward 保存的值可能已被改写。Storage 共享是内存事实，autograd view metadata 是求导合同；两者相关，却不能用 `_base` 是否存在来取代 Storage 证据。

跨库共享同样遵循所有权合同。`torch.from_numpy` 通常与 NumPy 数组共享 CPU 内存，`torch.tensor(array)`通常复制。外部数组若只读、生命周期不足或 stride 为负，转换能力会不同。工程 API 应明确返回借用视图还是拥有副本，并用测试锁定。

#### 本章结论

别名会传播写入和生命周期，却不保证两个 Tensor 的 data_ptr、shape、stride 或 autograd 身份相同。

### 为什么删除 base 后 view 仍能读取

kicker: "04 · LIFETIME"

TensorImpl 与 StorageImpl 使用引用计数管理。view 持有共享 Storage，也可能在 autograd 关系中保存 base 信息。删除 Python 名称只会减少相应对象引用；只要 view 仍可达，StorageImpl 的引用计数就不会归零，DataPtr 所拥有的内存也不会释放。

这解释了一个常见显存问题：从巨大 batch 中取很小 slice 并长期缓存，slice 的逻辑 nbytes 很小，却可能让整个 Storage 保持存活。监控只累加 `tensor.numel()*itemsize` 会低估保留内存；需要结合 Storage 大小、别名组与 allocator 指标。

需要独立生命周期时使用 `clone()`，必要时再 `detach()`决定梯度历史。复制有真实带宽和显存成本，所以不应把每个 view 都防御性 clone；应在缓存、跨线程所有权、外部可变输入和长期持有边界处做明确选择。

#### 代码

```python
import gc

large = torch.arange(1_000_000, dtype=torch.float32)
tiny = large[:1]
storage_bytes = tiny.untyped_storage().nbytes()
logical_bytes = tiny.numel() * tiny.element_size()

del large
gc.collect()
assert tiny.item() == 0
assert storage_bytes > logical_bytes
```

#### 本章结论

view 的逻辑大小不能代表其保留的 Storage 大小；生命周期审计要沿 Storage 所有权看。

### 元数据修改与数据修改是两类动作

kicker: "05 · MUTATION"

写 `x.add_(1)` 修改 Storage 中的元素；写 `transpose_` 或底层 `set_` 可能修改 TensorImpl 的解释元数据。普通 `transpose` 则创建新 TensorImpl，保留原对象的解释。调试时只看值差异，容易漏掉 shape/stride/offset 已变化的元数据动作。

PyTorch 对某些 view 禁止元数据原地修改，内部也用 `allow_tensor_metadata_change` 防止借出的元数据被悄悄重写。源码中的 `set_sizes_and_strides` 明确要求调用者保证 Storage 边界，说明底层构造函数提供能力，并不替上层业务承担安全。

 `.data` 绕开一部分 autograd 约束会制造难以证明的梯度错误。教学实验可以用 `set_` 或 `as_strided`观察表示，但模型代码应优先使用公开 view、copy 与 in-place API，让 dispatcher、autograd 和 functionalization 看见变化。

#### 本章结论

数据字节与解释元数据各有 mutation；正确性工具能否观察到动作，比语法上是否带下划线更重要。

### meta、sparse 与 subclass 如何修正直觉

kicker: "06 · NON-STANDARD"

`meta` Tensor 保存 shape、dtype、layout 等抽象信息，可以执行许多只需推导输出元数据的算子，但读取数值或拷回 CPU 会失败。编译器用它在不分配真实模型权重的情况下做 shape propagation。它证明 Tensor 的程序合同可以先于数据存在。

sparse COO 张量用 indices 与 values 表达非零项，layout 不是 `torch.strided`，普通 stride 地址公式不直接适用。某些 API 在 sparse、XLA、lazy 或 Tensor subclass 上会走专门分支。看到 `Tensor` 类型不能自动假设 `untyped_storage` 和标准 stride 可用。

因此生产检查应先声明支持范围。例如自定义 kernel 只接受 dense strided CPU/CUDA，可显式检查 layout、device、dtype 与 contiguity；若希望支持 subclass，应通过 dispatcher 注册语义，避免直接读取内部指针。

#### 本章结论

双层模型是 dense strided Tensor 的核心基线；layout 与 dispatch key 决定它何时需要扩展。

### 建立一份能证伪的 Tensor 描述

kicker: "07 · DEBUG CONTRACT"

调试函数应同时打印 shape、stride、storage_offset、dtype、device、layout、is_contiguous、Tensor data_ptr 与 Storage data_ptr。再加 `_base` 只能作为 autograd view 提示，不能作为唯一别名判据。两个零元素 Tensor 的指针也可能为 0，指针相等并不总能证明共享。

别名测试最好加入写入探针：选一个确定落在交集区域的元素，保存原值，原地修改 view，检查 base 的对应坐标，再恢复。对于需要梯度或生产数据，不要做破坏性探针，可改用 `torch._C._is_alias_of` 等内部诊断，但内部 API 不应进入稳定业务合同。

最后记录预期：该操作必须零拷贝、允许复制，还是禁止别名。`reshape` 官方明确不保证返回 view；若业务依赖零拷贝，应使用 `view`并接受不兼容时报错，或显式验证 Storage 指针和性能指标。

#### 本章结论

可复现的描述器把“看起来像 view”变成 shape、stride、offset、指针与写入传播五条证据。

## 核心机制

- 普通 strided Tensor 由 Storage 字节所有权与 TensorImpl 解释元数据共同定义。
- 逻辑元素地址为 storage_offset 与各维索引乘 stride 的和，再乘 dtype.itemsize。
- view 创建新的解释对象并共享 Storage；clone 创建新 Storage；普通赋值只共享 Python 对象。
- StorageImpl 的引用计数让任一别名存活时底层内存继续存活。
- shape/stride/offset 是视图特有元数据，多个 TensorImpl 可对同一字节给出不同坐标系。
- autograd view/version metadata 追踪求导正确性，不能与内存别名事实混为一个概念。
- meta、sparse 和 subclass 表明 Tensor 合同不必拥有普通 dense Storage。

## 常见误区

- 只比较 `Tensor.data_ptr()`判断是否共享 Storage，忽略不同 storage_offset 会得到不同首元素指针。
- 把 `numel()*element_size()`当作 view 保留内存，漏算它引用的大 Storage。
- 认为 shape 决定物理排列，忽略 stride 与 offset 才决定地址映射。
- 用 `_base is not None` 作为所有别名关系的完整判据。
- 删除 base 名称后期待 view 的内存立即释放。
- 用 `.data` 或底层 `set_` 绕开 autograd 和边界检查。
- 把 dense strided 结论无条件套到 sparse、meta、XLA 或 Tensor subclass。

## 实现变体

### 借用 view

useWhen: "调用链短、所有权清楚、需要零拷贝，并且调用者接受原地写会传播。"
tradeoff: "创建快且省带宽；会延长整个 Storage 生命周期，并让写入与 autograd 约束跨 API 边界传播。"

#### 代码

```
def borrow_columns(x: torch.Tensor) -> torch.Tensor:
    return x[:, :2]
```

### 拥有 clone

useWhen: "结果会长期缓存、跨并发边界传递，或必须与调用者后续 mutation 隔离。"
tradeoff: "所有权最清楚；付出真实内存分配和复制带宽，梯度历史是否保留还要结合 detach 选择。"

#### 代码

```
def own_columns(x: torch.Tensor) -> torch.Tensor:
    return x[:, :2].clone()
```

### 只携带 meta 合同

useWhen: "编译、模型装载规划或 shape 推导阶段只需输出属性，不需要真实数值。"
tradeoff: "避免大规模分配；数据依赖算子无法执行，后端元数据差异仍需真机验证。"

## 可运行示例

```python
import torch


def describe(tensor: torch.Tensor) -> dict[str, object]:
    return {
        "shape": tuple(tensor.shape),
        "stride": tensor.stride(),
        "offset": tensor.storage_offset(),
        "dtype": tensor.dtype,
        "device": tensor.device.type,
        "layout": tensor.layout,
        "storage_ptr": tensor.untyped_storage().data_ptr(),
        "data_ptr": tensor.data_ptr(),
        "storage_bytes": tensor.untyped_storage().nbytes(),
        "logical_bytes": tensor.numel() * tensor.element_size(),
    }


base = torch.arange(12, dtype=torch.float32).reshape(3, 4)
view = base[:, 1:3]
copy = view.clone()

base_info = describe(base)
view_info = describe(view)
copy_info = describe(copy)

assert base_info["storage_ptr"] == view_info["storage_ptr"]
assert base_info["data_ptr"] != view_info["data_ptr"]
assert view_info["offset"] == 1
assert copy_info["storage_ptr"] != view_info["storage_ptr"]

view[0, 0] = -7
assert base[0, 1].item() == -7
assert copy[0, 0].item() == 1

meta = torch.empty((3, 4), device="meta")
assert tuple(meta.shape) == (3, 4)
assert meta.numel() == 12
```

## 搭积木复现

### 积木 1：实现 Tensor 描述器

收集 shape、stride、offset、dtype、device、layout、两个 data_ptr、Storage bytes 与 logical bytes，并让输出可做断言。

### 积木 2：区分三种同一关系

分别构造普通赋值、slice view 与 clone，验证对象 identity、Storage identity 和值相等不能互推。

### 积木 3：手算地址

实现元素 offset 公式，覆盖连续矩阵与带非零 storage_offset 的列切片。

### 积木 4：验证写传播

修改 view 的交集元素，检查 base 变化且 clone 不变；恢复原值，避免测试污染。

### 积木 5：测量保留内存

从大 Tensor 取一个元素，删除 base 后比较 logical bytes 与 Storage bytes，解释为何 view 仍可读取。

### 积木 6：加入 meta 反例

在 meta device 创建同 shape Tensor，证明元数据运算可执行而取值/迁移需要真实数据。

## 自检

### 问题

`base = torch.arange(1000)`，`a = base[:10]`，`b = base[10:20]`，`c = a.clone()`。为什么 `a.data_ptr() != b.data_ptr()` 仍不能说明二者内存独立？删除 base 后谁让原 Storage 存活？怎样同时证明 c 与 a 值相等但所有权独立？

### 站内答案

`a` 与 `b` 的 Tensor.data_ptr 指向各自第一个逻辑元素，因为 storage_offset 分别为 0 和 10，所以地址不同；二者的 `untyped_storage().data_ptr()`相同，说明仍引用同一 StorageImpl。删除 base 只减少 base TensorImpl 的引用，a 和 b 各自持有共享 Storage，任一存活都会让 StorageImpl/DataPtr 继续存在。c 通过 clone 分配新 Storage；先用 `torch.equal(c, a)`证明逻辑值相等，再断言二者 `untyped_storage().data_ptr()`不同，并修改 a 后确认 c 不变，便同时建立值与所有权两条证据。

## 更新日志

### 启用课程级协作署名与折叠时间线

at: "2026-07-31T14:27:43+08:00"
human: "h0ll0w-AkuZr0guY"
ai: "OpenAI Codex · GPT-5"
summary: "为课程页接入默认只显示最近贡献、可展开完整历史的人类 × AI 协作日志；本次没有改写课程正文。"
