---
id: "torch-02-02"
track: "torch"
title: "advanced indexing"
depth: "deep"
visualIndex: "../visuals/torch-02-02.md"
exampleLanguage: "python"
readingMinutes: 25
sourceMinutes: 30
practiceMinutes: 55
reviewMinutes: 15
---

## 官方入口

title: "PyTorch 2.13 · Tensor Views / advanced indexing"
url: "https://docs.pytorch.org/docs/stable/tensor_view.html#tensor-views"

官方说明读取时 basic indexing 返回 view，advanced indexing 返回 copy；无论 basic 或 advanced，赋值都是对原 tensor 的原地操作。

## 真实源码

repo: "pytorch/pytorch"
file: "aten/src/ATen/native/TensorAdvancedIndexing.cpp"
symbol: "index / index_put_"
language: "cpp"
url: "https://github.com/pytorch/pytorch/blob/v2.13.0/aten/src/ATen/native/TensorAdvancedIndexing.cpp#L1-L27"

### 逐段讲解

- 高级索引的输入不是一串普通 slice，而是 Long/Bool tensor 列表；它们先被对齐为同一个迭代 shape。
- 每一个输出位置读取一组运行时坐标，因此地址不是固定 stride 公式，结果必须 materialize 为独立 tensor。
- 不相邻的 tensor index 会触发维度重排以统一共同迭代维；这正是 `x[[0,1],:, [2,3]]`难以靠直觉读懂的原因。
- `index_put_`是 scatter 写路径。重复 index 时 overwrite 的结果不应被当成确定的归约，需显式选择 accumulate/scatter_add 合同。

### 源码节选

```cpp
// v2.13.0：高级索引把 tensor indices 作为一组共同迭代的坐标表。
// index(self, indices) 与 index_put_(self, indices, value) 是两条公开算子路径。
// Byte/Bool mask 会先展开为 long 索引（逻辑上等价于 nonzero）。
// 所有 index tensors 先 broadcast，再作为同一个迭代域逐元素取坐标。
// result[i,j] = self[row[i,j], col[i,j]]，而非两个独立的 slice。
Tensor _unsafe_index(const Tensor& self,
    const torch::List<std::optional<Tensor>>& indices) {
  for (const auto i : c10::irange(indices.size())) {
    auto index = indices.get(i);
    if (index.has_value()) {
      auto dtype = index->scalar_type();
      TORCH_CHECK(dtype == kLong || dtype == kInt,
          "_unsafe_index found unexpected index type ", dtype);
    }
  }
  return at::index(self, indices); // unsafe 仍复用正式 kernel；省的是边界检查。
}
```

## 导读

`x[[0,2]]`和`x[0:3:2]`都挑两行，底层却完全不同。slice 的地址可由一个 stride 表示；列表中的每个元素都可能跳到任意行，框架只能将选择到的元素 gather 到新输出。这就是“高级索引读取是 copy”的物理理由。

多个索引 tensor 不是逐个嵌套循环，而是先 broadcast、后共同迭代。若 rows shape `(2,1)`、cols shape `(1,3)`，`x[rows,cols]`结果 shape `(2,3)`，每个格子是一对 `(row,col)`。想要笛卡尔积时要显式制造这两个带 singleton 的索引，而不是期待两个 `(n,)` 自动交叉。

本课把 LongTensor/list 索引和读取/赋值分在同一专题，因为它们共用索引规格却不共用所有权。读取建立新 buffer；`x[idx]=value`直接写回 x。把两者混为“索引总会 copy”会产生极危险的训练数据污染。


## 分章正文

### 为何高级读取不能是普通 view

kicker: "01 · GATHER"

view 只能用有限的 size、stride、offset 表示“每一维走固定步长”。`[0,2,1]`要求地址序列先向前、再跳、再回退，除非保存完整索引表，否则没有一条 stride 能表达。高级读取因此分配输出，并允许输出连续。

