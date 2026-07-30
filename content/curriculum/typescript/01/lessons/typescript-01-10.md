---
id: "typescript-01-10"
track: "typescript"
title: "HTML event loop：task、microtask、render 与饥饿"
depth: "deep"
exampleLanguage: "typescript"
readingMinutes: 43
sourceMinutes: 35
practiceMinutes: 57
reviewMinutes: 15
---

## 官方入口

title: "HTML Standard · Event loops · Processing model"
url: "https://html.spec.whatwg.org/multipage/webappapis.html#event-loop-processing-model"

HTML 的 processing model 定义了 task source、可运行 task 的选择、task 执行后的 microtask checkpoint、long task 记录与 rendering opportunity。它没有承诺每个 task 后都渲染，也没有把所有 task 合成一条全局 FIFO。

## 真实源码

repo: "v8/v8"
file: "src/execution/microtask-queue.cc"
symbol: "MicrotaskQueue::PerformCheckpointInternal / RunMicrotasks"
language: "cpp"
url: "https://github.com/v8/v8/blob/main/src/execution/microtask-queue.cc#L153-L264"

### 逐段讲解

- EnqueueMicrotask 把 Microtask 指针写入环形缓冲区。容量保持为 2 的幂，既方便扩容，也让生成代码能用低成本方式计算环形下标。
- PerformCheckpointInternal 是 embedder 进入 V8 排空微任务的入口。若采用 scoped policy，它先建立人工 MicrotasksScope，防止微任务回调重新进入 V8 时违反调用深度约束。
- RunMicrotasks 用 RAII 标志 is_running_microtasks_ 表示检查点正在执行，并用 SuppressMicrotaskExecutionScope 防止回调重入时嵌套排空同一队列。
- Execution::TryRunMicrotasks 执行真正的 job 循环。运行过程中新增的微任务仍留在同一队列，因此返回前断言 size()==0，体现 checkpoint 的 drain-to-empty 语义。
- 执行终止是特殊失败路径：V8 清空 ring buffer、通知 isolate 并返回 -1；正常完成则执行 completed callbacks，并返回本轮处理数量。
- PerformCheckpointInternal 最后调用 ClearKeptObjects。这与 HTML checkpoint 在排空后执行 ClearKeptObjects 的规范边界对应，也解释 WeakRef.deref 的临时保活窗口。
- 这段源码只实现引擎内部 microtask queue。task source 选择、输入事件、timer、requestAnimationFrame、样式布局与绘制属于 Chromium/HTML 宿主层，不能从这里推导浏览器渲染顺序。

### 源码节选

```cpp
// 摘自 V8 main/src/execution/microtask-queue.cc。
// 保留真实入队、checkpoint 与失败路径；中文注释用于说明设计意图。
void MicrotaskQueue::EnqueueMicrotask(Tagged<Microtask> microtask) {
  if (size_ == capacity_) {
    // 容量保持为 2 的幂，JIT 生成代码更容易计算环形下标。
    intptr_t new_capacity =
        std::max(kMinimumCapacity, capacity_ << 1);
    ResizeBuffer(new_capacity);
  }

  DCHECK_LT(size_, capacity_);
  ring_buffer_[(start_ + size_) % capacity_] = microtask.ptr();
  ++size_;
}

void MicrotaskQueue::PerformCheckpointInternal(
    v8::Isolate* v8_isolate) {
  DCHECK(ShouldPerfomCheckpoint());
  std::optional<MicrotasksScope> microtasks_scope;
  if (microtasks_policy_ == v8::MicrotasksPolicy::kScoped) {
    // job 可能调用 embedder，再重新进入 V8；人工 scope 保住调用约束。
    microtasks_scope.emplace(
        v8_isolate, this,
        v8::MicrotasksScope::kDoNotRunMicrotasks);
  }

  Isolate* isolate = reinterpret_cast<Isolate*>(v8_isolate);
  RunMicrotasks(isolate);
  // WeakRef.deref 的 kept objects 只保活到下一个 checkpoint。
  isolate->ClearKeptObjects();
}

int MicrotaskQueue::RunMicrotasks(Isolate* isolate) {
  // RAII 在函数退出时恢复标志，异常/终止路径也不会遗漏。
  SetIsRunningMicrotasks scope(&is_running_microtasks_);
  v8::Isolate::SuppressMicrotaskExecutionScope suppress(
      reinterpret_cast<v8::Isolate*>(isolate), this);

  if (!size()) {
    OnCompleted(isolate);
    return 0;
  }

  intptr_t base_count = finished_microtask_count_;
  MaybeDirectHandle<Object> maybe_result =
      Execution::TryRunMicrotasks(isolate, this);
  int processed = static_cast<int>(
      finished_microtask_count_ - base_count);

  if (isolate->is_execution_terminating()) {
    // 执行被终止时，剩余 job 不能留给下一次错误地继续运行。
    delete[] ring_buffer_;
    ring_buffer_ = nullptr;
    capacity_ = size_ = start_ = 0;
    isolate->OnTerminationDuringRunMicrotasks();
    OnCompleted(isolate);
    return -1;
  }

  // checkpoint 会把运行期间继续入队的 job 一并排空。
  DCHECK_EQ(0, size());
  OnCompleted(isolate);
  return processed;
}
```

