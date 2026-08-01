---
id: "torch-02-08"
track: "torch"
title: "type promotion：三桶归并如何决定结果 dtype"
depth: "deep"
visualIndex: "../visuals/torch-02-08.md"
exampleLanguage: "python"
readingMinutes: 25
sourceMinutes: 28
practiceMinutes: 47
reviewMinutes: 15
---

## 官方入口

title: "PyTorch 2.13 · Tensor Attributes — Type promotion documentation"
url: "https://docs.pytorch.org/docs/stable/tensor_attributes.html#type-promotion-doc"

官方定义：参与运算的操作数被分成三类参与提升——非零维张量、零维张量、Python 包装标量；提升先在类别内部进行，再按 complex > floating > integral > bool 的类别优先级合并。文档明确指出，Python 标量和零维张量只有在其**类别高于**所有非零维张量时才会影响结果 dtype。

## 真实源码

repo: "pytorch/pytorch"
file: "aten/src/ATen/native/TypeProperties.cpp"
symbol: "combine_categories / update_result_type_state / result_type"
language: "cpp"
url: "https://github.com/pytorch/pytorch/blob/v2.13.0/aten/src/ATen/native/TypeProperties.cpp#L83-L146"

### 逐段讲解

- `ResultTypeState` 有三个字段 `dimResult / zeroResult / wrappedResult`，正好对应三个桶；每个操作数只会更新其中一个。
- `update_result_type_state` 先判断 `is_wrapped_number()`：Python 字面量在这里被替换成默认 dtype（浮点变 `get_default_dtype()`，复数变默认复数类型），这就是 `1.5` 变成 float32 而不是 float64 的地方。
- 分桶顺序是 `dim() > 0` 优先，其次 `is_wrapped_number`，最后才是零维张量；同一个桶内部用 `promote_skip_undefined` 做常规查表提升。
- `combine_categories(higher, lower)` 不是对称的：complex 一律赢；`higher` 是浮点就直接返回 `higher`，完全不看 `lower` 的位宽——这解释了 `float32` 张量加 `float64` 零维张量仍然是 float32。
- 只有当 `higher` 是 bool 或 `lower` 是浮点时才回退到真正的 `promoteTypes` 查表，也就是「类别更高的一方才能改变结果」。
- 顶层 `result_type` 的括号顺序是 `combine(dimResult, combine(zeroResult, wrappedResult))`：零维张量和包装标量先合并成一个「低优先桶」，再去挑战有维张量。

### 源码节选

```cpp
static inline ScalarType combine_categories(ScalarType higher, ScalarType lower) {
  if (isComplexType(higher)) {
    return higher;                       // 复数一律获胜
  } else if (isComplexType(lower)) {
    if (isFloatingType(higher)) {
      return toComplexType(higher);      // 保留 higher 的值类型位宽
    }
    return lower;                        // 整数遇复数时低优先桶胜出
  } else if (isFloatingType(higher)) {
    return higher;                       // 关键：不看 lower 的位宽
  }
  if (higher == ScalarType::Bool || isFloatingType(lower)) {
    return promote_skip_undefined(higher, lower);  // 类别更高才改变结果
  }
  if (higher != ScalarType::Undefined) {
    return higher;
  }
  return lower;
}

ResultTypeState update_result_type_state(const Tensor& tensor,
                                         const ResultTypeState& in_state) {
  ResultTypeState new_state = in_state;
  const bool is_wrapped_number =
      tensor.unsafeGetTensorImpl()->is_wrapped_number();
  ScalarType current = tensor.scalar_type();
  if (is_wrapped_number) {               // Python 字面量退化成默认 dtype
    if (isComplexType(current)) {
      current = typeMetaToScalarType(at::get_default_complex_dtype());
    } else if (isFloatingType(current)) {
      current = typeMetaToScalarType(at::get_default_dtype());
    }
  }
  if (tensor.dim() > 0) {
    new_state.dimResult = promote_skip_undefined(in_state.dimResult, current);
  } else if (is_wrapped_number) {
    new_state.wrappedResult = promote_skip_undefined(in_state.wrappedResult, current);
  } else {
    new_state.zeroResult = promote_skip_undefined(in_state.zeroResult, current);
  }
  return new_state;
}

ScalarType result_type(const ResultTypeState& in_state) {
  return combine_categories(in_state.dimResult,
      combine_categories(in_state.zeroResult, in_state.wrappedResult));
}
```

