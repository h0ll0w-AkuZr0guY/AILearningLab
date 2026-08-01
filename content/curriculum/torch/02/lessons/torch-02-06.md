---
id: "torch-02-06"
track: "torch"
title: "index_put_ 与索引赋值：重复下标、accumulate 与内存重叠"
depth: "deep"
visualIndex: "../visuals/torch-02-06.md"
exampleLanguage: "python"
readingMinutes: 25
sourceMinutes: 30
practiceMinutes: 55
reviewMinutes: 15
---

## 官方入口

title: "PyTorch 2.13 · torch.Tensor.index_put_"
url: "https://docs.pytorch.org/docs/stable/generated/torch.Tensor.index_put_.html#torch.Tensor.index_put_"

官方定义：`index_put_(indices, values, accumulate=False)` 等价于 `tensor[indices] = values`；文档明确写出 `accumulate=True` 时索引里的重复下标会被累加，而 `accumulate=False` 时重复下标的行为是未定义的（undefined behavior），并要求 `values` 能广播到索引选出的形状。

## 真实源码

repo: "pytorch/pytorch"
file: "aten/src/ATen/native/TensorAdvancedIndexing.cpp"
symbol: "_index_put_impl_"
language: "cpp"
url: "https://github.com/pytorch/pytorch/blob/v2.13.0/aten/src/ATen/native/TensorAdvancedIndexing.cpp#L962-L1025"

### 逐段讲解

- 入口先检查索引个数不得超过 `self.dim()`，这条 `TORCH_CHECK_INDEX` 决定了「索引太多」是索引类错误而不是形状类错误。
- 紧接着用 `has_internal_overlap(self)` 判断左值是否自重叠（典型来源是 `expand` 产生的零 stride 视图），命中时只发 `TORCH_WARN` 而不报错，所以这是一条容易被忽略的弃用告警。
- `accumulate=False` 且索引形态满足条件时会被改写成 `masked_fill_`，说明「布尔 mask 赋标量」根本没有走通用写回路径，性能与报错文本都不同。
- `assert_no_overlap(self, value)` 与对每个 index 的同名断言才是真正的硬门禁：左值与右值或索引共享 storage 时直接抛 RuntimeError。
- 最后按设备分流：CUDA/XPU 在 `accumulate` 或开启确定性算法且 `value_.numel() > 1` 时走 `index_put_with_sort_stub` 的排序累加路径，其余情况走 `TensorIterator` 驱动的 `index_put_stub`。

### 源码节选

```cpp
Tensor& _index_put_impl_(Tensor& self,
    const torch::List<std::optional<Tensor>>& indices,
    const Tensor& value, const bool accumulate, const bool unsafe) {
  TORCH_CHECK_INDEX(indices.size() <= (size_t)self.dim(),
      "too many indices for tensor of dimension ", self.dim());
  if (at::has_internal_overlap(self) == MemOverlap::Yes) {
    TORCH_WARN("Use of index_put_ on expanded tensors is deprecated. "
        "Please clone() the tensor before performing this operation.");
  }
  if (!accumulate) {                       // 布尔 mask 赋标量被改写成 masked_fill_
    auto masked_fill_dispatch = canDispatchToMaskedFill(self, indices, value);
    if (std::get<0>(masked_fill_dispatch)) {
      return self.masked_fill_(std::get<1>(masked_fill_dispatch), value.item());
    }
  }
  auto value_ = value;
  at::assert_no_overlap(self, value);      // 左值与右值不得共享 storage
  for (const std::optional<Tensor>& index : indices) {
    if (index.has_value()) at::assert_no_overlap(self, *index);
  }
  if ((self.device().type() == DeviceType::CUDA || ...) &&
      (accumulate || (globalContext().deterministicAlgorithms()
                      && value_.numel() > 1))) {
    index_put_with_sort_stub(self.device().type(), self, indices,
                             value_, accumulate, unsafe);  // 排序后归约
    return self;
  }
  auto info = make_info(self, indices);    // 通用路径：TensorIterator 逐元素写
  auto iter = make_index_put_iterator(info, value_);
  index_put_stub(iter.device_type(), iter, info.indexed_sizes,
                 info.indexed_strides, accumulate);
  return self;
}
```

## 导读

读路径和写路径不是同一件事。`y = x[idx]` 会把选中的元素物化成新张量，形状由索引广播决定；`x[idx] = v` 却要把值送回原 storage，于是多出三个读路径没有的问题：同一个地址被多个下标命中怎么办、右值和左值共用内存怎么办、并行归约的顺序是否可复现。这三个问题都在 `_index_put_impl_` 的前三十行里被显式处理。

