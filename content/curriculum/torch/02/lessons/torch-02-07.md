---
id: "torch-02-07"
track: "torch"
title: "in-place 约束：内存重叠断言、版本计数与叶子检查"
depth: "deep"
visualIndex: "../visuals/torch-02-07.md"
exampleLanguage: "python"
readingMinutes: 25
sourceMinutes: 30
practiceMinutes: 50
reviewMinutes: 15
---

## 官方入口

title: "PyTorch 2.13 · Autograd mechanics — In-place operations with autograd"
url: "https://docs.pytorch.org/docs/stable/notes/autograd.html#in-place-operations-with-autograd"

官方说明：autograd 支持原地操作，但并不鼓励使用；它通过**版本计数器**追踪每个张量的修改，任何被 backward 需要的张量一旦版本号发生变化就会报错，而叶子张量在 `requires_grad=True` 时根本不允许被原地修改。

## 真实源码

repo: "pytorch/pytorch"
file: "aten/src/ATen/MemoryOverlap.cpp"
symbol: "has_internal_overlap"
language: "cpp"
url: "https://github.com/pytorch/pytorch/blob/v2.13.0/aten/src/ATen/MemoryOverlap.cpp#L11-L54"

### 逐段讲解

- 函数只处理 strided layout，返回值是三值枚举 `Yes / No / TooHard`，不是布尔——这决定了「查不出来就放行」是设计内的行为。
- 只要有 stride 是未 hint 的 unbacked SymInt 就直接返回 `TooHard`，说明动态形状下 PyTorch 选择保守地不做静态判定。
- `is_non_overlapping_and_dense_or_false()` 命中就返回 `No`，这是一次快速通道：连续稠密张量不可能自重叠。
- 真正的检测循环只判断一种模式——某维 size > 1 且 stride == 0，也就是 `expand` 生成的零 stride 视图；命中返回 `Yes`。
- 其余情况一律落到 `TooHard`。这意味着 `as_strided` 手工构造的重叠视图不会被拦下，原地写会静默产生错误结果。
- `assert_no_internal_overlap` 只在结果等于 `Yes` 时抛错，错误文本明确指向「written-to tensor」并建议 `clone()`。

### 源码节选

```cpp
MemOverlap has_internal_overlap(TensorImpl* t) {
  TORCH_INTERNAL_ASSERT_DEBUG_ONLY(t->layout() == kStrided);
  auto sizes = t->sym_sizes();
  auto strides = t->sym_strides();
  for (const auto i : c10::irange(strides.size())) {
    if (!strides[i].has_hint()) {
      return MemOverlap::TooHard;      // 动态形状：拒绝静态判定
    }
  }
  if (t->is_non_overlapping_and_dense_or_false()) {
    return MemOverlap::No;             // 稠密连续，快速放行
  }
  for (const auto i : c10::irange(strides.size())) {
    if (TORCH_GUARD_OR_FALSE(sizes[i].sym_gt(1)) && strides[i] == 0) {
      return MemOverlap::Yes;          // 只认这一种：零 stride 广播维
    }
  }
  return MemOverlap::TooHard;          // 其它别名形态查不出来，放行
}

void assert_no_internal_overlap(TensorImpl* t) {
  TORCH_CHECK(has_internal_overlap(t) != MemOverlap::Yes,
    "unsupported operation: more than one element of the written-to tensor "
    "refers to a single memory location. Please clone() the tensor before "
    "performing the operation.");
}
```

## 导读

「为什么这个 `add_` 报错了」几乎总是三个互不相干的检查之一在说话，而它们分属两个层次。ATen 层关心地址：写入目标自己是否有多个坐标指向同一字节，以及左值和右值是否共享 storage。autograd 层关心历史：这个张量是不是用户创建的叶子、是不是某个视图、以及它保存下来给 backward 用的值有没有被改掉。把报错文本当成同一类问题去猜，通常会 clone 错对象。

三层的失败模式也不同。ATen 的重叠断言是硬错误，立刻抛出；autograd 的叶子检查同样是硬错误，但发生在 forward 调用的瞬间；而版本计数器的错误最晚——它在 `backward()` 时才爆发，错误文本里会精确写出「is at version 1; expected version 0」。这条时间差解释了为什么很多原地 bug 在训练跑了一整个 step 之后才暴露。

更值得记住的是这套检查并不完备。`has_internal_overlap` 只认零 stride 一种模式，`as_strided((2,3),(1,1))` 这类手工构造的重叠视图会返回 `TooHard` 并被放行，原地写直接得到错误数值且没有任何提示。工程上的结论是：门禁能拦住的是常见误用，不是所有别名；自己构造非常规 stride 时，安全性要由调用方自己保证。

