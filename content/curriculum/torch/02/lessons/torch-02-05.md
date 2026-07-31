---
id: "torch-02-05"
track: "torch"
title: "broadcast alignment"
depth: "deep"
visualIndex: "../visuals/torch-02-05.md"
exampleLanguage: "python"
readingMinutes: 25
sourceMinutes: 30
practiceMinutes: 55
reviewMinutes: 15
---

## 官方入口

title: "PyTorch 2.13 · Broadcasting semantics"
url: "https://docs.pytorch.org/docs/stable/notes/broadcasting.html#general-semantics"

官方定义：从尾维比较，尺寸相等、其中一个为 1、或一方该维不存在时可 broadcast；原地操作不能因 broadcast 改变目标 tensor 的 shape。

## 真实源码

repo: "pytorch/pytorch"
file: "aten/src/ATen/ExpandUtils.cpp"
symbol: "infer_size_impl"
language: "cpp"
url: "https://github.com/pytorch/pytorch/blob/v2.13.0/aten/src/ATen/ExpandUtils.cpp#L17-L45"

### 逐段讲解

- 实现从最后一维向前走，较短 shape 缺失的位置视为 size 1。
- 每一维只允许相等或一方为 1；否则在 non-singleton 维报告冲突。
- 结果维取非 1 的那一边，这解释了 `(5,1,4,1)+(3,1,1)`得到 `(5,3,4,1)`。
- 真实实现使用 SymInt guard，说明动态形状下“能否 broadcast”也是运行时需证明的条件。

### 源码节选

```cpp
template <typename Container, typename ArrayType>
Container infer_size_impl(ArrayType a, ArrayType b) {
  auto dimsA = static_cast<ptrdiff_t>(a.size());
  auto dimsB = static_cast<ptrdiff_t>(b.size());
  auto ndim = dimsA > dimsB ? dimsA : dimsB;
  Container expandedSizes(ndim);
  for (ptrdiff_t i = ndim - 1; i >= 0; --i) {
    ptrdiff_t offset = ndim - 1 - i;
    ptrdiff_t dimA = dimsA - 1 - offset;
    ptrdiff_t dimB = dimsB - 1 - offset;
    auto sizeA = (dimA >= 0) ? a[dimA] : 1;
    auto sizeB = (dimB >= 0) ? b[dimB] : 1;
    TORCH_MAYBE_SYM_CHECK(sym_eq(sizeA, 1) || sym_eq(sizeB, 1) || sym_eq(sizeA, sizeB),
        "The size of tensor a must match tensor b at non-singleton dimension");
    expandedSizes[i] = sym_eq(sizeA, 1) ? sizeB : sizeA;
  }
  return expandedSizes;
}
```

## 导读

broadcast 不是把小 tensor 真的复制很多份，而是为逐元素算子对齐坐标域。缺失前导维视为 1，size=1 维可以反复使用同一个逻辑元素；实现常以 zero stride 的 expand view 表达这种重复。输出算子是否分配，与输入是否被扩展是两回事。

最常见事故发生在轴语义，而非规则本身：`(B,T,D)+(B,D)`不会把第二个 tensor 当成每个 batch 的 bias，因为尾维从 D 对齐后，B 会撞上 T。正确形状通常是 `(B,1,D)`。先给每一维命名，再决定 unsqueeze 位置，比凭长度“试到能跑”为可靠。

本课把 forward 对齐、反向 reduce 和原地限制放在一起。它们都来自同一事实：一个输入元素若被逻辑复用多次，forward 可读同一地址，backward 必须把多条梯度贡献加回一个位置，而原地写没有唯一目标地址。


## 分章正文

### 从尾维对齐而非从左猜形状

kicker: "01 · ALIGN"

比较 `(5,1,4,1)`与`(3,1,1)`时先对齐最右端：1 对 1，4 对 1，1 对 3，5 对缺失 1，因此结果是 `(5,3,4,1)`。`0`不是万能空维：0 与 2 不相等且都非 1 时不可 broadcast。

把 shape 写成命名表，例如 logits `(B,T,V)`、bias `(V)`、padding mask `(B,T,1)`。每次扩展前给出目标轴表，能在模型维度碰巧相等时防住静默语义错位。

#### 本章结论

