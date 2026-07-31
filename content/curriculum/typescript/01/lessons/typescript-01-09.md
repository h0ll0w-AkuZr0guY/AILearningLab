---
id: "typescript-01-09"
track: "typescript"
title: "Promise resolution、thenable assimilation 与 Job queue"
depth: "deep"
visualIndex: "../visuals/typescript-01-09.md"
exampleLanguage: "typescript"
readingMinutes: 40
sourceMinutes: 35
practiceMinutes: 60
reviewMinutes: 15
---

## 官方入口

title: "ECMAScript Language Specification · Promise Resolve Functions"
url: "https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-promise-resolve-functions"

Promise resolving function 用共享 [[AlreadyResolved]] cell 保证首次调用胜出；遇到 object resolution 时读取 then，若 callable 则创建 NewPromiseResolveThenableJob 并交给 HostEnqueuePromiseJob，稍后以新的 resolving functions 同化其最终状态。

## 真实源码

repo: "v8/v8"
file: "src/builtins/promise-resolve.tq"
symbol: "ResolvePromise"
language: "cpp"
url: "https://github.com/v8/v8/blob/main/src/builtins/promise-resolve.tq#L88-L178"

### 逐段讲解

- ResolvePromise 先处理 debugger/hook 和 promise===resolution，自解析进入 runtime 生成 TypeError rejection；普通 primitive 可直接 FulfillPromise。
- 对 object resolution，V8 用 map 与 protector cells 快速判断原生 Promise、原生 then 与不可能含 then 的 iterator result；这些是优化，不能改变规范可观察的 then getter 语义。
- 慢路径执行 GetProperty(resolution,"then")。getter 抛错会 RejectPromise；得到非 callable 值则把整个 object 当普通 fulfillment value。
- callable then 不会在当前栈立即执行。V8 建立 NewPromiseResolveThenableJobTask，保存 promise、thenable 和 then action。
- EnqueueMicrotask 把 job 交给 microtask queue；job 运行时创建新的 resolve/reject，并以 thenable 为 this 调用 then，首次调用或抛错规则继续由 alreadyResolved 保护。

### 源码节选

```cpp
// 摘自 V8 main/src/builtins/promise-resolve.tq。
// 保留真实主分派与 thenable job 入队；省略部分 native Promise 快速路径。
transitioning builtin ResolvePromise(
    implicit context: Context)(
    promise: JSPromise, resolution: JSAny): JSAny {
  // 自解析与调试 hook 交给 runtime；自解析必须拒绝 TypeError。
  if (IsIsolatePromiseHookEnabledOrDebugIsActiveOrHasAsyncEventDelegate() ||
      TaggedEqual(promise, resolution))
    deferred {
      return runtime::ResolvePromise(promise, resolution);
    }

  let then: Object = Undefined;
  try {
    // primitive 不可能是 thenable，直接 fulfill。
    if (TaggedIsSmi(resolution)) {
      return FulfillPromise(promise, resolution);
    }
    const heapResolution = UnsafeCast<HeapObject>(resolution);
    const resolutionMap = heapResolution.map;
    if (!JSAnyIsNotPrimitiveMap(resolutionMap)) {
      return FulfillPromise(promise, resolution);
    }

    // 生产实现此处还有原生 Promise/protector 快速路径。
    goto Slow;
  } label Slow deferred {
    // then 是可执行 getter，读取时抛错要变成 rejection。
    try {
      then = GetProperty(resolution, kThenString);
    } catch (e, _message) {
      return RejectPromise(promise, e, False);
    }

    // object 仅仅拥有非 callable then，仍作为普通值 fulfill。
    if (!Is<Callable>(then)) {
      return FulfillPromise(promise, resolution);
    }
    goto Enqueue;
  } label Enqueue {
    // thenable assimilation 与当前调用栈隔离为 Promise Job。
    const task = NewPromiseResolveThenableJobTask(
        promise,
        UnsafeCast<JSReceiver>(resolution),
        UnsafeCast<Callable>(then));

    return EnqueueMicrotask(task.context, task);
  }
}
```