## 导读

浏览器主线程同时接收点击、网络完成、timer、脚本、DOM 变更和动画。event loop 是宿主协调这些工作的协议，不是一条装着所有回调的 JavaScript 数组。HTML 为一个 agent 关联 event loop；同一个 event loop 有一个或多个 task queues、一个 microtask queue、当前 task、渲染机会和若干 bookkeeping。event loop 也不必与某一条操作系统线程一一对应。

一次容易验证的主线是：宿主从某个 task queue 选择最早的可运行 task，执行到调用栈清空，然后执行 microtask checkpoint；窗口 event loop 在合适的 rendering opportunity 运行渲染更新。checkpoint 会持续处理微任务，连微任务中新加入的微任务也会执行，直到队列为空。因此 Promise.then 能稳定先于下一个 timer，却也能用递归微任务让输入和渲染长期得不到机会。

这门课会把四层分开：ECMAScript 定义 Promise Job 的因果关系；HTML 定义浏览器 event loop 与 checkpoint；V8 提供可由 embedder 驱动的 microtask queue；Chromium 再落实任务优先级、帧调度和主线程工程策略。学完后你会手写一个带多个 task source、微任务排空、渲染机会、长任务记录和饥饿保护的教学调度器，并能用时间线解释真实页面卡顿。

## 分章正文

### 先分清 agent、event loop、task source 与 queue

kicker: "01 · HOST SCHEDULER"

ECMAScript 执行上下文只回答“当前函数如何运行”，无法决定鼠标点击、timer 和网络完成谁先进入 JavaScript。HTML 把可以共同访问同一批对象的执行环境组织为 agent，并为 agent 关联 event loop。相同源的一组 window 可能共享 window event loop；dedicated/shared/service worker 使用 worker event loop；不同 agent 之间通过消息复制或转移数据，而不是共享调用栈。

HTML event loop 有一个或多个 task queues。规范特意把 task queue 抽象为 set，因为 event loop 先以实现定义策略选择一个包含 runnable task 的队列，再取该队列中第一个可运行 task。每个 task source 内仍要保持相对顺序，例如同一 MessagePort 的消息顺序；不同 source 之间通常没有“谁先入队谁先运行”的全局保证。浏览器可优先处理用户交互以降低输入延迟。

task 是宿主算法的执行单元：派发某些事件、解析 HTML、timer callback、消息传递、网络算法的主线程收尾都可能排 task。俗称“宏任务”便于交流，却不是 HTML 规范的正式类别。microtask queue 也明确不是 task queue；若用宏任务/微任务口诀替代 source、checkpoint 和宿主边界，就解释不了公平性、渲染与 worker 差异。

可运行还受到 Document 活跃状态等条件约束。页面进入 back-forward cache、文档失活或 worker closing 后，已经排队和新排队任务如何处理取决于对应 API 规范。工程调度器因此需要保存 source、owner、priority、deadline 和 cancellation，而不能只保存 callback。

#### 代码

```typescript
type TaskSource = "user" | "timer" | "message" | "network"

type Task = {
  id: number
  source: TaskSource
  documentId: string | null
  runnable: () => boolean
  run: () => void
}

// 同一 source 内 FIFO；source 之间由宿主策略选择。
const taskQueues = new Map<TaskSource, Task[]>([
  ["user", []],
  ["timer", []],
  ["message", []],
  ["network", []]
])
```

#### 本章结论

task source 内有次序，多个 source 之间由宿主调度；event loop 不能简化成唯一 FIFO。

