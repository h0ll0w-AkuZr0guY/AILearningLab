---
id: "torch-02-04"
track: "torch"
title: "ellipsis None"
depth: "deep"
visualIndex: "../visuals/torch-02-04.md"
exampleLanguage: "python"
readingMinutes: 25
sourceMinutes: 25
practiceMinutes: 45
reviewMinutes: 15
---

## 官方入口

title: "PyTorch 2.13 · Tensor Views / indexing"
url: "https://docs.pytorch.org/docs/stable/tensor_view.html#tensor-views"

`...`与`None`属于 basic indexing；前者补足未指定维度，后者插入长度为 1 的维，因此普通 strided tensor 上可保持 view 语义。

## 真实源码

repo: "pytorch/pytorch"
file: "aten/src/ATen/TensorIndexing.h"
symbol: "handleDimInMultiDimIndexing / get_item"
language: "cpp"
url: "https://github.com/pytorch/pytorch/blob/v2.13.0/aten/src/ATen/TensorIndexing.h#L452-L710"

### 逐段讲解

- 源码先计算指定维数量；ellipsis 通过总 rank 减去已指定维得到需要跳过的维数。
- `None`直接调用 unsqueeze，在当前位置插入 size=1 维并推进当前位置。
- 单独 `...`仍建立 alias，保证索引表达式返回独立 tensor wrapper，同时不复制 Storage。
- 若同一表达式另有 Long/Bool tensor，基础几何完成后才交给高级分派；应分层看语义。

### 源码节选

```cpp
// v2.13.0：None 和 ellipsis 不读取元素，只改索引坐标系。
if (index.is_ellipsis()) {
  auto ellipsis_ndims = original_tensor.dim() - *specified_dims_ptr;
  (*dim_ptr) += ellipsis_ndims; // ... 吸收尚未显式消费的原维。
  return prev_dim_result;
} else if (index.is_none()) {
  Tensor result = prev_dim_result.unsqueeze(*dim_ptr);
  (*dim_ptr)++; // None 插入 size=1 维，后续 token 右移。
  return result;
}
// 单独 x[...] 也返回 alias，而非同一个 Python 对象。
if (index.is_ellipsis()) {
  return at::alias(self);
}
// 这维持 view/对象 identity 两层语义的分离。
// 混入 tensor index 时再转由 dispatch_index 处理。
// 所以 ... 与 None 不能用“什么都没做”概括。
```

## 导读

`...`和`None`很短，却是深度学习代码中控制 rank 的两个精确工具。前者意思是“这里填满足以覆盖其余未指定维度的冒号”，后者意思是“在这里插入一个长度为一的轴”。它们改的是坐标系，不是数值。

`x[..., -1]`在 rank 改变时仍选最后一维，适合库接口；`x[:, None, :]`常把 `(B,D)`变成 `(B,1,D)`，为 broadcast 或矩阵运算显式准备 axis。两者输出常借用 storage，因而也继承 alias、stride 和原地写风险。

本课把它们合并，因为它们都不消费一个具体数据坐标，却会移动后续索引的维位置。分别背两个语法糖很容易在 `x[..., None, idx]`这类组合中错数维。


## 分章正文

### ellipsis 是可计算的维度占位

kicker: "01 · ELLIPSIS"

一个索引表达式最多放一个 `...`。它不总是“最后几个维”：框架数出 integer、slice、None 以外实际消费的维，再让 ellipsis 补齐剩余维。`x[...,0]`因此等价于按当前 rank 写足够多个 `:`后再选最后维。

它特别适合 rank 多态代码，但不替代输入 rank 验证。若模型接口把最后一维约定为 channel，却误传 NHWC/NCHW，ellipsis 会忠实执行错误合同；仍要在边界标注每个轴的语义。

#### 本章结论

ellipsis 让位置相对末端稳定，不能让业务 axis 语义自动正确。

### None 就是一次 unsqueeze

