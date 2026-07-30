---
id: "torch-01-05"
track: "torch"
title: "view、reshape 与 flatten：零拷贝兼容条件和复制回退"
depth: "deep"
exampleLanguage: "python"
readingMinutes: 40
sourceMinutes: 40
practiceMinutes: 80
reviewMinutes: 20
---

## 官方入口

title: "PyTorch 2.13 · torch.Tensor.view"
url: "https://docs.pytorch.org/docs/stable/generated/torch.Tensor.view.html#torch.Tensor.view"

官方给出 view 的连续子空间条件：合并原维度 d..d+k 时相邻 stride 必须满足 stride[i] = stride[i+1]×size[i+1]。不确定时 reshape 会在兼容时返回 view，否则复制；调用者不应依赖 reshape/flatten 是否别名。

## 真实源码

repo: "pytorch/pytorch"
file: "aten/src/ATen/native/TensorShape.cpp"
symbol: "reshape and view_impl"
language: "cpp"
url: "https://github.com/pytorch/pytorch/blob/v2.13.0/aten/src/ATen/native/TensorShape.cpp#L2080-L2116"

### 逐段讲解

- `infer_size_dv`先检查元素数量并解析一个 `-1` 推断维；相同 numel 是必要条件，却不是 view 的充分条件。
- `computeStride`把旧 sizes/strides 分成连续子空间 chunk，尝试让新 shape 的维度完整装入这些 chunk；失败返回 nullopt。
- `view_impl`在 computeStride 失败时直接报错，因此 `view`给调用者零拷贝保证：成功即共享数据，不会静默复制。
- `reshape`成功算出 stride 时调用内部 `_reshape_alias`；对特殊后端保留 view 分支，说明公开语义与后端能力分层。
- 无法 alias 时 reshape clone 成默认 contiguous，再用 unsafe_view 改 shape；unsafe 仅表示内部已完成检查，不是建议用户绕过安全。

### 源码节选

```cpp
// PyTorch v2.13.0 · aten/src/ATen/native/TensorShape.cpp
Tensor reshape(const Tensor& self, IntArrayRef proposed_shape) {
  if (self.is_sparse()) {
    TORCH_CHECK(false, "reshape is not implemented for sparse tensors");
  }
  DimVector shape = infer_size_dv(proposed_shape, self.numel());

  if (self.is_mkldnn()) {
    return at::_mkldnn_reshape(self, shape);
  }

  // 能否只改元数据，由 sizes/strides 的连续子空间决定。
  auto stride =
      at::detail::computeStride(self.sizes(), self.strides(), shape);

  if (stride.has_value()) {
    if (!self.is_xla() && !self.is_lazy() && !self.is_ipu()) {
      // 已算出新 stride，直接创建 alias，避免 view 重复计算。
      return self._reshape_alias(shape, stride.value());
    } else {
      return self.view(shape);
    }
  }

  // 不兼容时先按默认连续格式 clone，再建立目标 shape。
  return at::_unsafe_view(
      self.clone(at::MemoryFormat::Contiguous), shape);
}

static inline Tensor view_impl(const Tensor& self, IntArrayRef size) {
  at::DimVector inferred_size = at::infer_size_dv(size, self.numel());
  auto stride = at::detail::computeStride(
      self.sizes(), self.strides(), inferred_size);
  TORCH_CHECK(stride.has_value(), "view size is not compatible");
  return alias_with_sizes_and_strides(self, inferred_size, *stride);
}
```

## 导读

view、reshape、flatten 都能改变 shape，差别藏在复制合同。`view`要求新 shape 可用同一 Storage 与一组新 stride 表达，不满足就报错；`reshape`优先 view，不行就复制；`flatten`在展平维度不需要改变时可能返回原对象，在兼容时返回 view，其他情况复制。只看输出 shape 无法判断所有权。

“numel 相同就能 view”是最常见误解。把一组原维度合并成一个新维度时，那些维度必须在物理地址上形成连续子空间。transpose 后 stride 顺序被打断，某些维仍可局部合并，跨越 chunk 边界则必须重排字节。

复制回退让 reshape 易用，也会把性能与别名语义变成输入布局的函数。同一行代码在连续训练数据上零拷贝，在另一路非连续数据上突然分配数 GB。稳定 API 要选择：需要零拷贝时用 view 让失败显式；允许复制时用 reshape，并监控/测试物化。

## 分章正文

### 相同 numel 为什么只是一张入场券

kicker: "01 · NECESSARY"