### 一次 event loop iteration 的真实顺序

kicker: "02 · PROCESSING MODEL"

处理模型先查找至少一个有 runnable task 的 task queue。宿主选择其中一个队列，移除它的第一个可运行 task，把 currently running task 指向它，执行其 steps，再恢复为 null。JavaScript callback 只是 task steps 可能调用的一部分；一段 task 还可能在进入或离开 JS 前后完成 DOM、网络或内部 bookkeeping。

task 必须 run-to-completion。普通脚本执行期间，另一个点击 handler 不会插进当前栈中间修改对象；重入只能由 alert 等特殊宿主能力、同步回调或显式调用产生。run-to-completion 提供局部原子性，也意味着 200ms 的循环会把输入、timer 和绘制同时挡住。

task 完成后立即 perform a microtask checkpoint。随后宿主记录 task 结束和 long task 信息，并处理 idle、worker 更新或由渲染 task source 排入的更新。现代 HTML processing model 将 rendering opportunity 关联的更新作为 rendering task source 上的任务描述；因此更不应该背“task→microtask→render”是每轮固定三连。

task queue 为空时 event loop 也没有“停止”。它可等待外部事件、计算 idle deadline，或在显示刷新机会到来时排渲染任务。系统是否有工作、工作是否 runnable、是否该呈现一帧是三件不同的事。

#### 代码

```typescript
function runOneIteration(): void {
  const task = chooseOldestRunnableTask()
  if (task) {
    currentTask = task
    const startedAt = performance.now()
    try {
      task.run()                   // run-to-completion
    } finally {
      currentTask = null
    }
    performMicrotaskCheckpoint()  // task 完成后排空
    recordLongTask(task, performance.now() - startedAt)
  }

  // 此处仅表示宿主继续处理 idle/rendering 机会，
  // 并不保证每轮必画一帧。
  maybeScheduleRenderingTask()
}
```

#### 本章结论

一次 iteration 的稳定不变量是 task 完成后做 checkpoint；选择哪条 task queue 和是否渲染由宿主策略决定。

### microtask checkpoint 会 drain-to-empty，并防止重入

kicker: "03 · CHECKPOINT"

HTML 的 perform a microtask checkpoint 先检查 performing a microtask checkpoint 标志。若已经处于 checkpoint，递归请求直接返回；否则置 true，反复取队首 microtask，设置 currently running task，执行，再恢复。循环条件是队列为空，所以 microtask A 新排入 C 时，C 也会在同一次 checkpoint 内运行。

队列排空后，宿主还要通知 rejected promises、清理 IndexedDB transaction、执行 ClearKeptObjects、记录 timing，最后复位标志。这里揭示 checkpoint 的含义远大于“运行 Promise 回调”：它也是多个宿主生命周期规则的稳定边界。

微任务不是“更快的线程”。它仍在当前 event loop 上串行执行，拥有 run-to-completion 的回调；优势是不会让别的 task 插入，并能在当前同步工作完成后统一状态。代价也来自这个保证：队列未空时，下一个 task 和渲染机会无法推进。

浏览器会在 task 完成等规范指定位置触发 checkpoint。V8 作为引擎提供 MicrotaskQueue 与 PerformCheckpoint，但 embedder 决定调用时机。Node、浏览器、测试运行器和嵌入式 V8 可采用不同 policy，所以“V8 每执行完函数自动跑微任务”是错误归因。

#### 代码

```typescript
let performingCheckpoint = false
const microtasks: Array<() => void> = []

function queueMicrotaskForLab(job: () => void): void {
  microtasks.push(job)
}

function performMicrotaskCheckpoint(): void {
  if (performingCheckpoint) return
  performingCheckpoint = true
  try {
    while (microtasks.length > 0) {
      const job = microtasks.shift()!
      job() // job 中继续入队的工作也会在本轮运行
    }
    notifyRejectedPromises()
    clearKeptObjects()
  } finally {
    performingCheckpoint = false
  }
}
```

#### 本章结论

checkpoint 是防重入的 drain-to-empty 生命周期边界，微任务中新建的微任务不会自动留到下一轮。

### Promise reaction 与 queueMicrotask 同队列，错误通道不同

kicker: "04 · MICROTASK PRODUCERS"

