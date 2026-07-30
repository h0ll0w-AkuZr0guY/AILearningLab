import type { TopicGuide } from '../../topic-guides';

export const torchIndexingGuides: Record<string, TopicGuide> = {
  'basic indexing': {
    official: {
      title: 'PyTorch 2.13 · Tensor Views / basic indexing',
      url: 'https://docs.pytorch.org/docs/stable/tensor_view.html#tensor-views',
      note: '稳定文档明确列出 basic slicing/indexing 为 view；它借用底层 Storage，而不是把选择到的值收集到新缓冲区。',
    },
    source: {
      repo: 'pytorch/pytorch',
      file: 'aten/src/ATen/TensorIndexing.h',
      symbol: 'applySlicing / handleDimInMultiDimIndexing',
      language: 'cpp',
      url: 'https://github.com/pytorch/pytorch/blob/v2.13.0/aten/src/ATen/TensorIndexing.h#L452-L590',
      code: `// v2.13.0：Python/C++ 基本索引逐 token 改写 view 几何。
inline Tensor handleDimInMultiDimIndexing(
    const Tensor& previous, const Tensor& original,
    const TensorIndex& index, int64_t* dim,
    int64_t* specified_dims, int64_t real_dim,
    std::vector<Tensor>& tensor_indices, bool disable_slice_optimization,
    const at::Device& device,
    const std::optional<SymIntArrayRef>& sizes) {
  if (index.is_integer()) {
    // select 固定一个坐标，删除该逻辑维，仍引用 previous 的 Storage。
    return impl::applySelect(previous, *dim, index.integer(), real_dim, device, sizes);
  } else if (index.is_slice()) {
    Tensor result = impl::applySlice(previous, *dim, index.slice().start(),
        index.slice().stop(), index.slice().step(), disable_slice_optimization, device, sizes);
    (*dim)++; // slice 保留维度，下一 token 消费下一个逻辑维。
    return result;
  } else if (index.is_ellipsis()) {
    *dim += original.dim() - *specified_dims; // ... 吸收未指定维度。
    return previous;
  }
  return previous;
}`,
      walkthrough: [
        '整数索引先进入 `applySelect`：检查边界、处理负下标，把该维坐标写进 offset 并删除该维。',
        'slice 进入 `applySlice`：半开区间与 step 共同决定新 size、stride、storage_offset；它仍是一条仿射地址公式。',
        '`dim` 只在 slice 后增加，因为 select 已移除一个维；混淆这条计数规则会造成多维索引错位。',
        '当没有 tensor index 被累积时，后续 `get_item` 直接返回 sliced 的 alias；只有收集到 tensor index 才转入高级索引分派。',
      ],
    },
    overview: [
      '`x[1, 2:5:2]`看起来像从数组里“拿出值”，更准确的模型是一台坐标变换器：整数把一条坐标固定，slice 缩小坐标域并可能放大 stride。输出因此能继续引用 x 的 Storage。这个模型能预测写传播、连续性和窗口为何会钉住大 buffer。',
      '基本索引由整数、slice、冒号、`...`和`None`构成。它不需要为每个输出元素保存独立地址表，所以普通 strided Tensor 能用 size、stride、offset 表达结果。下标列表、LongTensor 或 bool mask 则需要逐元素寻址，属于下一课的高级索引。',
      '本课把整数和 slice 合并，因为它们共享一条地址公式；`select`相当于固定一个坐标，`slice`相当于保留一段坐标。拆开会重复解释同一个 Storage 合同，却掩盖“降维”和“保留维”的关键差异。',
    ],
    chapters: [
      {
        kicker: '01 · ADDRESS',
        title: '先把索引还原成地址',
        paragraphs: [
          '对连续 `x.shape=(3,5)`、`stride=(5,1)`，`x[1,1:5:2]`输出 shape 为 `(2,)`，其 offset 从 0 变为 `1×5+1=6`，stride 变为 `(2,)`。输出逻辑坐标 1 的地址是 8，也就是原 x[1,3]。这份等式比“看起来相等”可靠。',
          '输入本身已经是 slice 或 transpose 时，不能重新假定它连续。任何 basic index 都从输入现有的 size、stride、offset 继续演算；因此应在调试日志里同时打印三者，避免用 shape 猜物理布局。',
        ],
        takeaway:
          '基本索引改写几何，不收集元素；地址公式是别名事实的最小证明。',
      },
      {
        kicker: '02 · INTEGER',
        title: '整数索引为何会降维',
        paragraphs: [
          '`x[1]`等价于沿第 0 维 select：坐标 1 已被固定，输出再没有可变化的第 0 维，于是 rank 减一。负下标要先按当前 size 规范化，再检查边界；它不是“从内存尾部倒着走”。',
          '保留维度的写法是 `x[1:2]`，它输出 shape `(1,5)`并保留该维的 stride。模型 batch 维若被误用整数选掉，后续广播常会让程序继续运行，却把样本维当 feature 维，因此入口断言 rank 比只看 numel 更有价值。',
        ],
        takeaway:
          'integer 固定坐标并删维；长度为一的 slice 保留坐标域，两者的 shape 合同完全不同。',
      },
      {
        kicker: '03 · SLICE',
        title: 'step 同时改变跨度与可 view 性',
        paragraphs: [
          'slice 的 stop 是半开边界。`1:5:2`选到 1 和 3，不含 5；步长 2 会把该维 stride 乘以 2，而不是复制出间隔元素。结果的 numel 很小也可能覆盖很大的原始地址范围。',
          '这解释了为何对 step slice 直接 `view(-1)`常失败：逻辑元素之间有洞，不能把多个维合成一个连续 chunk。若后续 kernel 真要线性布局，显式 `contiguous()`把复制放在可测边界；若它支持 stride，保留 view 可省带宽。',
        ],
        takeaway: 'step 是地址增量的一部分；小 shape 不等于紧凑 Storage。',
      },
      {
        kicker: '04 · ALIAS',
        title: '如何证明 view，又如何管理生命周期',
        paragraphs: [
          '对同 device 的普通 tensor，比 `untyped_storage().data_ptr()`能证明同一底层 Storage；对有 offset 的 slice，`data_ptr()`本身可以不同。再写入一个唯一坐标并观察 base 对应位置，是第二个可读证据。',
          '但别名并不天然正确：把一个 4KB 的 window 放入长期队列，可能让数百 MB base 永远存活。短链路计算借用 view，跨请求缓存或异步队列则 `clone()`固定所有权，并将复制字节计入容量预算。',
        ],
        takeaway:
          '别名、对象 identity、数据指针和生命周期是四个不同问题，必须分别验收。',
      },
      {
        kicker: '05 · WRITE',
        title: '读取与赋值应拆成两条合同',
        paragraphs: [
          '`y=x[1:3]`创建可写 view，`y.add_(1)`会影响 x；这让预分配 buffer 的填充很高效，也使无意的 in-place 修改更危险。对 requires_grad 的叶子及其 view，autograd 版本计数会拒绝某些写入，不能把报错当作随机限制。',
          'API 设计应声明返回的是只读借用还是独立结果。若调用者可以写，返回 clone；若要零拷贝，文档写明 alias 并用测试验证写传播、非连续输入、负下标和空 slice。这样上游改 layout 时，错误会停在索引边界。',
        ],
        takeaway: '基本索引的性能来自共享，工程安全来自把共享写进接口合同。',
      },
      {
        kicker: '06 · DEBUG',
        title: '把索引事故还原为可重复的几何报告',
        paragraphs: [
          '线上出现“切出的小块突然很慢”时，第一步不是盲目调用 contiguous，而是记录输入与输出的 shape、stride、storage_offset、dtype、device、is_contiguous 和 Storage 指针。第二步用同一输入分别测 basic slice 的创建时间、下游算子时间和显式 contiguous 的复制时间。创建 view 几乎不搬运数据，真正成本常藏在后来不接受该布局的 kernel；把三段合成一个总耗时会让优化方向倒置。',
          '再构造一张坐标编码的回归样本：令二维 base 的值为 `100*row+col`，分别执行整数选择、长度一 slice、负下标、步长 slice 和 transpose 后 slice。对每一例断言逻辑值、rank、stride、offset、是否共享 Storage，以及对唯一坐标写入后的 base 变化。这样既能抓住“把 1:2 写成 1”的降维错误，也能抓住测试 shape 对称时被掩盖的轴错误。若输出要越过线程、缓存或请求边界，额外记录 base 的物理字节数和 window 的逻辑字节数；两者相差很大时，clone 是所有权修复而非性能失败。',
        ],
        takeaway:
          '诊断 basic indexing 要同时报告坐标几何、所有权和下游消费，单看输出值无法定位性能或生命周期事故。',
      },
      {
        kicker: '07 · CHECKLIST',
        title: '交付前的最小检查表',
        paragraphs: [
          '实现切片工具前，明确它接受逻辑 axis 还是原始 dim，负 index、空窗口和 step 是否允许，返回是否借用以及调用者能否原地写。测试用不等长二维和三维 tensor，故意让输入 transpose 后再切片，检查异常是否停在接口边界。性能报告同时记录输入 stride 与下游算子，不能只给一个孤立的 slice 时间。这样索引从 Python 语法变成可审计的内存合同。',
        ],
        takeaway: '写清输入轴、别名和寿命，才能让零拷贝成为可维护的优化。',
      },
    ],
    mechanisms: [
      '整数索引固定坐标、增加 offset 并删除维度。',
      'slice 保留维度，按 step 更新 size/stride/offset。',
      '无 tensor index 时返回 alias；高级索引才需要 gather。',
      '非连续 view 仍可供许多算子消费，是否物化由下游决定。',
    ],
    pitfalls: [
      '把 size=1 slice 当成 integer select。',
      '用 `data_ptr()`不同断言 slice 不共享 storage。',
      '把小窗口长期保存而忽略被钉住的 base。',
      '用 `view`修复 step slice，掩盖布局不兼容。',
    ],
    variants: [
      {
        title: '借用 view',
        useWhen: '结果只在当前计算链内消费，且下游接受 stride。',
        tradeoff: '零拷贝且写传播；必须管理 alias 与 base 生命周期。',
      },
      {
        title: '边界 clone',
        useWhen: '结果要跨队列、缓存、线程或需独立可写。',
        tradeoff: '所有权稳定；付出完整复制与额外峰值内存。',
      },
    ],
    studyPlan: {
      readingMinutes: 25,
      sourceMinutes: 30,
      practiceMinutes: 50,
      reviewMinutes: 15,
    },
    exampleLanguage: 'python',
    example: `import torch
x = torch.arange(15).reshape(3, 5)
y = x[1, 1:5:2]
assert y.tolist() == [6, 8] and y.stride() == (2,)
assert y.untyped_storage().data_ptr() == x.untyped_storage().data_ptr()
y[1] = -1
assert x[1, 3].item() == -1`,
    buildSteps: [
      {
        title: '积木 1：实现 offset',
        body: '写 `offset+Σ(index*stride)`，手算二维整数索引。',
      },
      {
        title: '积木 2：实现半开 slice',
        body: '给定 start/stop/step，输出新 size、stride、offset。',
      },
      {
        title: '积木 3：加入 rank 变化',
        body: '让 integer 删除维，让长度一 slice 保留维。',
      },
      {
        title: '积木 4：验证别名',
        body: '比较 Storage 指针并做一次唯一坐标写传播。',
      },
      {
        title: '积木 5：验证边界',
        body: '覆盖负下标、空 slice、step slice 与 transpose 输入。',
      },
    ],
    selfCheckQuestion:
      '为什么 `x[1, 1:5:2]`可以是 view，而 `x[[1, 2]]`通常不是？如何设计一个不会因 alias 造成缓存泄漏的返回 API？',
    selfCheckAnswer:
      '前者的每个输出坐标都能用固定的 offset 和 stride 映射回 x：integer 固定一维，slice 把另一维的 stride 乘以 step，因此一组有限元数据足够。后者的行号来自运行时列表，地址序列取决于列表内容，必须读取并收集元素，普通 strided view 无法表达。返回 API 若仅作同步计算，可标成 borrowed view，禁止下游原地写并在测试中断言共享 Storage；若结果会进缓存、任务队列或被调用方修改，则应在边界 clone，记录复制字节并把 base 引用释放。验收要用连续、transpose、step slice 和非对称 shape，检查值、shape、stride、Storage identity 与写传播，不能仅比较输出数值。',
  },
  'advanced indexing': {
    official: {
      title: 'PyTorch 2.13 · Tensor Views / advanced indexing',
      url: 'https://docs.pytorch.org/docs/stable/tensor_view.html#tensor-views',
      note: '官方说明读取时 basic indexing 返回 view，advanced indexing 返回 copy；无论 basic 或 advanced，赋值都是对原 tensor 的原地操作。',
    },
    source: {
      repo: 'pytorch/pytorch',
      file: 'aten/src/ATen/native/TensorAdvancedIndexing.cpp',
      symbol: 'index / index_put_',
      language: 'cpp',
      url: 'https://github.com/pytorch/pytorch/blob/v2.13.0/aten/src/ATen/native/TensorAdvancedIndexing.cpp#L1-L27',
      code: `// v2.13.0：高级索引把 tensor indices 作为一组共同迭代的坐标表。
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
}`,
      walkthrough: [
        '高级索引的输入不是一串普通 slice，而是 Long/Bool tensor 列表；它们先被对齐为同一个迭代 shape。',
        '每一个输出位置读取一组运行时坐标，因此地址不是固定 stride 公式，结果必须 materialize 为独立 tensor。',
        '不相邻的 tensor index 会触发维度重排以统一共同迭代维；这正是 `x[[0,1],:, [2,3]]`难以靠直觉读懂的原因。',
        '`index_put_`是 scatter 写路径。重复 index 时 overwrite 的结果不应被当成确定的归约，需显式选择 accumulate/scatter_add 合同。',
      ],
    },
    overview: [
      '`x[[0,2]]`和`x[0:3:2]`都挑两行，底层却完全不同。slice 的地址可由一个 stride 表示；列表中的每个元素都可能跳到任意行，框架只能将选择到的元素 gather 到新输出。这就是“高级索引读取是 copy”的物理理由。',
      '多个索引 tensor 不是逐个嵌套循环，而是先 broadcast、后共同迭代。若 rows shape `(2,1)`、cols shape `(1,3)`，`x[rows,cols]`结果 shape `(2,3)`，每个格子是一对 `(row,col)`。想要笛卡尔积时要显式制造这两个带 singleton 的索引，而不是期待两个 `(n,)` 自动交叉。',
      '本课把 LongTensor/list 索引和读取/赋值分在同一专题，因为它们共用索引规格却不共用所有权。读取建立新 buffer；`x[idx]=value`直接写回 x。把两者混为“索引总会 copy”会产生极危险的训练数据污染。',
    ],
    chapters: [
      {
        kicker: '01 · GATHER',
        title: '为何高级读取不能是普通 view',
        paragraphs: [
          'view 只能用有限的 size、stride、offset 表示“每一维走固定步长”。`[0,2,1]`要求地址序列先向前、再跳、再回退，除非保存完整索引表，否则没有一条 stride 能表达。高级读取因此分配输出，并允许输出连续。',
          '验证时比较 `untyped_storage().data_ptr()`并修改 result：base 不应改变。不要用 `_base is None`当公开依据，也不要只测连续 base；所有权结论要在文档指定的普通 tensor 上用 storage 与写传播双证据确认。',
        ],
        takeaway:
          '运行时坐标表打破仿射地址，gather copy 是语义所需，不是偶然优化缺失。',
      },
      {
        kicker: '02 · SHAPE',
        title: '索引 tensor 先 broadcast 再共同迭代',
        paragraphs: [
          '设 `rows=[[0],[2]]`、`cols=[[1,3,4]]`。它们 broadcast 为 `(2,3)`，输出的 `(i,j)`读取 `x[rows[i,0], cols[0,j]]`。这是一张坐标网格，不是“先按 rows 切一次，再按 cols 切一次”。',
          '若两个一维索引同为 `(2,)`，`x[rows, cols]`执行配对选择并输出 `(2,)`；许多 bug 就来自作者想要 2×2 网格却得到两对对角点。写断言前先画索引 tensor 的 shape，比根据结果 shape 反推安全。',
        ],
        takeaway:
          '高级索引的输出 shape 由索引 broadcast 域和未索引维共同决定。',
      },
      {
        kicker: '03 · MIXED',
        title: 'basic 与 advanced 混用的维度重排',
        paragraphs: [
          '`x[rows, :, cols]`包含两个不相邻 tensor index。为把所有高级坐标作为一组处理，内部可能把相应维移到前面，再应用统一迭代；结果的高级维位置不应靠“从左往右删维”猜测。',
          '可靠做法是用很小的坐标编码 tensor，例如值写成 `100*i+10*j+k`，并将每个输出位置的预期坐标列成表。形状恰好相等的随机 tensor 会掩盖轴顺序错误，尤其在 batch 与 head 尺寸相同的模型中。',
        ],
        takeaway: '混合索引的难点在维度语义，不在语法；用坐标编码测试。',
      },
      {
        kicker: '04 · ASSIGN',
        title: '为什么高级赋值仍写回原对象',
        paragraphs: [
          '读取 `y=x[idx]`先得到 copy；表达式 `x[idx]=v`不会先把 copy 写回，而是进入 `index_put_`/scatter 路径，目标仍是 x。两行写法只差等号，所有权语义却相反。',
          '重复 index 是重要边界。`x[[1,1]]=tensor([3,4])`的非 accumulate overwrite 顺序不能当作并行归约合同；需要求和用 `index_add_`或`scatter_add_`，需要确定性则审计设备、算法和重复坐标策略。',
        ],
        takeaway:
          '高级读取是 gather，赋值是 scatter；先区分数据流向再讨论性能。',
      },
      {
        kicker: '05 · COST',
        title: '把索引设计成可测的工程合同',
        paragraphs: [
          '频繁 gather 会产生临时 buffer、打散访存并增加峰值内存。若访问模式固定且密集，重排/分块数据可能更合适；若索引稀疏且一次性，gather 简洁且语义准确。profile 要分别记录 index 准备、gather、后续 kernel 与写回。',
          '接口可接受“位置 tensor”但必须规定 dtype、device、rank、范围、是否允许重复和输出顺序。服务输入不能直接信任外部索引：先校验长度与边界，再限制最大输出元素，避免一份被广播的索引网格放大为意外的大分配。',
        ],
        takeaway:
          '高级索引是一个小型数据访问计划；把 shape 与重复规则写成接口，而不是藏在一行 Python。',
      },
      {
        kicker: '06 · INTERVIEW',
        title: '用访问计划回答性能与正确性追问',
        paragraphs: [
          '面试中若被问到“列表索引为什么慢”，不要只回答会复制。先指出输入索引需要被准备到正确 dtype/device，多个 index 需要 broadcast，kernel 对每个输出位置读取一组可能不连续的地址，并把结果写入新 buffer；随后若把结果再写回，还会是一次独立 scatter。连续 slice 只改元数据，而随机 gather 的访存局部性、临时输出和重复坐标规则都不同。这样回答既区分接口合同，也给出了可用 profiler 验证的成本分解。',
          '设计可复现实验时，分别测顺序 LongTensor、随机 LongTensor、相邻和不相邻的混合 index，并固定输出 numel，避免把“选更多元素”误称为 kernel 变慢。对 GPU 计时需同步；对结果检查既要验证值，也要验证 storage 不同和 base 未被读取操作修改。赋值路径另写测试：无重复时比较目标位置，重复时明确选择 last-write、累加或拒绝策略。生产接口还应限制 index 的最大元素数、范围和来源，避免恶意的 `(N,1)`与`(1,M)`广播造成 N×M 输出。',
        ],
        takeaway:
          '高级索引的评估单位是完整访问计划：索引准备、broadcast、gather/scatter、内存和重复规则缺一不可。',
      },
      {
        kicker: '07 · BOUNDARY',
        title: '选择更合适的算子边界',
        paragraphs: [
          '当 index 表示单一维提取且每个 batch 有一条位置时，gather 或 take_along_dim 比通用方括号更能表达轴与输出形状；固定范围时 narrow 或 slice 保留 view；稀疏更新时 scatter 系列能显式写出 reduce 规则。选择专用算子能让调用者、编译器和审查者一眼看出访问模式。仍要以相同的 index dtype、范围、重复和 storage 测试验证语义。',
        ],
        takeaway:
          '把访问模式交给最窄的算子，减少高级索引隐含的形状与写入歧义。',
      },
    ],
    mechanisms: [
      'Long/Int index tensor 先广播为共同迭代域。',
      '读取按每个位置 gather，输出通常拥有独立 Storage。',
      '混合不相邻 index 可能先重排维度。',
      '赋值走 index_put_/scatter，目标仍是原 tensor。',
    ],
    pitfalls: [
      '把两个 `(n,)` index 误当 n×n 笛卡尔积。',
      '把 `x[idx]`的 copy 语义套到 `x[idx]=v`。',
      '忽略重复索引的 overwrite/归约差异。',
      '以随机对称 shape 测试轴顺序。',
    ],
    variants: [
      {
        title: '配对 gather',
        useWhen: '每个样本有一组对应坐标，如 token 位置或候选动作。',
        tradeoff: '表达直接；结果数量随 index broadcast 域增长。',
      },
      {
        title: '网格 gather',
        useWhen: '确实需要 rows×cols 的子矩阵或多维坐标网格。',
        tradeoff: '使用 singleton 显式广播；容易产生大临时输出，需设预算。',
      },
    ],
    studyPlan: {
      readingMinutes: 25,
      sourceMinutes: 30,
      practiceMinutes: 55,
      reviewMinutes: 15,
    },
    exampleLanguage: 'python',
    example: `import torch
x = torch.arange(20).reshape(4, 5)
rows = torch.tensor([[0], [2]])
cols = torch.tensor([[1, 3, 4]])
y = x[rows, cols]
assert y.tolist() == [[1, 3, 4], [11, 13, 14]]
assert y.untyped_storage().data_ptr() != x.untyped_storage().data_ptr()
x[torch.tensor([0, 2]), 0] = torch.tensor([-1, -2])
assert x[:, 0].tolist() == [-1, 5, -2, 15]`,
    buildSteps: [
      {
        title: '积木 1：写坐标表',
        body: '以 Python list 保存每个输出位置的坐标对。',
      },
      { title: '积木 2：broadcast 索引', body: '实现一维配对与二维网格两例。' },
      {
        title: '积木 3：实现 gather',
        body: '按坐标表读取到新 list，验证不 alias base。',
      },
      {
        title: '积木 4：实现 scatter',
        body: '将 value 写回原 buffer，并拒绝未声明的重复坐标。',
      },
      {
        title: '积木 5：加入预算',
        body: '在分配前计算广播后输出 numel，拒绝过大请求。',
      },
    ],
    selfCheckQuestion:
      '给出 `x.shape=(4,5)`、`rows.shape=(2,1)`、`cols.shape=(1,3)`时高级读取的 shape 与所有权；为什么高级赋值不能据此认为先复制后写回？',
    selfCheckAnswer:
      'rows 与 cols 先右对齐 broadcast 成 `(2,3)`，所以读取输出为 `(2,3)`，每个位置按一对运行时坐标 gather，结果拥有新的 Storage，修改 y 不影响 x。赋值语句在 Python 语义层直接调用 setitem，C++ 路径会先处理基础 slice、再把 tensor indices 交给 `index_put_`，它对原 x 执行 scatter；不会把读取用的临时 y 写回。因此测试必须分别验证读的 storage 不同、写后 x 的指定位置变化、重复 index 的策略以及 index 的 dtype/device。若需求是可加的重复更新，选择 index_add_/scatter_add_ 并为确定性、排序和数值误差设计测试。',
  },
  'boolean mask': {
    official: {
      title: 'PyTorch 2.13 · Tensor Views / boolean indexing',
      url: 'https://docs.pytorch.org/docs/stable/tensor_view.html#tensor-views',
      note: '官方将 mask 归为 advanced indexing：读取返回 copy；掩码必须能与被索引维的形状对应，输出元素数由 True 的数量决定。',
    },
    source: {
      repo: 'pytorch/pytorch',
      file: 'aten/src/ATen/native/TensorAdvancedIndexing.cpp',
      symbol: 'boolean mask expansion',
      language: 'cpp',
      url: 'https://github.com/pytorch/pytorch/blob/v2.13.0/aten/src/ATen/native/TensorAdvancedIndexing.cpp#L1-L27',
      code: `// v2.13.0 文件头说明了 bool/byte mask 的索引语义。
// index 的输入是 Long、Bool、Byte tensor 或 null 的列表。
// Byte/Bool mask 在逻辑上经由 nonzero() 展开成 long indices。
// 一个 mask 会消费与其 rank 相同数量的输入维度。
// 所有 index tensors 随后共同 broadcast 并逐元素迭代。
// 因而输出长度取决于数据中 True 的数目，不能由静态 stride 表达。
Tensor _unsafe_masked_index(
    const Tensor& self, const Tensor& mask,
    const torch::List<std::optional<Tensor>>& indices,
    const Scalar& fill) {
  // 编译器内部路径在 mask=false 时避免读取越界 index。
  auto result = at::_unsafe_index(self, indices);
  return result.masked_fill(at::logical_not(mask), fill);
  // eager 代码不可把 unsafe 当普通 API；它省略了关键检查。
}`,
      walkthrough: [
        'mask 不是“值为零就跳过”的算子参数，而是动态坐标集合的描述。',
        '框架把 Bool/Byte mask 展开为 long 坐标，之后走与高级索引相同的 gather 语义。',
        'mask rank 会消费相应数量输入维，因此 `(B,T)` mask 与 `(B,T,D)`值的组合需要明确剩余 feature 维。',
        '内部 unsafe 路径服务编译器优化；eager 代码必须保留范围、dtype、shape 与动态输出检查。',
      ],
    },
    overview: [
      '布尔 mask 像筛子，却不只是逐元素 if。`x[mask]`把满足条件的元素压成一维或保留未被 mask 消费的尾维；输出长度依赖实际 True 数。它天然是动态 shape，也就无法像 slice 那样由固定 stride 表示为 view。',
      '读取 mask 是 gather copy，赋值 `x[mask]=v`是 scatter 写回。mask 与比较表达式常一起出现，例如过滤 padding、丢弃坏样本或更新符合条件的参数；因此必须把读写、长度、梯度和重复逻辑拆开审计。',
      '本课独立于通用高级索引，因为 mask 会携带数据相关的输出长度。这个边界会影响 DataLoader 拼批、torch.compile 图捕获、导出 shape 合同与线上内存预算。',
    ],
    chapters: [
      {
        kicker: '01 · SHAPE',
        title: 'mask 消费哪些维度',
        paragraphs: [
          '若 `x.shape=(2,3,4)`、`mask.shape=(2,3)`，`x[mask]`选择前两维中每个 True 对应的一整条 feature，结果 shape 为 `(true_count,4)`。若 mask 形状与 x 完全相同，结果通常为一维 `(true_count,)`。先写 mask 消费的维，而非先猜输出。',
          'mask 不可随意把任意尺寸 broadcast 成想要的筛子。应在入口把业务 mask 规范成明确 rank，并用 `torch.broadcast_shapes`或断言提前给出可读错误，避免在大 batch 上才出现不透明的 indexing 异常。',
        ],
        takeaway: 'mask 的 rank 是索引合同的一部分，True 数是运行时输出维。',
      },
      {
        kicker: '02 · COPY',
        title: '为何结果必须物化',
        paragraphs: [
          'True 的地址集合取决于数据，可能是 0、1 或任意多个点，并不构成固定等差地址序列。框架需要枚举坐标并 gather 到一块新 buffer，所以修改 `selected`不应回写 base。',
          '每轮训练若先生成巨大 bool mask 再选出少量元素，既要存 mask 又要存 gather 结果。可比较 `masked_select`、`where`、保留形状的乘法掩码与索引式过滤：它们的计算、显存和下游 shape 合同不同。',
        ],
        takeaway: 'mask 读取的 copy 是动态稀疏选择的必然结果。',
      },
      {
        kicker: '03 · WRITE',
        title: 'mask 赋值为何仍是原地 scatter',
        paragraphs: [
          '`x[mask]=0`把标量广播给被选位置，直接更新 x；`x[mask]=values`要求 values 能匹配被选位置数或可广播。它并没有先构造 `x[mask]`的 copy 再猜如何回填。',
          '反向与原地写要格外慎重。对需要梯度、且 forward 已保存的 tensor，mask 写会改变版本计数；安全的函数式替代是 `torch.where(mask, replacement, x)`，它分配新结果但保留清晰的数据流。',
        ],
        takeaway:
          'mask read 是 gather，mask write 是 scatter；同一方括号语法隐藏两条反向数据流。',
      },
      {
        kicker: '04 · DYNAMIC',
        title: '动态长度如何影响编译与批处理',
        paragraphs: [
          '`true_count`在不同 batch 中变化，后续 `view(batch,-1)`或固定长度 all-gather 很容易失效。需要固定形状时，改用 `where`保留原 shape，或先 top-k/采样并显式 pad 与返回长度。',
          '图编译器可以处理一部分动态形状，却需要 guard 与正确的范围假设。不要为了“让图稳定”把非法样本静默截断；应记录每批 true_count 分布，把异常的全空、全真和极端稀疏作为数据质量信号。',
        ],
        takeaway: '动态输出不是麻烦细节，而是 API、编译和通信协议的一部分。',
      },
      {
        kicker: '05 · TEST',
        title: '用计数与坐标双证据验收',
        paragraphs: [
          '最小测试应断言 `selected.shape[0] == mask.sum()`，再用坐标编码值检查选择顺序。只断言元素集合会漏掉顺序错误；只测一张全真 mask 会漏掉空输出与 rank 消费边界。',
          '工程测试还要分开测读取不 alias、赋值确实修改 base、requires_grad 的安全替代以及长序列上的峰值内存。对于来自外部请求的 mask，设置最大 true_count 与输出字节预算，防止广播后的 mask 触发非预期大 gather。',
        ],
        takeaway: 'mask 的正确性证据至少包含 count、值序、所有权与空集边界。',
      },
      {
        kicker: '06 · PIPELINE',
        title: '为变长选择设计稳定的数据管线',
        paragraphs: [
          '训练与服务常将 bool mask 同时用于损失、日志和通信。若直接用 `x[mask]`把 token 压缩为 N 条记录，N 会随 batch 波动；随后拼接、分布式 all-gather 或固定预分配 buffer 都必须携带 length。一个稳健协议是同时返回 `selected`、每个 batch 的 count 和可逆的原位置索引，消费者据此决定拼接、pad 或散回。只返回紧凑 tensor 会让下游在 N 恰好为零、或不同 worker 的 N 不同时才暴露错误。',
          '另一条路径是保留 `(B,T,D)`几何：用 `where`填充无效位置，再把 mask 传给 reduction，令分母用有效 token 数而非总长度。它多处理了一些填充值，却让 kernel、编译和通信面对稳定 shape。选择哪条路由取决于有效率和后续算子，而非“mask 更简洁”。基准应记录 true_count 分布、峰值内存、吞吐和梯度是否只来自有效项；验证空 mask 时 loss、归一化和指标都应有明确定义，不能依赖 NaN 恰好暴露数据问题。',
        ],
        takeaway:
          'mask 的核心工程问题是动态长度传播：压缩时携带长度和位置，保形时携带有效性与正确分母。',
      },
      {
        kicker: '07 · FAILURE',
        title: '为异常样本保留可解释性',
        paragraphs: [
          'mask 常来自阈值、缺失值检测或业务权限，因此全空未必是正常 batch。日志应区分无有效项、阈值配置过严与 mask shape 错位，记录总元素、true_count、每样本计数及来源版本。调试时不要把大 tensor 转成 Python list，这会同步设备并破坏性能观测；仅抽样坐标、保留聚合统计，再用小样本复现。需要追溯的过滤应保存原位置 index，而非只保存压缩值。',
        ],
        takeaway: 'mask 的空集既是业务事件也是数值边界，应被显式记录。',
      },
      {
        kicker: '08 · PRACTICE',
        title: '用同一批数据比较两种流向',
        paragraphs: [
          '准备含 padding 的 `(B,T,D)`激活和 `(B,T)`mask：一路用 `x[mask]`得到紧凑结果并保存 count 与位置；另一路用 where 保留原 shape，再以 mask 作为 reduction 权重。分别验证有效元素的和与梯度一致，比较空 mask、半满 mask 和几乎全满 mask 的输出 shape、峰值内存与耗时。这个对照会把“压缩减少计算”与“固定形状减少系统复杂度”的边界变成可测证据。',
        ],
        takeaway:
          '练习应同时覆盖压缩和保形路径，才能为真实管线选择 mask 策略。',
      },
    ],
    mechanisms: [
      'Bool/Byte mask 逻辑上展开为 long 坐标。',
      '输出形状由 True 数与未消费的尾维决定。',
      '读取 materialize，赋值对原 tensor scatter。',
      '数据相关长度会向后传播到编译、拼批与通信。',
    ],
    pitfalls: [
      '将 mask 当作可随意广播的普通算子输入。',
      '假定 `x[mask]`保持原 rank。',
      '在 requires_grad tensor 上随意 mask 原地写。',
      '未预算 true_count 导致大临时分配。',
    ],
    variants: [
      {
        title: '压缩选择 `x[mask]`',
        useWhen: '后续确实只处理满足条件的紧凑集合。',
        tradeoff: '计算量可能下降；输出动态且会 gather。',
      },
      {
        title: '保形选择 `where`',
        useWhen: '下游需要固定 shape、编译稳定或向量化算子。',
        tradeoff: '保留全部位置并计算两支；接口与通信更稳定。',
      },
    ],
    studyPlan: {
      readingMinutes: 25,
      sourceMinutes: 25,
      practiceMinutes: 55,
      reviewMinutes: 15,
    },
    exampleLanguage: 'python',
    example: `import torch
x = torch.arange(24).reshape(2, 3, 4)
mask = torch.tensor([[True, False, True], [False, True, False]])
y = x[mask]
assert y.shape == (3, 4) and torch.equal(y[1], x[0, 2])
assert y.untyped_storage().data_ptr() != x.untyped_storage().data_ptr()
x[mask] = -1
assert torch.equal(x[0, 0], torch.full((4,), -1))`,
    buildSteps: [
      {
        title: '积木 1：枚举 True 坐标',
        body: '把二维 bool list 转为坐标列表并计数。',
      },
      {
        title: '积木 2：实现 gather',
        body: '按坐标读取新 list，验证输入不变。',
      },
      { title: '积木 3：实现 scatter', body: '按坐标回写并检查 values 长度。' },
      {
        title: '积木 4：比较 where',
        body: '保留原 shape，比较结果和内存合同。',
      },
      { title: '积木 5：覆盖动态边界', body: '测试全空、全真和高维 mask。' },
    ],
    selfCheckQuestion:
      '为何 `(B,T)` mask 作用于 `(B,T,D)`会得到 `(N,D)`，而不能要求永远返回 `(B,T,D)`？固定 shape 管线应怎样改写？',
    selfCheckAnswer:
      'mask 消费 B、T 两个索引维，N 是实际 True 数；未被消费的 D 维保留，所以读取把稀疏的有效 token 压缩成 `(N,D)`。N 是数据相关的，不能由 `(B,T)`静态推出，因而也不应伪装成固定 shape。若下游要求固定 B、T、D，例如 attention、all-gather 或编译后的块，使用 `torch.where(mask.unsqueeze(-1), x, fill)`或乘以转换后的 mask 保留几何；若确实要压缩，就连同 length、offset 或 padding mask 一起作为协议输出。测试应覆盖 N=0、N=全部、梯度、安全的非原地版本与内存预算。',
  },
  'ellipsis None': {
    official: {
      title: 'PyTorch 2.13 · Tensor Views / indexing',
      url: 'https://docs.pytorch.org/docs/stable/tensor_view.html#tensor-views',
      note: '`...`与`None`属于 basic indexing；前者补足未指定维度，后者插入长度为 1 的维，因此普通 strided tensor 上可保持 view 语义。',
    },
    source: {
      repo: 'pytorch/pytorch',
      file: 'aten/src/ATen/TensorIndexing.h',
      symbol: 'handleDimInMultiDimIndexing / get_item',
      language: 'cpp',
      url: 'https://github.com/pytorch/pytorch/blob/v2.13.0/aten/src/ATen/TensorIndexing.h#L452-L710',
      code: `// v2.13.0：None 和 ellipsis 不读取元素，只改索引坐标系。
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
// 所以 ... 与 None 不能用“什么都没做”概括。`,
      walkthrough: [
        '源码先计算指定维数量；ellipsis 通过总 rank 减去已指定维得到需要跳过的维数。',
        '`None`直接调用 unsqueeze，在当前位置插入 size=1 维并推进当前位置。',
        '单独 `...`仍建立 alias，保证索引表达式返回独立 tensor wrapper，同时不复制 Storage。',
        '若同一表达式另有 Long/Bool tensor，基础几何完成后才交给高级分派；应分层看语义。',
      ],
    },
    overview: [
      '`...`和`None`很短，却是深度学习代码中控制 rank 的两个精确工具。前者意思是“这里填满足以覆盖其余未指定维度的冒号”，后者意思是“在这里插入一个长度为一的轴”。它们改的是坐标系，不是数值。',
      '`x[..., -1]`在 rank 改变时仍选最后一维，适合库接口；`x[:, None, :]`常把 `(B,D)`变成 `(B,1,D)`，为 broadcast 或矩阵运算显式准备 axis。两者输出常借用 storage，因而也继承 alias、stride 和原地写风险。',
      '本课把它们合并，因为它们都不消费一个具体数据坐标，却会移动后续索引的维位置。分别背两个语法糖很容易在 `x[..., None, idx]`这类组合中错数维。',
    ],
    chapters: [
      {
        kicker: '01 · ELLIPSIS',
        title: 'ellipsis 是可计算的维度占位',
        paragraphs: [
          '一个索引表达式最多放一个 `...`。它不总是“最后几个维”：框架数出 integer、slice、None 以外实际消费的维，再让 ellipsis 补齐剩余维。`x[...,0]`因此等价于按当前 rank 写足够多个 `:`后再选最后维。',
          '它特别适合 rank 多态代码，但不替代输入 rank 验证。若模型接口把最后一维约定为 channel，却误传 NHWC/NCHW，ellipsis 会忠实执行错误合同；仍要在边界标注每个轴的语义。',
        ],
        takeaway: 'ellipsis 让位置相对末端稳定，不能让业务 axis 语义自动正确。',
      },
      {
        kicker: '02 · NONE',
        title: 'None 就是一次 unsqueeze',
        paragraphs: [
          '`x[None]`在最前插入维，`x[:,None,:]`在中间插入维。新维 size 为 1，地址不会因此移动；输出的该项 stride 只需满足可表示几何，调用者不应依赖其具体数值，而应依赖 shape 和共享事实。',
          '需要减少维时使用整数 select 或 `squeeze`，不要把 None 当 reshape 万能药。插轴意图最好写成 `unsqueeze(dim)`用于库内部，方括号 None 则在与其他索引混用时更紧凑。',
        ],
        takeaway: 'None 的语义是增一条可广播的坐标轴，不是复制或填充数据。',
      },
      {
        kicker: '03 · COMPOSE',
        title: '先画 token 消费表再写组合',
        paragraphs: [
          '以 `(B,H,T,D)`为例，`x[...,None,:]`得到 `(B,H,T,1,D)`；`...`消费到最后一个显式 `:`之前的维，None 不消费输入维却增加输出维。先写输入轴、每个 token 消费数和输出轴，能阻止手算偏一。',
          '混入整数时 rank 会再下降，混入高级 index 时结果轴位置还可能重排。复杂表达式拆成具名变量并在每步断言 shape，通常比一行索引更易 code review 和 profile。',
        ],
        takeaway: '组合索引的可靠语言是“消费维与产生维”，不是肉眼数冒号。',
      },
      {
        kicker: '04 · ALIAS',
        title: 'view 不等于同一个对象',
        paragraphs: [
          '`x[...]`常与 x 共享 storage，却不是 Python 的同一对象。这很重要：元数据 wrapper 可独立传递给 autograd 和后续操作，而底层字节仍借用。测试宜断言 storage identity 与写传播，避免把 `is`当别名判断。',
          '插入 size=1 维后可参与 broadcast；若下游 expand，零 stride 与多对一地址又引入写禁区。只读计算可保留 view，需要修改就 clone 或让计算产生独立结果。',
        ],
        takeaway:
          '对象、元数据与 Storage 要分层理解，None/ellipsis 最容易暴露这三层差异。',
      },
      {
        kicker: '05 · CONTRACT',
        title: '把 rank 变换变成显式 API',
        paragraphs: [
          '函数若接受 `(...,D)`并在末端插轴，应在 docstring 声明 prefix 维自由、D 固定；返回 `(...,1,D)`。这比说“支持任意 tensor”可测试得多。',
          '回归样例使用 rank 2、rank 4、空 batch 与非连续输入，检查 title 轴、shape、值、Storage 和错误信息。对用户输入限制单个 ellipsis、合法 integer 与最大 rank，避免把 Python 便利语法变成不透明协议。',
        ],
        takeaway: 'rank 多态要有明确的省略号边界，才能既通用又可审计。',
      },
      {
        kicker: '06 · AXIS API',
        title: '从语法便利升级为轴约定',
        paragraphs: [
          '在 attention、图像和多模态代码中，`None`往往不是为了让表达式短，而是把向量声明为沿某条轴共享的参数。比如 `(D)`的 scale 写成 `scale[None,None,:]`，读者应立即得到目标 `(B,T,D)`；若改用 `scale[...,None]`，含义变成把 D 置于倒数第二维，后续乘法可能仍能 broadcast 却对应错误轴。代码评审应要求注释输入输出轴名，或封装为 `feature_bias_for(tokens)`等具名函数。',
          '测试也要刻意避免“所有维长度都是 2”。以 B=2、H=3、T=5、D=7 构造编码值，依次验证 `x[..., -1]`、`x[:,None]`、`x[...,None,:]`和包含 integer 的组合。对每一次变换，比较明确写出的等价索引，并保留非连续输入验证 Storage 与逐元素值。遇到 rank 未知的库接口，应规定最小 rank、尾部语义和异常行为；ellipsis 负责泛化前缀维，不能替调用者猜出输入究竟是 channels-first 还是 channels-last。',
        ],
        takeaway:
          'ellipsis/None 的正确使用依赖命名轴合同；语法在 rank 多态下保持位置，业务语义仍需由接口保证。',
      },
      {
        kicker: '07 · REVIEW',
        title: '阅读复杂索引时的展开法',
        paragraphs: [
          '遇到 `x[..., None, ids]`，先写 x 的命名 shape，将 ellipsis 展成确切数目的 slice，再执行 None 的 unsqueeze 并更新轴表，最后单独分析 ids 是整数还是 tensor。若 ids 是 tensor，它开始高级索引，结果不再能仅靠 view 规则判断。这个展开法能在 code review 中明确哪些变换不复制、哪里开始 gather、输出 rank 为何变化；稳定步骤可封装为小函数，避免每个调用点重算。',
        ],
        takeaway:
          '展开 token、更新轴表、再判断高级索引，是复杂方括号表达式最可靠的阅读顺序。',
      },
      {
        kicker: '08 · PRACTICE',
        title: '用轴表驱动重构',
        paragraphs: [
          '为一个同时支持单图和批图的函数写出输入 `(...,N,D)`与输出 `(...,N,1,D)`合同，再分别传入 `(N,D)`、`(B,N,D)`和 `(B,H,N,D)`。每次先以显式 slice/unsqueeze 写出参考实现，再和 ellipsis/None 的紧凑实现比较 shape、值、Storage 与错误。随后加入整数 index 和 LongTensor index，观察哪一步仍是 view、哪一步开始 gather。学习目标不是记住符号，而是能从 token 消费表预测结果。',
        ],
        takeaway:
          '将紧凑索引与显式参考实现并列测试，是验证 rank 多态代码的稳固方法。对外暴露的函数还应把 axis 约定写进类型、文档与异常文本，使错误输入在真正访问数据前就被拒绝。稳定接口还应明确规定空维、标量和不支持的 layout 如何报错。',
      },
    ],
    mechanisms: [
      'ellipsis 吸收剩余未指定输入维。',
      'None 以 unsqueeze 插入 size=1 输出维。',
      '两者通常不复制 Storage。',
      '它们与高级 index 混用时，基础处理先完成。',
    ],
    pitfalls: [
      '把 ... 当作固定数量的冒号。',
      '把 None 当作新增数据。',
      '依赖 view 的 Python object identity。',
      '在组合索引中靠目测猜 rank。',
    ],
    variants: [
      {
        title: '显式 unsqueeze',
        useWhen: '需要突出插轴并便于逐步调试。',
        tradeoff: '更冗长；rank 演算在方法调用中清晰。',
      },
      {
        title: '索引内 None/ellipsis',
        useWhen: '插轴与选择同一步表达，或需要 rank 多态末维访问。',
        tradeoff: '紧凑；复杂组合必须配 shape 注释与测试。',
      },
    ],
    studyPlan: {
      readingMinutes: 25,
      sourceMinutes: 25,
      practiceMinutes: 45,
      reviewMinutes: 15,
    },
    exampleLanguage: 'python',
    example: `import torch
x = torch.arange(24).reshape(2, 3, 4)
y = x[..., None, :]
assert y.shape == (2, 3, 1, 4)
assert y.untyped_storage().data_ptr() == x.untyped_storage().data_ptr()
assert torch.equal(x[..., -1], x[:, :, -1])`,
    buildSteps: [
      {
        title: '积木 1：列消费表',
        body: '标出每个 token 消费、插入或保留的维。',
      },
      {
        title: '积木 2：实现 ellipsis 展开',
        body: '由 rank 减指定维数生成冒号数量。',
      },
      {
        title: '积木 3：实现 unsqueeze',
        body: '在给定位置插入 size=1 和合法 stride。',
      },
      { title: '积木 4：组合测试', body: '覆盖末端、开头、中间与整数选择。' },
      {
        title: '积木 5：验证借用',
        body: '检查 Storage 与非连续输入的写传播。',
      },
    ],
    selfCheckQuestion:
      '解释 `x[...,None,:]`为何不等于复制一列数据，以及如何在 rank 未知时证明它把新维插在倒数第二个位置。',
    selfCheckAnswer:
      'None 进入源码后调用 unsqueeze，仅改 size/stride 元数据并返回 alias；它没有读取或写入元素，所以 Storage identity 保持。ellipsis 先吸收所有未被其后 `:`显式消费的输入维，随后 None 在当前位置插入 size=1，最后 `:`保留原末维。因此无论 x 是 `(B,D)`还是 `(B,H,T,D)`，输出分别为 `(B,1,D)`和`(B,H,T,1,D)`，新维都在原末维之前。验证使用多个非对称 rank 的输入，断言 shape、坐标值与 storage；需要可写的独立结果时 clone，不能因为插入了新维就假定不 alias。',
  },
  'broadcast alignment': {
    official: {
      title: 'PyTorch 2.13 · Broadcasting semantics',
      url: 'https://docs.pytorch.org/docs/stable/notes/broadcasting.html#general-semantics',
      note: '官方定义：从尾维比较，尺寸相等、其中一个为 1、或一方该维不存在时可 broadcast；原地操作不能因 broadcast 改变目标 tensor 的 shape。',
    },
    source: {
      repo: 'pytorch/pytorch',
      file: 'aten/src/ATen/ExpandUtils.cpp',
      symbol: 'infer_size_impl',
      language: 'cpp',
      url: 'https://github.com/pytorch/pytorch/blob/v2.13.0/aten/src/ATen/ExpandUtils.cpp#L17-L45',
      code: `template <typename Container, typename ArrayType>
Container infer_size_impl(ArrayType a, ArrayType b) {
  auto dimsA = static_cast<ptrdiff_t>(a.size());
  auto dimsB = static_cast<ptrdiff_t>(b.size());
  auto ndim = dimsA > dimsB ? dimsA : dimsB;
  Container expandedSizes(ndim);
  for (ptrdiff_t i = ndim - 1; i >= 0; --i) {
    ptrdiff_t offset = ndim - 1 - i;
    ptrdiff_t dimA = dimsA - 1 - offset;
    ptrdiff_t dimB = dimsB - 1 - offset;
    auto sizeA = (dimA >= 0) ? a[dimA] : 1;
    auto sizeB = (dimB >= 0) ? b[dimB] : 1;
    TORCH_MAYBE_SYM_CHECK(sym_eq(sizeA, 1) || sym_eq(sizeB, 1) || sym_eq(sizeA, sizeB),
        "The size of tensor a must match tensor b at non-singleton dimension");
    expandedSizes[i] = sym_eq(sizeA, 1) ? sizeB : sizeA;
  }
  return expandedSizes;
}`,
      walkthrough: [
        '实现从最后一维向前走，较短 shape 缺失的位置视为 size 1。',
        '每一维只允许相等或一方为 1；否则在 non-singleton 维报告冲突。',
        '结果维取非 1 的那一边，这解释了 `(5,1,4,1)+(3,1,1)`得到 `(5,3,4,1)`。',
        '真实实现使用 SymInt guard，说明动态形状下“能否 broadcast”也是运行时需证明的条件。',
      ],
    },
    overview: [
      'broadcast 不是把小 tensor 真的复制很多份，而是为逐元素算子对齐坐标域。缺失前导维视为 1，size=1 维可以反复使用同一个逻辑元素；实现常以 zero stride 的 expand view 表达这种重复。输出算子是否分配，与输入是否被扩展是两回事。',
      '最常见事故发生在轴语义，而非规则本身：`(B,T,D)+(B,D)`不会把第二个 tensor 当成每个 batch 的 bias，因为尾维从 D 对齐后，B 会撞上 T。正确形状通常是 `(B,1,D)`。先给每一维命名，再决定 unsqueeze 位置，比凭长度“试到能跑”为可靠。',
      '本课把 forward 对齐、反向 reduce 和原地限制放在一起。它们都来自同一事实：一个输入元素若被逻辑复用多次，forward 可读同一地址，backward 必须把多条梯度贡献加回一个位置，而原地写没有唯一目标地址。',
    ],
    chapters: [
      {
        kicker: '01 · ALIGN',
        title: '从尾维对齐而非从左猜形状',
        paragraphs: [
          '比较 `(5,1,4,1)`与`(3,1,1)`时先对齐最右端：1 对 1，4 对 1，1 对 3，5 对缺失 1，因此结果是 `(5,3,4,1)`。`0`不是万能空维：0 与 2 不相等且都非 1 时不可 broadcast。',
          '把 shape 写成命名表，例如 logits `(B,T,V)`、bias `(V)`、padding mask `(B,T,1)`。每次扩展前给出目标轴表，能在模型维度碰巧相等时防住静默语义错位。',
        ],
        takeaway:
          'broadcast 的方向固定从尾维开始；轴名决定应在哪一位置插入 1。',
      },
      {
        kicker: '02 · VIEW',
        title: '扩展为何常用零 stride',
        paragraphs: [
          '把 `(B,1,D)`扩展到`(B,T,D)`时，中间维的所有逻辑坐标都应读同一个 bias 元素；zero stride 表示沿该维加一地址不变。它避免输入复制，但任何结果 tensor 仍可能为逐元素计算新分配。',
          '这也解释 expanded view 的写限制：多个逻辑位置指向同一字节，向量化原地写没有唯一意义。需要写时先 clone 或选择生成新结果的 out-of-place 算子，别以“小 tensor 很便宜”绕过语义。',
        ],
        takeaway:
          'broadcast 输入常是零 stride 借用，输出是否新分配由算子合同决定。',
      },
      {
        kicker: '03 · BACKWARD',
        title: '梯度为何要 sum 回 singleton 维',
        paragraphs: [
          '若 bias `(D)`被加到 `(B,T,D)`，每个 bias 元素影响 B×T 个输出；反向时这 B×T 个梯度必须沿前两维求和，才能回到 bias 的 `(D)` shape。把 broadcast backward 看成 reduce-to-shape，可手推也可测。',
          '这不是 autograd 的额外魔法，而是链式法则中的同一输入被多次使用。自定义 Function 若手写 forward expand，就必须在 backward 对被扩展的维 reduce；漏掉它会得到 shape 对不上或数值少累加的梯度。',
        ],
        takeaway: 'forward 的一对多读取，对偶为 backward 的多对一累加。',
      },
      {
        kicker: '04 · INPLACE',
        title: '原地操作为何不能扩大左值',
        paragraphs: [
          '`x.add_(y)`可以在 y 广播到 x 的 shape 时成立，因为 x 的形状不变；反过来若需要把 x 从 `(1,3,1)`扩成`(3,3,7)`，原地操作会拒绝。左值只有原有 storage 几何，不能靠原地语法凭空获得更多独立元素。',
          '还有扩展 view 本身的多对一写风险。即使某次 scalar 写看似可行，也不要把它推广到 vectorized kernel；清晰做法是将可变 buffer materialize 成独立 storage，并在接口中声明写权限。',
        ],
        takeaway:
          '原地合同优先保护左值 shape 与地址唯一性，不能用 broadcast 偷渡分配。',
      },
      {
        kicker: '05 · DIAGNOSIS',
        title: '用 shape 合同而不是试错修广播',
        paragraphs: [
          '报错中的 non-singleton dimension 是证据：从尾维编号定位冲突，再回到轴名表检查缺失的 singleton，而不是随意 `unsqueeze(0)`直到运行。对 batch size 与 sequence length 相等的测试尤其危险，应使用互不相等的 B、T、D。',
          '性能诊断同时看 expand、contiguous、copy 和 reduction。重复消费同一广播输入时，提前 materialize 有时更快；一次消费通常不值得复制。基准要在真实 layout、真实 dtype/device 下测端到端，并将 copy 与算子时间分开。',
        ],
        takeaway:
          'shape 错误要按尾维证据和轴名修复，性能取舍要以真实下游 profile 决定。',
      },
      {
        kicker: '06 · NUMERICS',
        title: '把对齐、精度与归约误差一起验收',
        paragraphs: [
          'broadcast 经常出现在归一化、损失权重和注意力 mask 中，这些地方既有 shape 合同也有数值合同。以 `(B,T,D)`激活加 `(D)`bias 为例，forward 可逐元素比较；backward 则把 bias 梯度沿 B、T 归约。低精度下归约顺序会影响末位，GPU 并行还可能使浮点累加顺序变化，因此测试应使用 allclose 容差、较小的解析样例和 FP32 参考，而不是要求每次 bitwise 相等。',
          '若掩码或权重经 broadcast 后参与 mean，分母必须与有效元素集合一致：简单写 `loss.mean()`会把 padding 也纳入分母，使不同序列长度的梯度尺度漂移。推荐先构造保形权重，再计算 `sum(weighted)/sum(weights)`，并对全零权重规定返回零、跳过 batch 或报告错误的策略。性能层面再比较隐式 broadcast、显式 expand 和 materialize；只要下游 kernel 能读零 stride，复制通常没有收益，只有多次复用或布局受限的 kernel 才值得用 profile 证明物化。',
        ],
        takeaway:
          'broadcast 的验收应覆盖轴、梯度归约、有效元素分母与浮点容差，才能从 shape 正确走到训练正确。',
      },
      {
        kicker: '07 · DESIGN',
        title: '让 broadcast 错误尽早失败',
        paragraphs: [
          '公共函数不应只接收两个裸 tensor 然后依赖运行时报错。可以在边界检查 rank、为每条轴提供可读名称，并在不允许广播的维上断言相等；允许共享的维则要求其中一方为 1。对概率、mask、权重等容易误放轴的输入，采用具名 reshape 或辅助函数生成目标 `(B,1,D)`，并用 B、T、D 全不相等的测试锁定意图。这样未来 layout 改变时，错误会在入口暴露而不是变成悄悄错误的训练曲线。',
        ],
        takeaway: '广播规则越强大，接口越应提前说明哪些轴允许被自动扩展。',
      },
      {
        kicker: '08 · PRACTICE',
        title: '手推一次 forward 与 backward',
        paragraphs: [
          '取 `x.shape=(2,3,4)`、`bias.shape=(4)`，先手写右对齐表，逐项计算 `y[b,t,d]=x[b,t,d]+bias[d]`，再令上游梯度全为一并手算 `grad_bias[d]=6`。随后将 bias 改成 `(1,4)`和 `(2,1,4)`，分别指出需要 reduce 的轴。最后故意写成 `(2,4)`并解释它为什么不能对齐到 `(2,3,4)`。这套小实验把广播、梯度与报错维度统一到同一张坐标表。',
        ],
        takeaway:
          '能手推一个非对称例子，才能确认 broadcast 不是只会“自动凑 shape”。将这张表保留在测试注释中，后续修改 tensor layout 时能快速判断变更是否仍保持原有数学含义，并把不允许的对齐明确写成失败样例。',
      },
    ],
    mechanisms: [
      '从尾维比较，相等、1 或缺失维可对齐。',
      '扩展可由 size=1/zero-stride view 表示。',
      'backward 对被扩展维执行 reduce-to-shape。',
      '原地左值不能因 broadcast 改变 shape。',
    ],
    pitfalls: [
      '从左维对齐并误放 singleton。',
      '把 expand 当成真实复制或当成可随意写的 buffer。',
      '遗漏 broadcast backward 的求和。',
      '用恰好相等的 B/T 测试掩盖轴错位。',
    ],
    variants: [
      {
        title: '隐式 broadcast',
        useWhen: '两个输入的轴合同已清晰，逐元素算子直接表达即可。',
        tradeoff: '代码短；需要 shape 注释和测试防止语义错位。',
      },
      {
        title: '显式 unsqueeze/expand',
        useWhen: '要暴露对齐位置、调试布局或为后续接口固定 rank。',
        tradeoff: '意图可见；expand view 不能当独立可写 buffer。',
      },
    ],
    studyPlan: {
      readingMinutes: 25,
      sourceMinutes: 30,
      practiceMinutes: 55,
      reviewMinutes: 15,
    },
    exampleLanguage: 'python',
    example: `import torch
x = torch.ones(2, 3, 4, requires_grad=True)
bias = torch.arange(4.0, requires_grad=True)
y = x + bias
assert y.shape == (2, 3, 4)
y.sum().backward()
assert torch.equal(bias.grad, torch.full((4,), 6.0))
try: torch.ones(1, 3, 1).add_(torch.ones(3, 1, 7))
except RuntimeError: pass
else: raise AssertionError('原地 broadcast 不得改变左值 shape')`,
    buildSteps: [
      {
        title: '积木 1：右对齐 shapes',
        body: '给较短 shape 补前导 1，并逐维检查。',
      },
      {
        title: '积木 2：实现地址复用',
        body: '为 size=1 维生成 zero stride 的教学 view。',
      },
      {
        title: '积木 3：实现逐元素 forward',
        body: '在共同 shape 遍历，记录每个输入坐标。',
      },
      {
        title: '积木 4：实现 reduce backward',
        body: '将输出梯度沿扩展维累加回原 shape。',
      },
      {
        title: '积木 5：加入原地门禁',
        body: '拒绝会改变左值 shape 或多对一写的请求。',
      },
    ],
    selfCheckQuestion:
      '为什么 `(B,T,D)+(D)`合法，且第二项梯度需要沿哪些维求和？为什么 `add_`不能让左值由 `(1,3,1)`变成 `(3,3,7)`？',
    selfCheckAnswer:
      '从尾维对齐后 `(D)`等价于`(1,1,D)`，缺失的两维视作 1，因此可扩展到 `(B,T,D)`。每个 bias[d]被 B×T 个输出复用，反向必须对 B、T 两维求和，结果才回到 `(D)`；可用 `y.sum().backward()`断言每项梯度为 B*T。原地 add_ 的左值仍只有 `(1,3,1)`这套 size/stride/storage 几何，broadcast 只能把右值读到左值形状，不能为左值创建 B 和 D 的独立地址；允许它会既改变 shape 又可能产生多对一写。正确选择是 out-of-place `x+y`，或先明确 `expand().clone()`付费 materialize 并获得独立可写所有权。',
  },
};