## 导读

多数人对结果 dtype 的直觉是「取更宽的那个」，这个直觉在 PyTorch 里经常错。`torch.tensor([1.], dtype=torch.float32) + torch.tensor(1., dtype=torch.float64)` 的结果是 **float32**，不是 float64——因为右边是零维张量，属于低优先桶，而两者同为浮点类别，低优先桶就没有发言权。同一组 dtype 换成两个一维张量，结果立刻变成 float64。dtype 的决定权首先取决于「rank 是不是 0」，其次才是位宽。

第二个反直觉的地方是标量不看数值。`torch.tensor([1], dtype=torch.int8) + 200` 得到的是 int8，数值是 **-55**——`1 + 200 = 201` 溢出了 int8 的表示范围，静默回绕。PyTorch 刻意不做「按值提升」（value-based promotion），因为那会让同一段代码在不同输入下产生不同 dtype，破坏 trace 和图编译的可预测性。代价就是这类溢出不报错。

本课把提升拆成三步来读：分桶、桶内查表、桶间按类别合并。分桶决定谁有资格影响结果，查表决定同类别内怎么变宽（`uint8 + int8` 是 int16，因为两者都装不下对方），合并决定跨类别时谁赢。最后再看写回路径——`add_` 和 `out=` 用的是另一套更严格的 `canCast` 检查，提升算出来的类型如果装不进目标，直接报错而不是悄悄截断。

## 分章正文

### 三个桶：谁有资格决定 dtype

kicker: "01 · BUCKETS"

`ResultTypeState` 把所有操作数分进三个互不相通的桶。`dim() > 0` 的张量进 `dimResult`，Python 字面量进 `wrappedResult`，零维张量进 `zeroResult`。注意判断顺序：一个既是零维又是 wrapped number 的对象会进 `wrappedResult`，因为 `dim() > 0` 不成立而 `is_wrapped_number` 为真。

分桶的意义是给「形状」赋予优先级。有维张量代表真实数据，通常是模型激活或权重；零维张量和字面量往往是超参、阈值、缩放系数这类配置量。让配置量无权把整批激活从 float16 拉到 float64，是这套设计的目的。实测 `torch.result_type(torch.tensor([1.], dtype=torch.float32), torch.tensor(1., dtype=torch.float64))` 返回 float32，正是这条规则的直接体现。

#### 本章结论

rank 决定桶，桶决定优先级；零维和字面量只有在类别更高时才能改变结果。

### combine_categories 的不对称优先级

kicker: "02 · CATEGORY"

合并函数的分支顺序就是优先级表。complex 一律赢；如果 `higher`（有维桶）已经是浮点，直接返回它而完全忽略 `lower` 的位宽；只有 `higher` 是 bool，或者 `lower` 是浮点而 `higher` 是整数时，才会退回真正的查表提升。

于是产生几组容易记混的结果：`int32` 一维张量加 `float64` 零维张量得到 **float64**（低优先桶类别更高，跨类别生效，且此时用的是查表结果）；`int32` 一维张量加 `int64` 零维张量得到 **int32**（同类别，低优先桶无效）；`uint8` 一维张量加 Python 整数 `300` 仍是 **uint8**。规则是统一的：跨类别才有资格，同类别一律听有维张量的。

复数的处理还多一层。`float32` 张量加 `1j` 得到 complex64 而不是 complex128，因为 `toComplexType(higher)` 保留了 `higher` 的值类型位宽；但 `promote_types(complex64, float64)` 是 complex128，因为那是纯查表路径，没有经过类别合并。

#### 本章结论

类别优先级是 complex > floating > integral > bool，同类别时有维桶独占决定权。