Promise reaction job、PromiseResolveThenableJob 和 queueMicrotask callback 都通过宿主进入微任务机制，通常按入队顺序执行。MutationObserver 也与微任务交付有关，但规范通过 pending observer 集合和 compound batching 避免每次 DOM 变更都产生一个独立 callback。不同 API 的业务语义不可只按“微任务”归并。

queueMicrotask(callback) 的 callback 抛错按“report”方式报告，像普通回调未捕获异常；Promise.then handler 抛错会拒绝 then 返回的新 promise，随后可能在 rejection tracking 阶段成为 unhandledrejection。两段表面相同的代码因此进入不同错误通道。库内批处理若不需要结果 promise，queueMicrotask 更直接；需要组合、返回值或错误链时使用 Promise。

queueMicrotask 常用于把同步命中缓存和异步 fetch 的通知统一放到当前栈之后，保证调用者总有机会先完成监听注册；也可把同一 task 内多次 invalidate 合并为一次 flush。它不适合作为 CPU 切片的 yield，因为它不会把控制权交回 task 选择与渲染。

顺序推演应记录“谁在什么时候入队”。同步阶段依次调用 queueMicrotask(A)、resolvedPromise.then(B)，则 A 在 B 前；A 运行时再排 C，队列当时还有 B，所以顺序是 A、B、C。不要按回调定义位置或 Promise 链缩进猜顺序。

#### 代码

```typescript
const order: string[] = []

queueMicrotask(() => {
  order.push("A")
  queueMicrotask(() => order.push("C"))
})

Promise.resolve().then(() => {
  order.push("B")
})

order.push("sync")
setTimeout(() => {
  console.assert(order.join(",") === "sync,A,B,C")
}, 0)
```

#### 本章结论

同为微任务只说明调度检查点相同；queueMicrotask 的未捕获异常与 Promise rejection 仍走不同协议。

### rendering opportunity、rAF、layout 与 paint 不等于一个 JS 回调

kicker: "05 · RENDERING PIPELINE"

显示器按刷新节奏提供呈现机会，但浏览器可因页面不可见、性能不足、没有视觉变化或任务合并而跳过。HTML 不保证每 16.67ms 一帧，也不保证每个 task 后绘制。60Hz 的 16.67ms 只是整帧预算近似值，其中还要容纳输入、脚本、样式、布局、绘制和合成。

渲染更新包含一系列步骤：处理 resize/scroll/media query，运行 animation frame callbacks，更新动画，必要时计算样式和布局，生成 paint/compositing 数据并最终呈现。requestAnimationFrame 把 callback 安排在目标 Document 的渲染更新阶段，适合在下一帧前修改视觉状态；它不是独立后台线程，也不能让超长 callback 免费。

DOM 写入通常先改变内存中的 DOM/style 状态，浏览器延后批量计算。随后同步读取 offsetWidth、getBoundingClientRect 等布局相关属性，可能迫使引擎立即 flush style/layout，形成 layout thrashing。工程上把读取集中、写入集中，并用 Performance 面板确认 Layout/Style Recalculation，而不是迷信某个 API 永远触发布局。

rAF callback 中安排 Promise.then，该微任务会在相应脚本清理/checkpoint 边界运行；它可能在浏览器提交这一帧前修改 DOM。精确细节受规范步骤和实现管线约束，调试时应以 trace 的 task、microtask、Animation Frame、Layout、Paint 时间片作证。

#### 代码

```typescript
let pending = false
const changes: Array<() => void> = []

function scheduleVisualChange(change: () => void): void {
  changes.push(change)
  if (pending) return
  pending = true

  requestAnimationFrame(() => {
    pending = false
    // 先一次性读取布局，随后集中写入，减少读写交错。
    const viewportWidth = document.documentElement.clientWidth
    for (const apply of changes.splice(0)) apply()
    document.body.dataset.viewport = String(viewportWidth)
  })
}
```

#### 本章结论

rAF 属于渲染更新协议；渲染机会可跳过，样式、布局、绘制也需要各自的时间预算和证据。

### timer、MessageChannel、postTask 与真正的 yield

kicker: "06 · YIELD PRIMITIVES"

setTimeout(callback,0) 的 0 表示请求的最小延迟，不代表立即运行。timer 初始化、嵌套层级钳制、页面后台节流和 task source 调度都会增加实际等待；到期只让 timer task 变为可运行，前面还有当前 task、microtasks 和宿主优先级。

