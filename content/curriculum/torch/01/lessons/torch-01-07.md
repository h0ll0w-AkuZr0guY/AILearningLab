---
id: "torch-01-07"
track: "torch"
title: "slice、select 与 narrow：storage_offset 和步长切片"
depth: "deep"
exampleLanguage: "python"
readingMinutes: 25
sourceMinutes: 40
practiceMinutes: 55
reviewMinutes: 25
---

## 官方入口

title: "PyTorch 2.13 · torch.Tensor.narrow"
url: "https://docs.pytorch.org/docs/stable/generated/torch.Tensor.narrow.html#torch.Tensor.narrow"

narrow 在指定维度保留一个连续区间；Tensor Views 文档把 basic indexing、narrow 与 select 列为 view，并说明高级索引是 copy。

## 真实源码

repo: "pytorch/pytorch"
file: "aten/src/ATen/native/TensorShape.cpp"
symbol: "narrow"
language: "cpp"
url: "https://github.com/pytorch/pytorch/blob/v2.13.0/aten/src/ATen/native/TensorShape.cpp#L1621-L1642"

### 逐段讲解

- 入口先拒绝标量和负 length，防止“空 view”被误当成越界内存。
- 负 start 以当前维 size 标准化，随后检查 start+length 不超过边界。
- narrow 复用通用 slice，step 固定为 1；size 改为 length，stride 保持。
- slice 的实现最终依据旧 stride 增加 storage_offset，因而返回的普通张量与输入共享 Storage。

### 源码节选

```cpp
Tensor narrow(const Tensor& self, int64_t dim, int64_t start, int64_t length) {
  TORCH_CHECK(self.dim() > 0, "narrow() cannot be applied to a 0-dim tensor.");
  TORCH_CHECK(length >= 0, "narrow(): length must be non-negative.");
  auto cur_size = self.size(dim);
  TORCH_CHECK_INDEX(-cur_size <= start && start <= cur_size, "start out of range");
  if (start < 0) {
    start = start + cur_size; // 将负起点标准化到 [0, size]
  }
  TORCH_CHECK(start <= cur_size - length, "start + length exceeds dimension size");
  // slice 的 step=1 保留 stride，只移动该维起点造成的 storage_offset。
  return at::slice(self, dim, start, start + length, 1);
  // slice 处理 offset、size 与 stride 的更新。
  // step=1 保持当前维 stride 不变。
  // 输出继续借用 self 的 Storage。
  // dtype、device 与 dispatch key 保持不变。
  // 调试时报告旧 size、旧 stride 与新 offset。
  // 长期持有的 window 还需审计被钉住的 Storage。
}
```

## 导读

切片的关键并非“取出一些元素”，而是把一个逻辑坐标域缩小后仍嵌入原来的地址公式。`x[:, 1:4:2]`保留第 0 维 stride，把第 1 维 stride 乘以 2，并把第一个合法位置写进 storage_offset；因此它通常无 copy，却很容易产生洞与非连续布局。

`select(dim,index)`删去一个维度，`narrow(dim,start,length)`保留连续区间，Python basic slice 支持 step。它们都适合把不规则布局继续交给支持 stride 的算子。索引列表、LongTensor、布尔 mask 属于 advanced indexing，官方明确把那条读取路径定义为 copy，切勿以写法相似推断别名。

这门课把 select/narrow/basic slice 合并，因为三者使用同一套 size、stride、offset 合同；把它们分开只会重复边界检查和地址推导。把 advanced indexing 留给下一单元，能让“何时 copy”成为一个可验证的分界。

## 分章正文

### slice 改了什么，保留了什么

kicker: "01 · OFFSET"

对连续 `(3,5)`输入，`x[:,1:5:2]`的 size 从 `(3,5)`变 `(3,2)`，stride 从 `(5,1)`变 `(5,2)`，offset 从 0 变 1。新 `(2,1)`访问 `1+2×5+1×2=13`，正是旧 `(2,3)`。

只看 `numel=6`会漏掉物理跨度：地址是 1,3,6,8,11,13，中间有洞。后续 `view(-1)`不一定成立，缓存一个小步长 slice 也仍可能保留大 base Storage。

