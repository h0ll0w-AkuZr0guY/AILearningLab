import type { TopicGuide } from '../../topic-guides'

export const typescriptGcGuides: Record<string, TopicGuide> = {
  '可达性 GC、WeakRef 与 FinalizationRegistry': {
    official: {
      title: 'ECMAScript Language Specification · Processing Model of WeakRef and FinalizationRegistry Targets',
      url: 'https://tc39.es/ecma262/multipage/executable-code-and-execution-contexts.html#sec-processing-model-of-weakref-and-finalizationregistry-targets',
      note: '规范以“对象身份未来是否仍可被程序观察”描述 liveness 的下界，并允许实现用 reachability 等保守近似。WeakRef 不保持目标存活；清理回调只可能在同步执行结束后的某个未来时刻运行，规范不保证任何对象一定被回收，也不保证回调一定发生。'
    },
    source: {
      repo: 'v8/v8',
      file: 'src/heap/mark-compact.cc',
      symbol: 'MarkCompactCollector::MarkLiveObjects',
      language: 'cpp',
      url: 'https://github.com/v8/v8/blob/main/src/heap/mark-compact.cc',
      walkthrough: [
        '若此前做过 incremental marking，MarkLiveObjects 先停止增量阶段并发布所有线程/页面的 marking barrier 缓冲，避免新增边在最终停顿中丢失。',
        'RootMarkingVisitor 从 isolate、执行栈、handle、全局与 embedder 边界等根开始，随后还会扫描 client heap 与保留的 Map。',
        '并行标记可由多个线程求传递闭包；进入最终原子停顿后，再保守扫描栈并以单线程闭包处理 weak map、ephemeron 和 embedder heap 等需要固定点的关系。',
        'MarkTransitiveClosureFixpoint 表明 weak relation 不能只做一次 DFS：一个 WeakMap key 的存活可能使 value 新增可达边，必须迭代到不再发现新对象。',
        '标记只回答谁活着；后续 sweeping 回收未标记块，compaction/evacuation 移动物体并更新指针。V8 会按空间、碎片和延迟目标组合这些阶段。'
      ],
      code: `// 摘自 V8 src/heap/mark-compact.cc，保留 MarkLiveObjects 的真实阶段顺序。
// 省略 tracing、CppHeap 细节与统计代码，中文注释解释每个阶段维护的不变量。
void MarkCompactCollector::MarkLiveObjects() {
  const bool was_marked_incrementally =
      !heap_->incremental_marking()->IsStopped();

  if (was_marked_incrementally) {
    // 结束增量阶段，并把 mutator 写屏障积累的局部工作发布到全局队列。
    heap_->incremental_marking()->Stop();
    MarkingBarrier::PublishAll(heap_);
    local_weak_objects()->next_ephemerons_local.Publish();
  }

  RootMarkingVisitor root_visitor(this);

  // 从强根开始染色；根自身不一定是普通 JS property。
  MarkRoots(&root_visitor);
  MarkObjectsFromClientHeaps();
  RetainMaps();

  if (v8_flags.parallel_marking && UseBackgroundThreadsInCycle()) {
    parallel_marking_ = true;
    MarkTransitiveClosureFixpoint(); // 多线程消耗 marking worklist
    parallel_marking_ = false;
  }

  // 最终停顿中补扫保守栈，防止并发阶段遗漏主线程临时指针。
  MarkRootsFromConservativeStack(&root_visitor);

  // weak map / ephemeron 需要固定点：key 新存活可能使 value 进入强闭包。
  CHECK(heap_->concurrent_marking()->IsStopped());
  if (!MarkTransitiveClosureFixpoint()) {
    MarkTransitiveClosureLinear();
  }

  CHECK(local_marking_worklists_->IsEmpty());
}`
    },
    overview: [
      'JavaScript 的对象不会因为“离开某个花括号”立刻释放。垃圾回收器从一组 roots 出发，沿强引用边寻找仍可到达的对象；未被证明存活的对象才成为回收候选。闭包、事件监听器、缓存 Map、定时器回调、DOM/原生绑定都可能形成根到对象的路径。循环本身不是泄漏，只要整环与 roots 断开，tracing collector 仍能回收。',
      '真实 V8 GC 远比“标记清除”四个字复杂。它按年龄划分空间，用 young collection 利用“大多数对象很快死亡”的经验；old generation 的 major GC 组合增量、并行和并发标记，写屏障在 mutator 修改对象图时维护正确性；sweep 与 compaction 在吞吐、碎片、停顿和内存峰值之间取舍。课程会先造一个可验证的 tracing collector，再逐层加入这些约束。',
      'WeakMap、WeakRef 与 FinalizationRegistry 只适合少量专门问题。WeakMap 让 metadata 不反向延长 key 生命周期；WeakRef 允许“有就复用、没有就重建”的机会式缓存；FinalizationRegistry 可做非关键资源的兜底提示。它们都不提供确定析构语义，正确性、文件句柄、锁和事务绝不能依赖 GC 何时发生。'
    ],
    chapters: [
      {
        title: '从 roots 与对象图理解“还活着”',
        kicker: '01 · REACHABILITY',
        paragraphs: [
          '教学模型把 heap 画成有向图：节点是对象，边是对象字段、数组元素、闭包捕获、Map entry 或宿主引用；roots 是执行栈、当前 context、全局对象、持久 handle、正在排队的任务等收集器必须先相信存活的入口。标记从 roots 进行 DFS/BFS，只要存在一条强边路径，对象就不能回收。',
          '词法作用域只影响名称解析，运行时生命周期取决于 Environment Record 是否仍被某个函数对象引用。一个事件回调捕获大数组，即便创建回调的函数早已 return，只要事件目标仍保存回调，closure environment 和数组仍可达。把局部变量设为 null 只有在它确实切断最后一条强路径时才有意义。',
          '现代优化器可把不逃逸对象标量替换进寄存器，甚至从未分配真实 heap object。规范关心程序可观察行为，不承诺每个对象字面量都有固定地址。内存分析因此要看 retained path 与分配栈，不能把源码中的变量数量直接等同于 heap 对象数量。'
        ],
        points: [
          '自环 A→A、互环 A↔B 都可回收，只要 root 不再能到达环。',
          'Map 的 key/value 是强边；WeakMap 的 key 是 ephemeron 关系，不能用普通“弱 key、强 value”一句话替代。',
          'DevTools 的 detached DOM tree 仍存活，通常意味着 JavaScript 或宿主侧还有 retained path。'
        ],
        code: `type Node = { name: string; edges: Node[] }

const root: Node = { name: "root", edges: [] }
const a: Node = { name: "a", edges: [] }
const b: Node = { name: "b", edges: [] }

a.edges.push(b)
b.edges.push(a) // 循环
root.edges.push(a)

root.edges.length = 0 // 切断 root 后，a/b 整个环都不可达
// JS 无法直接断言它们何时被 GC；后续用教学 collector 验证图算法。`,
        language: 'typescript',
        takeaway: '判断泄漏时只问一件事：哪条从 root 出发的强路径仍到达目标？“有循环”“函数返回了”“变量出了作用域”都不是充分证据。'
      },
      {
        title: '三色标记与强不变量',
        kicker: '02 · TRI-COLOR',
        paragraphs: [
          '三色是标记过程的状态模型。white 表示尚未发现，grey 表示已经发现但子边未扫描完，black 表示自身与当时可见的子边均已扫描。初始化时 roots 被染成 grey；循环从 worklist 取 grey 节点，发现 white 子节点就染 grey，扫描完成后把当前节点染 black。',
          'stop-the-world 时 mutator 暂停，对象图不变化，算法很直接。增量标记允许 JavaScript 在小段标记工作之间继续运行；若 black 对象新增一条指向 white 对象的边，collector 可能已经不会再访问 black，最终误把仍可达的 white 回收。Dijkstra 风格写屏障把新 value 染 grey，维持“没有 black 指向 white”的强三色不变量。',
          '写屏障不是用户可调用的 Proxy trap，而是引擎在字段写入、elements 写入、编译代码和 runtime stub 周围插入的低层协议。它增加每次写的成本，却换来更短的主线程停顿。并发标记还要处理 worker 与 mutator 的数据竞争，V8 会使用原子状态转换、更保守的 barrier 与 bailout worklist。'
        ],
        code: `type Color = "white" | "grey" | "black"

function writeBarrier(
  owner: HeapNode,
  value: HeapNode,
  worklist: HeapNode[]
) {
  // 教学版强三色不变量：black 不能新增未登记的 white 后继。
  if (owner.color === "black" && value.color === "white") {
    value.color = "grey"
    worklist.push(value)
  }
  owner.edges.add(value)
}`,
        language: 'typescript',
        takeaway: '增量/并发 GC 的核心难题不是遍历，而是 mutator 同时修改图时，collector 仍不能漏掉任何未来可观察对象。'
      },
      {
        title: '分代假设、young GC 与 remembered set',
        kicker: '03 · GENERATIONS',
        paragraphs: [
          '多数应用会产生大量短命临时对象。分代 GC 把新对象放入 young generation，频繁只收集这部分；幸存若干次的对象晋升 old generation，old collection 更少但更重。V8 的具体空间名称和晋升策略会演进，稳定思想是用年龄与存活率缩小常见回收的工作集。',
          '只扫描 young roots 会漏掉 old object 指向 young object 的边，所以老对象写入年轻对象时，写屏障还要维护 remembered set/card table。young collection 把执行 roots 加上 remembered old-to-young slots 当作入口。代际写屏障和增量标记 barrier 目的不同，实际引擎常在同一 store path 中组合检查。',
          '复制/evacuation 适合年轻空间，因为幸存少，移动少量 live object 比扫描大量 dead block 更划算。移动后所有指针必须更新；对象 identity 在语言层保持不变，用户看不到物理地址变化。old space 是否 compact 则要综合碎片、可移动性、内存峰值和停顿预算。'
        ],
        points: [
          'allocation 很快不等于零成本；nursery bump allocation 可便宜，但最终会转化为 GC 工作。',
          '减少所有临时对象未必更快，池化对象可能让短命对象晋升、扩大 old heap 并增加状态重置错误。',
          '优化前记录 allocation rate、young/major GC 频率、pause percentile 与 retained size。'
        ],
        code: `class ObjectPool<T extends object> {
  private free: T[] = []
  constructor(private readonly create: () => T) {}
  acquire(): T { return this.free.pop() ?? this.create() }
  release(value: T): void { this.free.push(value) }
}

// 池化让对象长期被 free 数组强引用，可能把短命分配变成长寿命 retained heap。
const pool = new ObjectPool(() => ({ x: 0, y: 0 }))
const point = pool.acquire()
pool.release(point)`,
        language: 'typescript',
        takeaway: '分代优化基于对象寿命分布。对象池、全局缓存与复用会主动改变这个分布，必须用数据证明收益。'
      },
      {
        title: 'WeakMap 是 ephemeron，不是可枚举弱字典',
        kicker: '04 · EPHEMERON',
        paragraphs: [
          'WeakMap key 不因出现在表中就被视为强可达，并且 API 不提供 keys、size 或全量迭代，否则程序可通过枚举观察 GC 决策。典型用途是为外部对象附加 metadata：只要外部对象活着就能查到数据；外部对象死亡时，表项可一起消失。',
          '困难点在 value 反向引用 key。若简单把 key 弱、value 强，value→key 会让 key 永远存活；若简单忽略整条 entry，又可能过早回收仍被活 key 关联的 value。ephemeron 规则是：只有 key 已被其他强路径证明存活，entry 的 value 才加入标记闭包。value 新标记后还可能发现更多 key，所以要迭代固定点。',
          'WeakSet 与 WeakMap 适合生命周期附着，不适合需要确定淘汰、容量、命中率和遍历的业务缓存。后者应使用 Map 加 TTL/LRU/容量策略。WeakMap 的“自动清理”也无法告诉你何时释放外部资源。'
        ],
        code: `type Metadata = { traceId: string; createdAt: number }
const metadata = new WeakMap<object, Metadata>()

function attach(target: object, traceId: string) {
  metadata.set(target, { traceId, createdAt: Date.now() })
}

function inspect(target: object): Metadata | undefined {
  return metadata.get(target)
}

let request: object | null = {}
attach(request, "trace-1")
console.assert(inspect(request)?.traceId === "trace-1")
request = null
// 不能查询 WeakMap 何时删除，也不能枚举证明它已删除。`,
        language: 'typescript',
        takeaway: 'WeakMap 表达“value 的生命周期从属于仍由别处拥有的 key”。需要控制回收时间或查看缓存内容时，它就不是合适抽象。'
      },
      {
        title: 'WeakRef 的 deref 只提供机会式观察',
        kicker: '05 · WEAKREF',
        paragraphs: [
          'new WeakRef(target) 不保持 target 存活。deref() 返回 target 或 undefined；一旦某次同步执行中成功返回对象，规范把它加入 agent 的 KeptAlive 列表，直到宿主在同步工作结束后 ClearKeptObjects。这样同一 job 中不会出现第一次 deref 得到对象、下一行突然 undefined 的撕裂体验。',
          '“同步工作结束”由 host 调度边界决定，浏览器 task/microtask 与 Node event loop 会影响何时允许清空 kept objects。规范仍不承诺下一次 await/timer 之后一定回收。JIT 可能延长或缩短变量的实际 liveness，开发者工具与调试日志也会改变对象是否可观察。',
          'WeakRef 适合可重建值的软缓存：先 deref，失败就重新加载，并把新对象放入 WeakRef。它不适合身份必须稳定的单例、授权状态、幂等记录或正确性缓存；GC 压力变化会直接改变命中率和延迟分布。'
        ],
        code: `class OpportunisticCache<K, V extends object> {
  private readonly entries = new Map<K, WeakRef<V>>()

  getOrCreate(key: K, create: () => V): V {
    const cached = this.entries.get(key)?.deref()
    if (cached) return cached

    const value = create()
    this.entries.set(key, new WeakRef(value))
    return value
  }
}

const cache = new OpportunisticCache<string, { bytes: Uint8Array }>()
const asset = cache.getOrCreate("logo", () => ({ bytes: new Uint8Array(1024) }))
console.assert(asset.bytes.length === 1024)`,
        language: 'typescript',
        takeaway: 'WeakRef cache 的 miss 是正常控制流。若 miss 会破坏正确性、造成惊群或产生不可接受尾延迟，就要用显式缓存策略。'
      },
      {
        title: 'FinalizationRegistry 不能充当析构函数',
        kicker: '06 · FINALIZATION',
        paragraphs: [
          'registry.register(target, heldValue, unregisterToken?) 建立清理记录。target 不再 live 后，引擎可以清空 cell target，并可选择安排 cleanup job；回调收到 heldValue，而不是 target，避免清理记录重新强引用目标。heldValue 若很大，本身会被 registry 强持有，应只保存最小标识。',
          '回调可能很晚、可能在进程退出前完全不运行，执行批次和顺序也不可依赖。回调异常由 host 报告，且工作发生在普通 JavaScript job 中，会与业务任务竞争。unregister token 允许在资源已显式关闭时撤销兜底记录；token 自身不能意外被 heldValue 或全局结构长期保留。',
          '正确模式是显式 dispose/close 管理关键资源，FinalizationRegistry 只做诊断或尽力兜底。例如检测忘记调用 close 的 wrapper、减少原生缓存引用、记录潜在泄漏。即使提供 Symbol.dispose/using，GC finalization 仍只是第二道防线。'
        ],
        code: `const leakedHandles = new FinalizationRegistry<string>((label) => {
  console.warn(\`资源 \${label} 被 GC，但没有观察到显式 close\`)
})

class Handle {
  private closed = false
  private readonly token = {}

  constructor(readonly label: string) {
    leakedHandles.register(this, label, this.token)
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    leakedHandles.unregister(this.token)
    // 在这里确定地释放真实资源。
  }
}`,
        language: 'typescript',
        takeaway: 'finalizer 是“也许会收到的遗忘提醒”，不是 finally。资源生命周期必须由显式协议完成。'
      },
      {
        title: '用 heap snapshot 的 retained path 定位泄漏',
        kicker: '07 · DIAGNOSTICS',
        paragraphs: [
          '内存上涨要先区分 live heap、heap capacity、external/native memory 与进程 RSS。对象已回收后，allocator 或 V8 page 可能保留内存供后续复用，RSS 不一定立即下降；反过来，稳定 RSS 也可能掩盖对象替换型泄漏。指标至少同时观察 used heap、GC 后基线、allocation rate 与外部内存。',
          '可靠流程是做可重复场景：预热，执行 N 次操作，强制或等待 major GC 仅作为实验辅助，截取 baseline/after snapshots，按 constructor 和 retained size 比较，再沿 retaining path 找到 root。Dominators 说明若移除某节点可释放多少下游，不等于该节点一定是业务 bug。',
          '常见 retained path 包括未移除监听器、无限 Map、闭包捕获、未清定时器、pending Promise、队列消费停滞、SSR request 数据放进进程级单例。修复后要把场景变成回归测试：容量上界、监听器数量、请求后 GC 基线或 soak test slope 均可作为证据。'
        ],
        points: [
          '在生产环境先用低开销趋势与采样定位，再决定是否抓 heap snapshot；snapshot 可能暂停进程并显著增加内存。',
          '不要在业务代码依赖 global.gc；它只适合以 --expose-gc 启动的诊断实验。',
          'WeakRef/FinalizationRegistry 可辅助观察，不能证明“截至某时刻一定已经回收”。'
        ],
        code: `class EventBus {
  private listeners = new Set<(event: string) => void>()

  subscribe(listener: (event: string) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  emit(event: string): void {
    for (const listener of this.listeners) listener(event)
  }

  size(): number {
    return this.listeners.size
  }
}

const bus = new EventBus()
const dispose = bus.subscribe(() => {})
console.assert(bus.size() === 1)
dispose()
console.assert(bus.size() === 0) // 可自动化的生命周期上界`,
        language: 'typescript',
        takeaway: 'GC 问题最终要落到可复现的 retained path 与可自动化的容量不变量，不能只凭任务管理器曲线猜测。'
      }
    ],
    mechanisms: [
      'collector 从 roots 出发把强可达对象加入 marking worklist，并扫描到传递闭包。',
      '增量/并发阶段允许 mutator 继续修改图，写屏障维护三色不变量并发布新增标记工作。',
      '分代 GC 用 remembered set 记录 old-to-young 边，缩小频繁 young collection 的扫描集合。',
      'WeakMap/ephemeron 在 key 已由其他路径存活时才标记 value，并迭代到固定点。',
      'WeakRef 成功 deref 的目标在当前同步 job 内 kept alive；FinalizationRegistry cleanup 由 host 机会式调度。',
      '标记后通过 sweep、evacuate/compact 与 pointer update 回收空间或减少碎片。'
    ],
    pitfalls: [
      '把循环引用等同于泄漏，忽略 tracing GC 能回收与 roots 断开的整张子图。',
      '认为把变量设为 null 一定释放内存，或认为函数 return 后闭包捕获必然消失。',
      '把 WeakMap 当成可枚举缓存，或把 WeakRef 命中率当成稳定业务合同。',
      '用 FinalizationRegistry 释放必须及时关闭的文件、锁、事务或 GPU/native handle。',
      '只看 RSS 判断对象泄漏，不比较 major GC 后 used heap、retained path 与 external memory。',
      '为了“减少 GC”盲目池化，反而让对象晋升、扩大 old generation 并制造状态污染。'
    ],
    variants: [
      {
        title: '强 Map + LRU/TTL',
        useWhen: '缓存必须有确定容量、可观测命中率、可主动失效，并且 miss 成本需要控制。',
        tradeoff: '生命周期和监控清楚；实现要维护淘汰顺序、并发去重、时间与容量边界。',
        code: `class BoundedCache<K, V> {
  constructor(
    private readonly limit: number,
    private readonly values = new Map<K, V>()
  ) {}

  set(key: K, value: V) {
    this.values.delete(key)
    this.values.set(key, value)
    if (this.values.size > this.limit) {
      this.values.delete(this.values.keys().next().value!)
    }
  }
}`,
        language: 'typescript'
      },
      {
        title: 'WeakMap 生命周期附着',
        useWhen: 'metadata 只在外部 key 活着时有意义，调用者持有 key 才需要查询，不需要枚举或容量指标。',
        tradeoff: '不会由 metadata 表延长 key 生命周期；无法枚举、确定清理时间或实现基于容量的驱逐。',
        code: `const validation = new WeakMap<object, { valid: boolean }>()
export const remember = (input: object, valid: boolean) =>
  validation.set(input, { valid })`,
        language: 'typescript'
      },
      {
        title: '显式 dispose + finalizer 诊断',
        useWhen: '资源需要确定释放，同时希望在开发或监控中发现忘记 close 的包装器。',
        tradeoff: '正确性不依赖 GC；需要设计幂等 close、所有权转移和异常路径，finalizer 只能提供不完整信号。'
      }
    ],
    studyPlan: {
      readingMinutes: 40,
      sourceMinutes: 30,
      practiceMinutes: 50,
      reviewMinutes: 15
    },
    exampleLanguage: 'typescript',
    example: `type HeapNode = {
  id: string
  color: "white" | "grey" | "black"
  edges: Set<HeapNode>
}

class TracingCollector {
  constructor(
    private readonly heap: Set<HeapNode>,
    private readonly roots: Set<HeapNode>
  ) {}

  mark(): void {
    for (const node of this.heap) node.color = "white"
    const worklist: HeapNode[] = []

    for (const root of this.roots) {
      if (root.color === "white") {
        root.color = "grey"
        worklist.push(root)
      }
    }

    while (worklist.length) {
      const current = worklist.pop()!
      for (const child of current.edges) {
        if (child.color === "white") {
          child.color = "grey"
          worklist.push(child)
        }
      }
      current.color = "black"
    }
  }

  sweep(): string[] {
    const collected: string[] = []
    for (const node of [...this.heap]) {
      if (node.color === "white") {
        this.heap.delete(node)
        collected.push(node.id)
      }
    }
    return collected
  }

  collect(): string[] {
    this.mark()
    return this.sweep()
  }
}

const node = (id: string): HeapNode => ({
  id,
  color: "white",
  edges: new Set()
})

const root = node("root")
const live = node("live")
const cycleA = node("cycle-a")
const cycleB = node("cycle-b")

root.edges.add(live)
cycleA.edges.add(cycleB)
cycleB.edges.add(cycleA)

const collector = new TracingCollector(
  new Set([root, live, cycleA, cycleB]),
  new Set([root])
)

const collected = collector.collect().sort()
console.assert(collected.join(",") === "cycle-a,cycle-b")
console.assert(root.color === "black" && live.color === "black")`,
    buildSteps: [
      { title: '积木 1：实现 stop-the-world tracing', body: '建立 roots、heap、edges、颜色和 worklist；用一条活链、一个不可达环、共享子图与重复边验证 mark/sweep。' },
      { title: '积木 2：分离 mark 与 sweep 证据', body: 'mark 后输出每个节点颜色，sweep 只删除 white；测试要证明循环可回收、共享 live 节点只扫描一次。' },
      { title: '积木 3：模拟增量切片', body: '每次只从 worklist 处理固定数量节点，允许测试代码在切片间新增边，先制造漏标，再加入三色写屏障修复。' },
      { title: '积木 4：加入 young/old 与 remembered set', body: '对象记录 generation；young collection 只从 roots 与 old-to-young slots 开始，写 old→young 时登记 remembered set。' },
      { title: '积木 5：实现 ephemeron 固定点', body: '把弱表表示成 key/value 对：先完成强闭包，再反复查找“key 已黑、value 仍白”的条目，直到一轮没有新增标记。' },
      { title: '积木 6：对照 V8 MarkLiveObjects', body: '给 Start/Stop incremental、Publish barrier、MarkRoots、parallel closure、conservative stack、weak fixpoint 六段写入口与退出不变量。' },
      { title: '积木 7：做一次真实泄漏实验', body: '在 Node 或浏览器建立未移除 listener/无限 Map，抓两次 heap snapshot，写出 root→容器→closure→payload 的 retained path，并用显式 dispose 修复。' }
    ],
    selfCheckQuestion: '为什么 WeakMap 的 value 如果反向引用 key，仍不能简单把 value 当作一直存活的强对象？GC 为什么需要 ephemeron 固定点？',
    selfCheckAnswer: 'WeakMap entry 不能凭自身让 key 存活，否则 value→key 会让所谓弱 key 永远无法回收。正确规则是先忽略 entry 完成普通强可达标记；若 key 已由 entry 之外的路径证明存活，才把对应 value 加入强闭包。新标记的 value 又可能通过普通边使另一个 WeakMap key 存活，继而激活更多 value，所以必须反复处理直到没有新增对象。若 key 始终未被其他路径标记，key 与 value 即使互相引用也可一起回收。'
  }
}