最容易踩的是重复下标。`accumulate=False` 时官方文档写的是「未定义行为」，不是「最后一个生效」。在当前 CPU 实现上它确实表现为后写覆盖前写，例如向 `torch.zeros(5)` 用下标 `[1, 1, 3]` 写入 `[10, 20, 30]` 会得到 `[0, 20, 0, 30, 0]`；但这是实现细节，换到 CUDA 的并行 kernel 上没有任何顺序保证。把「散射求和」写成默认赋值，是 embedding 反传、点云体素化、稀疏累加这类代码里最常见的静默错误。

本课把写回路径拆成语义层、门禁层和执行层三段来看。语义层决定重复下标是覆盖还是累加；门禁层用 `has_internal_overlap` 和 `assert_no_overlap` 拦住别名写；执行层根据设备和确定性开关在 `TensorIterator` 与排序 kernel 之间选择。三层各自会产生不同形态的告警或异常，先分清是哪一层报的，才知道该 clone 谁。

## 分章正文

### 方括号赋值只是 index_put_ 的语法糖

kicker: "01 · SUGAR"

`x[idx] = v` 在 Python 层被翻译成 `x.index_put_((idx,), v, accumulate=False)`，两者走的是同一个 ATen 实现。这解释了一个常见困惑：为什么方括号赋值也会抛出「refer to a single memory location」这种听起来很底层的错误——因为它本来就落在同一个 `_index_put_impl_` 上。

区别只在 Python 侧的索引归一化。方括号里可以混入 slice、`None`、`Ellipsis` 和布尔张量，这些会先被展开成一串 `std::optional<Tensor>`；`index_put_` 则要求调用方自己把索引组织成元组。写库代码时直接调用 `index_put_` 反而更清楚，因为它把 `accumulate` 这个关键参数暴露在签名里，而方括号语法永远只能表达 `accumulate=False`。

#### 本章结论

方括号赋值与 `index_put_` 是同一条路径，前者永远等价于 `accumulate=False`。

### 重复下标不是「后写覆盖」而是未定义

kicker: "02 · DUPLICATE"

索引张量里出现同一个位置两次时，`accumulate=False` 的结果没有语义保证。在 CPU 上实测 `torch.zeros(5).index_put_((torch.tensor([1, 1, 3]),), torch.tensor([10., 20., 30.]))` 得到 `[0, 20, 0, 30, 0]`，看起来像「后写赢」；但这只是串行迭代顺序的副产品。同一段代码在 GPU 上由成千个线程并发写同一地址，胜者取决于调度。

危险在于这类 bug 不会报错。训练脚本照常收敛，只是梯度少了一部分，或者体素网格里少统计了几个点。判定方法很直接：只要索引可能重复，就必须显式选择语义——要覆盖就先去重，要累加就打开 `accumulate=True`，不要依赖观察到的行为。

#### 本章结论

重复下标下 `accumulate=False` 的输出不可依赖，必须由调用方消除歧义。

### accumulate=True 把覆盖换成归约

kicker: "03 · ACCUMULATE"

同一组下标改成 `accumulate=True` 后结果变成 `[0, 30, 0, 30, 0]`：位置 1 收到 `10 + 20`，位置 3 收到 `30`。这才是散射求和的正确表达。它对应的数学操作是 `out[idx[k]] += val[k]`，而不是赋值。

`accumulate=True` 还改变执行路径。CPU 上仍走 `index_put_stub`，但在 CUDA 上会强制进入 `index_put_with_sort_stub`：先按目标地址排序，再对相同地址的连续段做段内归约。排序的代价换来的是原子写冲突的消除，因此 `accumulate=True` 在 GPU 上通常比手写 `atomicAdd` 更稳定，但也会因为排序而多一次显存往返。

#### 本章结论

`accumulate=True` 定义了归约语义，并在 GPU 上切换到排序归约实现。

### 两种内存重叠：一个告警，一个报错

kicker: "04 · OVERLAP"

第一种是左值自重叠。`torch.zeros(3).expand(2, 3)` 这种零 stride 视图里，多个逻辑坐标映射到同一字节，`has_internal_overlap` 返回 `Yes`，实现只发弃用告警就继续执行。结果是「写进去了但不知道写了哪一份」，属于最难排查的一类：日志里只有一条 UserWarning。