#### 本章结论

offset 是起点，stride 是每步跨度，二者共同定义 slice 的物理窗口。

### select 为什么会降维

kicker: "02 · DIMENSION"

`select(1,2)`把第 1 维坐标固定成 2，因此那一项从坐标域中消失；offset 增加 `2×stride[1]`，其余 size/stride 删除对应条目。它仍能 alias base，但输出 rank 少一维，拼接和广播时要显式 `unsqueeze`。

narrow 不固定坐标，只缩小该维范围，所以 rank 保持。它在数据窗口、KV cache 截断与分块训练中常比手写 slice 更易审计：length 明确、负起点规范化、越界错误由 ATen 报告。

#### 本章结论

select 是固定一个坐标，narrow 是缩小一个坐标域；两者别名证据相同，shape 合同不同。

### 空切片、负索引与 step 的边界

kicker: "03 · BOUNDARY"

Python slice 的负索引、None 和负 step 有自己的规范化规则；PyTorch strided Tensor 不支持以负 stride 构造普通 view，因此反向切片不能照搬 NumPy 直觉。需要倒序时选择 `flip`，并承认它会分配。

空 slice 的合法性与 narrow 不同：前者可产生 size 0 的 view，后者 length 必须非负且 start/length 仍受检查。服务接口若接受用户 index，应在 Python 侧先定义一致的半开区间合同，而不是依赖不同算子杂糅的异常文本。

#### 本章结论

切片 API 的共同数学是半开区间；语言层的负步长能力却不能假定跨后端一致。

### basic 与 advanced indexing 的真正边界

kicker: "04 · COPY LINE"

`x[1:3, :]`、整数、ellipsis、None 组成的 basic indexing 通常形成 view；`x[[0,2]]`或 `x[mask]`要按任意索引收集元素，输出地址无法由一组固定 size/stride 表达，读取结果是 copy。赋值即使使用 advanced index 仍是对原 x 的 in-place scatter，这又是另一条语义。

写性能测试时至少分别断言 Storage identity、写传播和峰值分配。只比较数值相等会把 copy 看成 view；只比较 `_base`也会被复合 view、subclass 和版本实现误导。

#### 本章结论

“索引”不是一种操作；能否由仿射地址公式表达，才是 view/copy 的底层分界。

### 小窗口为何可能钉住大批数据

kicker: "05 · LIFETIME"

一个 1KB 的 `batch[:, :1]`可以继续引用数百 MB batch 的 Storage。Python 变量删除 base 只减少一个引用，window 的 Storage 引用仍存活；这在缓存日志特征、队列和 dataset 预取中很隐蔽。

若窗口要跨请求、跨线程或长期保存，显式 `clone()`让其拥有独立缓冲区，并把复制预算写进接口。若仅在当前算子链内消费，保留 view 才能节省带宽。所有权选择应由生命周期而非“看起来小”决定。

#### 本章结论

逻辑大小和被保留的物理 Storage 大小必须分别观测。

### 把索引输入变成可审计的协议

kicker: "06 · API CONTRACT"

线上服务不应把来自 HTTP、消息队列或配置文件的整数直接塞进 Tensor 索引。先把每个维的含义、允许负值、半开区间、空窗口是否有效写成业务合同，再在适配层统一标准化为非负 `start` 与明确 `length`。这样 `narrow` 的异常成为最后一道断言，而不是客户端靠猜异常字符串来判断请求错误。

区分读与写也很关键。`y = x[index]`对 basic index 可借用 x 的 Storage；`x[index] = value`则是在 x 上执行赋值路径，即使 index 是 advanced index 也不能拿“读取结果是 copy”推导“写不会影响 x”。测试应分别验证读取后的 `data_ptr`、写后 x 的值，以及 advanced gather 的独立 Storage，三种现象服务于不同问题。

对 batch 维做切分时，还应记录 base 的总字节数和 view 生命周期。一个看似无害的 `features[:1]`若被放入长生命周期缓存，可能把整批训练数据或请求缓冲区留在显存中。缓存边界选择 clone，短算子链保留 view；这是所有权策略，不是微优化偏好。

