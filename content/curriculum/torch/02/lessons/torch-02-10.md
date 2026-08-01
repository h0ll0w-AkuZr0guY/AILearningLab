---
id: "torch-02-10"
track: "torch"
title: "operator dispatch：DispatchKeySet 如何为一次调用选出 kernel"
depth: "deep"
visualIndex: "../visuals/torch-02-10.md"
exampleLanguage: "python"
readingMinutes: 30
sourceMinutes: 40
practiceMinutes: 60
reviewMinutes: 20
---

## 官方入口

title: "PyTorch 2.13 · Extending PyTorch — Extending torch native API (dispatcher)"
url: "https://docs.pytorch.org/docs/stable/notes/extending.html#extending-torch-native-api"

官方说明：PyTorch 的算子调用由 dispatcher 统一路由；每个 Tensor 携带一个 `DispatchKeySet`，与线程局部的 include/exclude 集合合并后，按 DispatchKey 的固定优先级取出最高位的那个键，再到算子的分发表里查出对应 kernel；Autograd、autocast、functionalization 等能力都以「某一层 kernel 先执行、再 redispatch 到下一层」的形式串成调用链。

## 真实源码

repo: "pytorch/pytorch"
file: "aten/src/ATen/core/dispatch/DispatchKeyExtractor.h"
symbol: "computeDispatchKeySet"
language: "cpp"
url: "https://github.com/pytorch/pytorch/blob/v2.13.0/aten/src/ATen/core/dispatch/DispatchKeyExtractor.h#L24-L47"

### 逐段讲解

- 函数注释第一句就点明：这个结果与 `Tensor::key_set()` 不同，它会随 TLS 变化——同一个张量在 `no_grad` 或 `inference_mode` 里算出的分发键集合并不一样。
- 第一个参数 `ks` 是所有 Tensor 参数键集合的并集，由 `MultiDispatchKeySet` 遍历实参逐个 `|` 起来。
- 第二个参数 `key_mask` 有两个用途：屏蔽算子分发表里注册为 fallthrough 的键，以及在 `redispatch` 时把「用户要求停在这里」的键及其以上全部清零。
- 注释特别强调 mask 必须在 TLS 之后应用，因为某个后端可能正是被 TLS 的 include 集合引入的。
- 函数体只有一行 `(((ks | local.included_) - local.excluded_) & key_mask)`：先并入 TLS include，再减去 TLS exclude，最后与 mask 求交。四种集合的作用顺序在这一行里完全确定。
- 返回 `DispatchKeySet` 而不是单个键；真正取哪一个由后续 `lookup` 里的「取最高优先位」完成，所以 fallthrough 的实现方式是把该位从 mask 里抹掉而不是逐个判断。

### 源码节选

```cpp
// Take a DispatchKeySet for a Tensor and determine what the actual dispatch
// DispatchKey should be, taking into account TLS, and skipping backends which
// fall through.
//
// Unlike Tensor::key_set(), the value of this on a tensor can change depending
// on TLS.
//
// NB: If there is no valid dispatch key, this will return Undefined
inline DispatchKeySet computeDispatchKeySet(
    DispatchKeySet ks,
    // The key mask lets us eliminate (by zero entries) keys which should not
    // be considered for dispatch.  There are two cases when we use this:
    //
    // - If an operator's dispatch table contains a fallthrough entry, we
    //   should bypass it entirely when finding the key
    // - If a user invokes with redispatch, the mask lets us
    //   zero out the key the user asked us to stop.
    //
    // These excluded backends are NOT tracked in the TLS, but must be applied
    // AFTER TLS (since the backend may have been introduced for consideration
    // by the included TLS), which is why you have to pass them in to this
    // function (as opposed to just applying it to the input 'ks').
    DispatchKeySet key_mask) {
  c10::impl::LocalDispatchKeySet local =
      c10::impl::tls_local_dispatch_key_set();
  return (((ks | local.included_) - local.excluded_) & key_mask);
}
```

## 导读

一次 `a + b` 从 Python 走到 CPU kernel，中间经过的不是一次函数调用，而是一条由 dispatcher 逐层剥开的调用链。理解这条链有一个非常具体的收益：你能解释为什么同一行代码在 `no_grad()`、`inference_mode()`、`autocast()` 或 `TorchDispatchMode` 里跑出不同的行为，也能在自定义后端、量化、functionalization 报错时知道该看哪一层。

