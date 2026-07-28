import type { TopicGuide } from '../../topic-guides'

export const pythonAsyncioGuides: Record<string, TopicGuide> = {
  'event loop 的 ready/timer 队列与单轮调度': {
    official: {
      title: 'asyncio Event Loop',
      url: 'https://docs.python.org/3/library/asyncio-eventloop.html',
      note: '事件循环在每一轮计算 selector 等待时间、处理 I/O、迁移到期 timer，再运行本轮 ready callback 快照。'
    },
    source: {
      repo: 'python/cpython',
      file: 'Lib/asyncio/base_events.py',
      symbol: 'BaseEventLoop._run_once',
      language: 'python',
      url: 'https://github.com/python/cpython/blob/main/Lib/asyncio/base_events.py#L1992',
      walkthrough: [
        '若 ready 非空或 loop 正在停止，selector timeout 为 0；否则由最早 timer 决定睡眠时间。',
        'selector 返回的 I/O 事件先转换为 ready handles，到期 timer 也从最小堆迁入 ready。',
        '只执行进入本轮时 ready 的数量；callback 新排入的工作留给下一轮，避免单个回调链无限霸占同一 tick。'
      ],
      code: `def _run_once(self):
    # ready 有工作时不能阻塞；否则睡到最早 timer 或 I/O。
    if self._ready or self._stopping:
        timeout = 0
    elif self._scheduled:
        timeout = max(0, self._scheduled[0]._when - self.time())
    else:
        timeout = None

    event_list = self._selector.select(timeout)
    self._process_events(event_list)          # I/O completion -> ready

    end_time = self.time() + self._clock_resolution
    while self._scheduled and self._scheduled[0]._when < end_time:
        handle = heapq.heappop(self._scheduled)
        self._ready.append(handle)            # 到期 timer -> ready

    ntodo = len(self._ready)                  # 固定本轮快照
    for _ in range(ntodo):
        handle = self._ready.popleft()
        if not handle._cancelled:
            handle._run()                     # 新 callback 下一轮再执行`
    },
    overview: [
      'event loop 是单线程调度器，不会在任意字节码处抢占 coroutine。Task 运行到 await 一个未完成对象才把 continuation 注册为 callback 并返回 loop；loop 随后选择另一个 ready handle。',
      'timer 使用单调时钟和最小堆，ready 使用 FIFO deque，I/O selector 负责休眠而不轮询。理解这三种结构后，sleep(0)、call_soon、call_later 和 socket readiness 的相对次序就能从数据结构推导。'
    ],
    mechanisms: [
      'call_soon 追加 ready，call_later/call_at 进入 scheduled heap。',
      'loop.time 使用 monotonic clock，避免系统时间跳变影响 deadline。',
      '取消 timer 通常先标记，达到比例阈值再批量整理堆。',
      '一个 callback 的同步执行时间直接阻塞整条 loop。'
    ],
    pitfalls: [
      '把 event loop 当并行执行器，在 callback 中做长 CPU 计算。',
      '用 wall-clock datetime 计算 loop deadline，遇到时钟校准漂移。',
      '假设 callback 新安排的 callback 会在同一轮立即递归运行。'
    ],
    example: `import asyncio

async def main():
    loop = asyncio.get_running_loop()
    events = []

    def first():
        events.append("first")
        loop.call_soon(events.append, "scheduled-during-first")

    loop.call_soon(first)
    loop.call_soon(events.append, "already-ready")
    await asyncio.sleep(0)
    assert events == ["first", "already-ready"]
    await asyncio.sleep(0)
    assert events[-1] == "scheduled-during-first"

asyncio.run(main())`,
    buildSteps: [
      { title: '实现三种队列', body: 'deque 保存 ready，heap 保存 deadline，fake selector 返回 I/O callbacks。' },
      { title: '实现一轮', body: '计算 timeout、迁移事件、固定 ntodo 再运行，测试 callback 链跨轮。' },
      { title: '加入可观测性', body: '记录 tick、queue size、callback duration 与 selector sleep，定位饥饿。' }
    ],
    selfCheckQuestion: '为什么 _run_once 先固定 ntodo，而不一直执行到 ready 队列为空？',
    selfCheckAnswer: 'callback 可以不断 call_soon 自己。若循环到队列为空，同一生产者能在一个 tick 内无限续约，timer、I/O 和取消都得不到重新检查。固定快照把新工作推到下一轮，形成最基本的调度公平边界。'
  },
  'coroutine、Future、Task 与驱动关系': {
    official: {
      title: 'Coroutines and Tasks · Awaitables',
      url: 'https://docs.python.org/3/library/asyncio-task.html#awaitables',
      note: 'coroutine 是可暂停计算；Future 是最终结果占位与 callback 容器；Task 是驱动 coroutine 并把完成状态暴露成 Future 的调度单元。'
    },
    overview: [
      '调用 async def 得到 coroutine object，它保存 continuation，却不会自行推进。Task 包装 coroutine，把每一步 send/throw 排入 event loop；当 coroutine await Future 时，Task 给 Future 注册唤醒 callback，完成后把结果 send 回 continuation。',
      'Future 是一次完成的状态槽：PENDING 只能转为 RESULT、EXCEPTION 或 CANCELLED，完成 callback 被调度而非同步递归执行。应用层通常创建 Task，协议/库层才直接创建 Future 连接 callback API。'
    ],
    mechanisms: [
      'await coroutine 会由当前 Task 直接驱动嵌套 continuation，不必显式 create_task。',
      'create_task 产生并发兄弟；直接 await 保持顺序调用。',
      'Future.set_result/set_exception 只能执行一次。',
      'Task 同时是 Future，因此可 await、加 callback、查询 exception。'
    ],
    pitfalls: [
      '调用 coroutine function 后既不 await 也不 schedule，最终出现 never awaited。',
      '手工 set_result 一个 Task，Task 的结果必须来自 coroutine。',
      '为顺序依赖都 create_task，制造生命周期与错误归属复杂度。'
    ],
    example: `import asyncio

async def child(events):
    events.append("child-start")
    await asyncio.sleep(0)
    events.append("child-end")
    return 42

async def main():
    events = []
    coroutine = child(events)
    assert events == []               # 只有 continuation，尚无人驱动
    task = asyncio.create_task(coroutine)
    assert isinstance(task, asyncio.Future)
    assert await task == 42
    assert events == ["child-start", "child-end"]

asyncio.run(main())`,
    buildSteps: [
      { title: '实现 MiniFuture', body: '状态、result/exception、callbacks 与一次完成不变量。' },
      { title: '实现 MiniTask.step', body: 'send/throw coroutine；yield Future 时注册 wakeup，结束时设置结果。' },
      { title: '覆盖错误路径', body: '重复完成、coroutine 异常、Future 取消与错误 await 对象。' }
    ],
    selfCheckQuestion: '为什么 coroutine object 本身不能像 Task 一样在后台继续运行？',
    selfCheckAnswer: 'coroutine 只保存可恢复的执行状态，没有调度责任。必须由当前 Task 的 await 链或新 Task 反复 send/throw 驱动。Task 把 continuation 与 event loop callback、Future 完成状态和取消协议连接起来，才形成独立运行单元。'
  },
  'create_task 生命周期、强引用与 eager start': {
    official: {
      title: 'asyncio.create_task',
      url: 'https://docs.python.org/3/library/asyncio-task.html#asyncio.create_task',
      note: 'create_task 把 coroutine 调度为 Task；调用者应保存强引用。eager_start 可让 coroutine 在创建期间同步运行到首次阻塞。'
    },
    overview: [
      '默认 create_task 把首次 step 排入 ready queue，当前 callback 不让出前子任务通常不会运行。loop 对 task 只保存弱引用，fire-and-forget 需要业务集合持有强引用，并在完成 callback 中移除和读取异常。',
      'eager task factory/eager_start 让 coroutine 在 Task 构造时同步执行，若不阻塞甚至直接完成。它能省一次调度，却改变副作用、异常和任务排序时机，属于语义选择而非纯性能开关。'
    ],
    mechanisms: [
      'name 与 context 在创建时记录，ContextVar 默认复制当前 context。',
      'background set + task.add_done_callback(discard) 建立有限生命周期引用。',
      '完成 Task 的 exception 若从未读取会在销毁/loop handler 中报警。',
      'TaskGroup.create_task 把所有权绑定到词法作用域。'
    ],
    pitfalls: [
      'create_task 后丢弃引用，依赖 GC 时机维持业务任务。',
      'done callback 只 discard，不调用 result/exception，后台失败无人处理。',
      '开启 eager 后仍依赖“创建后先修改状态、子任务才运行”的顺序。'
    ],
    example: `import asyncio

async def worker(item):
    await asyncio.sleep(0)
    return item * 2

async def main():
    background = set()
    results = []

    task = asyncio.create_task(worker(21), name="double-21")
    background.add(task)
    task.add_done_callback(background.discard)
    task.add_done_callback(lambda done: results.append(done.result()))

    await task
    assert results == [42]
    assert not background

asyncio.run(main())`,
    buildSteps: [
      { title: '建立 owner', body: '定义谁保存 task、谁 await、谁读取异常、何时移除，禁止无主任务。' },
      { title: '比较启动模式', body: '默认与 eager 下记录 create 前后、coroutine 入口和首个 await 顺序。' },
      { title: '加入关闭协议', body: '服务 shutdown 时 cancel 所有 background 并 gather(return_exceptions=True)。' }
    ],
    selfCheckQuestion: '为什么 asyncio 文档要求保存 create_task 返回值的强引用？',
    selfCheckAnswer: 'event loop 的内部集合不会承诺用强引用把 Task 保活；无其他 owner 时任务可能在完成前被回收。业务还需要引用来等待、取消和读取异常。明确 owner 集合既保生命周期，也使关闭与失败处理可审计。'
  },
  '取消请求、CancelledError、cancelling 与 uncancel': {
    official: {
      title: 'Coroutines and Tasks · Task Cancellation',
      url: 'https://docs.python.org/3/library/asyncio-task.html#task-cancellation',
      note: 'Task.cancel 在下一次可运行机会向 coroutine 注入 CancelledError；这是可清理、可暂时捕获的请求，并非强制终止。'
    },
    overview: [
      'cancel() 增加取消请求计数，并安排 Task 在下次 step 向当前暂停点 throw CancelledError。coroutine 的 finally 会运行；若捕获后不重新抛，Task 可能正常返回，因此 cancel() 返回真不等于 task.cancelled() 最终为真。',
      'CancelledError 继承 BaseException，普通 except Exception 不会吞。TaskGroup/timeout 使用内部取消唤醒父任务，cancelling() 计数让内部与外部请求不互相丢失；业务代码几乎不应调用 uncancel，除非确实要把已吞取消的状态一起清除。'
    ],
    mechanisms: [
      'cancel(msg) 是幂等意图但多次调用会增加 cancelling count。',
      'cancelled() 只有 coroutine 最终传播 CancelledError 才为真。',
      'cleanup 后 bare raise 保持结构化并发合同。',
      'await 被取消 Task 会把取消传播给其当前等待 Future。'
    ],
    pitfalls: [
      'except BaseException 后返回默认值，静默吞取消。',
      '在 finally 做无界阻塞清理，使取消永远无法完成。',
      '捕获 CancelledError 却只 uncancel，不理解外部可能还有多次请求。'
    ],
    example: `import asyncio

async def worker(events):
    try:
        events.append("started")
        await asyncio.Event().wait()
    except asyncio.CancelledError:
        events.append("cancel-observed")
        raise
    finally:
        events.append("cleanup")

async def main():
    events = []
    task = asyncio.create_task(worker(events))
    await asyncio.sleep(0)
    assert task.cancel()
    assert task.cancelling() == 1
    try:
        await task
    except asyncio.CancelledError:
        pass
    assert task.cancelled()
    assert events == ["started", "cancel-observed", "cleanup"]

asyncio.run(main())`,
    buildSteps: [
      { title: '实现取消状态', body: 'MiniTask 保存 requests，下一 step 用 throw 而非直接标完成。' },
      { title: '建立路径矩阵', body: '取消发生在未启动、sleep、子 Future、cleanup、已完成五种时点。' },
      { title: '验证计数', body: '多次 cancel、捕获重抛、捕获吞掉、uncancel 后分别断言 cancelling/cancelled。' }
    ],
    selfCheckQuestion: 'task.cancel() 返回 True 后，为什么 task.cancelled() 最终仍可能是 False？',
    selfCheckAnswer: 'True 只表示取消请求成功排入。coroutine 会在暂停点收到 CancelledError，并有机会捕获；若它吞掉异常后返回普通值，Task 正常完成，cancelled() 为 False。推荐只为清理捕获，然后重新抛出。'
  },
  'await 的协作公平性与事件循环饥饿': {
    official: {
      title: 'asyncio.sleep',
      url: 'https://docs.python.org/3/library/asyncio-task.html#asyncio.sleep',
      note: 'sleep 总会暂停当前 task；delay=0 提供让其他 ready tasks 运行的优化路径。普通 await 只有底层未完成时才必然暂停。'
    },
    overview: [
      'await 是协议调用，不是无条件 yield。等待一个已经完成的 Future 或内部从不真正挂起的 coroutine，可能同步一路返回；包含许多 await 的循环仍可能完全霸占 event loop。',
      'asyncio 采用协作式公平：代码自行到达可暂停点。CPU 密集循环应分块并显式让出、移到 executor/process，或改用向量化实现；频繁 sleep(0) 只能缓解调度，不能消除 CPU 工作。'
    ],
    mechanisms: [
      'await 链可在同一 Task 内同步穿透多个立即完成对象。',
      'sleep(0) 把 continuation 重新排入 ready。',
      'asyncio.Lock 通常按等待队列公平唤醒，但整体 loop 公平仍受 callback 时间影响。',
      '同步 callback 无任何抢占点。'
    ],
    pitfalls: [
      '以源码中出现 await 次数评估公平性。',
      '在 async handler 中用 time.sleep、同步 requests 或大 JSON/正则计算。',
      '每次迭代 sleep(0) 导致调度开销，却没有设置真实工作预算。'
    ],
    example: `import asyncio

async def immediate():
    return None

async def busy(events):
    for index in range(30_000):
        await immediate()          # 从未挂起，仍在同一 Task 同步前进
        if index % 5_000 == 0:
            await asyncio.sleep(0) # 明确把 continuation 交回 ready 队列
    events.append("busy-done")

async def observer(events):
    await asyncio.sleep(0)
    events.append("observer-ran")

async def main():
    events = []
    await asyncio.gather(busy(events), observer(events))
    assert "observer-ran" in events

asyncio.run(main())`,
    buildSteps: [
      { title: '区分完成状态', body: 'await 已完成与未完成 Future，记录 loop tick 是否变化。' },
      { title: '设置 CPU 预算', body: '每批按时间而非固定次数让出，观察延迟分位数与吞吐。' },
      { title: '选择卸载方式', body: 'I/O 阻塞用 thread，Python CPU 用 process，短计算保留 loop 并设阈值。' }
    ],
    selfCheckQuestion: '为什么 `await some_async_function()` 不保证其他 Task 获得运行机会？',
    selfCheckAnswer: 'async function 可能一路只等待已完成对象，整个 await 链同步返回当前 Task；只有底层产生未完成 awaitable，或显式 sleep(0) 等调度点，控制权才回到 loop。公平性取决于真实暂停，而非 await 关键词数量。'
  },
  'gather 的结果、异常与取消矩阵': {
    official: {
      title: 'asyncio.gather',
      url: 'https://docs.python.org/3/library/asyncio-task.html#asyncio.gather',
      note: 'gather 按输入顺序聚合结果；默认首个异常立即传播但不取消兄弟，return_exceptions=True 把异常当结果，取消外层则取消未完成孩子。'
    },
    source: {
      repo: 'python/cpython',
      file: 'Lib/asyncio/tasks.py',
      symbol: 'gather',
      language: 'python',
      url: 'https://github.com/python/cpython/blob/main/Lib/asyncio/tasks.py#L771',
      walkthrough: [
        'coroutine 输入先转成 Future/Task，重复同一 awaitable 会复用同一个 child，但结果位置仍按原输入排列。',
        'done callback 在默认模式遇到首个 exception 就完成 outer，不会遍历取消其他 children。',
        'outer.cancel 才向所有未完成 child 发 cancel；outer 已因异常完成后再 cancel 已太晚。'
      ],
      code: `def gather(*aws, return_exceptions=False):
    children = [ensure_future(aw) for aw in aws]
    outer = _GatheringFuture(children)

    def _done_callback(child):
        if outer.done():
            if not child.cancelled():
                child.exception()            # 取回后续异常，避免报警
            return
        if not return_exceptions:
            if child.cancelled():
                outer.set_exception(CancelledError())
                return
            if (exc := child.exception()) is not None:
                outer.set_exception(exc)      # 兄弟继续运行
                return
        if all(done.done() for done in children):
            outer.set_result([
                done.exception() or done.result()
                for done in children
            ])
    return outer`
    },
    overview: [
      'gather 是结果聚合器，不是失败作用域。默认首个异常使等待者立即收到失败，兄弟 Task 继续运行；这对独立请求有时合理，对“要么全成功要么全取消”的子任务树则危险。',
      'return_exceptions=True 把异常对象放进结果列表，调用者必须逐项分类。子 Task 自己被取消会作为 CancelledError 结果/异常处理，不把 gather outer 标成 cancelled；取消 gather outer 才传播到所有未完成孩子。'
    ],
    mechanisms: [
      '结果顺序按输入，而非完成顺序。',
      '传 coroutine 会自动创建 Task。',
      'outer 已 done 后 cancel 不再影响仍运行的兄弟。',
      '重复传入同一 awaitable 会映射到多个结果位置。'
    ],
    pitfalls: [
      '捕获 gather 首错后以为兄弟已停止，立即释放它们仍使用的资源。',
      'return_exceptions=True 后不检查结果类型。',
      '用 gather 构建强生命周期树，却没有 owner 回收晚失败。'
    ],
    example: `import asyncio

async def main():
    release = asyncio.Event()
    events = []

    async def fail():
        raise ValueError("first")

    async def sibling():
        await release.wait()
        events.append("sibling-finished")

    sibling_task = asyncio.create_task(sibling())
    try:
        await asyncio.gather(fail(), sibling_task)
    except ValueError:
        assert not sibling_task.cancelled()
        release.set()
        await sibling_task
    assert events == ["sibling-finished"]

asyncio.run(main())`,
    buildSteps: [
      { title: '列四维矩阵', body: 'child 成功/失败/取消 × outer 取消 × return_exceptions × outer 是否已完成。' },
      { title: '实现聚合 Future', body: '每个 child done callback 更新计数；首错完成 outer，但继续取回晚异常。' },
      { title: '比较 TaskGroup', body: '同一三个 worker 分别用 gather/TaskGroup，记录兄弟取消和抛出类型。' }
    ],
    selfCheckQuestion: 'gather 默认传播首个异常后，为什么不自动取消其他子任务？',
    selfCheckAnswer: 'gather 的合同是按位置聚合一组可独立 awaitable；一个 child 失败不代表其他工作应被撤销。它只让 outer 提前以异常完成，兄弟保留自己的生命周期。需要共同成败与词法所有权时应使用 TaskGroup。'
  },
  'TaskGroup 结构化并发与 ExceptionGroup': {
    official: {
      title: 'asyncio.TaskGroup',
      url: 'https://docs.python.org/3/library/asyncio-task.html#task-groups',
      note: 'TaskGroup 在退出前等待所有孩子；首个非 CancelledError 失败取消其余孩子，最终以 ExceptionGroup 聚合非取消失败。'
    },
    source: {
      repo: 'python/cpython',
      file: 'Lib/asyncio/taskgroups.py',
      symbol: 'TaskGroup._aexit',
      language: 'python',
      url: 'https://github.com/python/cpython/blob/main/Lib/asyncio/taskgroups.py#L82',
      walkthrough: [
        'body 异常或 parent 取消会调用 _abort，向所有未完成孩子发取消请求。',
        '退出用 while self._tasks 等待集合真正归零；等待 Future 本身可被多次外部取消，因此需要循环重建。',
        'BaseException 单独优先传播，普通多错误聚合为 ExceptionGroup；内部取消还要恢复 parent 的外部取消计数。'
      ],
      code: `async def _aexit(self, et, exc):
    self._exiting = True
    if et is not None:
        if not self._aborting:
            self._abort()                     # body 失败/外部取消 -> 取消孩子

    while self._tasks:                         # 词法作用域不能早于孩子结束
        if self._on_completed_fut is None:
            self._on_completed_fut = self._loop.create_future()
        try:
            await self._on_completed_fut
        except CancelledError as cancel:
            if not self._aborting:
                self._abort()
            propagate_cancellation_error = cancel
        self._on_completed_fut = None

    if self._errors:
        raise BaseExceptionGroup(
            "unhandled errors in a TaskGroup", self._errors)
    if propagate_cancellation_error:
        raise propagate_cancellation_error`
    },
    overview: [
      '结构化并发要求父作用域拥有孩子：不能在所有孩子完成、失败或被取消前退出。TaskGroup.create_task 登记所有权，__aexit__ 负责失败联动和回收，因此不会留下无主兄弟。',
      '首个非取消异常触发兄弟 cancel；同时失败或取消清理中失败的错误会汇入 ExceptionGroup。KeyboardInterrupt/SystemExit 等 base error 在回收孩子后优先重抛，避免被普通组包装。'
    ],
    mechanisms: [
      'body 自身异常也参与最终 group。',
      '孩子仅 CancelledError 通常不加入错误组。',
      '进入 abort 后不再接受新 task。',
      '嵌套 TaskGroup 必须区分内部唤醒取消与外部取消。'
    ],
    pitfalls: [
      '孩子吞 CancelledError，使 group 退出长时间挂起。',
      '从 TaskGroup 返回 task 并期待离开作用域后继续后台运行。',
      '只 except Exception，未用 except* 对多错误分类。'
    ],
    example: `import asyncio

async def main():
    events = []

    async def fail():
        await asyncio.sleep(0)
        raise ValueError("boom")

    async def sibling():
        try:
            await asyncio.Event().wait()
        finally:
            events.append("sibling-cleanup")

    try:
        async with asyncio.TaskGroup() as group:
            group.create_task(fail())
            group.create_task(sibling())
    except* ValueError as errors:
        assert len(errors.exceptions) == 1

    assert events == ["sibling-cleanup"]

asyncio.run(main())`,
    buildSteps: [
      { title: '建立 owner 集合', body: 'enter 后允许 create，done callback 移除；exit 等集合归零。' },
      { title: '实现 fail-fast', body: '首个非取消失败保存错误并 cancel 其他孩子，继续等待清理。' },
      { title: '处理取消碰撞', body: '覆盖 parent 外部 cancel 与 child failure 同轮发生，保证错误与取消都不丢。' }
    ],
    selfCheckQuestion: 'TaskGroup 为什么在发现首个失败后仍不能立即抛出？',
    selfCheckAnswer: '它先取消兄弟，但取消只是请求；每个孩子还要运行 finally，且清理可能产生新异常。结构化作用域必须等所有孩子终止，收集完整错误集合后才能离开，否则会泄漏仍运行的任务和资源。'
  },
  'timeout、wait_for、shield 与取消作用域': {
    official: {
      title: 'asyncio Timeouts and Shielding',
      url: 'https://docs.python.org/3/library/asyncio-task.html#timeouts',
      note: 'timeout 取消当前 Task 并在作用域外转换为 TimeoutError；wait_for 取消目标 awaitable；shield 阻止调用者取消传播给子 Task，但调用者仍收到 CancelledError。'
    },
    overview: [
      'asyncio.timeout 是词法取消作用域：deadline 到达时取消当前 Task，__aexit__ 识别自己的取消并转成 TimeoutError，因此 TimeoutError 要在 async with 外捕获。嵌套 timeout 可安全区分各自 deadline。',
      'wait_for 针对一个 awaitable，超时会 cancel 它并等待取消完成，所以墙钟时间可能超过 timeout。shield 只切断 caller cancellation → child cancellation 这条边，caller 的 await 仍抛 CancelledError，且必须保存 child 强引用并决定以后如何回收。'
    ],
    mechanisms: [
      'timeout 使用 loop deadline 和 Task cancellation count 区分自己的请求。',
      'wait_for 遇到外部取消也会取消目标并传播。',
      'shield 不抵御 child 自身取消或其他 owner 取消。',
      '保护提交/回滚要有限时且有后续 owner，不能无限 shield。'
    ],
    pitfalls: [
      '在 timeout block 内 except TimeoutError，实际先收到 CancelledError。',
      'shield coroutine 后丢弃返回 task 引用，保护了执行却无法回收结果。',
      '以为 wait_for 会在 deadline 瞬间返回，忽略取消清理耗时。'
    ],
    example: `import asyncio

async def commit(events):
    await asyncio.sleep(0.02)
    events.append("committed")

async def main():
    events = []
    task = asyncio.create_task(commit(events))
    try:
        async with asyncio.timeout(0.001):
            await asyncio.shield(task)
    except TimeoutError:
        # 当前 task 超时，但 shield 保留 commit task。
        await task
    assert events == ["committed"]

asyncio.run(main())`,
    buildSteps: [
      { title: '画取消边', body: '对 timeout、wait_for、shield 标出谁取消谁、谁转换异常、谁继续运行。' },
      { title: '测时间线', body: '目标 cleanup 延迟 50ms，断言 wait_for 实际返回时间与最终状态。' },
      { title: '设计 shield owner', body: '保存 task、设置二级 deadline、读取结果/异常，并在服务关闭时回收。' }
    ],
    selfCheckQuestion: 'shield 为什么既让子 Task 继续运行，又让当前 await 抛 CancelledError？',
    selfCheckAnswer: 'shield 只阻断取消向被保护 Task 传播，不取消调用者本身的取消合同。调用者仍应尽快响应取消；子任务被留下继续执行，因此必须有独立 owner 保存引用、等待或在稍后处理结果。'
  },
  'Semaphore、Queue 背压、join 与 shutdown': {
    official: {
      title: 'asyncio Queues',
      url: 'https://docs.python.org/3/library/asyncio-queue.html',
      note: '有界 Queue 在满时暂停 put 形成缓冲背压；unfinished_tasks 由 put 增、task_done 减，join 等到归零；3.13+ shutdown 唤醒阻塞生产者/消费者。'
    },
    source: {
      repo: 'python/cpython',
      file: 'Lib/asyncio/queues.py',
      symbol: 'Queue.put / put_nowait / shutdown',
      language: 'python',
      url: 'https://github.com/python/cpython/blob/main/Lib/asyncio/queues.py#L125',
      walkthrough: [
        '队列满时每个 putter 创建 Future 排队；取消等待者要从 deque 移除，若已被唤醒还需唤醒下一个，避免容量 token 丢失。',
        '真正入队时 unfinished_tasks 增一并清除 finished event；get 不减少它，业务处理后 task_done 才减少。',
        'shutdown 唤醒全部 getter/putter 让其重查状态；immediate 模式还会排空并修改 unfinished count，因此打破“join 表示已处理”语义。'
      ],
      code: `async def put(self, item):
    while self.full():
        if self._is_shutdown:
            raise QueueShutDown
        putter = self._get_loop().create_future()
        self._putters.append(putter)
        try:
            await putter
        except:
            putter.cancel()
            self._putters.remove(putter)
            if not self.full() and not putter.cancelled():
                self._wakeup_next(self._putters)
            raise
    return self.put_nowait(item)

def put_nowait(self, item):
    if self._is_shutdown:
        raise QueueShutDown
    self._put(item)
    self._unfinished_tasks += 1        # 表示尚未“处理”，并非只表示仍在队列
    self._finished.clear()
    self._wakeup_next(self._getters)`
    },
    overview: [
      'Semaphore 限制同时进入临界区的工作数，Queue(maxsize) 限制等待处理的缓冲数；两者解决不同资源。只有有界 queue 的 producer await put，压力才会从慢消费者传回上游。',
      'queue.join 等 unfinished_tasks 归零，而非 qsize 归零。消费者 get 后必须在 finally 调 task_done；否则队列看似为空，join 却永远挂起。shutdown(false) 允许排空，immediate 会牺牲处理完成不变量换取快速终止。'
    ],
    mechanisms: [
      'asyncio Queue/Semaphore 只用于同一 event loop，不是线程安全容器。',
      'Semaphore cancellation 要归还尚未消费或已分配 token。',
      'Queue maxsize=0 表示无界，不具备内存背压。',
      'sentinel 终止与 shutdown API 的多消费者传播语义不同。'
    ],
    pitfalls: [
      '只设 Semaphore，不限制创建百万个等待 Task。',
      'get 后业务异常跳过 task_done。',
      'immediate shutdown 后仍把 join 返回解释为所有工作成功处理。'
    ],
    example: `import asyncio

async def worker(queue, results):
    while True:
        try:
            item = await queue.get()
        except asyncio.QueueShutDown:
            return
        try:
            results.append(item * 2)
        finally:
            queue.task_done()

async def main():
    queue = asyncio.Queue(maxsize=2)
    results = []
    workers = [asyncio.create_task(worker(queue, results)) for _ in range(2)]
    for item in range(5):
        await queue.put(item)
    await queue.join()
    queue.shutdown()
    await asyncio.gather(*workers)
    assert sorted(results) == [0, 2, 4, 6, 8]

asyncio.run(main())`,
    buildSteps: [
      { title: '分离两种容量', body: 'Queue 控待处理数，Semaphore 控正在访问外部资源数，分别暴露指标。' },
      { title: '实现等待队列', body: 'getter/putter Future deque，取消时清理并转交 wakeup。' },
      { title: '验证关闭矩阵', body: 'graceful/immediate × 队列空/非空 × 阻塞 get/put × join。' }
    ],
    selfCheckQuestion: '为什么 Queue 已经 empty，join 仍可能一直等待？',
    selfCheckAnswer: 'empty 只表示所有 item 已被 get；join 追踪的是 put 后尚未 task_done 的工作。消费者可能正在处理，或异常路径漏掉 task_done。unfinished_tasks 每 put 加一，每完成处理减一，归零才表示处理合同完成。'
  },
  'to_thread、run_in_executor、ContextVar 与 GIL': {
    official: {
      title: 'asyncio.to_thread',
      url: 'https://docs.python.org/3/library/asyncio-task.html#asyncio.to_thread',
      note: 'to_thread 在线程池运行同步 callable 并传播当前 contextvars.Context；取消等待者不能强制停止已运行的线程函数。'
    },
    overview: [
      'to_thread 是高层 I/O 阻塞适配器：复制当前 Context，在默认 ThreadPoolExecutor 调用函数并返回 awaitable。run_in_executor 更底层，可指定 thread/process/interpreter executor，但默认不自动传播 ContextVar。',
      '取消 await 只取消 asyncio Future 的等待关系；Python 无安全机制向任意工作线程注入终止，函数可能继续操作文件或外部服务。需要 cooperative stop token、幂等操作和 shutdown owner。',
      '经典 GIL 构建中，纯 Python CPU 线程通常不能获得多核吞吐，适合 ProcessPool/InterpreterPool 或释放 GIL 的扩展；I/O 调用释放 GIL，线程仍能隐藏阻塞。free-threaded 构建也不免除底层库线程安全审计。'
    ],
    mechanisms: [
      'to_thread 调用发生在 await/schedule 后，不在函数调用表达式当场。',
      '线程池过小会排队，过大造成上下文切换与下游过载。',
      'ProcessPool 参数/结果需可序列化，入口需 __main__ guard。',
      'ContextVar copy 不等于普通 threading.local 复制。'
    ],
    pitfalls: [
      '用 wait_for(to_thread(...)) 超时后认为底层同步操作停止。',
      '把 CPU Python 循环放默认 thread pool，阻塞其他 I/O offload。',
      '从 worker thread 直接调用非线程安全 loop API。'
    ],
    example: `import asyncio
import contextvars
import threading

request_id = contextvars.ContextVar("request_id")

def blocking_read():
    return request_id.get(), threading.current_thread().name

async def main():
    request_id.set("req-42")
    seen, thread_name = await asyncio.to_thread(blocking_read)
    assert seen == "req-42"
    assert thread_name != threading.current_thread().name

asyncio.run(main())`,
    buildSteps: [
      { title: '实现 to_thread', body: 'copy_context 后用 loop.run_in_executor(None, ctx.run, fn, *args)。' },
      { title: '测取消边界', body: '线程函数等待 threading.Event，取消 async waiter 后证明线程仍活着，再用 stop token 结束。' },
      { title: '容量规划', body: '分别测 queue wait、service time、active workers 和下游限流，设置独立 executor。' }
    ],
    selfCheckQuestion: '为什么取消 `await asyncio.to_thread(fn)` 通常无法停止 fn？',
    selfCheckAnswer: 'asyncio 只能取消代表线程工作的 Future 和当前等待关系；任意时刻终止线程可能破坏锁与 C 库状态，Python 不提供这种操作。fn 已开始后会继续，除非它主动检查 stop token 或底层调用支持取消。'
  },
  'asyncio debug、任务栈与泄漏诊断': {
    official: {
      title: 'Developing with asyncio · Debug Mode',
      url: 'https://docs.python.org/3/library/asyncio-dev.html#debug-mode',
      note: 'debug mode 检测未 await coroutine、错误线程调用、慢 callback；Task introspection 与 loop exception handler 提供运行中证据。'
    },
    overview: [
      '异步泄漏常不是内存对象本身，而是永不完成的生命周期：Task 等待无人会 set 的 Future、Queue.join 缺 task_done、后台异常从未读取、async generator 未关闭。诊断必须从 all_tasks、task.get_stack 和等待对象关系建立证据。',
      'debug mode 记录 Task 创建来源、检查非线程安全 API、输出超过 slow_callback_duration 的 callback。它有开销，适合开发/灰度；生产应保留 task name、结构化 owner、等待时长和 loop exception handler。'
    ],
    mechanisms: [
      'RuntimeWarning: coroutine was never awaited 指 coroutine object 未被驱动。',
      'Task was destroyed but pending 表示 owner/loop 提前消失。',
      'Task exception was never retrieved 表示失败无人 await/result/exception。',
      'get_stack/print_stack 显示暂停 frame，配合 task name 与 creation traceback。'
    ],
    pitfalls: [
      '只在进程退出看 warning，任务创建源已无业务上下文。',
      '定期 all_tasks 却没有基线、owner 和等待年龄，无法识别泄漏。',
      '用异常 done callback 本身抛错，覆盖原任务诊断。'
    ],
    example: `import asyncio

async def blocked(event):
    await event.wait()

async def main():
    loop = asyncio.get_running_loop()
    loop.set_debug(True)
    loop.slow_callback_duration = 0.05

    event = asyncio.Event()
    task = asyncio.create_task(blocked(event), name="blocked-demo")
    await asyncio.sleep(0)

    stacks = task.get_stack()
    assert task.get_name() == "blocked-demo"
    assert stacks[-1].f_code.co_name == "blocked"

    task.cancel()
    await asyncio.gather(task, return_exceptions=True)

asyncio.run(main(), debug=True)`,
    buildSteps: [
      { title: '建立任务快照', body: '定时记录 name、age、state、top frame、owner、current awaitable。' },
      { title: '制造四类失败', body: 'never awaited、pending destroyed、unretrieved exception、slow callback，保存对应证据。' },
      { title: '设置发布门', body: '测试结束断言除允许列表外无 pending tasks，loop handler 收集未处理上下文并使测试失败。' }
    ],
    selfCheckQuestion: '为什么仅统计 asyncio.all_tasks() 数量不足以判断任务泄漏？',
    selfCheckAnswer: '服务负载会让正常 task 数波动，短快任务和永久等待任务数量可能相同。需要任务年龄、owner、暂停栈、等待对象和关闭预期；同一 owner 下持续增长或超过 deadline 的 waiting state 才是有力泄漏证据。'
  }
}