最后把此合同写成参数化测试：对同一请求分别输入连续、转置、带 offset 的 base，比较规范化后的区间、地址集合和错误类别。只有三者一致，索引层才没有悄悄依赖默认连续布局。

把这些断言固定在 CI，后续优化切片实现时仍能守住同一地址合同。

#### 本章结论

索引 API 的可靠性来自统一边界、读写分离和生命周期可见性。

## 核心机制

- narrow 通过 slice 统一实现，并先规范化负 start 与边界。
- step slice 将该维 stride 乘 step，起点贡献写入 storage_offset。
- select 删除固定维度；narrow 保留维度但缩小 size。
- basic indexing 通常可表示为 view，advanced indexing 的读取是 gather copy。

## 常见误区

- 认为 slice 的 numel 等于占用或保留的 Storage 字节。
- 把 basic 与 advanced indexing 的读取别名混为一谈。
- 把 PyTorch 当作支持负 stride NumPy view。
- 对长期缓存的窄 view 不审计其 base 生命周期。

## 实现变体

### narrow：长度明确的窗口

useWhen: "实现分页、时间窗或协议字段切分，需要受控边界。"
tradeoff: "接口稳定且错误清晰；只表示连续 step=1 区间。"

### clone：生命周期隔离

useWhen: "小 slice 要脱离巨大 batch 长期缓存或跨所有权边界。"
tradeoff: "解除 Storage 钉住风险，代价是显式 copy。"

## 可运行示例

```python
import torch

x = torch.arange(15).reshape(3, 5)
window = x[:, 1:5:2]
assert window.shape == (3, 2)
assert window.stride() == (5, 2)
assert window.storage_offset() == 1
assert window.untyped_storage().data_ptr() == x.untyped_storage().data_ptr()
window[2, 1] = -1
assert x[2, 3] == -1

row = x.select(0, 1)
assert row.shape == (5,) and row.storage_offset() == 5
assert x[[0, 2]].untyped_storage().data_ptr() != x.untyped_storage().data_ptr()
```

## 搭积木复现

### 积木 1：实现半开区间标准化

把 start、stop、step 规范化，并为越界、空区间写测试。

### 积木 2：更新单维元数据

推导 slice 后的 size、stride 与 offset，和 torch 对照。

### 积木 3：实现 select

固定一维坐标、删除该维，验证 rank 与地址。

### 积木 4：实现 narrow

复用 step=1 slice，加入负 start/length/标量失败测试。

### 积木 5：区分 gather

为索引列表建立复制实现，断言它不共享 Storage。

### 积木 6：审计生命周期

让 tiny view 指向 large base，报告 logical bytes 与 storage bytes。

## 自检

### 问题

连续 `x.shape=(3,5)`、stride `(5,1)` 上执行 `x[:,1:5:2]`。写出输出 size、stride、offset，算输出 `(2,1)`地址；为什么 `x[[0,2]]`不能用相同三元组表示？

### 站内答案

输出是 size `(3,2)`、stride `(5,2)`、offset `1`，`(2,1)`地址为 `1+2×5+1×2=13`。索引列表沿第 0 维选择不连续且任意的坐标集合，通用 gather 不能只用每一维一个固定 stride 表达，也要分配新的紧凑输出；因此读取 `x[[0,2]]`是 copy，而基本 slice 仍可 alias。工程上还要分别报告 logical bytes 与它持有的 Storage nbytes：小窗口可能钉住大 batch。跨请求缓存时 clone 的复制成本往往更低；一次同步链内立即消费则保留 view，避免小块 allocator 压力。对外接口用半开区间 `[start, stop)`，将负 index、空窗口和越界在一处规范化；记录原始与规范化参数，避免日志中的负索引无法复现。回归表要包含连续输入、转置输入、步长 slice 和 offset 非零的 slice，分别断言地址、值、写传播与异常，才能证明实现没有只在默认连续输入上正确。还应把 basic 读取、advanced 读取和 assignment 分成三组测试：后两者的语法可能相近，但 gather copy 与向原对象 scatter 的所有权方向完全不同。为避免隐藏 copy，profile 中应明确标出 index、slice、narrow 和后续消费 kernel；只要接口承诺借用，就让非连续输入也作为持续回归样本。