关键数据结构只有一个：`DispatchKeySet`，本质是一个位集合。张量自己带一份——实测普通 CPU 张量的键集是 `DispatchKeySet(CPU, ADInplaceOrView, AutogradCPU, AutocastCPU)`，注意 `requires_grad=True` 的张量键集**完全相同**，梯度追踪与否并不体现在张量键集里。线程再带两份：include 和 exclude。实测默认状态下 include 是 `(BackendSelect, ADInplaceOrView)`，exclude 是全部十个 `Autocast*` 键——也就是说 autocast 默认是被 TLS 关掉的，进入 `autocast()` 上下文其实是把对应的键从 exclude 里移走。

三份集合按 `((ks | included) - excluded) & key_mask` 合并成一个候选集合，再取优先级最高的那一位，去算子的分发表里查 kernel。这条式子和「取最高位」两件事，构成了整个分发系统的全部核心逻辑；其余复杂度都在「哪些键被注册了 kernel」「哪些注册成 fallthrough」「每层 kernel 做完自己的事后如何 redispatch 到下一层」这三个问题上。本课就按这个顺序展开，并且每一步都给出可在本机复现的读数。

## 分章正文

### 张量键集与线程键集是两份独立数据

kicker: "01 · KEYSETS"

`torch._C._dispatch_key_set(x)` 直接打印张量携带的键集。普通 CPU 浮点张量得到 `DispatchKeySet(CPU, ADInplaceOrView, AutogradCPU, AutocastCPU)`；把它换成 `requires_grad=True` 的张量，输出**一模一样**。这一点常被误解：autograd 是否介入不是靠张量键集区分的，而是靠 kernel 内部检查 `requires_grad` 以及 TLS 是否排除了 Autograd 键。

改变张量的设备或 layout 才会改变键集。稀疏张量得到 `DispatchKeySet(SparseCPU, ADInplaceOrView, AutogradCPU, AutocastCPU)`，第一位从 `CPU` 换成 `SparseCPU`；`device='meta'` 的张量得到 `DispatchKeySet(Meta, ADInplaceOrView, AutogradMeta)`，连 Autocast 键都没有，因为 meta 设备不做真实计算。

线程侧的两份集合用 `torch._C._dispatch_tls_local_include_set()` 与 `..._exclude_set()` 读取。默认 include 是 `(BackendSelect, ADInplaceOrView)`，默认 exclude 是十个 `Autocast*` 键的全集。把这两份和张量键集放在一起，才能算出一次调用真正的候选集合。

#### 本章结论

张量键集只反映设备与 layout，梯度与精度策略由线程局部的 include/exclude 表达。

### 一行公式决定候选集合

kicker: "02 · FORMULA"

`computeDispatchKeySet` 的函数体只有 `(((ks | local.included_) - local.excluded_) & key_mask)`。四个集合的作用是分层的：`ks` 来自实参张量的并集，代表「这次调用涉及哪些后端」；`included_` 代表「本线程额外要求参与的能力」；`excluded_` 代表「本线程明确关闭的能力」；`key_mask` 代表「这个算子在这一层之后还剩哪些键可选」。

顺序不能交换。注释里专门解释了为什么 mask 必须在 TLS 之后应用：某个后端键可能正是被 include 集合引入的，如果先与 mask 求交就会把它误伤掉。同理，exclude 在 include 之后生效，意味着「同时被 include 和 exclude 的键」最终是被排除的——`inference_mode` 就利用了这一点来强制关掉 Autograd。

需要强调这个函数返回的是**集合**而不是单个键。真正的选择发生在下一步 `lookup` 里，它取集合中优先级最高的那一位。把选择拆成「先算集合、再取最高位」的好处是 fallthrough 可以通过修改 mask 实现，而不需要在取位时逐个判断，这让热路径上的分发保持在几条位运算的量级。

#### 本章结论

候选集合 = ((张量键集 ∪ TLS include) − TLS exclude) ∩ key_mask，顺序由注释显式规定。

### inference_mode 如何改写这三份集合

kicker: "03 · INFERENCE"

进入 `torch.inference_mode()` 后重新读一遍三份集合，变化非常清晰。新建张量的键集从四项缩成 `DispatchKeySet(CPU, AutocastCPU)`——`ADInplaceOrView` 和 `AutogradCPU` 两位都不见了，因为 inference 张量根本不需要视图追踪和梯度元数据。TLS include 从 `(BackendSelect, ADInplaceOrView)` 缩成只剩 `(BackendSelect)`。TLS exclude 则从十个 Autocast 键扩充到十二项，多出了 `AutogradOther` 和 `AutogradNestedTensor`。