验证时比较 `untyped_storage().data_ptr()`并修改 result：base 不应改变。不要用 `_base is None`当公开依据，也不要只测连续 base；所有权结论要在文档指定的普通 tensor 上用 storage 与写传播双证据确认。

#### 本章结论

运行时坐标表打破仿射地址，gather copy 是语义所需，不是偶然优化缺失。

### 索引 tensor 先 broadcast 再共同迭代

kicker: "02 · SHAPE"

设 `rows=[[0],[2]]`、`cols=[[1,3,4]]`。它们 broadcast 为 `(2,3)`，输出的 `(i,j)`读取 `x[rows[i,0], cols[0,j]]`。这是一张坐标网格，不是“先按 rows 切一次，再按 cols 切一次”。

若两个一维索引同为 `(2,)`，`x[rows, cols]`执行配对选择并输出 `(2,)`；许多 bug 就来自作者想要 2×2 网格却得到两对对角点。写断言前先画索引 tensor 的 shape，比根据结果 shape 反推安全。

#### 本章结论

高级索引的输出 shape 由索引 broadcast 域和未索引维共同决定。

### basic 与 advanced 混用的维度重排

kicker: "03 · MIXED"

`x[rows, :, cols]`包含两个不相邻 tensor index。为把所有高级坐标作为一组处理，内部可能把相应维移到前面，再应用统一迭代；结果的高级维位置不应靠“从左往右删维”猜测。

可靠做法是用很小的坐标编码 tensor，例如值写成 `100*i+10*j+k`，并将每个输出位置的预期坐标列成表。形状恰好相等的随机 tensor 会掩盖轴顺序错误，尤其在 batch 与 head 尺寸相同的模型中。

#### 本章结论

混合索引的难点在维度语义，不在语法；用坐标编码测试。

### 为什么高级赋值仍写回原对象

kicker: "04 · ASSIGN"

读取 `y=x[idx]`先得到 copy；表达式 `x[idx]=v`不会先把 copy 写回，而是进入 `index_put_`/scatter 路径，目标仍是 x。两行写法只差等号，所有权语义却相反。

重复 index 是重要边界。`x[[1,1]]=tensor([3,4])`的非 accumulate overwrite 顺序不能当作并行归约合同；需要求和用 `index_add_`或`scatter_add_`，需要确定性则审计设备、算法和重复坐标策略。

#### 本章结论

高级读取是 gather，赋值是 scatter；先区分数据流向再讨论性能。

### 把索引设计成可测的工程合同

kicker: "05 · COST"

频繁 gather 会产生临时 buffer、打散访存并增加峰值内存。若访问模式固定且密集，重排/分块数据可能更合适；若索引稀疏且一次性，gather 简洁且语义准确。profile 要分别记录 index 准备、gather、后续 kernel 与写回。

接口可接受“位置 tensor”但必须规定 dtype、device、rank、范围、是否允许重复和输出顺序。服务输入不能直接信任外部索引：先校验长度与边界，再限制最大输出元素，避免一份被广播的索引网格放大为意外的大分配。

#### 本章结论

高级索引是一个小型数据访问计划；把 shape 与重复规则写成接口，而不是藏在一行 Python。

### 用访问计划回答性能与正确性追问

kicker: "06 · INTERVIEW"

面试中若被问到“列表索引为什么慢”，不要只回答会复制。先指出输入索引需要被准备到正确 dtype/device，多个 index 需要 broadcast，kernel 对每个输出位置读取一组可能不连续的地址，并把结果写入新 buffer；随后若把结果再写回，还会是一次独立 scatter。连续 slice 只改元数据，而随机 gather 的访存局部性、临时输出和重复坐标规则都不同。这样回答既区分接口合同，也给出了可用 profiler 验证的成本分解。

