---
id: "torch-01-06"
track: "torch"
title: "transpose、permute 与 movedim：只改维度解释的零拷贝重排"
depth: "deep"
exampleLanguage: "python"
readingMinutes: 25
sourceMinutes: 40
practiceMinutes: 55
reviewMinutes: 20
---

## 官方入口

title: "PyTorch 2.13 · Tensor Views / torch.permute"
url: "https://docs.pytorch.org/docs/stable/tensor_view.html#tensor-views"

官方将 transpose、permute、movedim 列为 view 操作：对普通 strided Tensor，它们重排维度解释而共享底层 storage；连续性与下游性能需要单独判断。

## 真实源码

repo: "pytorch/pytorch"
file: "aten/src/ATen/native/TensorShape.cpp"
symbol: "permute"
language: "cpp"
url: "https://github.com/pytorch/pytorch/blob/v2.13.0/aten/src/ATen/native/TensorShape.cpp#L1782-L1787"

### 逐段讲解

- Python 的 `x.permute(dims)` 进入 ATen native `permute`；稀疏 layout 有另一条实现，不能把本节的别名结论外推到所有 layout。
- `_permute_size_stride_estimation`先标准化负维度，检查排列是完整双射，再以相同排列取出旧 size 与旧 stride。
- `self.as_strided`保留 Storage 和 storage_offset，仅安装新的 size/stride，因此结果与输入共享字节。
- 真正的搬运只会在后来某个不接受该布局的算子、显式 `contiguous()`，或某个 copy API 出现；把 view 创建时间当成算子总成本会误判。

### 源码节选

```cpp
// PyTorch v2.13.0：普通 strided Tensor 的 permute 只生成新的 view 元数据。
Tensor permute(const Tensor& self, IntArrayRef dims) {
  // 此辅助函数验证 rank、负维度和“每个维度恰好一次”，并同步重排 size/stride。
  auto [new_sizes, new_strides, _] =
      _permute_size_stride_estimation(self, dims);

  // as_strided 复用 self.storage 与 storage_offset；这里没有 copy kernel。
  return self.as_strided(new_sizes, new_strides);
  // 普通 strided 路径只改元数据。
  // sparse layout 会转向专属实现。
  // Storage 与 offset 不在此处改写。
  // copy 只能由后续物化触发。
  // 输入 self 也保持不可变。
  // dispatcher 已在上层选择该 kernel。
}
```

## 导读

卷积代码常把 NCHW 改写成 NHWC，注意力代码又在 batch、head、sequence、feature 之间换轴。若每次换名字都复制整块激活，带宽会先于算力成为瓶颈。普通 strided Tensor 的 transpose、permute 与 movedim 给出的承诺很克制：它们换坐标轴的解释，底层字节仍由同一个 Storage 持有。

把连续 `(B,T,D)` 的 stride 写成 `(T×D,D,1)`。`permute(0,2,1)`得到 size `(B,D,T)`、stride `(T×D,1,D)`；新逻辑索引 `(b,d,t)`访问的仍是旧 `(b,t,d)`。因此值的轴语义变了，物理元素的地址集合没有变。这是零拷贝的精确含义，不是“结果看起来没变”。

`transpose(d0,d1)`是交换两个轴的窄接口，`permute`给出完整轴排列，`movedim(src,dst)`适合表达“把 channel 送到最后”这类位置意图。三者应按代码意图选，不应为了性能在它们之间猜测；普通 dense 输入上的别名事实相同，后续消费布局才决定性能。

## 分章正文

### 先区分轴标签与地址顺序

kicker: "01 · AXES"

shape 的第 1 维到底是 time 还是 feature，是模型语义；stride 的第 1 项每加一要跳过多少元素，是存储语义。permute 同时重排两张表，才能让新的轴标签仍取到旧坐标对应的值。只改 shape 会把语义悄悄改坏，`view`与`permute`绝不可互换。

对小张量应手算一格：base `(2,3,4)` 的 `(1,2,3)`地址为 `1×12+2×4+3=23`。`p=base.permute(0,2,1)`中同一个值位于 `(1,3,2)`，地址 `1×12+3×1+2×4=23`。这个等式是测试重排实现的最小证据。

#### 代码