对比 `torch.no_grad()` 会发现两者层次不同：`no_grad` 下 exclude 集合与默认状态**完全一致**，仍是那十个 Autocast 键。也就是说 `no_grad` 根本没有动 dispatch 键，它改的是另一个线程局部标志 `GradMode`，由 Autograd kernel 内部读取后决定不建图。这解释了一个实际差别——`no_grad` 里创建的张量仍然带 `ADInplaceOrView` 和 `AutogradCPU` 键，可以正常参与后续需要梯度的计算；而 inference tensor 因为缺少这些键，一旦离开 inference 上下文再参与 autograd 就会报错。

#### 本章结论

`inference_mode` 同时改写张量键集与 TLS 三份数据，`no_grad` 只改 GradMode 标志而不动分发键。

### 分发表里注册了什么，缺了什么

kicker: "04 · TABLE"

用 `torch._C._dispatch_has_kernel_for_dispatch_key` 逐个查 `aten::add.Tensor` 会得到一组看似矛盾的读数：`CPU` 是 True，`Autograd` 是 True，但 `AutogradCPU` 是 **False**。原因是注册发生在别名键 `Autograd` 上，它在建表时被展开到所有 `AutogradXXX` 后端键；这个查询函数问的是「有没有直接为这个具体键注册」，所以返回 False，而实际查表时 `AutogradCPU` 依然能命中展开后的条目。

另一组读数更能说明分层设计：`aten::add_.Tensor` 在 `ADInplaceOrView` 上有 kernel（True），而 `aten::add.Tensor` 没有（False）。这完全符合语义——`ADInplaceOrView` 这一层的职责是为原地操作递增版本计数、为视图操作记录 base 关系，而 out-of-place 的 `add` 两件事都不需要，于是它在这一层被注册为 fallthrough，分发时直接跳过。上一课讲的版本计数器，物理上就落在这一层的 kernel 里。

`torch._C._dispatch_dump_table('aten::add.Tensor')` 可以打印整张表。第一行是 `Undefined` 键的条目，指向 `RegisterCompositeExplicitAutogradNonFunctional_0.cpp` 的 default backend kernel——这说明「没有任何张量参数」的退化情形也有兜底实现。排查「为什么我的自定义后端没被调用」时，这张表是第一手证据。

#### 本章结论

别名键会展开到多个后端键，fallthrough 表示该层无事可做；查表要区分「直接注册」与「展开后可命中」。

### 逐层剥开：一次调用真正经过几层

kicker: "05 · REDISPATCH"

`Dispatcher::call` 的主体很短：先 `getDispatchKeySetUnboxed` 算出集合，再 `op.lookup(dispatchKeySet)` 取 kernel，最后 `kernel.call(op, dispatchKeySet, args...)`。注意最后一步把**集合本身**也传给了 kernel，这正是 redispatch 的基础——上层 kernel 做完自己的工作后，会把当前键从集合里清掉再调一次 dispatcher，于是自然落到下一优先级的层。

以 `x.add_(1)`（x 需要梯度）为例，层次是：`AutogradCPU` 先建图并记录反向节点，然后 redispatch；`ADInplaceOrView` 递增版本计数并处理视图关系，再 redispatch；最后落到 `CPU` 的真实计算 kernel。每一层都只关心自己那一件事，彼此不需要知道对方存在。这种「洋葱式」结构是 PyTorch 能把 autograd、autocast、量化、functionalization 独立开发又叠加使用的根本原因。

`Dispatcher::call` 里还有一处值得注意：`show_dispatch_trace()` 分支只在 debug 构建或定义了 `HAS_TORCH_SHOW_DISPATCH_TRACE` 时编译进去。发布版二进制里这段代码不存在，所以生产环境无法用环境变量打开分发追踪，只能改用 `TorchDispatchMode` 在 Python 层观察。

#### 本章结论

kernel 拿到的是键集合而非单键，逐层清位再调用构成 redispatch 的洋葱结构。

### 用 TorchDispatchMode 在 Python 层看真实调用

kicker: "06 · OBSERVE"