MessageChannel 的 port message 会排入 port message task source，常被框架当成较低开销的 task yield。它仍不保证抢在输入或其他 source 前执行。scheduler.postTask 允许显式 user-blocking、user-visible、background priority 与 AbortSignal；scheduler.yield 可把长任务后半段延续到未来 task，并让浏览器先处理更紧急工作。使用前应做能力检测。

await Promise.resolve()、await 立即 fulfilled promise 和 queueMicrotask 都只让出到 microtask queue，不能给渲染和输入 task 机会。要切开 CPU 长任务，必须跨到未来 task 或 worker。每个切片也不应只按迭代次数固定，因为不同设备速度差异大；用 performance.now 检查实际预算，并在边界响应取消。

requestIdleCallback 适合可推迟且可中断的低优先工作，但 deadline 不是完整空闲保证，后台页面也可能受到节流。生产调度要根据用户可见性、截止时间和幂等性选择 primitive，而不是为追求“最快”把所有工作塞进微任务。

#### 代码

```typescript
async function yieldToHost(): Promise<void> {
  const schedulerApi = globalThis.scheduler as
    | { yield?: () => Promise<void> }
    | undefined

  if (schedulerApi?.yield) {
    await schedulerApi.yield()
    return
  }

  await new Promise<void>(resolve => {
    const channel = new MessageChannel()
    channel.port1.onmessage = () => {
      channel.port1.close()
      channel.port2.close()
      resolve()
    }
    channel.port2.postMessage(undefined)
  })
}
```

#### 本章结论

微任务只重排当前 turn；CPU 切片要跨到未来 task，优先级、取消与时间预算也应进入协议。

### 微任务饥饿、长任务与输入延迟如何被制造和测量

kicker: "07 · STARVATION"

递归 queueMicrotask 没有“自动公平”上限。checkpoint 以队列为空为结束条件，新 job 持续补入就能阻止下一 task 和 rendering task。Promise 链、MutationObserver 反馈环和状态库 flush 循环都可能无意制造同类问题。页面仍在执行 JavaScript，却表现为按钮不响应、timer 不触发、动画冻结。

单个长 task 造成另一种阻塞。浏览器完成当前 task 前不能接管主线程处理输入或提交依赖主线程的新帧。Long Tasks API 可观察超过其定义阈值的主线程任务；Event Timing、INP、Performance trace 和自建调度延迟探针能分别展示用户事件排队、交互延迟和具体函数栈。只统计 callback 自身耗时会漏掉它前面的排队时间。

修复先找可中断边界：纯计算搬到 Worker；不可搬的循环按时间预算切片并用 task yield；数据处理采用流和背压；批处理 microtask 设置每轮上限，剩余工作转 task；视觉更新对齐 rAF。切片过细会增加调度与状态保存成本，过粗仍会掉帧，应在低端目标设备 trace 后选预算。

无限微任务的单元测试不能直接在真实队列运行，否则测试环境也被饿死。教学调度器应设置 maxMicrotasksPerCheckpoint，超过时抛出 StarvationError 或把剩余 job 降级到 task；真实 HTML 规范没有替应用提供这个保护，所以生产库需要自己的配额和循环检测。

#### 代码

```typescript
async function processInSlices<T>(
  items: readonly T[],
  visit: (item: T) => void,
  budgetMs = 5,
  signal?: AbortSignal
): Promise<void> {
  let index = 0
  while (index < items.length) {
    const deadline = performance.now() + budgetMs
    while (index < items.length && performance.now() < deadline) {
      signal?.throwIfAborted()
      visit(items[index++])
    }
    if (index < items.length) await yieldToHost()
  }
}
```

#### 本章结论

drain-to-empty 带来确定顺序，也允许饥饿；诊断要同时测执行耗时、排队延迟、帧与输入。

### 浏览器、Worker 与 Node 要按宿主分别建模

kicker: "08 · HOST DIFFERENCES"

window event loop 负责 Document、用户交互和渲染；worker event loop 没有普通页面 DOM，但有消息、网络和自身关闭协议，部分 worker 能使用 animation frame/OffscreenCanvas 更新渲染。把计算移到 worker 可释放主线程，却会引入消息序列化、Transferable 所有权、结果合并和取消生命周期。

