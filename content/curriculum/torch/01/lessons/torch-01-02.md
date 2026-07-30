---
id: "torch-01-02"
track: "torch"
title: "UntypedStorage、DataPtr 与别名生命周期：共享、所有权和序列化"
depth: "deep"
exampleLanguage: "python"
readingMinutes: 40
sourceMinutes: 35
practiceMinutes: 75
reviewMinutes: 20
---

## 官方入口

title: "PyTorch 2.13 · Untyped Storage API"
url: "https://docs.pytorch.org/docs/stable/storage.html#untyped-storage-api"

官方将 UntypedStorage 定义为连续的一维字节数组，说明多个 Tensor 可共享 Storage，序列化会保留共享关系，并明确警告 Tensor.data_ptr 与 UntypedStorage.data_ptr 不保证相等；直接修改 Storage 只适合底层教育与框架实现。

## 真实源码

repo: "pytorch/pytorch"
file: "c10/core/Storage.h"
symbol: "c10::Storage"
language: "cpp"
url: "https://github.com/pytorch/pytorch/blob/v2.13.0/c10/core/Storage.h#L25-L115"

### 逐段讲解

- `Storage` 本身是一个轻量句柄，真正的字节数、DataPtr、allocator、device 与 resizable 状态位于引用计数的 StorageImpl。
- 第一组构造函数让 allocator 创建字节缓冲区；第二组接管现有 DataPtr，所以 Storage 也能包装外部、共享内存或文件映射资源。
- `DataPtr` 不只是裸地址，还携带 device 与 deleter 上下文；最后一个 StorageImpl 引用释放时，deleter 才决定怎样归还资源。
- `nbytes` 是 Storage 容量，和任一 view 的 `numel()*element_size()`不同；一个微小 view 可以持有大容量 Storage。
- 源码支持 resizable 与 legacy 状态，但普通模型代码不应自行 resize Storage；上层 Tensor API 才能同步维护边界、版本和分派不变量。

### 源码节选

```cpp
// PyTorch v2.13.0 · c10/core/Storage.h
struct C10_API Storage {
 public:
  struct use_byte_size_t {};

  Storage() = default;
  Storage(c10::intrusive_ptr<StorageImpl> ptr)
      : storage_impl_(std::move(ptr)) {}

  // 由 allocator 分配 size_bytes，再把所有权交给 StorageImpl。
  Storage(
      use_byte_size_t,
      const SymInt& size_bytes,
      Allocator* allocator = nullptr,
      bool resizable = false)
      : storage_impl_(c10::make_intrusive<StorageImpl>(
            StorageImpl::use_byte_size_t(),
            size_bytes,
            allocator,
            resizable)) {}

  // 也能接管预先分配的 DataPtr；allocator 只服务未来 resize。
  Storage(
      use_byte_size_t,
      size_t size_bytes,
      at::DataPtr data_ptr,
      at::Allocator* allocator = nullptr,
      bool resizable = false)
      : storage_impl_(c10::make_intrusive<StorageImpl>(
            StorageImpl::use_byte_size_t(),
            size_bytes,
            std::move(data_ptr),
            allocator,
            resizable)) {}

  size_t nbytes() const {
    return storage_impl_->nbytes();
  }

  const at::DataPtr& data_ptr() const {
    return storage_impl_->data_ptr();
  }

 private:
  c10::intrusive_ptr<StorageImpl> storage_impl_;
};
```

## 导读

上一课把 Storage 当作字节层，本课继续追问“谁拥有这些字节、何时释放、怎样跨进程或文件保存”。如果只把 Storage 理解成 `void*`，就无法解释 CUDA allocator、memory mapping、from_blob 的自定义 deleter，也无法安全设计跨库零拷贝。

UntypedStorage 的“untyped”表示它按字节管理容量，元素 dtype 属于 Tensor 的解释。官方仍保留 TypedStorage 兼容层，但它已弃用；新代码应从 `tensor.untyped_storage()`观察底层。直接对 Storage `fill_` 或 `set_` 会绕过高层安全合同，只能在受控实验中使用。

别名的生命周期由 StorageImpl 引用计数收敛。Tensor view、序列化恢复对象、共享内存句柄都可能引用同一 Storage。数据复制、句柄复制和所有权转移必须分开命名，否则 API 的“零拷贝”承诺会在异常、缓存和异步执行下变成悬空地址或意外保留。

## 分章正文