### promoteTypes 查表里那些不直观的格子

kicker: "03 · TABLE"

桶内提升调用的是 `c10/core/ScalarType.cpp` 的 `promoteTypes`，它本质是一张对称查找表。两个格子值得单独记：`uint8 + int8 = int16`，因为 uint8 的上界 255 装不进 int8，int8 的负数也装不进 uint8，只能一起升到能容纳两者的 int16；`float16 + bfloat16 = float32`，因为这两种半精度的指数位和尾数位分配不同，互相都不是对方的超集。

同理，`bool + int8 = int8`（bool 是最低类别，任何整数都能容纳它），`int64 + 1`（Python int 字面量）仍是 int64。表里没有「就近取宽」这种模糊规则，每个格子都是显式写死的，所以遇到拿不准的组合，直接调 `torch.promote_types(a, b)` 查一次比推理更可靠。

#### 本章结论

桶内提升是查表而非比较位宽，`u8+i8=i16` 与 `f16+bf16=f32` 是必须背下来的两格。

### 标量不看数值，于是溢出是静默的

kicker: "04 · SCALAR"

`update_result_type_state` 对 wrapped number 做的第一件事是把它替换成默认 dtype：浮点字面量变 `torch.get_default_dtype()`（默认 float32），复数字面量变默认复数类型。整数字面量保持整数类别。**替换的过程完全不看数值大小**，所以 `200` 和 `2` 对提升的影响完全相同。

后果是 `torch.tensor([1], dtype=torch.int8) + 200` 保持 int8，计算得到 201 后回绕成 -55，没有告警。同样地，`torch.tensor([1.], dtype=torch.float16) + 1e5` 得到 `inf`——float16 的最大值约 65504，装不下 100001。这不是 bug 而是设计选择：按值提升会让 dtype 依赖运行时数据，torch.compile 与 export 就无法在编译期确定类型。

工程上的应对很直接：低精度张量与外部常量相加时，要么把常量显式包成同 dtype 的零维张量并自己做范围检查，要么先把张量升到安全 dtype 再算。不要指望框架替你发现溢出。

#### 本章结论

提升只看 dtype 与 rank，不看数值；低精度加大常量会静默回绕或溢出到 inf。

### 写回路径用的是另一套 canCast 门

kicker: "05 · WRITEBACK"

提升算出的公共 dtype 只决定「用什么精度算」，不决定「能不能写回去」。原地操作和 `out=` 会额外检查 `canCast(公共类型, 目标类型)`：`torch.tensor([1]).add_(1.5)` 报错「result type Float can't be cast to the desired output type Long」，`torch.add(torch.tensor([1.]), 1., out=torch.empty(1, dtype=torch.int32))` 报错「result type Float can't be cast to the desired output type Int」。两条文本结构一致，只是目标类型名不同。

`torch.can_cast` 的语义容易误读。它实现的是 NumPy 的 `same_kind` 规则：`can_cast(float64, float32)` 是 **True**（同类别降精度允许），`can_cast(float32, int64)` 是 **False**（浮点转整数会丢小数部分，跨类别向下不允许）。所以「能不能写回」判的是类别方向，不是位宽方向。

真正的除法是另一个常被忽略的入口：`torch.tensor([1]) / torch.tensor([2])` 得到 float32 而不是整数，因为 `true_divide` 在整数输入时强制提升到默认浮点类型。写 `x /= 2` 时如果 `x` 是整数张量，就会撞上同一条 canCast 门而报错。

#### 本章结论

计算精度由提升决定，写回合法性由 `canCast` 的类别方向决定，两者是独立的两道判定。

### 把 dtype 变成显式契约

kicker: "06 · PRACTICE"

调试 dtype 问题时最省时间的工具是 `torch.result_type(a, b)`——它直接调用本课这套逻辑，不实际计算，可以在写代码时先问一句「这两个东西加起来是什么类型」。配合 `torch.promote_types(x, y)` 查纯表结果，两者的差异恰好暴露出类别合并规则在起作用。