Node 使用 libuv 驱动 timers、pending callbacks、poll、check 等宿主阶段，并在 JavaScript callback 边界处理 Promise microtasks；process.nextTick 还有优先级更高的 Node 专属队列。具体版本的检查时机和 timer 顺序可能调整，因此不要把 Node 阶段图当成浏览器 HTML event loop，也不要用 nextTick 递归做无限工作。

测试环境的 fake timers 常只控制 timer clock，未必自动排空原生 Promise jobs、MutationObserver 或 framework scheduler。可靠测试要明确提供 flushMicrotasks、advanceTimers 和 flushRendering 三种操作，并验证中间状态。若测试只调用 runAllTimers，可能得到生产环境不可能出现的次序。

工程回答最终要落到宿主合同：工作属于哪个 agent，谁入队，source 内的顺序保证是什么，checkpoint 在哪里，渲染是否参与，异常走哪条通道，如何取消和观测。能回答这七个问题，面对浏览器、Node、Electron、WebView 或嵌入式 V8 都能重新推导，而无需背一张固定流程图。

#### 代码

```typescript
type HostTrace = {
  agent: "window" | "worker" | "node"
  source: string
  queuedAt: number
  startedAt?: number
  finishedAt?: number
  checkpointId?: number
  frameId?: number
}

function schedulingDelay(trace: HostTrace): number | undefined {
  return trace.startedAt === undefined
    ? undefined
    : trace.startedAt - trace.queuedAt
}
```

#### 本章结论

event loop 是宿主合同。浏览器、worker 和 Node 共享部分抽象，却有不同队列、阶段、渲染与生命周期。

## 核心机制

- 每个 agent 关联 event loop；event loop 可能有多个 task queues 和一个独立 microtask queue。
- task source 保证同 source 的相对顺序，宿主可在多个含 runnable task 的队列间选择。
- task run-to-completion 后执行 microtask checkpoint；checkpoint 防重入并持续排空到队列为空。
- Promise Job 与 queueMicrotask 都进入微任务机制，但异常与返回值协议不同。
- window rendering opportunity 可以被跳过；rAF、style、layout、paint 属于渲染更新链路。
- setTimeout、MessageChannel、scheduler.postTask/yield 都产生未来 task 级让步，语义与优先级不同。
- 递归微任务会饿死 task 和渲染；长 task 会增加输入排队和帧延迟。
- V8 实现 microtask queue，HTML/Chromium embedder 决定 checkpoint、task 调度与渲染。
- worker 和 Node 是不同宿主模型，不能把浏览器的固定口诀直接迁移。

## 常见误区

- 把多个 task sources 画成一条严格全局 FIFO，错误承诺 timer、消息和输入的跨 source 顺序。
- 把“宏任务”当成 HTML 正式分类，忽略 task source、runnable 条件和 document 生命周期。
- 宣称每个 task 后一定 render，忽略 rendering opportunity、页面可见性、合并与跳帧。
- 用 await Promise.resolve 或 queueMicrotask 切 CPU 长任务，实际仍不把控制权交给输入和渲染。
- 递归微任务没有配额，因 drain-to-empty 形成活锁式饥饿。
- 认为 setTimeout(fn,0) 会零延迟立即执行，忽略钳制、节流、当前 task 与 source 调度。
- 在 rAF 中做超长计算，误以为 callback 位于渲染阶段就不会掉帧。
- 交错布局读写制造 forced synchronous layout，却只优化 JavaScript 循环。
- 把 queueMicrotask 抛错与 Promise.then 抛错当成同一错误通道。
- 把 Node libuv phase、nextTick 和浏览器 HTML event loop 混成一张顺序表。
- fake timer 测试只推进 timer，不明确排空 microtask 和 rendering scheduler。
- 只测 callback 执行耗时，不记录 queuedAt，遗漏真正伤害交互的 scheduling delay。

## 实现变体

### queueMicrotask 批处理

useWhen: "需要把同一同步 task 内的多次状态变更合并，并保证在下一 task 前完成。"
tradeoff: "顺序稳定、延迟低；不能让出渲染，必须限制每轮工作量并处理未捕获异常。"

#### 代码

```typescript
let queued = false
const dirty = new Set<string>()

function invalidate(key: string) {
  dirty.add(key)
  if (queued) return
  queued = true
  queueMicrotask(() => {
    queued = false
    flush([...dirty])
    dirty.clear()
  })
}
```

### scheduler.yield / MessageChannel 时间切片