### Storage、StorageImpl 与 DataPtr 各负责什么

kicker: "01 · HANDLE"

`c10::Storage` 是值语义句柄，内部只有 intrusive_ptr；复制句柄增加 StorageImpl 引用。StorageImpl 保存容量、DataPtr、allocator 与是否可 resize。DataPtr 再封装数据地址、device 和释放上下文，作用类似带自定义 deleter 的 unique_ptr。

三层拆分让 TensorImpl 可以廉价共享 Storage，同时让 CPU malloc、CUDA caching allocator、外部缓冲区和文件映射使用不同释放策略。裸地址相同只说明某一时刻指向同处，无法说明 deleter、容量和所有权对象相同。

框架扩展若接管外部内存，必须定义谁最后释放、异步 kernel 何时结束、原生产者能否重分配。把 NumPy 地址塞进 Tensor 后立刻让数组析构，是典型生命周期错误；正确桥接应持有原对象或提供与真实所有权一致的 deleter。

#### 本章结论

地址回答“在哪”，StorageImpl 回答“多大与谁持有”，DataPtr 回答“在哪个设备、最后怎样释放”。

### 为什么两个 data_ptr API 不能互换

kicker: "02 · POINTERS"

`UntypedStorage.data_ptr()`返回 Storage 字节起点。`Tensor.data_ptr()`返回当前 Tensor 第一个逻辑元素；对普通正 stride view，它等于 Storage 起点加 `storage_offset*element_size`。切掉前几个元素后两者自然不同。

更复杂的 Tensor 后端、空 Tensor 或没有典型 Storage 的对象会让朴素等式继续失效。官方因此明确写出二者不保证相等。诊断共享 Storage 时优先比较 `untyped_storage().data_ptr()`与容量，再结合设备；诊断当前首元素地址时才用 Tensor.data_ptr。

即使 Storage 起点相同，也要警惕 allocator 复用：两个不同生命周期对象可能先后拿到同一地址。指针只适合单次运行内的辅助证据，不能当持久 identity、缓存 key 或跨进程协议。

#### 代码

```python
base = torch.arange(8, dtype=torch.int64)
right = base[4:]

assert base.untyped_storage().data_ptr() == right.untyped_storage().data_ptr()
assert base.data_ptr() != right.data_ptr()
assert right.data_ptr() - base.data_ptr() == 4 * base.element_size()
```

#### 本章结论

Storage 指针标识共享字节起点，Tensor 指针标识当前解释的首元素；带 offset 时不同才是正确结果。

### 容量、逻辑字节与可访问跨度

kicker: "03 · CAPACITY"

Storage.nbytes 是已拥有缓冲区容量。Tensor 的逻辑字节通常写成 `numel*element_size`，但非连续 view 的最大地址跨度可能更大，expand 的唯一地址数又可能更小。三项指标分别服务分配、算术工作量和地址安全。

边界检查需要计算所有合法索引映射的最小/最大元素 offset，并确保落在 Storage 容量内。公开 `as_strided` 会做越界检查，却允许内部重叠；重叠 view 的向量化原地写行为没有定义。Storage 容量充足并不等于写入没有冲突。

显存审计应按唯一 Storage 去重，不能把每个 view 的容量相加；带宽估算则按算子真实读写元素和缓存行为计算。把一套数字同时用于容量、传输量与活跃值大小，会得出相互矛盾的结论。

#### 本章结论

Storage bytes、logical bytes、address span 与 unique addresses 是四个问题，性能和安全分析必须选对指标。

### torch.save 为什么要保留共享关系

kicker: "04 · SERIALIZATION"

若两个 view 共享一块大 Storage，简单地逐 Tensor 写值会重复数据并丢失别名关系。PyTorch 序列化会把 Storage 作为独立记录，再让多个 Tensor 记录各自 offset、size、stride，加载后继续共享。这既节省文件与加载成本，也保留原地修改的语义。

这种保真也可能保存过大的 Storage：只保存大 Tensor 的一个小 slice，文件仍可能携带整个底层缓冲区。若业务只想保存逻辑值，应先 `clone()`得到紧凑独立 Storage，再保存；代价是显式复制与别名断开。

`torch.load(weights_only=True)`降低反序列化任意对象的攻击面，但权重文件仍应来自可信来源并校验完整性。`map_location`按 Storage 重映射设备，说明加载过程的迁移单位正是 Storage，而不只是逻辑 Tensor。