```python
base = torch.arange(24).reshape(2, 3, 4)
p = base.permute(0, 2, 1)
assert p.shape == (2, 4, 3)
assert p.stride() == (12, 1, 4)
assert p[1, 3, 2] == base[1, 2, 3]
```

#### 本章结论

轴排列必须作用于 size 和 stride 两者；只检查输出 shape 不足以验证重排。

### 零拷贝如何被证实，又在哪里失效

kicker: "02 · ALIAS"

`data_ptr()`可能因为 slice 的 offset 不同而不同，判断同一块 Storage 应比较 `untyped_storage().data_ptr()`。修改 `p` 中一个不重叠元素后 base 对应位置改变，是第二份更直观的证据。两项都成立，才可称普通 strided 输入走了 view 路径。

这条结论有 layout 边界：官方 transpose 文档明确说 strided 输出共享 storage，sparse 输出不共享。量化、nested、subclass 与后端张量也可能走专属实现。库接口若承诺零拷贝，应限制并断言输入 layout，而不是只写“调用 permute”。

#### 本章结论

“函数名是 view”不是普适物理定律；应记录 layout、Storage identity 和版本。

### 为什么 movedim 比手写 permute 更不容易错

kicker: "03 · API"

`movedim(1,-1)`表达“把现有 channel 轴移到最后，其他轴相对顺序保留”。手写 `permute`需要自己推导完整排列，一旦 rank 从 4 增到 5，常把 batch 或 group 轴带错。movedim 接受多个 source/destination，但两组长度必须一致且各自没有重复维度。

transpose 适合矩阵最后两轴互换，`mT`在 batch 矩阵上也更语义化；permute 适合确实掌握完整 layout 的库代码。把 API 选择写成轴名转换表，再加 shape/stride 断言，比让读者从裸整数猜约定可靠。

#### 本章结论

选择表达意图最窄的重排 API，减少 rank 演进时的排列 bug。

### 零拷贝为何仍可能让模型变慢

kicker: "04 · PERFORMANCE"

p 默认不连续只说明按默认最后一轴顺序无法线性走址，不等于任意 kernel 都不能消费它。许多 ATen 算子接受 stride，TensorIterator 还会重排遍历；另一方面，某些矩阵、融合或自定义 CUDA kernel 的内层 stride=1 快路径会明显更快。

正确基准把一次 `permute`、可选 `contiguous` 的 copy，以及后续重复 kernel 分开计时。若只消费一次，复制常亏；若同一转置激活被多次消费，前置物化可能赢。GPU 计时必须同步，且以真实 shape/layout 而非全连续随机输入取样。

#### 本章结论

是否 materialize 是下游消费次数与 kernel 能力的决策，不能由 `is_contiguous()`单独决定。

### view 的梯度与原地写边界

kicker: "05 · AUTOGRAD"

permute 的 backward 是逆置换：若 forward 把 `(B,T,D)`改成 `(B,D,T)`，梯度再 permute 回去即可。这没有改变数学值，却要求 autograd 知道它是 view，才能在正确基 Tensor 上累积。

需要梯度的叶子和其 view 不能随意原地写。即使当前地址不重叠，保存的 forward 值与版本计数也可能被破坏。训练代码优先使用 out-of-place 更新；确需写入时先明确所有权，再用 anomaly detection 与反向测试证明。

#### 本章结论

共享 Storage 的高效与可变状态耦合在一起，autograd 是这份合同的守门人。

### 把多次换轴化成可证明的坐标变换

kicker: "06 · COMPOSITION"

连续调用两次 permute 时，第二个排列作用在第一次输出的轴位置上，不能把两组整数直接相加。可靠做法是把每个输出轴记录成原输入轴的标签，再按第二次排列重新取标签；得到复合排列后只执行一次 permute。其逆排列满足 `inverse[perm[i]]=i`，把输出送回逆排列后，shape、stride、逐元素值和 Storage identity 都应恢复。这组恒等式比观察一个对称 shape 更能抓住轴顺序错误。

工程接口应把裸整数排列封装成 `to_channels_last`、`bth_to_bht` 一类有输入输出约定的适配器，并在边界断言 rank 与关键轴长度。测试故意采用互不相等的维度和坐标编码值，覆盖负维度、重复维度、漏轴及逆变换；性能测试再确认合并重排没有提前 materialize。这样，模型结构变更时失败会停在布局边界，而不会等到广播或矩阵乘用一组形状合法、语义错位的数据继续运行。