## 导读

Promise 有 pending、fulfilled、rejected 三种内部状态，但“resolved”不是第四种状态。resolve(anotherPromise) 后，当前 promise 已被锁定为跟随 anotherPromise，后续 reject 无效，却可能继续 pending 到另一个 promise settle。把 resolved 等同于 fulfilled 会误判超时、监控状态和多次调用竞态。

Promise resolution procedure 的目标是安全吸收任意 thenable。resolve(x) 若遇到对象，会读取 x.then；getter 抛错则拒绝，then 非函数则以 x fulfill，then 可调用则把调用安排为 Promise Job。job 用新的 resolve/reject 调 then，并以 shared alreadyResolved cell 确保 hostile thenable 同时调用、重复调用或调用后抛错时只有第一次生效。

then 也会创建新 promise。reaction handler 的返回值交给新 promise 的 resolve，所以 return 普通值、throw、return promise、return thenable 分别形成 fulfillment、rejection、状态采纳与异步同化。Promise Jobs 由 host 入队；ECMAScript 定义 job 和因果语义，浏览器/Node 决定何时做 microtask checkpoint。下一课再把这条队列放进 HTML event loop。


## 分章正文

### settled 描述状态，resolved 描述命运已锁定

kicker: "01 · STATE VERSUS FATE"

pending promise 保存 fulfill reactions 与 reject reactions；FulfillPromise 写入 [[PromiseState]]=fulfilled、[[PromiseResult]]=value 并触发 reactions，RejectPromise 类似。settled 专指 fulfilled 或 rejected，状态以后不再变化。

resolving functions 持有 promise 与共享 AlreadyResolved Record。第一次 resolve/reject 把 [[Value]] 设 true，之后任何调用立即返回 undefined。第一次若是 resolve(pendingPromise)，当前 promise 仍是 pending，却不能被 executor 后续 reject 改变，它的命运已经采纳另一个 promise。

业务状态机应区分“请求已交给异步依赖”和“最终结果已完成”。Promise 没有公开 resolved-but-pending 查询 API；若系统需要可观测阶段，应维护显式 operation state、trace id 和上游 promise，而不是从 Promise 外观猜测。

#### 代码

```typescript
let release!: (value: number) => void
const upstream = new Promise<number>(resolve => {
  release = resolve
})

const adopted = new Promise<number>((resolve, reject) => {
  resolve(upstream)       // 命运锁定，但仍 pending
  reject(new Error("late")) // 被 AlreadyResolved 忽略
})

let settled = false
adopted.finally(() => { settled = true })
await Promise.resolve()
console.assert(settled === false)

release(7)
console.assert(await adopted === 7)
```

#### 本章结论

settled 是内部状态已终结；resolved 是第一次 resolving function 已决定命运，仍可能等待另一个 thenable。

### resolve 与 reject 共享 alreadyResolved，第一次调用胜出

kicker: "02 · RESOLVING FUNCTIONS"

CreateResolvingFunctions 为同一 promise 创建 resolve 和 reject，两者闭包引用同一个 [[AlreadyResolved]] Record。共享 cell 比两个独立 Boolean 重要：thenable 先 resolve 再 reject，reject 必须看见 resolve 已经胜出；反序也一样。

resolve 检查 self-resolution 后才处理 primitive/object。reject 则直接 RejectPromise；一旦 cell 已 true，即使后续参数 getter 会抛错也不会再读取。executor 同步抛错时 Promise constructor 会调用 reject，但如果 executor 已经 resolve，该 rejection 同样被忽略。

“第一次调用”指 resolving function 首次被调用，不代表最终第一个网络响应。Promise.race/any 等组合器为各元素建立自己的保护与剩余计数；取消底层操作仍需 AbortSignal 或资源协议，settle 只会忽略结果，不会停止 I/O。

#### 代码