useWhen: "主线程工作可分段，必须给输入、timer 和渲染 task 留出机会。"
tradeoff: "改善响应性；需要保存进度、处理取消，切片和调度本身也有成本。"

#### 代码

```typescript
while (cursor < records.length) {
  const end = performance.now() + 5
  while (cursor < records.length && performance.now() < end) {
    index(records[cursor++])
  }
  if (cursor < records.length) await yieldToHost()
}
```

### Dedicated Worker

useWhen: "计算量大、可序列化且不直接操作 DOM，主线程响应性高于即时共享状态。"
tradeoff: "真正并行并释放主线程；承担消息复制/转移、worker 启动、错误传播与取消协议。"

#### 代码

```typescript
const worker = new Worker(
  new URL("./index-worker.ts", import.meta.url),
  { type: "module" }
)
worker.postMessage(buffer, [buffer])
worker.onmessage = event => applyIndex(event.data)
```

## 可运行示例

```typescript
type Source = "user" | "timer" | "message" | "render"
type LabTask = {
  id: number
  source: Source
  queuedAt: number
  runnable: () => boolean
  run: () => void
}

class StarvationError extends Error {}

class TeachingEventLoop {
  private queues = new Map<Source, LabTask[]>([
    ["user", []],
    ["timer", []],
    ["message", []],
    ["render", []]
  ])
  private microtasks: Array<() => void> = []
  private rafCallbacks: Array<(time: number) => void> = []
  private currentTask: LabTask | null = null
  private performingCheckpoint = false
  private nextId = 1
  private nowMs = 0
  private nextFrameAt = 16
  readonly trace: string[] = []

  queueTask(
    source: Source,
    run: () => void,
    runnable: () => boolean = () => true
  ): number {
    const id = this.nextId++
    this.queues.get(source)!.push({
      id,
      source,
      queuedAt: this.nowMs,
      runnable,
      run
    })
    return id
  }

  queueMicrotask(run: () => void): void {
    this.microtasks.push(run)
  }

  requestAnimationFrame(run: (time: number) => void): void {
    this.rafCallbacks.push(run)
  }

  advance(ms: number): void {
    this.nowMs += ms
  }

  private chooseTask(): LabTask | undefined {
    // 教学策略：输入优先，其余轮询。真实浏览器策略更复杂。
    const priority: Source[] = ["user", "message", "timer", "render"]
    for (const source of priority) {
      const queue = this.queues.get(source)!
      const index = queue.findIndex(task => task.runnable())
      if (index >= 0) return queue.splice(index, 1)[0]
    }
  }

  private checkpoint(maxMicrotasks = 100): void {
    if (this.performingCheckpoint) return
    this.performingCheckpoint = true
    let processed = 0
    try {
      while (this.microtasks.length > 0) {
        if (++processed > maxMicrotasks) {
          throw new StarvationError(
            "microtask checkpoint exceeded budget"
          )
        }
        this.trace.push("microtask")
        this.microtasks.shift()!()
      }
      this.trace.push("rejection tracking")
      this.trace.push("ClearKeptObjects")
    } finally {
      this.performingCheckpoint = false
    }
  }

  private maybeQueueRendering(): void {
    if (this.nowMs < this.nextFrameAt) return
    this.nextFrameAt += 16
    if (this.rafCallbacks.length === 0) return

    const callbacks = this.rafCallbacks.splice(0)
    this.queueTask("render", () => {
      this.trace.push("update rendering")
      for (const callback of callbacks) callback(this.nowMs)
    })
  }

  runOneIteration(): boolean {
    this.maybeQueueRendering()
    const task = this.chooseTask()
    if (!task) return false

    this.currentTask = task
    const startedAt = this.nowMs
    this.trace.push(
      "task:" + task.source + "#" + String(task.id)
    )
    try {
      task.run()
    } finally {
      this.currentTask = null
    }
    this.checkpoint()

    const duration = this.nowMs - startedAt
    if (duration > 50) {
      this.trace.push("long-task:" + String(duration))
    }
    return true
  }

  runUntilIdle(limit = 100): void {
    let iterations = 0
    while (this.runOneIteration()) {
      if (++iterations > limit) {
        throw new Error("task loop did not become idle")
      }
    }
  }
}

const loop = new TeachingEventLoop()

loop.queueTask("timer", () => {
  loop.trace.push("timer body")
  loop.queueMicrotask(() => {
    loop.trace.push("micro A")
    loop.queueMicrotask(() => loop.trace.push("micro C"))
  })
  loop.queueMicrotask(() => loop.trace.push("micro B"))
  loop.advance(8)
})

loop.requestAnimationFrame(time => {
  loop.trace.push("rAF@" + String(time))
})

// 先到 16ms，宿主获得 rendering opportunity。
loop.advance(16)
loop.runUntilIdle()

console.assert(loop.trace.indexOf("micro A") < loop.trace.indexOf("micro B"))
console.assert(loop.trace.indexOf("micro B") < loop.trace.indexOf("micro C"))
console.assert(
  loop.trace.indexOf("micro C") <
  loop.trace.indexOf("update rendering")
)

// 饥饿实验：job 每次补回一个 job，教学配额必须识别它。
const starving = new TeachingEventLoop()
const recurse = () => starving.queueMicrotask(recurse)
starving.queueTask("message", recurse)

try {
  starving.runOneIteration()
  console.assert(false)
} catch (error) {
  console.assert(error instanceof StarvationError)
}
```

