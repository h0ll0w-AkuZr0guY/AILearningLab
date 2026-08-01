---
id: "torch-02-09"
track: "torch"
title: "einsum：下标方程降解为 diagonal、permute 与 bmm"
depth: "deep"
visualIndex: "../visuals/torch-02-09.md"
exampleLanguage: "python"
readingMinutes: 25
sourceMinutes: 30
practiceMinutes: 50
reviewMinutes: 15
---

## 官方入口

title: "PyTorch 2.13 · torch.einsum"
url: "https://docs.pytorch.org/docs/stable/generated/torch.einsum.html#torch.einsum"

官方定义：`einsum` 按 Einstein 求和约定计算下标方程；同一操作数内重复的下标取对角线，跨操作数重复且不出现在输出中的下标被收缩求和，省略号代表其余被广播的批量维；省略 `->` 时输出下标是「恰好出现一次的字母按字典序排列」。

## 真实源码

repo: "pytorch/pytorch"
file: "aten/src/ATen/native/Linear.cpp"
symbol: "sumproduct_pair"
language: "cpp"
url: "https://github.com/pytorch/pytorch/blob/v2.13.0/aten/src/ATen/native/Linear.cpp#L166-L273"

### 逐段讲解

- 函数的前提是两个操作数已经被 unsqueeze 到相同 rank，所以它只需要处理「每一维属于哪一类」，不再处理形状对齐。
- `sum_dims_` 为空时直接退化成 `at::mul`，说明外积和逐元素乘在 einsum 里走的是同一条捷径。
- 主循环把每一维分进四类：要收缩的维、同时出现在左右和输出的 `lro`（批量维）、只在左侧的 `lo`、只在右侧的 `ro`；单边出现的收缩维会被就地 `sum` 掉，不进 bmm。
- 源码注释直接写出了流水线：permute inputs → reshape inputs → batch matrix mul → reshape(view) output → permute output，这正是「einsum 最终降解为 bmm」的字面证据。
- `swap_lo_ro` 是一处内存序优化：当右操作数的输出维全部排在左操作数之前时，交换两者可以让 bmm 直接产出正确的内存顺序，省掉一次 permute。
- 三张 permutation 表 `lpermutation / rpermutation / opermutation` 分别负责把左、右操作数摆成 `(lro, lo, sum)` 与 `(lro, sum, ro)`，再把 bmm 结果摆回方程要求的维序。

### 源码节选

```cpp
static Tensor sumproduct_pair(const Tensor& left_, const Tensor& right_,
                              IntArrayRef sum_dims_, bool keepdim) {
  TORCH_CHECK(left_.dim() == right_.dim(), "number of dimensions must match");
  if (sum_dims_.empty()) return at::mul(left_, right_);   // 无收缩维即逐元素乘
  int64_t dim = left_.dim();
  auto sum_dims = at::dim_list_to_bitset(sum_dims_, dim);
  std::vector<int64_t> lro, lo, ro;                       // 批量维 / 仅左 / 仅右
  Tensor left = left_, right = right_;
  for (const auto i : c10::irange(dim)) {
    auto sl = TORCH_GUARD_OR_TRUE(left.sym_size(i).sym_ne(1));
    auto sr = TORCH_GUARD_OR_TRUE(right.sym_size(i).sym_ne(1));
    if (sum_dims[i]) {
      if (sl && sr) {                                     // 双边收缩维进 bmm 的 k
        TORCH_SYM_CHECK(left.sym_size(i).sym_eq(right.sym_size(i)),
                        "non-broadcast dimensions must match");
        sum_size *= left.sym_size(i);
      } else if (sl) { left  = left.sum(i, true);         // 单边收缩维就地求和
      } else if (sr) { right = right.sum(i, true); }
    } else if (sl && sr) { lro.push_back(i);              // 同时在左右和输出：批量维
    } else if (sl)       { lo.push_back(i);
    } else               { ro.push_back(i); }
  }
  // the pipeline is permute inputs -> reshape inputs -> batch matrix mul
  //                 -> reshape(view) output -> permute output
  bool swap_lo_ro = !lo.empty() && !ro.empty() && ro.back() < lo.front();
  if (swap_lo_ro) { std::swap(left, right); std::swap(lo, ro); }
  std::vector<int64_t> lpermutation(lro);                 // 左：lro, lo, sum
  lpermutation.insert(lpermutation.end(), lo.begin(), lo.end());
  lpermutation.insert(lpermutation.end(), sum_dims_.begin(), sum_dims_.end());
  std::vector<int64_t> rpermutation(lro);                 // 右：lro, sum, ro
  rpermutation.insert(rpermutation.end(), sum_dims_.begin(), sum_dims_.end());
  rpermutation.insert(rpermutation.end(), ro.begin(), ro.end());
  // ... reshape 成三维后调用 bmm，再用 opermutation 还原维序
}
```