目标 shape 的维乘积必须等于原 numel，`-1`最多出现一次并由剩余维推断。这个检查只证明逻辑元素数量匹配，尚未证明按目标行主序遍历时可以沿原 stride 访问同一值序列。

连续 `(2,3,4)`能 view 为 `(6,4)`、`(2,12)`或 `(24,)`，因为原维度形成一个连续 chunk。转置为 `(2,4,3)`、stride `(12,1,4)`后，最后两维的地址交错，直接合成 12 会改变元素顺序。

reshape 的输出值顺序以输入逻辑遍历顺序为准。复制回退先把该逻辑顺序物化为 contiguous，再换 shape，所以值正确；若只是任意改 sizes/strides，可能得到 shape 正确却排列错误的 Tensor。

#### 本章结论

numel 保证数量守恒，连续子空间条件保证顺序守恒；view 同时需要两者。

### 连续子空间条件怎样手算

kicker: "02 · CHUNKS"

从最内维向外看，若 `stride[i] == stride[i+1] * size[i+1]`，维 i 与 i+1 在物理上首尾相接，可以归入同一 chunk。size 1 维没有实际跨步，通常可以灵活嵌入。

每个 chunk 有总元素数和基础 stride。目标 shape 从后往前装入：新维度乘积必须恰好分割 chunk，不能把一个新维跨过两个不连续 chunk。computeStride 正是在做这套匹配，并返回目标 stride。

例如 shape `(2,4,3)`、stride `(12,1,4)`中，后两维不满足 `1 == 4×3`，形成不同 chunk；view `(2,12)`失败。view `(2,4,3)`当然成功，某些插入/删除 size-1 维也可成功。

#### 代码

```python
x = torch.arange(24).reshape(2, 3, 4).transpose(1, 2)
assert x.shape == (2, 4, 3)
assert x.stride() == (12, 1, 4)

try:
    x.view(2, 12)
except RuntimeError as error:
    assert "not compatible" in str(error)
```

#### 本章结论

把 stride 相邻递推断开的地方画成 chunk 边界，便能预测哪些维可以零拷贝合并。

### view 用报错换取可预测别名

kicker: "03 · VIEW"

`view(*shape)`成功时共享底层数据，修改输出会影响 base 的映射区域。它适合库内部明确依赖零拷贝、并已控制输入布局的路径。失败把布局变化暴露在最近的边界，而不让昂贵复制潜伏。

但 view 也不保证输出默认 contiguous；它只保证给定 shape 有合法 stride。对某些非连续输入，改变 size-1 维或在 chunk 内拆分仍可生成非连续 view。

还有 `view(dtype)`重载，它重新解释字节而非改变 shape 的普通语义，对最后维 stride、offset 和元素宽度有独立约束。代码审查时应根据参数类型区分，避免把位级 reinterpretation 当 shape view。

#### 本章结论

shape view 的核心合同是成功即零拷贝、失败即显式；它不承诺默认连续，也不同于 dtype view。

### reshape 的复制回退如何工作

kicker: "04 · RESHAPE"

reshape 先推断 shape，再调用 computeStride。若有目标 stride，内部 `_reshape_alias`直接创建别名；否则 clone 为默认 contiguous，并在新 Storage 上建立目标 view。调用者得到相同逻辑值，但所有权与成本可能变化。

不能用 `_base`、对象 identity 或某次指针结果把 reshape 行为写成业务假设。官方明确要求调用者不依赖是否 view。若后续必须隔离，显式 clone；若必须共享，使用 view并处理错误。

性能测试要覆盖真实上游布局。只拿 `torch.randn`连续输入 benchmark，会漏掉 transpose、channels_last 或 slice 导致的回退。profile 中的 clone/copy 与峰值内存，是 reshape 物化的直接证据。

#### 代码

```python
base = torch.arange(24).reshape(2, 3, 4)
non_contiguous = base.transpose(1, 2)

alias = base.reshape(6, 4)
copy = non_contiguous.reshape(2, 12)
assert alias.untyped_storage().data_ptr() == base.untyped_storage().data_ptr()
assert copy.untyped_storage().data_ptr() != non_contiguous.untyped_storage().data_ptr()
```

#### 本章结论

reshape 承诺值与 shape，不承诺别名；输入 stride 决定它走 alias 还是 clone。

### flatten 为什么还有“返回原对象”第三种结果

kicker: "05 · FLATTEN"

`torch.flatten(input, start_dim, end_dim)`只合并指定维区间。若 start_dim 与 end_dim 相同，无维度需要展平，官方允许返回原对象；若区间可 view 则返回 view，否则复制。