```typescript
const adversarial = {
  then(resolve: (value: string) => void,
       reject: (reason: unknown) => void) {
    resolve("first")
    reject(new Error("second"))
    resolve("third")
    throw new Error("after call")
  }
}

console.assert(await Promise.resolve(adversarial) === "first")

const thrownAfterResolve = new Promise<number>((resolve) => {
  resolve(1)
  throw new Error("ignored by shared alreadyResolved")
})
console.assert(await thrownAfterResolve === 1)
```

#### 本章结论

resolve、reject 和调用后 throw 竞争同一个 alreadyResolved cell；只允许第一条完成路径影响 promise。

### then getter 同步读取，then 调用异步排入 Job

kicker: "03 · THENABLE ASSIMILATION"

resolve(object) 在当前 resolve 调用中执行 Get(object,"then")。因此 then getter 的副作用或异常发生在同步阶段；异常会转换为 promise rejection而不从 resolve 直接抛出。拿到 callable then 后，规范创建 NewPromiseResolveThenableJob，并通过 HostEnqueuePromiseJob 安排稍后调用。

异步调用 then 把未知 thenable 代码隔离出当前栈，保证 Promise.resolve(thenable) 返回前不会由 then 进行重入。job 以 thenable 为 this 调 then(resolve,reject)，所以依赖 this 的第三方 thenable仍可工作。then 调用抛错时，只有尚未 resolve/reject 才用该异常拒绝。

读取 then 只能一次。若实现先 typeof x.then 再 x.then.call，会执行 getter两次，可能拿到不同函数或第二次抛错。应缓存一次 Get 的结果，再检查 IsCallable，并把这一值保存进 job。

#### 代码

```typescript
const events: string[] = []
const thenable = {
  get then() {
    events.push("get then")
    return function (this: object, resolve: (value: number) => void) {
      events.push("call then")
      console.assert(this === thenable)
      resolve(9)
    }
  }
}

const promise = Promise.resolve(thenable)
events.push("after resolve")
console.assert(events.join(",") === "get then,after resolve")
console.assert(await promise === 9)
console.assert(
  events.join(",") === "get then,after resolve,call then"
)
```

#### 本章结论

Get then 是同步且只执行一次；调用 then 是排队的 Promise Job，二者必须分开画时间线。

### self-resolution 与间接 thenable 环需要分别分析

kicker: "04 · RESOLUTION CYCLES"

若 resolve(promise自身)，规范立即以 TypeError 拒绝，避免永远等待自己。then reaction 返回它正在构造的 promise 也会触发同一检查，例如 let q; q=p.then(()=>q)。这是一跳 identity cycle。

任意 thenable 可以制造更长环：a.then(resolve=>resolve(b))，b 再解析回 a。规范的 resolving procedure 保证单个 resolving function 一次生效，却没有要求引擎为所有外国 thenable 维护全局访问集合；恶意循环可能不断生成 jobs，形成 microtask 饥饿。

框架接入不可信 PromiseLike 时应设置超时、步数或协议边界；静态类型 PromiseLike<T> 只约束 then 形状，不能证明其异步、公平、单调用或无环。若你控制 API，优先返回原生 Promise并用取消/超时明确资源生命周期。

#### 代码

```typescript
const base = Promise.resolve("ok")
let cycle!: Promise<unknown>
cycle = base.then(() => cycle)

try {
  await cycle
  console.assert(false)
} catch (error) {
  console.assert(error instanceof TypeError)
}

// 类型正确的 PromiseLike 仍可违反良性实现假设。
const repeated: PromiseLike<number> = {
  then(onfulfilled) {
    onfulfilled?.(1)
    onfulfilled?.(2)
    return this
  }
}
console.assert(await Promise.resolve(repeated) === 1)
```

#### 本章结论

规范显式拒绝直接 self-resolution；更长的 hostile thenable 环属于资源与信任边界问题。

### then 为每个 reaction 创建新 capability 并吸收返回值

kicker: "05 · REACTIONS AND CHAINING"