broadcast 的方向固定从尾维开始；轴名决定应在哪一位置插入 1。

### 扩展为何常用零 stride

kicker: "02 · VIEW"

把 `(B,1,D)`扩展到`(B,T,D)`时，中间维的所有逻辑坐标都应读同一个 bias 元素；zero stride 表示沿该维加一地址不变。它避免输入复制，但任何结果 tensor 仍可能为逐元素计算新分配。

这也解释 expanded view 的写限制：多个逻辑位置指向同一字节，向量化原地写没有唯一意义。需要写时先 clone 或选择生成新结果的 out-of-place 算子，别以“小 tensor 很便宜”绕过语义。

#### 本章结论

broadcast 输入常是零 stride 借用，输出是否新分配由算子合同决定。

### 梯度为何要 sum 回 singleton 维

kicker: "03 · BACKWARD"

若 bias `(D)`被加到 `(B,T,D)`，每个 bias 元素影响 B×T 个输出；反向时这 B×T 个梯度必须沿前两维求和，才能回到 bias 的 `(D)` shape。把 broadcast backward 看成 reduce-to-shape，可手推也可测。

这不是 autograd 的额外魔法，而是链式法则中的同一输入被多次使用。自定义 Function 若手写 forward expand，就必须在 backward 对被扩展的维 reduce；漏掉它会得到 shape 对不上或数值少累加的梯度。

#### 本章结论

forward 的一对多读取，对偶为 backward 的多对一累加。

### 原地操作为何不能扩大左值

kicker: "04 · INPLACE"

`x.add_(y)`可以在 y 广播到 x 的 shape 时成立，因为 x 的形状不变；反过来若需要把 x 从 `(1,3,1)`扩成`(3,3,7)`，原地操作会拒绝。左值只有原有 storage 几何，不能靠原地语法凭空获得更多独立元素。

还有扩展 view 本身的多对一写风险。即使某次 scalar 写看似可行，也不要把它推广到 vectorized kernel；清晰做法是将可变 buffer materialize 成独立 storage，并在接口中声明写权限。

#### 本章结论

原地合同优先保护左值 shape 与地址唯一性，不能用 broadcast 偷渡分配。

### 用 shape 合同而不是试错修广播

kicker: "05 · DIAGNOSIS"

报错中的 non-singleton dimension 是证据：从尾维编号定位冲突，再回到轴名表检查缺失的 singleton，而不是随意 `unsqueeze(0)`直到运行。对 batch size 与 sequence length 相等的测试尤其危险，应使用互不相等的 B、T、D。

性能诊断同时看 expand、contiguous、copy 和 reduction。重复消费同一广播输入时，提前 materialize 有时更快；一次消费通常不值得复制。基准要在真实 layout、真实 dtype/device 下测端到端，并将 copy 与算子时间分开。

#### 本章结论

shape 错误要按尾维证据和轴名修复，性能取舍要以真实下游 profile 决定。

### 把对齐、精度与归约误差一起验收

kicker: "06 · NUMERICS"

broadcast 经常出现在归一化、损失权重和注意力 mask 中，这些地方既有 shape 合同也有数值合同。以 `(B,T,D)`激活加 `(D)`bias 为例，forward 可逐元素比较；backward 则把 bias 梯度沿 B、T 归约。低精度下归约顺序会影响末位，GPU 并行还可能使浮点累加顺序变化，因此测试应使用 allclose 容差、较小的解析样例和 FP32 参考，而不是要求每次 bitwise 相等。

若掩码或权重经 broadcast 后参与 mean，分母必须与有效元素集合一致：简单写 `loss.mean()`会把 padding 也纳入分母，使不同序列长度的梯度尺度漂移。推荐先构造保形权重，再计算 `sum(weighted)/sum(weights)`，并对全零权重规定返回零、跳过 batch 或报告错误的策略。性能层面再比较隐式 broadcast、显式 expand 和 materialize；只要下游 kernel 能读零 stride，复制通常没有收益，只有多次复用或布局受限的 kernel 才值得用 profile 证明物化。

#### 本章结论

broadcast 的验收应覆盖轴、梯度归约、有效元素分母与浮点容差，才能从 shape 正确走到训练正确。

### 让 broadcast 错误尽早失败

kicker: "07 · DESIGN"

