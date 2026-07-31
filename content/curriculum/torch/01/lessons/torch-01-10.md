---
id: "torch-01-10"
track: "torch"
title: "clone、contiguous 与 to：显式物化、所有权和设备迁移"
depth: "deep"
visualIndex: "../visuals/torch-01-10.md"
exampleLanguage: "python"
readingMinutes: 25
sourceMinutes: 45
practiceMinutes: 50
reviewMinutes: 30
---

## 官方入口

title: "PyTorch 2.13 · Tensor Views / Tensor.contiguous"
url: "https://docs.pytorch.org/docs/stable/tensor_view.html#tensor-views"

官方说明 `contiguous()`在输入已按请求 memory format 连续时返回自身，否则复制；view 文档也提示 reshape/flatten 可能 view 或 copy，显式 materialization 应成为可见的接口边界。

## 真实源码

repo: "pytorch/pytorch"
file: "aten/src/ATen/native/TensorProperties.cpp"
symbol: "contiguous"
language: "cpp"
url: "https://github.com/pytorch/pytorch/blob/v2.13.0/aten/src/ATen/native/TensorProperties.cpp#L137-L146"

### 逐段讲解

- contiguous 先按指定 memory format 检查缓存布局属性，已连续时直接返回 self。
- Preserve 不是具体的连续遍历顺序，因此这里拒绝它。
- 不连续输入走 clone，产生独立 Storage；对 channels_last 等格式，上游完整实现选择相应路径。
- `to`还叠加 device、dtype、non_blocking 与 copy 标志，是否别名必须按目标属性逐项判断。

### 源码节选

```cpp
Tensor contiguous(const Tensor& self, MemoryFormat memory_format) {
  if (self.is_contiguous(memory_format)) {
    // 已符合目标布局：返回同一 Tensor，不分配也不改变 autograd 历史。
    return self;
  }
  TORCH_CHECK(memory_format != MemoryFormat::Preserve,
              "contiguous expects a concrete memory format");
  // clone 负责分配并按目标 memory_format 复制。
  return self.clone(at::MemoryFormat::Contiguous);
  // clone 为结果请求独立 Storage。
  // 它按当前逻辑值顺序写入目标布局。
  // 默认 contiguous 只是一个具体 memory format。
  // 已连续分支没有 allocator 成本。
  // to 的 dtype/device copy 在另一路径处理。
}
```

## 导读

前四课关注如何借用同一 Storage；这一课讨论何时有理由结束借用。`clone`总是创建独立数据，`contiguous`仅在目标布局不满足时复制，`to`在 dtype/device 等目标已匹配且未强制 copy 时可以返回原 Tensor。它们的输出值可能相同，所有权、布局、传输与 autograd 身份却不同。

显式物化像在数据管线里签收货物：从此刻起谁拥有缓冲区、花了多少带宽、布局为何可被下游假定，都应可观察。把 copy 隐藏在 reshape、外部库绑定或 `.cpu().numpy()`深处，会让显存峰值和延迟在生产中才显形。

这一课把 clone、contiguous、to 合并，是因为它们共同构成 materialization 的决策面：独立所有权、指定布局、以及跨 dtype/device。分开讲会让学习者只背“某函数会复制”，却不能设计有成本边界的接口。


## 分章正文

### 值相同、对象相同、Storage 相同

kicker: "01 · IDENTITY"

`clone()`的值相同、Python 对象不同、Storage 不同；`contiguous()`对已连续输入可能三者都相同；`to(dtype=同 dtype, device=同 device)`默认也可能直接返回原对象。测试必须按合同选择 `is`、Storage 指针、stride、dtype/device 与 `torch.equal`，不能只断言最后一项。

对于 slice，Tensor.data_ptr 可能受 offset 影响；跨 view 判断拥有同一底层缓冲区应比较 untyped storage 指针和 device。CUDA 还需用 allocator 指标观察真实分配，CPU 的 OS RSS 不必立即下降。

#### 本章结论

materialization 测试至少覆盖对象、Storage、值、布局和设备五层证据。

### contiguous 是条件复制，不是格式化咒语