PerformPromiseThen 总会为返回链准备 result capability。源 promise pending 时 reaction 被存入列表；已 settled 时相应 PromiseReactionJob 直接入队。handler 缺失不会在 then 调用时复制状态，而是 job 运行时使用 identity/thrower 语义传播。

reaction job 调用 handler：正常返回 handlerResult 后调用 resultCapability.[[Resolve]]，因此返回 thenable 会再次进入完整 resolution procedure；handler 抛错则调用 reject。链式调用保持扁平，不会得到 Promise<Promise<T>> 的运行时嵌套。

catch(onRejected) 近似 then(undefined,onRejected)，finally 则保留原 value/reason，除非 callback 抛错或返回 rejected thenable。忘记 return 异步操作会让下一环以 undefined 过早继续；在 callback 中启动 promise 却不返回也会形成悬空 rejection。

#### 代码

```typescript
const events: string[] = []

const value = await Promise.resolve(2)
  .then(number => {
    events.push("first")
    return {
      then(resolve: (value: number) => void) {
        events.push("thenable")
        resolve(number * 3)
      }
    }
  })
  .then(number => {
    events.push("second")
    return number + 1
  })

console.assert(value === 7)
console.assert(events.join(",") === "first,thenable,second")

console.assert(
  await Promise.reject("reason").finally(() => undefined)
    .catch(reason => reason) === "reason"
)
```

#### 本章结论

then 返回的是新 promise；handler 的返回或异常通过新 capability 的 resolve/reject 进入下一段状态机。

### Promise Job 保留 Realm 与 execution context，host 决定检查点

kicker: "06 · JOB AND REALM"

Job 是在当前 ECMAScript execution stack 清空后运行的抽象闭包。NewPromiseResolveThenableJob 根据 thenAction 取得 Realm，并允许 host 创建 job callback，目的是在跨 realm 函数、错误对象和主机跟踪中保留正确上下文。

HostEnqueuePromiseJob 把 job 交给 host。浏览器通常在 task 结束等位置做 microtask checkpoint，Node 还存在 nextTick 等宿主队列；ECMAScript 本身不定义 setTimeout、render 或 I/O phase。面试回答应分层：规范保证 reaction/assimilation job 顺序，宿主规范决定何时 drain。

同一队列中的 job 可以继续排 job，checkpoint 通常持续到队列为空。这提供确定的链式顺序，也允许无限 queueMicrotask/Promise.then 饿死渲染和下一 task。长计算应主动切到 task/调度器，而不是不断用 resolved promise “让出执行权”。

#### 代码

```typescript
const order: string[] = []

queueMicrotask(() => {
  order.push("microtask A")
  queueMicrotask(() => order.push("microtask C"))
})

Promise.resolve().then(() => order.push("microtask B"))
order.push("sync")

await new Promise<void>(resolve => setTimeout(resolve, 0))
console.assert(order.join(",") === [
  "sync",
  "microtask A",
  "microtask B",
  "microtask C"
].join(","))
```

#### 本章结论

ECMAScript 定义 Promise Jobs 的因果关系，浏览器或 Node 定义 checkpoint；两层不能混成一句“宏任务微任务”。

### rejection tracking 与错误处理存在时间窗口

kicker: "07 · UNHANDLED REJECTION"

RejectPromise 在没有 handler 时调用 HostPromiseRejectionTracker(promise,"reject")；之后 PerformPromiseThen 首次附加 rejection handler 时可能以 "handle" 再通知 host。浏览器据此派发 unhandledrejection/rejectionhandled，Node 依据运行参数给出警告或终止策略。

“未处理”是宿主在某个检查点观察到的状态，不等于 reject 瞬间立刻报错。稍后一个 microtask/task 才 attach catch 可能先产生 unhandled 通知再产生 handled 通知。测试框架和服务进程应统一收集 unhandled rejection，并让测试/请求失败，而不是依赖控制台文本。