`TorchDispatchMode` 是把观察点插到 dispatcher 里的官方入口。在 mode 里执行 `(x + 1).sum()` 会捕获到 `['aten.add.Tensor', 'aten.sum.default']`——Python 层的 `+` 被解析成具体的 overload 名 `add.Tensor`，`.sum()` 则是 `sum.default`。这个粒度正好是分发表的粒度，可以直接拿去查表。

更有价值的是观察反向。在 mode 里执行 `(torch.ones(2, requires_grad=True) * 2).sum().backward()` 捕获到七个算子：`aten.ones.default`、`aten.mul.Tensor`、`aten.sum.default`、`aten.ones_like.default`、`aten.expand.default`、`aten.mul.Tensor`、`aten.detach.default`。前三个是 forward，`ones_like` 是 backward 的种子梯度，`expand` 是 `sum` 的反向（把标量梯度广播回原形状），第二个 `mul.Tensor` 是乘法的反向，`detach` 是梯度累加到叶子时的收尾。**反向传播本身也完整走 dispatcher**，这是很多人第一次看到 trace 时才真正确信的事实。

这个能力在工程上有直接用途：想知道某个高层 API 究竟展开成哪些底层算子，不必读源码，套一个 mode 跑一遍即可；想给某类算子统一插桩（计数、精度检查、算子替换），mode 是成本最低的位置。

#### 本章结论

`TorchDispatchMode` 捕获到的名字就是分发表的键，正向与反向都会经过同一条分发路径。

### 从读数反推问题：一套排查顺序

kicker: "07 · DIAGNOSIS"

遇到「行为在某个上下文里变了」的问题，按固定顺序取四组读数就能定位。第一步打印张量键集，确认设备与 layout 是否符合预期（例如是不是意外变成了稀疏或 meta）。第二步打印 TLS 的 include 与 exclude，确认当前上下文是否关掉了某个能力。第三步用 `_dispatch_has_kernel_for_dispatch_key` 确认目标键上到底有没有 kernel，并区分是别名键展开还是 fallthrough。第四步套 `TorchDispatchMode` 打印真实算子序列，验证前三步的推断。

几个常见结论可以直接对应上去：自定义后端没被调用，通常是张量键集里根本没有该后端键，或者注册用的键与实际计算键不匹配；autocast 没生效，多半是那个键还在 exclude 里；inference tensor 报错，是因为它缺少 `ADInplaceOrView` 和 Autograd 键；原地操作的版本计数没有递增，要看 `ADInplaceOrView` 这一层是不是被 fallthrough 掉了。

需要注意这套工具的边界。`torch._C._dispatch_*` 属于内部 API，跨版本可能改名或改语义，只应出现在调试脚本和教学代码里，不要写进生产代码或测试断言的稳定契约。真要在测试里锁定行为，锁的应该是可观察结果（数值、dtype、报错文本），而不是内部键集的字符串表示。

#### 本章结论

按「张量键集 → TLS 集合 → 分发表 → Mode trace」四步取证，内部 API 只用于诊断不用于契约。

## 核心机制

- `DispatchKeySet` 是位集合，张量携带一份、线程携带 include 与 exclude 两份。
- 候选集合由 `((ks | included) - excluded) & key_mask` 算出，顺序不可交换。
- 最终键是候选集合中优先级最高的一位，fallthrough 通过从 mask 中清位实现。
- 别名键 `Autograd` 在建表时展开到各 `AutogradXXX` 后端键。
- kernel 收到的是键集合，逐层清位再调用形成 redispatch 洋葱结构，反向传播同样走这条路径。

## 常见误区

- 以为 `requires_grad=True` 会改变张量键集，实际两者键集完全相同。
- 把 `no_grad` 当成 `inference_mode` 的轻量版，忽略前者根本不改 dispatch 键。
- 用 `_dispatch_has_kernel_for_dispatch_key('aten::add.Tensor', 'AutogradCPU')` 返回 False 推断 autograd 不生效。
- 认为 `ADInplaceOrView` 对所有算子都有 kernel，忽略 out-of-place 算子在这一层是 fallthrough。
- 认为反向传播绕过 dispatcher 直接调 kernel。

## 实现变体

### TorchDispatchMode 观察与插桩

useWhen: "需要知道高层 API 展开成哪些底层算子，或要为一类算子统一计数、替换、做精度检查。"
tradeoff: "纯 Python、零编译、可随时开关；每个算子多一次 Python 往返，热路径上开销明显，且只能看到 dispatcher 之下的层。"

### 注册后端 kernel 扩展分发表