#### 本章结论

排列是可复合、可求逆的坐标变换；用标签和恒等式验证，比从整数列表猜轴语义可靠。

## 核心机制

- transpose 交换两项 size/stride；permute 对全部轴做双射排列。
- movedim 将指定轴移动到目标位置，未指定轴保持相对次序。
- 普通 strided 输出通过 as_strided 共享 Storage，往往失去默认 contiguous。
- 下游 kernel 可以接受 stride，也可能触发或要求物化。

## 常见误区

- 用 view 代替 permute，只改 shape 而没有同步坐标含义。
- 把 `data_ptr`不同的 slice 误判为没有共享 Storage。
- 假定 sparse transpose 与 dense strided transpose 一样别名。
- 为每次 permute 无条件 contiguous，未测量复制是否回本。

## 实现变体

### 语义轴移动：movedim

useWhen: "只需把一个或几个已命名轴送到特定位置，rank 可能变化。"
tradeoff: "可读性高且少写排列；多轴 destination 仍需验证无重复。"

### 边界物化：permute().contiguous()

useWhen: "下游扩展明确要求默认连续，且同一布局会多次消费。"
tradeoff: "获得稳定线性布局，代价是一次完整分配和 copy；必须由 profile 支持。"

## 可运行示例

```python
import torch

base = torch.arange(24).reshape(2, 3, 4)
p = base.permute(0, 2, 1)
assert p.untyped_storage().data_ptr() == base.untyped_storage().data_ptr()
assert p.stride() == (12, 1, 4)
p[1, 3, 2] = -1
assert base[1, 2, 3] == -1

last = torch.movedim(base, 1, -1)
assert torch.equal(last, p)
assert not p.is_contiguous()
print({'shape': tuple(p.shape), 'stride': p.stride()})
```

## 搭积木复现

### 积木 1：写地址函数

实现 `offset=index·stride+storage_offset`，对连续 `(2,3,4)` 手算一格。

### 积木 2：实现排列校验

检查 dims 长度、范围和唯一性，拒绝重复或漏轴排列。

### 积木 3：同步置换元数据

对 size 和 stride 应用同一排列，验证新旧对应坐标地址相等。

### 积木 4：加入 movedim

由 source/destination 推导完整排列，断言未移动轴相对顺序不变。

### 积木 5：验证别名与写传播

比较 storage 指针并修改唯一地址，检查 base 中对应元素。

### 积木 6：测量物化边界

比较直接消费与 contiguous 后重复消费，分开报告 copy 与 kernel 时间。

## 自检

### 问题

给定连续 `x.shape=(2,3,4)`、`x.stride()=(12,4,1)`，`y=x.permute(2,0,1)`的 shape、stride 与 `y[3,1,2]`的 storage offset 分别是什么？为什么不能写 `x.view(4,2,3)`替代？

### 站内答案

shape 是 `(4,2,3)`，stride 是 `(1,12,4)`，offset 为 `3×1+1×12+2×4=23`，对应 x[1,2,3]。view 只在给定 size/stride 可合并拆分的连续子空间内改变形状；它不会把轴标签对应的 stride 一起置换，`x.view(4,2,3)`按线性顺序重新分组，取到的值排列不同。上线排查还应打印 shape、stride、offset、layout 和 Storage 指针：分别证明轴约定、置换、slice 起点、实现类别与是否复制。若证据变化先检查 sparse、nested 或 subclass 输入，不能因数值相等跳过布局回归。还要验证逆变换：令 q=y.permute(1,2,0) 后，应有 q 的轴标签恢复为原顺序、q 与 x 的每个对应索引值相等，且两者仍引用同一 Storage。若某段代码通过 `reshape` 恰巧得出相同 shape，故意填入可区分坐标如 `100*b+10*t+d`，即可暴露错误的线性重分组。性能验收最后以真实下游 kernel 为准：记录调用前后是否连续、是否产生 copy、一次消费和多次消费的端到端时间。生产事故中最常见的错误是把外部模型的轴约定当成本站约定：例如输入已经是 BHSD 却再次 movedim，数值维度仍可广播而语义完全错位。防线是把每一轴写成命名注释，入口断言 rank 和各轴长度，测试采用非对称 shape，并在输出中保留 layout report。