#### 代码

```python
import io

base = torch.arange(1000)
tiny = base[:2]
buffer = io.BytesIO()
torch.save({"tiny": tiny}, buffer)

compact = io.BytesIO()
torch.save({"tiny": tiny.clone()}, compact)
assert compact.getbuffer().nbytes < buffer.getbuffer().nbytes
```

#### 本章结论

序列化默认保护别名语义；若目标是紧凑独立值，调用方要主动 clone 并承认所有权变化。

### 为什么 Storage 低层修改风险很高

kicker: "05 · RESIZE"

Storage API 可以改容量、替换 DataPtr 或填充字节，但现有 Tensor view 仍保存旧 size、stride 与 offset。若底层缓冲区缩小，某个 Tensor 的合法坐标可能立即越界；若按字节填充浮点 Storage，结果取决于位模式而非数值语义。

TensorImpl 的元数据 setter 也把边界责任交给调用者，说明这些能力面向框架内部。普通代码应通过 resize_、clone、to、copy_ 等 Tensor API，让 dtype、device、autograd version、dispatcher 与 allocator 协同更新。

调试实验若必须使用 `set_`，应在新建小 Tensor 上运行，记录原 Storage 容量，验证所有 view 的最大 offset，并与梯度图隔离。实验结束不要把低层句柄传回业务层。

#### 本章结论

低层 Storage 能力是一把手术刀；它绕过的恰好是高层 Tensor API 提供的安全联动。

### 设备所有权为什么属于 DataPtr 合同

kicker: "06 · DEVICE"

CPU 地址可被主机直接解引用，CUDA DataPtr 指向设备内存，必须由相应 stream/kernel 使用。`data_ptr()`在 Python 返回整数，并不赋予 CPU 读取权限。device 还决定 allocator、deleter 和异步释放时序。

CUDA caching allocator 释放 Tensor 后通常把块放回缓存，`memory_allocated`下降而 `memory_reserved`可能保持。Storage 生命周期结束与驱动立即归还显存是两个命题。诊断 OOM 要同时观察活跃 Storage、保留块、stream 事件和碎片。

pin_memory 创建页锁定 CPU Storage，配合 non_blocking 传输才能形成异步拷贝条件。一个布尔参数无法保证端到端重叠；还需确认源 Storage 在 DMA 完成前存活、目标 stream 依赖正确、后续同步点没有提前阻塞。

#### 本章结论

DataPtr 的 device 与 deleter 决定地址如何被使用和释放；裸整数地址没有跨设备可移植语义。

### 给零拷贝 API 写清借用和拥有合同

kicker: "07 · API OWNERSHIP"

返回 view 的 API 应写明结果是否可写、原输入必须存活多久、调用者能否缓存，以及后续原地操作怎样传播。只写“返回 Tensor”会把最重要的所有权事实藏进实现。

返回 clone 的 API 获得隔离，却要说明 device、dtype、memory_format 与梯度历史。`detach().clone()`得到独立数据且切断历史；`clone()`本身可微，backward 会把梯度传回输入。两个选择对应不同计算合同。

跨进程共享内存还需处理进程崩溃、句柄关闭、写同步与版本协议。Storage 能共享只提供机制，数据竞争与一致性仍由应用设计。最小验收应覆盖生产者提前释放、消费者重复关闭、并发读写和序列化往返。

#### 本章结论

“零拷贝”是性能描述，借用、可写性、生命周期和同步才构成完整 API 合同。

## 核心机制

- Storage 是引用计数句柄，StorageImpl 保存字节容量、DataPtr、allocator 与 resizable 状态。
- DataPtr 组合地址、device 与释放上下文，支持多种后端和外部内存。
- 多个 TensorImpl 可共享 StorageImpl，各自拥有 offset、shape 与 stride。
- Tensor.data_ptr 指当前首元素，Storage.data_ptr 指字节起点，二者不保证相等。
- 序列化按 Storage 去重并记录各 Tensor 元数据，从而保留别名关系。
- 最后一个 StorageImpl 引用释放后才执行 DataPtr deleter；allocator 仍可能缓存物理块。
- Storage 容量、Tensor 逻辑字节、地址跨度和唯一地址数具有不同工程意义。

## 常见误区