公共函数不应只接收两个裸 tensor 然后依赖运行时报错。可以在边界检查 rank、为每条轴提供可读名称，并在不允许广播的维上断言相等；允许共享的维则要求其中一方为 1。对概率、mask、权重等容易误放轴的输入，采用具名 reshape 或辅助函数生成目标 `(B,1,D)`，并用 B、T、D 全不相等的测试锁定意图。这样未来 layout 改变时，错误会在入口暴露而不是变成悄悄错误的训练曲线。

#### 本章结论

广播规则越强大，接口越应提前说明哪些轴允许被自动扩展。

### 手推一次 forward 与 backward

kicker: "08 · PRACTICE"

取 `x.shape=(2,3,4)`、`bias.shape=(4)`，先手写右对齐表，逐项计算 `y[b,t,d]=x[b,t,d]+bias[d]`，再令上游梯度全为一并手算 `grad_bias[d]=6`。随后将 bias 改成 `(1,4)`和 `(2,1,4)`，分别指出需要 reduce 的轴。最后故意写成 `(2,4)`并解释它为什么不能对齐到 `(2,3,4)`。这套小实验把广播、梯度与报错维度统一到同一张坐标表。

#### 本章结论

能手推一个非对称例子，才能确认 broadcast 不是只会“自动凑 shape”。将这张表保留在测试注释中，后续修改 tensor layout 时能快速判断变更是否仍保持原有数学含义，并把不允许的对齐明确写成失败样例。

## 核心机制

- 从尾维比较，相等、1 或缺失维可对齐。
- 扩展可由 size=1/zero-stride view 表示。
- backward 对被扩展维执行 reduce-to-shape。
- 原地左值不能因 broadcast 改变 shape。

## 常见误区

- 从左维对齐并误放 singleton。
- 把 expand 当成真实复制或当成可随意写的 buffer。
- 遗漏 broadcast backward 的求和。
- 用恰好相等的 B/T 测试掩盖轴错位。

## 实现变体

### 隐式 broadcast

useWhen: "两个输入的轴合同已清晰，逐元素算子直接表达即可。"
tradeoff: "代码短；需要 shape 注释和测试防止语义错位。"

### 显式 unsqueeze/expand

useWhen: "要暴露对齐位置、调试布局或为后续接口固定 rank。"
tradeoff: "意图可见；expand view 不能当独立可写 buffer。"

## 可运行示例

```python
import torch
x = torch.ones(2, 3, 4, requires_grad=True)
bias = torch.arange(4.0, requires_grad=True)
y = x + bias
assert y.shape == (2, 3, 4)
y.sum().backward()
assert torch.equal(bias.grad, torch.full((4,), 6.0))
try: torch.ones(1, 3, 1).add_(torch.ones(3, 1, 7))
except RuntimeError: pass
else: raise AssertionError('原地 broadcast 不得改变左值 shape')
```

## 搭积木复现

### 积木 1：右对齐 shapes

给较短 shape 补前导 1，并逐维检查。

### 积木 2：实现地址复用

为 size=1 维生成 zero stride 的教学 view。

### 积木 3：实现逐元素 forward

在共同 shape 遍历，记录每个输入坐标。

### 积木 4：实现 reduce backward

将输出梯度沿扩展维累加回原 shape。

### 积木 5：加入原地门禁

拒绝会改变左值 shape 或多对一写的请求。

## 自检

### 问题

为什么 `(B,T,D)+(D)`合法，且第二项梯度需要沿哪些维求和？为什么 `add_`不能让左值由 `(1,3,1)`变成 `(3,3,7)`？

### 站内答案

从尾维对齐后 `(D)`等价于`(1,1,D)`，缺失的两维视作 1，因此可扩展到 `(B,T,D)`。每个 bias[d]被 B×T 个输出复用，反向必须对 B、T 两维求和，结果才回到 `(D)`；可用 `y.sum().backward()`断言每项梯度为 B*T。原地 add_ 的左值仍只有 `(1,3,1)`这套 size/stride/storage 几何，broadcast 只能把右值读到左值形状，不能为左值创建 B 和 D 的独立地址；允许它会既改变 shape 又可能产生多对一写。正确选择是 out-of-place `x+y`，或先明确 `expand().clone()`付费 materialize 并获得独立可写所有权。