## 搭积木复现

### 积木 1：建立多个 task source

为 user、timer、message、render 分别保存 FIFO；Task 记录 source、queuedAt、runnable 和 run。先测试同 source 顺序，再证明跨 source 由 chooseTask 策略决定。

### 积木 2：实现 run-to-completion iteration

选择一个 runnable task，设置 currentTask，执行后在 finally 清空。回调内部只能入队，不能直接让另一个 task 插入当前调用栈。

### 积木 3：加入防重入 microtask checkpoint

使用 performingCheckpoint 标志和 while drain；测试 A 中加入 C、队列已有 B 时得到 A→B→C，并让 nested checkpoint 成为 no-op。

### 积木 4：加入渲染机会与 rAF

用虚拟时钟在 frame deadline 到达时排 rendering task；rAF callback 只在该 task 中运行。加入“无视觉工作则跳过”测试，避免写成每轮强制 render。

### 积木 5：记录排队延迟与 long task

分别保存 queuedAt、startedAt、finishedAt，断言 scheduling delay 与 execution duration。让 task advance 60ms，观察 long-task 记录和后续输入延迟。

### 积木 6：制造并识别微任务饥饿

递归微任务会让 checkpoint 永不返回；教学实现加入 maxMicrotasksPerCheckpoint，并用专属 StarvationError 证明问题来自 drain-to-empty。

### 积木 7：实现真实浏览器 yield 适配器

优先 scheduler.yield，回退 MessageChannel；用 5ms 时间预算切分至少 10 万项计算。记录输入 handler 排队延迟，对照 await Promise.resolve 的失败版本。

### 积木 8：用 DevTools 反证你的模型

录制包含 timer、Promise、rAF、forced layout 和 Worker 的 Performance trace。逐项标注 task、microtask、Animation Frame、Layout、Paint，并写出教学调度器省略的 Chromium 优先级、合成线程和页面节流。

## 自检

### 问题

一个 timer task 中依次安排 queueMicrotask(A)、Promise.then(B) 和 requestAnimationFrame(R)，A 运行时再 queueMicrotask(C)。为什么常见结果是 A、B、C 先于 R？这个顺序中哪些部分是规范保证，哪些部分不能扩张为“每个 timer 后都必定渲染”？若 A 永远补入新的 A，setTimeout 与 R 会怎样，工程上应如何修复？

### 站内答案

timer task 的同步 steps 完成后，HTML processing model 执行 microtask checkpoint。A 与 B 按入队次序进入微任务机制；A 运行时 C 被追加到仍含 B 的队尾，因此 checkpoint 的 drain-to-empty 得到 A→B→C。R 属于目标 Document 的 animation frame callbacks，要等窗口获得 rendering opportunity 并执行对应渲染更新，因而通常在该 checkpoint 之后。规范保证同一 checkpoint 排空及队列顺序，却允许用户代理跳过或合并 rendering opportunity，也允许在多个 task sources 间采用实现定义选择，所以不能承诺每个 timer 后绘一帧。若 A 每次都补入新 A，checkpoint 永远不空，event loop 无法选择下一 timer task，渲染任务也无法获得主线程，页面出现微任务饥饿。修复要给批处理设置每轮上限，把剩余工作通过 scheduler.yield、MessageChannel 或其他 future task 继续；重 CPU 工作可移到 Worker，并用 Performance trace 验证输入排队和帧恢复。