- 把 Storage 当作只有裸指针，漏掉 deleter、device、allocator 与容量。
- 以 `Tensor.data_ptr`不同断言没有别名。
- 把指针整数当成跨进程、跨生命周期稳定 identity。
- 保存小 slice 前不 clone，导致 checkpoint 携带整块大 Storage。
- 直接 resize/fill Storage，破坏现有 Tensor 的边界或 dtype 解释。
- 认为 Tensor 析构后 CUDA reserved memory 必然同步下降。
- 宣称 non_blocking 就一定异步，忽略 pinned source、stream 依赖和生命周期。

## 实现变体

### 共享 Storage 的借用视图

useWhen: "同一进程内短期消费、生命周期可证明、复制成本显著。"
tradeoff: "保留别名与序列化关系；缓存小片段会持有大容量，原地写与并发同步更复杂。"

### 紧凑 clone 后转交所有权

useWhen: "长期缓存、网络/磁盘持久化或调用者必须独立修改。"
tradeoff: "文件和生命周期可控；需要一次分配与复制，且要明确是否 detach 梯度历史。"

### 外部缓冲区 + 自定义 deleter

useWhen: "框架扩展需要与 NumPy、共享内存或设备运行时零拷贝互操作。"
tradeoff: "可消除中间复制；异常安全、异步完成、对齐、device 和释放顺序都由扩展作者承担。"

## 可运行示例

```python
import io
import torch


def storage_identity(tensor: torch.Tensor) -> tuple[str, int, int]:
    storage = tensor.untyped_storage()
    return (tensor.device.type, storage.data_ptr(), storage.nbytes())


base = torch.arange(8, dtype=torch.int64)
left = base[:4]
right = base[4:]
owned = left.clone()

assert storage_identity(left) == storage_identity(right)
assert left.data_ptr() != right.data_ptr()
assert storage_identity(owned) != storage_identity(left)

buffer = io.BytesIO()
torch.save({"left": left, "right": right}, buffer)
buffer.seek(0)
loaded = torch.load(buffer, weights_only=True)

assert storage_identity(loaded["left"]) == storage_identity(loaded["right"])
loaded["left"][0] = 99
assert loaded["right"][0].item() == 4

# 若只需要逻辑值，clone 会生成紧凑、独立的序列化单元。
compact = io.BytesIO()
torch.save({"left": left.clone()}, compact)
assert compact.getbuffer().nbytes > 0
```

## 搭积木复现

### 积木 1：观察 Storage 句柄

输出 device、Storage data_ptr、nbytes 与 Tensor data_ptr，覆盖 base、左右切片和 clone。

### 积木 2：证明 offset 差异

用 data_ptr 差除以 element_size，核对它等于两个 view 的 storage_offset 差。

### 积木 3：区分容量与逻辑大小

对大 Tensor 的小 slice 记录 Storage nbytes、logical bytes 与地址跨度。

### 积木 4：序列化别名组

保存两个不相交 view，加载后检查 Storage identity 保持，并验证写入只影响映射交集。

### 积木 5：比较紧凑 checkpoint

分别保存 slice 与 slice.clone，比较文件大小并解释别名语义为何不同。

### 积木 6：所有权失败测试

设计一个外部 buffer 包装器的 fake deleter，验证最后一个消费者释放前 deleter 不运行，重复关闭保持幂等。

### 积木 7：写 API 合同

为 borrow、own、share 三种返回策略写可写性、生命周期、梯度和并发条款。

## 自检

### 问题

服务从 4GB batch 中取 1KB slice 放进缓存，随后删除 batch；监控显示缓存逻辑大小只有 1KB，但显存不降。请给出 Storage 级根因证据、两种修复及其代价，并解释为何简单比较 `slice.data_ptr()`与其他 slice 的指针会误导。

### 站内答案

slice 作为 view 仍持有原 batch 的 StorageImpl，Storage.nbytes 约 4GB，而 `numel()*element_size()`只反映 1KB 逻辑值；删除 batch 名称不会让 Storage 引用归零。证据应记录 slice 的 `untyped_storage().nbytes()`、Storage data_ptr、storage_offset，并按 Storage identity 去重显存。修复一是在缓存边界 `slice.detach().clone()`，只保留紧凑独立值，代价是分配、复制和切断梯度；二是重构上游分块，让 batch 本来就由可独立释放的小 Storage 组成，代价是更多分配、调度和可能较差的连续访问。不同 slice 的 Tensor.data_ptr 因 offset 不同而不同，仍可能共享同一 Storage 起点，所以它不是独立所有权证据。
