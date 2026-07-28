import type { TopicGuide } from '../../topic-guides'

export const pythonFunctionGuides: Record<string, TopicGuide> = {
  '函数对象：code、globals、defaults 与 closure': {
    official: {
      title: 'Data model · User-defined functions',
      url: 'https://docs.python.org/3/reference/datamodel.html#user-defined-functions',
      note: '函数对象把无上下文 code object 与定义环境组合起来；globals、defaults、kwdefaults 和 closure 都属于函数对象。'
    },
    overview: [
      'def 是可执行语句：它先取得编译好的 code object，再把当前模块 globals、默认值、闭包 cell、名称和元数据封装成函数对象，最后把名称绑定到该函数。函数体要到调用时才建立 frame 并执行。',
      '同一个 code object 可以与不同 globals 或 closure 组合成行为不同的函数。反过来，修改函数.__defaults__、__kwdefaults__ 或 closure cell 会改变后续调用，却不改变 bytecode；这解释了“代码相同”不等于“函数行为相同”。',
      '默认表达式在 def 执行时求值并存进函数对象；全局名称在调用时通过 function.__globals__ 解析；自由变量从 function.__closure__ 中的 cell 读取。三种值拥有不同的捕获时机。'
    ],
    mechanisms: [
      '__code__ 保存指令、常量和名称表，不持有模块运行上下文。',
      '__globals__ 指向定义函数的模块字典，而非调用者模块。',
      '__defaults__ 只保存末尾位置参数默认值，__kwdefaults__ 保存关键字专用默认值。',
      '__closure__ 与 code.co_freevars 按位置对应，每个元素是可共享、可变绑定的 cell。'
    ],
    pitfalls: [
      '把默认值放进 code.co_consts，忽略默认表达式可在每次 def 执行时产生新对象。',
      '认为把函数传到另一个模块会改用新模块 globals；函数持续引用定义模块。',
      '序列化函数时只保存源码，遗漏 globals、closure 与版本依赖。'
    ],
    example: `import types

FACTOR = 2

def scale(value, offset=1):
    return value * FACTOR + offset

assert scale.__defaults__ == (1,)
assert scale.__globals__ is globals()
assert scale.__closure__ is None

# 同一 code object 配上另一份 globals，行为随环境改变。
other_globals = {"FACTOR": 10, "__builtins__": __builtins__}
other_scale = types.FunctionType(scale.__code__, other_globals, "other_scale", (1,))
assert scale(3) == 7
assert other_scale(3) == 31`,
    buildSteps: [
      { title: '拆开函数四个组成部分', body: '分别观察 __code__、__globals__、__defaults__、__closure__，给每个字段标注求值时机。' },
      { title: '复用 code object', body: '用 types.FunctionType 配置另一份 globals 和 defaults，证明 bytecode 与执行环境可以分离。' },
      { title: '修改一项做差分', body: '只改变 defaults、globals 或 cell 中的一项，保持 code 身份不变，记录行为差异。' }
    ],
    selfCheckQuestion: '为什么默认参数属于函数对象，而字符串和数字字面量通常出现在 code.co_consts？',
    selfCheckAnswer: '字面量是编译期指令的组成部分；默认表达式在 def 语句实际执行时求值，可能调用函数、读取当前名称或创建可变对象。求值结果必须随这次函数对象创建保存，因此放在 __defaults__/__kwdefaults__，而非无上下文的 code object。'
  },
  'code object、常量表与名称表': {
    official: {
      title: 'Data model · Code objects',
      url: 'https://docs.python.org/3/reference/datamodel.html#code-objects',
      note: 'code object 表示已编译、无执行上下文的 Python 代码；co_consts、co_names、co_varnames 与字节码操作数共同解释指令。'
    },
    overview: [
      'code object 是不可变编译产物。co_code 保存编码后的指令流，dis 模块把它解释为 opcode；许多指令参数只是索引，真正对象位于 co_consts、co_names、co_varnames 等并行表。',
      'LOAD_CONST i 从 co_consts[i] 取字面量或嵌套 code；LOAD_GLOBAL/LOAD_ATTR 等名称类指令引用 co_names；LOAD_FAST 引用局部变量布局。理解索引表后，字节码不再是神秘助记符。',
      '嵌套 def 的函数对象尚未在外层 code 中存在，外层 co_consts 保存的是内层 code object。执行 MAKE_FUNCTION 时才把它与当时的 defaults、closure 和 globals 组合起来。'
    ],
    mechanisms: [
      'co_consts 包含字面量、文档字符串以及嵌套函数的 code object。',
      'co_names 保存由全局、属性和导入相关指令引用的名称。',
      'co_varnames 以参数开头，随后是编译器分配的局部名称。',
      '行号和异常表把指令偏移映射到源码位置和异常处理区间，供 traceback 与调试器使用。'
    ],
    pitfalls: [
      '用字节偏移硬解析新版本 bytecode，忽略 inline cache 和指令格式会演进。',
      '把 co_names 中出现的名称都当成 globals，属性名和导入名也会进入同一表。',
      '修改 code.replace 后只测试返回值，没有验证闭包数量、异常表和调试信息仍一致。'
    ],
    example: `import dis
import types

LIMIT = 10

def clamp(value):
    return min(value, LIMIT)

code = clamp.__code__
assert "min" in code.co_names
assert "LIMIT" in code.co_names
assert "value" in code.co_varnames

for instruction in dis.get_instructions(clamp):
    print(instruction.opname, instruction.argrepr)

assert isinstance(code, types.CodeType)`,
    buildSteps: [
      { title: '从 dis 反查索引表', body: '对每条 LOAD_CONST/LOAD_GLOBAL/LOAD_FAST 记录 arg，并在对应 co_* 表中定位真实值。' },
      { title: '加入嵌套函数', body: '在 co_consts 中找到内层 code object，再观察 MAKE_FUNCTION 何时创建函数对象。' },
      { title: '比较版本边界', body: '只依赖 dis.Instruction 公共字段完成分析器，避免把 opcode 数值和 cache 布局写死。' }
    ],
    selfCheckQuestion: '为什么 code object 可以被多个函数复用，却不能独立完成一次正常函数调用？',
    selfCheckAnswer: '它只有指令和编译期元数据，没有 globals、defaults、closure 等解析运行时名称所需的环境。函数对象把 code 与定义环境组合，调用时再创建 frame 和局部参数绑定。'
  },
  'frame、fast locals 与局部变量同步': {
    official: {
      title: 'Data model · Frame objects',
      url: 'https://docs.python.org/3/reference/datamodel.html#frame-objects',
      note: 'frame 表示一次执行状态，连接 code、globals、builtins、局部槽位、指令位置与调用链；locals 映射的写回语义受作用域和版本约束。'
    },
    overview: [
      '每次函数调用都会获得一份 frame 执行状态。相同函数递归调用时共享 code 和 globals，却拥有独立参数、局部变量、指令位置和调用者链接，这些差异都由 frame 承载。',
      'CPython 为优化函数局部访问，把编译期确定的名称放进连续 locals-plus 槽位，LOAD_FAST/STORE_FAST 直接按索引操作，而非每次查字典。f_locals 或 locals() 是面向反射的映射视图，不能简单等同于解释器热路径存储。',
      '调试器、trace 和 exec 需要在槽位与映射之间建立一致语义。现代 Python 对优化作用域 locals 的写入行为逐步标准化，但业务代码仍不应靠修改 locals() 改写真实局部变量。'
    ],
    mechanisms: [
      'frame.f_code 指向共享 code，f_globals/f_builtins 提供名称解析环境。',
      'co_varnames 与 locals-plus 槽位索引对应，LOAD_FAST 避免哈希查找。',
      '闭包 cell 也位于 frame 的 locals-plus 区域，但通过 LOAD_DEREF 访问。',
      '生成器和协程暂停时保留 frame 状态，普通函数返回后 frame 通常可释放，traceback 可能继续持有它。'
    ],
    pitfalls: [
      '在函数内修改 locals()["x"] 并期待后续 LOAD_FAST 读取新值。',
      '长期保存 frame 或 traceback 做调试缓存，间接保留整个局部对象图造成泄漏。',
      '把 CPython frame 私有布局当成跨版本扩展 ABI。'
    ],
    example: `import inspect

def snapshot(a, b):
    total = a + b
    frame = inspect.currentframe()
    assert frame is not None
    view = frame.f_locals
    return {
        "code": frame.f_code.co_name,
        "locals": dict(view),
        "last_instruction": frame.f_lasti,
    }

state = snapshot(2, 3)
assert state["locals"]["total"] == 5
assert state["code"] == "snapshot"`,
    buildSteps: [
      { title: '比较递归 frame', body: '递归调用同一函数，记录 f_code 身份相同、f_locals 和 f_lasti 各自独立。' },
      { title: '对照 LOAD_FAST', body: '用 dis 把 co_varnames 索引与局部变量指令对应，解释为何局部读取无需 dict。' },
      { title: '复现 frame 泄漏', body: '让异常 traceback 持有大对象，清理 traceback 后比较 weakref/tracemalloc，理解调试信息的所有权。' },
      { title: '阅读 locals 同步入口', body: '沿 frameobject.c 和内部 frame API 定位 locals 映射物化，不把某版本结构偏移写进实现。' }
    ],
    selfCheckQuestion: '为什么 CPython 不直接用普通 dict 保存和读取函数局部变量？',
    selfCheckAnswer: '局部名称在编译期已确定，连续槽位可用整数索引直接访问，避免每条 LOAD_FAST 做字符串哈希与字典探测。反射需要的 locals 映射可以按需物化或代理；代价是调试器和 exec 必须处理槽位与映射的一致性。'
  },
  'closure cell、cellvars 与 freevars': {
    official: {
      title: 'Execution model · Naming and binding',
      url: 'https://docs.python.org/3/reference/executionmodel.html#naming-and-binding',
      note: '嵌套函数引用外层局部名称时，外层名称成为 cell variable，内层对应为 free variable；函数 closure 保存共享绑定 cell。'
    },
    overview: [
      '闭包捕获的不是一次值复制，而是一格可共享绑定。编译器发现内层函数引用外层局部名称后，把外层名称从普通 fast local 提升为 cell；创建内层函数时，把该 cell 放入 __closure__。',
      '同一外层调用产生的多个内层函数可共享一个 cell，所以 nonlocal 修改会被全部观察到。不同外层调用则创建不同 cell，形成互相隔离的状态实例。',
      'code.co_cellvars 描述本函数创建、供内层使用的名称；code.co_freevars 描述本函数需要从外层接收的名称。function.__closure__ 的 cell 顺序与 co_freevars 一一对应。'
    ],
    mechanisms: [
      'MAKE_CELL/COPY_FREE_VARS 等指令准备 cell 环境，LOAD_DEREF/STORE_DEREF 读取或修改绑定。',
      'cell 保存对象引用，不执行深拷贝，因此捕获可变对象仍有别名语义。',
      'nonlocal 在编译期要求找到已有外层绑定，不能凭空创建。',
      '删除 cell 绑定后读取可产生 NameError/空 cell 状态，cell 对象本身仍可存在。'
    ],
    pitfalls: [
      '把 closure 解释成函数源码文本或整份外层 locals 快照。',
      '循环中创建多个 lambda 时以为每次自动复制循环变量。',
      '用可变闭包状态实现跨请求缓存，却没有并发、重入和清理合同。'
    ],
    example: `def make_counter():
    count = 0

    def increment():
        nonlocal count
        count += 1
        return count

    def current():
        return count

    return increment, current

increment, current = make_counter()
assert increment.__closure__[0] is current.__closure__[0]
assert increment() == 1
assert current() == 1
assert increment.__code__.co_freevars == ("count",)`,
    buildSteps: [
      { title: '观察 cell 身份', body: '返回两个读取同一外层名称的函数，比较对应 __closure__ 元素是否为同一对象。' },
      { title: '对照 cellvars/freevars', body: '外层 code.co_cellvars 与内层 code.co_freevars 使用同一名称但描述不同责任。' },
      { title: '实现 nonlocal 状态机', body: '让一个函数写 cell、另一个函数读 cell，并补两个独立 factory 调用的隔离测试。' }
    ],
    selfCheckQuestion: '为什么同一个 factory 返回的两个闭包能共享状态，而两次 factory 调用返回的闭包不会互相影响？',
    selfCheckAnswer: '一次外层调用为 cell variable 创建一组运行时 cell，并把相同 cell 交给本次创建的内层函数；下一次调用拥有新的 frame 和新的 cell。共享边界由外层调用实例决定，而非由 code object 决定。'
  },
  'late binding 与默认参数早绑定': {
    official: {
      title: 'Function definitions · Default parameter evaluation',
      url: 'https://docs.python.org/3/reference/compound_stmts.html#function-definitions',
      note: '默认表达式在 def 执行时从左到右求值一次；闭包自由变量则在函数调用时通过共享 cell 读取当前绑定。'
    },
    overview: [
      '循环闭包的 late binding 来自多个函数共享循环变量 cell，调用时才 LOAD_DEREF。循环结束后 cell 保存最终值，所以所有函数看到同一结果。它与 lambda 没有特殊关系，嵌套 def 完全相同。',
      '把 i 写成默认参数 i=i 会在每次 def/lambda 创建时求值右侧并存入各自 __defaults__，调用时从参数默认槽取值，因此形成早绑定快照。该修复适合不可变值；若捕获的是可变对象，仍然共享该对象。',
      '另一种更明确的修复是 factory(i) 每次调用创建新的 cell。选择默认参数还是 factory，取决于 i 是否属于公开签名和后续是否需要 nonlocal 修改。'
    ],
    mechanisms: [
      'late binding 路径：循环变量成为 cell，所有 closure 保存相同 cell 身份。',
      '默认参数路径：定义函数时求值，结果分别保存在每个函数对象的 __defaults__。',
      'factory 路径：每次外层调用创建独立 frame/cell。',
      'functools.partial 也能提前固定实参，但返回对象的反射表面与普通函数不同。'
    ],
    pitfalls: [
      '只说“lambda 延迟执行”，没有解释共享 cell 和 LOAD_DEREF。',
      '用默认空 list 捕获状态，修复整数问题后引入跨调用可变默认值。',
      '为了隐藏 late binding 滥用默认参数，使本不该公开的参数出现在签名中。'
    ],
    example: `late = [lambda: i for i in range(3)]
assert [fn() for fn in late] == [2, 2, 2]
assert len({id(fn.__closure__[0]) for fn in late}) == 1

early = [lambda i=i: i for i in range(3)]
assert [fn() for fn in early] == [0, 1, 2]
assert [fn.__defaults__ for fn in early] == [(0,), (1,), (2,)]

def factory(value):
    return lambda: value

isolated = [factory(i) for i in range(3)]
assert len({id(fn.__closure__[0]) for fn in isolated}) == 3`,
    buildSteps: [
      { title: '先证明共享 cell', body: '比较循环创建函数的 closure cell 身份，再修改或结束循环观察所有结果。' },
      { title: '用默认参数固定值', body: '观察每个函数的 __defaults__，解释定义期求值如何绕过 cell。' },
      { title: '用 factory 创建独立 cell', body: '比较两种修复的签名、可变状态能力和可读性，选择符合 API 合同的方案。' }
    ],
    selfCheckQuestion: '默认参数 i=i 为什么能修复循环闭包，却不能被简单描述为“复制变量”？',
    selfCheckAnswer: '右侧 i 在函数定义执行时求值得到对象引用，结果存进新函数自己的 __defaults__；调用时参数绑定使用该默认值，不再读取循环变量 cell。对整数看起来像复制值，对可变对象仍只是复制引用。'
  },
  '参数绑定：positional-only、keyword-only、*args 与 **kwargs': {
    official: {
      title: 'Expressions · Calls',
      url: 'https://docs.python.org/3/reference/expressions.html#calls',
      note: '调用先展开位置和关键字实参，再按参数种类绑定；重复赋值、未知关键字、缺失必需参数和位置参数过多都会失败。'
    },
    overview: [
      '参数绑定是把调用端的 args/kwargs 映射到函数签名槽位。参数种类依次包括 positional-only、positional-or-keyword、var-positional、keyword-only、var-keyword；每类都决定名称能否由位置或关键字提供。',
      '绑定要在函数体运行前完成，因此错误不会进入用户代码。一个参数若同时被位置和关键字赋值会报 multiple values；没有 **kwargs 时未知关键字报错；没有 *args 时多余位置参数报错。',
      'inspect.Signature.bind 提供与调用语义一致的公共模型，适合路由器、依赖注入和 RPC 层。自己拼 zip(args, parameter_names) 会遗漏位置专用、关键字专用和重复绑定。'
    ],
    mechanisms: [
      '"/" 之前参数只能按位置传递，允许 **kwargs 中出现同名业务键而不冲突。',
      '"*" 之后参数只能按关键字传递，使调用意图稳定且便于扩展。',
      '*args 总是 tuple，**kwargs 为新 dict，只接收未被正式参数消费的实参。',
      'defaults 在绑定缺失参数时填入；Signature.bind 后需 apply_defaults 才会显式出现在 mapping。'
    ],
    pitfalls: [
      '包装器用 *args/**kwargs 接收一切，却丢失原函数签名和静态工具支持。',
      '把 bind_partial 用于真实调用校验，允许必需参数缺失后在更远处失败。',
      'RPC 参数名直接映射 Python 签名，升级时把位置参数改名造成不必要兼容破坏。'
    ],
    example: `from inspect import signature

def request(method, path, /, timeout=3, *, retries=0, **metadata):
    return method, path, timeout, retries, metadata

sig = signature(request)
bound = sig.bind("GET", "/health", retries=2, trace_id="abc")
bound.apply_defaults()

assert bound.arguments == {
    "method": "GET",
    "path": "/health",
    "timeout": 3,
    "retries": 2,
    "metadata": {"trace_id": "abc"},
}
assert request(*bound.args, **bound.kwargs)[3] == 2`,
    buildSteps: [
      { title: '建立参数种类表', body: '为五种 Parameter.kind 写一个签名，并标注位置、关键字和收集行为。' },
      { title: '实现最小 binder', body: '先绑定 positional-only 与 positional-or-keyword，再加入重复检测、defaults、*args 和 **kwargs。' },
      { title: '与 Signature.bind 差分', body: '覆盖成功、重复赋值、缺失、未知关键字和多余位置参数，比较异常类别。' }
    ],
    selfCheckQuestion: '为什么 positional-only 参数能让一个 API 在不破坏调用者的前提下重命名参数？',
    selfCheckAnswer: '调用者只能按位置提供该参数，从未依赖其名称；名称只是实现内部局部绑定。若参数允许关键字调用，名称就成为公共 API，重命名会破坏现有调用。'
  },
  '装饰器求值、应用顺序与带参装饰器': {
    official: {
      title: 'Function definitions · Decorators',
      url: 'https://docs.python.org/3/reference/compound_stmts.html#function-definitions',
      note: 'decorator expressions 在定义函数时由上到下求值；得到的 callable 在函数创建后由下到上嵌套应用。'
    },
    overview: [
      '装饰器包含两个时间轴。`@factory(arg)` 表达式在 def 所在作用域立即求值，用于准备 decorator；函数对象创建后，最靠近 def 的 decorator 先接收函数，返回值再交给上一层。',
      '@outer @inner def f 等价于 f = outer(inner(f))，但原函数不会先临时绑定到 f。带参装饰器因此有三层调用：factory(config) 在定义期，decorator(function) 在定义期，wrapper(*args) 在每次调用期。',
      '装饰器可以返回任意对象，函数名称最终绑定的是返回值。缓存、注册和权限装饰器若在导入期产生副作用，要考虑重复导入、测试隔离和进程启动顺序。'
    ],
    mechanisms: [
      '表达式求值顺序自上而下，应用顺序自下而上；两者不能混为一个顺序。',
      '闭包装饰器把配置保存在 factory 创建的 cell 中。',
      '类装饰器和 callable object 也可作为 decorator，返回值无需是 function。',
      '定义期注册表修改属于 import side effect，应设计幂等键与冲突检测。'
    ],
    pitfalls: [
      '只背 outer(inner(f))，却在有副作用 factory 时预测错求值日志顺序。',
      'decorator 在模块导入期连接网络或读取不可控环境，测试和 CLI 启动变脆弱。',
      '同一函数被重复注册时静默覆盖，reload 后路由表行为不确定。'
    ],
    example: `events = []

def factory(name):
    events.append(f"evaluate:{name}")
    def decorate(fn):
        events.append(f"apply:{name}")
        def wrapper(*args, **kwargs):
            events.append(f"call:{name}")
            return fn(*args, **kwargs)
        return wrapper
    return decorate

@factory("outer")
@factory("inner")
def work():
    return "ok"

assert events == [
    "evaluate:outer", "evaluate:inner",
    "apply:inner", "apply:outer",
]
assert work() == "ok"
assert events[-2:] == ["call:outer", "call:inner"]`,
    buildSteps: [
      { title: '记录三阶段事件', body: '分别记录 factory 求值、decorator 应用和 wrapper 调用，禁止只靠记忆判断顺序。' },
      { title: '展开等价赋值', body: '手写 decorators = [outer, inner] 与反向应用，比较日志和最终返回对象。' },
      { title: '实现幂等注册器', body: '用稳定 key 注册函数，重复同对象允许、冲突对象报错，并为 reload 写测试。' }
    ],
    selfCheckQuestion: '为什么多个装饰器的“表达式求值顺序”和“应用顺序”方向相反？',
    selfCheckAnswer: '解释器先按源码从上到下求值每个 decorator expression，保存 callable；函数对象创建后要构成 outer(inner(function))，所以必须从最靠近 def 的 inner 开始向外折叠。'
  },
  'functools.wraps、__wrapped__ 与签名保真': {
    official: {
      title: 'functools · update_wrapper and wraps',
      url: 'https://docs.python.org/3/library/functools.html#functools.wraps',
      note: 'wraps 通过 update_wrapper 复制关键元数据并设置 __wrapped__；inspect.signature 等工具会沿该链恢复原 callable。'
    },
    overview: [
      '普通 wrapper(*args, **kwargs) 在运行上能转发调用，却把 __name__、__qualname__、__doc__、__annotations__ 和签名表面替换成 wrapper 自身。日志、依赖注入、API 文档和序列化可能因此把所有端点看成同一个函数。',
      'functools.wraps 复制面向观察者的元数据，并设置 __wrapped__ 指向被包装对象。inspect.unwrap 与 inspect.signature 默认沿这条链找到原始 callable；它不会自动让 wrapper 获得编译期完全相同的真实参数布局。',
      '需要改变公开签名的装饰器应显式设置 __signature__ 或返回拥有新协议的对象，同时对类型检查器使用 ParamSpec/TypeVar。保留旧签名与声称新行为之间必须一致。'
    ],
    mechanisms: [
      'WRAPPER_ASSIGNMENTS 默认复制 module、name、qualname、doc、annotations、type params 等。',
      'WRAPPER_UPDATES 默认更新 wrapper.__dict__，保留装饰器自身状态同时继承被包装元数据。',
      '__wrapped__ 形成可递归链，并允许工具选择是否 follow_wrapped。',
      'wraps 只处理运行时反射；静态类型和真实调用校验仍需相应签名设计。'
    ],
    pitfalls: [
      '缓存和路由用 wrapper.__name__ 作唯一键，未使用 wraps 时多个函数全部叫 wrapper。',
      'wrapper 实际增加必需参数，却仍暴露原签名，文档和调用错误信息误导。',
      '多层装饰器中某一层漏掉 __wrapped__，后续工具无法穿透完整链。'
    ],
    example: `from functools import wraps
from inspect import signature, unwrap

def traced(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        print(f"call {fn.__qualname__}")
        return fn(*args, **kwargs)
    return wrapper

@traced
def add(left: int, right: int = 0) -> int:
    """Return a sum."""
    return left + right

assert add.__name__ == "add"
assert str(signature(add)) == "(left: int, right: int = 0) -> int"
assert unwrap(add).__name__ == "add"`,
    buildSteps: [
      { title: '先观察破坏', body: '不使用 wraps 装饰两个不同签名函数，记录名称、文档、annotations 和 signature 如何丢失。' },
      { title: '实现迷你 update_wrapper', body: '复制 assigned 字段、更新 __dict__ 并设置 __wrapped__，与 functools.wraps 做差分。' },
      { title: '验证多层链', body: '组合三个装饰器，使用 inspect.unwrap 和 signature 检查每层都保持可穿透。' }
    ],
    selfCheckQuestion: 'functools.wraps 为什么不能保证 wrapper 的真实调用协议与原函数完全相同？',
    selfCheckAnswer: '它主要复制元数据并提供 __wrapped__ 供反射工具恢复原签名，wrapper 本身的 code object 仍可能只有 *args/**kwargs，甚至改变参数或返回行为。协议一致性还需要实现、类型注解和必要时的 __signature__ 共同保证。'
  }
}