catch 后不重新 throw 会把链转为 fulfilled，可能把故障吞掉；只记录 message 也会丢 cause、stack 与业务上下文。错误边界应决定可恢复分类、补充上下文后 rethrow 或返回显式 Result，并确保清理逻辑使用 finally 而不覆盖原始原因。

#### 代码

```typescript
async function load(): Promise<string> {
  try {
    throw new Error("database unavailable")
  } catch (error) {
    // 补充 cause 后继续保持 rejected 语义。
    throw new Error("profile load failed", { cause: error })
  } finally {
    // 释放资源，但不要 return 覆盖前面的异常。
  }
}

try {
  await load()
  console.assert(false)
} catch (error) {
  console.assert(error instanceof Error)
  console.assert(error.message === "profile load failed")
  console.assert(error.cause instanceof Error)
}
```

#### 本章结论

rejection tracking 是宿主级延迟观察；业务错误边界仍需明确传播、恢复、上下文与资源清理。

### 工程 Promise API 还要补取消、背压与可观测性

kicker: "08 · ENGINEERING CONTRACT"

Promise 只表示一次最终结果，不自带取消。丢弃 promise、race 超时或 settled 后忽略值都不会停止 fetch、数据库查询、worker 与文件句柄。API 应接受 AbortSignal、把取消传入真正资源，并规定取消映射为 rejection、特殊 Result 还是幂等完成。

大量并发 Promise.all 会立即启动全部工作，内存、连接池与限流器可能先耗尽。并发窗口应由 semaphore/queue 管理；每个任务还需超时、重试分类、幂等键和清理。Promise.all 的 fail-fast 不会取消其他元素，仍要等待底层资源自行结束或主动 abort。

可观测性要记录 operation 创建、resolve-to-thenable、最终 settle、handler attach、取消与耗时。AsyncLocalStorage/浏览器 tracing 等上下文传播属于 host/runtime 能力，不能从 Promise 值本身恢复。排查“卡住”时沿 unresolved dependency、pending I/O 和 retained reaction 链查证，而不是只在最后 await 周围加日志。

测试异步合同要控制调度器或使用可预测 deferred，分别断言“尚未 settle”“完成后的值”和“资源已经清理”。只 await 最终值会漏掉过早同步执行、重复回调、timer 未清除和迟到写入。对 thenable 互操作还应专门放入 getter 抛错、非函数 then、双重 resolve、resolve 后 throw 与 self-cycle，避免 happy path 掩盖真正的 resolution bug。

#### 代码

```typescript
async function withTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(new Error("timeout")),
    timeoutMs
  )
  try {
    return await run(controller.signal)
  } finally {
    clearTimeout(timer)
  }
}

const value = await withTimeout(
  async signal => {
    signal.throwIfAborted()
    return 7
  },
  100
)
console.assert(value === 7)
```

#### 本章结论

Promise resolution 解决值和 thenable 的统一，取消、并发预算、资源释放与 trace 仍是上层 API 的责任。

## 核心机制

- resolve/reject 共享 AlreadyResolved Record，第一次调用锁定 promise 命运。
- self-resolution 以 TypeError reject；primitive 直接 fulfill；object 只读取一次 then。
- then getter 抛错变 rejection，非 callable then 让 object 作为普通 fulfillment value。
- callable then 被封装为 NewPromiseResolveThenableJob，再由 host 排入 Promise Job 队列。
- then reaction 创建新 capability，handler 返回值通过新 resolve 再次执行 resolution procedure。
- HostEnqueuePromiseJob 与 HostPromiseRejectionTracker 把调度检查点和未处理拒绝交给宿主。
- 取消、并发、背压、超时和资源清理不属于 Promise settlement 本身。

## 常见误区