第二种是左值与右值或索引重叠。`assert_no_overlap` 会检查它们是否指向同一 storage，命中时抛出 RuntimeError，文本是「some elements of the input tensor and the written-to tensor refer to a single memory location」，并直接建议 `clone()`。典型触发场景是 `x[idx] = x[other_idx]` 这种自赋值——右侧如果不是物化结果而是视图，就会撞上这道门。

#### 本章结论

自重叠只告警，跨张量重叠直接报错；两者的修法都是先 `clone()` 出独立所有权。

### 确定性开关如何改变实现选择

kicker: "05 · DETERMINISM"

源码里那个复合条件值得逐项读：设备是 CUDA/XPU/PrivateUse1，并且满足 `accumulate` 为真，或者「开启了 `torch.use_deterministic_algorithms(True)` 且 `value_.numel() > 1`」。也就是说即便 `accumulate=False`，只要用户要求确定性且写入的不是单个标量，实现也会切到排序路径，用确定的顺序消除并发写的不确定性。

这条分支解释了两个现象：开启确定性后同一段索引赋值代码变慢；以及某些模型只有在确定性模式下才能复现出一模一样的权重。反过来，如果你在 CPU 上验证过结果、到 GPU 上却对不上，第一个要查的就是是否命中了重复下标而没有开确定性。

#### 本章结论

确定性开关会把非累加写也推向排序路径，用性能换可复现的写入顺序。

### 写回路径的反向是 gather

kicker: "06 · AUTOGRAD"

把 `accumulate=True` 的写回接进自动微分，梯度形态很直观：`out[idx[k]] += val[k]` 对 `val[k]` 的偏导是 1，所以 `val` 的梯度就是从 `out.grad` 里按同一组下标 gather 出来的值。实测对 `torch.zeros(4, requires_grad=True)` 的克隆做累加写入后反传，`value` 的梯度是全 1 张量。

真正需要小心的是左值本身。`index_put_` 是原地操作，如果左值是需要梯度的叶子张量会直接被 autograd 拒绝；常见写法是先 `x.clone()` 再写，让 clone 结果成为非叶子中间节点。这条限制不属于索引语义，而属于下一课要讲的原地约束体系，两者在报错时经常同时出现，需要按错误文本区分是 ATen 的重叠断言还是 autograd 的叶子检查。

#### 本章结论

累加写的反向是按索引 gather，而左值的可写性由 autograd 的原地规则单独裁决。

## 核心机制

- `x[idx] = v` 与 `x.index_put_((idx,), v, False)` 是同一条 ATen 路径。
- `accumulate=False` 遇重复下标是未定义行为，`accumulate=True` 定义为按地址求和。
- `has_internal_overlap(self)` 命中只发弃用告警，`assert_no_overlap` 命中直接抛错。
- CUDA 在累加或确定性模式下切换到 `index_put_with_sort_stub` 排序归约。
- 累加写对 value 的反向等价于按同一组索引做 gather。

## 常见误区

- 把散射求和写成 `x[idx] = v` 并依赖「后写覆盖」的观察结果。
- 忽略 expanded 张量上的 UserWarning，以为写入生效在唯一位置。
- 用 `x[a] = x[b]` 做原地搬运，未先 `clone()` 右值。
- 认为开启确定性只影响 kernel 选择而不影响索引赋值。
- 把 autograd 的叶子报错误判成 ATen 的内存重叠报错。

## 实现变体

### accumulate=True 的通用散射累加

useWhen: "索引可能重复，需要把所有贡献求和，例如 embedding 反传或直方图统计。"
tradeoff: "语义明确、GPU 上走排序归约更稳定；代价是多一次排序与显存往返。"

### index_add_ / scatter_add_ 的专用形式

useWhen: "累加只沿单一维度展开，索引是一维 LongTensor，形状合同固定。"
tradeoff: "签名更窄、意图更清晰、通常更快；无法表达多维联合索引的任意组合。"

## 可运行示例