kicker: "02 · CONTIGUOUS"

默认连续性要求最后一个非 size-1 维 stride 为 1 并向前递推。transpose 常破坏这个顺序，`contiguous()`会按当前逻辑值顺序新建默认连续 buffer；输入已经连续时它直接返回 self。

channels_last 是另一种连续记忆格式。`is_contiguous()`为 false 并不意味着 `is_contiguous(memory_format=torch.channels_last)`也为 false。服务代码要声明消费者需要哪个 format，不能在每一层无条件转回默认格式。

#### 本章结论

contiguous 的 copy 条件依赖目标 memory format；默认连续只是其中一种。

### to 同时可能是 cast、搬运和 copy

kicker: "03 · TO"

`to(device, dtype, non_blocking, copy, memory_format)`把多个变换揉在一个接口中。目标 dtype/device/layout 不变且 `copy=False`时，它可别名返回；dtype 改变必须新解释为另一元素宽度，设备改变需要跨设备传输，`copy=True`则强制独立副本。

CUDA 的 `non_blocking=True`只是允许异步条件的请求，不是普遍速度开关。CPU page-locked、stream 依赖、源 buffer 生命周期与后续同步决定能否重叠。计时要在正确 stream 同步后做，不能把排队时间误报成传输完成。

#### 本章结论

to 的名字不等于总会复制；目标属性和 copy 参数才决定别名边界。

### 复制怎样连接或切断计算图

kicker: "04 · AUTOGRAD"

clone 与可微 dtype/device copy 通常保留梯度路径，输出有对应 grad_fn；它们创建的是新数据，不是新的学习起点。要切断历史必须显式 `detach()`，要得到独立叶子常用 `detach().clone().requires_grad_(True)`并说明原因。

原地修改 clone 不会改变原 Tensor 的值，但如果两者都在图中，梯度关系仍需要按操作链推导。不要用 `.data`伪造“无梯度复制”，它会绕过版本计数并可能让 backward 使用被篡改的保存值。

#### 本章结论

内存独立和计算图独立是两种选择，clone 只解决前者。

### 把 copy 变成预算而非意外

kicker: "05 · ENGINEERING"

每个性能敏感接口应选择一种明确合同：`accept_strided`直接消费任意 stride；`require_contiguous`检查后报错；`normalize_contiguous`复制并返回 bytes/materialized 指标。三种都合理，危险的是第三种藏在函数内部且无人监控。

基准把 CUDA synchronize、warmup、真实 layout、copy bytes 与 kernel 时间写入报告。生产指标可统计 materialization 次数、峰值 memory、H2D/D2H bytes；当数据布局变更使 `contiguous`从 no-op 变 copy 时，告警才能在成本扩散前出现。

#### 本章结论

高效不是永远不复制，而是复制发生在明确、可测量、可承担的边界。

### 先问“谁拥有字节”，再调用复制 API

kicker: "06 · DECISION TABLE"

同一 device、dtype、layout 且 `copy=False`时，`to`可以返回原 Tensor；这意味着调用方不能把 `to(device)`当作隔离所有权的承诺。需要隔离时选择 clone 或 `to(..., copy=True)`并验证 Storage 指针变化。需要切断梯度历史时，先决定是否要保留值：`detach()`借用同一存储，`detach().clone()`才同时得到独立字节和新的 leaf。

连续性也应按消费者要求而非习惯决定。若下游支持任意 stride，保留 transpose/slice view 可以省带宽；若下游 kernel 的索引公式假设某个 memory format，入口应检查 `is_contiguous(memory_format=...)`，失败时明确复制或返回可操作错误。把 `.contiguous()`散落在中间层会让性能剖析失去因果线索。

建立回归表时覆盖三种输入：连续 base、transpose 的非连续 view、expand 的零 stride view。每种都报告对象身份、Storage identity、stride、逻辑 bytes、实际分配 bytes、`grad_fn`和消费时间。只有这张表能区分“数值没变”的五种不同语义，也能解释为何某次升级突然多了显存峰值。