## 分章正文

### 一次原地写要过哪几道门

kicker: "01 · LAYERS"

按调用顺序，`x.add_(y)` 依次经过：autograd 层的 `check_inplace(x, ...)` 决定这个张量能不能被写；ATen 层的 `assert_no_internal_overlap(x)` 决定 x 自己是否别名重叠；`assert_no_overlap(x, y)` 决定左右值是否共享内存；写入完成后 autograd 递增 x 的版本号；最后在 `backward()` 时比对每个 saved tensor 的版本号。

分清层次的价值在于修法不同。叶子检查要改的是「谁被写」，通常加一次 `clone()` 或用 `with torch.no_grad()`；重叠断言要改的是「写谁和读谁」，通常是把右值 `clone()` 出来；版本计数错误要改的是「顺序」，通常是把原地操作换成 out-of-place，或者把它挪到不再被 backward 依赖之后。

#### 本章结论

原地写的三道门分属 autograd 与 ATen 两层，报错文本可以直接反查是哪一层。

### 自重叠检测只认零 stride

kicker: "02 · SELFOVERLAP"

`torch.zeros(3).expand(2, 3).add_(1)` 会抛出「more than one element of the written-to tensor refers to a single memory location」，因为 expand 把某维的 stride 设成 0，检测循环一眼就能看到。这是最常见的自重叠来源，也是这条断言真正想拦的对象。

但把同样的期待推广到所有别名就错了。`torch.zeros(4).as_strided((2, 3), (1, 1))` 里六个逻辑元素挤在四个真实位置上，stride 全非零，`is_non_overlapping_and_dense` 也不成立，于是函数落到 `TooHard` 分支放行。实测 `.add_(1)` 得到 `[[1, 2, 2], [2, 2, 1]]`——被覆盖两次的位置加了两次 1，而这一切没有任何告警。

#### 本章结论

零 stride 会被拦，`as_strided` 构造的重叠不会；`TooHard` 的含义是放行而不是保守拒绝。

### 跨张量重叠看的是 storage 区间

kicker: "03 · CROSSOVERLAP"

`assert_no_overlap(a, b)` 走的是 `get_overlap_status`，比较两个张量的 storage 是否同一块以及数据区间是否相交。`torch.arange(6.)` 上做 `b[0:4].add_(b[2:6])` 会命中，报错文本是「some elements of the input tensor and the written-to tensor refer to a single memory location」——注意它和自重叠的文本不同，前半句是 input tensor 而不是 written-to tensor。

这条门禁的边界同样值得记：它比较的是 storage 指针与区间，所以由高级索引物化出来的副本永远安全，而 slice、`view`、`transpose`、`expand` 这类共享 storage 的视图都可能触发。写通用工具函数时，如果输入既可能是视图也可能是独立张量，最稳的做法是在原地写之前对右值做一次 `clone()`，代价固定且远小于调试静默错误。

#### 本章结论

跨张量断言比较 storage 区间，视图作右值是主要触发源，错误文本以 input tensor 开头。

### 叶子与视图为什么被单独裁决

kicker: "04 · LEAF"

`check_inplace` 在 `torch/csrc/autograd/VariableTypeUtils.h` 里把可写性归成四种结果。`requires_grad=True` 的叶子直接拒绝，因为叶子的 `.grad` 是优化器的写入目标，原地改值会让「参数当前值」和「反向图里记录的值」失去对应。叶子的视图被单独列出来，错误文本多了「a view of」，提示你 clone 的对象应该是原张量而不是视图。

#### 代码

```cpp
inline void check_inplace(const at::Tensor& tensor, bool requires_grad) {
  switch (can_mutate_inplace(tensor, requires_grad)) {
    case can_mutate_inplace_result::success: return;
    case can_mutate_inplace_result::non_default_backward_view:
      return handle_view_on_rebase(impl::get_view_autograd_meta(tensor));
    case can_mutate_inplace_result::view_of_leaf:
      TORCH_CHECK(false, "a view of a leaf Variable that requires grad "
                         "is being used in an in-place operation.");
    case can_mutate_inplace_result::is_leaf:
      TORCH_CHECK(false, "a leaf Variable that requires grad "
                         "is being used in an in-place operation.");
  }
}
```

非叶子张量不受这条限制。`x.clone().add_(1)` 完全合法，因为 clone 的输出是中间节点，autograd 知道怎么把梯度传回 x；实测反传后 `x.grad` 是全 1，与不做原地写时一致。

#### 本章结论