kicker: "02 · NONE"

`x[None]`在最前插入维，`x[:,None,:]`在中间插入维。新维 size 为 1，地址不会因此移动；输出的该项 stride 只需满足可表示几何，调用者不应依赖其具体数值，而应依赖 shape 和共享事实。

需要减少维时使用整数 select 或 `squeeze`，不要把 None 当 reshape 万能药。插轴意图最好写成 `unsqueeze(dim)`用于库内部，方括号 None 则在与其他索引混用时更紧凑。

#### 本章结论

None 的语义是增一条可广播的坐标轴，不是复制或填充数据。

### 先画 token 消费表再写组合

kicker: "03 · COMPOSE"

以 `(B,H,T,D)`为例，`x[...,None,:]`得到 `(B,H,T,1,D)`；`...`消费到最后一个显式 `:`之前的维，None 不消费输入维却增加输出维。先写输入轴、每个 token 消费数和输出轴，能阻止手算偏一。

混入整数时 rank 会再下降，混入高级 index 时结果轴位置还可能重排。复杂表达式拆成具名变量并在每步断言 shape，通常比一行索引更易 code review 和 profile。

#### 本章结论

组合索引的可靠语言是“消费维与产生维”，不是肉眼数冒号。

### view 不等于同一个对象

kicker: "04 · ALIAS"

`x[...]`常与 x 共享 storage，却不是 Python 的同一对象。这很重要：元数据 wrapper 可独立传递给 autograd 和后续操作，而底层字节仍借用。测试宜断言 storage identity 与写传播，避免把 `is`当别名判断。

插入 size=1 维后可参与 broadcast；若下游 expand，零 stride 与多对一地址又引入写禁区。只读计算可保留 view，需要修改就 clone 或让计算产生独立结果。

#### 本章结论

对象、元数据与 Storage 要分层理解，None/ellipsis 最容易暴露这三层差异。

### 把 rank 变换变成显式 API

kicker: "05 · CONTRACT"

函数若接受 `(...,D)`并在末端插轴，应在 docstring 声明 prefix 维自由、D 固定；返回 `(...,1,D)`。这比说“支持任意 tensor”可测试得多。

回归样例使用 rank 2、rank 4、空 batch 与非连续输入，检查 title 轴、shape、值、Storage 和错误信息。对用户输入限制单个 ellipsis、合法 integer 与最大 rank，避免把 Python 便利语法变成不透明协议。

#### 本章结论

rank 多态要有明确的省略号边界，才能既通用又可审计。

### 从语法便利升级为轴约定

kicker: "06 · AXIS API"

在 attention、图像和多模态代码中，`None`往往不是为了让表达式短，而是把向量声明为沿某条轴共享的参数。比如 `(D)`的 scale 写成 `scale[None,None,:]`，读者应立即得到目标 `(B,T,D)`；若改用 `scale[...,None]`，含义变成把 D 置于倒数第二维，后续乘法可能仍能 broadcast 却对应错误轴。代码评审应要求注释输入输出轴名，或封装为 `feature_bias_for(tokens)`等具名函数。

测试也要刻意避免“所有维长度都是 2”。以 B=2、H=3、T=5、D=7 构造编码值，依次验证 `x[..., -1]`、`x[:,None]`、`x[...,None,:]`和包含 integer 的组合。对每一次变换，比较明确写出的等价索引，并保留非连续输入验证 Storage 与逐元素值。遇到 rank 未知的库接口，应规定最小 rank、尾部语义和异常行为；ellipsis 负责泛化前缀维，不能替调用者猜出输入究竟是 channels-first 还是 channels-last。

#### 本章结论

ellipsis/None 的正确使用依赖命名轴合同；语法在 rank 多态下保持位置，业务语义仍需由接口保证。

### 阅读复杂索引时的展开法

kicker: "07 · REVIEW"