这意味着 flatten 的对象 identity、Storage identity 都不稳定，调用方只能依赖输出值与 shape。需要新所有权时再 clone，需要零拷贝时可把目标 shape 算出后调用 view。

模型中常在卷积与线性层之间 flatten。channels_last 或特殊切片可能改变复制路径，最好让模块边界的 memory format 稳定，并在 profile 中观察 flatten 是否产生 materialization。

#### 本章结论

flatten 是局部 reshape 便利接口，可能原样返回、别名或复制；所有权合同必须由调用者另行表达。

### 别名与复制都怎样进入梯度图

kicker: "06 · AUTOGRAD"

view 输出具有 view backward 关系，梯度按相同几何映射回 base。reshape 若复制，clone 和 view 都是可微操作，梯度仍能回到输入；因此 Storage 是否共享与梯度是否连接是两条独立事实。

原地修改 view 可能触发版本计数错误，尤其当 backward 保存了旧值。不能因为 reshape 某次复制就假设原地写安全，下一批输入布局兼容时它可能变成 alias。业务逻辑若需要独立可写缓冲区，应显式 clone。

验证应对输入设 requires_grad，比较 view/reshape 路径的前向值与解析梯度，再用 gradcheck 或有限差分处理复杂函数。只看 `grad_fn`名字不足以证明数值正确。

#### 本章结论

复制不等于 detach，别名也不等于梯度一定危险；求导连接、内存共享和原地写要分别验证。

### 把零拷贝需求写进接口与测试

kicker: "07 · API CHOICE"

内部高性能算子若要求零拷贝，应接受明确 layout，调用 view，并在错误中报告 shape/stride。上层应用若更重视兼容，可用 reshape，但记录是否共享 Storage、copy bytes 与延迟。

不要写 `x.contiguous().view(...)`当万能修复，它无论是否必要都可能复制；`reshape`至少在兼容时省去复制。反过来，若后续本来就要求 contiguous，显式 contiguous 可以把成本放在可观测边界并复用。

回归测试准备连续、transpose、step slice、size-1 维和空 Tensor。分别断言 view 成败、reshape 数值、Storage identity 和 backward。这样上游布局变化不会悄悄改变性能或写传播。

在 torch.compile/export 路径中，shape 与 stride 还可能进入 guard。一次运行因连续而捕获的 alias 路径，换成非连续输入可能触发重新编译、graph break 或走复制分支。性能验收因此要记录编译次数与输入布局分布，不能只观察 eager 单次调用。

若结果要跨缓存或并发边界，reshape 的条件别名尤其危险：某些输入与调用者共享写入，另一些输入独立。接口应在边界追加 clone 固定所有权，或把返回类型/文档明确标为只读借用，并禁止下游原地修改。

#### 本章结论

选择 API 的依据是别名保证：view 要求共享，reshape 允许回退，clone 要求独立；shape 只是共同表面。

### 用教学版 computeStride 复现源码判断

kicker: "08 · SOURCE REBUILD"

教学实现先处理 numel 为零与完全相同 shape，再从旧 shape 最末维向前累计当前 chunk 的元素数。遇到 stride 递推断点时，目标 shape 也从末维向前累计，直到元素数与旧 chunk 精确相等；无法相等便返回 None。

返回的目标 stride 从 chunk 基础 stride 递推生成。size-1 目标维可以插入而不改变地址集合，但实现仍要给出可用 stride。真正源码还处理 SymInt 未定关系：无法证明兼容时宁可返回 nullopt 走 clone，也不冒险生成错误别名。

复现不必覆盖所有后端和符号形状，却必须与 torch 在一组表格上对照：连续拆分/合并成功，transpose 跨 chunk 失败，size-1 维成功，step slice 局部情况和零元素行为。错误案例要同时检查教学预测、view 异常与 reshape 复制，形成三方证据。

#### 本章结论

computeStride 的核心任务是证明目标维能完整装入旧连续 chunk；证明失败时复制是安全回退。

## 核心机制

- infer_size 检查 numel 守恒并解析一个 -1 维。
- computeStride 按连续子空间 chunk 判断目标 shape 能否沿用 Storage。
- view 失败即报错，成功通过 alias_with_sizes_and_strides 共享数据。
- reshape 先尝试 alias，不兼容时 clone contiguous 后再建立目标 view。
- flatten 只合并指定区间，并可能返回原对象、view 或 copy。
- reshape 的复制仍可微，不自动切断 autograd 历史。
- 输入 layout/stride 是复制路径与性能的隐藏变量。

