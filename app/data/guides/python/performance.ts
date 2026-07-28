import type { TopicGuide } from '../../topic-guides'

export const pythonPerformanceGuides: Record<string, TopicGuide> = {
  '复杂度模型、常数项与真实工作负载': {
    official: {
      title: 'Python Wiki · TimeComplexity',
      url: 'https://wiki.python.org/moin/TimeComplexity',
      note: '容器操作复杂度是实现与平均/摊销条件下的模型；必须结合真实规模、分布和常数成本验证。'
    },
    overview: [
      'Big-O 抹去常数和低阶项，用于回答规模趋大时增长速度；它不回答 N=50 时哪个实现更快，也不包含网络、分配、解释器 dispatch、缓存 miss 与序列化成本。',
      '性能模型应先定义工作负载：输入规模与分布、读写比例、命中率、并发度、尾延迟和内存上限。相同平均 O(1) 的 dict 查询，在昂贵 __hash__/__eq__ 或攻击性冲突下表现完全不同。'
    ],
    mechanisms: [
      '摊销分析把偶发 resize 成本分摊到一系列 append/insert。',
      '平均复杂度依赖哈希分布等假设，最坏情况仍需安全边界。',
      '算法降低次数，数据布局降低每次操作成本，二者可叠加。',
      '吞吐、平均延迟、p99、CPU、allocation rate 是不同目标。'
    ],
    pitfalls: [
      '用微型 N 证明 O(n²) 优于 O(n log n) 并外推到生产。',
      '优化占总时长 1% 的局部函数，违反 Amdahl 上限。',
      '基准输入过于规则，使 branch/cache/hash 行为失真。'
    ],
    example: `from collections import Counter

def quadratic_duplicates(items):
    return [item for i, item in enumerate(items) if item in items[:i]]

def counted_duplicates(items):
    counts = Counter(items)
    return [item for item in dict.fromkeys(items) if counts[item] > 1]

data = list(range(2_000)) + [7, 9]
assert set(quadratic_duplicates(data)) == {7, 9}
assert set(counted_duplicates(data)) == {7, 9}

# 先验证语义，再用多组 N 和真实重复率画 log-log 曲线；
# 单个 N 的“更快”不能证明增长阶。`,
    buildSteps: [
      { title: '定义成本方程', body: '把总时长拆成调用次数 × 单次成本 + I/O/排队，标出随 N 变化项。' },
      { title: '构造规模序列', body: '至少跨一个数量级，改变数据分布并验证输出完全等价。' },
      { title: '决定优化层次', body: '先去掉数量级瓶颈，再优化热点常数，最后审计内存与尾延迟。' }
    ],
    selfCheckQuestion: '两个方案同为 O(n)，为什么生产性能仍可能相差几十倍？',
    selfCheckAnswer: 'O(n) 只说明增长阶。每项可能包含 Python 回调、哈希、对象分配、缓存 miss、系统调用或向量化 C 循环；数据布局与分支命中也改变常数。必须以真实工作负载测量热点与硬件计数，而非由阶数推断绝对速度。'
  },
  'list、deque 与紧凑/分块存储取舍': {
    official: {
      title: 'collections.deque',
      url: 'https://docs.python.org/3/library/collections.html#collections.deque',
      note: 'deque 为两端 append/pop 提供近似 O(1)，中间随机访问会向较近一端遍历；list 是连续指针数组。'
    },
    source: {
      repo: 'python/cpython',
      file: 'Objects/listobject.c',
      symbol: 'list_resize',
      language: 'c',
      url: 'https://github.com/python/cpython/blob/main/Objects/listobject.c#L93',
      walkthrough: [
        'allocated 已足够且新长度不小于一半时只修改逻辑长度，避免每次缩短都 realloc。',
        '增长按约 1/8 加常数做 over-allocation，使连续 append 获得摊销 O(1)。',
        'list 存的是 PyObject* 连续数组，不内联元素对象；连续的是引用，因此遍历仍需间接寻址。'
      ],
      code: `static int
list_resize(PyListObject *self, Py_ssize_t newsize)
{
    size_t allocated = self->allocated;
    if (allocated >= newsize && newsize >= (allocated >> 1)) {
        Py_SET_SIZE(self, newsize);          // 容量足够，只改逻辑长度
        return 0;
    }

    // 温和过量分配：0, 4, 8, 16, 24, 32, 40, 52...
    size_t new_allocated = ((size_t)newsize + (newsize >> 3) + 6) & ~(size_t)3;
    if (newsize - Py_SIZE(self) > new_allocated - newsize)
        new_allocated = ((size_t)newsize + 3) & ~(size_t)3;

    // 重新分配连续 PyObject* 数组；具体对象仍在别处。
    PyObject **items = PyMem_Realloc(self->ob_item,
                                     new_allocated * sizeof(PyObject *));
    self->ob_item = items;
    self->allocated = new_allocated;
    Py_SET_SIZE(self, newsize);
    return 0;
}`
    },
    overview: [
      'list 的连续引用数组带来 O(1) 随机索引、优秀线性遍历局部性和尾部 append 摊销 O(1)，但头部插删需 memmove 全部引用。deque 用固定大小 block 双向链连接，减少逐元素节点开销并支持两端常数操作。',
      'deque 的中间索引仍需跨 block 行走；list 即使头部 pop(0) 复杂度更差，小规模时也可能因连续布局更快。选择应看操作比例、最大长度与延迟分布。'
    ],
    mechanisms: [
      'list capacity 与 len 分离，sys.getsizeof 可观察阶梯增长。',
      '切片创建新 list 并增加元素引用，不复制元素本体。',
      'deque maxlen 在满时自动从另一端淘汰。',
      'queue.Queue/asyncio.Queue 是同步协议，不等于裸 deque。'
    ],
    pitfalls: [
      '用 list.pop(0) 实现长期生产队列。',
      '只凭 O(1) 认为 deque 任意索引都快。',
      '把容器浅大小当作包含所有元素的总内存。'
    ],
    example: `from collections import deque
import sys

items = []
capacities = []
for value in range(40):
    before = sys.getsizeof(items)
    items.append(value)
    after = sys.getsizeof(items)
    if after != before:
        capacities.append((len(items), after))

assert len(capacities) < len(items)  # append 并非每次 realloc

fifo = deque(items)
assert fifo.popleft() == 0
assert fifo.pop() == 39`,
    buildSteps: [
      { title: '复现 dynamic array', body: '实现 size/capacity/growth，统计 append 的 realloc 次数和复制引用数。' },
      { title: '实现 block deque', body: '固定数组 block + left/right index，覆盖跨块 append/pop。' },
      { title: '按操作混合基准', body: '随机访问、两端操作、遍历与内存分别测，不做单一“谁更快”结论。' }
    ],
    selfCheckQuestion: 'list.append 平均 O(1)，为什么某一次 append 仍可能明显变慢？',
    selfCheckAnswer: '容量耗尽时需要申请更大连续指针数组并复制现有引用，这一次是 O(n)；过量分配让随后多次 append 无需扩容，把总复制成本分摊后得到摊销 O(1)。尾延迟敏感系统仍应关注扩容尖峰。'
  },
  'dict 紧凑布局、探测序列与哈希冲突': {
    official: {
      title: 'C API · Dictionary Objects',
      url: 'https://docs.python.org/3/c-api/dict.html',
      note: 'CPython dict 是开放寻址哈希表；现代紧凑布局分离稀疏索引与按插入顺序排列的 entries。'
    },
    source: {
      repo: 'python/cpython',
      file: 'Objects/dictobject.c',
      symbol: 'do_lookup',
      language: 'c',
      url: 'https://github.com/python/cpython/blob/main/Objects/dictobject.c',
      walkthrough: [
        '先以 hash & mask 选择槽；槽保存 entry index、EMPTY 或 DUMMY，不直接保存完整键值。',
        'hash 相同还要比较键身份/相等；比较可执行 Python 代码并改动 dict，因此实现必须在回调后复查版本与 entry。',
        '冲突通过 perturb 探测新的槽，表必须保留可用空槽，装载率过高时 resize。'
      ],
      code: `static Py_ALWAYS_INLINE Py_ssize_t
do_lookup(PyDictObject *mp, PyDictKeysObject *dk, PyObject *key,
          Py_hash_t hash, check_lookup_func check_lookup)
{
    size_t mask = DK_MASK(dk);
    size_t perturb = hash;
    size_t i = (size_t)hash & mask;

    for (;;) {
        Py_ssize_t index = dictkeys_get_index(dk, i);
        if (index >= 0) {
            int cmp = check_lookup(mp, dk, ep0, index, key, hash);
            if (cmp < 0 || cmp > 0)
                return cmp ? index : DKIX_ERROR;
        }
        else if (index == DKIX_EMPTY) {
            return DKIX_EMPTY;               // 只有从未使用槽能终止未命中
        }
        perturb >>= PERTURB_SHIFT;
        i = mask & (i * 5 + perturb + 1);    // 打散相同初始槽的探测路径
    }
}`
    },
    overview: [
      '紧凑 dict 用 indices 做稀疏探测表，用 entries 顺序保存 hash/key/value。迭代 entries 自然保持插入顺序，indices 可选择 1/2/4/8 字节宽度，避免每个空槽都携带大 entry。',
      '删除不能简单写 EMPTY，否则会截断其他冲突键的探测链，所以留下 DUMMY；大量删除会增加探测并触发重建。哈希相等不代表键相等，最终仍调用 equality，且该调用可能抛异常或重入修改表。'
    ],
    mechanisms: [
      '可哈希键要求生命周期内 hash 稳定，且相等键 hash 相同。',
      '身份相同可跳过昂贵 equality。',
      'resize 同时控制 usable fraction 与 DUMMY 累积。',
      'split table 可让同类实例共享 keys 布局，仅分离 values。'
    ],
    pitfalls: [
      '自定义 __eq__ 相等却给不同 hash，使同一逻辑键并存。',
      '__hash__/__eq__ 依赖可变字段，插入后键“失踪”。',
      '用攻击者可控昂贵 equality 对象作大 dict 键，形成 CPU DoS。'
    ],
    example: `class Key:
    comparisons = 0
    def __init__(self, value):
        self.value = value
    def __hash__(self):
        return 1                       # 故意制造所有键初始冲突
    def __eq__(self, other):
        type(self).comparisons += 1
        return isinstance(other, Key) and self.value == other.value

mapping = {Key(i): i for i in range(100)}
Key.comparisons = 0
assert mapping[Key(99)] == 99
assert Key.comparisons > 1             # 平均 O(1) 假设已被破坏`,
    buildSteps: [
      { title: '实现开放寻址', body: 'indices + entries，区分 EMPTY/DUMMY，按 hash/equality 查找。' },
      { title: '加入扰动与 resize', body: '统计 load factor、平均 probe、p99 probe 和 DUMMY 比例。' },
      { title: '测试可重入比较', body: '__eq__ 中修改 mapping，验证版本检查或安全重试策略。' }
    ],
    selfCheckQuestion: 'dict 删除槽为什么要保留 DUMMY，而不能直接变成 EMPTY？',
    selfCheckAnswer: '冲突键可能沿探测链越过该槽存放。查找看到 EMPTY 会断定后面不可能有目标并提前终止；DUMMY 表示此处可插入但查找必须继续，保持现有探测链可达。'
  },
  '可重复基准：timeit、pyperf、噪声与效应量': {
    official: {
      title: 'timeit · Measure execution time',
      url: 'https://docs.python.org/3/library/timeit.html',
      note: 'timeit 重复执行小段代码并默认禁用 GC，以减少常见计时陷阱；复杂可靠基准仍需进程级校准和统计。'
    },
    overview: [
      '基准是实验。应固定语义、输入、解释器版本、依赖、硬件/电源策略，隔离 setup 与 measured region，并用多进程多值分布报告中位数、方差和置信区间。',
      'CPython specialization、缓存、分配器和操作系统 page cache 都需要热身。只取 min 可近似无干扰下界，却掩盖真实尾延迟；优化结论还需给绝对差、相对差和业务效应量。'
    ],
    mechanisms: [
      'perf_counter_ns 适合墙钟短区间，但函数调用本身有测量开销。',
      'timeit 默认关闭 GC，若 workload 的 GC 成本真实存在应显式开启。',
      'pyperf 可校准循环、进程热身、保存 JSON 并比较结果。',
      '输入构造、随机生成与结果校验应在计时外，除非它们属于目标路径。'
    ],
    pitfalls: [
      '只跑一次，或从同一进程连续测 A 再 B 产生顺序偏差。',
      '优化器/缓存让被测结果未消费，测到不真实路径。',
      '5% 微基准提升换来 p99、内存或可维护性恶化。'
    ],
    example: `import gc
import statistics
import time

def benchmark(fn, data, repeat=15):
    samples = []
    for _ in range(repeat):
        gc.collect()
        started = time.perf_counter_ns()
        result = fn(data)
        elapsed = time.perf_counter_ns() - started
        assert result is not None              # 保持真实消费/语义检查
        samples.append(elapsed)
    return {
        "median_ns": statistics.median(samples),
        "p90_ns": sorted(samples)[int(repeat * .9) - 1],
        "samples": samples,
    }`,
    buildSteps: [
      { title: '先写等价测试', body: '属性/边界/随机输入证明候选实现相同，再允许比较性能。' },
      { title: '隔离实验变量', body: '随机交错 A/B，固定环境并记录 warmup、GC、输入分布。' },
      { title: '设决策门槛', body: '预先定义至少提升多少、置信区间、内存和尾延迟预算。' }
    ],
    selfCheckQuestion: '为什么 timeit 的最小值有时有意义，却不能代表生产延迟？',
    selfCheckAnswer: '外部调度和噪声通常只会增加时间，最小值可估计最少干扰的执行成本；生产关心 GC、竞争、缓存冷态与排队造成的分布，尤其 p95/p99。应按问题选择下界或真实分布，而非把 min 当普遍答案。'
  },
  'cProfile、pstats 与确定性调用图': {
    official: {
      title: 'The Python Profilers',
      url: 'https://docs.python.org/3/library/profile.html',
      note: 'cProfile 对函数 call/return 事件做确定性统计；pstats 以调用次数、自身时间、累计时间、caller/callee 关系分析。'
    },
    overview: [
      '确定性 profiler 记录每次函数进入退出，能完整给出调用图，但 instrumentation 会改变短函数与高频调用成本。tottime 是函数体排除子调用的时间，cumtime 包含子调用；递归时 primitive calls 与 total calls 不同。',
      '异步程序的墙钟等待会归到调用链或 event loop，不能直接等同 CPU 热点。先用整体 profile 定位 subsystem，再用 line profiler、sampling、I/O metrics 或 trace span验证。'
    ],
    mechanisms: [
      '按 cumulative 排序找昂贵调用树，按 tottime 找自身 CPU 热点。',
      'print_callers/print_callees 判断热点来自谁、扩散到哪。',
      'dump_stats 保存原始 profile，可脱离生产进程分析。',
      '内建/C 函数粒度与 Python 函数不同，时间边界需理解。'
    ],
    pitfalls: [
      '只看调用次数最多函数，忽略单次极慢路径。',
      '把 sleep/I/O 等待归因成函数 CPU 消耗。',
      '在微秒级函数上长期开启 tracing profiler并相信绝对数。'
    ],
    example: `import cProfile
import pstats

def normalize(rows):
    return [row.strip().lower() for row in rows if row.strip()]

profiler = cProfile.Profile()
profiler.enable()
for _ in range(200):
    normalize([" A ", "", " B "] * 100)
profiler.disable()

stats = pstats.Stats(profiler).strip_dirs()
stats.sort_stats(pstats.SortKey.CUMULATIVE).print_stats(10)
stats.print_callers("normalize")`,
    buildSteps: [
      { title: '画调用树假设', body: '采集前先写预期入口/热点/等待，再用 profile 证伪。' },
      { title: '双排序分析', body: 'cumtime 找树，tottime 找叶，caller/callee 验证传播路径。' },
      { title: '缩小与复测', body: '抽出热点最小 workload，优化后用相同 profile 与端到端指标复验。' }
    ],
    selfCheckQuestion: 'cProfile 中 tottime 与 cumtime 应如何一起阅读？',
    selfCheckAnswer: 'tottime 是函数自身执行，不含子调用；cumtime 包含它调用的所有后代。cumtime 高、tottime 低说明它是昂贵子树入口；两者都高说明函数体本身是热点。只看其中一个容易优化错误层级。'
  },
  '采样 profiler、火焰图与生产诊断': {
    official: {
      title: 'profiling · Python profilers',
      url: 'https://docs.python.org/3/library/profiling.html',
      note: '采样 profiler 周期性观察正在执行的栈，开销与调用次数弱相关；火焰图用宽度表达样本占比而非时间顺序。'
    },
    overview: [
      '采样 profiler 每隔一段时间获取栈，函数占 CPU 的比例越高越可能被采到。它适合长时间、生产和混合 Python/native 栈；很短或罕见函数可能完全漏采，采样频率也会与周期性 workload 产生 aliasing。',
      '火焰图横向宽度是聚合样本数，纵向是调用深度，相邻块不表示时间先后。CPU flame graph 看 on-CPU 热点，wall/off-CPU profiler 才能显示睡眠、锁、I/O 等等待。'
    ],
    mechanisms: [
      '统计误差约随样本数增加而降低，低占比热点需更长采集。',
      'native frame、GIL state 和线程选择取决于工具能力与权限。',
      '火焰图 top-down 看入口，bottom-up/callee 看共同叶热点。',
      '连续 profiling 应限采样率并保护符号/源码敏感信息。'
    ],
    pitfalls: [
      '把火焰宽度理解为单次函数耗时。',
      'CPU sampling 看不到数据库等待，就断言数据库无关。',
      '只采主线程，遗漏 executor、worker 或 C 扩展线程。'
    ],
    example: `# 生产诊断记录模板（配合 py-spy/perf 等外部采样器）：
profile_contract = {
    "target": "pid / container / worker set",
    "clock": "cpu or wall",
    "duration_s": 60,
    "rate_hz": 99,          # 避免与常见 100 Hz 周期完全同频
    "threads": "all",
    "native_frames": True,
    "workload_window": "request rate and p99 attached",
}

# 结果解释必须同时附相同时间窗的 CPU、吞吐、延迟、I/O wait；
# 火焰图单独无法证明因果。`,
    buildSteps: [
      { title: '定义采样合同', body: '目标进程/线程、CPU 或 wall、频率、时长、native frames、负载窗口。' },
      { title: '先聚合再下钻', body: '找最宽调用塔，再按线程、请求类型或阶段拆分。' },
      { title: '用另一证据验证', body: '对候选热点加指标、trace 或 deterministic micro profile，确认因果。' }
    ],
    selfCheckQuestion: '为什么火焰图中两个横向相邻的函数不代表它们按这个顺序执行？',
    selfCheckAnswer: '火焰图把相同栈前缀的样本聚合并按工具规则排列，横向位置用于容纳宽度，不是时间轴。宽度近似该栈占采样比例；要分析时序需 timeline trace 或事件记录。'
  },
  'tracemalloc 快照、对象存活与 RSS 分离': {
    official: {
      title: 'tracemalloc',
      url: 'https://docs.python.org/3/library/tracemalloc.html',
      note: 'tracemalloc 跟踪经 Python allocator 分配的内存块及其分配 traceback，可比较快照；它不等于对象引用图或进程 RSS。'
    },
    overview: [
      '快照差分回答“哪些 Python allocation trace 的存活字节增加”。它不直接回答谁持有对象，也可能看不到未接入 domain 的 C 库/GPU/mmap 内存。对象释放后 allocator 还可保留 arena 供复用，因此 tracemalloc 降低而 RSS 不降并不矛盾。',
      '泄漏诊断要组合三层：tracemalloc 定位分配栈，对象图/weakref/gc 定位所有者，RSS/USS 与 native profiler 定位进程和 C 层。启动越早、traceback depth 越深，证据越完整但开销越高。'
    ],
    mechanisms: [
      'Snapshot.compare_to 按 lineno/traceback 统计 size_diff/count_diff。',
      '过滤 importlib/tracemalloc 噪声后再排名。',
      'get_traced_memory 区分 current/peak，reset_peak 只重置峰值。',
      'domain 允许 C 扩展标记其他 allocator 范围。'
    ],
    pitfalls: [
      '只看峰值就称泄漏，批处理暂态峰值可能完全释放。',
      'RSS 不下降就认为 Python 对象仍活着。',
      '快照在不同业务负载点采集，差分只是流量差异。'
    ],
    example: `import gc
import tracemalloc

tracemalloc.start(10)
before = tracemalloc.take_snapshot()

cache = {index: bytearray(1024) for index in range(1_000)}
after_growth = tracemalloc.take_snapshot()
growth = after_growth.compare_to(before, "lineno")
assert sum(stat.size_diff for stat in growth) > 900_000

cache.clear()
gc.collect()
after_clear = tracemalloc.take_snapshot()
remaining = after_clear.compare_to(after_growth, "lineno")
assert sum(stat.size_diff for stat in remaining) < 0`,
    buildSteps: [
      { title: '固定生命周期点', body: 'warmup 后 baseline，重复操作多轮，cleanup+gc 后 end，避免比较不同业务阶段。' },
      { title: '从 trace 到 owner', body: '对增长类型用 weakref/gc.get_referrers 或领域 registry 找强引用。' },
      { title: '交叉验证 RSS', body: '同时记录 traced current、object count、RSS/USS、native/GPU 指标。' }
    ],
    selfCheckQuestion: 'tracemalloc 显示内存已释放，但 RSS 为什么可能保持不变？',
    selfCheckAnswer: '对象块已回到 Python/系统 allocator，可被进程后续分配复用；allocator 的 pool/arena 或碎片未必立刻归还 OS。tracemalloc 看活跃被跟踪块，RSS 看进程驻留页，二者处在不同抽象层。'
  },
  'dis、inline cache 与 specializing interpreter': {
    official: {
      title: 'dis · adaptive bytecode and inline caches',
      url: 'https://docs.python.org/3/library/dis.html',
      note: '3.11+ 解释器可把通用 bytecode quicken 为 guarded specialized instructions；dis(adaptive=True, show_caches=True) 显示运行态指令和缓存。'
    },
    overview: [
      '编译器产生通用 bytecode；运行后 adaptive opcode 统计命中，观察稳定类型/对象 shape 后改写为更窄操作并把版本、偏移等 guard 数据存在相邻 inline cache。guard 失败会退化或重新 specialization。',
      'specialization 优化动态查找的常见稳定情况，不改变 Python 语义。多态热点让 cache 反复失败/退化，解释了相同源码在稳定与高度混合输入下的性能差异。bytecode 是版本内部细节，不应成为库兼容合同。'
    ],
    mechanisms: [
      'CACHE 逻辑上属于前一条指令，普通 dis 默认隐藏。',
      'warmup 后 adaptive=True 才能观察实际 specialized opcode。',
      'type/version tags 等 guard 证明缓存仍有效。',
      'monomorphic/polymorphic/megamorphic 描述调用点 shape 稳定程度。'
    ],
    pitfalls: [
      '只 dis 冷函数，得出 specialization 没发生。',
      '修改 raw co_code 或硬编码 offset 跨 Python 版本。',
      '为了 specialization 重写清晰代码，却未测端到端收益。'
    ],
    example: `import dis

class Point:
    def __init__(self, x):
        self.x = x

def total(points):
    result = 0
    for point in points:
        result += point.x
    return result

points = [Point(i) for i in range(20)]
for _ in range(20_000):
    total(points)                           # 热身稳定 shape

dis.dis(total, adaptive=True, show_caches=True)
# 观察 LOAD_ATTR/CALL/BINARY_OP 是否 specialized；
# opcode 名随 CPython 版本变化，不写死断言。`,
    buildSteps: [
      { title: '实现 adaptive slot', body: '通用 opcode + counter，达到阈值后安装 guard/cache/specialized handler。' },
      { title: '实现 deopt', body: '类型/version guard 失败回通用路径，累计失败后降级。' },
      { title: '比较 shape 稳定性', body: '同型对象与混合 descriptor/proxy 输入比较 cache stats 和性能。' }
    ],
    selfCheckQuestion: 'inline cache 为什么必须带 guard，而不能直接永远复用第一次查到的属性偏移？',
    selfCheckAnswer: '类字典、descriptor、实例 shape 和继承关系可动态改变；旧偏移可能返回错误值。cache 只在 type/version 等条件仍成立时有效，guard 失败必须走通用语义并更新或退化，性能不能牺牲动态语言正确性。'
  },
  'GIL、释放点、free-threading 与线程安全': {
    official: {
      title: 'Python support for free threading',
      url: 'https://docs.python.org/3/howto/free-threading-python.html',
      note: '传统构建用 GIL 串行化 Python 执行；3.13+ 可选 free-threaded 构建允许多核 Python threads，但扩展可能重新启用 GIL且对象同步成本改变。'
    },
    overview: [
      'GIL 保护 CPython 运行时，让一个解释器中通常只有一个线程执行 Python bytecode；线程在 I/O、显式释放 GIL 的 C 扩展或调度切换时交棒。它不保证复合业务操作原子，也不阻止操作系统 I/O 并发。',
      'free-threaded 构建移除全局锁，使用容器内部锁、biased/deferred reference counting、immortalization 与 QSBR 等机制。它能让 CPU Python threads 多核并行，也带来单线程/内存开销和新的真实数据竞争；未声明兼容的 C 扩展可在导入时重新启用 GIL。'
    ],
    mechanisms: [
      'sys._is_gil_enabled 检查运行态，sysconfig Py_GIL_DISABLED 检查构建能力。',
      'NumPy/压缩/加密等 C 代码可能释放 GIL并行，需看具体 API。',
      '内建类型内部锁是实现保护，不是多步骤业务事务。',
      '锁、Queue、immutable snapshot 仍是跨构建可移植同步合同。'
    ],
    pitfalls: [
      '说“有 GIL 所以 dict check-then-set 线程安全”。',
      '说“线程对 CPU 永远无用”，忽略释放 GIL 的扩展/free-threaded。',
      '启用 free-threading 后删除所有锁，暴露复合不变量竞态。'
    ],
    example: `import sys
import sysconfig
import threading

build_supports_free_threading = bool(
    sysconfig.get_config_var("Py_GIL_DISABLED")
)
gil_enabled = (
    sys._is_gil_enabled()
    if hasattr(sys, "_is_gil_enabled")
    else True
)

lock = threading.Lock()
state = {"balance": 0}

def deposit(amount):
    # 读-改-写是复合不变量，跨构建都应显式同步。
    with lock:
        state["balance"] += amount`,
    buildSteps: [
      { title: '分层声明', body: '区分 bytecode、C extension、I/O、业务复合操作各自并行/原子边界。' },
      { title: '双构建测试', body: 'GIL 与 free-threaded 上跑 race stress、TSAN/扩展兼容和性能基准。' },
      { title: '证明锁范围', body: '锁保护具体不变量而非“整个函数”，测竞争、粒度与死锁顺序。' }
    ],
    selfCheckQuestion: 'GIL 为什么不能保证 `if key not in d: d[key] = value` 的业务原子性？',
    selfCheckAnswer: '这是多个操作组成的 check-then-act，中间可在字节码/C 调用/调度点切换，另一线程也可能通过检查并写入。GIL 保护解释器内部免于结构损坏，不把任意多步逻辑变成事务；应使用锁或原子化 owner API。'
  },
  'multiprocessing 序列化、启动方式与共享内存': {
    official: {
      title: 'multiprocessing · Contexts and start methods',
      url: 'https://docs.python.org/3/library/multiprocessing.html#contexts-and-start-methods',
      note: 'spawn、fork、forkserver 拥有不同状态继承与安全边界；Queue/Pipe/Pool 通常 pickle 参数，shared_memory 可避免大 buffer 复制。'
    },
    overview: [
      'process 绕过单解释器 GIL，但带来启动、序列化、IPC 和结果合并成本。spawn 启动干净解释器并重新导入 main，跨平台清晰但较慢；fork 复制当前地址空间并利用 copy-on-write，却会继承锁/线程/连接的不安全中间态。',
      'Pool 参数与结果通常 pickle，发送大对象可能比计算更贵。shared_memory 共享字节存储但不共享 Python 对象语义，需要 shape/dtype/所有权/同步协议，并由 creator/unlink owner 防止资源泄漏。'
    ],
    mechanisms: [
      '__main__ guard 防 spawn 子进程重复创建进程。',
      'copy-on-write 只在页未写时节省内存，引用计数/allocator 写入会破坏共享。',
      'chunksize 平衡调度公平与每任务 IPC 开销。',
      'worker 异常需序列化回父进程，原始本地资源不可自动跨进程清理。'
    ],
    pitfalls: [
      '把 lambda、局部函数、打开连接当 spawn 任务参数。',
      'fork 一个已有多线程的服务进程并继续使用继承锁。',
      '共享内存只有 creator close，没有 unlink 或消费者仍在访问时过早 unlink。'
    ],
    example: `from concurrent.futures import ProcessPoolExecutor

def cpu_sum(chunk):
    return sum(value * value for value in chunk)

def parallel_sum(values, workers=4):
    size = max(1, len(values) // workers)
    chunks = [values[i:i + size] for i in range(0, len(values), size)]
    with ProcessPoolExecutor(max_workers=workers) as pool:
        return sum(pool.map(cpu_sum, chunks))

if __name__ == "__main__":
    data = list(range(100_000))
    assert parallel_sum(data) == cpu_sum(data)
    # 必须与串行版本比较；小输入通常被启动与 pickle 成本反超。`,
    buildSteps: [
      { title: '建立成本模型', body: 'Tstart + serialize bytes/bandwidth + compute + merge，找并行盈亏点。' },
      { title: '测试三启动方式', body: '记录模块状态、线程锁、随机种子、连接和启动时间差异。' },
      { title: '实现 shared buffer owner', body: 'creator/name/shape/dtype/ref protocol/close/unlink/崩溃恢复全部显式化。' }
    ],
    selfCheckQuestion: '为什么把 CPU 函数放进 ProcessPool 后可能比串行更慢？',
    selfCheckAnswer: '进程启动、任务排队、pickle 参数/结果、内核 IPC 和合并都是额外固定/线性成本；任务太小或数据太大时并行计算节省不足以覆盖它们。要增大 chunk、减少传输或共享底层 buffer，并实测盈亏点。'
  },
  '缓存命中、失效、stampede 与内存预算': {
    official: {
      title: 'functools.lru_cache',
      url: 'https://docs.python.org/3/library/functools.html#functools.lru_cache',
      note: 'lru_cache 以可哈希参数为 key，线程安全维护结构并持有参数/结果强引用；并发首次 miss 仍可能重复计算。'
    },
    overview: [
      '缓存把计算换成查找与内存，正确性取决于 key 是否覆盖所有影响结果的输入、结果允许陈旧多久、依赖变化如何失效。TTL 只是时间近似，版本/事件失效表达更精确因果。',
      '并发 miss 可能产生 stampede：多个请求同时计算同一 key。single-flight 让一个 owner 计算，其余等待同一 Future；失败、超时和取消必须决定是否共享、是否负缓存以及何时允许重试。',
      'maxsize 只限制 entry 数，不限制结果深层字节；缓存还持有 key/arguments 强引用。必须度量 hit/miss/eviction、compute saved、entry bytes 和 stale rate。'
    ],
    mechanisms: [
      'LRU 优化最近性假设，扫描/大流量可污染热集。',
      'typed=False 仍可能把某些不同类型分成键，关键字顺序也可能形成不同 entry。',
      '负缓存可保护持续不存在资源，但 TTL 应较短。',
      '分布式缓存还需序列化、网络、租户隔离和一致性策略。'
    ],
    pitfalls: [
      '缓存依赖全局配置/权限的函数却未把版本放 key。',
      '无界 @cache 保存用户高基数输入和大对象。',
      'single-flight owner 被取消后，所有 waiter 永远等待未完成 Future。'
    ],
    example: `import asyncio

class SingleFlight:
    def __init__(self):
        self._inflight = {}
        self._lock = asyncio.Lock()

    async def get(self, key, factory):
        async with self._lock:
            task = self._inflight.get(key)
            if task is None:
                task = asyncio.create_task(factory())
                self._inflight[key] = task
        try:
            return await asyncio.shield(task)
        finally:
            if task.done():
                async with self._lock:
                    if self._inflight.get(key) is task:
                        del self._inflight[key]`,
    buildSteps: [
      { title: '定义 key 与 freshness', body: '列出参数、配置/模型/权限版本、租户和 locale，明确 TTL/事件失效。' },
      { title: '实现 single-flight', body: '每 key 共享 Task；owner 失败/取消/timeout 后唤醒全部 waiter 并允许重试。' },
      { title: '建立预算', body: 'entry count + estimated deep bytes + hit saved latency；扫描污染时选择 admission policy。' }
    ],
    selfCheckQuestion: '为什么 lru_cache 声明线程安全，仍可能对同一参数并发执行函数多次？',
    selfCheckAnswer: '线程安全保证内部字典/链表结构一致，不保证 miss 计算期间全局持锁。两个线程可同时看见 miss、各自计算，再写入相同 key。昂贵或有副作用的工作需要额外 per-key single-flight/幂等约束。'
  }
}