在库和模型代码里，更稳的做法是不依赖隐式提升。对外接口显式声明期望 dtype 并在入口 `assert`；内部常量用 `torch.tensor(value, dtype=x.dtype, device=x.device)` 构造而不是写裸字面量；混合精度训练里让 autocast 负责类型策略，而不是靠算子隐式提升去凑。测试上要用互不相同的 dtype 组合，尤其覆盖「一维 vs 零维」这一对，因为它是唯一一处让形状影响类型的规则，也是最容易在重构中被破坏的假设。

#### 本章结论

用 `result_type` 提前查询、用显式 dtype 构造常量，把隐式提升从依赖降级为兜底。

## 核心机制

- 操作数按 rank 与 wrapped 标记分进 `dimResult / wrappedResult / zeroResult` 三个桶。
- Python 字面量在进桶前被替换成默认 dtype，过程不看数值。
- 桶内用 `promoteTypes` 查表，桶间用 `combine_categories` 按 complex > floating > integral > bool 合并。
- 同类别时低优先桶不影响结果，跨类别时才生效。
- 原地与 `out=` 额外过 `canCast` 检查，判的是类别方向而非位宽。

## 常见误区

- 认为结果 dtype 就是「更宽的那个」，忽略零维张量属于低优先桶。
- 以为大整数字面量会自动把张量提升到更宽类型，实际会静默回绕。
- 把 `can_cast(float64, float32)` 为 True 理解成「精度不会丢」。
- 忘记整数张量的 `/` 会变成浮点，于是 `x /= 2` 在整数上直接报错。
- 用位宽推理 `uint8 + int8`，得出 uint8 或 int8 而不是 int16。

## 实现变体

### 依赖隐式提升

useWhen: "脚本、notebook 或一次性分析，操作数 dtype 明确且都是常见组合。"
tradeoff: "代码短；重构或换输入源时 dtype 可能静默改变，低精度下有溢出风险。"

### 显式 dtype 契约

useWhen: "库代码、混合精度训练、需要 torch.compile 或 export 的路径。"
tradeoff: "入口断言与常量构造更啰嗦；换来类型可预测、编译期可确定、溢出可提前发现。"

## 可运行示例

```python
import torch

assert torch.result_type(
    torch.tensor([1.], dtype=torch.float32),
    torch.tensor(1., dtype=torch.float64)
) is torch.float32
assert torch.result_type(
    torch.tensor([1.], dtype=torch.float32),
    torch.tensor([1.], dtype=torch.float64)
) is torch.float64
assert torch.result_type(
    torch.tensor([1], dtype=torch.int32),
    torch.tensor(1., dtype=torch.float64)
) is torch.float64
assert torch.result_type(
    torch.tensor([1], dtype=torch.int32), torch.tensor(1)
) is torch.int32

assert torch.promote_types(torch.uint8, torch.int8) is torch.int16
assert torch.promote_types(torch.float16, torch.bfloat16) is torch.float32

overflowed = torch.tensor([1], dtype=torch.int8) + 200
assert overflowed.dtype is torch.int8 and overflowed.tolist() == [-55]
assert torch.isinf(torch.tensor([1.], dtype=torch.float16) + 1e5).item()

assert (torch.tensor([1.], dtype=torch.float32) + 1j).dtype is torch.complex64
assert (torch.tensor([1]) / torch.tensor([2])).dtype is torch.float32

assert torch.can_cast(torch.float64, torch.float32) is True
assert torch.can_cast(torch.float32, torch.int64) is False
try:
    torch.tensor([1]).add_(1.5)
except RuntimeError as error:
    assert "can't be cast to the desired output type Long" in str(error)
else:
    raise AssertionError('整数左值不能接收浮点结果')
```

## 搭积木复现

### 积木 1：定义 dtype 类别与查表

列出 bool、整数、浮点、复数四个类别，并按源码写出 `promoteTypes` 的关键格子，先覆盖 `u8/i8/i16/i64/f16/bf16/f32/f64`。

### 积木 2：实现三桶状态机

