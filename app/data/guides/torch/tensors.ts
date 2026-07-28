import type { TopicGuide } from '../../topic-guides'

export const torchTensorGuides: Record<string, TopicGuide> = {
  'Tensor 双层模型：TensorImpl 元数据如何解释同一块字节': {
    official: {
      title: 'PyTorch 2.13 · torch.Storage',
      url: 'https://docs.pytorch.org/docs/stable/storage.html#torch-storage',
      note: '官方把普通张量拆成连续一维字节 Storage，以及 dtype、shape、stride、offset 等解释元数据。多个 Tensor 可以共享同一 Storage；meta、FakeTensor 和部分子类则提醒我们，Tensor 合同并不等价于“必有一段普通数据内存”。'
    },
    source: {
      repo: 'pytorch/pytorch',
      file: 'c10/core/TensorImpl.h',
      symbol: 'TensorImpl',
      language: 'cpp',
      url: 'https://github.com/pytorch/pytorch/blob/v2.13.0/c10/core/TensorImpl.h#L440-L510',
      code: `// PyTorch v2.13.0 · c10/core/TensorImpl.h
// 保留真实类型、构造签名和核心字段语义；删去兼容态长注释。
struct C10_API TensorImpl : public c10::intrusive_ptr_target {
  TensorImpl() = delete;
  ~TensorImpl() override;

  // 普通 TensorImpl 可以接管一个 Storage，并记录 dispatch keys 与 dtype。
  TensorImpl(
      Storage&& storage,
      DispatchKeySet key_set,
      const caffe2::TypeMeta data_type);

  // view 专用构造仍持有 Storage；视图关系还会由 autograd 层补充。
  TensorImpl(
      ImplType,
      Storage&& storage,
      DispatchKeySet key_set,
      const caffe2::TypeMeta data_type);

  IntArrayRef sizes() const {
    return sizes_and_strides_.sizes_arrayref();
  }

  IntArrayRef strides() const {
    return sizes_and_strides_.strides_arrayref();
  }

  int64_t storage_offset() const {
    return storage_offset_;
  }

 private:
  Storage storage_;                       // 字节所有权与 DataPtr
  impl::SizesAndStrides sizes_and_strides_; // 当前解释的 shape/stride
  int64_t storage_offset_ = 0;            // 单位是元素，不是字节
  caffe2::TypeMeta data_type_;            // 决定元素宽度与标量类型
};`,
      walkthrough: [
        '`torch.Tensor` 的 Python 对象最终持有 C++ Tensor/TensorImpl；数值操作不会从 Python 列表重新解释，而会沿 dispatcher 进入后端 kernel。',
        '`storage_` 持有 StorageImpl，StorageImpl 再持有 DataPtr、字节数、allocator 与 device。多个 TensorImpl 可以引用同一个 StorageImpl。',
        '`sizes_and_strides_` 与 `storage_offset_` 属于当前 TensorImpl。两个别名即使共享 storage，也可以拥有不同 shape、stride 和起始元素。',
        '`data_type_` 把字节解释为元素。地址计算先用 offset/stride 得到元素序号，再乘 itemsize 得到字节偏移。',
        '真实类还保存 dispatch key、版本计数、autograd 与 Python 互操作元数据；本节删去这些分支，是为了先固定“存储层 + 解释层”的最小不变量。'
      ]
    },
    overview: [
      '很多初学者把 Tensor 想成“有 shape 的多维数组”。这个说法能写模型，却不足以解释 transpose 为什么几乎不花时间、切片为什么会改到原张量、reshape 为什么有时复制、有时零拷贝。更可靠的模型是两层：Storage 持有一维字节，TensorImpl 持有如何读取这些字节的元数据。数值来自两层共同作用。',
      '可以把 Storage 类比成一卷没有格子的胶片，Tensor 元数据是一张取景表。shape 规定逻辑坐标范围，stride 规定坐标每走一步跨多少个元素，storage_offset 规定从胶片哪一格起拍，dtype 规定每格有多少字节以及怎样解码。同一卷胶片换一张取景表，便得到 transpose、slice 或 view。',
      '这套模型也有边界。`device="meta"` 的 Tensor 可以携带 shape、dtype 和算子传播信息，却没有普通数据；sparse layout 用索引和值描述稀疏结构；Tensor subclass 还可能自定义语义。因此本课讨论的是最常见的 strided Tensor 表示，并把“不一定有普通 Storage”作为后续编译与扩展课程的防错栏。'
    ],
    chapters: [
      {
        kicker: '01 · TWO LAYERS',
        title: '一个 Tensor 值为什么需要两层对象',
        paragraphs: [
          '若每个逻辑 Tensor 都独占并按 shape 排列一段内存，转置 10GB 矩阵就要搬动 10GB 数据。PyTorch 允许转置只交换 size 与 stride；新 TensorImpl 继续指向旧 Storage，创建成本只与维数有关。真正需要连续布局的后续算子再决定是否物化。',
          'Storage 只负责字节与所有权，无法单独回答 `x[1, 2]` 的值。TensorImpl 仅有 shape 也不够，因为同样的 `(2, 3)` 可以按行主序、转置视图或带间隔切片映射到不同地址。必须把 storage、dtype、offset、sizes、strides 放进同一地址公式。',
          'Python 变量 `x` 只是绑定 Tensor 对象。`y = x` 共享同一个 Tensor 对象；`y = x.view(...)` 创建另一个 Tensor 解释同一 Storage；`y = x.clone()` 创建新 Storage。对象同一、Storage 同一和值相等是三种不同关系。'
        ],
        code: `import torch

x = torch.arange(12).reshape(3, 4)
same_object = x
view_object = x[:, 1:3]
copy_object = x.clone()

assert same_object is x
assert view_object is not x
assert view_object.untyped_storage().data_ptr() == x.untyped_storage().data_ptr()
assert copy_object.untyped_storage().data_ptr() != x.untyped_storage().data_ptr()`,
        language: 'python',
        takeaway: '先问 Python 对象是否相同，再问 Storage 是否共享，最后问逻辑值是否相等；三问不能互相替代。'
      },
      {
        kicker: '02 · ADDRESS',
        title: '从逻辑索引推到真实字节地址',
        paragraphs: [
          '对 strided Tensor，逻辑索引 `(i0, i1, …)` 对应的元素位置是 `storage_offset + Σ(ik × stride[k])`。这个结果的单位是元素，再乘 `dtype.itemsize` 并加到 Storage 起始地址，才是字节地址。`Tensor.data_ptr()`通常指当前 Tensor 第一个逻辑元素，`untyped_storage().data_ptr()`指 Storage 起点，所以带 offset 的切片二者可以不同。',
          '例如连续 `(3,4)` 张量 stride 为 `(4,1)`，索引 `(2,1)` 映射到 `0+2×4+1×1=9`。若取 `x[:,1:3]`，shape 变 `(3,2)`，stride 仍 `(4,1)`，offset 变 1；逻辑 `(2,1)` 映射为 `1+8+1=10`。视图没有移动字节，只更换了合法坐标集合。',
          '地址公式还能暴露非法想象：numel 是逻辑元素数量，并不保证这些元素在 Storage 中覆盖一段长度恰为 numel 的连续区间。步长切片可能跨过洞，expand 甚至让不同索引映射同一地址。读取范围、唯一地址数与逻辑元素数要分开计算。'
        ],
        code: `def element_offset(tensor, index):
    return tensor.storage_offset() + sum(
        coordinate * stride
        for coordinate, stride in zip(index, tensor.stride())
    )

base = torch.arange(12).reshape(3, 4)
part = base[:, 1:3]
assert element_offset(base, (2, 1)) == 9
assert element_offset(part, (2, 1)) == 10
assert part[2, 1].item() == 10`,
        language: 'python',
        takeaway: 'shape 描述坐标域，stride 与 offset 描述坐标到 Storage 的映射；numel 只统计坐标，不统计物理跨度。'
      },
      {
        kicker: '03 · ALIAS',
        title: '共享 Storage 会产生哪些可观察行为',
        paragraphs: [
          '两个 Tensor 共享 Storage 时，一方原地写入的字节会被另一方按自己的元数据重新读取。若两者映射区域不相交，例如同一数组的左右半段，写入不会立刻改变另一半的值，但它们仍共享同一所有权对象；只比较首元素 `data_ptr` 会把这种关系误判为独立。',
          'PyTorch 的 autograd 还要跟踪 view 关系与版本计数。需要梯度的叶子及其 view 上不允许某些原地操作，因为 backward 保存的值可能已被改写。Storage 共享是内存事实，autograd view metadata 是求导合同；两者相关，却不能用 `_base` 是否存在来取代 Storage 证据。',
          '跨库共享同样遵循所有权合同。`torch.from_numpy` 通常与 NumPy 数组共享 CPU 内存，`torch.tensor(array)`通常复制。外部数组若只读、生命周期不足或 stride 为负，转换能力会不同。工程 API 应明确返回借用视图还是拥有副本，并用测试锁定。'
        ],
        takeaway: '别名会传播写入和生命周期，却不保证两个 Tensor 的 data_ptr、shape、stride 或 autograd 身份相同。'
      },
      {
        kicker: '04 · LIFETIME',
        title: '为什么删除 base 后 view 仍能读取',
        paragraphs: [
          'TensorImpl 与 StorageImpl 使用引用计数管理。view 持有共享 Storage，也可能在 autograd 关系中保存 base 信息。删除 Python 名称只会减少相应对象引用；只要 view 仍可达，StorageImpl 的引用计数就不会归零，DataPtr 所拥有的内存也不会释放。',
          '这解释了一个常见显存问题：从巨大 batch 中取很小 slice 并长期缓存，slice 的逻辑 nbytes 很小，却可能让整个 Storage 保持存活。监控只累加 `tensor.numel()*itemsize` 会低估保留内存；需要结合 Storage 大小、别名组与 allocator 指标。',
          '需要独立生命周期时使用 `clone()`，必要时再 `detach()`决定梯度历史。复制有真实带宽和显存成本，所以不应把每个 view 都防御性 clone；应在缓存、跨线程所有权、外部可变输入和长期持有边界处做明确选择。'
        ],
        code: `import gc

large = torch.arange(1_000_000, dtype=torch.float32)
tiny = large[:1]
storage_bytes = tiny.untyped_storage().nbytes()
logical_bytes = tiny.numel() * tiny.element_size()

del large
gc.collect()
assert tiny.item() == 0
assert storage_bytes > logical_bytes`,
        language: 'python',
        takeaway: 'view 的逻辑大小不能代表其保留的 Storage 大小；生命周期审计要沿 Storage 所有权看。'
      },
      {
        kicker: '05 · MUTATION',
        title: '元数据修改与数据修改是两类动作',
        paragraphs: [
          '写 `x.add_(1)` 修改 Storage 中的元素；写 `transpose_` 或底层 `set_` 可能修改 TensorImpl 的解释元数据。普通 `transpose` 则创建新 TensorImpl，保留原对象的解释。调试时只看值差异，容易漏掉 shape/stride/offset 已变化的元数据动作。',
          'PyTorch 对某些 view 禁止元数据原地修改，内部也用 `allow_tensor_metadata_change` 防止借出的元数据被悄悄重写。源码中的 `set_sizes_and_strides` 明确要求调用者保证 Storage 边界，说明底层构造函数提供能力，并不替上层业务承担安全。',
          ' `.data` 绕开一部分 autograd 约束会制造难以证明的梯度错误。教学实验可以用 `set_` 或 `as_strided`观察表示，但模型代码应优先使用公开 view、copy 与 in-place API，让 dispatcher、autograd 和 functionalization 看见变化。'
        ],
        takeaway: '数据字节与解释元数据各有 mutation；正确性工具能否观察到动作，比语法上是否带下划线更重要。'
      },
      {
        kicker: '06 · NON-STANDARD',
        title: 'meta、sparse 与 subclass 如何修正直觉',
        paragraphs: [
          '`meta` Tensor 保存 shape、dtype、layout 等抽象信息，可以执行许多只需推导输出元数据的算子，但读取数值或拷回 CPU 会失败。编译器用它在不分配真实模型权重的情况下做 shape propagation。它证明 Tensor 的程序合同可以先于数据存在。',
          'sparse COO 张量用 indices 与 values 表达非零项，layout 不是 `torch.strided`，普通 stride 地址公式不直接适用。某些 API 在 sparse、XLA、lazy 或 Tensor subclass 上会走专门分支。看到 `Tensor` 类型不能自动假设 `untyped_storage` 和标准 stride 可用。',
          '因此生产检查应先声明支持范围。例如自定义 kernel 只接受 dense strided CPU/CUDA，可显式检查 layout、device、dtype 与 contiguity；若希望支持 subclass，应通过 dispatcher 注册语义，避免直接读取内部指针。'
        ],
        takeaway: '双层模型是 dense strided Tensor 的核心基线；layout 与 dispatch key 决定它何时需要扩展。'
      },
      {
        kicker: '07 · DEBUG CONTRACT',
        title: '建立一份能证伪的 Tensor 描述',
        paragraphs: [
          '调试函数应同时打印 shape、stride、storage_offset、dtype、device、layout、is_contiguous、Tensor data_ptr 与 Storage data_ptr。再加 `_base` 只能作为 autograd view 提示，不能作为唯一别名判据。两个零元素 Tensor 的指针也可能为 0，指针相等并不总能证明共享。',
          '别名测试最好加入写入探针：选一个确定落在交集区域的元素，保存原值，原地修改 view，检查 base 的对应坐标，再恢复。对于需要梯度或生产数据，不要做破坏性探针，可改用 `torch._C._is_alias_of` 等内部诊断，但内部 API 不应进入稳定业务合同。',
          '最后记录预期：该操作必须零拷贝、允许复制，还是禁止别名。`reshape` 官方明确不保证返回 view；若业务依赖零拷贝，应使用 `view`并接受不兼容时报错，或显式验证 Storage 指针和性能指标。'
        ],
        takeaway: '可复现的描述器把“看起来像 view”变成 shape、stride、offset、指针与写入传播五条证据。'
      }
    ],
    mechanisms: [
      '普通 strided Tensor 由 Storage 字节所有权与 TensorImpl 解释元数据共同定义。',
      '逻辑元素地址为 storage_offset 与各维索引乘 stride 的和，再乘 dtype.itemsize。',
      'view 创建新的解释对象并共享 Storage；clone 创建新 Storage；普通赋值只共享 Python 对象。',
      'StorageImpl 的引用计数让任一别名存活时底层内存继续存活。',
      'shape/stride/offset 是视图特有元数据，多个 TensorImpl 可对同一字节给出不同坐标系。',
      'autograd view/version metadata 追踪求导正确性，不能与内存别名事实混为一个概念。',
      'meta、sparse 和 subclass 表明 Tensor 合同不必拥有普通 dense Storage。'
    ],
    pitfalls: [
      '只比较 `Tensor.data_ptr()`判断是否共享 Storage，忽略不同 storage_offset 会得到不同首元素指针。',
      '把 `numel()*element_size()`当作 view 保留内存，漏算它引用的大 Storage。',
      '认为 shape 决定物理排列，忽略 stride 与 offset 才决定地址映射。',
      '用 `_base is not None` 作为所有别名关系的完整判据。',
      '删除 base 名称后期待 view 的内存立即释放。',
      '用 `.data` 或底层 `set_` 绕开 autograd 和边界检查。',
      '把 dense strided 结论无条件套到 sparse、meta、XLA 或 Tensor subclass。'
    ],
    variants: [
      {
        title: '借用 view',
        useWhen: '调用链短、所有权清楚、需要零拷贝，并且调用者接受原地写会传播。',
        tradeoff: '创建快且省带宽；会延长整个 Storage 生命周期，并让写入与 autograd 约束跨 API 边界传播。',
        code: `def borrow_columns(x: torch.Tensor) -> torch.Tensor:
    return x[:, :2]`
      },
      {
        title: '拥有 clone',
        useWhen: '结果会长期缓存、跨并发边界传递，或必须与调用者后续 mutation 隔离。',
        tradeoff: '所有权最清楚；付出真实内存分配和复制带宽，梯度历史是否保留还要结合 detach 选择。',
        code: `def own_columns(x: torch.Tensor) -> torch.Tensor:
    return x[:, :2].clone()`
      },
      {
        title: '只携带 meta 合同',
        useWhen: '编译、模型装载规划或 shape 推导阶段只需输出属性，不需要真实数值。',
        tradeoff: '避免大规模分配；数据依赖算子无法执行，后端元数据差异仍需真机验证。'
      }
    ],
    studyPlan: { readingMinutes: 40, sourceMinutes: 30, practiceMinutes: 55, reviewMinutes: 15 },
    exampleLanguage: 'python',
    example: `import torch


def describe(tensor: torch.Tensor) -> dict[str, object]:
    return {
        "shape": tuple(tensor.shape),
        "stride": tensor.stride(),
        "offset": tensor.storage_offset(),
        "dtype": tensor.dtype,
        "device": tensor.device.type,
        "layout": tensor.layout,
        "storage_ptr": tensor.untyped_storage().data_ptr(),
        "data_ptr": tensor.data_ptr(),
        "storage_bytes": tensor.untyped_storage().nbytes(),
        "logical_bytes": tensor.numel() * tensor.element_size(),
    }


base = torch.arange(12, dtype=torch.float32).reshape(3, 4)
view = base[:, 1:3]
copy = view.clone()

base_info = describe(base)
view_info = describe(view)
copy_info = describe(copy)

assert base_info["storage_ptr"] == view_info["storage_ptr"]
assert base_info["data_ptr"] != view_info["data_ptr"]
assert view_info["offset"] == 1
assert copy_info["storage_ptr"] != view_info["storage_ptr"]

view[0, 0] = -7
assert base[0, 1].item() == -7
assert copy[0, 0].item() == 1

meta = torch.empty((3, 4), device="meta")
assert tuple(meta.shape) == (3, 4)
assert meta.numel() == 12`,
    buildSteps: [
      { title: '积木 1：实现 Tensor 描述器', body: '收集 shape、stride、offset、dtype、device、layout、两个 data_ptr、Storage bytes 与 logical bytes，并让输出可做断言。' },
      { title: '积木 2：区分三种同一关系', body: '分别构造普通赋值、slice view 与 clone，验证对象 identity、Storage identity 和值相等不能互推。' },
      { title: '积木 3：手算地址', body: '实现元素 offset 公式，覆盖连续矩阵与带非零 storage_offset 的列切片。' },
      { title: '积木 4：验证写传播', body: '修改 view 的交集元素，检查 base 变化且 clone 不变；恢复原值，避免测试污染。' },
      { title: '积木 5：测量保留内存', body: '从大 Tensor 取一个元素，删除 base 后比较 logical bytes 与 Storage bytes，解释为何 view 仍可读取。' },
      { title: '积木 6：加入 meta 反例', body: '在 meta device 创建同 shape Tensor，证明元数据运算可执行而取值/迁移需要真实数据。' }
    ],
    selfCheckQuestion: '`base = torch.arange(1000)`，`a = base[:10]`，`b = base[10:20]`，`c = a.clone()`。为什么 `a.data_ptr() != b.data_ptr()` 仍不能说明二者内存独立？删除 base 后谁让原 Storage 存活？怎样同时证明 c 与 a 值相等但所有权独立？',
    selfCheckAnswer: '`a` 与 `b` 的 Tensor.data_ptr 指向各自第一个逻辑元素，因为 storage_offset 分别为 0 和 10，所以地址不同；二者的 `untyped_storage().data_ptr()`相同，说明仍引用同一 StorageImpl。删除 base 只减少 base TensorImpl 的引用，a 和 b 各自持有共享 Storage，任一存活都会让 StorageImpl/DataPtr 继续存在。c 通过 clone 分配新 Storage；先用 `torch.equal(c, a)`证明逻辑值相等，再断言二者 `untyped_storage().data_ptr()`不同，并修改 a 后确认 c 不变，便同时建立值与所有权两条证据。'
  },
  'UntypedStorage、DataPtr 与别名生命周期：共享、所有权和序列化': {
    official: {
      title: 'PyTorch 2.13 · Untyped Storage API',
      url: 'https://docs.pytorch.org/docs/stable/storage.html#untyped-storage-api',
      note: '官方将 UntypedStorage 定义为连续的一维字节数组，说明多个 Tensor 可共享 Storage，序列化会保留共享关系，并明确警告 Tensor.data_ptr 与 UntypedStorage.data_ptr 不保证相等；直接修改 Storage 只适合底层教育与框架实现。'
    },
    source: {
      repo: 'pytorch/pytorch',
      file: 'c10/core/Storage.h',
      symbol: 'c10::Storage',
      language: 'cpp',
      url: 'https://github.com/pytorch/pytorch/blob/v2.13.0/c10/core/Storage.h#L25-L115',
      code: `// PyTorch v2.13.0 · c10/core/Storage.h
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
};`,
      walkthrough: [
        '`Storage` 本身是一个轻量句柄，真正的字节数、DataPtr、allocator、device 与 resizable 状态位于引用计数的 StorageImpl。',
        '第一组构造函数让 allocator 创建字节缓冲区；第二组接管现有 DataPtr，所以 Storage 也能包装外部、共享内存或文件映射资源。',
        '`DataPtr` 不只是裸地址，还携带 device 与 deleter 上下文；最后一个 StorageImpl 引用释放时，deleter 才决定怎样归还资源。',
        '`nbytes` 是 Storage 容量，和任一 view 的 `numel()*element_size()`不同；一个微小 view 可以持有大容量 Storage。',
        '源码支持 resizable 与 legacy 状态，但普通模型代码不应自行 resize Storage；上层 Tensor API 才能同步维护边界、版本和分派不变量。'
      ]
    },
    overview: [
      '上一课把 Storage 当作字节层，本课继续追问“谁拥有这些字节、何时释放、怎样跨进程或文件保存”。如果只把 Storage 理解成 `void*`，就无法解释 CUDA allocator、memory mapping、from_blob 的自定义 deleter，也无法安全设计跨库零拷贝。',
      'UntypedStorage 的“untyped”表示它按字节管理容量，元素 dtype 属于 Tensor 的解释。官方仍保留 TypedStorage 兼容层，但它已弃用；新代码应从 `tensor.untyped_storage()`观察底层。直接对 Storage `fill_` 或 `set_` 会绕过高层安全合同，只能在受控实验中使用。',
      '别名的生命周期由 StorageImpl 引用计数收敛。Tensor view、序列化恢复对象、共享内存句柄都可能引用同一 Storage。数据复制、句柄复制和所有权转移必须分开命名，否则 API 的“零拷贝”承诺会在异常、缓存和异步执行下变成悬空地址或意外保留。'
    ],
    chapters: [
      {
        kicker: '01 · HANDLE',
        title: 'Storage、StorageImpl 与 DataPtr 各负责什么',
        paragraphs: [
          '`c10::Storage` 是值语义句柄，内部只有 intrusive_ptr；复制句柄增加 StorageImpl 引用。StorageImpl 保存容量、DataPtr、allocator 与是否可 resize。DataPtr 再封装数据地址、device 和释放上下文，作用类似带自定义 deleter 的 unique_ptr。',
          '三层拆分让 TensorImpl 可以廉价共享 Storage，同时让 CPU malloc、CUDA caching allocator、外部缓冲区和文件映射使用不同释放策略。裸地址相同只说明某一时刻指向同处，无法说明 deleter、容量和所有权对象相同。',
          '框架扩展若接管外部内存，必须定义谁最后释放、异步 kernel 何时结束、原生产者能否重分配。把 NumPy 地址塞进 Tensor 后立刻让数组析构，是典型生命周期错误；正确桥接应持有原对象或提供与真实所有权一致的 deleter。'
        ],
        takeaway: '地址回答“在哪”，StorageImpl 回答“多大与谁持有”，DataPtr 回答“在哪个设备、最后怎样释放”。'
      },
      {
        kicker: '02 · POINTERS',
        title: '为什么两个 data_ptr API 不能互换',
        paragraphs: [
          '`UntypedStorage.data_ptr()`返回 Storage 字节起点。`Tensor.data_ptr()`返回当前 Tensor 第一个逻辑元素；对普通正 stride view，它等于 Storage 起点加 `storage_offset*element_size`。切掉前几个元素后两者自然不同。',
          '更复杂的 Tensor 后端、空 Tensor 或没有典型 Storage 的对象会让朴素等式继续失效。官方因此明确写出二者不保证相等。诊断共享 Storage 时优先比较 `untyped_storage().data_ptr()`与容量，再结合设备；诊断当前首元素地址时才用 Tensor.data_ptr。',
          '即使 Storage 起点相同，也要警惕 allocator 复用：两个不同生命周期对象可能先后拿到同一地址。指针只适合单次运行内的辅助证据，不能当持久 identity、缓存 key 或跨进程协议。'
        ],
        code: `base = torch.arange(8, dtype=torch.int64)
right = base[4:]

assert base.untyped_storage().data_ptr() == right.untyped_storage().data_ptr()
assert base.data_ptr() != right.data_ptr()
assert right.data_ptr() - base.data_ptr() == 4 * base.element_size()`,
        language: 'python',
        takeaway: 'Storage 指针标识共享字节起点，Tensor 指针标识当前解释的首元素；带 offset 时不同才是正确结果。'
      },
      {
        kicker: '03 · CAPACITY',
        title: '容量、逻辑字节与可访问跨度',
        paragraphs: [
          'Storage.nbytes 是已拥有缓冲区容量。Tensor 的逻辑字节通常写成 `numel*element_size`，但非连续 view 的最大地址跨度可能更大，expand 的唯一地址数又可能更小。三项指标分别服务分配、算术工作量和地址安全。',
          '边界检查需要计算所有合法索引映射的最小/最大元素 offset，并确保落在 Storage 容量内。公开 `as_strided` 会做越界检查，却允许内部重叠；重叠 view 的向量化原地写行为没有定义。Storage 容量充足并不等于写入没有冲突。',
          '显存审计应按唯一 Storage 去重，不能把每个 view 的容量相加；带宽估算则按算子真实读写元素和缓存行为计算。把一套数字同时用于容量、传输量与活跃值大小，会得出相互矛盾的结论。'
        ],
        takeaway: 'Storage bytes、logical bytes、address span 与 unique addresses 是四个问题，性能和安全分析必须选对指标。'
      },
      {
        kicker: '04 · SERIALIZATION',
        title: 'torch.save 为什么要保留共享关系',
        paragraphs: [
          '若两个 view 共享一块大 Storage，简单地逐 Tensor 写值会重复数据并丢失别名关系。PyTorch 序列化会把 Storage 作为独立记录，再让多个 Tensor 记录各自 offset、size、stride，加载后继续共享。这既节省文件与加载成本，也保留原地修改的语义。',
          '这种保真也可能保存过大的 Storage：只保存大 Tensor 的一个小 slice，文件仍可能携带整个底层缓冲区。若业务只想保存逻辑值，应先 `clone()`得到紧凑独立 Storage，再保存；代价是显式复制与别名断开。',
          '`torch.load(weights_only=True)`降低反序列化任意对象的攻击面，但权重文件仍应来自可信来源并校验完整性。`map_location`按 Storage 重映射设备，说明加载过程的迁移单位正是 Storage，而不只是逻辑 Tensor。'
        ],
        code: `import io

base = torch.arange(1000)
tiny = base[:2]
buffer = io.BytesIO()
torch.save({"tiny": tiny}, buffer)

compact = io.BytesIO()
torch.save({"tiny": tiny.clone()}, compact)
assert compact.getbuffer().nbytes < buffer.getbuffer().nbytes`,
        language: 'python',
        takeaway: '序列化默认保护别名语义；若目标是紧凑独立值，调用方要主动 clone 并承认所有权变化。'
      },
      {
        kicker: '05 · RESIZE',
        title: '为什么 Storage 低层修改风险很高',
        paragraphs: [
          'Storage API 可以改容量、替换 DataPtr 或填充字节，但现有 Tensor view 仍保存旧 size、stride 与 offset。若底层缓冲区缩小，某个 Tensor 的合法坐标可能立即越界；若按字节填充浮点 Storage，结果取决于位模式而非数值语义。',
          'TensorImpl 的元数据 setter 也把边界责任交给调用者，说明这些能力面向框架内部。普通代码应通过 resize_、clone、to、copy_ 等 Tensor API，让 dtype、device、autograd version、dispatcher 与 allocator 协同更新。',
          '调试实验若必须使用 `set_`，应在新建小 Tensor 上运行，记录原 Storage 容量，验证所有 view 的最大 offset，并与梯度图隔离。实验结束不要把低层句柄传回业务层。'
        ],
        takeaway: '低层 Storage 能力是一把手术刀；它绕过的恰好是高层 Tensor API 提供的安全联动。'
      },
      {
        kicker: '06 · DEVICE',
        title: '设备所有权为什么属于 DataPtr 合同',
        paragraphs: [
          'CPU 地址可被主机直接解引用，CUDA DataPtr 指向设备内存，必须由相应 stream/kernel 使用。`data_ptr()`在 Python 返回整数，并不赋予 CPU 读取权限。device 还决定 allocator、deleter 和异步释放时序。',
          'CUDA caching allocator 释放 Tensor 后通常把块放回缓存，`memory_allocated`下降而 `memory_reserved`可能保持。Storage 生命周期结束与驱动立即归还显存是两个命题。诊断 OOM 要同时观察活跃 Storage、保留块、stream 事件和碎片。',
          'pin_memory 创建页锁定 CPU Storage，配合 non_blocking 传输才能形成异步拷贝条件。一个布尔参数无法保证端到端重叠；还需确认源 Storage 在 DMA 完成前存活、目标 stream 依赖正确、后续同步点没有提前阻塞。'
        ],
        takeaway: 'DataPtr 的 device 与 deleter 决定地址如何被使用和释放；裸整数地址没有跨设备可移植语义。'
      },
      {
        kicker: '07 · API OWNERSHIP',
        title: '给零拷贝 API 写清借用和拥有合同',
        paragraphs: [
          '返回 view 的 API 应写明结果是否可写、原输入必须存活多久、调用者能否缓存，以及后续原地操作怎样传播。只写“返回 Tensor”会把最重要的所有权事实藏进实现。',
          '返回 clone 的 API 获得隔离，却要说明 device、dtype、memory_format 与梯度历史。`detach().clone()`得到独立数据且切断历史；`clone()`本身可微，backward 会把梯度传回输入。两个选择对应不同计算合同。',
          '跨进程共享内存还需处理进程崩溃、句柄关闭、写同步与版本协议。Storage 能共享只提供机制，数据竞争与一致性仍由应用设计。最小验收应覆盖生产者提前释放、消费者重复关闭、并发读写和序列化往返。'
        ],
        takeaway: '“零拷贝”是性能描述，借用、可写性、生命周期和同步才构成完整 API 合同。'
      }
    ],
    mechanisms: [
      'Storage 是引用计数句柄，StorageImpl 保存字节容量、DataPtr、allocator 与 resizable 状态。',
      'DataPtr 组合地址、device 与释放上下文，支持多种后端和外部内存。',
      '多个 TensorImpl 可共享 StorageImpl，各自拥有 offset、shape 与 stride。',
      'Tensor.data_ptr 指当前首元素，Storage.data_ptr 指字节起点，二者不保证相等。',
      '序列化按 Storage 去重并记录各 Tensor 元数据，从而保留别名关系。',
      '最后一个 StorageImpl 引用释放后才执行 DataPtr deleter；allocator 仍可能缓存物理块。',
      'Storage 容量、Tensor 逻辑字节、地址跨度和唯一地址数具有不同工程意义。'
    ],
    pitfalls: [
      '把 Storage 当作只有裸指针，漏掉 deleter、device、allocator 与容量。',
      '以 `Tensor.data_ptr`不同断言没有别名。',
      '把指针整数当成跨进程、跨生命周期稳定 identity。',
      '保存小 slice 前不 clone，导致 checkpoint 携带整块大 Storage。',
      '直接 resize/fill Storage，破坏现有 Tensor 的边界或 dtype 解释。',
      '认为 Tensor 析构后 CUDA reserved memory 必然同步下降。',
      '宣称 non_blocking 就一定异步，忽略 pinned source、stream 依赖和生命周期。'
    ],
    variants: [
      {
        title: '共享 Storage 的借用视图',
        useWhen: '同一进程内短期消费、生命周期可证明、复制成本显著。',
        tradeoff: '保留别名与序列化关系；缓存小片段会持有大容量，原地写与并发同步更复杂。'
      },
      {
        title: '紧凑 clone 后转交所有权',
        useWhen: '长期缓存、网络/磁盘持久化或调用者必须独立修改。',
        tradeoff: '文件和生命周期可控；需要一次分配与复制，且要明确是否 detach 梯度历史。'
      },
      {
        title: '外部缓冲区 + 自定义 deleter',
        useWhen: '框架扩展需要与 NumPy、共享内存或设备运行时零拷贝互操作。',
        tradeoff: '可消除中间复制；异常安全、异步完成、对齐、device 和释放顺序都由扩展作者承担。'
      }
    ],
    studyPlan: { readingMinutes: 40, sourceMinutes: 35, practiceMinutes: 75, reviewMinutes: 20 },
    exampleLanguage: 'python',
    example: `import io
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
assert compact.getbuffer().nbytes > 0`,
    buildSteps: [
      { title: '积木 1：观察 Storage 句柄', body: '输出 device、Storage data_ptr、nbytes 与 Tensor data_ptr，覆盖 base、左右切片和 clone。' },
      { title: '积木 2：证明 offset 差异', body: '用 data_ptr 差除以 element_size，核对它等于两个 view 的 storage_offset 差。' },
      { title: '积木 3：区分容量与逻辑大小', body: '对大 Tensor 的小 slice 记录 Storage nbytes、logical bytes 与地址跨度。' },
      { title: '积木 4：序列化别名组', body: '保存两个不相交 view，加载后检查 Storage identity 保持，并验证写入只影响映射交集。' },
      { title: '积木 5：比较紧凑 checkpoint', body: '分别保存 slice 与 slice.clone，比较文件大小并解释别名语义为何不同。' },
      { title: '积木 6：所有权失败测试', body: '设计一个外部 buffer 包装器的 fake deleter，验证最后一个消费者释放前 deleter 不运行，重复关闭保持幂等。' },
      { title: '积木 7：写 API 合同', body: '为 borrow、own、share 三种返回策略写可写性、生命周期、梯度和并发条款。' }
    ],
    selfCheckQuestion: '服务从 4GB batch 中取 1KB slice 放进缓存，随后删除 batch；监控显示缓存逻辑大小只有 1KB，但显存不降。请给出 Storage 级根因证据、两种修复及其代价，并解释为何简单比较 `slice.data_ptr()`与其他 slice 的指针会误导。',
    selfCheckAnswer: 'slice 作为 view 仍持有原 batch 的 StorageImpl，Storage.nbytes 约 4GB，而 `numel()*element_size()`只反映 1KB 逻辑值；删除 batch 名称不会让 Storage 引用归零。证据应记录 slice 的 `untyped_storage().nbytes()`、Storage data_ptr、storage_offset，并按 Storage identity 去重显存。修复一是在缓存边界 `slice.detach().clone()`，只保留紧凑独立值，代价是分配、复制和切断梯度；二是重构上游分块，让 batch 本来就由可独立释放的小 Storage 组成，代价是更多分配、调度和可能较差的连续访问。不同 slice 的 Tensor.data_ptr 因 offset 不同而不同，仍可能共享同一 Storage 起点，所以它不是独立所有权证据。'
  },
  'shape、numel、dtype、device 与 layout：张量合同的正交坐标': {
    official: {
      title: 'PyTorch 2.13 · Tensor Attributes',
      url: 'https://docs.pytorch.org/docs/stable/tensor_attributes.html#tensor-attributes',
      note: '官方分别定义 dtype、device 与 layout，并说明 strided Tensor 是 Storage 的多维带步长视图。属性组合决定可表示值、内存位置和布局类别；layout API 仍含 beta 部分，后端支持范围必须按算子核验。'
    },
    source: {
      repo: 'pytorch/pytorch',
      file: 'c10/core/TensorImpl.h',
      symbol: 'TensorImpl attribute accessors',
      language: 'cpp',
      url: 'https://github.com/pytorch/pytorch/blob/v2.13.0/c10/core/TensorImpl.h#L684-L710',
      code: `// PyTorch v2.13.0 · c10/core/TensorImpl.h
// 从真实类中选取属性访问器；顺序按教学合同重排。
int64_t numel() const {
  if (C10_UNLIKELY(matches_policy(SizesStridesPolicy::CustomSizes))) {
    return numel_custom();
  }
  return numel_;
}

IntArrayRef sizes() const {
  if (C10_UNLIKELY(matches_policy(SizesStridesPolicy::CustomSizes))) {
    return sizes_custom();
  }
  return sizes_and_strides_.sizes_arrayref();
}

const caffe2::TypeMeta dtype() const {
  return data_type_;
}

Device device() const {
  if (C10_UNLIKELY(device_policy_)) {
    return device_custom();
  }
  return device_opt_.value();
}

Layout layout() const {
  if (C10_UNLIKELY(layout_policy_)) {
    return layout_custom();
  }
  return key_set_.has(DispatchKey::Sparse)
      ? Layout::Sparse
      : Layout::Strided;
}

size_t itemsize() const {
  TORCH_CHECK(dtype_initialized(), "dtype is not initialized");
  return data_type_.itemsize();
}`,
      walkthrough: [
        '`sizes()`返回各逻辑维长度，`numel_`通常缓存其乘积；自定义 sizes policy 允许 Tensor subclass 覆写这一行为。',
        '`dtype()`返回 TypeMeta，itemsize 将元素 offset 转成字节 offset，也决定许多算子的数值范围与 kernel。',
        '`device()`通常来自 TensorImpl 的 device_opt；自定义 device policy 说明后端对象不必完全遵守普通字段布局。',
        '`layout()`会结合 dispatch key 判断 strided/sparse 等类别，layout 进而决定 stride、storage 与算子是否有意义。',
        '这些 accessor 看似只读属性，实际也是 dispatcher、autograd、compiler guard 与序列化合同的输入；修改任一项常意味着真实转换。'
      ]
    },
    overview: [
      'shape、numel、dtype、device、layout 常被并排打印，于是容易被当成一组“描述信息”。它们分别回答五个问题：坐标域多大、逻辑元素多少、每个元素怎样编码、数据/计算位于何处、整体用哪类结构组织。将它们当作正交坐标，可以更准确判断某个转换是否只改元数据、是否复制、是否支持。',
      '例如 `(2,3)` float32 CPU strided Tensor 与同 shape 的 int64 CUDA Tensor 有相同坐标域和 numel，却在元素宽度、数值语义、地址空间和 kernel 上完全不同。同 shape 的 sparse COO Tensor 甚至不用普通 stride 表达全部值。shape 相同只足以讨论某些代数兼容，远不足以说明可交换。',
      '本课把这些属性组成可执行合同：输入检查不只写“Tensor”；要明确允许的 rank/shape、dtype 集、device 同置规则、layout 与是否需要真实数据。这样错误能在算子入口暴露，编译器 guard、测试矩阵和部署能力也有共同语言。'
    ],
    chapters: [
      {
        kicker: '01 · SHAPE',
        title: 'shape 描述坐标域，不描述内存顺序',
        paragraphs: [
          '`torch.Size([B,T,D])`给出每一维的合法坐标范围，并赋予维度业务语义。相同数字 `(2,3)` 可以表示样本×特征，也可以表示行×列；程序若只靠位置猜语义，在 transpose、batching 和导出后容易静默出错。',
          '零维 Tensor 的 shape 是 `[]`且 numel 为 1，它表示标量；含零长度维度的 `(2,0,3)` numel 为 0。两者都可能没有可读取元素，却在广播、输出 shape 和梯度上不同。`len(tensor)`对零维报错，也不能替代 rank/shape 检查。',
          '动态 shape 场景中某些维度是 SymInt，源码会避免过早把它强制成普通整数。业务代码把 `int(x.shape[0])`写入 Python 分支可能制造 graph break 或过度 guard；应尽量把 shape 约束表达为张量/导出合同。'
        ],
        takeaway: 'shape 是逻辑坐标和业务轴的合同；stride 决定内存顺序，命名和断言决定业务语义。'
      },
      {
        kicker: '02 · NUMEL',
        title: 'numel 是乘积缓存，不是内存容量',
        paragraphs: [
          '对普通 dense Tensor，numel 是 sizes 的乘积，标量为 1，任一维为 0 时为 0。TensorImpl 缓存 numel，修改 size 后必须刷新它；源码专门维护这一不变量，避免每次查询都重复乘法。',
          'numel 统计逻辑元素。expand 可以让百万个逻辑坐标重复映射到一个地址；带洞切片的地址跨度可以大于 numel；sparse Tensor 的 numel 仍表示完整稠密坐标域，而实际存储非零数量用 `_nnz()`观察。',
          '计算 FLOPs 或激活量时 numel 很有用，估算 Storage 容量、真实带宽和稀疏压缩率时必须换指标。把所有内存公式写成 numel×itemsize，会在 view、sparse 和量化表示上失真。'
        ],
        code: `dense = torch.zeros(2, 3)
expanded = torch.ones(1).expand(2, 3)
sparse = torch.sparse_coo_tensor(
    torch.tensor([[0], [2]]), torch.tensor([7.0]), (2, 3)
)

assert dense.numel() == expanded.numel() == sparse.numel() == 6
assert expanded.untyped_storage().nbytes() == expanded.element_size()
assert sparse._nnz() == 1`,
        language: 'python',
        takeaway: 'numel 回答“逻辑上有多少坐标”，不回答“分配了多少字节”或“有多少唯一存储值”。'
      },
      {
        kicker: '03 · DTYPE',
        title: 'dtype 同时决定编码、范围和分派',
        paragraphs: [
          'dtype 不只是 itemsize。float16、bfloat16 都占两字节，却有不同指数和尾数分配；int8 的算术与量化 scale/zero-point 又是两层合同。选择 dtype 会改变溢出、舍入、累加精度、可用 kernel 与模型稳定性。',
          '类型提升规则决定混合输入的输出 dtype；默认 dtype 又会影响由 Python 浮点创建的 Tensor。隐藏的 float64 常把 GPU kernel 和参数变成另一条路径。入口应显式构造或转换 dtype，并用 `torch.result_type`/`can_cast`理解组合。',
          '`view(dtype)`可以重新解释同一字节，但对最后一维 stride、offset 与元素宽度有严格整除条件；`.to(dtype)`则按数值转换并通常分配。把位解释与数值转换混淆，会得到“形状对了、值全错”的危险结果。'
        ],
        takeaway: 'dtype 是数值语义与 kernel 合同；相同 itemsize 不能说明可互换，重新解释字节也不等于转换数值。'
      },
      {
        kicker: '04 · DEVICE',
        title: 'device 规定地址空间和执行位置',
        paragraphs: [
          '`torch.device`包含类型和可选索引，例如 cpu、cuda:1、mps、meta。大多数二元算子要求输入同 device；把一个小常量留在 CPU 会触发错误，框架通常不会偷偷跨设备搬运，因为隐式传输会破坏性能可预测性。',
          '`.to(device)`若目标属性与当前完全相同，可以返回自身；否则产生新 Tensor/Storage 并执行传输。`non_blocking=True`只表达允许条件，真正异步还依赖 pinned memory、后端和 stream。检查对象 identity、Storage 指针与同步时间，才能判断是否复制。',
          'meta device 没有数值数据，适合模块初始化规划和 shape 推导。不能从 meta 直接 `.to("cpu")`恢复未知值，必须由 `to_empty`或重新初始化参数提供真实 Storage。device 因而也可能表示“抽象执行域”，不只是一块硬件。'
        ],
        takeaway: 'device 是地址可达性、allocator 和 kernel 的联合合同；迁移是否复制和是否异步必须用具体路径验证。'
      },
      {
        kicker: '05 · LAYOUT',
        title: 'layout 决定哪一套结构不变量成立',
        paragraphs: [
          '`torch.strided`是常见 dense 表示，Storage + sizes + strides + offset 地址公式成立。`torch.sparse_coo`把坐标和值分开，可能未 coalesce；CSR/CSC/BSR 等 layout 还有压缩索引结构。一个算子支持 Tensor 类型，不代表支持所有 layout。',
          'layout 与 memory_format 不同。channels_last 仍是 `torch.strided`，只是 stride 排列符合 NHWC 友好模式；sparse_coo 则是另一种 layout。把 channels_last 称为 sparse 或把 layout 当连续性，会让 API 检查失焦。',
          'layout 的部分 API 标注 beta，版本间支持矩阵会变化。课程正文只固定稳定不变量，工程采用某个 sparse kernel 时应在锁定版本上查询官方算子文档并跑数值/梯度测试。'
        ],
        code: `nchw = torch.empty((2, 3, 4, 5))
nhwc_memory = nchw.contiguous(memory_format=torch.channels_last)

assert nchw.layout == torch.strided
assert nhwc_memory.layout == torch.strided
assert nhwc_memory.is_contiguous(memory_format=torch.channels_last)
assert not nhwc_memory.is_contiguous()`,
        language: 'python',
        takeaway: 'layout 选择结构族，memory_format 选择 strided 族中的典型排列；二者层级不同。'
      },
      {
        kicker: '06 · CONTRACT',
        title: '把五个属性写成算子入口合同',
        paragraphs: [
          '假设自定义图像 kernel 只接受 `[N,C,H,W]`、float16/float32、CUDA、strided、channels_last。入口应逐项检查并给出具体错误；只调用 `is_cuda`或 `is_contiguous`会漏掉 rank、dtype 与 memory format。',
          '合同还要决定转换责任。库函数可以严格拒绝，让调用者控制复制；也可以提供 `normalize_input`显式 `.to`与 `.contiguous(memory_format=...)`。后一种更易用，却可能隐藏大拷贝，所以应返回是否物化或记录性能指标。',
          '测试矩阵至少包含允许的两个 dtype、错误 rank、CPU、sparse、NCHW contiguous 与 channels_last。输出还需验证 shape、dtype、device、layout 和数值，而非只检查函数没有报错。'
        ],
        takeaway: '好的 Tensor API 把属性组合变成可测试前置条件，并明确谁为转换和复制付费。'
      },
      {
        kicker: '07 · DIAGNOSIS',
        title: '从属性错配定位常见训练故障',
        paragraphs: [
          '“Expected all tensors on same device”先枚举模型参数、buffer、输入和新建常量的 device；不要只对报错 Tensor 调 `.cuda()`，那可能掩盖 state_dict 或数据管线的所有权问题。模块内部常量应注册 buffer，使 `.to()`能统一迁移。',
          'dtype mismatch 要区分参数 dtype、autocast 计算 dtype、梯度/优化器状态 dtype。盲目把所有对象 half 化可能破坏 BatchNorm、loss reduction 或 optimizer 精度。记录算子边界实际输入输出 dtype，才能定位自动混精的选择。',
          'layout/contiguity 故障表现为不支持错误或隐式 copy 性能下降。profile 中出现 `contiguous`/`copy_`时回到生产者的 shape、stride、memory_format；修复布局流比在每个消费者前补 `.contiguous()`更节省带宽。'
        ],
        takeaway: '属性是诊断坐标：逐层记录合同与实际值，可以把“Tensor 不对”缩小到具体转换边界。'
      }
    ],
    mechanisms: [
      'shape 给出各维逻辑范围，numel 通常缓存 sizes 乘积。',
      'dtype 决定元素编码、itemsize、类型提升与 kernel 能力。',
      'device 决定地址空间、allocator、执行后端与迁移语义。',
      'layout 选择 strided、sparse 等结构族，memory_format 是 strided 内的排列选择。',
      'meta Tensor 允许只有抽象属性而没有普通数据。',
      'Tensor subclass 可通过 policy/custom accessor 覆写 sizes、device、layout 行为。',
      '编译 guard、dispatcher 与序列化都会读取这些属性形成执行合同。'
    ],
    pitfalls: [
      'shape 相同就认为 Tensor 可互换，忽略 dtype、device、layout 与轴语义。',
      '用 numel×itemsize 估算所有 view/sparse 的真实 Storage。',
      '把 float16 与 bfloat16 因同为两字节而视作相同数值格式。',
      '认为 `.to`必复制，或认为 `non_blocking=True`必异步。',
      '把 channels_last 当成独立 layout，混淆 memory_format。',
      '从 meta Tensor 直接迁移并期待恢复从未存在的数值。',
      '在消费者前无条件 contiguous，长期掩盖上游布局抖动和复制。'
    ],
    variants: [
      {
        title: '严格属性合同',
        useWhen: '底层 kernel、性能关键库或跨团队接口必须让复制与迁移显式。',
        tradeoff: '性能可预测、错误局部化；调用者要管理 dtype/device/layout 适配，使用门槛更高。'
      },
      {
        title: '规范化适配层',
        useWhen: '应用入口需要接受多种输入并统一到模型内部格式。',
        tradeoff: '易用且集中转换；必须暴露复制指标和最大输入预算，避免静默大开销。'
      },
      {
        title: 'meta-first 构建',
        useWhen: '大模型装载、编译或分片规划阶段只需属性和模块结构。',
        tradeoff: '显著降低初始化峰值；所有数据依赖初始化、后端差异和 unsupported op 要另行处理。'
      }
    ],
    studyPlan: { readingMinutes: 35, sourceMinutes: 30, practiceMinutes: 65, reviewMinutes: 15 },
    exampleLanguage: 'python',
    example: `import torch


def contract(tensor: torch.Tensor) -> dict[str, object]:
    return {
        "shape": tuple(tensor.shape),
        "numel": tensor.numel(),
        "dtype": tensor.dtype,
        "device": tensor.device.type,
        "layout": tensor.layout,
        "stride": tensor.stride() if tensor.layout == torch.strided else None,
    }


dense = torch.zeros((2, 3), dtype=torch.float32)
meta = torch.empty((2, 3), dtype=torch.float32, device="meta")
sparse = torch.sparse_coo_tensor(
    indices=torch.tensor([[0, 1], [2, 0]]),
    values=torch.tensor([4.0, 5.0]),
    size=(2, 3),
)

assert contract(dense)["shape"] == contract(meta)["shape"] == (2, 3)
assert contract(dense)["numel"] == contract(sparse)["numel"] == 6
assert dense.layout == torch.strided
assert sparse.layout == torch.sparse_coo
assert sparse._nnz() == 2
assert sparse.to_dense()[0, 2].item() == 4.0

scalar = torch.tensor(3.0)
empty = torch.empty(2, 0, 3)
assert scalar.shape == torch.Size([]) and scalar.numel() == 1
assert empty.shape == torch.Size([2, 0, 3]) and empty.numel() == 0`,
    buildSteps: [
      { title: '积木 1：建立属性快照', body: '返回 shape、rank、numel、dtype、itemsize、device、layout；仅对 strided Tensor 读取 stride。' },
      { title: '积木 2：覆盖边界 shape', body: '测试标量、零长度维度和普通矩阵，分别断言 shape 与 numel。' },
      { title: '积木 3：比较 dtype', body: '对 float16、bfloat16、float32 记录 itemsize、finfo 和一个大/小值舍入实验。' },
      { title: '积木 4：加入 meta', body: '执行只依赖 shape 的算子，再尝试读取值并捕获预期错误，划出抽象执行边界。' },
      { title: '积木 5：加入 sparse layout', body: '构造 COO、检查 nnz/coalesce/to_dense，证明 numel 与实际 values 数量不同。' },
      { title: '积木 6：实现严格入口', body: '为图像 kernel 检查 rank、dtype、device、layout、channels_last，并让每个错误都有专属测试。' }
    ],
    selfCheckQuestion: '一个图像算子收到 shape 为 `[8,3,224,224]` 的 Tensor，团队便断言它可直接进入 CUDA channels-last float16 kernel。请列出还必须验证的属性，说明 layout 与 memory_format 的区别，并给出“严格拒绝”和“入口规范化”两种 API 设计的取舍。',
    selfCheckAnswer: '还要验证 rank/轴语义确为 NCHW、dtype 在允许集合且数值范围可接受、device 是目标 CUDA 设备、layout 是 torch.strided、stride 符合 channels_last memory_format，以及后端/对齐等 kernel 专属约束。layout 选择 strided 或 sparse 等结构族；channels_last 仍属于 strided，只是 4D stride 排列满足特定 memory format。严格 API 对不匹配直接报错，复制和迁移由调用者显式安排，性能最可预测；规范化 API 可集中调用 `.to(dtype/device)`与 `.contiguous(memory_format=...)`，使用更方便，但可能静默产生大拷贝，必须返回或记录物化、限制输入预算并在测试/profile 中验收。'
  },
  'Stride 地址代数与连续性：从索引公式到 memory_format': {
    official: {
      title: 'PyTorch 2.13 · torch.layout and strided tensors',
      url: 'https://docs.pytorch.org/docs/stable/tensor_attributes.html#torch-layout',
      note: '官方说明每个 strided Tensor 都关联 Storage，stride[k] 表示第 k 维前进一个元素所需的内存步长。连续性是某种 memory format 下的排列性质，transpose 等 view 可以共享 Storage 同时变为非连续。'
    },
    source: {
      repo: 'pytorch/pytorch',
      file: 'c10/core/TensorImpl.cpp',
      symbol: 'TensorImpl::compute_contiguous and compute_non_overlapping_and_dense',
      language: 'cpp',
      url: 'https://github.com/pytorch/pytorch/blob/v2.13.0/c10/core/TensorImpl.cpp#L259-L312',
      code: `// PyTorch v2.13.0 · c10/core/TensorImpl.cpp
bool TensorImpl::compute_contiguous() const {
  if (is_sparse()) {
    return false;
  }
  return _compute_contiguous<int64_t>(
      sizes_and_strides_.sizes_arrayref(),
      sizes_and_strides_.strides_arrayref(),
      numel_);
}

bool TensorImpl::compute_channels_last_contiguous_2d() const {
  if (is_sparse()) {
    return false;
  }
  return _compute_channels_last_contiguous_2d<int64_t>(
      sizes_and_strides_.sizes_arrayref(),
      sizes_and_strides_.strides_arrayref());
}

bool TensorImpl::compute_channels_last_contiguous_3d() const {
  if (is_sparse()) {
    return false;
  }
  return _compute_channels_last_contiguous_3d<int64_t>(
      sizes_and_strides_.sizes_arrayref(),
      sizes_and_strides_.strides_arrayref());
}

bool TensorImpl::compute_non_overlapping_and_dense() const {
  if (is_sparse()) {
    return false;
  }
  return _compute_non_overlapping_and_dense<int64_t>(
      sizes_and_strides_.sizes_arrayref(),
      sizes_and_strides_.strides_arrayref());
}`,
      walkthrough: [
        '普通 contiguous、2D channels-last、3D channels-last 分别缓存判断，说明“连续”必须带 memory format 语境。',
        '所有判断先拒绝 sparse，因为 sparse layout 不遵守普通 size/stride 到单一 Storage 的地址合同。',
        '`_compute_contiguous`检查 sizes/strides/numel 是否满足默认行主序的连续遍历，不通过并不表示 Tensor 无法读取或算子一定失败。',
        'channels-last 判断使用同一 sizes/strides 但按 NCHW/NCDHW 的专用物理顺序验证，layout 仍是 strided。',
        'non-overlapping-and-dense 是另一性质：索引映射不重叠且覆盖一个稠密区域，可包含转置等非默认连续排列；不要用单一布尔量替代全部布局能力。'
      ]
    },
    overview: [
      'stride 是把多维坐标压到一维 Storage 的系数。它与线性代数中的基向量很像：每个维度前进一步，相当于在物理元素序号上加一个固定向量。理解这个地址代数后，transpose、slice、expand、diagonal 和 view 的行为都能手算，而不再靠记 API。',
      '连续性经常被误解为“内存中有一整块”。所有普通 Storage 都是字节缓冲区，关键在于逻辑索引按某种约定顺序遍历时，地址是否无洞地递增。默认 contiguous 与 channels_last 使用不同遍历约定；转置可能 non-overlapping-and-dense，却不满足默认 contiguous。',
      '性能也不能简化成连续真/假。kernel 可能原生接受任意 stride，TensorIterator 会合并维度并选择遍历顺序；GPU coalescing、CPU cache locality 和向量化取决于内层 stride、shape 与算子。`.contiguous()`是一笔真实复制，只有 profile 证明后续收益覆盖成本时才值得。'
    ],
    chapters: [
      {
        kicker: '01 · AFFINE MAP',
        title: '把索引变成元素 offset 的仿射映射',
        paragraphs: [
          '公式 `offset(i)=storage_offset+Σ i[k]×stride[k]`是仿射映射：storage_offset 是常量项，stride 是每维系数。对 shape `(2,3,4)`的默认连续张量，stride 为 `(12,4,1)`；索引 `(1,2,3)`映射 12+8+3=23。',
          'stride 单位为元素，不是字节。真实字节地址再乘 element_size。这个设计允许同一几何逻辑用于 float16、float32 和 int64，不必为 dtype 改写 stride。`storage_offset`同样按元素计。',
          '手算函数要先验证 rank、每个索引范围和 Storage 边界。教学版可以只支持非负 stride；PyTorch 普通 Tensor 不支持 NumPy 那种负 stride view，`torch.from_numpy`遇到负 stride 数组通常要求先复制。'
        ],
        code: `def storage_index(tensor, index):
    if len(index) != tensor.dim():
        raise ValueError("rank mismatch")
    if any(i < 0 or i >= size for i, size in zip(index, tensor.shape)):
        raise IndexError(index)
    return tensor.storage_offset() + sum(
        i * stride for i, stride in zip(index, tensor.stride())
    )`,
        language: 'python',
        takeaway: '地址公式是后续所有 view 推理的共同积木；先用元素单位推导，再换算字节。'
      },
      {
        kicker: '02 · CONTIGUOUS',
        title: '默认连续 stride 怎样从后往前生成',
        paragraphs: [
          '行主序默认排列让最后一维相邻：最末 stride 为 1，向前每一维 stride 等于后一维 stride×后一维 size。shape `(2,3,4)`因此得到 `(12,4,1)`。size 为 1 的维度只有一个坐标，其 stride 在某些判断中可被忽略。',
          '零元素 Tensor 的 stride 存在约定性，因为没有任何地址会被真实访问。源码对零 numel 采用兼容规则；测试不要把空 Tensor 的某个 stride 数字当跨版本业务语义，应验证 shape、numel 和操作结果。',
          '`is_contiguous()`是缓存属性，元数据改变后 TensorImpl 必须 refresh。手写扩展若改 sizes 却忘记 stride/contiguity 标志，会让 kernel 走错误快速路径，这也是应使用正规构造 API 的原因。'
        ],
        takeaway: '默认连续是特定递推关系，不是“Storage 存在”；空维和 size-1 维需要按可观察语义处理。'
      },
      {
        kicker: '03 · PERMUTATION',
        title: '转置为什么只置换 size 与 stride',
        paragraphs: [
          '对 `(2,3,4)` Tensor 做 `permute(0,2,1)`，新 shape 是 `(2,4,3)`，新 stride 是 `(12,1,4)`。逻辑 `(b,d,t)`代入后仍访问原 `(b,t,d)`的同一元素。Storage、dtype 和 offset 都不变。',
          '新 Tensor 最内层维 stride 为 4，顺序访问会跨过三个元素；默认 contiguous 为 false。但它仍 non-overlapping-and-dense：所有逻辑坐标映射到 24 个唯一地址，并覆盖整个区域，只是访问顺序改变。',
          '若后续矩阵乘或自定义 kernel 支持该 stride，直接消费可避免复制；若 kernel 要求内层 stride 1，contiguous 会重排字节。选择应包含复制一次与每次非理想访问的总成本，而非看到 false 就立即复制。'
        ],
        code: `base = torch.arange(24).reshape(2, 3, 4)
p = base.permute(0, 2, 1)
assert p.shape == (2, 4, 3)
assert p.stride() == (12, 1, 4)
assert p[1, 2, 1].item() == base[1, 1, 2].item() == 18`,
        language: 'python',
        takeaway: 'permute 是坐标轴与 stride 系数的同步置换；逻辑顺序变了，字节没有搬。'
      },
      {
        kicker: '04 · HOLES',
        title: '切片如何制造洞与非零 offset',
        paragraphs: [
          '`x[:, ::2]`保留每隔一个元素，相关维 stride 乘 2；`x[1:]`把 storage_offset 前移。两者都能零拷贝，却可能让逻辑元素分布在更大地址跨度中。Tensor 的第一个逻辑元素不必位于 Storage 起点。',
          '带洞 view 通常不是 dense，因为合法地址之间有未被当前 Tensor 使用的元素。某些逐元素 kernel 仍能按 stride 正确执行；reshape 若想把跨洞子空间合并，就无法只改元数据。',
          '调试时枚举小 Tensor 的所有 storage index，观察排序、重复和间隙。大 Tensor 不能全枚举，可用 shape/stride 推导边界和重叠性质，或依赖框架已有 overlap 检查。'
        ],
        takeaway: '非连续可能来自轴重排，也可能来自洞和 offset；它们对 view 兼容与性能的影响不同。'
      },
      {
        kicker: '05 · CHANNELS LAST',
        title: 'channels_last 是另一种连续约定',
        paragraphs: [
          'PyTorch 图像逻辑 shape 通常仍写 NCHW，但 channels_last memory format 让 C 维物理相邻，便于某些卷积 kernel。`is_contiguous(memory_format=torch.channels_last)`可能为真，同时默认 `is_contiguous()`为假。',
          '转换使用 `.contiguous(memory_format=...)`或 `.to(memory_format=...)`，是否复制取决于当前排列。模块和输入应维持一致布局流；在每层来回 NCHW/NHWC 会用重排吞掉 kernel 收益。',
          '不能仅凭 stride 猜后端一定更快。硬件、dtype、卷积形状与 kernel 库共同决定结果。建立端到端 benchmark，记录重排次数、吞吐和显存，再选择 memory format。'
        ],
        takeaway: '连续性必须带遍历约定；channels_last 改物理相邻轴，不改 NCHW 的逻辑轴语义。'
      },
      {
        kicker: '06 · OVERLAP',
        title: 'non-overlapping、dense 与 contiguous 的关系',
        paragraphs: [
          'non-overlapping 表示不同逻辑坐标不映射同一地址；dense 表示映射覆盖一段无洞区域。默认连续一定满足二者，纯 permute 也常满足，而 step slice 有洞，expand 以零 stride 产生重叠。',
          '原地写安全首先要求没有内部重叠，还要考虑与其他 Tensor 的外部别名。一个 view 自身 non-overlapping，不代表它与 base 或另一个 view 不交叠。并发写还需同步协议。',
          '公开 API 没有为所有组合承诺一个稳定高层判据；工程设计应尽量通过正规 view 操作表达，并在写边界 clone。内部 overlap 工具可用于诊断，却不宜成为长期公共接口。'
        ],
        takeaway: 'contiguous 是强排列条件；non-overlapping/dense 拆开了唯一性和覆盖性，更接近写安全与 view 能力。'
      },
      {
        kicker: '07 · PERFORMANCE',
        title: '用访问模式而非布尔标签解释性能',
        paragraphs: [
          'CPU 最内层 stride 1通常利于 cache line 与 SIMD，GPU 相邻线程访问相邻地址有利于 coalescing。但 reduction、matrix multiply 和 convolution 会重新组织迭代；高性能库可能专门支持转置标志而无需复制。',
          'profile 应把显式/隐式 copy 与目标 kernel 分开计时。一次 contiguous 后重复执行百次 kernel 可能值得；只执行一次的短算子，复制常比非连续访问更贵。warmup、同步与相同数值输入是可靠 benchmark 的前提。',
          'API 层最好传递布局而非到处物化。只有在稳定边界，例如数据加载完成、模型入口或缓存写入时统一 memory format，才能让布局选择可观测、可回滚。',
          '还要区分“访问次序不理想”和“内部重叠导致语义不安全”。前者可能只是慢，后者在向量化原地写时可能让同一地址被多个逻辑元素竞争。性能优化前先证明地址集合唯一，再讨论 cache 与合并访问；否则更快的 kernel 可能只是更快地产生不确定结果。',
          '一个可复用的布局报告应给出最内层非 size-1 维、对应 stride、地址跨度、是否存在重复地址、默认/channels-last 连续性，以及本次物化字节数。小 Tensor 可穷举验证，大 Tensor用排序后的 stride 与 size 推导。报告让评审者看到选择依据，而不只是一句“non-contiguous 很慢”。'
        ],
        takeaway: 'stride 决定访问序列，性能来自硬件与 kernel 对序列的利用；contiguous 只是一个常用快速路径信号。'
      },
      {
        kicker: '08 · FAILURE LAB',
        title: '用地址集合实验区分四类布局',
        paragraphs: [
          '准备连续矩阵、transpose、step slice 和 expand 四个输入。对每个小 Tensor 穷举所有逻辑坐标，计算 storage index，随后统计集合大小、最小/最大值和排序后间隙。连续矩阵地址唯一且无洞；transpose 地址仍唯一无洞但遍历乱序；step slice 唯一有洞；expand 出现重复地址。',
          '这四类结果对应不同决策。transpose 可能被支持任意 stride 的 kernel直接消费；step slice 可能需要按 stride读取或物化；expand 的只读广播很便宜，写前必须 clone；连续矩阵才可直接套默认线性扫描。把实验写成断言后，任何新 view 操作都能落到同一分类，而无需背诵 API 清单。',
          '地址集合实验还应验证 storage_offset 非零的子视图。只比较最大 offset 与 numel 会漏掉起点，正确边界是 Storage 元素容量内的最小和最大可达地址。若未来扩展到允许负 stride 的外部数组，最小值不再必然等于 offset，边界公式也必须同时考虑正负系数。'
        ],
        takeaway: '唯一性、洞、遍历顺序和起点四项证据足以解释大多数 strided view 的读写与物化决策。'
      }
    ],
    mechanisms: [
      'strided Tensor 使用 storage_offset 加索引与 stride 点积得到元素地址。',
      '默认 contiguous stride 从最后一维开始按 size 累乘生成。',
      'permute/transpose 同步置换 sizes 与 strides，不移动 Storage。',
      'slice 可增加 storage_offset、放大 stride 并形成地址洞。',
      'channels_last 是 strided layout 下另一种连续 memory format。',
      'non-overlapping、dense、contiguous 分别描述地址唯一性、覆盖性和特定顺序。',
      'TensorImpl 缓存多种 contiguity 属性，元数据更新必须刷新。'
    ],
    pitfalls: [
      '把 stride 当字节数，重复乘或漏乘 element_size。',
      '认为非 contiguous 就不是 view、不能计算或一定很慢。',
      '对每个 transpose 立即 contiguous，忽略后续 kernel 可能原生支持。',
      '把 channels_last 误作逻辑 NHWC shape 或独立 layout。',
      '用 numel 代替地址跨度，漏掉 step slice 的洞。',
      '把自身 non-overlapping 推成与所有别名都不重叠。',
      '用空 Tensor 的具体 stride 数字建立跨版本业务断言。'
    ],
    variants: [
      {
        title: '保持原 stride 直接计算',
        useWhen: 'kernel 支持任意 stride，操作次数少或复制成本大。',
        tradeoff: '避免物化；访问局部性和可用快速路径可能较差，需要 profile 证明。'
      },
      {
        title: '边界处统一 contiguous',
        useWhen: '下游多次复用、kernel 明确要求或统一布局能消除多次隐式 copy。',
        tradeoff: '后续简单可预测；边界发生一次完整复制，需要纳入峰值和延迟。'
      },
      {
        title: '端到端 channels_last',
        useWhen: '卷积模型、支持该格式的硬件和 dtype 经 benchmark 证明收益。',
        tradeoff: '可能提升 kernel 吞吐；不支持的算子会重排，调试工具和自定义 op 必须理解 memory format。'
      }
    ],
    studyPlan: { readingMinutes: 40, sourceMinutes: 40, practiceMinutes: 80, reviewMinutes: 20 },
    exampleLanguage: 'python',
    example: `import torch


def storage_index(tensor: torch.Tensor, index: tuple[int, ...]) -> int:
    if len(index) != tensor.dim():
        raise ValueError("索引 rank 与 Tensor 不一致")
    if any(i < 0 or i >= size for i, size in zip(index, tensor.shape)):
        raise IndexError(index)
    return tensor.storage_offset() + sum(
        i * stride for i, stride in zip(index, tensor.stride())
    )


base = torch.arange(24).reshape(2, 3, 4)
permuted = base.permute(0, 2, 1)
sliced = base[:, :, ::2]

assert base.stride() == (12, 4, 1)
assert permuted.stride() == (12, 1, 4)
assert sliced.stride() == (12, 4, 2)
assert storage_index(permuted, (1, 2, 1)) == 18
assert permuted[1, 2, 1].item() == 18
assert not permuted.is_contiguous()

materialized = permuted.contiguous()
assert materialized.is_contiguous()
assert torch.equal(materialized, permuted)
assert materialized.untyped_storage().data_ptr() != permuted.untyped_storage().data_ptr()

image = torch.empty((2, 3, 4, 5))
channels_last = image.contiguous(memory_format=torch.channels_last)
assert channels_last.is_contiguous(memory_format=torch.channels_last)
assert not channels_last.is_contiguous()`,
    buildSteps: [
      { title: '积木 1：实现地址函数', body: '检查 rank/范围，按元素 offset 公式返回物理序号，并用连续 3D Tensor 穷举验证。' },
      { title: '积木 2：生成默认 stride', body: '从 shape 尾部递推 stride，覆盖标量、size-1 维与零元素约定。' },
      { title: '积木 3：实现 permute 元数据', body: '只置换 shape/stride，证明每个新坐标与原坐标访问同一值。' },
      { title: '积木 4：加入切片洞', body: '用 step slice 枚举物理地址，计算 logical count、span、holes。' },
      { title: '积木 5：分类重叠与稠密', body: '对小 Tensor 枚举地址集合，分别识别 contiguous、permute、slice、expand。' },
      { title: '积木 6：比较 memory format', body: '构造 NCHW contiguous 与 channels_last，打印 stride，并分别调用两种 is_contiguous。' },
      { title: '积木 7：做复制盈亏实验', body: '比较直接执行非连续算子与先 contiguous 后重复执行的总时间，正确同步并报告拷贝占比。' }
    ],
    selfCheckQuestion: 'Tensor shape 为 `(2,3,4)`、stride 为 `(12,1,3)`、offset 为 0。它是由最后两维转置得到的 view。请算 `(1,2,3)` 的元素 offset，解释为何它默认不连续却可能 non-overlapping-and-dense，并说明什么时候先 `.contiguous()`反而更慢。',
    selfCheckAnswer: '元素 offset 为 `1×12 + 2×1 + 3×3 = 23`。原连续 `(2,4,3)` 的 stride 是 `(12,3,1)`，交换最后两维后 shape `(2,3,4)`、stride `(12,1,3)`；24 个逻辑坐标仍一一映射到 0..23，因而无内部重叠且覆盖稠密区域，但按默认最后一维优先遍历时地址每次加 3，不满足默认 contiguous 递推。若后续算子原生支持该 stride、只执行一两次或 Tensor 很大，contiguous 的完整分配与复制可能超过非连续访问成本；只有下游多次复用或 kernel 快速路径收益足够时物化才划算，需把 copy 与 kernel 分开 benchmark。'
  },
  'view、reshape 与 flatten：零拷贝兼容条件和复制回退': {
    official: {
      title: 'PyTorch 2.13 · torch.Tensor.view',
      url: 'https://docs.pytorch.org/docs/stable/generated/torch.Tensor.view.html#torch.Tensor.view',
      note: '官方给出 view 的连续子空间条件：合并原维度 d..d+k 时相邻 stride 必须满足 stride[i] = stride[i+1]×size[i+1]。不确定时 reshape 会在兼容时返回 view，否则复制；调用者不应依赖 reshape/flatten 是否别名。'
    },
    source: {
      repo: 'pytorch/pytorch',
      file: 'aten/src/ATen/native/TensorShape.cpp',
      symbol: 'reshape and view_impl',
      language: 'cpp',
      url: 'https://github.com/pytorch/pytorch/blob/v2.13.0/aten/src/ATen/native/TensorShape.cpp#L2080-L2116',
      code: `// PyTorch v2.13.0 · aten/src/ATen/native/TensorShape.cpp
Tensor reshape(const Tensor& self, IntArrayRef proposed_shape) {
  if (self.is_sparse()) {
    TORCH_CHECK(false, "reshape is not implemented for sparse tensors");
  }
  DimVector shape = infer_size_dv(proposed_shape, self.numel());

  if (self.is_mkldnn()) {
    return at::_mkldnn_reshape(self, shape);
  }

  // 能否只改元数据，由 sizes/strides 的连续子空间决定。
  auto stride =
      at::detail::computeStride(self.sizes(), self.strides(), shape);

  if (stride.has_value()) {
    if (!self.is_xla() && !self.is_lazy() && !self.is_ipu()) {
      // 已算出新 stride，直接创建 alias，避免 view 重复计算。
      return self._reshape_alias(shape, stride.value());
    } else {
      return self.view(shape);
    }
  }

  // 不兼容时先按默认连续格式 clone，再建立目标 shape。
  return at::_unsafe_view(
      self.clone(at::MemoryFormat::Contiguous), shape);
}

static inline Tensor view_impl(const Tensor& self, IntArrayRef size) {
  at::DimVector inferred_size = at::infer_size_dv(size, self.numel());
  auto stride = at::detail::computeStride(
      self.sizes(), self.strides(), inferred_size);
  TORCH_CHECK(stride.has_value(), "view size is not compatible");
  return alias_with_sizes_and_strides(self, inferred_size, *stride);
}`,
      walkthrough: [
        '`infer_size_dv`先检查元素数量并解析一个 `-1` 推断维；相同 numel 是必要条件，却不是 view 的充分条件。',
        '`computeStride`把旧 sizes/strides 分成连续子空间 chunk，尝试让新 shape 的维度完整装入这些 chunk；失败返回 nullopt。',
        '`view_impl`在 computeStride 失败时直接报错，因此 `view`给调用者零拷贝保证：成功即共享数据，不会静默复制。',
        '`reshape`成功算出 stride 时调用内部 `_reshape_alias`；对特殊后端保留 view 分支，说明公开语义与后端能力分层。',
        '无法 alias 时 reshape clone 成默认 contiguous，再用 unsafe_view 改 shape；unsafe 仅表示内部已完成检查，不是建议用户绕过安全。'
      ]
    },
    overview: [
      'view、reshape、flatten 都能改变 shape，差别藏在复制合同。`view`要求新 shape 可用同一 Storage 与一组新 stride 表达，不满足就报错；`reshape`优先 view，不行就复制；`flatten`在展平维度不需要改变时可能返回原对象，在兼容时返回 view，其他情况复制。只看输出 shape 无法判断所有权。',
      '“numel 相同就能 view”是最常见误解。把一组原维度合并成一个新维度时，那些维度必须在物理地址上形成连续子空间。transpose 后 stride 顺序被打断，某些维仍可局部合并，跨越 chunk 边界则必须重排字节。',
      '复制回退让 reshape 易用，也会把性能与别名语义变成输入布局的函数。同一行代码在连续训练数据上零拷贝，在另一路非连续数据上突然分配数 GB。稳定 API 要选择：需要零拷贝时用 view 让失败显式；允许复制时用 reshape，并监控/测试物化。'
    ],
    chapters: [
      {
        kicker: '01 · NECESSARY',
        title: '相同 numel 为什么只是一张入场券',
        paragraphs: [
          '目标 shape 的维乘积必须等于原 numel，`-1`最多出现一次并由剩余维推断。这个检查只证明逻辑元素数量匹配，尚未证明按目标行主序遍历时可以沿原 stride 访问同一值序列。',
          '连续 `(2,3,4)`能 view 为 `(6,4)`、`(2,12)`或 `(24,)`，因为原维度形成一个连续 chunk。转置为 `(2,4,3)`、stride `(12,1,4)`后，最后两维的地址交错，直接合成 12 会改变元素顺序。',
          'reshape 的输出值顺序以输入逻辑遍历顺序为准。复制回退先把该逻辑顺序物化为 contiguous，再换 shape，所以值正确；若只是任意改 sizes/strides，可能得到 shape 正确却排列错误的 Tensor。'
        ],
        takeaway: 'numel 保证数量守恒，连续子空间条件保证顺序守恒；view 同时需要两者。'
      },
      {
        kicker: '02 · CHUNKS',
        title: '连续子空间条件怎样手算',
        paragraphs: [
          '从最内维向外看，若 `stride[i] == stride[i+1] * size[i+1]`，维 i 与 i+1 在物理上首尾相接，可以归入同一 chunk。size 1 维没有实际跨步，通常可以灵活嵌入。',
          '每个 chunk 有总元素数和基础 stride。目标 shape 从后往前装入：新维度乘积必须恰好分割 chunk，不能把一个新维跨过两个不连续 chunk。computeStride 正是在做这套匹配，并返回目标 stride。',
          '例如 shape `(2,4,3)`、stride `(12,1,4)`中，后两维不满足 `1 == 4×3`，形成不同 chunk；view `(2,12)`失败。view `(2,4,3)`当然成功，某些插入/删除 size-1 维也可成功。'
        ],
        code: `x = torch.arange(24).reshape(2, 3, 4).transpose(1, 2)
assert x.shape == (2, 4, 3)
assert x.stride() == (12, 1, 4)

try:
    x.view(2, 12)
except RuntimeError as error:
    assert "not compatible" in str(error)`,
        language: 'python',
        takeaway: '把 stride 相邻递推断开的地方画成 chunk 边界，便能预测哪些维可以零拷贝合并。'
      },
      {
        kicker: '03 · VIEW',
        title: 'view 用报错换取可预测别名',
        paragraphs: [
          '`view(*shape)`成功时共享底层数据，修改输出会影响 base 的映射区域。它适合库内部明确依赖零拷贝、并已控制输入布局的路径。失败把布局变化暴露在最近的边界，而不让昂贵复制潜伏。',
          '但 view 也不保证输出默认 contiguous；它只保证给定 shape 有合法 stride。对某些非连续输入，改变 size-1 维或在 chunk 内拆分仍可生成非连续 view。',
          '还有 `view(dtype)`重载，它重新解释字节而非改变 shape 的普通语义，对最后维 stride、offset 和元素宽度有独立约束。代码审查时应根据参数类型区分，避免把位级 reinterpretation 当 shape view。'
        ],
        takeaway: 'shape view 的核心合同是成功即零拷贝、失败即显式；它不承诺默认连续，也不同于 dtype view。'
      },
      {
        kicker: '04 · RESHAPE',
        title: 'reshape 的复制回退如何工作',
        paragraphs: [
          'reshape 先推断 shape，再调用 computeStride。若有目标 stride，内部 `_reshape_alias`直接创建别名；否则 clone 为默认 contiguous，并在新 Storage 上建立目标 view。调用者得到相同逻辑值，但所有权与成本可能变化。',
          '不能用 `_base`、对象 identity 或某次指针结果把 reshape 行为写成业务假设。官方明确要求调用者不依赖是否 view。若后续必须隔离，显式 clone；若必须共享，使用 view并处理错误。',
          '性能测试要覆盖真实上游布局。只拿 `torch.randn`连续输入 benchmark，会漏掉 transpose、channels_last 或 slice 导致的回退。profile 中的 clone/copy 与峰值内存，是 reshape 物化的直接证据。'
        ],
        code: `base = torch.arange(24).reshape(2, 3, 4)
non_contiguous = base.transpose(1, 2)

alias = base.reshape(6, 4)
copy = non_contiguous.reshape(2, 12)
assert alias.untyped_storage().data_ptr() == base.untyped_storage().data_ptr()
assert copy.untyped_storage().data_ptr() != non_contiguous.untyped_storage().data_ptr()`,
        language: 'python',
        takeaway: 'reshape 承诺值与 shape，不承诺别名；输入 stride 决定它走 alias 还是 clone。'
      },
      {
        kicker: '05 · FLATTEN',
        title: 'flatten 为什么还有“返回原对象”第三种结果',
        paragraphs: [
          '`torch.flatten(input, start_dim, end_dim)`只合并指定维区间。若 start_dim 与 end_dim 相同，无维度需要展平，官方允许返回原对象；若区间可 view 则返回 view，否则复制。',
          '这意味着 flatten 的对象 identity、Storage identity 都不稳定，调用方只能依赖输出值与 shape。需要新所有权时再 clone，需要零拷贝时可把目标 shape 算出后调用 view。',
          '模型中常在卷积与线性层之间 flatten。channels_last 或特殊切片可能改变复制路径，最好让模块边界的 memory format 稳定，并在 profile 中观察 flatten 是否产生 materialization。'
        ],
        takeaway: 'flatten 是局部 reshape 便利接口，可能原样返回、别名或复制；所有权合同必须由调用者另行表达。'
      },
      {
        kicker: '06 · AUTOGRAD',
        title: '别名与复制都怎样进入梯度图',
        paragraphs: [
          'view 输出具有 view backward 关系，梯度按相同几何映射回 base。reshape 若复制，clone 和 view 都是可微操作，梯度仍能回到输入；因此 Storage 是否共享与梯度是否连接是两条独立事实。',
          '原地修改 view 可能触发版本计数错误，尤其当 backward 保存了旧值。不能因为 reshape 某次复制就假设原地写安全，下一批输入布局兼容时它可能变成 alias。业务逻辑若需要独立可写缓冲区，应显式 clone。',
          '验证应对输入设 requires_grad，比较 view/reshape 路径的前向值与解析梯度，再用 gradcheck 或有限差分处理复杂函数。只看 `grad_fn`名字不足以证明数值正确。'
        ],
        takeaway: '复制不等于 detach，别名也不等于梯度一定危险；求导连接、内存共享和原地写要分别验证。'
      },
      {
        kicker: '07 · API CHOICE',
        title: '把零拷贝需求写进接口与测试',
        paragraphs: [
          '内部高性能算子若要求零拷贝，应接受明确 layout，调用 view，并在错误中报告 shape/stride。上层应用若更重视兼容，可用 reshape，但记录是否共享 Storage、copy bytes 与延迟。',
          '不要写 `x.contiguous().view(...)`当万能修复，它无论是否必要都可能复制；`reshape`至少在兼容时省去复制。反过来，若后续本来就要求 contiguous，显式 contiguous 可以把成本放在可观测边界并复用。',
          '回归测试准备连续、transpose、step slice、size-1 维和空 Tensor。分别断言 view 成败、reshape 数值、Storage identity 和 backward。这样上游布局变化不会悄悄改变性能或写传播。',
          '在 torch.compile/export 路径中，shape 与 stride 还可能进入 guard。一次运行因连续而捕获的 alias 路径，换成非连续输入可能触发重新编译、graph break 或走复制分支。性能验收因此要记录编译次数与输入布局分布，不能只观察 eager 单次调用。',
          '若结果要跨缓存或并发边界，reshape 的条件别名尤其危险：某些输入与调用者共享写入，另一些输入独立。接口应在边界追加 clone 固定所有权，或把返回类型/文档明确标为只读借用，并禁止下游原地修改。'
        ],
        takeaway: '选择 API 的依据是别名保证：view 要求共享，reshape 允许回退，clone 要求独立；shape 只是共同表面。'
      },
      {
        kicker: '08 · SOURCE REBUILD',
        title: '用教学版 computeStride 复现源码判断',
        paragraphs: [
          '教学实现先处理 numel 为零与完全相同 shape，再从旧 shape 最末维向前累计当前 chunk 的元素数。遇到 stride 递推断点时，目标 shape 也从末维向前累计，直到元素数与旧 chunk 精确相等；无法相等便返回 None。',
          '返回的目标 stride 从 chunk 基础 stride 递推生成。size-1 目标维可以插入而不改变地址集合，但实现仍要给出可用 stride。真正源码还处理 SymInt 未定关系：无法证明兼容时宁可返回 nullopt 走 clone，也不冒险生成错误别名。',
          '复现不必覆盖所有后端和符号形状，却必须与 torch 在一组表格上对照：连续拆分/合并成功，transpose 跨 chunk 失败，size-1 维成功，step slice 局部情况和零元素行为。错误案例要同时检查教学预测、view 异常与 reshape 复制，形成三方证据。'
        ],
        takeaway: 'computeStride 的核心任务是证明目标维能完整装入旧连续 chunk；证明失败时复制是安全回退。'
      }
    ],
    mechanisms: [
      'infer_size 检查 numel 守恒并解析一个 -1 维。',
      'computeStride 按连续子空间 chunk 判断目标 shape 能否沿用 Storage。',
      'view 失败即报错，成功通过 alias_with_sizes_and_strides 共享数据。',
      'reshape 先尝试 alias，不兼容时 clone contiguous 后再建立目标 view。',
      'flatten 只合并指定区间，并可能返回原对象、view 或 copy。',
      'reshape 的复制仍可微，不自动切断 autograd 历史。',
      '输入 layout/stride 是复制路径与性能的隐藏变量。'
    ],
    pitfalls: [
      '认为 numel 相同就总能 view。',
      '依赖 reshape 永远零拷贝或永远复制。',
      '用 `_base`作为 reshape 是否复制的稳定公共合同。',
      '在所有路径前无条件 contiguous().view，制造不必要复制。',
      '把 reshape 复制误认为 detach，忽略梯度仍会回传。',
      '对可能 alias 的 reshape 输出做原地写，却按一次实验的 copy 行为推断安全。',
      'benchmark 只用连续输入，漏掉真实 transpose/slice 回退。'
    ],
    variants: [
      {
        title: 'view：零拷贝强合同',
        useWhen: '性能关键内部路径已控制 stride，任何复制都应作为错误暴露。',
        tradeoff: '共享和成本可预测；上游布局变化会直接报错，需要调用者处理或物化。'
      },
      {
        title: 'reshape/flatten：兼容优先',
        useWhen: '应用层需要接受多种布局，允许框架在必要时复制。',
        tradeoff: '代码简洁、值语义稳定；延迟、峰值和别名随输入变化，必须监控。'
      },
      {
        title: 'contiguous + view：显式物化边界',
        useWhen: '下游多次复用默认连续布局，愿意在单一边界支付复制。',
        tradeoff: '后续路径统一且可 profile；若输入原本可 view 或下游支持 stride，可能浪费带宽。'
      }
    ],
    studyPlan: { readingMinutes: 40, sourceMinutes: 40, practiceMinutes: 80, reviewMinutes: 20 },
    exampleLanguage: 'python',
    example: `import torch


def shares_storage(left: torch.Tensor, right: torch.Tensor) -> bool:
    return (
        left.device == right.device
        and left.untyped_storage().data_ptr()
        == right.untyped_storage().data_ptr()
    )


base = torch.arange(24, dtype=torch.float32).reshape(2, 3, 4)
transposed = base.transpose(1, 2)

compatible = base.reshape(6, 4)
assert shares_storage(compatible, base)

try:
    transposed.view(2, 12)
except RuntimeError as error:
    assert "not compatible" in str(error)
else:
    raise AssertionError("跨连续子空间的 view 必须失败")

fallback = transposed.reshape(2, 12)
assert not shares_storage(fallback, transposed)
assert torch.equal(fallback, transposed.contiguous().view(2, 12))

x = torch.arange(12.0, requires_grad=True).reshape(3, 4)
y = x.reshape(2, 6)
loss = (y * y).sum()
loss.backward()
assert x.grad is None  # x 不是叶子；叶子是最初 arange 的结果
assert y.grad_fn is not None`,
    buildSteps: [
      { title: '积木 1：检查 shape 数量', body: '实现 -1 推断和 numel 守恒，覆盖标量、零元素与多个 -1 的失败。' },
      { title: '积木 2：划分连续 chunk', body: '从末维向前按 stride 递推分块，打印 transpose 在哪里断开。' },
      { title: '积木 3：预测 view', body: '用 chunk 容量匹配目标 shape，先预测成功/失败，再与 torch.view 对照。' },
      { title: '积木 4：观察 reshape 分派', body: '对连续、transpose、step slice 比较 Storage identity、值、stride 和 profile copy。' },
      { title: '积木 5：覆盖 flatten 三态', body: '分别构造无需展平、可 view 展平和必须复制的输入，验证对象/Storage identity。' },
      { title: '积木 6：加入 autograd', body: '从真实叶子构造 view 与 copy 路径，保留叶子引用，比较前向与梯度。' },
      { title: '积木 7：写性能门禁', body: '用真实上游布局跑 benchmark，分别报告 reshape、copy 和消费 kernel 的时间与峰值。' }
    ],
    selfCheckQuestion: '同一个 `x.reshape(batch, -1)`在训练 A 中零拷贝，在训练 B 中突然产生大规模显存分配，但数值与梯度仍正确。请沿源码分派解释原因，给出确认复制的证据，并分别设计“复制绝不允许”和“复制允许但要可观测”的接口。',
    selfCheckAnswer: 'A 的输入 sizes/strides 能被 computeStride 分成与目标 shape 匹配的连续 chunk，reshape 走 `_reshape_alias`共享 Storage；B 的上游可能增加 transpose、step slice 或不同 memory format，使 computeStride 返回 nullopt，reshape 于是 clone 为默认 contiguous，再 unsafe_view，因此数值顺序和 autograd 连接仍正确但产生新 Storage。证据包括输入 shape/stride、输出与输入 `untyped_storage().data_ptr()`不同、profiler 中 clone/copy_、memory_allocated 峰值和对应延迟。复制绝不允许的内部 API 应声明输入布局并调用 view，失败时报告 shape/stride；兼容 API 可调用 reshape，但记录 materialized 布尔值、copy bytes/延迟，设置预算或告警，并用真实连续与非连续输入做回归。'
  }
}