useWhen: "要接入自定义设备、自定义 layout，或为特定后端提供高性能实现。"
tradeoff: "零运行时开销、与内置能力平等叠加；需要 C++ 与注册宏、要处理别名键展开与 fallthrough 语义，调试成本高。"

## 可运行示例

```python
import torch
from torch.utils._python_dispatch import TorchDispatchMode

plain = torch.ones(2)
grad_on = torch.ones(2, requires_grad=True)
assert str(torch._C._dispatch_key_set(plain)) == str(
    torch._C._dispatch_key_set(grad_on)
)
assert 'CPU' in str(torch._C._dispatch_key_set(plain))
assert 'SparseCPU' in str(torch._C._dispatch_key_set(torch.zeros(2).to_sparse()))
assert 'Meta' in str(torch._C._dispatch_key_set(torch.ones(2, device='meta')))

default_include = str(torch._C._dispatch_tls_local_include_set())
default_exclude = str(torch._C._dispatch_tls_local_exclude_set())
assert 'BackendSelect' in default_include and 'ADInplaceOrView' in default_include
assert 'AutocastCPU' in default_exclude and 'Autograd' not in default_exclude

with torch.no_grad():
    assert str(torch._C._dispatch_tls_local_exclude_set()) == default_exclude

with torch.inference_mode():
    inference_keys = str(torch._C._dispatch_key_set(torch.ones(2)))
    assert 'AutogradCPU' not in inference_keys
    assert 'ADInplaceOrView' not in inference_keys
    assert 'AutogradOther' in str(torch._C._dispatch_tls_local_exclude_set())
    assert str(torch._C._dispatch_tls_local_include_set()) != default_include

has = torch._C._dispatch_has_kernel_for_dispatch_key
assert has('aten::add.Tensor', 'CPU') is True
assert has('aten::add.Tensor', 'Autograd') is True
assert has('aten::add.Tensor', 'AutogradCPU') is False
assert has('aten::add_.Tensor', 'ADInplaceOrView') is True
assert has('aten::add.Tensor', 'ADInplaceOrView') is False
assert has('aten::add_.Tensor', 'BackendSelect') is False


class Trace(TorchDispatchMode):
    def __init__(self):
        self.ops = []

    def __torch_dispatch__(self, func, types, args=(), kwargs=None):
        self.ops.append(str(func))
        return func(*args, **(kwargs or {}))


forward = Trace()
with forward:
    (grad_on + 1).sum()
assert forward.ops == ['aten.add.Tensor', 'aten.sum.default']

both = Trace()
with both:
    (torch.ones(2, requires_grad=True) * 2).sum().backward()
assert 'aten.ones_like.default' in both.ops
assert 'aten.expand.default' in both.ops
assert both.ops.count('aten.mul.Tensor') == 2

with torch.inference_mode():
    leaked = torch.ones(2)
assert leaked.is_inference() is True

try:
    (leaked * grad_on).sum().backward()
except RuntimeError as error:
    assert 'Inference tensors cannot be saved for backward' in str(error)
else:
    raise AssertionError('inference tensors must not enter an autograd graph')

try:
    leaked.requires_grad_(True)
except RuntimeError as error:
    assert 'inference tensor outside InferenceMode' in str(error)
else:
    raise AssertionError('inference tensors must reject requires_grad_ outside the mode')
```

## 搭积木复现

### 积木 1：实现位集合与优先级

用整数位掩码表示 `DispatchKeySet`，为 CPU、SparseCPU、Meta、ADInplaceOrView、AutogradCPU、AutocastCPU 定好固定优先级，并实现「取最高位」。

### 积木 2：给张量与线程各挂一份键集

张量键集由设备与 layout 决定，线程侧维护 include 与 exclude 两份，提供进入/退出上下文的接口。

### 积木 3：复刻合并公式

实现 `((ks | included) - excluded) & key_mask`，并写一组用例验证顺序不可交换：把 mask 提前求交会误伤被 include 引入的键。

### 积木 4：实现分发表与别名键展开

为算子维护一张「键 → kernel」表，支持在别名键 `Autograd` 上注册并在建表时展开到各后端键，同时支持把某个键标为 fallthrough 并从 mask 中清位。

### 积木 5：实现 redispatch 洋葱

让每层 kernel 收到当前键集合，处理完自己的职责后清掉本层键再调一次分发，串出 `AutogradCPU → ADInplaceOrView → CPU` 的完整链路。

### 积木 6：接入版本计数与建图