为每个操作数判断 rank 与 wrapped 标记，更新 `dimResult / zeroResult / wrappedResult`，并在进桶前把字面量替换成默认 dtype。

### 积木 3：实现 combine_categories

按源码分支顺序实现不对称合并，特别保留「higher 是浮点就直接返回」这一条，再用 float32 一维加 float64 零维验证。

### 积木 4：串成 result_type

按 `combine(dimResult, combine(zeroResult, wrappedResult))` 的括号顺序求最终类型，并与 `torch.result_type` 逐组对拍。

### 积木 5：加入 canCast 写回门

实现类别方向判定，复现 `add_` 与 `out=` 的两条错误文本，验证 `float64 -> float32` 允许而 `float32 -> int64` 拒绝。

### 积木 6：构造溢出用例

用 int8 加大整数与 float16 加大浮点，确认实现和 PyTorch 一样静默回绕或溢出到 inf，并在自己的封装层加上范围断言。

## 自检

### 问题

`torch.tensor([1.], dtype=torch.float32)` 分别加上 `torch.tensor(1., dtype=torch.float64)` 和 `torch.tensor([1.], dtype=torch.float64)`，结果 dtype 为什么不同？另外 `torch.tensor([1], dtype=torch.int8) + 200` 为什么得到 -55 而不是自动提升到 int16？

### 站内答案

结论：前者是 float32，后者是 float64；int8 加 200 保持 int8 并回绕成 -55。机制：`update_result_type_state` 按 rank 把操作数分桶——`dim() > 0` 的进 `dimResult`，零维张量进 `zeroResult`，Python 字面量进 `wrappedResult`。第一组里 float64 是零维张量，落在低优先桶；`combine_categories(higher=float32, lower=float64)` 走到 `isFloatingType(higher)` 分支直接 `return higher`，完全不看 lower 的位宽，所以是 float32。第二组两个都是一维张量，同进 `dimResult` 桶，走的是桶内 `promoteTypes` 查表，float32 与 float64 提升为 float64。至于第三组，`200` 是 wrapped number，进桶前只按类别替换 dtype（整数保持整数），**从不检查数值**，所以整数字面量无法把 int8 推到更宽的类型；同类别下低优先桶不生效，结果保持 int8，`1 + 200 = 201` 超出 int8 的 [-128, 127] 后按二进制补码回绕成 -55。源码证据：`aten/src/ATen/native/TypeProperties.cpp`（v2.13.0 第 83-146 行）的 `combine_categories` 分支顺序、`update_result_type_state` 里的 `is_wrapped_number` 替换，以及 `result_type` 的 `combine(dimResult, combine(zeroResult, wrappedResult))` 括号顺序。可运行验证：本课示例前四条 `torch.result_type` 断言覆盖了一维/零维的四种组合，`overflowed.tolist() == [-55]` 覆盖了溢出。工程取舍：不做按值提升是为了让 dtype 只依赖静态类型信息，从而在 `torch.compile` 与 `export` 里编译期可确定；代价是把溢出检查完全交给调用方。适用边界是——低精度张量（int8/uint8/float16/bfloat16）与外部常量运算时必须自己做范围校验，或用 `torch.tensor(value, dtype=..., device=...)` 显式构造并提前升宽；高精度张量之间可以放心依赖隐式提升，但仍要记住零维张量不会提升同类别的有维张量。

## 更新日志

### 首次深度精写

at: "2026-08-01T10:58:00+08:00"
human: "@h0ll0w-AkuZr0guY"
ai: "OpenAI Codex · GPT-5.6 Terra"
summary: "基于 PyTorch v2.13.0 的 TypeProperties.cpp 精写类型提升：三桶分类与优先级、combine_categories 的不对称分支、promoteTypes 查表中的 u8+i8 与 f16+bf16、标量不按值提升导致的静默溢出，以及原地与 out= 的 canCast 写回门。"
pr: "https://github.com/h0ll0w-AkuZr0guY/AILearningLab/pull/17"
commit: "05e634c2dfe9ebd31d824f0c54db677301b765d9"
