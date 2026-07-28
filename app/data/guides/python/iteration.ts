import type { TopicGuide } from '../../topic-guides'

export const pythonIterationGuides: Record<string, TopicGuide> = {
  'Iterable、Iterator 与 __getitem__ 兼容路径': {
    official: {
      title: 'Built-in types · Iterator Types',
      url: 'https://docs.python.org/3/library/stdtypes.html#iterator-types',
      note: '容器提供 __iter__ 产生 iterator；iterator 的 __iter__ 返回自身，__next__ 返回下一项或抛出 StopIteration。'
    },
    source: {
      repo: 'python/cpython',
      file: 'Objects/abstract.c',
      symbol: 'PyObject_GetIter',
      language: 'c',
      url: 'https://github.com/python/cpython/blob/main/Objects/abstract.c#L2813',
      walkthrough: [
        '先读类型对象的 tp_iter 槽；有槽时调用它，并检查结果本身确实实现 iterator 协议。',
        '没有 tp_iter 时，旧式序列仍可经 PySequence_Check 与 PySeqIter_New 走整数索引回退。',
        '回退是兼容路径，不应成为新容器 API 的首选设计；显式 __iter__ 才能表达稳定迭代语义。'
      ],
      code: `PyObject *
PyObject_GetIter(PyObject *o)
{
    PyTypeObject *t = Py_TYPE(o);
    getiterfunc f = t->tp_iter;             // 先找类型的 __iter__ 槽

    if (f == NULL) {
        if (PySequence_Check(o))
            return PySeqIter_New(o);        // 兼容旧序列：依次请求 o[0]、o[1]...
        return type_error("'%.200s' object is not iterable", o);
    }

    PyObject *res = (*f)(o);
    if (res != NULL && !PyIter_Check(res)) {
        PyErr_Format(PyExc_TypeError,
                     "%T.__iter__() must return an iterator, not %T", o, res);
        Py_SETREF(res, NULL);
    }
    return res;
}`
    },
    overview: [
      'Iterable 表示“能创建遍历会话”，Iterator 表示“某一次遍历会话的游标”。列表可以反复 iter(list) 得到彼此独立的游标；generator 通常同时是 iterable 与 iterator，iter(gen) 仍返回它自己，因此只能消费一次。',
      'for 并不要求对象是容器。它先调用 iter(obj)，随后重复 next(iterator)，捕获 StopIteration 后结束。把取数状态放进 iterator，让容器本体保持可重复遍历，是最常见的职责划分。',
      'CPython 仍兼容只实现 __getitem__(0)、__getitem__(1)… 的旧式序列。索引抛出 IndexError 时迭代结束。这条路径解释了一些“没有 __iter__ 却能 for”的对象，也提醒框架作者不要把兼容现象误当成首选协议。'
    ],
    mechanisms: [
      'iter(x) 优先调用 type(x).__iter__(x)，不会先从实例字典取同名方法。',
      'iterator.__iter__ 必须返回自身，才能让接收 iterable 的 API 同样接收已经部分消费的 iterator。',
      '可重复 iterable 每次创建新游标；一次性 iterator 把数据源与游标合在同一对象中。',
      '双参数 iter(callable, sentinel) 会反复调用 callable，并在结果等于 sentinel 时停止。'
    ],
    pitfalls: [
      '在容器的 __iter__ 中 return self，却把游标也存到容器上，导致嵌套循环互相推进。',
      '用 list(iterator) 调试后再次消费，忘记 iterator 已耗尽。',
      '仅依赖 __getitem__ 回退，负索引、稀疏索引和非整数键会让迭代契约含糊。'
    ],
    example: `class RangeView:
    def __init__(self, start, stop):
        self.start, self.stop = start, stop

    def __iter__(self):
        # 每次迭代创建独立会话，因此可以嵌套或重复遍历。
        return RangeCursor(self.start, self.stop)

class RangeCursor:
    def __init__(self, current, stop):
        self.current, self.stop = current, stop

    def __iter__(self):
        return self

    def __next__(self):
        if self.current >= self.stop:
            raise StopIteration
        value = self.current
        self.current += 1
        return value

view = RangeView(0, 3)
assert list(view) == [0, 1, 2]
assert list(view) == [0, 1, 2]
assert list(zip(view, view)) == [(0, 0), (1, 1), (2, 2)]`,
    buildSteps: [
      { title: '先展开 for', body: '手写 iterator = iter(source) 与 while/next/except StopIteration，观察协议最小边界。' },
      { title: '分离数据与游标', body: '分别实现 RangeView 与 RangeCursor，写重复遍历、嵌套遍历和部分消费测试。' },
      { title: '验证兼容路径', body: '写一个只有 __getitem__ 的 LegacySequence，记录收到的索引，再补 __iter__ 比较调用链。' }
    ],
    selfCheckQuestion: '为什么 iterator.__iter__ 返回 self，而容器.__iter__ 通常返回新对象？',
    selfCheckAnswer: 'iterator 已经代表一条具体遍历会话，返回 self 让 for、list、zip 等消费方可以统一接收 iterable 和 iterator；容器代表可重复的数据集合，返回新 iterator 才能让多个遍历拥有独立游标。若容器也返回自己，嵌套循环和并发消费者会共享进度。'
  },
  '迭代耗尽、StopIteration 与 PEP 479': {
    official: {
      title: 'Expressions · Generator-iterator methods',
      url: 'https://docs.python.org/3/reference/expressions.html#generator-iterator-methods',
      note: '生成器 return 会以 StopIteration.value 传递结果；生成器体意外泄漏的 StopIteration 会依 PEP 479 转为 RuntimeError。'
    },
    source: {
      repo: 'python/cpython',
      file: 'Objects/genobject.c',
      symbol: 'gen_iternext',
      language: 'c',
      url: 'https://github.com/python/cpython/blob/main/Objects/genobject.c#L749',
      walkthrough: [
        'gen_send_ex 把恢复结果分成 YIELD、RETURN、ERROR，而不是只返回一个可能为空的指针。',
        '生成器 return value 在 RETURN 分支被包装进 StopIteration.value，供 yield from 或手工驱动器读取。',
        '普通 for 只把 StopIteration 当控制信号并丢弃 value，因此聚合结果必须由委派表达式或显式驱动器接收。'
      ],
      code: `static PyObject *
gen_iternext(PyObject *self)
{
    PyGenObject *gen = _PyGen_CAST(self);
    PyObject *result;

    if (gen_send_ex(gen, NULL, &result) == PYGEN_RETURN) {
        if (result != Py_None) {
            _PyGen_SetStopIterationValue(result); // return x -> StopIteration(x)
        }
        Py_CLEAR(result);
    }
    return result;                              // yield 值或 NULL + 异常状态
}`
    },
    overview: [
      'StopIteration 在 iterator 边界上是正常结束信号，在普通业务函数里却是一种异常。消费方必须区分“拿到值”“正常耗尽”“真实错误”三态；CPython C API 也通过返回值加 error indicator 表达这三种情况。',
      '生成器里的 return result 不会像普通函数那样直接返回调用者。它结束迭代，并把 result 放入 StopIteration.value。for 会吞掉这个值，yield from 则把它变成整个委派表达式的结果。',
      'PEP 479 防止生成器体内部意外抛出的 StopIteration 被误判为正常结束。它越过生成器边界时会转成 RuntimeError；正确结束应使用 return，调用可能抛 StopIteration 的代码则应在生成器体内显式处理。'
    ],
    mechanisms: [
      'next(it, default) 只在 StopIteration 时返回 default，其他异常继续传播。',
      '耗尽后的 iterator 应持续抛 StopIteration，不应神秘地重新开始。',
      'return x 编译为生成器返回路径，x 最终进入 StopIteration.value。',
      'PEP 479 的转换发生在异常将要逃出生成器边界时，内部 try/except StopIteration 仍然有效。'
    ],
    pitfalls: [
      '用 raise StopIteration(value) 模拟生成器 return，现代 Python 会得到 RuntimeError。',
      'C 扩展只看 PyIter_Next 返回 NULL，不检查 PyErr_Occurred，因而吞掉真实异常。',
      '把一个已经耗尽的 iterator 当成空容器并重复使用，掩盖上游提前消费。'
    ],
    example: `def child():
    yield "chunk"
    return {"count": 1}

it = child()
assert next(it) == "chunk"
try:
    next(it)
except StopIteration as stop:
    assert stop.value == {"count": 1}

def broken():
    # 这不是合法的“返回”，PEP 479 会把它改成 RuntimeError。
    raise StopIteration("accidental")
    yield

try:
    next(broken())
except RuntimeError as exc:
    assert isinstance(exc.__cause__, StopIteration)`,
    buildSteps: [
      { title: '实现三态 next', body: '写 next_result(iterator) 返回 VALUE、DONE、ERROR 三种枚举，禁止用 None 同时表示值和结束。' },
      { title: '提取 return value', body: '手工驱动含 return 的生成器，读取 StopIteration.value，再比较 for 循环为何看不到它。' },
      { title: '制造协议泄漏', body: '让生成器调用 next(empty_iterator)，分别不捕获与捕获 StopIteration，验证 PEP 479 的边界。' }
    ],
    selfCheckQuestion: '为什么 PEP 479 要把生成器体意外抛出的 StopIteration 改成 RuntimeError？',
    selfCheckAnswer: '因为生成器调用者把 StopIteration 解释为“正常耗尽”。若生成器内部任意一层代码意外抛出它，错误会静默截短数据流。转换成 RuntimeError 能保留失败可见性；生成器作者仍可用 return 正常结束，或在内部明确捕获确实属于局部协议的 StopIteration。'
  },
  '生成器函数、惰性启动与对象状态': {
    official: {
      title: 'Expressions · Yield expressions',
      url: 'https://docs.python.org/3/reference/expressions.html#yield-expressions',
      note: '函数体出现 yield 后，调用函数只创建 generator object；执行在首次 next/send(None) 时开始，并在每个 yield 暂停。'
    },
    overview: [
      '含 yield 的 def 创建 generator function。调用它时，参数绑定已经完成，生成器对象和执行帧也已准备好，但函数体第一行尚未运行。这让数据管线可以先组装，直到消费者真正拉取时才产生副作用。',
      'generator 的状态通常可观察为 GEN_CREATED、GEN_RUNNING、GEN_SUSPENDED、GEN_CLOSED。状态转换是单向生命周期，已关闭对象不能重启；想重复计算必须再次调用 generator function 创建新对象。',
      '惰性会推迟异常、资源获取和日志。API 设计必须说明错误发生在“构造迭代器”还是“首次消费”，否则调用者很难确定重试与清理边界。'
    ],
    mechanisms: [
      '调用 generator function 创建对象并保存初始 frame，不执行用户代码。',
      'next(gen) 等价于 gen.send(None)，首次恢复从函数入口开始。',
      'yield value 将 value 交给调用者并保存恢复位置；下一次恢复后 yield 表达式结果为 None 或 send 的值。',
      '正常 return、未处理异常或 close 都会进入 CLOSED，后续 next 只抛 StopIteration。'
    ],
    pitfalls: [
      '在调用生成器后立刻期待参数校验或文件打开已经执行。',
      '把 generator 存成可复用字段，第一次请求已把它耗尽。',
      '在生成器里跨 yield 持有数据库事务或锁，却没有明确消费期限与 close 策略。'
    ],
    example: `import inspect

events = []

def rows(limit):
    events.append("started")
    for index in range(limit):
        events.append(f"before:{index}")
        yield index
    events.append("returned")

gen = rows(2)
assert events == []
assert inspect.getgeneratorstate(gen) == "GEN_CREATED"

assert next(gen) == 0
assert events == ["started", "before:0"]
assert inspect.getgeneratorstate(gen) == "GEN_SUSPENDED"

assert list(gen) == [1]
assert events[-1] == "returned"
assert inspect.getgeneratorstate(gen) == "GEN_CLOSED"`,
    buildSteps: [
      { title: '记录状态迁移', body: '在入口、yield 前后、finally 与 return 处写事件日志，同时用 inspect.getgeneratorstate 断言状态。' },
      { title: '移动失败时机', body: '分别在函数调用前的普通包装器和生成器体第一行校验参数，比较异常出现的时刻。' },
      { title: '设计可重复 API', body: '让对象保存 generator factory 而非 generator instance，并为每次遍历创建新会话。' }
    ],
    selfCheckQuestion: '为什么调用 generator function 时连函数体第一行都不会执行？这对 API 有什么影响？',
    selfCheckAnswer: '调用阶段只绑定参数并创建保存执行上下文的 generator object，真正解释 frame 由首次 next/send(None) 触发。这样才能实现按需计算，但校验、资源获取和异常也被推迟。若 API 需要立即失败，应在普通外层函数中校验，再返回内部生成器。'
  },
  '暂停帧：指令指针、值栈与异常状态': {
    official: {
      title: 'Data model · Generator objects',
      url: 'https://docs.python.org/3/reference/datamodel.html#generator-objects',
      note: '生成器暂停时会保留局部绑定、指令位置、内部求值栈和异常处理状态，以便恢复后像普通调用一样继续。'
    },
    source: {
      repo: 'python/cpython',
      file: 'Objects/genobject.c',
      symbol: 'gen_send_ex2',
      language: 'c',
      url: 'https://github.com/python/cpython/blob/main/Objects/genobject.c#L260',
      walkthrough: [
        '恢复前把 send 的参数压入保存的 frame 值栈，作为暂停处 yield 表达式的结果。',
        '生成器拥有独立 exc_state；恢复期间临时接入线程异常链，执行结束后再还原调用者的异常状态。',
        '_PyEval_EvalFrame 返回后，CPython 读取 generator_return_kind 区分本次是 yield 还是 return，并校验 frame 状态已经离开 EXECUTING。'
      ],
      code: `static PySendResult
gen_send_ex2(PyGenObject *gen, PyObject *arg, PyObject **presult, int exc)
{
    _PyInterpreterFrame *frame = &gen->gi_iframe;

    PyObject *arg_obj = arg ? arg : Py_None;
    _PyFrame_StackPush(frame,
        PyStackRef_FromPyObjectNew(arg_obj)); // send 值压回暂停帧

    PyThreadState *tstate = _PyThreadState_GET();
    _PyErr_StackItem *previous = tstate->exc_info;
    gen->gi_exc_state.previous_item = previous;
    tstate->exc_info = &gen->gi_exc_state;    // 切换到生成器异常状态

    PyObject *result = _PyEval_EvalFrame(tstate, frame, exc);

    int kind = ((_PyThreadStateImpl *)tstate)->generator_return_kind;
    if (kind == GENERATOR_YIELD) {
        *presult = result;
        return PYGEN_NEXT;
    }
    *presult = result;
    return result ? PYGEN_RETURN : PYGEN_ERROR;
}`
    },
    overview: [
      '生成器能暂停，关键不在保存“下一行行号”，而在保存完整解释器 continuation：下一条指令、局部变量、尚未消费的值栈、异常处理深度和当前异常。只保存源码行无法恢复一个暂停在表达式中间的函数。',
      'CPython 把解释器帧嵌入或关联到 generator object。YIELD_VALUE 交出栈顶值并把 frame 标为 suspended；下一次 send 会把恢复值压回栈，RESUME 后它成为 yield 表达式的计算结果。',
      'gi_running 防止同一生成器重入。生成器执行期间再次 next 自己会破坏同一 frame 的栈与指令状态，因此 CPython 在状态机入口直接拒绝。'
    ],
    mechanisms: [
      'gi_frame/f_frame 暴露调试视角，f_lasti、f_locals 可用于观察但不应改写运行时不变量。',
      'FRAME_CREATED、EXECUTING、SUSPENDED、CLEARED 约束合法转换。',
      'yield 前后可能跨越 try/finally，异常栈也必须随 frame 一起保存。',
      '重入保护属于正确性约束，不只是线程安全优化。'
    ],
    pitfalls: [
      '把生成器理解成保存局部变量的普通对象，忽略半完成表达式和值栈。',
      '依赖某一 Python 版本 f_lasti 的具体偏移或字节码序列，3.11+ 指令与 inline cache 已有显著变化。',
      '在 trace/profile hook 中递归驱动当前生成器，触发 already executing。'
    ],
    example: `import dis
import inspect

def pipeline(seed):
    doubled = seed * 2
    received = yield doubled
    return received + doubled

gen = pipeline(5)
assert inspect.getgeneratorstate(gen) == "GEN_CREATED"
assert next(gen) == 10

frame = gen.gi_frame
assert frame is not None
assert frame.f_locals == {"seed": 5, "doubled": 10}
assert inspect.getgeneratorstate(gen) == "GEN_SUSPENDED"

try:
    gen.send(7)
except StopIteration as stop:
    assert stop.value == 17

dis.dis(pipeline)  # 观察 RETURN_GENERATOR、YIELD_VALUE 与 RESUME`,
    buildSteps: [
      { title: '画状态机', body: '为 CREATED、EXECUTING、SUSPENDED、CLOSED 定义允许的输入和转换，先不执行字节码。' },
      { title: '保存 continuation', body: '用一个简化指令数组、pc、locals 和 value_stack 实现能在 YIELD 暂停的 mini frame。' },
      { title: '加入重入与异常态', body: '运行中拒绝二次 resume，并让 throw 从同一恢复入口携带异常标记进入。' }
    ],
    selfCheckQuestion: '为什么只保存局部变量和源码行号仍不足以恢复生成器？',
    selfCheckAnswer: 'yield 可以位于表达式、try/finally 或委派操作中。恢复还需要知道精确指令位置、尚未完成表达式的值栈、异常处理栈和当前异常；源码行可能对应多条指令，也无法描述栈中间态。完整 frame continuation 才能无歧义继续。'
  },
  'send 注入值与生成器预激': {
    official: {
      title: 'Expressions · generator.send',
      url: 'https://docs.python.org/3/reference/expressions.html#generator.send',
      note: 'send(value) 恢复生成器，并让 value 成为当前 yield 表达式的结果；首次恢复只能发送 None。'
    },
    overview: [
      'yield 同时有两个方向：右侧表达式产生的值向外发送，恢复时 send(value) 又让 value 成为 yield 表达式在生成器内部的结果。把两条方向分开画成时序图，才能避免把“yield 出去的值”和“send 进去的值”混为一谈。',
      '新生成器还没有停在 yield 表达式上，因此非 None 值没有接收位置。next(gen) 与 gen.send(None) 都负责预激，让执行跑到第一个 yield；之后才能发送业务值。',
      '双向 generator 可以实现协作式解析器或状态机，但在现代异步代码中通常由 async/await 提供更清晰的类型边界。理解 send 仍很重要，因为 coroutine 与 await 的底层驱动模型沿用了这套恢复语义。'
    ],
    mechanisms: [
      'value = yield outgoing：首次交出 outgoing，下一次 resume 才给 value 赋值。',
      'next(gen) 是 send(None) 的便利入口。',
      'send 返回的是生成器下一次 yield 的 outward value，而非刚送进去的值。',
      '生成器 return 后 send 同样抛 StopIteration，返回值位于异常 value。'
    ],
    pitfalls: [
      '对 GEN_CREATED 直接 send(non_none)，得到 TypeError。',
      '把 gen.send(command) 当成无返回的消息发送，遗漏它会立刻运行到下一暂停点并返回一个值。',
      '用装饰器偷偷预激生成器，使调用者无法判断资源和副作用何时启动。'
    ],
    example: `def accumulator():
    total = 0
    while True:
        command = yield total
        if command is None:
            return total
        op, value = command
        if op == "add":
            total += value
        elif op == "reset":
            total = value
        else:
            raise ValueError(op)

gen = accumulator()
assert next(gen) == 0          # 预激，并取得第一个 outward value
assert gen.send(("add", 3)) == 3
assert gen.send(("add", 4)) == 7
try:
    gen.send(None)
except StopIteration as stop:
    assert stop.value == 7`,
    buildSteps: [
      { title: '画双向时序', body: '为 caller、generator 两列标出 next、yield outward、send inward、next yield 的先后顺序。' },
      { title: '实现显式状态', body: '写 accumulator 并让每种 command 都产生可断言的新状态，避免只 print。' },
      { title: '覆盖非法输入', body: '测试未预激 send、未知 command、结束后 send 与执行中重入。' }
    ],
    selfCheckQuestion: '为什么 gen.send(x) 的返回值不是 x，而是生成器下一次 yield 的值？',
    selfCheckAnswer: 'x 是当前暂停处 yield 表达式在生成器内部的结果。send 会立即恢复执行，直到生成器再次 yield、return 或抛异常；调用者得到的是这段执行的新 outward 结果。因此 send 同时完成“输入上一暂停点”和“拉取下一暂停点”。'
  },
  'throw、close、GeneratorExit 与清理': {
    official: {
      title: 'Expressions · generator.throw and generator.close',
      url: 'https://docs.python.org/3/reference/expressions.html#generator.throw',
      note: 'throw 在暂停点抛入异常；close 注入 GeneratorExit，并要求生成器结束而不能继续 yield。'
    },
    source: {
      repo: 'python/cpython',
      file: 'Objects/genobject.c',
      symbol: 'gen_close',
      language: 'c',
      url: 'https://github.com/python/cpython/blob/main/Objects/genobject.c#L464',
      walkthrough: [
        'CREATED 与 FINISHED 可直接关闭；EXECUTING 被拒绝，只有 SUSPENDED 能安全注入清理控制流。',
        '若暂停在 yield from，close 先沿委派链关闭子迭代器，防止只清理外层。',
        '随后设置 GeneratorExit 并从同一个 frame evaluation 入口恢复，让 finally 有机会执行。'
      ],
      code: `static PyObject *
gen_close(PyObject *self, PyObject *args)
{
    PyGenObject *gen = _PyGen_CAST(self);
    int8_t state = gen->gi_frame_state;

    if (state == FRAME_CREATED || FRAME_STATE_FINISHED(state))
        Py_RETURN_NONE;
    if (state == FRAME_EXECUTING)
        return gen_raise_already_executing_error(gen), NULL;

    if (state == FRAME_SUSPENDED_YIELD_FROM) {
        PyObject *delegated = /* 从 frame 栈取得当前子迭代器 */;
        gen_close_iter(delegated);            // 先向内传播 close
    }

    PyErr_SetNone(PyExc_GeneratorExit);        // 在 yield 暂停点注入
    return gen_send_ex(gen, Py_None, NULL, 1); // 恢复以运行 finally
}`
    },
    overview: [
      'throw(exc) 把异常当作恢复输入，在当前 yield 表达式处抛出。生成器内部可以捕获、产出恢复值、转换异常或让它继续传播；因此 throw 返回的也是下一次 yield 的值。',
      'close() 是受约束的异常注入：它在暂停点抛 GeneratorExit。生成器可以用 finally 清理，但若捕获后继续 yield，CPython 会报 RuntimeError，因为调用者要求结束而生成器拒绝终止。',
      '资源安全不能只依赖对象析构时自动 close。引用环、实现差异和进程退出都会改变时机；拥有生成器的代码应明确消费完或 close，并优先使用 with/aclosing 表达所有权。'
    ],
    mechanisms: [
      'throw 的现代推荐签名是 throw(exception_instance)，旧三参数形式已逐步弃用。',
      'close 在未启动或已结束生成器上幂等返回。',
      'GeneratorExit 继承 BaseException，普通 except Exception 不会吞掉它。',
      'finally 可以执行清理；捕获 GeneratorExit 后应重新抛出或正常 return。'
    ],
    pitfalls: [
      '用 except BaseException: pass 吞掉 GeneratorExit，然后继续 yield。',
      '把 close 当成强制中断；Python 代码仍会先运行 finally，清理本身也可能失败。',
      '外层生成器关闭时忘记关闭当前委派的子生成器，泄漏内部资源。'
    ],
    example: `events = []

def managed_stream():
    try:
        while True:
            try:
                command = yield "ready"
                events.append(("command", command))
            except ValueError as exc:
                events.append(("recovered", str(exc)))
                yield "recovered"
    finally:
        events.append(("cleanup", True))

gen = managed_stream()
assert next(gen) == "ready"
assert gen.throw(ValueError("bad")) == "recovered"
assert next(gen) == "ready"
gen.close()
assert events[-1] == ("cleanup", True)`,
    buildSteps: [
      { title: '统一恢复入口', body: '让 resume 接受 VALUE 或 EXCEPTION 两种输入，分别把值压栈或在暂停点触发异常。' },
      { title: '实现 close 契约', body: 'close 注入 GeneratorExit；若执行结果再次是 YIELD，则升级为 RuntimeError。' },
      { title: '追踪委派清理', body: '构造 outer yield from inner，两层 finally 都记录事件，断言关闭顺序从内到外。' }
    ],
    selfCheckQuestion: '生成器为什么可以在 finally 中清理，却不能在收到 GeneratorExit 后继续 yield？',
    selfCheckAnswer: 'close 的合同是“让暂停计算终止并完成清理”。finally 必须有运行机会，否则资源会泄漏；继续 yield 则把终止请求变成了新数据输出，使 close 无法保证结束，所以运行时将其视为违反协议并抛 RuntimeError。'
  },
  'yield from 委派状态机与返回值通道': {
    official: {
      title: 'Expressions · yield from',
      url: 'https://docs.python.org/3/reference/expressions.html#yield-expressions',
      note: 'yield from 会转发子迭代器的值与 send/throw/close，并把 StopIteration.value 作为表达式结果。'
    },
    overview: [
      'yield from iterable 远多于 for item in iterable: yield item。它建立一条双向委派通道：调用者的 next/send/throw/close 需要按子迭代器能力转发，子生成器 return 的值还要回到外层继续执行。',
      '若子对象只是普通 iterator，它没有 send 时只有 send(None) 能退化为 next；非 None send 会失败。throw 若无法转发，异常在外层 yield from 表达式处抛出；close 则在子对象提供 close 时先调用它。',
      'PEP 380 的价值是把一大段容易漏分支的代理状态机变成语言结构。理解等价展开后，才能在设计嵌套解析器、任务树和资源清理时判断异常与返回值究竟走哪条通道。'
    ],
    mechanisms: [
      '初始 iter(EXPR) 得到 delegated iterator，随后每个产出直接转给最外层调用者。',
      '子迭代器 StopIteration.value 结束委派，并成为 yield from 表达式的值。',
      '外层 send(None) 驱动 next(sub); send(x) 优先调用 sub.send(x)。',
      'throw 与 close 沿当前委派链传播，finally 通常从最内层开始清理。'
    ],
    pitfalls: [
      '用普通 for 代替 yield from，却期待 send 和 return value 也会自动转发。',
      '认为 yield from 只接受生成器；任何 iterable 都能委派，但双向能力取决于实际 iterator。',
      '子生成器用 raise StopIteration 返回，触发 PEP 479 而破坏返回值通道。'
    ],
    example: `def child():
    total = 0
    while True:
        value = yield total
        if value is None:
            return total
        total += value

def parent():
    result = yield from child()
    yield ("child-returned", result)

gen = parent()
assert next(gen) == 0
assert gen.send(2) == 2
assert gen.send(5) == 7
assert gen.send(None) == ("child-returned", 7)

# 普通 for 只能转发 outward values，无法表达上面的 send 与 return value 通道。`,
    buildSteps: [
      { title: '先实现单向委派', body: '用 for/yield 转发普通 iterator，明确它只覆盖 next 与 outward value。' },
      { title: '补齐双向矩阵', body: '为 next、send(None)、send(value)、throw、close、StopIteration.value 分别写测试和转发分支。' },
      { title: '验证嵌套链', body: '构造三层 delegator，记录 send、异常和 close 到达的顺序，确保返回值逐层回传。' }
    ],
    selfCheckQuestion: '为什么 yield from 的等价实现不能只写成 for value in child: yield value？',
    selfCheckAnswer: 'for 版本只覆盖 next 拉取和向外 yield。完整委派还要把调用者 send 的值送入子生成器、把 throw/close 沿链传播，并把子生成器 StopIteration.value 变成外层表达式结果。遗漏任一分支都会改变协程状态机或资源清理语义。'
  },
  'contextmanager：单次 yield 与异常回注': {
    official: {
      title: 'contextlib.contextmanager',
      url: 'https://docs.python.org/3/library/contextlib.html#contextlib.contextmanager',
      note: 'yield 前对应 __enter__，yield 值绑定给 as；with 块异常会在 yield 位置重新抛入，yield 后负责退出与清理。'
    },
    source: {
      repo: 'python/cpython',
      file: 'Lib/contextlib.py',
      symbol: '_GeneratorContextManager.__enter__ / __exit__',
      language: 'python',
      url: 'https://github.com/python/cpython/blob/main/Lib/contextlib.py#L167',
      walkthrough: [
        '__enter__ 调 next(self.gen) 取得唯一 yield 值；若生成器未 yield 就结束，转成明确 RuntimeError。',
        'with 正常退出时 __exit__ 再 next 一次，并要求立即 StopIteration；第二次 yield 同样是协议错误。',
        'with 块抛异常时 __exit__ 用 gen.throw 把同一异常送回 yield 处，让生成器决定传播、替换或抑制。'
      ],
      code: `class _GeneratorContextManager:
    def __enter__(self):
        try:
            return next(self.gen)          # yield 值就是 with ... as 的值
        except StopIteration:
            raise RuntimeError("generator didn't yield") from None

    def __exit__(self, typ, value, traceback):
        if typ is None:
            try:
                next(self.gen)             # 正常退出：执行 yield 之后的清理
            except StopIteration:
                return False
            raise RuntimeError("generator didn't stop")

        try:
            self.gen.throw(value)          # 异常退出：在 yield 位置回注
        except StopIteration as exc:
            return exc is not value        # 正常结束可表示异常已被处理
        except BaseException as exc:
            if exc is not value:
                raise
            return False`
    },
    overview: [
      '@contextmanager 把一个生成器协议适配成 __enter__/__exit__。yield 之前获取资源，yield 出去的值交给 as，yield 之后释放资源；try/finally 让正常与异常退出共享清理代码。',
      'with 块里的异常不会绕过生成器。适配器调用 gen.throw，把异常精确地抛在 yield 位置，因此生成器可以 except 特定异常并决定是否抑制；若只写 finally，清理后原异常继续传播。',
      '一个 contextmanager 实例是一次性的，因为底层 generator 不能重启。作为装饰器使用时，ContextDecorator 会为每次函数调用重新创建实例，这与“同一实例可重入”是不同能力。'
    ],
    mechanisms: [
      '零次 yield 表示 enter 无法提供资源，抛 generator did not yield。',
      '两次及以上 yield 表示 exit 后仍未停止，抛 generator did not stop。',
      '正常退出通过 next 恢复；异常退出通过 throw 恢复。',
      '是否抑制异常取决于生成器如何结束以及是否重新抛出原异常。'
    ],
    pitfalls: [
      '捕获异常后只记录日志不再 raise，无意中让 with 后继续执行。',
      'yield 两次，误把 contextmanager 当成普通数据生成器。',
      '缓存并复用同一个 context manager 实例，第二次进入时底层 generator 已关闭。'
    ],
    example: `from contextlib import contextmanager

events = []

@contextmanager
def transaction():
    events.append("begin")
    try:
        yield {"connection": "demo"}
    except ValueError:
        events.append("rollback")
        raise                       # 保留原失败语义
    else:
        events.append("commit")
    finally:
        events.append("release")

with transaction() as tx:
    assert tx["connection"] == "demo"

assert events == ["begin", "commit", "release"]`,
    buildSteps: [
      { title: '实现 enter', body: '保存 generator，next 一次取得资源；对零次 yield 给出专门协议错误。' },
      { title: '实现两条 exit', body: '正常路径 next，异常路径 throw；都要求生成器随后结束，并正确返回 suppress 布尔值。' },
      { title: '写行为矩阵', body: '覆盖零次、一次、两次 yield，正常退出，原异常重抛，新异常替换与有意抑制。' }
    ],
    selfCheckQuestion: 'with 块中的异常为什么能被 @contextmanager 函数里 yield 周围的 except 捕获？',
    selfCheckAnswer: '适配器的 __exit__ 收到异常三元组后调用 generator.throw，将异常注入到生成器当前暂停的 yield 表达式处。对生成器而言，yield 就像突然抛出了该异常，所以周围 except/finally 会按普通控制流运行。'
  },
  'awaitable 与 __await__ 迭代协议': {
    official: {
      title: 'Data model · Awaitable Objects',
      url: 'https://docs.python.org/3/reference/datamodel.html#awaitable-objects',
      note: '__await__ 必须返回 iterator；事件循环驱动这个 iterator，直到 StopIteration.value 成为 await 表达式结果。'
    },
    overview: [
      'await obj 需要 obj 是 native coroutine 或提供 __await__ 的 awaitable。__await__ 返回一个 iterator，异步运行时像驱动生成器一样反复 send/throw；iterator 暂停时交出的对象由运行时解释，结束时 StopIteration.value 成为 await 结果。',
      'await 自身不会创建线程，也不会自动让任意慢函数并发。它把当前 coroutine 的 continuation 暂停，并把控制权交给调度器；只有被等待对象在无法立刻完成时真正挂起，其他任务才有机会运行。',
      'native coroutine 故意不实现普通 __iter__/__next__，避免被 for 或 list 意外消费。协议复用了生成器的驱动机制，同时通过独立类型边界表达“这个暂停点必须由异步运行时管理”。'
    ],
    mechanisms: [
      '__await__ 每次调用应返回符合 iterator 协议的对象，常见写法是内部生成器的 __await__。',
      'Future.__await__ 未完成时向事件循环 yield 自身，完成后返回 result 或抛保存的异常。',
      'coroutine.send/throw/close 与 generator 对应，但 coroutine 不能直接普通迭代。',
      '已完成的 native coroutine 不能再次 await，否则 RuntimeError。'
    ],
    pitfalls: [
      '自定义 __await__ 直接返回 list，而非 iterator。',
      '在 async def 里调用阻塞 IO 后再写 await，以为关键词会把此前阻塞变成非阻塞。',
      '复用同一个 coroutine object；应再次调用 coroutine function 创建新对象。'
    ],
    example: `class Immediate:
    def __init__(self, value):
        self.value = value

    def __await__(self):
        # 含 yield 的函数才会产生 iterator；不可达 yield 保留协议形状。
        if False:
            yield None
        return self.value

async def compute():
    first = await Immediate(20)
    second = await Immediate(22)
    return first + second

driver = compute().__await__()
try:
    next(driver)
except StopIteration as stop:
    assert stop.value == 42`,
    buildSteps: [
      { title: '手驱 coroutine', body: '取得 coro.__await__()，用 next/send 驱动到 StopIteration.value，先理解无调度器版本。' },
      { title: '实现 MiniFuture', body: '保存 PENDING/DONE、result/exception 与 callbacks；__await__ 在 pending 时 yield self。' },
      { title: '实现最小调度器', body: '任务遇到 MiniFuture 就注册恢复回调，future 完成后把结果 send 回 coroutine。' }
    ],
    selfCheckQuestion: 'await 为什么可以理解为受异步运行时约束的 yield from，却不能简单等同于“开启并发”？',
    selfCheckAnswer: 'await 通过 __await__ iterator 委派并暂停当前 continuation，这与生成器委派机制相近；是否有其他任务运行取决于事件循环、被等待对象是否真的未完成以及调度策略。等待一个立即完成对象不会产生并发，等待前执行的阻塞代码仍会阻塞线程。'
  },
  '异步迭代：__aiter__、__anext__ 与 StopAsyncIteration': {
    official: {
      title: 'Data model · Asynchronous Iterators',
      url: 'https://docs.python.org/3/reference/datamodel.html#asynchronous-iterators',
      note: '__aiter__ 返回异步 iterator；__anext__ 返回 awaitable，最终产生下一项或抛 StopAsyncIteration。'
    },
    overview: [
      '同步 iterator 的 next 必须立即给值或结束，无法在等待网络数据时让出控制权。异步 iterator 把“取下一项”建模为 awaitable：async for 每轮先取 __anext__()，再 await 它，因此等待期间事件循环可以运行其他任务。',
      '__aiter__ 从 Python 3.7 起必须直接返回 asynchronous iterator，不能返回一个最终解析为 iterator 的 awaitable。__anext__ 的 awaitable 以正常返回值表示数据，以 StopAsyncIteration 表示结束。',
      '异步 iterable 与异步 iterator 仍有可重复/一次性的区别。数据库查询对象可以每次 __aiter__ 创建新 cursor；async generator object 通常就是一次性 iterator。'
    ],
    mechanisms: [
      'async for 展开为 iterator = type(obj).__aiter__(obj)，随后反复 await type(iterator).__anext__(iterator)。',
      'StopAsyncIteration 是独立结束信号，避免普通 StopIteration 与 coroutine 驱动协议冲突。',
      'anext(iterator, default) 提供与 next 类似的默认结束值。',
      '循环 break 不保证任意自定义异步 iterator 自动释放资源，所有权应通过 async with 或显式 aclose 表达。'
    ],
    pitfalls: [
      '把 __aiter__ 写成 async def 并 return self，现代 Python 得到 coroutine 而非 async iterator。',
      '__anext__ 在结束时 return None，导致无限产生 None；必须 raise StopAsyncIteration。',
      'async for 提前 break 后假设所有底层 cursor 都已关闭。'
    ],
    example: `import asyncio

class AsyncRange:
    def __init__(self, stop):
        self.current = 0
        self.stop = stop

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self.current >= self.stop:
            raise StopAsyncIteration
        await asyncio.sleep(0)  # 模拟一次可让出控制权的异步读取
        value = self.current
        self.current += 1
        return value

async def collect():
    result = []
    async for value in AsyncRange(3):
        result.append(value)
    return result

assert asyncio.run(collect()) == [0, 1, 2]`,
    buildSteps: [
      { title: '展开 async for', body: '显式调用 aiter/anext 并捕获 StopAsyncIteration，观察每轮都 await 一个取数操作。' },
      { title: '分离 query 与 cursor', body: '让 query.__aiter__ 创建独立异步 cursor，验证两个消费者互不共享进度。' },
      { title: '加入资源所有权', body: '为 cursor 增加 aclose 与 async context manager，在正常、break、异常、取消四条路径断言关闭。' }
    ],
    selfCheckQuestion: '为什么 __anext__ 要返回 awaitable，而 __aiter__ 从 Python 3.7 起反而必须直接返回 iterator？',
    selfCheckAnswer: '真正可能等待的是每一次取数，所以异步边界放在 __anext__ 最清晰；获取遍历会话本身保持同步，async for 能立即拿到稳定协议对象。早期允许异步 __aiter__ 增加了展开规则和兼容复杂度，后来被收紧。'
  },
  '异步生成器的背压、取消与 aclose': {
    official: {
      title: 'Expressions · Asynchronous generator functions',
      url: 'https://docs.python.org/3/reference/expressions.html#asynchronous-generator-functions',
      note: 'async def 中使用 yield 创建 asynchronous generator；通过 __anext__/asend/athrow/aclose 驱动，并以 StopAsyncIteration 结束。'
    },
    source: {
      repo: 'python/cpython',
      file: 'Objects/genobject.c',
      symbol: 'async_gen_asend_send',
      language: 'c',
      url: 'https://github.com/python/cpython/blob/main/Objects/genobject.c#L1974',
      walkthrough: [
        '每个 __anext__/asend 调用创建一次 awaitable 会话；会话关闭后不能再次 await。',
        'ag_running_async 阻止两个消费者同时恢复同一异步生成器，保护唯一暂停 frame。',
        '恢复结果经 async_gen_unwrap_value 转换：异步生成器产出值与等待期间向事件循环 yield 的对象需要分开编码。'
      ],
      code: `static PyObject *
async_gen_asend_send(PyObject *self, PyObject *arg)
{
    PyAsyncGenASend *request = _PyAsyncGenASend_CAST(self);

    if (request->ags_state == AWAITABLE_STATE_CLOSED)
        return PyErr_Format(PyExc_RuntimeError,
                            "cannot reuse already awaited __anext__()/asend()");

    if (request->ags_state == AWAITABLE_STATE_INIT) {
        if (request->ags_gen->ag_running_async)
            return PyErr_Format(PyExc_RuntimeError,
                                "anext(): asynchronous generator is already running");
        request->ags_state = AWAITABLE_STATE_ITER;
    }

    request->ags_gen->ag_running_async = 1;   // 同一 frame 只能有一个驱动者
    PyObject *result = gen_send((PyObject *)request->ags_gen, arg);
    result = async_gen_unwrap_value(request->ags_gen, result);
    if (result == NULL)
        request->ags_state = AWAITABLE_STATE_CLOSED;
    return result;
}`
    },
    overview: [
      '异步生成器把 await 与 yield 放进同一个函数：await 处理上游数据尚未到达，yield 把一项交给下游。下游每次 await anext 才驱动生产者到下一项，因此在单消费者拉取模型里天然形成一项一确认的背压。',
      '天然背压有边界。若生产者内部先把数据读进无界队列，真正的缓冲发生在队列，async generator 只能控制出队速度；需要为队列设置 maxsize，并让上游 await put 才能把压力继续向源头传播。',
      '取消会在当前 await 暂停点抛 CancelledError；提前结束还需要 aclose 注入 GeneratorExit 以运行 finally。contextlib.aclosing 能把异步生成器的生命周期绑定到 async with，确保 break 与异常也在相同上下文内清理。'
    ],
    mechanisms: [
      '__anext__ 返回一次性 awaitable；完成后不能重复 await 同一个请求对象。',
      'asend(value)、athrow(exc)、aclose() 是同步 generator 双向方法的异步版本。',
      '运行中保护禁止并发 anext 同一个对象；广播需求应在外部 fan-out，而非共享一个 cursor。',
      '有界 asyncio.Queue 把消费速度反向传递给生产任务，是显式可量化的背压边界。'
    ],
    pitfalls: [
      '两个 task 同时调用 anext(gen)，触发 already running 或产生未定义的业务所有权。',
      '使用无界 Queue 后宣称系统有背压，实际只是把压力变成内存增长。',
      '消费者 break 后没有 aclose，导致生成器 finally 与上下文变量清理延后。'
    ],
    example: `import asyncio
from contextlib import aclosing

async def stream(queue):
    try:
        while True:
            item = await queue.get()
            if item is None:
                return
            try:
                yield item
            finally:
                queue.task_done()
    finally:
        # 真实系统在这里关闭 cursor、响应体或订阅。
        events.append("stream-closed")

async def demo():
    queue = asyncio.Queue(maxsize=1)
    await queue.put("first")
    events.clear()
    async with aclosing(stream(queue)) as values:
        async for value in values:
            assert value == "first"
            break
    assert events == ["stream-closed"]

events = []
asyncio.run(demo())`,
    buildSteps: [
      { title: '先做拉取模型', body: '每次 anext 只生产一项，记录请求、产出和消费者处理完成的时间线。' },
      { title: '加入有界缓冲', body: '在生产者与生成器间放 maxsize=1 的 Queue，证明第二次 put 会等到下游取走。' },
      { title: '完成取消矩阵', body: '覆盖 break、consumer cancel、producer error、normal EOF，并断言 aclose/finally/queue.task_done 的次数。' }
    ],
    selfCheckQuestion: '异步生成器为什么常有自然背压，却仍可能把系统内存撑爆？',
    selfCheckAnswer: '拉取模型中，下游每次 anext 才驱动一项产出，所以生成器边界本身按消费速度前进；若上游另有任务持续写入无界队列、网络缓冲或批量缓存，压力已在到达生成器前被吸收。只有所有中间缓冲有界，并让写入者在满时 await，背压才能传回数据源。'
  }
}