- 把 resolved 当作 fulfilled，无法解释 resolve(pendingPromise) 后仍等待却拒绝二次 reject。
- 为 resolve/reject 分别保存 Boolean，导致二者都可能胜出。
- 读取 then 两次，触发 hostile getter 的不同结果或异常。
- 在当前调用栈同步调用外国 thenable.then，制造重入并违反 job 顺序。
- 只防直接 self-resolution，假定所有 PromiseLike 都无环、单调用且公平。
- then callback 中忘记 return promise，让后续链以 undefined 过早继续。
- 用 Promise.race 做超时却不 abort 底层 I/O，产生资源泄漏与迟到副作用。
- 用无限 microtask 做切片，反而饿死渲染和其他 task。
- catch 后只打印并吞掉错误，使上游把失败链当 fulfilled。
- 认为 Promise.all fail-fast 会取消其余任务，忽略连接和副作用仍在运行。

## 实现变体

### 原生 Promise + AbortSignal

useWhen: "浏览器/Node 单次异步操作，需要与生态 await、fetch 和标准组合器互操作。"
tradeoff: "状态与同化语义可靠；取消必须另传 signal，Promise 自身不表达进度和多值。"

#### 代码

```typescript
async function request(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(String(response.status))
  return response.json()
}
```

### 显式 Result Promise

useWhen: "预期业务失败需要穷举处理，不希望所有失败都依赖异常控制流。"
tradeoff: "调用点能区分错误类型；链式组合更啰嗦，程序错误仍应 throw/reject。"

#### 代码

```typescript
type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E }

async function findUser(): Promise<Result<User, "missing">> {
  return { ok: false, error: "missing" }
}
```

### 受控并发 TaskPool

useWhen: "批量异步工作受连接、内存、速率或下游容量约束。"
tradeoff: "可实施背压与取消；需要队列公平、失败策略、生命周期和指标。"

#### 代码

```typescript
const results = await mapConcurrent(
  inputs,
  { concurrency: 8, signal },
  input => processOne(input, signal)
)
```

## 可运行示例

```typescript
type State = "pending" | "fulfilled" | "rejected"
type Reaction<T> = {
  onFulfilled?: (value: unknown) => T | PromiseLike<T>
  onRejected?: (reason: unknown) => T | PromiseLike<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason: unknown) => void
}

class MiniPromise<T> implements PromiseLike<T> {
  private state: State = "pending"
  private result: unknown
  private reactions: Reaction<unknown>[] = []

  constructor(
    executor: (
      resolve: (value: T | PromiseLike<T>) => void,
      reject: (reason: unknown) => void
    ) => void
  ) {
    const alreadyResolved = { value: false }
    const resolve = (value: T | PromiseLike<T>) => {
      if (alreadyResolved.value) return
      alreadyResolved.value = true
      this.resolveValue(value)
    }
    const reject = (reason: unknown) => {
      if (alreadyResolved.value) return
      alreadyResolved.value = true
      this.reject(reason)
    }

    try {
      executor(resolve, reject)
    } catch (error) {
      reject(error)
    }
  }

  private resolveValue(value: T | PromiseLike<T>): void {
    if (value === this) {
      this.reject(new TypeError("self resolution"))
      return
    }

    if ((typeof value !== "object" || value === null) &&
        typeof value !== "function") {
      this.fulfill(value)
      return
    }

    let then: unknown
    try {
      // 只读取一次 then getter。
      then = (value as PromiseLike<T>).then
    } catch (error) {
      this.reject(error)
      return
    }

    if (typeof then !== "function") {
      this.fulfill(value)
      return
    }

    // then 调用必须离开当前栈。
    queueMicrotask(() => {
      const alreadyCalled = { value: false }
      const resolveThenable = (next: T | PromiseLike<T>) => {
        if (alreadyCalled.value) return
        alreadyCalled.value = true
        this.resolveValue(next)
      }
      const rejectThenable = (reason: unknown) => {
        if (alreadyCalled.value) return
        alreadyCalled.value = true
        this.reject(reason)
      }
      try {
        then.call(value, resolveThenable, rejectThenable)
      } catch (error) {
        rejectThenable(error)
      }
    })
  }

  private fulfill(value: unknown): void {
    if (this.state !== "pending") return
    this.state = "fulfilled"
    this.result = value
    this.trigger()
  }

  private reject(reason: unknown): void {
    if (this.state !== "pending") return
    this.state = "rejected"
    this.result = reason
    this.trigger()
  }

  private trigger(): void {
    for (const reaction of this.reactions.splice(0)) {
      queueMicrotask(() => this.runReaction(reaction))
    }
  }

  private runReaction(reaction: Reaction<unknown>): void {
    const handler = this.state === "fulfilled"
      ? reaction.onFulfilled
      : reaction.onRejected
    if (!handler) {
      if (this.state === "fulfilled") reaction.resolve(this.result)
      else reaction.reject(this.result)
      return
    }
    try {
      reaction.resolve(handler(this.result))
    } catch (error) {
      reaction.reject(error)
    }
  }

  then<TResult1 = T, TResult2 = never>(
    onFulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): MiniPromise<TResult1 | TResult2> {
    return new MiniPromise<TResult1 | TResult2>((resolve, reject) => {
      const reaction: Reaction<TResult1 | TResult2> = {
        onFulfilled: onFulfilled
          ? value => onFulfilled(value as T)
          : undefined,
        onRejected: onRejected ?? undefined,
        resolve,
        reject
      }
      this.reactions.push(reaction as Reaction<unknown>)
      if (this.state !== "pending") this.trigger()
    })
  }
}

const events: string[] = []
const thenable = {
  get then() {
    events.push("get")
    return (resolve: (value: number) => void) => {
      events.push("call")
      resolve(7)
      resolve(8)
      throw new Error("ignored after resolve")
    }
  }
}

const value = await new MiniPromise<number>(resolve => {
  resolve(thenable)
  events.push("executor end")
})

console.assert(value === 7)
console.assert(events.join(",") === "get,executor end,call")
```