## 导读

`einsum` 常被当成「一个能算任意张量收缩的黑盒」，于是方程写对了就不再追问它做了什么。但它并不是一个新算子：解析完方程之后，PyTorch 会把它拆成一串你已经认识的操作——`diagonal` 处理同一操作数内的重复下标，`permute` 把维序摆好，`reshape` 压成三维，`bmm` 做真正的乘加，最后再 `permute` 回去。源码注释里那行 pipeline 说明写得非常直白。

理解这条降解链有三个实际好处。第一，能预测性能：`torch.einsum('ij,jk->ik', A, B)` 和 `A @ B` 数值完全相等，因为它们最终调用同一个 bmm，einsum 只多了方程解析的常数开销。第二，能预测形状：省略 `->` 时输出是「只出现一次的下标按字典序排」，所以 `torch.einsum('ji', A)` 对 `(2,3)` 的 A 返回 `(3,2)`——它是转置，很多人第一次会读反。第三，能读懂报错：四类常见错误分别来自方程解析、下标计数、尺寸广播和输出校验，报错文本里都带了具体下标字母。

本课按「解析 → 单操作数化简 → 成对收缩 → 顺序选择」的顺序推进。前两步在 `torch/functional.py` 与 `at::native::einsum` 里完成，第三步落到 `sumproduct_pair`，第四步则涉及是否启用 `opt_einsum`。需要强调的是：当前环境里 `torch.backends.opt_einsum.is_available()` 返回 False，说明没装 opt_einsum 包，多操作数收缩会退化成从左到右的顺序执行——这对三个以上操作数的方程可能有数量级的性能差异。

## 分章正文

### 方程语法与隐式输出规则

kicker: "01 · EQUATION"

一个方程由逗号分隔的输入下标串和可选的 `->输出串` 组成。每个字母绑定一个维度长度，同名下标在所有出现处必须长度一致或可广播。写了 `->` 就是显式输出，没写就走隐式规则：**统计每个字母出现的总次数，恰好出现一次的按字典序排列成输出**。

这条隐式规则是最常见的困惑来源。`torch.einsum('ji', A)` 里 `j` 和 `i` 各出现一次，字典序排出 `i, j`，而方程说 A 的第 0 维是 `j`、第 1 维是 `i`，所以输出把 A 的第 1 维放前面——结果是转置，对 `(2,3)` 的 A 返回 `(3,2)`。同理 `torch.einsum('ij,jk', A, B)` 里 `j` 出现两次被收缩，`i` 和 `k` 各一次，隐式输出 `ik`，恰好就是矩阵乘。库代码里建议永远写显式 `->`，把意图固定下来。

#### 本章结论

隐式输出 = 出现一次的下标按字典序；`'ji'` 是转置不是恒等，显式 `->` 能消除全部歧义。

### 同一操作数内的重复下标取对角

kicker: "02 · DIAGONAL"

`ii` 这种写法把同一个操作数的两个维绑到同一个字母上，语义是取对角线。对 `torch.arange(9.).reshape(3,3)`，`torch.einsum('ii->i', S)` 返回 `[0., 4., 8.]`，正是 `S.diagonal()`；而 `torch.einsum('ii', S)` 因为 `i` 出现两次不进隐式输出，得到标量 `12.0`，也就是 trace。

实现上这一步发生在成对收缩之前：`at::native::einsum` 先对每个操作数做单独处理，遇到重复下标就调 `diagonal` 把两维折成一维，之后所有下标在该操作数内就都唯一了。理解这个前后顺序很重要——它意味着对角化是**每个操作数各自完成**的，不会跨操作数配对。