叶子和叶子的视图被禁止原地写，中间结果可以；报错文本里的「a view of」直接指出该 clone 谁。

### 版本计数器由 storage 共享

kicker: "05 · VERSION"

每个张量有一个 `_version`，原地操作后加一。关键在于它不属于张量而属于底层的自动微分元数据，视图和被视图张量共享同一个计数器：`x = torch.zeros(4); v = x[:2]; x.add_(1)` 之后 `x._version` 和 `v._version` 都变成 1。这正是版本机制能拦住「通过视图偷偷改值」的原因。

backward 时的比对是逐个 saved tensor 进行的。`y = x.exp(); y.add_(1); y.sum().backward()` 会失败，因为 `exp` 的反向需要它自己的输出值，错误文本精确到「which is output 0 of Exp, is at version 1; expected version 0 instead」。而 `y = x * 2; y.add_(1)` 不会失败——乘以常数的反向只需要那个常数，`y` 根本没被 save。同样是 `add_`，报不报错取决于上游算子保存了什么。

#### 本章结论

版本计数器随 storage 共享，backward 只对真正被 save 的张量做版本比对。

### no_grad 和 detach 各能豁免什么

kicker: "06 · ESCAPE"

`with torch.no_grad(): x.add_(1)` 可以合法修改 `requires_grad=True` 的叶子——这正是手写优化器更新参数的标准姿势。它豁免的是 `check_inplace` 的叶子裁决，但**不豁免版本计数**：实测执行后 `x._version` 仍然从 0 变成 1，`x.requires_grad` 和 `x.is_leaf` 也都不变。

`x.detach()` 更容易被误解。detach 返回的是一个共享同一 storage、同一版本计数器的新张量；`d = x.detach(); d.add_(1)` 之后 `x` 的数值确实被改了，`x._version` 也同步变成 1。也就是说 detach 只切断了图连接，没有切断内存和版本追踪。真的想要独立副本必须 `x.detach().clone()`，否则你只是把一个会被检测到的修改换了个入口。

#### 本章结论

`no_grad` 豁免叶子检查但保留版本计数，`detach` 只断图不断内存，独立副本必须显式 clone。

## 核心机制

- `has_internal_overlap` 返回三值枚举，只把「size>1 且 stride==0」判为 `Yes`，其余落 `TooHard` 并放行。
- `assert_no_overlap` 比较 storage 区间，错误文本以 input tensor 开头，与自重叠的文本不同。
- `check_inplace` 拒绝 `requires_grad` 的叶子及其视图，中间节点允许原地写。
- 版本计数器按 storage 共享，视图与 detach 结果同步递增。
- backward 只对被 save 的张量比对版本，因此同一个 `add_` 在不同上游算子后果不同。

## 常见误区

- 以为「没报错就说明没有别名」，忽略 `TooHard` 分支的放行语义。
- 把跨张量重叠的报错当成自重叠，去 clone 了错误的一侧。
- 认为 `detach()` 返回独立副本，于是原地修改污染了原张量。
- 认为 `no_grad` 会冻结版本计数，导致后续 backward 仍然报版本错。
- 看到 `y = x * 2; y.add_(1)` 能跑，就推断所有中间结果都能安全原地写。

## 实现变体

### out-of-place 重写

useWhen: "张量可能被 backward 需要，或代码要在训练与推理之间复用，需要可预测的语义。"
tradeoff: "永远安全、报错为零；代价是多一次分配与拷贝，显存峰值上升。"

### no_grad 包裹的原地更新

useWhen: "手写优化器、EMA、权重裁剪等确定不参与反向的参数更新。"
tradeoff: "零额外分配、语义清晰；必须自己保证该张量不在任何未完成的反向图里被 save。"

## 可运行示例

```python
import torch

try:
    torch.zeros(3).expand(2, 3).add_(1)
except RuntimeError as error:
    assert 'written-to tensor' in str(error)
else:
    raise AssertionError('零 stride 自重叠必须被拒绝')

sneaky = torch.zeros(4).as_strided((2, 3), (1, 1))
sneaky.add_(1)
assert torch.equal(sneaky, torch.tensor([[1., 2., 2.], [2., 2., 1.]]))

buffer = torch.arange(6.)
try:
    buffer[0:4].add_(buffer[2:6])
except RuntimeError as error:
    assert 'input tensor' in str(error)
else:
    raise AssertionError('左右值共享 storage 必须被拒绝')

leaf = torch.zeros(3, requires_grad=True)
try:
    leaf.add_(1)
except RuntimeError as error:
    assert 'leaf Variable' in str(error)
else:
    raise AssertionError('requires_grad 的叶子不可原地写')

with torch.no_grad():
    leaf.add_(1)
assert leaf._version == 1 and leaf.is_leaf and leaf.requires_grad

aliased = leaf.detach()
aliased.add_(1)
assert leaf._version == 2 and torch.equal(leaf.detach(), torch.full((3,), 2.))

saved = torch.randn(3, requires_grad=True)
out = saved.exp()
out.add_(1)
try:
    out.sum().backward()
except RuntimeError as error:
    assert 'version 1; expected version 0' in str(error)
else:
    raise AssertionError('被 save 的输出被改写后必须在 backward 报错')
```