```python
import torch

base = torch.zeros(5)
overwrite = base.clone().index_put_(
    (torch.tensor([1, 1, 3]),), torch.tensor([10., 20., 30.]), accumulate=False
)
assert torch.equal(overwrite, torch.tensor([0., 20., 0., 30., 0.]))

accumulated = base.clone().index_put_(
    (torch.tensor([1, 1, 3]),), torch.tensor([10., 20., 30.]), accumulate=True
)
assert torch.equal(accumulated, torch.tensor([0., 30., 0., 30., 0.]))

sugar = base.clone()
sugar[torch.tensor([1, 1, 3])] = torch.tensor([10., 20., 30.])
assert torch.equal(sugar, overwrite)

shared = torch.arange(6.)
try:
    shared.index_put_((torch.tensor([0, 1]),), shared[2:4], accumulate=False)
except RuntimeError as error:
    assert 'single memory location' in str(error)
else:
    raise AssertionError('左值与右值共享 storage 必须被拒绝')

leaf = torch.zeros(4, requires_grad=True)
work = leaf.clone()
value = torch.ones(3, requires_grad=True)
work.index_put_((torch.tensor([0, 0, 2]),), value, accumulate=True)
work.sum().backward()
assert torch.equal(value.grad, torch.ones(3))
```

## 搭积木复现

### 积木 1：把索引展平成目标地址

将索引元组按广播规则对齐，为每个逻辑写入点算出线性 offset，输出一张 `(k,) -> address` 的表。

### 积木 2：实现覆盖写并暴露顺序依赖

按表顺序逐项赋值，再把遍历顺序反过来跑一次，观察重复地址下两次结果不同，这就是「未定义」的可见形态。

### 积木 3：实现 accumulate 归约

改为 `buffer[address] += value`，验证同一地址的多次贡献被求和，且结果与遍历顺序无关。

### 积木 4：加入重叠门禁

在写入前比较左值、右值与索引的 storage 指针和区间；自重叠只记录告警，跨张量重叠抛错并提示 `clone()`。

### 积木 5：加入排序路径与确定性开关

先按地址排序再做段内归约，对比与逐元素累加的结果一致性，并测量排序带来的额外开销。

### 积木 6：补上反向

对累加写实现 backward，把上游梯度按同一张地址表 gather 回 value，用数值梯度校验。

## 自检

### 问题

向 `torch.zeros(5)` 用下标 `[1, 1, 3]` 写入 `[10., 20., 30.]`，`accumulate=False` 与 `accumulate=True` 分别得到什么？为什么前者的结果不能写进单元测试的断言？另外，`x[a] = x[b]` 什么时候会抛「single memory location」，什么时候不会？

### 站内答案

结论：`accumulate=False` 在当前 CPU 实现上得到 `[0., 20., 0., 30., 0.]`，`accumulate=True` 得到 `[0., 30., 0., 30., 0.]`。机制：写回路径把每个下标映射到一个目标地址，重复下标意味着多个写入点落在同一地址；`accumulate=True` 定义为对该地址求和，而 `accumulate=False` 没有定义胜出规则，官方文档明确称之为未定义行为。源码证据是 `aten/src/ATen/native/TensorAdvancedIndexing.cpp` 的 `_index_put_impl_`（v2.13.0 第 962-1025 行），其中 CUDA 分支在 `accumulate` 为真时才强制走 `index_put_with_sort_stub` 排序归约，非累加路径直接交给 `index_put_stub` 的逐元素迭代，顺序由 kernel 调度决定。可运行验证：把本课示例中的两次 `index_put_` 都跑一遍，再把索引改成 `[3, 1, 1]` 重跑，会看到 `accumulate=True` 的结果不变而 `accumulate=False` 的结果随顺序改变。工程取舍：断言只能写在有定义的那一侧，也就是 `accumulate=True` 的求和结果，或先用 `torch.unique` 去重后再断言覆盖写；把观察到的「后写赢」固化进测试，等于把一个实现细节升格成合同，换设备就会红。至于 `x[a] = x[b]`，`assert_no_overlap` 比较的是左值与右值是否指向同一块 storage：当 `x[b]` 是高级索引产生的物化副本时它有独立 storage，不会报错；当右值是 slice、`expand` 或 `view` 这类共享 storage 的视图时就会命中断言。适用边界是——只要右值可能是视图，就先 `.clone()`，这条代价固定且远小于调试一次静默错写。

## 更新日志

### 首次深度精写

at: "2026-08-01T10:45:00+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "OpenAI Codex · GPT-5.6 Terra"
summary: "基于 PyTorch v2.13.0 的 _index_put_impl_ 精写索引写回路径：重复下标的未定义语义、accumulate 归约、内部自重叠告警与跨张量重叠断言、CUDA 排序路径与确定性开关，并补齐可运行示例与视觉索引。"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/17"
commit: "05e634c2dfe9ebd31d824f0c54db677301b765d9"