反过来，输出串里出现重复下标是非法的。`torch.einsum('ij->ii', A)` 报错「einsum(): output subscript i appears more than once in the output」，因为「把结果写成对角矩阵」不是收缩语义能表达的操作，需要 `torch.diag_embed`。

#### 本章结论

操作数内重复下标先降解为 `diagonal`，输出串重复下标直接非法。

### 省略号代表被广播的批量维

kicker: "03 · ELLIPSIS"

`...` 表示「这里还有若干维，按 broadcast 规则对齐」。`torch.einsum('...ij,...jk->...ik', X, Y)` 对 `(2,3,4)` 与 `(2,4,5)` 的输入，结果与 `torch.bmm(X, Y)` 逐元素相等；把 batch 维改成 `(2,1,3)` 与 `(1,4,3)` 再算 `'...i,...i->...'`，输出形状是 `(2,4)`，说明省略号覆盖的维走的是标准广播而不是要求相等。

省略号让同一个方程能同时服务于有 batch 和无 batch 的输入，这是它在通用库里最有价值的地方。但它也削弱了可读性：读方程的人无法从 `...` 推断实际 rank。折中做法是在函数签名和注释里写清期望的 batch 结构，或者在明确知道 rank 时直接写 `bij,bjk->bik`——实测两种写法结果一致。

#### 本章结论

省略号是可广播的批量维占位符，配合具名 batch 下标能在通用性与可读性之间取舍。

### sumproduct_pair 如何把收缩变成 bmm

kicker: "04 · PAIR"

两个操作数对齐 rank 后，每一维只可能是四种角色之一：被收缩且左右都非 1（进 bmm 的 k 维）、被收缩但只在一侧非 1（直接 `sum` 掉，根本不进矩阵乘）、同时在左右和输出中（批量维 `lro`）、只在一侧且在输出中（`lo` 或 `ro`）。分类完成后，左操作数被 permute 成 `(lro, lo, sum)` 再压成三维，右操作数被 permute 成 `(lro, sum, ro)` 再压成三维，一次 `bmm` 就得到 `(lro, lo, ro)`。

这解释了 einsum 的性能特征。真正的算力消耗在那一次 bmm 上，剩下的 permute 与 reshape 只是元数据操作或至多一次 contiguous 拷贝。所以 `torch.einsum('ij,jk->ik', A, B)` 与 `A @ B` 数值完全相等、性能同阶；einsum 的额外成本是方程字符串解析，在循环里高频调用小张量时才会显现。

源码里的 `swap_lo_ro` 值得留意：当 `ro` 的最后一个维序号小于 `lo` 的第一个维序号时，交换左右操作数可以让 bmm 直接产出正确的内存顺序，省掉输出侧的一次 permute。这类优化说明「einsum 只是语法糖」的说法并不完整——它会根据方程结构做一些手写代码容易漏掉的布局决策。

#### 本章结论

一次成对收缩 = 四类维度分类 + 两次 permute/reshape + 一次 bmm + 一次还原 permute。

### 多操作数的收缩顺序决定复杂度

kicker: "05 · ORDER"

超过两个操作数时，`einsum` 需要决定两两收缩的顺序。顺序不同，中间张量的大小可能差几个数量级——这是经典的矩阵链乘问题。PyTorch 的做法是：如果安装了 `opt_einsum` 且 `torch.backends.opt_einsum.enabled` 为真，就把路径规划交给它；否则退化成从左到右依次收缩。

当前环境实测 `torch.backends.opt_einsum.is_available()` 返回 False、`enabled` 为 False、`strategy` 为 None，也就是说 `torch.einsum('ij,jk,kl->il', A, B, C)` 会先算 `ij,jk` 再和 `kl` 收缩，即便先算 `jk,kl` 更省。对二操作数方程这完全无影响；对三个以上操作数、且维度大小悬殊的方程，这可能是最大的一处性能陷阱。

判断方法很简单：方程里操作数超过两个时，要么装上 opt_einsum，要么自己把方程拆成显式的两两 einsum 并按估算的中间尺寸排序。不要假设框架一定替你选了最优路径。

#### 本章结论

三个以上操作数时收缩顺序由 opt_einsum 决定；未安装时退化为从左到右，需要手动拆分。

### 四类报错分别来自哪一步

kicker: "06 · ERRORS"

