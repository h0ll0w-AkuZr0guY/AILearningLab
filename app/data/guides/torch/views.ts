import type { TopicGuide } from '../../topic-guides'

export const torchViewGuides: Record<string, TopicGuide> = {
  'transpose、permute 与 movedim：只改维度解释的零拷贝重排': {
    official: {
      title: 'PyTorch 2.13 · Tensor Views / torch.permute',
      url: 'https://docs.pytorch.org/docs/stable/tensor_view.html#tensor-views',
      note: '官方将 transpose、permute、movedim 列为 view 操作：对普通 strided Tensor，它们重排维度解释而共享底层 storage；连续性与下游性能需要单独判断。'
    },
    source: {
      repo: 'pytorch/pytorch', file: 'aten/src/ATen/native/TensorShape.cpp', symbol: 'permute', language: 'cpp',
      url: 'https://github.com/pytorch/pytorch/blob/v2.13.0/aten/src/ATen/native/TensorShape.cpp#L1782-L1787',
      code: `// PyTorch v2.13.0：普通 strided Tensor 的 permute 只生成新的 view 元数据。
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
}`,
      walkthrough: [
        'Python 的 `x.permute(dims)` 进入 ATen native `permute`；稀疏 layout 有另一条实现，不能把本节的别名结论外推到所有 layout。',
        '`_permute_size_stride_estimation`先标准化负维度，检查排列是完整双射，再以相同排列取出旧 size 与旧 stride。',
        '`self.as_strided`保留 Storage 和 storage_offset，仅安装新的 size/stride，因此结果与输入共享字节。',
        '真正的搬运只会在后来某个不接受该布局的算子、显式 `contiguous()`，或某个 copy API 出现；把 view 创建时间当成算子总成本会误判。'
      ]
    },
    overview: [
      '卷积代码常把 NCHW 改写成 NHWC，注意力代码又在 batch、head、sequence、feature 之间换轴。若每次换名字都复制整块激活，带宽会先于算力成为瓶颈。普通 strided Tensor 的 transpose、permute 与 movedim 给出的承诺很克制：它们换坐标轴的解释，底层字节仍由同一个 Storage 持有。',
      '把连续 `(B,T,D)` 的 stride 写成 `(T×D,D,1)`。`permute(0,2,1)`得到 size `(B,D,T)`、stride `(T×D,1,D)`；新逻辑索引 `(b,d,t)`访问的仍是旧 `(b,t,d)`。因此值的轴语义变了，物理元素的地址集合没有变。这是零拷贝的精确含义，不是“结果看起来没变”。',
      '`transpose(d0,d1)`是交换两个轴的窄接口，`permute`给出完整轴排列，`movedim(src,dst)`适合表达“把 channel 送到最后”这类位置意图。三者应按代码意图选，不应为了性能在它们之间猜测；普通 dense 输入上的别名事实相同，后续消费布局才决定性能。'
    ],
    chapters: [
      { kicker: '01 · AXES', title: '先区分轴标签与地址顺序', paragraphs: [
        'shape 的第 1 维到底是 time 还是 feature，是模型语义；stride 的第 1 项每加一要跳过多少元素，是存储语义。permute 同时重排两张表，才能让新的轴标签仍取到旧坐标对应的值。只改 shape 会把语义悄悄改坏，`view`与`permute`绝不可互换。',
        '对小张量应手算一格：base `(2,3,4)` 的 `(1,2,3)`地址为 `1×12+2×4+3=23`。`p=base.permute(0,2,1)`中同一个值位于 `(1,3,2)`，地址 `1×12+3×1+2×4=23`。这个等式是测试重排实现的最小证据。'
      ], code: `base = torch.arange(24).reshape(2, 3, 4)
p = base.permute(0, 2, 1)
assert p.shape == (2, 4, 3)
assert p.stride() == (12, 1, 4)
assert p[1, 3, 2] == base[1, 2, 3]`, language: 'python', takeaway: '轴排列必须作用于 size 和 stride 两者；只检查输出 shape 不足以验证重排。' },
      { kicker: '02 · ALIAS', title: '零拷贝如何被证实，又在哪里失效', paragraphs: [
        '`data_ptr()`可能因为 slice 的 offset 不同而不同，判断同一块 Storage 应比较 `untyped_storage().data_ptr()`。修改 `p` 中一个不重叠元素后 base 对应位置改变，是第二份更直观的证据。两项都成立，才可称普通 strided 输入走了 view 路径。',
        '这条结论有 layout 边界：官方 transpose 文档明确说 strided 输出共享 storage，sparse 输出不共享。量化、nested、subclass 与后端张量也可能走专属实现。库接口若承诺零拷贝，应限制并断言输入 layout，而不是只写“调用 permute”。'
      ], takeaway: '“函数名是 view”不是普适物理定律；应记录 layout、Storage identity 和版本。' },
      { kicker: '03 · API', title: '为什么 movedim 比手写 permute 更不容易错', paragraphs: [
        '`movedim(1,-1)`表达“把现有 channel 轴移到最后，其他轴相对顺序保留”。手写 `permute`需要自己推导完整排列，一旦 rank 从 4 增到 5，常把 batch 或 group 轴带错。movedim 接受多个 source/destination，但两组长度必须一致且各自没有重复维度。',
        'transpose 适合矩阵最后两轴互换，`mT`在 batch 矩阵上也更语义化；permute 适合确实掌握完整 layout 的库代码。把 API 选择写成轴名转换表，再加 shape/stride 断言，比让读者从裸整数猜约定可靠。'
      ], takeaway: '选择表达意图最窄的重排 API，减少 rank 演进时的排列 bug。' },
      { kicker: '04 · PERFORMANCE', title: '零拷贝为何仍可能让模型变慢', paragraphs: [
        'p 默认不连续只说明按默认最后一轴顺序无法线性走址，不等于任意 kernel 都不能消费它。许多 ATen 算子接受 stride，TensorIterator 还会重排遍历；另一方面，某些矩阵、融合或自定义 CUDA kernel 的内层 stride=1 快路径会明显更快。',
        '正确基准把一次 `permute`、可选 `contiguous` 的 copy，以及后续重复 kernel 分开计时。若只消费一次，复制常亏；若同一转置激活被多次消费，前置物化可能赢。GPU 计时必须同步，且以真实 shape/layout 而非全连续随机输入取样。'
      ], takeaway: '是否 materialize 是下游消费次数与 kernel 能力的决策，不能由 `is_contiguous()`单独决定。' },
      { kicker: '05 · AUTOGRAD', title: 'view 的梯度与原地写边界', paragraphs: [
        'permute 的 backward 是逆置换：若 forward 把 `(B,T,D)`改成 `(B,D,T)`，梯度再 permute 回去即可。这没有改变数学值，却要求 autograd 知道它是 view，才能在正确基 Tensor 上累积。',
        '需要梯度的叶子和其 view 不能随意原地写。即使当前地址不重叠，保存的 forward 值与版本计数也可能被破坏。训练代码优先使用 out-of-place 更新；确需写入时先明确所有权，再用 anomaly detection 与反向测试证明。'
      ], takeaway: '共享 Storage 的高效与可变状态耦合在一起，autograd 是这份合同的守门人。' }
    ],
    mechanisms: ['transpose 交换两项 size/stride；permute 对全部轴做双射排列。', 'movedim 将指定轴移动到目标位置，未指定轴保持相对次序。', '普通 strided 输出通过 as_strided 共享 Storage，往往失去默认 contiguous。', '下游 kernel 可以接受 stride，也可能触发或要求物化。'],
    pitfalls: ['用 view 代替 permute，只改 shape 而没有同步坐标含义。', '把 `data_ptr`不同的 slice 误判为没有共享 Storage。', '假定 sparse transpose 与 dense strided transpose 一样别名。', '为每次 permute 无条件 contiguous，未测量复制是否回本。'],
    variants: [
      { title: '语义轴移动：movedim', useWhen: '只需把一个或几个已命名轴送到特定位置，rank 可能变化。', tradeoff: '可读性高且少写排列；多轴 destination 仍需验证无重复。' },
      { title: '边界物化：permute().contiguous()', useWhen: '下游扩展明确要求默认连续，且同一布局会多次消费。', tradeoff: '获得稳定线性布局，代价是一次完整分配和 copy；必须由 profile 支持。' }
    ],
    studyPlan: { readingMinutes: 25, sourceMinutes: 40, practiceMinutes: 55, reviewMinutes: 20 }, exampleLanguage: 'python',
    example: `import torch

base = torch.arange(24).reshape(2, 3, 4)
p = base.permute(0, 2, 1)
assert p.untyped_storage().data_ptr() == base.untyped_storage().data_ptr()
assert p.stride() == (12, 1, 4)
p[1, 3, 2] = -1
assert base[1, 2, 3] == -1

last = torch.movedim(base, 1, -1)
assert torch.equal(last, p)
assert not p.is_contiguous()
print({'shape': tuple(p.shape), 'stride': p.stride()})`,
    buildSteps: [
      { title: '积木 1：写地址函数', body: '实现 `offset=index·stride+storage_offset`，对连续 `(2,3,4)` 手算一格。' },
      { title: '积木 2：实现排列校验', body: '检查 dims 长度、范围和唯一性，拒绝重复或漏轴排列。' },
      { title: '积木 3：同步置换元数据', body: '对 size 和 stride 应用同一排列，验证新旧对应坐标地址相等。' },
      { title: '积木 4：加入 movedim', body: '由 source/destination 推导完整排列，断言未移动轴相对顺序不变。' },
      { title: '积木 5：验证别名与写传播', body: '比较 storage 指针并修改唯一地址，检查 base 中对应元素。' },
      { title: '积木 6：测量物化边界', body: '比较直接消费与 contiguous 后重复消费，分开报告 copy 与 kernel 时间。' }
    ],
    selfCheckQuestion: '给定连续 `x.shape=(2,3,4)`、`x.stride()=(12,4,1)`，`y=x.permute(2,0,1)`的 shape、stride 与 `y[3,1,2]`的 storage offset 分别是什么？为什么不能写 `x.view(4,2,3)`替代？',
    selfCheckAnswer: 'shape 是 `(4,2,3)`，stride 是 `(1,12,4)`，offset 为 `3×1+1×12+2×4=23`，对应 x[1,2,3]。view 只在给定 size/stride 可合并拆分的连续子空间内改变形状；它不会把轴标签对应的 stride 一起置换，`x.view(4,2,3)`按线性顺序重新分组，取到的值排列不同。上线排查还应打印 shape、stride、offset、layout 和 Storage 指针：分别证明轴约定、置换、slice 起点、实现类别与是否复制。若证据变化先检查 sparse、nested 或 subclass 输入，不能因数值相等跳过布局回归。还要验证逆变换：令 q=y.permute(1,2,0) 后，应有 q 的轴标签恢复为原顺序、q 与 x 的每个对应索引值相等，且两者仍引用同一 Storage。若某段代码通过 `reshape` 恰巧得出相同 shape，故意填入可区分坐标如 `100*b+10*t+d`，即可暴露错误的线性重分组。性能验收最后以真实下游 kernel 为准：记录调用前后是否连续、是否产生 copy、一次消费和多次消费的端到端时间。生产事故中最常见的错误是把外部模型的轴约定当成本站约定：例如输入已经是 BHSD 却再次 movedim，数值维度仍可广播而语义完全错位。防线是把每一轴写成命名注释，入口断言 rank 和各轴长度，测试采用非对称 shape，并在输出中保留 layout report。'
  },

  'slice、select 与 narrow：storage_offset 和步长切片': {
    official: { title: 'PyTorch 2.13 · torch.Tensor.narrow', url: 'https://docs.pytorch.org/docs/stable/generated/torch.Tensor.narrow.html#torch.Tensor.narrow', note: 'narrow 在指定维度保留一个连续区间；Tensor Views 文档把 basic indexing、narrow 与 select 列为 view，并说明高级索引是 copy。' },
    source: { repo: 'pytorch/pytorch', file: 'aten/src/ATen/native/TensorShape.cpp', symbol: 'narrow', language: 'cpp', url: 'https://github.com/pytorch/pytorch/blob/v2.13.0/aten/src/ATen/native/TensorShape.cpp#L1621-L1642', code: `Tensor narrow(const Tensor& self, int64_t dim, int64_t start, int64_t length) {
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
}`,
      walkthrough: [
        '入口先拒绝标量和负 length，防止“空 view”被误当成越界内存。',
        '负 start 以当前维 size 标准化，随后检查 start+length 不超过边界。',
        'narrow 复用通用 slice，step 固定为 1；size 改为 length，stride 保持。',
        'slice 的实现最终依据旧 stride 增加 storage_offset，因而返回的普通张量与输入共享 Storage。'
      ] },
    overview: ['切片的关键并非“取出一些元素”，而是把一个逻辑坐标域缩小后仍嵌入原来的地址公式。`x[:, 1:4:2]`保留第 0 维 stride，把第 1 维 stride 乘以 2，并把第一个合法位置写进 storage_offset；因此它通常无 copy，却很容易产生洞与非连续布局。', '`select(dim,index)`删去一个维度，`narrow(dim,start,length)`保留连续区间，Python basic slice 支持 step。它们都适合把不规则布局继续交给支持 stride 的算子。索引列表、LongTensor、布尔 mask 属于 advanced indexing，官方明确把那条读取路径定义为 copy，切勿以写法相似推断别名。', '这门课把 select/narrow/basic slice 合并，因为三者使用同一套 size、stride、offset 合同；把它们分开只会重复边界检查和地址推导。把 advanced indexing 留给下一单元，能让“何时 copy”成为一个可验证的分界。'],
    chapters: [
      { kicker: '01 · OFFSET', title: 'slice 改了什么，保留了什么', paragraphs: ['对连续 `(3,5)`输入，`x[:,1:5:2]`的 size 从 `(3,5)`变 `(3,2)`，stride 从 `(5,1)`变 `(5,2)`，offset 从 0 变 1。新 `(2,1)`访问 `1+2×5+1×2=13`，正是旧 `(2,3)`。', '只看 `numel=6`会漏掉物理跨度：地址是 1,3,6,8,11,13，中间有洞。后续 `view(-1)`不一定成立，缓存一个小步长 slice 也仍可能保留大 base Storage。'], takeaway: 'offset 是起点，stride 是每步跨度，二者共同定义 slice 的物理窗口。' },
      { kicker: '02 · DIMENSION', title: 'select 为什么会降维', paragraphs: ['`select(1,2)`把第 1 维坐标固定成 2，因此那一项从坐标域中消失；offset 增加 `2×stride[1]`，其余 size/stride 删除对应条目。它仍能 alias base，但输出 rank 少一维，拼接和广播时要显式 `unsqueeze`。', 'narrow 不固定坐标，只缩小该维范围，所以 rank 保持。它在数据窗口、KV cache 截断与分块训练中常比手写 slice 更易审计：length 明确、负起点规范化、越界错误由 ATen 报告。'], takeaway: 'select 是固定一个坐标，narrow 是缩小一个坐标域；两者别名证据相同，shape 合同不同。' },
      { kicker: '03 · BOUNDARY', title: '空切片、负索引与 step 的边界', paragraphs: ['Python slice 的负索引、None 和负 step 有自己的规范化规则；PyTorch strided Tensor 不支持以负 stride 构造普通 view，因此反向切片不能照搬 NumPy 直觉。需要倒序时选择 `flip`，并承认它会分配。', '空 slice 的合法性与 narrow 不同：前者可产生 size 0 的 view，后者 length 必须非负且 start/length 仍受检查。服务接口若接受用户 index，应在 Python 侧先定义一致的半开区间合同，而不是依赖不同算子杂糅的异常文本。'], takeaway: '切片 API 的共同数学是半开区间；语言层的负步长能力却不能假定跨后端一致。' },
      { kicker: '04 · COPY LINE', title: 'basic 与 advanced indexing 的真正边界', paragraphs: ['`x[1:3, :]`、整数、ellipsis、None 组成的 basic indexing 通常形成 view；`x[[0,2]]`或 `x[mask]`要按任意索引收集元素，输出地址无法由一组固定 size/stride 表达，读取结果是 copy。赋值即使使用 advanced index 仍是对原 x 的 in-place scatter，这又是另一条语义。', '写性能测试时至少分别断言 Storage identity、写传播和峰值分配。只比较数值相等会把 copy 看成 view；只比较 `_base`也会被复合 view、subclass 和版本实现误导。'], takeaway: '“索引”不是一种操作；能否由仿射地址公式表达，才是 view/copy 的底层分界。' },
      { kicker: '05 · LIFETIME', title: '小窗口为何可能钉住大批数据', paragraphs: ['一个 1KB 的 `batch[:, :1]`可以继续引用数百 MB batch 的 Storage。Python 变量删除 base 只减少一个引用，window 的 Storage 引用仍存活；这在缓存日志特征、队列和 dataset 预取中很隐蔽。', '若窗口要跨请求、跨线程或长期保存，显式 `clone()`让其拥有独立缓冲区，并把复制预算写进接口。若仅在当前算子链内消费，保留 view 才能节省带宽。所有权选择应由生命周期而非“看起来小”决定。'], takeaway: '逻辑大小和被保留的物理 Storage 大小必须分别观测。' },
      { kicker: '06 · API CONTRACT', title: '把索引输入变成可审计的协议', paragraphs: ['线上服务不应把来自 HTTP、消息队列或配置文件的整数直接塞进 Tensor 索引。先把每个维的含义、允许负值、半开区间、空窗口是否有效写成业务合同，再在适配层统一标准化为非负 `start` 与明确 `length`。这样 `narrow` 的异常成为最后一道断言，而不是客户端靠猜异常字符串来判断请求错误。', '区分读与写也很关键。`y = x[index]`对 basic index 可借用 x 的 Storage；`x[index] = value`则是在 x 上执行赋值路径，即使 index 是 advanced index 也不能拿“读取结果是 copy”推导“写不会影响 x”。测试应分别验证读取后的 `data_ptr`、写后 x 的值，以及 advanced gather 的独立 Storage，三种现象服务于不同问题。', '对 batch 维做切分时，还应记录 base 的总字节数和 view 生命周期。一个看似无害的 `features[:1]`若被放入长生命周期缓存，可能把整批训练数据或请求缓冲区留在显存中。缓存边界选择 clone，短算子链保留 view；这是所有权策略，不是微优化偏好。', '最后把此合同写成参数化测试：对同一请求分别输入连续、转置、带 offset 的 base，比较规范化后的区间、地址集合和错误类别。只有三者一致，索引层才没有悄悄依赖默认连续布局。', '把这些断言固定在 CI，后续优化切片实现时仍能守住同一地址合同。'], takeaway: '索引 API 的可靠性来自统一边界、读写分离和生命周期可见性。' },
    ],
    mechanisms: ['narrow 通过 slice 统一实现，并先规范化负 start 与边界。', 'step slice 将该维 stride 乘 step，起点贡献写入 storage_offset。', 'select 删除固定维度；narrow 保留维度但缩小 size。', 'basic indexing 通常可表示为 view，advanced indexing 的读取是 gather copy。'],
    pitfalls: ['认为 slice 的 numel 等于占用或保留的 Storage 字节。', '把 basic 与 advanced indexing 的读取别名混为一谈。', '把 PyTorch 当作支持负 stride NumPy view。', '对长期缓存的窄 view 不审计其 base 生命周期。'],
    variants: [{ title: 'narrow：长度明确的窗口', useWhen: '实现分页、时间窗或协议字段切分，需要受控边界。', tradeoff: '接口稳定且错误清晰；只表示连续 step=1 区间。' }, { title: 'clone：生命周期隔离', useWhen: '小 slice 要脱离巨大 batch 长期缓存或跨所有权边界。', tradeoff: '解除 Storage 钉住风险，代价是显式 copy。' }],
    studyPlan: { readingMinutes: 25, sourceMinutes: 40, practiceMinutes: 55, reviewMinutes: 25 }, exampleLanguage: 'python',
    example: `import torch

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
assert x[[0, 2]].untyped_storage().data_ptr() != x.untyped_storage().data_ptr()`,
    buildSteps: [{ title: '积木 1：实现半开区间标准化', body: '把 start、stop、step 规范化，并为越界、空区间写测试。' }, { title: '积木 2：更新单维元数据', body: '推导 slice 后的 size、stride 与 offset，和 torch 对照。' }, { title: '积木 3：实现 select', body: '固定一维坐标、删除该维，验证 rank 与地址。' }, { title: '积木 4：实现 narrow', body: '复用 step=1 slice，加入负 start/length/标量失败测试。' }, { title: '积木 5：区分 gather', body: '为索引列表建立复制实现，断言它不共享 Storage。' }, { title: '积木 6：审计生命周期', body: '让 tiny view 指向 large base，报告 logical bytes 与 storage bytes。' }],
    selfCheckQuestion: '连续 `x.shape=(3,5)`、stride `(5,1)` 上执行 `x[:,1:5:2]`。写出输出 size、stride、offset，算输出 `(2,1)`地址；为什么 `x[[0,2]]`不能用相同三元组表示？',
    selfCheckAnswer: '输出是 size `(3,2)`、stride `(5,2)`、offset `1`，`(2,1)`地址为 `1+2×5+1×2=13`。索引列表沿第 0 维选择不连续且任意的坐标集合，通用 gather 不能只用每一维一个固定 stride 表达，也要分配新的紧凑输出；因此读取 `x[[0,2]]`是 copy，而基本 slice 仍可 alias。工程上还要分别报告 logical bytes 与它持有的 Storage nbytes：小窗口可能钉住大 batch。跨请求缓存时 clone 的复制成本往往更低；一次同步链内立即消费则保留 view，避免小块 allocator 压力。对外接口用半开区间 `[start, stop)`，将负 index、空窗口和越界在一处规范化；记录原始与规范化参数，避免日志中的负索引无法复现。回归表要包含连续输入、转置输入、步长 slice 和 offset 非零的 slice，分别断言地址、值、写传播与异常，才能证明实现没有只在默认连续输入上正确。还应把 basic 读取、advanced 读取和 assignment 分成三组测试：后两者的语法可能相近，但 gather copy 与向原对象 scatter 的所有权方向完全不同。为避免隐藏 copy，profile 中应明确标出 index、slice、narrow 和后续消费 kernel；只要接口承诺借用，就让非连续输入也作为持续回归样本。'
  },

  'expand 与 repeat：零 stride 广播和真实物化': {
    official: { title: 'PyTorch 2.13 · torch.Tensor.expand', url: 'https://docs.pytorch.org/docs/stable/generated/torch.Tensor.expand.html#torch.Tensor.expand', note: 'expand 把 size 为 1 的维扩到更大范围并把该维 stride 置为 0，不分配新内存；官方警告 expanded view 的原地写会让多个逻辑元素写同一地址。' },
    source: { repo: 'pytorch/pytorch', file: 'aten/src/ATen/native/TensorShape.cpp', symbol: 'expand', language: 'cpp', url: 'https://github.com/pytorch/pytorch/blob/v2.13.0/aten/src/ATen/native/TensorShape.cpp#L1297-L1324', code: `Tensor expand(const Tensor& self, c10::IntArrayRef size, bool /*unused*/) {
  TORCH_CHECK(size.size() >= (size_t)self.dim(), "expand rank is too small");
  TORCH_CHECK(!self.is_sparse() && !at::sparse_csr::is_sparse_compressed(self),
              "expand is unsupported for this layout");
  // 新 size 与 0-stride 由广播规则推导；不读取或复制元素。
  auto geometry = inferExpandGeometry_dimvector(self.sizes(), self.strides(), size);
  // 与 permute 相同，as_strided 创建共享同一 Storage 的 view。
  return self.as_strided(geometry.sizes, geometry.strides);
  // geometry 包含目标 size 与每一维新 stride。
  // singleton 扩张维的 stride 会被设为 0。
  // 此处不运行 repeat、memcpy 或 allocator。
  // 下游可选择直接消费或另行物化。
  // 普通 strided view 继续共享 Storage。
}`,
      walkthrough: [
        '入口要求目标 rank 不小于输入 rank，并拒绝不支持 stride 概念的 sparse layout。',
        'inferExpandGeometry 从末维对齐，只有 size=1 的旧维可以扩张；`-1`保留已有维度。',
        '可扩张的维写入 stride=0，使任何该轴索引贡献同一地址。',
        'as_strided 返回 view；真正的 full materialization 由 repeat、clone 或需要输出的下游算子承担。'
      ] },
    overview: ['广播是“让一个标量或一行逻辑上出现在许多位置”，并不要求先把它复制成大矩阵。`expand`把原 size=1 的轴映射成 stride 0：无论该轴索引是 0 还是 999，地址增量都是 0。读操作因而廉价，地址重复却让写语义失去一一对应。', '`repeat`的目标外观常与 expand 相同，物理策略相反：它把数据平铺到新 Storage。选择由所有权和写需求决定。只读偏置、mask、条件向量适合 expand；需要逐元素独立写、导出独立缓冲区或向不支持零 stride 的外部库交接时，repeat/clone 的 copy 是合同的一部分。', '本课把 expand 与 repeat 合并，是因为二者只有对照才显出“广播”与“物化”的边界；单讲 expand 容易把零 stride 当成小技巧，单讲 repeat 又会掩盖不必要的显存成本。'],
    chapters: [
      { kicker: '01 · ZERO STRIDE', title: '零 stride 不是零大小', paragraphs: ['`x.shape=(3,1)`、stride `(1,1)`执行 `expand(3,4)`后 size 为 `(3,4)`、stride 为 `(1,0)`。逻辑 `(2,0)`与 `(2,3)`都映射到元素 2；numel 从 3 变 12，Storage 字节仍只覆盖 3 个元素。', '把零 stride 代入地址公式比记规则可靠：`offset=i×1+j×0`。这也解释了为什么输出的多个位置值同步变化，它们根本不是多个存储槽位。'], takeaway: 'expand 扩张坐标域，零 stride 让新坐标复用旧地址。' },
      { kicker: '02 · WRITE', title: '为何向 expanded view 原地写危险', paragraphs: ['向一个逻辑 `(3,4)`张量逐元素写入，直觉要求 12 个独立地址；zero stride 只给 3 个地址，向量化 in-place 操作的结果依赖迭代顺序。官方将此定义为可能不正确的行为，并建议写前 clone。', '某些操作会主动拒绝内部重叠，拒绝并不等于所有操作都安全。工程规范应更强：凡结果要独立可写，先 `clone()`或直接构造目标 Tensor；不要以“当前版本没报错”作为正确性证据。'], takeaway: 'read-only 广播安全，独立写需要独立 Storage。' },
      { kicker: '03 · AUTOGRAD', title: 'backward 为什么会 sum 回 singleton 轴', paragraphs: ['forward 将一个 bias `(C,1,1)`应用到 `(N,C,H,W)`，同一 bias 元素参与 N×H×W 个加法。反向对该 bias 的梯度必须沿广播的三个维度求和，这不是优化细节，而是同一地址在计算图上被使用多次的链式法则。', '自己实现广播算子时，先右对齐 shape，记录哪些轴是新加或旧 size=1，backward 对这些轴 reduce_sum，再 reshape 回原输入 shape。只靠 PyTorch 自动广播写测试不足以学会该不变量。'], takeaway: 'zero stride 的地址别名与 backward 的梯度归约，是同一个多对一映射的两面。' },
      { kicker: '04 · MATERIALIZE', title: 'repeat、clone 与 expand_copy 的取舍', paragraphs: ['repeat 以重复因子描述目标并产生独立元素，适合后续会修改每一份的场景；它不要求原维 size=1。`expand().clone()`通常得到紧凑独立副本，表达“先按广播逻辑定义结果，再取得所有权”。', '如果外部算子只接受 contiguous，明确物化能把代价放在边界处；若消费者本就支持 broadcast stride，提前 repeat 只会把带宽和峰值内存扩大。profile 应报告逻辑 shape、真实 storage bytes 与物化发生点。'], takeaway: '相同数值形状不等于相同所有权；API 名称必须携带是否 materialize 的意图。' },
      { kicker: '05 · DEPLOYMENT', title: '布局与后端边界', paragraphs: ['expand 的 native 实现拒绝 sparse/sparse-compressed，文档也提示某些操作会被迫 materialize。自定义 C++/CUDA kernel 若对每个输出索引直接按输入 stride 取址，可以支持 zero stride；若假定地址唯一或线性递增，必须拒绝或复制。', '图编译与导出路径同样要把 stride/alias 视为输入合同。用连续训练样本捕获到的图，换成 expanded 输入后可能落到不同 kernel、触发 guards 或产生 hidden copy；部署回归要包含这类布局。'], takeaway: '广播支持是算子能力的一部分，接口应声明而非暗中猜测。' },
      { kicker: '06 · MEASURE', title: '用三组观测分辨广播收益与隐藏复制', paragraphs: ['第一组观测是地址：对 `(C,1,1)` bias expand 后，比较 `untyped_storage().data_ptr()`并枚举同一通道不同 H/W 的地址，确认它们相同。第二组是所有权：对 `repeat`和 `expand().clone()`确认地址不同，并在一个逻辑位置写入后检查邻居不再同步。第三组才是性能：分别计时 view 创建、消费者 kernel 和显存峰值，不能把三段累计成“expand 的耗时”。', '广播正确性还可手推一个反向例子。令 `b=[[2]]`扩展到 `(2,3)`并计算 `loss=(expanded * w).sum()`，则 `db`必须等于 w 六个位置之和。若自定义 kernel 或扩展把 expanded 输入当作普通连续数组读取，前向值可能看似正确，反向却会错过该归约；这正是 stride 作为算子合同的原因。', '部署端的保守策略是：算子明确支持任意 strided/broadcast 输入时保留 expand；接口要求写入、唯一地址、连续缓冲区或跨运行长期持有时，在明确边界物化，并把 bytes 写进 telemetry。看见 hidden copy 后应先确认消费者约束，再决定改布局或改 kernel。', '还要在接口日志中区分逻辑元素数与实际分配量。一次 repeat 可能把很小的参数扩成整批激活大小；一次 expand 则可能把成本推迟到一个不透明的消费者。两类事件都应有独立计数。'], takeaway: '广播优化要同时证明别名、梯度归约和端到端物化位置。' },
    ],
    mechanisms: ['expand 仅允许把 size=1 维扩张，新增前导维也可出现。', '扩张维 stride=0，所有该维坐标映射到同一地址。', 'repeat 分配新 Storage；expand 保留原 Storage。', '反向沿 expanded/singleton 维求和，恢复原 shape。'],
    pitfalls: ['对 expanded view 原地向量化写。', '把 `numel`增长误认为显存已经增长。', '用 repeat 代替可被下游直接消费的 expand。', '假设 sparse 或自定义后端也实现了 zero stride。'],
    variants: [{ title: 'expand：借用式广播', useWhen: '只读 bias、mask 或参数要被支持 stride 的算子消费。', tradeoff: '零分配且可省带宽；写入和某些后端不安全。' }, { title: 'repeat / expand().clone()', useWhen: '每个逻辑位置需要独立所有权或独立原地修改。', tradeoff: '语义直接且兼容外部缓冲区，代价与扩张后 numel 成正比。' }],
    studyPlan: { readingMinutes: 25, sourceMinutes: 45, practiceMinutes: 60, reviewMinutes: 20 }, exampleLanguage: 'python',
    example: `import torch

base = torch.tensor([[10.], [20.], [30.]])
expanded = base.expand(3, 4)
assert expanded.stride() == (1, 0)
assert expanded.untyped_storage().data_ptr() == base.untyped_storage().data_ptr()
assert expanded[2, 0] == expanded[2, 3] == 30

owned = expanded.clone()
owned[2, 3] = -1
assert base[2, 0] == 30  # clone 后写入不回传
repeated = base.repeat(1, 4)
assert repeated.untyped_storage().data_ptr() != base.untyped_storage().data_ptr()`,
    buildSteps: [{ title: '积木 1：右对齐 shape', body: '实现广播维对齐，拒绝两个非 1 且不相等的维。' }, { title: '积木 2：生成 zero stride', body: '把可扩张的 size=1 维写为目标 size 与 stride 0。' }, { title: '积木 3：穷举地址', body: '枚举小 expanded view，证明多组索引得到同一 offset。' }, { title: '积木 4：实现只读二元算子', body: '让每个输入各自按 stride 取值，避免提前复制。' }, { title: '积木 5：实现 backward reduce', body: '对扩张轴求和，和 autograd 的结果逐项对照。' }, { title: '积木 6：比较物化', body: '对 expand、repeat、clone 报告 Storage identity、bytes 和写传播。' }],
    selfCheckQuestion: '为什么 `bias.expand(batch, channels)`的 forward 可以零拷贝，而它对 bias 的梯度却需要 reduce_sum？若业务要修改每个 batch 行的 bias，选择什么实现并如何验证？',
    selfCheckAnswer: 'expand 只把 singleton batch 轴的 stride 设为 0，每一行读取同一 bias 地址，因此不用复制；反向中同一 bias 元素影响了每行输出，链式法则要求把每行的贡献相加。需要每行独立写时使用 `repeat`或 `expand(...).clone()`获得新 Storage，验证输出 storage 指针不同，并修改一行后断言其他行与原 bias 不变。还要检查消费者是否接受 zero stride：任意 stride 的逐元素 kernel 可直接读取；假定地址唯一的 kernel 必须拒绝或物化。报告应同时记录 base bytes、物化 bytes、归约轴和复制算子名。一个实用反例是把 `(1,C,1,1)`参数扩成 `(N,C,H,W)`后试图用原地 dropout mask 修改；这会把本应独立的空间位置折叠到同一参数地址。正确做法是在算子内部生成独立输出或先 clone，并用反向梯度与数值的 reference repeat 实现对照。这样既能保留只读广播的带宽优势，也能把写边界变得可审计。对模型参数，重复后的独立 buffer 还会改变 optimizer state 的数量和 checkpoint 大小，因而不能为避开一个 stride bug 就把可学习参数无条件 repeat。每次广播都应写明它是参数共享还是数据复制。'
  },

  'as_strided：滑窗能力、越界检查与重叠写未定义行为': {
    official: { title: 'PyTorch 2.13 · torch.as_strided', url: 'https://docs.pytorch.org/docs/stable/generated/torch.as_strided.html#torch.as_strided', note: 'as_strided 以显式 size、stride、storage_offset 创建 view。官方建议优先使用高层 view API，并警告越界会报错、重叠 view 的原地操作行为未定义。' },
    source: { repo: 'pytorch/pytorch', file: 'aten/src/ATen/native/TensorShape.cpp', symbol: 'as_strided_tensorimpl', language: 'cpp', url: 'https://github.com/pytorch/pytorch/blob/v2.13.0/aten/src/ATen/native/TensorShape.cpp#L1361-L1375', code: `Tensor as_strided_tensorimpl(
    const Tensor& self, IntArrayRef size, IntArrayRef stride,
    std::optional<int64_t> storage_offset_) {
  auto storage_offset = storage_offset_.value_or(self.storage_offset());
  // VIEW 构造保留同一 Storage，而非分配 output buffer。
  auto result = at::detail::make_tensor<TensorImpl>(
      c10::TensorImpl::VIEW, Storage(self.storage()), self.key_set(), self.dtype());
  // 安装调用者给出的地址合同；边界检查由后续 setStrided 路径承担。
  setStrided(result, size, stride, storage_offset);
  return result;
  // 输出 TensorImpl 是 VIEW，Storage 引用仍来自 self。
  // stride 的单位是元素而不是字节。
  // 派生的连续性元数据会随 size/stride 刷新。
  // API 不为 overlap 写入定义次序。
  // 特殊后端可能有自己的实现。
  // 高层 view API 会收窄可构造的映射。
  // 调用者仍需证明范围和别名关系。
  // 数据指针的所有权没有在这里转移。
  // autograd 还会维护额外的 view 元数据。
  // 范围检查、overlap 分类和消费模式应一起进入接口门禁。
  // 读窗口与梯度归约可用，原地写必须有独立所有权。
}`,
      walkthrough: [
        '若调用者省略 offset，入口继承输入 view 的 offset，而不是 Storage 起点。',
        '实现用相同 Storage 构造 VIEW 型 TensorImpl，保留 dtype 与 dispatch keys。',
        'setStrided 安装 size/stride/offset 并进行合法性检查；构造超出底层 Storage 的范围会失败。',
        '实现没有也无法为任意地址映射推导业务写语义，因此内部重叠的原地操作被文档列为未定义。'
      ] },
    overview: ['所有普通 view 都可看作对 size、stride、offset 的受限改写；`as_strided`把这三个旋钮直接交给你。它能用一维信号构造滑动窗口、用图像特征构造局部 patch，也能在一个字符间把多个逻辑元素映射到同一字节。强大来自没有替你选择布局，风险也来自没有替你选择。', '安全使用 as_strided 的第一步不是调用 API，而是证明地址范围。对非负 stride，最小 offset 是 storage_offset，最大 offset 是 `storage_offset + Σ((size[i]-1)×stride[i])`。最大值必须小于 Storage 可用元素数；size=0 要单独处理，因为没有任何可读元素。', '本课独立成专家专题，因为滑窗、边界、内部重叠、autograd 和后端可移植性属于同一个地址合同。把它并入普通切片会让最危险的写语义在“高级用法”一句话里消失。'],
    chapters: [
      { kicker: '01 · CONTRACT', title: '三元组怎样定义一个 view', paragraphs: ['size 定义每个逻辑轴的合法坐标范围，stride 定义每个坐标增量，offset 定义第一个逻辑元素。对 `base=arange(6)`，`as_strided((4,3),(1,1))`把窗口 0..2、1..3、2..4、3..5 映射到同一 Storage。', '这不是复制四个窗口；输出 12 个逻辑位置只引用 6 个物理元素。读窗、卷积 im2col 的教学推导因此可以零拷贝，后续把窗口交给会写或要求不重叠的算子则必须重新评估。'], takeaway: 'as_strided 描述地址映射，不描述“数组形状应该长什么样”。' },
      { kicker: '02 · RANGE', title: '先做范围证明，再构造', paragraphs: ['对所有 stride 非负的普通 Tensor，地址最大端点可按每一维最大坐标累加。再乘 element_size 只是将元素单位换成字节，检查时应和 storage 的元素容量使用同一单位。负 stride、symbolic shape、meta Tensor 与特殊 layout 不应被这份简化证明覆盖。', '不能用 `numel`检验范围。size `(2,2)`、stride `(10,1)`只有四个逻辑值，却可能触及 offset 11。也不能只检验首地址；一个合法起点加上宽 stride 一样会越界。让教学实现先拒绝复杂情况，比假装通用更诚实。'], takeaway: '范围安全是 max reachable offset 与 Storage 容量的比较，而非 numel 比较。' },
      { kicker: '03 · OVERLAP', title: '为什么滑窗读安全，写却没有单一答案', paragraphs: ['滑窗的 `(1,1)`stride 令 output[0,1] 和 output[1,0]同指 base[1]。读取时两次看到同一个值完全合理；若对整个 output 做 in-place 加法，base[1]被加一次还是两次取决于实现遍历与并行化，不能定义成稳定 API。', '有些运算通过 overlap 检查拒绝，有些路径可能运行，二者都不能把未定义变成允许。若需要把每个窗口的结果写回，应使用 out-of-place reduction、`unfold`配合明确 scatter/reduce，或 materialize 独立 buffer。'], takeaway: '地址集合有重复时，读取是多视角，写入则缺少唯一的目标元素。' },
      { kicker: '04 · AUTOGRAD', title: '梯度是重叠读的正确归约方式', paragraphs: ['将重叠窗口参与纯函数计算时，backward 会把多个窗口位置对同一个 base 元素的梯度相加。这正是数学上的 scatter-add，不等价于 forward 对 view 原地写。用 `gradcheck`或手工计数可验证中间元素比边缘元素获得更多贡献。', '自定义 Function 保存 as_strided view 时仍要保存必要 metadata 与 base 版本。对 base 或 view 做破坏性原地修改会让 saved tensor 与 forward 不一致；应让 autograd 的版本检查报错，而非用 `.data` 绕开。'], takeaway: '重叠读的梯度归约有明确数学定义，重叠原地写没有。' },
      { kicker: '05 · PORTABILITY', title: '高层 API 何时更可靠', paragraphs: ['官方建议优先 `view`、`expand`等高层操作，因为某些后端没有一般 stride 概念，as_strided 会失败，且手工布局依赖当前 memory layout。`unfold`能表达常见滑窗并让意图可读；若要部署到多后端，应优先从它开始。', '性能层面，zero-copy patch view 可能让后续矩阵乘接收高度非连续、重叠输入并触发隐式 copy。高质量实现应同时测 view 创建、后续 kernel、峰值内存和数值/梯度一致性，而不是只炫耀“创建 O(1)”。'], takeaway: 'as_strided 是底层证明工具；优先可表达同一意图的受限 API。' },
      { kicker: '06 · DIAGNOSTIC', title: '把地址图变成可审计输出', paragraphs: ['调试小 view 时，枚举每个逻辑索引及其 offset，按 offset 分组。单元素组表示无重叠，多元素组表示写风险，排序有缺口表示不 dense；这让 alias 从直觉变成证据。', '大 Tensor 不能穷举时，仍记录 Storage bytes、最大可达 offset、读写模式和 materialization。遇到符号 shape 或 subclass 而无法证明时，退回高层 API 或拒绝。'], takeaway: '小张量穷举建立直觉，运行时门禁保存同一不变量。' },
      { kicker: '07 · DESIGN', title: '滑窗算子的可维护接口', paragraphs: ['业务 API 应暴露 window_size、step、read_only，内部优先 unfold；只有确有额外布局要求时才暴露 as_strided 三元组。调用方不应同时拥有任意 stride 与原地写权限。', '测试覆盖最小长度、贴边窗口、空输入、越界、重叠读、梯度计数和非连续 base。优化可以改写内部实现，却必须维持可见的地址、数值与失败合同。'], takeaway: '把危险自由度封装成受限参数，零拷贝才可维护。' },
      { kicker: '08 · REVIEW GATE', title: '让危险原语经过两道证明门', paragraphs: ['第一道门检查可达范围。教学版只接受非负 stride、普通 strided Storage 与已知整数 shape，逐维累加 `(size_i-1)*stride_i`，再加 storage_offset，并与 Storage 元素容量比较。空维要单独处理，因为它没有可访问元素；不要让 max 公式在空集合上伪造一个地址。真实框架还要面对符号 shape、负 stride 语义和各后端限制，因此业务代码应尽量调用受限高层 API。', '第二道门检查写入唯一性。对小输入枚举所有 logical index，按 storage offset 分桶；任一桶出现两个 index 就标为 read-only。生产大张量可采用结构性判断与保守拒绝，宁可让调用方 materialize，也不能用一次没有报错的 in-place 运行证明没有数据竞争。GPU 并行调度会让这类错误比 CPU 循环更不稳定。', '代码审查时追问四件事：这个三元组是否可由 `unfold`、`narrow`、`transpose`表达；最大地址是否有测试；输出是否会被写入或传给会写的库；性能测量是否包含随后的消费者。四个答案中任一模糊，就把自由度收回到受限接口。', '范围证明还要保留 dtype 与 storage_offset 的上下文：offset 的单位是元素，诊断 bytes 时才乘 element_size。把单位混用会在 float16、int8 或非零 offset 输入上给出貌似合理却错误的安全结论。对于需要跨进程共享缓冲区的场景，也必须把 base 的生命周期和只读约束传递出去，不能只序列化 shape、stride 这两个描述字段。', '最后加入反例回归：同一套检测必须拒绝越界与重叠写，并允许安全的非重叠只读窗口。', '审查记录应保留这次选择的高层替代方案和拒绝原因，使风险判断可以复盘。'], takeaway: 'as_strided 的工程价值来自可证明的读映射；写权限必须另行获得。' },
    ],
    mechanisms: ['as_strided 的 VIEW TensorImpl 共享 Storage、dtype 与 dispatch keys。', '非负 stride 的最高可达 offset 由每维 `(size-1)*stride`累加。', '不同逻辑索引可映射同一地址，形成 internal overlap。', '读取与反向累计可以有定义，重叠 in-place 写不具可移植语义。'],
    pitfalls: ['把 numel 当成 Storage 范围证明。', '对滑窗 view 做 in-place 或让未知库函数原地写。', '忽略继承的 storage_offset，误把 view 当成 base 开头。', '把 CPU 上可运行当成所有后端的 API 承诺。'],
    variants: [{ title: 'unfold：受限滑窗', useWhen: '需求是沿一个维度以固定 size/step 生成窗口。', tradeoff: '意图清晰并减少手工错误；不能覆盖任意多维自定义映射。' }, { title: 'materialize 后写', useWhen: '每个 patch 都要独立变换、原地修改或交给只支持连续输入的库。', tradeoff: '获得唯一地址与后端兼容，代价是完整复制和峰值内存。' }],
    studyPlan: { readingMinutes: 25, sourceMinutes: 45, practiceMinutes: 65, reviewMinutes: 40 }, exampleLanguage: 'python',
    example: `import torch

base = torch.arange(6.0, requires_grad=True)
windows = torch.as_strided(base, size=(4, 3), stride=(1, 1))
assert windows.untyped_storage().data_ptr() == base.untyped_storage().data_ptr()
assert torch.equal(windows[1], torch.tensor([1., 2., 3.]))

loss = windows.sum()
loss.backward()
assert torch.equal(base.grad, torch.tensor([1., 2., 3., 3., 2., 1.]))

try:
    torch.as_strided(base, size=(2, 2), stride=(10, 1))
except RuntimeError:
    pass
else:
    raise AssertionError('越界地址必须被拒绝')`,
    buildSteps: [{ title: '积木 1：实现非负 stride 地址公式', body: '从 size、stride、offset 得到任意小坐标的 Storage index。' }, { title: '积木 2：实现范围检查', body: '计算最大可达 offset，覆盖标量、空 size、越界和 offset 继承。' }, { title: '积木 3：构造一维滑窗', body: '用 `(4,3),(1,1)`对照 unfold，逐元素验证。' }, { title: '积木 4：检测重叠', body: '枚举小 view 地址，统计重复 index，拒绝写模式。' }, { title: '积木 5：实现 out-of-place backward', body: '为每个窗口梯度做 scatter-add，验证三角形计数。' }, { title: '积木 6：比较 materialize', body: '比较直接 view 与 clone 后消费的峰值、时间和 kernel 支持。' }, { title: '积木 7：加入后端门禁', body: '在接口中声明仅支持 strided CPU/CUDA，并为不支持 layout 报清晰错误。' }],
    selfCheckQuestion: '一维 Storage 有 6 个元素，`size=(4,3), stride=(1,1), offset=0`为何范围安全却内部重叠？若所有窗口元素求和，base 的梯度为什么是 `[1,2,3,3,2,1]`？',
    selfCheckAnswer: '最高地址为 `(4-1)×1+(3-1)×1=5`，在 0..5 内，所以范围安全。窗口 [0:3]、[1:4]、[2:5]、[3:6] 共享中间地址，因此内部重叠。求和的每个窗口位置梯度为 1，base[0]只被第一个窗读取一次，base[1]被前两个读取两次，中间 2、3 被三个窗读取三次，随后对称减少；这是 out-of-place scatter-add 的数学梯度，不授权对 windows 原地写。若输入本身是 slice，省略 offset 时新 view 继承 slice 起点而非回到 Storage 零号元素。跨后端接口应声明只支持 strided Tensor，否则这个范围证明没有共同语义。更完整的安全门禁先拒绝负 size、rank 不匹配和非整数 stride；其次对非空 view 计算最高可达元素位置；最后在允许写时检测重复 offset。若返回的是只读 view，也把 `may_overlap=true`随对象或日志传递给下游，避免后来维护者把一个合法读窗口误用为可写工作区。任何需要独立 patch 的模型算子，应在边界 materialize，并将那笔 bytes、时间、内存峰值与数值回归一并纳入性能合同。另一个常见误解是以为 as_strided 可替代所有 reshape：reshape 的合法别名路径由连续子空间决定，as_strided 虽能伪造某个 shape，却可能改变逻辑值顺序。教学实现必须先拿 index 到原值的映射做对照，再讨论性能；不能只因输出 shape 正确就接受实现。另一个测试把一个已偏移的 slice 作为输入，分别省略和显式传入 offset，验证两个结果的首元素与最高元素都落在预期位置；这能抓住许多将 offset 当作相对值而非 Storage 绝对元素位置的实现错误。性能对比还必须包含直接 unfold、as_strided view 和 clone 后紧凑 buffer 三条路径，分别报告创建成本、消费成本和峰值内存。'
  },

  'clone、contiguous 与 to：显式物化、所有权和设备迁移': {
    official: { title: 'PyTorch 2.13 · Tensor Views / Tensor.contiguous', url: 'https://docs.pytorch.org/docs/stable/tensor_view.html#tensor-views', note: '官方说明 `contiguous()`在输入已按请求 memory format 连续时返回自身，否则复制；view 文档也提示 reshape/flatten 可能 view 或 copy，显式 materialization 应成为可见的接口边界。' },
    source: { repo: 'pytorch/pytorch', file: 'aten/src/ATen/native/TensorProperties.cpp', symbol: 'contiguous', language: 'cpp', url: 'https://github.com/pytorch/pytorch/blob/v2.13.0/aten/src/ATen/native/TensorProperties.cpp#L137-L146', code: `Tensor contiguous(const Tensor& self, MemoryFormat memory_format) {
  if (self.is_contiguous(memory_format)) {
    // 已符合目标布局：返回同一 Tensor，不分配也不改变 autograd 历史。
    return self;
  }
  TORCH_CHECK(memory_format != MemoryFormat::Preserve,
              "contiguous expects a concrete memory format");
  // clone 负责分配并按目标 memory_format 复制。
  return self.clone(at::MemoryFormat::Contiguous);
  // clone 为结果请求独立 Storage。
  // 它按当前逻辑值顺序写入目标布局。
  // 默认 contiguous 只是一个具体 memory format。
  // 已连续分支没有 allocator 成本。
  // to 的 dtype/device copy 在另一路径处理。
}`,
      walkthrough: [
        'contiguous 先按指定 memory format 检查缓存布局属性，已连续时直接返回 self。',
        'Preserve 不是具体的连续遍历顺序，因此这里拒绝它。',
        '不连续输入走 clone，产生独立 Storage；对 channels_last 等格式，上游完整实现选择相应路径。',
        '`to`还叠加 device、dtype、non_blocking 与 copy 标志，是否别名必须按目标属性逐项判断。'
      ] },
    overview: ['前四课关注如何借用同一 Storage；这一课讨论何时有理由结束借用。`clone`总是创建独立数据，`contiguous`仅在目标布局不满足时复制，`to`在 dtype/device 等目标已匹配且未强制 copy 时可以返回原 Tensor。它们的输出值可能相同，所有权、布局、传输与 autograd 身份却不同。', '显式物化像在数据管线里签收货物：从此刻起谁拥有缓冲区、花了多少带宽、布局为何可被下游假定，都应可观察。把 copy 隐藏在 reshape、外部库绑定或 `.cpu().numpy()`深处，会让显存峰值和延迟在生产中才显形。', '这一课把 clone、contiguous、to 合并，是因为它们共同构成 materialization 的决策面：独立所有权、指定布局、以及跨 dtype/device。分开讲会让学习者只背“某函数会复制”，却不能设计有成本边界的接口。'],
    chapters: [
      { kicker: '01 · IDENTITY', title: '值相同、对象相同、Storage 相同', paragraphs: ['`clone()`的值相同、Python 对象不同、Storage 不同；`contiguous()`对已连续输入可能三者都相同；`to(dtype=同 dtype, device=同 device)`默认也可能直接返回原对象。测试必须按合同选择 `is`、Storage 指针、stride、dtype/device 与 `torch.equal`，不能只断言最后一项。', '对于 slice，Tensor.data_ptr 可能受 offset 影响；跨 view 判断拥有同一底层缓冲区应比较 untyped storage 指针和 device。CUDA 还需用 allocator 指标观察真实分配，CPU 的 OS RSS 不必立即下降。'], takeaway: 'materialization 测试至少覆盖对象、Storage、值、布局和设备五层证据。' },
      { kicker: '02 · CONTIGUOUS', title: 'contiguous 是条件复制，不是格式化咒语', paragraphs: ['默认连续性要求最后一个非 size-1 维 stride 为 1 并向前递推。transpose 常破坏这个顺序，`contiguous()`会按当前逻辑值顺序新建默认连续 buffer；输入已经连续时它直接返回 self。', 'channels_last 是另一种连续记忆格式。`is_contiguous()`为 false 并不意味着 `is_contiguous(memory_format=torch.channels_last)`也为 false。服务代码要声明消费者需要哪个 format，不能在每一层无条件转回默认格式。'], takeaway: 'contiguous 的 copy 条件依赖目标 memory format；默认连续只是其中一种。' },
      { kicker: '03 · TO', title: 'to 同时可能是 cast、搬运和 copy', paragraphs: ['`to(device, dtype, non_blocking, copy, memory_format)`把多个变换揉在一个接口中。目标 dtype/device/layout 不变且 `copy=False`时，它可别名返回；dtype 改变必须新解释为另一元素宽度，设备改变需要跨设备传输，`copy=True`则强制独立副本。', 'CUDA 的 `non_blocking=True`只是允许异步条件的请求，不是普遍速度开关。CPU page-locked、stream 依赖、源 buffer 生命周期与后续同步决定能否重叠。计时要在正确 stream 同步后做，不能把排队时间误报成传输完成。'], takeaway: 'to 的名字不等于总会复制；目标属性和 copy 参数才决定别名边界。' },
      { kicker: '04 · AUTOGRAD', title: '复制怎样连接或切断计算图', paragraphs: ['clone 与可微 dtype/device copy 通常保留梯度路径，输出有对应 grad_fn；它们创建的是新数据，不是新的学习起点。要切断历史必须显式 `detach()`，要得到独立叶子常用 `detach().clone().requires_grad_(True)`并说明原因。', '原地修改 clone 不会改变原 Tensor 的值，但如果两者都在图中，梯度关系仍需要按操作链推导。不要用 `.data`伪造“无梯度复制”，它会绕过版本计数并可能让 backward 使用被篡改的保存值。'], takeaway: '内存独立和计算图独立是两种选择，clone 只解决前者。' },
      { kicker: '05 · ENGINEERING', title: '把 copy 变成预算而非意外', paragraphs: ['每个性能敏感接口应选择一种明确合同：`accept_strided`直接消费任意 stride；`require_contiguous`检查后报错；`normalize_contiguous`复制并返回 bytes/materialized 指标。三种都合理，危险的是第三种藏在函数内部且无人监控。', '基准把 CUDA synchronize、warmup、真实 layout、copy bytes 与 kernel 时间写入报告。生产指标可统计 materialization 次数、峰值 memory、H2D/D2H bytes；当数据布局变更使 `contiguous`从 no-op 变 copy 时，告警才能在成本扩散前出现。'], takeaway: '高效不是永远不复制，而是复制发生在明确、可测量、可承担的边界。' },
      { kicker: '06 · DECISION TABLE', title: '先问“谁拥有字节”，再调用复制 API', paragraphs: ['同一 device、dtype、layout 且 `copy=False`时，`to`可以返回原 Tensor；这意味着调用方不能把 `to(device)`当作隔离所有权的承诺。需要隔离时选择 clone 或 `to(..., copy=True)`并验证 Storage 指针变化。需要切断梯度历史时，先决定是否要保留值：`detach()`借用同一存储，`detach().clone()`才同时得到独立字节和新的 leaf。', '连续性也应按消费者要求而非习惯决定。若下游支持任意 stride，保留 transpose/slice view 可以省带宽；若下游 kernel 的索引公式假设某个 memory format，入口应检查 `is_contiguous(memory_format=...)`，失败时明确复制或返回可操作错误。把 `.contiguous()`散落在中间层会让性能剖析失去因果线索。', '建立回归表时覆盖三种输入：连续 base、transpose 的非连续 view、expand 的零 stride view。每种都报告对象身份、Storage identity、stride、逻辑 bytes、实际分配 bytes、`grad_fn`和消费时间。只有这张表能区分“数值没变”的五种不同语义，也能解释为何某次升级突然多了显存峰值。', '跨设备时还需把 copy 与同步拆开观测：H2D/D2H 的分配、stream 等待、pinned host memory 和目标布局各有成本。一个看似只是 `to(...).contiguous()` 的表达式可能同时完成 cast、传输和重排，诊断时应分段记录。'], takeaway: 'clone、contiguous 与 to 是所有权和布局的显式决策，值相等从来不是充分证据。' },
    ],
    mechanisms: ['clone 产生独立 Storage 并按指定 memory format 复制逻辑值。', 'contiguous 已满足目标格式时返回 self，否则 clone。', 'to 根据 device、dtype、layout 和 copy 参数选择别名或转换/传输。', '数据独立不等于 detach；梯度路径需单独设计。'],
    pitfalls: ['把每个 non-contiguous Tensor 都立即 contiguous。', '假定 to 总是新建 Tensor，或假定 non_blocking 必然异步完成。', '以 `.data`绕开 autograd 的版本安全。', '只测连续输入，漏掉真实 transpose/expand/slice 的 hidden copy。'],
    variants: [{ title: '严格布局接口', useWhen: '自定义 kernel 无法正确处理任意 stride，且复制成本不可接受。', tradeoff: '失败早、成本可预测；调用者必须在上游安排布局。' }, { title: '规范化布局接口', useWhen: '产品优先兼容输入，同时允许可观测的复制预算。', tradeoff: '调用简单；需暴露 materialized/bytes/latency，避免静默退化。' }],
    studyPlan: { readingMinutes: 25, sourceMinutes: 45, practiceMinutes: 50, reviewMinutes: 30 }, exampleLanguage: 'python',
    example: `import torch

base = torch.arange(12., requires_grad=True).reshape(3, 4)
transposed = base.transpose(0, 1)
packed = transposed.contiguous()
assert packed.is_contiguous()
assert packed.untyped_storage().data_ptr() != transposed.untyped_storage().data_ptr()
assert base.contiguous() is base  # 已连续时是 no-op

same = packed.to(dtype=packed.dtype, device=packed.device)
forced = packed.to(copy=True)
assert same is packed
assert forced.untyped_storage().data_ptr() != packed.untyped_storage().data_ptr()
assert torch.equal(forced, packed)`,
    buildSteps: [{ title: '积木 1：写五层报告', body: '报告 object id、Storage、shape/stride、dtype/device、值相等。' }, { title: '积木 2：实现 clone', body: '按逻辑迭代复制到新连续 buffer，断言写不回传。' }, { title: '积木 3：实现条件 contiguous', body: '先判断目标格式，已满足返回原对象，否则调用 clone。' }, { title: '积木 4：模拟 to 决策', body: '对相同属性、dtype 改变、device 改变、copy=True 分别返回别名或新 buffer。' }, { title: '积木 5：加入 autograd 实验', body: '比较 clone、detach、detach().clone 的 leaf 与 grad_fn。' }, { title: '积木 6：做布局基准', body: '在连续、transpose、expand 输入上分离 copy 和消费 kernel 的计时。' }],
    selfCheckQuestion: '为什么 `x.contiguous()`有时和 x 是同一对象，而 `x.clone()`不是？`x.to(x.device, x.dtype)`又何时可能直接返回 x？若下游只能接收默认连续 GPU float32，怎样设计可观测接口？',
    selfCheckAnswer: 'contiguous 先检查目标 memory format，已满足便返回 self；clone 的合同是独立数据，必有新 Storage。to 在目标 device/dtype/layout 已满足且 copy=False 时可直接返回 x，否则需要 cast、传输或复制。接口可提供 strict 模式，遇到非连续或非 GPU float32 报出 shape/stride；或 normalize 模式执行 `to(...).contiguous()`并返回/记录 materialized、copy bytes、H2D bytes 与耗时，同时用真实非连续输入做回归。部署时区分冷启动、稳态 batch、跨 stream 依赖和 pinned memory，避免把异步排队误测成完成时间；每次格式转换都应有明确消费者理由。还应测试 channels_last：它可能默认不连续却已经是卷积期望的连续格式，强制默认 contiguous 会徒增 copy。接口中把 desired memory format 作为显式参数，并在输出中报告输入布局、目标布局、是否返回原对象、Storage 是否更换和传输是否完成同步，调用方才能正确叠加多个边界。序列化边界也要做选择：保存 view 时可保留别名关系，保存已 clone 的 feature 则独立拥有数据；恢复后用 Storage identity、值和内存大小验证实际合同，而不是假定保存函数会自动表达业务所有权。'
  }
}