遇到 `x[..., None, ids]`，先写 x 的命名 shape，将 ellipsis 展成确切数目的 slice，再执行 None 的 unsqueeze 并更新轴表，最后单独分析 ids 是整数还是 tensor。若 ids 是 tensor，它开始高级索引，结果不再能仅靠 view 规则判断。这个展开法能在 code review 中明确哪些变换不复制、哪里开始 gather、输出 rank 为何变化；稳定步骤可封装为小函数，避免每个调用点重算。

#### 本章结论

展开 token、更新轴表、再判断高级索引，是复杂方括号表达式最可靠的阅读顺序。

### 用轴表驱动重构

kicker: "08 · PRACTICE"

为一个同时支持单图和批图的函数写出输入 `(...,N,D)`与输出 `(...,N,1,D)`合同，再分别传入 `(N,D)`、`(B,N,D)`和 `(B,H,N,D)`。每次先以显式 slice/unsqueeze 写出参考实现，再和 ellipsis/None 的紧凑实现比较 shape、值、Storage 与错误。随后加入整数 index 和 LongTensor index，观察哪一步仍是 view、哪一步开始 gather。学习目标不是记住符号，而是能从 token 消费表预测结果。

#### 本章结论

将紧凑索引与显式参考实现并列测试，是验证 rank 多态代码的稳固方法。对外暴露的函数还应把 axis 约定写进类型、文档与异常文本，使错误输入在真正访问数据前就被拒绝。稳定接口还应明确规定空维、标量和不支持的 layout 如何报错。

## 核心机制

- ellipsis 吸收剩余未指定输入维。
- None 以 unsqueeze 插入 size=1 输出维。
- 两者通常不复制 Storage。
- 它们与高级 index 混用时，基础处理先完成。

## 常见误区

- 把 ... 当作固定数量的冒号。
- 把 None 当作新增数据。
- 依赖 view 的 Python object identity。
- 在组合索引中靠目测猜 rank。

## 实现变体

### 显式 unsqueeze

useWhen: "需要突出插轴并便于逐步调试。"
tradeoff: "更冗长；rank 演算在方法调用中清晰。"

### 索引内 None/ellipsis

useWhen: "插轴与选择同一步表达，或需要 rank 多态末维访问。"
tradeoff: "紧凑；复杂组合必须配 shape 注释与测试。"

## 可运行示例

```python
import torch
x = torch.arange(24).reshape(2, 3, 4)
y = x[..., None, :]
assert y.shape == (2, 3, 1, 4)
assert y.untyped_storage().data_ptr() == x.untyped_storage().data_ptr()
assert torch.equal(x[..., -1], x[:, :, -1])
```

## 搭积木复现

### 积木 1：列消费表

标出每个 token 消费、插入或保留的维。

### 积木 2：实现 ellipsis 展开

由 rank 减指定维数生成冒号数量。

### 积木 3：实现 unsqueeze

在给定位置插入 size=1 和合法 stride。

### 积木 4：组合测试

覆盖末端、开头、中间与整数选择。

### 积木 5：验证借用

检查 Storage 与非连续输入的写传播。

## 自检

### 问题

解释 `x[...,None,:]`为何不等于复制一列数据，以及如何在 rank 未知时证明它把新维插在倒数第二个位置。

### 站内答案

None 进入源码后调用 unsqueeze，仅改 size/stride 元数据并返回 alias；它没有读取或写入元素，所以 Storage identity 保持。ellipsis 先吸收所有未被其后 `:`显式消费的输入维，随后 None 在当前位置插入 size=1，最后 `:`保留原末维。因此无论 x 是 `(B,D)`还是 `(B,H,T,D)`，输出分别为 `(B,1,D)`和`(B,H,T,1,D)`，新维都在原末维之前。验证使用多个非对称 rank 的输入，断言 shape、坐标值与 storage；需要可写的独立结果时 clone，不能因为插入了新维就假定不 alias。