设计可复现实验时，分别测顺序 LongTensor、随机 LongTensor、相邻和不相邻的混合 index，并固定输出 numel，避免把“选更多元素”误称为 kernel 变慢。对 GPU 计时需同步；对结果检查既要验证值，也要验证 storage 不同和 base 未被读取操作修改。赋值路径另写测试：无重复时比较目标位置，重复时明确选择 last-write、累加或拒绝策略。生产接口还应限制 index 的最大元素数、范围和来源，避免恶意的 `(N,1)`与`(1,M)`广播造成 N×M 输出。

#### 本章结论

高级索引的评估单位是完整访问计划：索引准备、broadcast、gather/scatter、内存和重复规则缺一不可。

### 选择更合适的算子边界

kicker: "07 · BOUNDARY"

当 index 表示单一维提取且每个 batch 有一条位置时，gather 或 take_along_dim 比通用方括号更能表达轴与输出形状；固定范围时 narrow 或 slice 保留 view；稀疏更新时 scatter 系列能显式写出 reduce 规则。选择专用算子能让调用者、编译器和审查者一眼看出访问模式。仍要以相同的 index dtype、范围、重复和 storage 测试验证语义。

#### 本章结论

把访问模式交给最窄的算子，减少高级索引隐含的形状与写入歧义。

## 核心机制

- Long/Int index tensor 先广播为共同迭代域。
- 读取按每个位置 gather，输出通常拥有独立 Storage。
- 混合不相邻 index 可能先重排维度。
- 赋值走 index_put_/scatter，目标仍是原 tensor。

## 常见误区

- 把两个 `(n,)` index 误当 n×n 笛卡尔积。
- 把 `x[idx]`的 copy 语义套到 `x[idx]=v`。
- 忽略重复索引的 overwrite/归约差异。
- 以随机对称 shape 测试轴顺序。

## 实现变体

### 配对 gather

useWhen: "每个样本有一组对应坐标，如 token 位置或候选动作。"
tradeoff: "表达直接；结果数量随 index broadcast 域增长。"

### 网格 gather

useWhen: "确实需要 rows×cols 的子矩阵或多维坐标网格。"
tradeoff: "使用 singleton 显式广播；容易产生大临时输出，需设预算。"

## 可运行示例

```python
import torch
x = torch.arange(20).reshape(4, 5)
rows = torch.tensor([[0], [2]])
cols = torch.tensor([[1, 3, 4]])
y = x[rows, cols]
assert y.tolist() == [[1, 3, 4], [11, 13, 14]]
assert y.untyped_storage().data_ptr() != x.untyped_storage().data_ptr()
x[torch.tensor([0, 2]), 0] = torch.tensor([-1, -2])
assert x[:, 0].tolist() == [-1, 5, -2, 15]
```

## 搭积木复现

### 积木 1：写坐标表

以 Python list 保存每个输出位置的坐标对。

### 积木 2：broadcast 索引

实现一维配对与二维网格两例。

### 积木 3：实现 gather

按坐标表读取到新 list，验证不 alias base。

### 积木 4：实现 scatter

将 value 写回原 buffer，并拒绝未声明的重复坐标。

### 积木 5：加入预算

在分配前计算广播后输出 numel，拒绝过大请求。

## 自检

### 问题

给出 `x.shape=(4,5)`、`rows.shape=(2,1)`、`cols.shape=(1,3)`时高级读取的 shape 与所有权；为什么高级赋值不能据此认为先复制后写回？

### 站内答案

rows 与 cols 先右对齐 broadcast 成 `(2,3)`，所以读取输出为 `(2,3)`，每个位置按一对运行时坐标 gather，结果拥有新的 Storage，修改 y 不影响 x。赋值语句在 Python 语义层直接调用 setitem，C++ 路径会先处理基础 slice、再把 tensor indices 交给 `index_put_`，它对原 x 执行 scatter；不会把读取用的临时 y 写回。因此测试必须分别验证读的 storage 不同、写后 x 的指定位置变化、重复 index 的策略以及 index 的 dtype/device。若需求是可加的重复更新，选择 index_add_/scatter_add_ 并为确定性、排序和数值误差设计测试。