第一类是下标数与维度数不匹配：`torch.einsum('i j->i', torch.arange(3.))` 报「the number of subscripts in the equation (2) does not match the number of dimensions (1) for operand 0 and no ellipsis was given」——注意空格也被当成下标字符解析失败，而不是被忽略。

第二类是尺寸不一致：`torch.einsum('ij,jk->ik', A, torch.zeros(5,4))` 报「subscript j has size 5 for operand 1 which does not broadcast with previously seen size 3」，文本里同时给出了冲突字母、操作数序号和两个尺寸，可以直接定位。

第三类是输出下标重复，第四类是输出下标不存在于任何输入：`torch.einsum('ij->ijk', A)` 报「output subscript k does not appear in the equation for any input operand」。四类文本都以 `einsum():` 开头并带具体字母，排错时先读字母再回方程，比逐个打印 shape 快得多。

#### 本章结论

四类错误分属解析、计数、广播与输出校验；报错文本里的下标字母就是定位坐标。

## 核心机制

- 隐式输出是「恰好出现一次的下标按字典序排列」，`'ji'` 因此等价于转置。
- 操作数内重复下标先降解为 `diagonal`，输出串重复下标非法。
- `...` 覆盖的批量维按标准 broadcast 对齐，可与显式 batch 下标互换。
- `sumproduct_pair` 把每一维分成收缩维、`lro`、`lo`、`ro` 四类，再用一次 `bmm` 完成收缩。
- 多操作数收缩顺序由 opt_einsum 决定，未安装时从左到右。

## 常见误区

- 把隐式输出当成「保持原维序」，于是 `'ji'` 的转置效果出乎意料。
- 认为 `einsum` 比 `@` 慢很多，实际两者最终都落到同一次 bmm。
- 试图用 `->ii` 构造对角矩阵，而这需要 `diag_embed`。
- 三个以上操作数时假设框架已经选好最优收缩路径。
- 用 `...` 掩盖 rank 不确定性，导致调用方无法从签名推断形状。

## 实现变体

### 字符串方程

useWhen: "方程固定、下标语义清晰，需要代码自解释，例如注意力打分或双线性变换。"
tradeoff: "可读性最好、可直接搜索；字母数量有限，动态生成方程时字符串拼接容易出错。"

### sublist 下标列表

useWhen: "维度编号由程序动态计算，或方程需要在运行时按 rank 组装。"
tradeoff: "可编程、不受字母表限制；可读性差，实测 `torch.einsum(A, [0,1], B, [1,2], [0,2])` 与 `'ij,jk->ik'` 结果完全相等。"

## 可运行示例

```python
import torch

A = torch.arange(6.).reshape(2, 3)
B = torch.arange(12.).reshape(3, 4)
assert torch.equal(torch.einsum('ij,jk->ik', A, B), A @ B)
assert torch.equal(torch.einsum('ij,jk', A, B), A @ B)
assert torch.einsum('ji', A).shape == (3, 2)

S = torch.arange(9.).reshape(3, 3)
assert torch.equal(torch.einsum('ii->i', S), S.diagonal())
assert torch.einsum('ii', S).item() == 12.0

X, Y = torch.randn(2, 3, 4), torch.randn(2, 4, 5)
assert torch.allclose(torch.einsum('...ij,...jk->...ik', X, Y), torch.bmm(X, Y))
assert torch.allclose(torch.einsum('bij,bjk->bik', X, Y), torch.bmm(X, Y))
assert torch.einsum(
    '...i,...i->...', torch.randn(2, 1, 3), torch.randn(1, 4, 3)
).shape == (2, 4)

assert torch.equal(torch.einsum(A, [0, 1], B, [1, 2], [0, 2]), A @ B)

try:
    torch.einsum('ij->ii', A)
except RuntimeError as error:
    assert 'output subscript i appears more than once' in str(error)
else:
    raise AssertionError('输出下标不得重复')

try:
    torch.einsum('ij,jk->ik', A, torch.zeros(5, 4))
except RuntimeError as error:
    assert 'does not broadcast with previously seen size 3' in str(error)
else:
    raise AssertionError('同名下标尺寸冲突必须报错')
```

## 搭积木复现

### 积木 1：解析方程

把字符串拆成输入下标串列表与可选输出串，展开省略号，校验下标数与操作数 rank 一致。