## 常见误区

- 认为 numel 相同就总能 view。
- 依赖 reshape 永远零拷贝或永远复制。
- 用 `_base`作为 reshape 是否复制的稳定公共合同。
- 在所有路径前无条件 contiguous().view，制造不必要复制。
- 把 reshape 复制误认为 detach，忽略梯度仍会回传。
- 对可能 alias 的 reshape 输出做原地写，却按一次实验的 copy 行为推断安全。
- benchmark 只用连续输入，漏掉真实 transpose/slice 回退。

## 实现变体

### view：零拷贝强合同

useWhen: "性能关键内部路径已控制 stride，任何复制都应作为错误暴露。"
tradeoff: "共享和成本可预测；上游布局变化会直接报错，需要调用者处理或物化。"

### reshape/flatten：兼容优先

useWhen: "应用层需要接受多种布局，允许框架在必要时复制。"
tradeoff: "代码简洁、值语义稳定；延迟、峰值和别名随输入变化，必须监控。"

### contiguous + view：显式物化边界

useWhen: "下游多次复用默认连续布局，愿意在单一边界支付复制。"
tradeoff: "后续路径统一且可 profile；若输入原本可 view 或下游支持 stride，可能浪费带宽。"

## 可运行示例

```python
import torch


def shares_storage(left: torch.Tensor, right: torch.Tensor) -> bool:
    return (
        left.device == right.device
        and left.untyped_storage().data_ptr()
        == right.untyped_storage().data_ptr()
    )


base = torch.arange(24, dtype=torch.float32).reshape(2, 3, 4)
transposed = base.transpose(1, 2)

compatible = base.reshape(6, 4)
assert shares_storage(compatible, base)

try:
    transposed.view(2, 12)
except RuntimeError as error:
    assert "not compatible" in str(error)
else:
    raise AssertionError("跨连续子空间的 view 必须失败")

fallback = transposed.reshape(2, 12)
assert not shares_storage(fallback, transposed)
assert torch.equal(fallback, transposed.contiguous().view(2, 12))

x = torch.arange(12.0, requires_grad=True).reshape(3, 4)
y = x.reshape(2, 6)
loss = (y * y).sum()
loss.backward()
assert x.grad is None  # x 不是叶子；叶子是最初 arange 的结果
assert y.grad_fn is not None
```

## 搭积木复现

### 积木 1：检查 shape 数量

实现 -1 推断和 numel 守恒，覆盖标量、零元素与多个 -1 的失败。

### 积木 2：划分连续 chunk

从末维向前按 stride 递推分块，打印 transpose 在哪里断开。

### 积木 3：预测 view

用 chunk 容量匹配目标 shape，先预测成功/失败，再与 torch.view 对照。

### 积木 4：观察 reshape 分派

对连续、transpose、step slice 比较 Storage identity、值、stride 和 profile copy。

### 积木 5：覆盖 flatten 三态

分别构造无需展平、可 view 展平和必须复制的输入，验证对象/Storage identity。

### 积木 6：加入 autograd

从真实叶子构造 view 与 copy 路径，保留叶子引用，比较前向与梯度。

### 积木 7：写性能门禁

用真实上游布局跑 benchmark，分别报告 reshape、copy 和消费 kernel 的时间与峰值。

## 自检

### 问题

同一个 `x.reshape(batch, -1)`在训练 A 中零拷贝，在训练 B 中突然产生大规模显存分配，但数值与梯度仍正确。请沿源码分派解释原因，给出确认复制的证据，并分别设计“复制绝不允许”和“复制允许但要可观测”的接口。

### 站内答案

A 的输入 sizes/strides 能被 computeStride 分成与目标 shape 匹配的连续 chunk，reshape 走 `_reshape_alias`共享 Storage；B 的上游可能增加 transpose、step slice 或不同 memory format，使 computeStride 返回 nullopt，reshape 于是 clone 为默认 contiguous，再 unsafe_view，因此数值顺序和 autograd 连接仍正确但产生新 Storage。证据包括输入 shape/stride、输出与输入 `untyped_storage().data_ptr()`不同、profiler 中 clone/copy_、memory_allocated 峰值和对应延迟。复制绝不允许的内部 API 应声明输入布局并调用 view，失败时报告 shape/stride；兼容 API 可调用 reshape，但记录 materialized 布尔值、copy bytes/延迟，设置预算或告警，并用真实连续与非连续输入做回归。