## 搭积木复现

### 积木 1：实现 storage 区间模型

给每个张量记录 storage 指针、offset、sizes、strides，算出它覆盖的字节区间与可达地址集合。

### 积木 2：复刻零 stride 自重叠检测

按源码逻辑实现三值枚举：稠密连续返回 No，存在 size>1 且 stride==0 返回 Yes，其余返回 TooHard，并验证 `as_strided((2,3),(1,1))` 确实落到 TooHard。

### 积木 3：实现跨张量重叠判定

比较两个张量的 storage 与区间，区分 Full、Partial 与 No，让错误文本按「written-to」和「input」两种模板输出。

### 积木 4：加入叶子与视图裁决

为张量打上 `is_leaf`、`requires_grad`、`view_of` 三个标记，复现 `check_inplace` 的四路分支与两条不同错误文本。

### 积木 5：实现共享版本计数器

把计数器挂在 storage 而不是张量上，验证视图与 detach 结果会同步递增。

### 积木 6：实现 saved tensor 版本比对

让算子在 forward 时记录它保存的张量及当时版本号，backward 时比对并输出「is at version N; expected version M」。

## 自检

### 问题

`torch.zeros(3).expand(2, 3).add_(1)` 报错，而 `torch.zeros(4).as_strided((2, 3), (1, 1)).add_(1)` 却成功返回，两者都存在内存重叠，为什么结果不同？另外，`x.detach().add_(1)` 之后 `x` 的数值和 `x._version` 分别会怎样？

### 站内答案

结论：前者抛 RuntimeError，后者静默返回 `[[1., 2., 2.], [2., 2., 1.]]`；`x.detach().add_(1)` 会同时改掉 `x` 的数值并把 `x._version` 加一。机制：`has_internal_overlap` 不做通用别名分析，它先用 `is_non_overlapping_and_dense_or_false()` 放行稠密张量，再只检查一种模式——某维 size 大于 1 且 stride 等于 0；expand 正好命中这个模式，`as_strided((2,3),(1,1))` 的 stride 全是 1、不满足零 stride 条件且不稠密，于是落到 `TooHard` 分支，而 `assert_no_internal_overlap` 只在结果为 `Yes` 时抛错。至于 detach，它返回的张量与原张量共享同一块 storage 和同一个版本计数器，只是切断了 autograd 图连接。源码证据：`aten/src/ATen/MemoryOverlap.cpp`（v2.13.0 第 11-54 行）的三值枚举与两段循环，以及 `TORCH_CHECK(has_internal_overlap(t) != MemOverlap::Yes, ...)` 这条只针对 `Yes` 的断言。可运行验证：本课示例前两段分别断言了报错文本 `written-to tensor` 与静默结果 `[[1,2,2],[2,2,1]]`；detach 部分断言了 `leaf._version == 2` 且数值变成全 2。工程取舍：`TooHard` 的语义是「查不出来就放行」，这是为了避免通用别名分析的编译期与运行期开销，代价是把非常规 stride 的安全性交还给调用方；因此凡是自己用 `as_strided`、自定义 stride 或从外部指针包装出来的张量，都不应假设框架会替你拦住重叠写。适用边界是——`expand`、`broadcast_to` 这类常见路径可以依赖断言，手工构造的视图必须自行验证；需要独立所有权时写 `x.detach().clone()` 而不是 `x.detach()`。

## 更新日志

### 首次深度精写

at: "2026-08-01T10:52:00+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "WorkBuddy · Hy3"
summary: "基于 PyTorch v2.13.0 的 MemoryOverlap.cpp 与 VariableTypeUtils.h 精写原地写的三层门禁：零 stride 自重叠检测及其 TooHard 放行边界、storage 区间的跨张量断言、叶子与视图裁决、按 storage 共享的版本计数器，以及 no_grad 与 detach 的真实豁免范围。"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/17"
commit: "05e634c2dfe9ebd31d824f0c54db677301b765d9"