### 积木 2：实现隐式输出规则

统计每个字母的总出现次数，取恰好一次的按字典序排成输出串，用 `'ji'` 和 `'ij,jk'` 验证。

### 积木 3：单操作数对角化

对每个操作数内部重复的下标调用 `diagonal` 折维，折完后保证该操作数内下标唯一。

### 积木 4：实现四类维度分类

按 `sumproduct_pair` 的逻辑把对齐后的维分成收缩维、lro、lo、ro，并把单边收缩维就地 sum 掉。

### 积木 5：降解到 bmm

按 `(lro, lo, sum)` 与 `(lro, sum, ro)` 摆好维序、压成三维、调用 bmm，再用逆置换还原方程要求的维序。

### 积木 6：加入收缩顺序选择

对三个以上操作数枚举两两收缩顺序，用中间张量元素数估算代价并选最小，与从左到右的默认顺序对比耗时。

## 自检

### 问题

对形状 `(2,3)` 的 A，`torch.einsum('ji', A)` 的输出形状是什么、为什么？另外，`torch.einsum('ij,jk->ik', A, B)` 与 `A @ B` 在数值和性能上分别是什么关系，einsum 到底多做了哪些工作？

### 站内答案

结论：`torch.einsum('ji', A)` 返回形状 `(3, 2)`，是转置；`torch.einsum('ij,jk->ik', A, B)` 与 `A @ B` 数值完全相等（`torch.equal` 为真），性能同阶，einsum 只多出方程解析和维度分类的常数开销。机制：省略 `->` 时走隐式输出规则——统计每个下标字母的总出现次数，取恰好出现一次的按字典序排列。`'ji'` 里 `j` 和 `i` 各出现一次，字典序得到输出串 `ij`；而方程声明 A 的第 0 维叫 `j`、第 1 维叫 `i`，所以输出的第 0 维取 A 的 `i` 维（长度 3）、第 1 维取 A 的 `j` 维（长度 2），结果就是 `(3, 2)` 的转置。至于矩阵乘，解析完成后 `at::native::einsum` 先对每个操作数做对角化，再把成对收缩交给 `sumproduct_pair`：它把每一维分成收缩维、`lro`、`lo`、`ro` 四类，把左操作数 permute 成 `(lro, lo, sum)`、右操作数 permute 成 `(lro, sum, ro)`，各自 reshape 成三维后调用一次 `bmm`，最后用逆置换还原维序。源码证据：`aten/src/ATen/native/Linear.cpp` 的 `sumproduct_pair`（v2.13.0 第 166-273 行），其中第 207 行的注释原文写着 permute inputs → reshape inputs → batch matrix mul → reshape(view) output → permute output。可运行验证：本课示例中 `torch.equal(torch.einsum('ij,jk->ik', A, B), A @ B)` 与 `torch.einsum('ji', A).shape == (3, 2)` 两条断言直接覆盖这两个结论，`torch.allclose(torch.einsum('...ij,...jk->...ik', X, Y), torch.bmm(X, Y))` 则覆盖了带批量维的情形。工程取舍：einsum 的价值是让下标语义写进代码、让同一段代码兼容有无 batch 的输入，代价是解析开销和可读性对读者的要求；两个操作数时它与手写 `@` 等价，可以放心使用，但三个以上操作数时收缩顺序由 opt_einsum 决定，而当前环境 `torch.backends.opt_einsum.is_available()` 为 False，会退化成从左到右。适用边界是——热路径上的小张量高频调用建议改写成显式算子，多操作数方程要么安装 opt_einsum 要么手动拆成两两收缩，库接口里则应始终写显式 `->` 以免隐式字典序规则引入静默的维序错误。

## 更新日志

### 首次深度精写

at: "2026-08-01T11:04:00+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "OpenAI Codex · GPT-5.6 Terra"
summary: "基于 PyTorch v2.13.0 的 Linear.cpp sumproduct_pair 精写 einsum 降解链：隐式输出的字典序规则、操作数内重复下标的 diagonal 化简、省略号批量维广播、四类维度分类到 bmm 的完整流水线、opt_einsum 缺席时的从左到右退化，以及四类报错的定位方法。"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/17"
commit: "05e634c2dfe9ebd31d824f0c54db677301b765d9"