在 `ADInplaceOrView` 层实现版本号递增，在 `AutogradCPU` 层记录反向节点，验证 out-of-place 算子在前者被 fallthrough 跳过。

### 积木 7：加一个观察 mode

实现一个能拦截所有分发调用并记录算子名的 mode，用它 trace 一次前向加反向，与 PyTorch 的 `TorchDispatchMode` 输出对照。

## 自检

### 问题

`torch.ones(2)` 与 `torch.ones(2, requires_grad=True)` 的 `DispatchKeySet` 有什么区别？既然 `torch._C._dispatch_has_kernel_for_dispatch_key('aten::add.Tensor', 'AutogradCPU')` 返回 False，为什么 `add` 仍然能正确建立反向图？另外，`no_grad` 与 `inference_mode` 在这三份集合上分别改了什么？

### 站内答案

结论：两个张量的键集**完全相同**，都是 `DispatchKeySet(CPU, ADInplaceOrView, AutogradCPU, AutocastCPU)`；`AutogradCPU` 查询返回 False 是因为 kernel 注册在别名键 `Autograd` 上（该键查询返回 True），建表时才展开到各后端键，所以实际查表能命中；`no_grad` 不改任何 dispatch 键，`inference_mode` 三份都改。机制：张量键集只由设备与 layout 决定，`requires_grad` 是 autograd 元数据而非分发键，梯度是否记录由 Autograd 层 kernel 内部读取 `GradMode` 决定——这正是 `no_grad` 的实现方式，实测它的 TLS exclude 集合与默认状态逐字相同，仍是那十个 `Autocast*` 键。`inference_mode` 则走另一条路：它让新建张量直接缺少 `ADInplaceOrView` 与 `AutogradCPU` 两位（键集缩成 `DispatchKeySet(CPU, AutocastCPU)`），把 TLS include 从 `(BackendSelect, ADInplaceOrView)` 缩成 `(BackendSelect)`，并往 exclude 里追加 `AutogradOther` 与 `AutogradNestedTensor`。源码证据：`aten/src/ATen/core/dispatch/DispatchKeyExtractor.h` 的 `computeDispatchKeySet`（v2.13.0 第 24-47 行）那一行 `(((ks | local.included_) - local.excluded_) & key_mask)`，以及 `aten/src/ATen/core/dispatch/Dispatcher.h` 的 `Dispatcher::call`（第 774-829 行）里 `getDispatchKeySetUnboxed` → `lookup(dispatchKeySet)` → `kernel.call(op, dispatchKeySet, ...)` 的三步，最后一步把集合本身传给 kernel 正是 redispatch 的前提。可运行验证：本课示例断言了两个张量键集字符串相等、`Autograd` 为 True 而 `AutogradCPU` 为 False、`no_grad` 下 exclude 集合不变、`inference_mode` 下键集缺少两位且 exclude 多出 `AutogradOther`，并用 `TorchDispatchMode` 断言反向会额外产生 `aten.ones_like.default` 与 `aten.expand.default`。工程取舍：把能力拆成独立分发层的代价是每次调用都要做一次位运算与查表，收益是 autograd、autocast、量化、functionalization 可以各自独立开发并任意叠加；把 `requires_grad` 排除在键集之外则避免了「同一个算子因为梯度标志不同而需要两套注册」的组合爆炸。适用边界是——`torch._C._dispatch_*` 全是内部 API，跨版本可能改名或改语义，只应出现在调试脚本与教学代码里；生产测试要锁定的是数值、dtype 和报错文本这些可观察结果，而不是键集的字符串表示。另外 inference tensor 因为缺少 `ADInplaceOrView` 与 Autograd 键，离开上下文后不能再参与 autograd，需要长期保留的结果应在 `inference_mode` 内显式 `clone()` 出普通张量。

## 更新日志

### 首次深度精写

at: "2026-08-01T11:12:00+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "WorkBuddy · Hy3"
summary: "基于 PyTorch v2.13.0 的 DispatchKeyExtractor.h 与 Dispatcher.h 精写算子分发：张量键集与 TLS include/exclude 三份数据、((ks|included)-excluded)&mask 的合并顺序、别名键展开与 fallthrough、inference_mode 与 no_grad 的层次差异、redispatch 洋葱结构，并用 TorchDispatchMode 实测正反向算子序列。"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/17"
commit: "05e634c2dfe9ebd31d824f0c54db677301b765d9"