## 搭积木复现

### 积木 1：建立三态与 reaction 队列

pending 保存两类 reactions；fulfill/reject 只能转换一次并把队列任务化。

### 积木 2：共享 alreadyResolved cell

让 executor 的 resolve/reject 捕获同一对象，覆盖 resolve→reject、reject→resolve 与调用后 throw。

### 积木 3：实现 primitive 与 self-resolution

primitive 直接 fulfill；value===promise 以 TypeError reject，并写 then 返回自身的链式测试。

### 积木 4：只读取一次 then

用计数 getter证明 Get 恰好一次；getter throw 转 rejection，非 callable then 把 object 当值。

### 积木 5：实现 thenable job

queueMicrotask 后才以 thenable 为 this 调 then，并为 job 创建第二组共享 resolve/reject 防多次调用。

### 积木 6：实现 then 与 capability

每次 then 返回新 MiniPromise；handler return/throw/thenable 分别验证下一链结果。

### 积木 7：构造 job 时间线

记录同步代码、then getter、thenable job、reaction job、queueMicrotask 与 timer，逐项解释谁负责入队。

### 积木 8：补生产协议

加入 AbortSignal、timeout 清理、并发窗口与 unhandled rejection 测试，明确 MiniPromise 未覆盖 Realm、species、debug hooks 和 host tracking。

## 自检

### 问题

执行 resolve(thenable) 时，then getter、then 函数、后续 reaction 分别在什么时候运行？如果 thenable 先 resolve(另一个 pending promise)，随后 reject 并抛错，外层 promise 当前是什么状态，最终由谁决定结果？

### 站内答案

resolve 调用在当前同步栈中读取一次 then getter；getter 抛错立刻转成外层 rejection。若得到 callable then，只创建 PromiseResolveThenableJob 并入队，then 函数要到 Promise Job 运行时才以 thenable 为 this 调用。then 内第一次调用 resolve 赢得 job 自己的 alreadyResolved cell；它若解析到另一个 pending promise，外层 promise 的命运已锁定但内部状态仍可保持 pending。随后 reject 与 throw 都因 alreadyResolved 已 true 被忽略。另一个 pending promise 最终 fulfill 或 reject 时，才沿采纳链决定外层 settlement，并把已登记的 reactions 排成后续 PromiseReactionJobs。