跨设备时还需把 copy 与同步拆开观测：H2D/D2H 的分配、stream 等待、pinned host memory 和目标布局各有成本。一个看似只是 `to(...).contiguous()` 的表达式可能同时完成 cast、传输和重排，诊断时应分段记录。

#### 本章结论

clone、contiguous 与 to 是所有权和布局的显式决策，值相等从来不是充分证据。

## 核心机制

- clone 产生独立 Storage 并按指定 memory format 复制逻辑值。
- contiguous 已满足目标格式时返回 self，否则 clone。
- to 根据 device、dtype、layout 和 copy 参数选择别名或转换/传输。
- 数据独立不等于 detach；梯度路径需单独设计。

## 常见误区

- 把每个 non-contiguous Tensor 都立即 contiguous。
- 假定 to 总是新建 Tensor，或假定 non_blocking 必然异步完成。
- 以 `.data`绕开 autograd 的版本安全。
- 只测连续输入，漏掉真实 transpose/expand/slice 的 hidden copy。

## 实现变体

### 严格布局接口

useWhen: "自定义 kernel 无法正确处理任意 stride，且复制成本不可接受。"
tradeoff: "失败早、成本可预测；调用者必须在上游安排布局。"

### 规范化布局接口

useWhen: "产品优先兼容输入，同时允许可观测的复制预算。"
tradeoff: "调用简单；需暴露 materialized/bytes/latency，避免静默退化。"

## 可运行示例

```python
import torch

base = torch.arange(12., requires_grad=True).reshape(3, 4)
transposed = base.transpose(0, 1)
packed = transposed.contiguous()
assert packed.is_contiguous()
assert packed.untyped_storage().data_ptr() != transposed.untyped_storage().data_ptr()
assert base.contiguous() is base  # 已连续时是 no-op

same = packed.to(dtype=packed.dtype, device=packed.device)
forced = packed.to(copy=True)
assert same is packed
assert forced.untyped_storage().data_ptr() != packed.untyped_storage().data_ptr()
assert torch.equal(forced, packed)
```

## 搭积木复现

### 积木 1：写五层报告

报告 object id、Storage、shape/stride、dtype/device、值相等。

### 积木 2：实现 clone

按逻辑迭代复制到新连续 buffer，断言写不回传。

### 积木 3：实现条件 contiguous

先判断目标格式，已满足返回原对象，否则调用 clone。

### 积木 4：模拟 to 决策

对相同属性、dtype 改变、device 改变、copy=True 分别返回别名或新 buffer。

### 积木 5：加入 autograd 实验

比较 clone、detach、detach().clone 的 leaf 与 grad_fn。

### 积木 6：做布局基准

在连续、transpose、expand 输入上分离 copy 和消费 kernel 的计时。

## 自检

### 问题

为什么 `x.contiguous()`有时和 x 是同一对象，而 `x.clone()`不是？`x.to(x.device, x.dtype)`又何时可能直接返回 x？若下游只能接收默认连续 GPU float32，怎样设计可观测接口？

### 站内答案

contiguous 先检查目标 memory format，已满足便返回 self；clone 的合同是独立数据，必有新 Storage。to 在目标 device/dtype/layout 已满足且 copy=False 时可直接返回 x，否则需要 cast、传输或复制。接口可提供 strict 模式，遇到非连续或非 GPU float32 报出 shape/stride；或 normalize 模式执行 `to(...).contiguous()`并返回/记录 materialized、copy bytes、H2D bytes 与耗时，同时用真实非连续输入做回归。部署时区分冷启动、稳态 batch、跨 stream 依赖和 pinned memory，避免把异步排队误测成完成时间；每次格式转换都应有明确消费者理由。还应测试 channels_last：它可能默认不连续却已经是卷积期望的连续格式，强制默认 contiguous 会徒增 copy。接口中把 desired memory format 作为显式参数，并在输出中报告输入布局、目标布局、是否返回原对象、Storage 是否更换和传输是否完成同步，调用方才能正确叠加多个边界。序列化边界也要做选择：保存 view 时可保留别名关系，保存已 clone 的 feature 则独立拥有数据；恢复后用 Storage identity、值和内存大小验证实际合同，而不是假定保存函数会自动表达业务所有权。
