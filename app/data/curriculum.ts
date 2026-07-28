export type TrackId = 'python' | 'typescript' | 'langchain' | 'langgraph' | 'deepagents' | 'nuxt' | 'transformer' | 'torch' | 'vllm' | 'lora'
export type LessonDifficulty = '简单' | '中等' | '困难' | '专家'
export type LearningValue = '基础必修' | '高频核心' | '进阶关键' | '专项拓展'
export type LessonGranularity = '合并基础课' | '单点精讲' | '拆分专题'

export interface Lesson {
  id: string
  order: number
  title: string
  module: string
  moduleOrder: number
  objective: string
  practice: string
  interview: string
  docs: string
  source: string
  why: string
  sourceFocus: string
  rebuild: string
  interviewSource: string
  difficulty: LessonDifficulty
  difficultyReason: string
  learningValue: LearningValue
  learningValueScore: 1 | 2 | 3 | 4 | 5
  estimatedMinutes: number
  granularity: LessonGranularity
}

interface TopicSeed {
  title: string
  difficulty?: LessonDifficulty
  difficultyReason?: string
  learningValue?: LearningValue
  learningValueScore?: 1 | 2 | 3 | 4 | 5
  estimatedMinutes?: number
  granularity?: LessonGranularity
}

interface UnitSeed {
  title: string
  goal: string
  lab: string
  interview: string
  topics: TopicSeed[]
}

export interface Track {
  id: TrackId
  name: string
  symbol: string
  description: string
  color: string
  docs: string
  source: string
  lessons: Lesson[]
}

const topics = (value: string) => value.split('|').map(title => ({ title }))
const unit = (title: string, goal: string, lab: string, interview: string, topicList: string | TopicSeed[]): UnitSeed => ({
  title,
  goal,
  lab,
  interview,
  topics: typeof topicList === 'string' ? topics(topicList) : topicList
})

const catalogue: Record<string, Omit<Track, 'lessons'> & { units: UnitSeed[] }> = {
  python: {
    id: 'python', name: 'Python', symbol: 'Py', color: '#4f7dff', description: '运行时、协议、并发与 CPython 实现路径。', docs: 'https://docs.python.org/3/', source: 'https://github.com/python/cpython',
    units: [
      unit('01 · 对象与名称模型', '掌握“名称绑定对象”而非变量装盒子的执行模型。', '用 id、gc、sys.getrefcount 与 dis 建立可观察实验。', '可变默认参数、interning 与循环引用为何要分层解释？', [
        { title: 'PyObject 头部与 ob_type', difficulty: '专家', difficultyReason: '需要把 Python 对象模型映射到 C 结构体共同前缀、类型指针和 slot 分派，后续源码课会继续拆解具体字段。', learningValue: '基础必修', learningValueScore: 5, estimatedMinutes: 90, granularity: '拆分专题' },
        { title: '身份、相等与哈希契约', difficulty: '困难', difficultyReason: '同时涉及 is、富比较双向分派、NotImplemented 与 dict 哈希查找不变量。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 75, granularity: '单点精讲' },
        { title: '名称绑定与 rebinding', difficulty: '简单', difficultyReason: '核心是名称到对象的一条绑定规则，可与参数传递和作用域通过同一对象图实验掌握。', learningValue: '基础必修', learningValueScore: 5, estimatedMinutes: 35, granularity: '合并基础课' },
        { title: '可变对象的别名风险', difficulty: '中等', difficultyReason: '规则本身直接，但要同时处理容器重复引用、浅拷贝和 API 所有权边界。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 50, granularity: '单点精讲' },
        { title: '小整数缓存与字符串驻留', difficulty: '中等', difficultyReason: '两个优化都复用不可变对象，适合合并比较；难点在区分语言语义与 CPython 实现现象。', learningValue: '专项拓展', learningValueScore: 3, estimatedMinutes: 40, granularity: '合并基础课' },
        { title: '引用计数的增减时机', difficulty: '专家', difficultyReason: '要追踪 new、borrowed、stolen reference 与 DECREF 触发析构时的可重入路径。', learningValue: '进阶关键', learningValueScore: 5, estimatedMinutes: 100, granularity: '拆分专题' },
        { title: '分代 GC 与循环检测', difficulty: '专家', difficultyReason: '需要从对象图、内部引用扣减、可达性传播和代际成本模型复现循环检测。', learningValue: '进阶关键', learningValueScore: 5, estimatedMinutes: 105, granularity: '拆分专题' },
        { title: '弱引用与 finalizer', difficulty: '困难', difficultyReason: '弱所有权、回调重入、竞态窗口与确定性资源管理之间存在多重边界。', learningValue: '高频核心', learningValueScore: 4, estimatedMinutes: 70, granularity: '单点精讲' },
        { title: '浅拷贝、深拷贝与图', difficulty: '困难', difficultyReason: '真正对象是可能共享并成环的图，必须理解 memo 如何同时保留拓扑并阻止递归。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 75, granularity: '单点精讲' },
        { title: '__slots__ 的布局影响', difficulty: '困难', difficultyReason: '牵涉 member descriptor、实例内存布局、继承冲突、弱引用和框架反射兼容。', learningValue: '进阶关键', learningValueScore: 4, estimatedMinutes: 70, granularity: '单点精讲' },
        { title: '对象生命周期实验', difficulty: '专家', difficultyReason: '综合引用计数、循环 GC、对象复活、weakref、tracemalloc 与 allocator 行为，需要多证据诊断。', learningValue: '进阶关键', learningValueScore: 5, estimatedMinutes: 110, granularity: '拆分专题' }
      ]),
      unit('02 · 属性、协议与 MRO', '把所有属性访问还原为查找顺序、descriptor 和绑定语义。', '实现 property、cached_property 与一个迷你 ORM 字段。', 'data descriptor 为什么能压过实例字典？', [
        { title: '实例字典、类字典与查找入口', difficulty: '简单', difficultyReason: '三个概念共享同一条命名空间查找链，适合通过一次 shadowing 实验合并掌握。', learningValue: '基础必修', learningValueScore: 5, estimatedMinutes: 35, granularity: '合并基础课' },
        { title: 'object.__getattribute__ 完整查找链', difficulty: '专家', difficultyReason: '必须串联 MRO 查找、descriptor 类型判定、实例字典、类变量和 AttributeError，适合拆成多步复现。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 100, granularity: '拆分专题' },
        { title: '__getattr__ 兜底与递归陷阱', difficulty: '中等', difficultyReason: '入口简单，但要准确区分正常查找失败后的钩子、直接调用差异与递归边界。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 50, granularity: '单点精讲' },
        { title: 'data 与 non-data descriptor 优先级', difficulty: '困难', difficultyReason: '优先级取决于 descriptor 类型是否定义 __set__/__delete__，并与实例同名字段产生反直觉覆盖。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 75, granularity: '单点精讲' },
        { title: '函数 descriptor、绑定方法与 self 注入', difficulty: '困难', difficultyReason: '需要从 function.__get__ 解释 MethodType 的临时创建、类访问和实例访问差异。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 75, granularity: '单点精讲' },
        { title: 'classmethod 与 staticmethod descriptor', difficulty: '中等', difficultyReason: '两者都包装函数并改变 __get__ 返回值，适合在同一张绑定矩阵中比较。', learningValue: '基础必修', learningValueScore: 4, estimatedMinutes: 45, granularity: '合并基础课' },
        { title: 'C3 线性化手算与冲突检测', difficulty: '专家', difficultyReason: '需要实现 merge、维护局部优先级和单调性，并解释无合法 head 时为何拒绝类定义。', learningValue: '进阶关键', learningValueScore: 5, estimatedMinutes: 105, granularity: '拆分专题' },
        { title: 'super() 与 cooperative inheritance', difficulty: '困难', difficultyReason: 'super 绑定的是当前类之后的 MRO 区间，不等于固定父类；多继承还要求统一签名和每层继续转发。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 80, granularity: '单点精讲' },
        { title: '__set_name__ 与声明式字段收集', difficulty: '困难', difficultyReason: '要连接类体执行、type.__new__、descriptor 回调和继承时字段注册表的复制策略。', learningValue: '进阶关键', learningValueScore: 4, estimatedMinutes: 75, granularity: '单点精讲' }
      ]),
      unit('03 · 函数、闭包与装饰器', '理解 code object、cell、调用约定和装饰器对签名的影响。', '实现带参数装饰器并保留 introspection 信息。', '闭包为什么会产生 late binding，如何从 cell 解释？', [
        { title: '函数对象：code、globals、defaults 与 closure', difficulty: '困难', difficultyReason: '函数是代码与定义环境的组合，需要区分运行时值、编译产物和闭包绑定分别存放在哪里。', learningValue: '基础必修', learningValueScore: 5, estimatedMinutes: 75, granularity: '单点精讲' },
        { title: 'code object、常量表与名称表', difficulty: '困难', difficultyReason: '要从 co_code、co_consts、co_names 和 dis 指令重建无上下文的编译结果。', learningValue: '进阶关键', learningValueScore: 4, estimatedMinutes: 70, granularity: '单点精讲' },
        { title: 'frame、fast locals 与局部变量同步', difficulty: '专家', difficultyReason: '横跨 frame 布局、LOAD_FAST、locals() 快照语义和调试器同步，适合拆分源码专题。', learningValue: '进阶关键', learningValueScore: 4, estimatedMinutes: 100, granularity: '拆分专题' },
        { title: 'closure cell、cellvars 与 freevars', difficulty: '困难', difficultyReason: '必须连接编译期名称分类、运行时 cell 身份与 LOAD_DEREF/STORE_DEREF。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 80, granularity: '单点精讲' },
        { title: 'late binding 与默认参数早绑定', difficulty: '困难', difficultyReason: '两个现象共享定义时机与调用时机的对比，合并后更容易解释循环闭包的正确修复边界。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 70, granularity: '合并基础课' },
        { title: '参数绑定：positional-only、keyword-only、*args 与 **kwargs', difficulty: '困难', difficultyReason: '调用要处理五类参数、重复赋值、缺失参数和默认值，适合用 Signature.bind 复现完整矩阵。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 80, granularity: '单点精讲' },
        { title: '装饰器求值、应用顺序与带参装饰器', difficulty: '困难', difficultyReason: '要区分 decorator expression 的定义期求值顺序和 wrapper 的自下而上应用顺序。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 75, granularity: '单点精讲' },
        { title: 'functools.wraps、__wrapped__ 与签名保真', difficulty: '中等', difficultyReason: '机制集中在元数据复制和 __wrapped__ 链，可通过 inspect.signature 与缓存键失败案例验证。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 50, granularity: '单点精讲' }
      ]),
      unit('04 · 迭代、生成器与协程', '统一 iterator protocol、generator frame、send/throw 和 await。', '手写可暂停解析器，再把它改造成 async generator。', 'yield from 如何传递返回值与异常？', [
        { title: 'Iterable、Iterator 与 __getitem__ 兼容路径', difficulty: '中等', difficultyReason: '公开协议很小，但要区分可重复 iterable、一次性 iterator，并理解 CPython 为旧式序列保留的索引回退。', learningValue: '基础必修', learningValueScore: 5, estimatedMinutes: 50, granularity: '合并基础课' },
        { title: '迭代耗尽、StopIteration 与 PEP 479', difficulty: '困难', difficultyReason: '需要分清协议结束信号、生成器 return value、意外 StopIteration 转 RuntimeError 以及 C API 的三态返回。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 80, granularity: '单点精讲' },
        { title: '生成器函数、惰性启动与对象状态', difficulty: '中等', difficultyReason: '核心是调用只创建 generator，首次 next 才执行；结合 inspect 状态与一次性耗尽即可完整观察。', learningValue: '基础必修', learningValueScore: 5, estimatedMinutes: 50, granularity: '合并基础课' },
        { title: '暂停帧：指令指针、值栈与异常状态', difficulty: '专家', difficultyReason: '要把 yield 映射到 frame 状态、指令恢复点、局部变量、值栈和异常栈保存，适合独立源码复现。', learningValue: '进阶关键', learningValueScore: 5, estimatedMinutes: 110, granularity: '拆分专题' },
        { title: 'send 注入值与生成器预激', difficulty: '困难', difficultyReason: '需要同时解释 yield 的产出值和表达式结果、初始暂停点限制及双向协议的时序。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 70, granularity: '单点精讲' },
        { title: 'throw、close、GeneratorExit 与清理', difficulty: '专家', difficultyReason: '异常从暂停点注入，close 还会沿委派链传播；忽略 GeneratorExit 会破坏资源清理契约。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 100, granularity: '拆分专题' },
        { title: 'yield from 委派状态机与返回值通道', difficulty: '专家', difficultyReason: 'yield from 同时转发 next、send、throw、close，并把子生成器 StopIteration.value 变为表达式结果，必须逐分支复现。', learningValue: '进阶关键', learningValueScore: 5, estimatedMinutes: 120, granularity: '拆分专题' },
        { title: 'contextmanager：单次 yield 与异常回注', difficulty: '困难', difficultyReason: '一个 yield 被解释为 enter/exit 分界，with 块异常通过 throw 回注，恰好一次 yield 的约束需要实现验证。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 80, granularity: '单点精讲' },
        { title: 'awaitable 与 __await__ 迭代协议', difficulty: '专家', difficultyReason: 'await 是专用于异步运行时的委派协议；要连接 coroutine、__await__ iterator、Future 驱动和不可重复 await。', learningValue: '进阶关键', learningValueScore: 5, estimatedMinutes: 105, granularity: '拆分专题' },
        { title: '异步迭代：__aiter__、__anext__ 与 StopAsyncIteration', difficulty: '困难', difficultyReason: '协议形似同步迭代，但 __anext__ 返回 awaitable，终止异常独立，资源结束还可能需要显式 aclose。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 80, granularity: '单点精讲' },
        { title: '异步生成器的背压、取消与 aclose', difficulty: '专家', difficultyReason: '要从一次 anext 请求驱动一次产出解释自然背压，并处理取消在暂停点注入、finally 清理和并发驱动保护。', learningValue: '进阶关键', learningValueScore: 5, estimatedMinutes: 110, granularity: '拆分专题' }
      ]),
      unit('05 · 异常与上下文管理', '把异常视为非局部控制流，并处理清理与异常链。', '实现事务 context manager，覆盖 commit、rollback 与 suppress。', 'finally 中 return 为什么危险？', [
        { title: '异常对象、traceback 链与处理器生命周期', difficulty: '困难', difficultyReason: '异常对象反向持有 traceback、frame 与 locals；还要理解 except target 自动删除和 sys.exception 的嵌套恢复。', learningValue: '基础必修', learningValueScore: 5, estimatedMinutes: 75, granularity: '单点精讲' },
        { title: '异常匹配、层级设计与捕获边界', difficulty: '中等', difficultyReason: '规则集中在类层级与从上到下首次匹配，但库 API 还需设计可操作的异常分类和禁止吞掉 BaseException。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 55, granularity: '合并基础课' },
        { title: 'raise、bare raise 与 traceback 保真', difficulty: '困难', difficultyReason: 'raise、raise exc、with_traceback 会产生不同栈形状，直接影响诊断、包装器和跨层重抛。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 70, granularity: '单点精讲' },
        { title: '__context__、__cause__ 与 raise from', difficulty: '困难', difficultyReason: '要区分隐式处理上下文、显式因果链和仅隐藏显示的 from None，才能安全做领域异常翻译。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 70, granularity: '单点精讲' },
        { title: 'try/except/else/finally 的控制流矩阵', difficulty: '专家', difficultyReason: 'return、break、continue、异常和新异常都要穿过 finally；其完成原因覆盖规则必须用矩阵验证。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 105, granularity: '拆分专题' },
        { title: 'ExceptionGroup、except* 与并发多失败', difficulty: '专家', difficultyReason: '处理器按类型递归拆分组、并行运行语义后再合并未处理与新异常，不能用普通 except 心智模型推演。', learningValue: '进阶关键', learningValueScore: 5, estimatedMinutes: 110, granularity: '拆分专题' },
        { title: 'with 展开、特殊方法查找与异常抑制', difficulty: '困难', difficultyReason: '需要完整展开 enter/exit、异常三元组、truthy suppression、多项嵌套顺序和类型级特殊方法查找。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 85, granularity: '单点精讲' },
        { title: 'ExitStack：动态资源、部分获取与所有权转移', difficulty: '专家', difficultyReason: '动态数量资源要求 LIFO 回滚、enter 中途失败、回调抑制/替换异常以及 pop_all 所有权转移。', learningValue: '进阶关键', learningValueScore: 5, estimatedMinutes: 110, granularity: '拆分专题' },
        { title: 'async with、取消与可靠异步清理', difficulty: '专家', difficultyReason: '清理本身可以 await，也可能再次被取消；必须区分资源所有者、屏蔽范围、超时和聚合清理失败。', learningValue: '进阶关键', learningValueScore: 5, estimatedMinutes: 115, granularity: '拆分专题' }
      ]),
      unit('06 · 导入、包与运行环境', '追踪 import 从 finder 到 loader 的完整解析路径。', '写一个内存模块 finder，并审计循环导入。', '为什么 import 缓存会改变 monkey patch 的可见性？', [
        { title: 'import 语句、模块对象与名称绑定', difficulty: '中等', difficultyReason: '需区分查找加载模块与把顶层包/目标属性绑定进当前命名空间两个阶段，常见语法可合并实验。', learningValue: '基础必修', learningValueScore: 5, estimatedMinutes: 55, granularity: '合并基础课' },
        { title: 'sys.modules 缓存、预插入与失败回滚', difficulty: '专家', difficultyReason: '模块在执行前写入缓存以打破递归，失败又必须精确删除本次条目；这是循环导入和单例身份的核心不变量。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 105, granularity: '拆分专题' },
        { title: 'sys.meta_path 与 MetaPathFinder', difficulty: '困难', difficultyReason: '要处理顶层/子模块 path 参数、finder 优先级、缓存失效与返回 None/抛错的协议差异。', learningValue: '进阶关键', learningValueScore: 4, estimatedMinutes: 80, granularity: '单点精讲' },
        { title: 'PathFinder、sys.path_hooks 与 importer cache', difficulty: '专家', difficultyReason: '包含三层缓存与两级 finder；需要从路径条目到 FileFinder suffix loader 逐步复现。', learningValue: '进阶关键', learningValueScore: 4, estimatedMinutes: 110, granularity: '拆分专题' },
        { title: 'ModuleSpec、create_module 与 exec_module', difficulty: '专家', difficultyReason: 'finder 与 loader 通过 spec 传递状态，加载器还需遵守创建、预缓存、执行、失败清理和包属性初始化顺序。', learningValue: '进阶关键', learningValueScore: 5, estimatedMinutes: 115, granularity: '拆分专题' },
        { title: '普通包、__path__ 与 namespace package', difficulty: '困难', difficultyReason: '要区分 __init__.py 包、动态子模块搜索位置和跨多个目录聚合的 namespace package。', learningValue: '高频核心', learningValueScore: 4, estimatedMinutes: 80, granularity: '单点精讲' },
        { title: '绝对/相对导入、__package__ 与 __main__', difficulty: '困难', difficultyReason: '相对点数依赖 package 上下文，直接脚本与 python -m 对 __spec__/__package__ 的初始化不同。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 75, granularity: '单点精讲' },
        { title: '循环导入、半初始化模块与依赖方向', difficulty: '专家', difficultyReason: '需按执行时间线分析缓存中存在但属性尚未绑定的模块，并从架构上消除初始化期双向依赖。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 105, granularity: '拆分专题' },
        { title: 'reload、from-import 快照与 monkey patch 可见性', difficulty: '困难', difficultyReason: 'reload 复用模块字典而外部引用不自动重绑，旧实例、旧类和 from-import 名称形成多版本对象图。', learningValue: '进阶关键', learningValueScore: 4, estimatedMinutes: 85, granularity: '单点精讲' },
        { title: 'venv、site、sys.path 初始化与可重建环境', difficulty: '困难', difficultyReason: '要连接解释器前缀、pyvenv.cfg、site-packages、.pth、PATH 激活与环境不可搬迁性。', learningValue: '基础必修', learningValueScore: 4, estimatedMinutes: 80, granularity: '单点精讲' },
        { title: 'pyproject、build frontend/backend 与 wheel', difficulty: '困难', difficultyReason: '构建隔离、backend hook、核心元数据、sdist/wheel 标签和安装期解包属于独立发布协议。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 90, granularity: '单点精讲' }
      ]),
      unit('07 · 类型系统与 API 设计', '把注解、泛型、协议、variance 当作静态契约而非运行时魔法。', '为事件总线和 repository 定义可推断的泛型 API。', 'Protocol 与 ABC 的适用边界是什么？', [
        { title: '注解求值：3.14 lazy scopes、annotationlib 与 future', difficulty: '专家', difficultyReason: 'Python 3.14 默认惰性求值改变了定义期/读取期边界，还需兼容 future 字符串化与运行时反射工具。', learningValue: '进阶关键', learningValueScore: 5, estimatedMinutes: 110, granularity: '拆分专题' },
        { title: 'TypeVar：约束、bound、default 与解算结果', difficulty: '困难', difficultyReason: '约束集合会提升到候选成员，bound 保留最具体子类型，default 只在无法推断时参与；三者不能混用同一心智模型。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 85, granularity: '单点精讲' },
        { title: '泛型函数推断、overload 与实现签名', difficulty: '专家', difficultyReason: '涉及多参数候选收集、约束求解、overload 首个匹配、Any/Union 回退与实现签名不可见边界。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 110, granularity: '拆分专题' },
        { title: 'Protocol 结构子类型与 runtime_checkable 边界', difficulty: '困难', difficultyReason: '静态成员合同与运行时仅检查属性存在完全不同，data protocol、泛型方差和可变成员还会影响兼容性。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 90, granularity: '单点精讲' },
        { title: 'ABC 名义子类型、register 与 __subclasshook__', difficulty: '困难', difficultyReason: '继承、虚拟注册和自定义结构判定共同影响 issubclass，但 register 不注入实现也不改变 MRO。', learningValue: '进阶关键', learningValueScore: 4, estimatedMinutes: 80, granularity: '单点精讲' },
        { title: '协变、逆变、不变与可变性证明', difficulty: '专家', difficultyReason: '必须用读写位置和替换原则证明安全性，Python 3.12+ 还会按类型参数用途推断类的方差。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 115, granularity: '拆分专题' },
        { title: 'ParamSpec、Concatenate 与装饰器签名', difficulty: '困难', difficultyReason: '参数列表包含位置/关键字结构，ParamSpec 负责整体转发，Concatenate 只能表达前缀变换且有严格位置限制。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 85, granularity: '单点精讲' },
        { title: 'TypedDict：Required、NotRequired、ReadOnly 与演进', difficulty: '困难', difficultyReason: '它约束 dict 的静态键集合，total 与单键必需性、只读项、结构兼容和运行时无验证需要联合设计。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 80, granularity: '单点精讲' },
        { title: 'TypeGuard、TypeIs 与双分支收窄', difficulty: '困难', difficultyReason: '用户谓词可承诺超出实现真实能力；TypeIs 要求结果与输入兼容并收窄两侧，TypeGuard 主要收窄真分支。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 80, granularity: '单点精讲' },
        { title: 'mypy、pyright 差异与类型回归测试', difficulty: '困难', difficultyReason: '类型规范允许实现差异，版本、配置、typeshed 与插件都会改变诊断；公共 API 需以多 checker 样例做兼容门。', learningValue: '进阶关键', learningValueScore: 4, estimatedMinutes: 90, granularity: '单点精讲' }
      ]),
      unit('08 · asyncio 与并发控制', '从 event loop 调度、Task、取消传播走到结构化并发。', '实现带 timeout、限流、重试、取消语义的批量请求器。', 'TaskGroup 和 gather 的部分失败语义如何区别？', [
        { title: 'event loop 的 ready/timer 队列与单轮调度', difficulty: '专家', difficultyReason: '需要复现 selector 等待、定时器迁移、ready 快照与 callback 执行顺序，才能解释公平性和慢回调。', learningValue: '基础必修', learningValueScore: 5, estimatedMinutes: 110, granularity: '拆分专题' },
        { title: 'coroutine、Future、Task 与驱动关系', difficulty: '困难', difficultyReason: '三者分别表示可暂停计算、一次性结果槽与调度驱动器，混淆会导致重复 await、裸 coroutine 泄漏和错误取消。', learningValue: '基础必修', learningValueScore: 5, estimatedMinutes: 85, granularity: '单点精讲' },
        { title: 'create_task 生命周期、强引用与 eager start', difficulty: '困难', difficultyReason: '任务可在调用者下一次让出前保持待调度，loop 只保留弱引用；新 eager start 又改变副作用和异常时机。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 85, granularity: '单点精讲' },
        { title: '取消请求、CancelledError、cancelling 与 uncancel', difficulty: '专家', difficultyReason: 'cancel 是在下个暂停点注入的请求而非强制终止，多次请求计数、清理重抛和结构化并发内部取消必须分开追踪。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 120, granularity: '拆分专题' },
        { title: 'await 的协作公平性与事件循环饥饿', difficulty: '困难', difficultyReason: 'await 只有在被等待对象真正挂起时才让出；立即完成 await、CPU 循环和无界回调链都可能饿死其他任务。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 80, granularity: '单点精讲' },
        { title: 'gather 的结果、异常与取消矩阵', difficulty: '专家', difficultyReason: '子任务失败、子任务取消、gather 自身取消、return_exceptions 与完成后 cancel 组合形成多分支语义。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 105, granularity: '拆分专题' },
        { title: 'TaskGroup 结构化并发与 ExceptionGroup', difficulty: '专家', difficultyReason: '首个非取消失败触发兄弟取消、退出等待所有孩子、聚合异常，并需处理外部取消与内部唤醒取消碰撞。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 125, granularity: '拆分专题' },
        { title: 'timeout、wait_for、shield 与取消作用域', difficulty: '专家', difficultyReason: '三者保护的是不同 task/await 边界；timeout 通过取消当前 task 并转换异常，shield 仅阻止向子任务传播。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 115, granularity: '拆分专题' },
        { title: 'Semaphore、Queue 背压、join 与 shutdown', difficulty: '专家', difficultyReason: '并发数和缓冲量是不同限制；还要维持 put/get/task_done 计数、取消安全与 3.13 shutdown 不变量。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 115, granularity: '拆分专题' },
        { title: 'to_thread、run_in_executor、ContextVar 与 GIL', difficulty: '困难', difficultyReason: '线程卸载涉及 context 传播、取消只能停止等待者、executor 容量以及 CPU Python 代码仍受 GIL 约束。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 90, granularity: '单点精讲' },
        { title: 'asyncio debug、任务栈与泄漏诊断', difficulty: '困难', difficultyReason: '要区分 never awaited coroutine、pending task destruction、未取回异常、慢 callback 和永不完成 Future 的证据链。', learningValue: '进阶关键', learningValueScore: 4, estimatedMinutes: 90, granularity: '单点精讲' }
      ]),
      unit('09 · 性能、内存与诊断', '以 profiling 证据定位瓶颈，区分算法、解释器与 IO。', '对一个慢 API 做 cProfile、tracemalloc 与 line profile 诊断。', 'GIL 限制的究竟是哪类并行？', [
        { title: '复杂度模型、常数项与真实工作负载', difficulty: '困难', difficultyReason: '渐近复杂度只描述规模趋势，真实瓶颈还受数据分布、缓存局部性、分配、解释器开销和 I/O 等待影响。', learningValue: '基础必修', learningValueScore: 5, estimatedMinutes: 80, granularity: '单点精讲' },
        { title: 'list、deque 与紧凑/分块存储取舍', difficulty: '困难', difficultyReason: '要从过量分配、连续指针数组、块链表、缓存局部性和两端操作推导性能，而非背复杂度表。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 85, granularity: '单点精讲' },
        { title: 'dict 紧凑布局、探测序列与哈希冲突', difficulty: '专家', difficultyReason: '包含稀疏 indices、紧凑 entries、开放寻址、扰动探测、删除 dummy、resize 与相等比较失败路径。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 120, granularity: '拆分专题' },
        { title: '可重复基准：timeit、pyperf、噪声与效应量', difficulty: '困难', difficultyReason: '热身、specialization、CPU 频率、GC、输入构造和统计汇总都会制造假优化，需要实验设计而非单次计时。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 90, granularity: '单点精讲' },
        { title: 'cProfile、pstats 与确定性调用图', difficulty: '困难', difficultyReason: '要区分 primitive/total calls、tottime/cumtime、调用者/被调用者，并理解 instrumentation overhead 和异步等待误读。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 90, granularity: '单点精讲' },
        { title: '采样 profiler、火焰图与生产诊断', difficulty: '困难', difficultyReason: '采样概率、栈聚合、off-CPU 时间、原生帧与短函数漏采决定证据边界，需与 tracing profiler 互补。', learningValue: '进阶关键', learningValueScore: 4, estimatedMinutes: 85, granularity: '单点精讲' },
        { title: 'tracemalloc 快照、对象存活与 RSS 分离', difficulty: '专家', difficultyReason: 'Python allocator trace、对象图存活、arena/系统 allocator 保留、C 扩展内存与进程 RSS 是不同层次。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 110, granularity: '拆分专题' },
        { title: 'dis、inline cache 与 specializing interpreter', difficulty: '专家', difficultyReason: '需要连接基础 bytecode、quickening、guard、specialized opcode、deopt 与 workload 稳定性，且版本差异很大。', learningValue: '进阶关键', learningValueScore: 5, estimatedMinutes: 115, granularity: '拆分专题' },
        { title: 'GIL、释放点、free-threading 与线程安全', difficulty: '专家', difficultyReason: '传统 GIL 只串行化解释器执行；C 扩展可释放，3.13+ free-threaded 构建又引入内部锁、biased refcount 与扩展兼容。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 125, granularity: '拆分专题' },
        { title: 'multiprocessing 序列化、启动方式与共享内存', difficulty: '专家', difficultyReason: 'spawn/fork/forkserver、pickle 边界、copy-on-write、IPC 成本、资源追踪与异常回收会决定并行是否盈利。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 115, granularity: '拆分专题' },
        { title: '缓存命中、失效、stampede 与内存预算', difficulty: '困难', difficultyReason: '缓存正确性取决于 key、TTL、版本和负缓存，性能还需处理并发 miss 合并、淘汰与不可见内存成本。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 95, granularity: '单点精讲' }
      ]),
      unit('10 · CPython 源码阅读', '将源码输入、语法树、名称分析、控制流、字节码、frame 和调用协议连成可调试的执行链。', '在 pydebug 构建中跟踪一行 Python 从 token 到 opcode dispatch，并完成一次最小源码修改。', '解释器为什么要把“读懂代码”和“执行代码”拆成多轮中间表示？', [
        { title: '仓库地图、pydebug 构建与测试定位', difficulty: '困难', difficultyReason: '需要把 Grammar、Parser、Python、Objects、Include、Lib 和测试目录映射到一次可验证的源码修改，并掌握 Debug/Release 的证据边界。', learningValue: '基础必修', learningValueScore: 5, estimatedMinutes: 100, granularity: '单点精讲' },
        { title: 'tokenizer：编码、缩进与 token 流', difficulty: '专家', difficultyReason: '编码探测、通用换行、缩进栈、隐式续行、f-string 模式和源码位置都在词法阶段交织，适合拆成状态机复现。', learningValue: '进阶关键', learningValueScore: 5, estimatedMinutes: 130, granularity: '拆分专题' },
        { title: 'PEG parser：回溯、memo、cut 与错误规则', difficulty: '专家', difficultyReason: '要同时理解 PEG 有序选择、packrat memoization、lookahead、cut、left recursion 以及 invalid_* 第二遍诊断，源码由 grammar 自动生成。', learningValue: '进阶关键', learningValueScore: 5, estimatedMinutes: 145, granularity: '拆分专题' },
        { title: 'ASDL、AST 节点与源码位置', difficulty: '困难', difficultyReason: '需要连接 Parser/Python.asdl、生成的 C 结构、arena 生命周期、构造 action 与 lineno/col_offset 的 UTF-8 字节偏移。', learningValue: '进阶关键', learningValueScore: 4, estimatedMinutes: 100, granularity: '单点精讲' },
        { title: 'symbol table：local、global、free 与 cell', difficulty: '专家', difficultyReason: '名称分类依赖两遍分析、嵌套作用域环境传播、global/nonlocal 冲突和 class/comprehension 特例，直接决定后续 opcode。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 145, granularity: '拆分专题' },
        { title: 'compiler unit、basic block 与 CFG', difficulty: '专家', difficultyReason: 'AST visitor 先发射带符号操作数的指令，再经 basic block、异常区域、栈深度与控制流优化逐步收敛，跨多个内部文件。', learningValue: '进阶关键', learningValueScore: 5, estimatedMinutes: 150, granularity: '拆分专题' },
        { title: 'assembler、jump fixup、exception table 与 code object', difficulty: '专家', difficultyReason: '需要解决跳转偏移的变长编码固定点、line table、exception table、常量/名称索引和 PyCodeObject 不变量。', learningValue: '进阶关键', learningValueScore: 5, estimatedMinutes: 150, granularity: '拆分专题' },
        { title: 'interpreter frame、dispatch loop 与 eval breaker', difficulty: '专家', difficultyReason: '解释器帧布局、value stack、instruction pointer、生成指令 case、异常展开、周期性事件检查和版本构建选项共同决定执行。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 160, granularity: '拆分专题' },
        { title: 'vectorcall：参数数组、关键字名称与绑定', difficulty: '专家', difficultyReason: '要从 tp_call 的 tuple/dict 物化成本走到 args 数组、nargsf 标志、kwnames、method fast path 和 Python 函数参数绑定失败矩阵。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 135, granularity: '拆分专题' },
        { title: 'specialization：counter、guard、cache 与 deopt', difficulty: '专家', difficultyReason: '自适应指令要收集类型反馈、安装 inline cache、守卫稳定假设，并在对象形状变化时退化回通用语义；实现随版本快速演进。', learningValue: '进阶关键', learningValueScore: 5, estimatedMinutes: 155, granularity: '拆分专题' },
        { title: '端到端源码改造：新增可观测优化并回归', difficulty: '专家', difficultyReason: '综合语法/编译/执行链、生成文件、C 调试、测试选择、性能基准和兼容性说明，要求把阅读转化为可提交的最小改动。', learningValue: '进阶关键', learningValueScore: 5, estimatedMinutes: 210, granularity: '拆分专题' }
      ])
    ]
  },
  typescript: {
    id: 'typescript', name: 'TypeScript', symbol: 'TS', color: '#1fa8d5', description: '从 JavaScript 运行时到 TypeScript checker。', docs: 'https://www.typescriptlang.org/docs/', source: 'https://github.com/microsoft/TypeScript',
    units: [
      unit('01 · JavaScript 运行时地基', '先掌握 ECMAScript 的值、引用、环境记录、对象内部方法和 Job，再讨论 TypeScript 能证明什么。', '写出一组对象、闭包、this、Promise 与模块的可运行反例，并用规范算法解释结果。', 'TS 为什么无法消除所有 JavaScript 运行时风险？', [
        { title: 'ECMAScript 值、规范 Reference 与相等算法', difficulty: '困难', difficultyReason: '需要区分语言值、规范内部 Reference、对象身份以及 IsStrictlyEqual/SameValue/SameValueZero 三套算法；“变量保存引用”这句口号常制造错误模型。', learningValue: '基础必修', learningValueScore: 5, estimatedMinutes: 90, granularity: '单点精讲' },
        { title: 'Property Key、Descriptor、内部方法与对象形状', difficulty: '专家', difficultyReason: '属性访问连接 ToPropertyKey、data/accessor descriptor、[[Get]]/[[Set]]、Receiver、原型链与引擎 hidden class/inline cache，多层边界必须拆开。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 135, granularity: '拆分专题' },
        { title: '可达性 GC、WeakRef 与 FinalizationRegistry', difficulty: '专家', difficultyReason: '语言只约束可观察 liveness，具体引擎使用分代、增量、并发等策略；弱引用与终结注册还涉及不可预测时机和同一 job 内存活保证。', learningValue: '进阶关键', learningValueScore: 4, estimatedMinutes: 135, granularity: '拆分专题' },
        { title: '执行上下文、Environment Record、TDZ 与 hoisting', difficulty: '专家', difficultyReason: '需要从声明实例化、Lexical/Variable Environment、binding 创建与初始化解释 var/let/const/function 的差异，不能用“代码搬到顶部”代替。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 145, granularity: '拆分专题' },
        { title: '闭包、捕获绑定与 per-iteration environment', difficulty: '困难', difficultyReason: '闭包捕获 Environment Record 中的 binding，不是值快照；for let 每轮新 binding、for var 共享 binding 和异步回调共同形成高频反例。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 100, granularity: '单点精讲' },
        { title: 'this、arrow、call/apply/bind、new 与 super', difficulty: '专家', difficultyReason: 'this 来自 Reference 调用、显式绑定、构造调用或 lexical 捕获；bound function、derived constructor 与 super 又引入 NewTarget/HomeObject。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 145, granularity: '拆分专题' },
        { title: 'prototype、new、class fields 与 private brand', difficulty: '专家', difficultyReason: '需要连接 [[Prototype]] 查找、constructor.prototype、OrdinaryCreateFromConstructor、class 严格模式、字段初始化次序和 #private brand 检查。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 150, granularity: '拆分专题' },
        { title: 'getter、setter、Proxy、Reflect 与 Receiver', difficulty: '专家', difficultyReason: 'accessor 调用的 this 取决于 Receiver，Proxy trap 还必须保持目标对象不变量；错误转发会破坏继承 setter 和私有字段。', learningValue: '进阶关键', learningValueScore: 5, estimatedMinutes: 140, granularity: '拆分专题' },
        { title: 'Promise resolution、thenable assimilation 与 Job queue', difficulty: '专家', difficultyReason: 'Promise 状态与 fate 不同，resolve 可能跟随 thenable；reaction job、异常转拒绝、自解析保护和 job 排序需要按规范算法推演。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 150, granularity: '拆分专题' },
        { title: 'HTML event loop：task、microtask、render 与饥饿', difficulty: '专家', difficultyReason: 'ECMAScript 只定义 Job，浏览器宿主定义 task source、microtask checkpoint 与渲染时机；无限微任务、timer 最小延迟和 Node 阶段不能混为一套口诀。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 150, granularity: '拆分专题' },
        { title: 'ESM 实例化、Module Environment 与 live binding', difficulty: '专家', difficultyReason: '模块先链接后求值，import binding 指向导出 binding 而非值拷贝；TDZ、静态图、namespace exotic object 和异步模块需要联动理解。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 145, granularity: '拆分专题' },
        { title: '循环依赖、SCC 求值与 TDZ 失败路径', difficulty: '专家', difficultyReason: '模块图要用 DFS low-link 识别强连通分量，链接成功仍可能因求值顺序读取未初始化 binding；函数、var、let/class 的初始化时机又不同。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 155, granularity: '拆分专题' },
        { title: 'top-level await、异步模块图与启动阻塞', difficulty: '专家', difficultyReason: 'TLA 会把同步依赖图变成带 pending async dependency、async parent 与错误传播的异步状态机，还可能形成无法自动检测的等待环。', learningValue: '进阶关键', learningValueScore: 5, estimatedMinutes: 170, granularity: '拆分专题' },
        { title: 'Node ESM/CJS 互操作、解析与缓存边界', difficulty: '专家', difficultyReason: '需要同时处理 package type/exports、URL identity、同步 require 约束、CJS namespace 包装、named export 静态分析与两套 cache 的差异。', learningValue: '高频核心', learningValueScore: 5, estimatedMinutes: 170, granularity: '拆分专题' }
      ]),
      unit('02 · 可赋值性与结构类型', '精确区分 assignment compatibility、subtyping 与 TS 的权衡。', '设计一个类型安全 event emitter 并验证参数方向。', 'excess property check 为什么不等价于子类型检查？', '结构类型基本规则|对象字面量 freshness|可选属性语义|readonly 的浅层性|函数参数逆变|bivariance hack|返回值协变|数组协变漏洞|any unknown never|void 的特殊可赋值性'),
      unit('03 · 控制流分析与窄化', '理解 checker 如何沿路径积累事实、又在哪些地方放弃事实。', '实现可辨识联合状态机和 exhaustive matcher。', '赋值后 narrowing 为什么会失效？', 'typeof narrowing|instanceof narrowing|in 操作符|truthiness 陷阱|discriminated union|never exhaustiveness|user type predicate|assertion function|alias control flow|闭包中的收窄丢失'),
      unit('04 · 泛型与类型推断', '掌握从调用点推断到约束传播的 API 设计方式。', '实现 pipe、memoize 与 repository 泛型。', 'infer 的候选类型如何合并？', '泛型函数推断|约束 extends|默认类型参数|keyof 与索引访问|mapped type|conditional type|infer 捕获|分布式条件类型|模板字符串类型|递归类型限制'),
      unit('05 · 函数与高级签名', '用 overload、this parameter、variadic tuple 表达真实调用契约。', '为路由器设计参数提取和 handler 推断。', 'overload 实现签名为什么对调用者不可见？', 'call signature|construct signature|overload 顺序|this parameter|optional 参数|rest 参数 tuple|可变元组|函数属性|callback 上下文类型|async 返回 Promise'),
      unit('06 · 类、装饰器与声明合并', '分离类型空间与值空间，理解 emit 后剩下什么。', '实现带 metadata 的依赖注入最小原型。', 'private 字段与 TS private 的运行时差异？', '类字段初始化|public private protected|ECMAScript #private|abstract class|implements 检查|decorator 新语义|parameter property|declaration merging|namespace emit|enum 运行时代价'),
      unit('07 · 模块解析与打包边界', '让 source、declaration、exports 条件与运行时解析保持一致。', '配置双 ESM/CJS 包并写出类型测试。', 'verbatimModuleSyntax 解决了什么错配？', 'moduleResolution modes|package exports|typesVersions|type-only import|esModuleInterop|NodeNext 规则|路径别名陷阱|declaration emit|source map|tree shaking 边界'),
      unit('08 · tsconfig 与工程策略', '把 strict 开关理解成一组可验证的健全性预算。', '为 monorepo 制定 project references 构建图。', 'strictNullChecks 会如何改变库 API？', 'strict 家族开关|noUncheckedIndexedAccess|exactOptionalPropertyTypes|useUnknownInCatchVariables|isolatedModules|incremental build|project references|composite 约束|skipLibCheck 成本|诊断性能分析'),
      unit('09 · 声明文件与库设计', '从消费者视角设计稳定的 .d.ts，而非给实现补类型。', '为一个 JS 库补全 declaration 与 dtslint 样例。', 'interface 和 type 在公共 API 中怎么选？', 'ambient declaration|declare module|global augmentation|module augmentation|function namespace merge|callable object|branding|opaque type pattern|发布 types 字段|API 兼容性测试'),
      unit('10 · Compiler API 与 checker', '使用 Program、AST visitor、TypeChecker 构建静态分析器。', '检测 any 泄漏、未 await Promise 与危险断言。', 'binder、checker、emitter 各自解决什么问题？', 'SourceFile 与 Node|Scanner 与 Parser|Symbol table|TypeChecker 查询|AST visitor|transform pipeline|printer 与 emitter|language service|watch program|tsserver 协议'),
      unit('11 · 类型系统面试实战', '将 checker 行为转化为可以现场推演的题目与反例。', '为每道题写类型测试与运行时对照。', '如何在五分钟内证明你的类型设计没有只是在“骗编译器”？', '复杂泛型报错拆解|类型谓词陷阱|协变逆变现场题|infer 递归题|模板字符串解析|API 兼容性演进|any 污染定位|类型断言审计|编译性能反例|运行时类型边界')
    ]
  },
  langgraph: {
    id: 'langgraph', name: 'LangGraph', symbol: 'LGr', color: '#9a6cff', description: '显式状态机、耐久执行、人工审批与生产编排。', docs: 'https://docs.langchain.com/oss/python/langgraph/overview', source: 'https://github.com/langchain-ai/langgraph',
    units: [
      unit('01 · Graph 思维与执行模型', '先厘清节点、边、状态、super-step 和副作用的边界。', '用假节点搭建可重复的图执行实验。', '为什么 Agent 不能被当作普通函数链？', '图与工作流的差别|节点纯度与副作用|State 的职责|super-step 模型|START END 语义|同步与异步节点|状态快照|可重放执行|确定性节点|拓扑设计'),
      unit('02 · State、Reducer 与消息', '理解状态 schema、reducer 与消息累积的可组合契约。', '为客服图建立消息与订单状态 reducer。', '为什么不能随意覆盖共享 state？', 'TypedDict state|MessagesState|Annotated reducer|append 与 replace|自定义 reducer|消息 ID|状态迁移|不可变思维|schema 演进|state 校验'),
      unit('03 · Edge、路由与循环', '把条件控制流实现为可审计的图结构。', '实现分类、路由、循环重试和终止条件。', '条件边和在节点中 if/else 的工程差异？', 'add_edge|conditional edges|Command 路由|循环终止|fan-out|fan-in|错误边|重试边界|map reduce 图|路由可测试性'),
      unit('04 · Checkpoint 与耐久执行', '把任务恢复建立在 checkpoint 和幂等副作用上。', '为支付审核图实现 crash-resume 演练。', '如何避免 resume 后重复产生副作用？', 'checkpointer 接口|thread id|snapshot history|pending writes|resume 语义|idempotency key|outbox pattern|故障恢复|time travel|状态迁移'),
      unit('05 · LangGraph 状态模型', '用 State、Reducer、node、edge 表达可检查的工作流。', '构建带消息 reducer 的多节点客服图。', '为什么共享字典会破坏可回放性？', 'StateGraph 建图|START 与 END|TypedDict state|reducer 语义|消息累积|条件边|循环与终止|node 纯度|graph compile|state inspection'),
      unit('06 · 持久化与耐久执行', '为可恢复执行定义 checkpoint、副作用边界和幂等策略。', '实现订单查询工作流的 crash-resume 测试。', '重放时怎样避免重复支付？', 'checkpointer 接口|thread id|snapshot 与 history|interrupt 前状态|resuming 语义|task queue 模式|幂等副作用|outbox pattern|durable task 边界|time travel 调试'),
      unit('07 · 人工审批与记忆', '把人工反馈与长期记忆作为显式状态转换。', '做一个高风险工具的 approve/edit/reject 流程。', 'memory 写入为什么需要权限和失效机制？', 'interrupt API|human response schema|approve reject edit|short term memory|long term store|namespace 设计|memory retrieval|用户隔离|PII 最小化|feedback 归档'),
      unit('08 · 多 Agent 与子图', '用上下文隔离、合同和聚合器管理并行专长代理。', '搭建 researcher、coder、reviewer 三代理流水线。', '子代理什么时候只是在转移复杂度？', 'supervisor 模式|handoff 模式|subgraph 组合|上下文隔离|共享状态风险|并行 fan-out|结果聚合|角色合同|冲突解决|异步取消'),
      unit('09 · 子图、并行与图组合', '用子图合同、映射并行与汇聚节点控制跨团队工作流的复杂度。', '把 research、coding、review 三条图组合成一个可取消的父图。', '子图如何避免状态冲突、取消泄漏和隐式耦合？', 'subgraph contract|state projection|private state|fan-out map|fan-in reduce|parallel branches|join barrier|error propagation|cancellation|graph composition|nested checkpoint|composition test'),
      unit('10 · 评估、可观测与生产化', '用数据集、trace、rubric 和成本指标替代主观“看起来不错”。', '为一个 agent 建立离线评测集与 regression gate。', '如何区分模型失败、工具失败和编排失败？', 'trace span 设计|token 成本|latency 分解|golden dataset|trajectory evaluation|LLM judge 偏差|human review|prompt versioning|red team|release gate'),
      unit('11 · RAG 与知识系统', '把检索系统视为数据管线、排序系统与权限系统的组合。', '构建带引用、过滤、评测与失效策略的 RAG。', '为什么“向量数据库 + prompt”不足以构成可靠知识问答？', '文档解析质量|chunking 策略|embedding 选择|hybrid retrieval|metadata filter|reranker|query rewrite|citation grounding|retrieval evaluation|index refresh'),
      unit('12 · Agent 安全与执行环境', '将提示注入、数据越权、工具滥用与供应链风险纳入架构。', '为文件操作 agent 设计策略引擎和审批矩阵。', '为什么 prompt 不能作为权限控制？', 'prompt injection|data exfiltration|least privilege|tool allowlist|filesystem sandbox|network egress|secret redaction|MCP trust|approval policy|audit incident'),
      unit('13 · 多协议与部署运行时', '掌握 API、MCP、stream、队列与长任务的生产组合。', '部署支持 streaming、resume 与 cancellation 的 agent service。', '什么条件下 agent 应改为异步工作流服务？', 'MCP architecture|streaming protocol|SSE backpressure|websocket tradeoff|async worker|job queue|tenant isolation|rate limiting|cost quota|deployment topology')
    ]
  },
  nuxt: {
    id: 'nuxt', name: 'Nuxt', symbol: 'N', color: '#2acb95', description: 'Vue 响应式、SSR、Nitro、质量与静态部署。', docs: 'https://nuxt.com/docs/', source: 'https://github.com/nuxt/nuxt',
    units: [
      unit('01 · Vue 响应式内核', '从 dependency tracking 到 effect scheduler 理解 Vue 的运行时。', '实现 mini reactive、computed、watchEffect。', '为什么解构 reactive 对象会丢失追踪？', 'Proxy get track|set trigger|effect stack|cleanup 依赖|ref 盒子|computed lazy|watch flush 时机|reactive 解构|toRef 与 toRefs|effectScope'),
      unit('02 · Vue 编译与渲染', '理解 template 如何变成 render function、VNode 和 patch。', '读编译产物并实现一个 keyed diff 反例。', 'key 为什么影响状态复用而不仅是性能？', 'template AST|render function|VNode shape flag|patch flag|block tree|keyed diff|component update|slot 编译|Teleport|Suspense'),
      unit('03 · Nuxt 应用生命周期', '区分 build-time、server request、hydration 与 navigation 生命周期。', '在不同生命周期记录日志并解释顺序。', '为何在 setup 顶层访问 window 会失败？', 'Nuxt app 创建|plugin 执行顺序|server render|payload 序列化|client hydration|route navigation|app hooks|runtime config|auto imports|error boundary'),
      unit('04 · SSR、CSR 与 Hydration', '用同构边界处理不可重复计算、浏览器 API 与交互恢复。', '修复时间、随机数、locale 导致的 hydration mismatch。', 'ClientOnly 是修复还是逃避？', 'universal rendering|client rendering|hydration 过程|mismatch 成因|ClientOnly|server-only code|browser-only API|useState 同构状态|islands 概念|SEO 取舍'),
      unit('05 · 路由、页面与中间件', '理解文件路由的匹配、参数、导航守卫和错误边界。', '构建带权限、草稿与 404 的嵌套路由。', 'route middleware 能替代服务端鉴权吗？', 'file based routes|dynamic params|catch all route|nested page|route middleware|navigateTo|definePageMeta|layouts|error.vue|route rules'),
      unit('06 · 数据获取与缓存', '把 useFetch/useAsyncData 的 key、dedupe、payload 作为缓存协议。', '封装有 abort、SWR 和稳定 key 的 useResource。', '为什么不稳定 key 会造成重复请求？', 'useAsyncData key|useFetch 封装|dedupe cancel|lazy 与 immediate|server false|watch sources|payload extraction|clear refresh|cached data|error 状态'),
      unit('07 · Server、Nitro 与 API', '理解 h3 handler、Nitro preset、runtime config 与边界部署。', '写一个带 schema、CORS 和 rate limit 的 server route。', '静态生成后为什么 server API 消失？', 'server routes|h3 event|request validation|Nitro storage|runtime config|routeRules cache|edge preset|node preset|CORS headers|server middleware'),
      unit('08 · 模块、插件与可组合性', '用 Nuxt module 和 composable 扩展框架，同时控制副作用。', '写一个注入 SDK 的 module 与 typed composable。', 'plugin 和 module 的职责边界？', 'defineNuxtPlugin|provide inject|plugin modes|composable conventions|Nuxt module setup|kit utilities|virtual files|runtime templates|layers|module testing'),
      unit('09 · 性能、可访问性与测试', '从 bundle、waterfall、render、interaction 四条证据线优化。', '测量一个页面的 LCP 与 hydration 成本并做预算。', '预取为什么也可能伤害性能？', 'route prefetch|component lazy|image optimization|payload size|bundle analyzer|web vitals|accessibility semantics|unit test|Nuxt test utils|e2e test'),
      unit('10 · 生产部署与源码阅读', '把构建产物、baseURL、静态托管与 Nuxt 内部实现对应起来。', '部署到 GitHub Pages 并处理子路径与刷新回退。', 'Nitro 如何把同一应用映射到不同平台？', 'nuxt build phases|vite integration|Nitro output|static generation|baseURL|asset paths|deployment preset|asyncData source|vue renderer|Nuxt repository tour'),
      unit('11 · 前端架构面试实战', '将状态、数据、边界、性能与可测试性组合为架构决策。', '重构一个失控页面为领域化前端模块。', '如何说明一个 composable 的职责边界是正确的？', '状态归属决策|server client boundary|error strategy|form architecture|design system|feature flags|observability|accessibility audit|test pyramid|migration strategy')
    ]
  },
  transformer: {
    id: 'transformer', name: 'Transformer', symbol: 'Tr', color: '#e99726', description: '从矩阵、注意力、训练动力学到模型系统。', docs: 'https://pytorch.org/docs/stable/generated/torch.nn.MultiheadAttention.html', source: 'https://github.com/huggingface/transformers',
    units: [
      unit('01 · 线性代数与张量记号', '让每一个矩阵乘法都有形状、语义和计算复杂度。', '为 attention 全程标注 B、T、D、H 形状。', '为什么 shape bug 往往比公式 bug 更常见？', '标量向量矩阵|batch 维度|einsum 记号|矩阵乘法形状|broadcast 规则|范数与归一化|softmax 性质|Jacobian 直觉|计算复杂度|数值稳定性'),
      unit('02 · Tokenization 与输入表示', '理解文本如何变 token id，再变成可训练表示。', '训练微型 BPE 并分析词表大小的取舍。', 'tokenizer 的边界如何影响模型能力和成本？', 'Unicode 规范化|byte level BPE|WordPiece|Unigram LM|special tokens|padding truncation|attention mask|embedding lookup|weight tying|position information'),
      unit('03 · Scaled Dot-Product Attention', '推导 QKᵀ、缩放、mask 与 softmax 的前后向行为。', '只用 torch 写 causal attention 并比对参考实现。', '为什么缩放是除以 sqrt(dk)？', 'Q K V 投影|相似度矩阵|scale 推导|softmax 稳定|causal mask|padding mask|attention weights|复杂度 O(T²)|gradient through softmax|flash attention 动机'),
      unit('04 · Multi-head 与位置编码', '理解 head 分解的表示空间、RoPE 的旋转几何与 KV cache。', '实现 RoPE 和 incremental decode cache。', 'KV cache 节省了什么，又增加了什么？', 'head reshape|output projection|absolute embedding|sinusoidal encoding|learned position|RoPE 推导|ALiBi bias|relative position|KV cache layout|grouped query attention'),
      unit('05 · Transformer Block 细节', '把 residual、norm、MLP、dropout 看作训练稳定性的系统。', '搭一个可切换 Pre-LN/Post-LN 的 block 对照实验。', 'Pre-LN 为什么更易训练深层网络？', 'residual path|LayerNorm 公式|RMSNorm|Pre-LN Post-LN|FFN expansion|GELU SwiGLU|dropout 位置|initialization|parameter count|activation memory'),
      unit('06 · 训练目标与优化', '从 next-token cross entropy 到 AdamW、schedule 和 gradient clipping。', '训练 tiny decoder 并记录 loss、grad norm、lr。', '为什么 weight decay 要与 Adam 解耦？', 'teacher forcing|cross entropy|label shift|perplexity|Adam moments|AdamW|warmup|cosine decay|gradient clipping|mixed precision'),
      unit('07 · 数据、评估与采样', '建立从数据清洗、split 到解码策略的可复现实验链。', '实现 top-k、top-p、temperature 并做定性评估。', '低 perplexity 一定代表更好对话吗？', 'dataset split|data leakage|packing sequences|evaluation loss|generation eval|greedy decode|temperature|top-k|nucleus sampling|repetition control'),
      unit('08 · 高效 Attention 与推理', '从 memory bandwidth、kernel fusion、cache 到量化理解吞吐。', 'profile 标准 attention 与 SDPA 的差异。', '推理为什么常受内存带宽而非 FLOPs 限制？', 'FlashAttention|SDPA backend|memory bandwidth|prefill decode|continuous batching|paged KV cache|quantization basics|speculative decoding|tensor parallel|serving metrics'),
      unit('09 · 微调与对齐', '区分 full fine-tuning、PEFT、SFT、偏好优化和安全评估。', '用 LoRA 微调小模型并审计数据格式。', 'LoRA 为什么可用低秩更新逼近任务变化？', 'instruction data|SFT loss|LoRA matrices|rank alpha|QLoRA|prompt tuning|DPO intuition|reward model|catastrophic forgetting|safety evaluation'),
      unit('10 · 从零实现 Mini-GPT', '将 tokenizer、模型、训练、checkpoint、sampling 组成可验证闭环。', '完成字符级 GPT 并写一页架构复盘。', '训练和推理阶段每一层的张量形状是什么？', 'config design|embedding module|attention module|block stack|lm head|training loop|checkpoint resume|sampling API|unit tests|scaling diagnosis'),
      unit('11 · 模型架构与变体', '理解 encoder、decoder、MoE、长上下文与多模态在结构上的变化。', '比较三个架构变体的 FLOPs、显存和适配任务。', 'MoE 为什么降低训练计算却提高系统复杂度？', 'encoder decoder|encoder-decoder|cross attention|mixture of experts|router loss|long context|sliding window|state space contrast|vision transformer|multimodal projector'),
      unit('12 · LLM 系统设计面试', '将模型能力、数据、训练、服务、评估变成端到端系统设计。', '设计一个有成本、延迟、质量目标的生成系统。', '何时应该优化 prompt、检索、模型还是系统？', 'capacity planning|quality metrics|latency budget|token cost|model routing|cache layers|batching|fallback model|safety filters|online evaluation')
    ]
  },
  torch: {
    id: 'torch', name: 'PyTorch', symbol: '⚡', color: '#ec6756', description: 'Tensor 存储、Autograd、GPU、分布式与源码。', docs: 'https://pytorch.org/docs/stable/', source: 'https://github.com/pytorch/pytorch',
    units: [
      unit('01 · Tensor、Storage 与 Stride', '看穿 shape 下的 storage_offset、stride 与 view 语义。', '手算 stride，构造 transpose、slice、as_strided 实验。', 'view 为什么不保证零拷贝成功？', 'Tensor metadata|Storage|dtype device|shape 与 numel|stride 计算|storage offset|contiguous|view reshape|transpose permute|as_strided 风险'),
      unit('02 · 索引、广播与算子语义', '精确把握 indexing 产生 view 还是 copy，以及 broadcast 的梯度聚合。', '实现复杂索引并用 data_ptr 验证别名。', 'broadcast backward 为什么需要 reduce？', 'basic indexing|advanced indexing|boolean mask|ellipsis None|broadcast alignment|expand 与 repeat|in-place 约束|type promotion|einsum|operator dispatch'),
      unit('03 · Autograd 图与反向传播', '以 VJP、grad_fn、saved tensors 理解每轮动态计算图。', '画出一段计算的 autograd graph 并手推梯度。', '动态图为什么适合 Python 控制流？', 'requires_grad|leaf tensor|grad_fn|dynamic graph|reverse mode AD|VJP|saved tensors|backward accumulation|retain_graph|no_grad inference_mode'),
      unit('04 · 自定义 Autograd 与数值验证', '实现 Function 时保存最小上下文，并用 gradcheck 验证导数。', '手写 Swish 或 LayerNorm 的 forward/backward。', 'in-place 为什么会触发 version counter 错误？', 'torch.autograd.Function|ctx save_for_backward|forward backward|double backward|gradcheck|gradgradcheck|version counter|anomaly detection|detach|custom op boundary'),
      unit('05 · nn.Module 与参数管理', '理解 module tree、parameter registration、state_dict 与 hooks。', '实现可序列化模块并写 state_dict 迁移。', '普通 Tensor 为什么不会自动被 optimizer 更新？', 'Module init|Parameter registration|buffer registration|children modules|forward hook|state_dict|load_state_dict|train eval mode|lazy modules|weight sharing'),
      unit('06 · 数据管线与训练循环', '将 Dataset、Sampler、DataLoader、optimizer 和 scheduler 组成可恢复训练。', '实现可复现的数据加载和 checkpoint resume。', '多 worker 如何影响随机性与内存？', 'map iterable dataset|sampler|collate function|worker process|pin memory|persistent workers|optimizer step|zero grad|lr scheduler|checkpoint schema'),
      unit('07 · CUDA、内存与性能', '分清异步执行、同步点、显存分配器与 kernel 级瓶颈。', '用 profiler 定位一个 GPU 利用率低的训练循环。', '为什么 GPU 计时要显式同步？', 'CUDA stream|async launch|synchronize|memory allocator|reserved allocated|pin memory|non_blocking copy|kernel launch|mixed precision|memory leak'),
      unit('08 · Distributed 与并行训练', '从 process group、all-reduce 到 DDP/FSDP 的梯度同步模型。', '将单卡训练改成最小 DDP 并验证等价性。', 'DDP 为什么要求每个进程一张 GPU？', 'process group|rank world size|all reduce|DDP reducer|gradient bucket|DistributedSampler|FSDP sharding|activation checkpoint|tensor parallel|fault tolerance'),
      unit('09 · torch.compile 与图捕获', '理解 Dynamo、AOTAutograd、Inductor 及 graph break 的约束。', '定位 graph break，重构后比较吞吐。', 'Python side effect 为什么会破坏捕获？', 'torch.compile modes|Dynamo guards|graph break|AOTAutograd|Inductor fusion|dynamic shapes|fake tensor|backend selection|debug logs|compile cache'),
      unit('10 · PyTorch 源码与扩展', '从 ATen dispatch、autograd engine 到 C++/CUDA extension 建立路线图。', '跟踪一个 aten 算子，并实现小型 C++ extension。', 'dispatcher 如何选择 CPU、CUDA、Autograd kernel？', 'ATen tensor|dispatcher keys|operator registration|native functions|autograd engine|TensorIterator|C++ extension|CUDA extension|custom library op|source build'),
      unit('11 · 模型压缩与部署', '连接量化、导出、推理 runtime 与模型正确性验收。', '量化一个模型并对齐精度、延迟、显存指标。', 'PTQ 与 QAT 的误差来源如何不同？', 'quantization basics|PTQ|QAT|pruning|distillation|torch export|ONNX boundary|TorchScript legacy|inference mode|deployment validation'),
      unit('12 · 深度学习系统面试', '从训练失败、吞吐异常、OOM 到多机扩展建立诊断框架。', '完成一个 OOM 和一个慢训练案例的根因报告。', '如何从指标推断瓶颈在数据、算子、通信还是显存？', 'OOM triage|throughput model|data bottleneck|kernel bottleneck|communication overlap|numerical instability|reproducibility|debug checklist|capacity planning|incident postmortem')
    ]
  }
}

const expertSignals = /CPython|evaluation loop|specializing|Compiler API|checker|Pregel|durable|checkpoint|PagedAttention|KV Cache|scheduler|autograd engine|dispatcher|Dynamo|AOTAutograd|Inductor|FSDP|tensor parallel|pipeline parallel|QLoRA|quantization|Jacobian|数值稳定|C3|MRO|vectorcall|bytecode|subgraph|多 Agent|sandbox|memory allocator/i
const difficultSignals = /descriptor|closure|闭包|yield from|TaskGroup|variance|逆变|协变|conditional type|infer|moduleResolution|hydration|reducer|interrupt|middleware|structured output|RAG|attention|softmax|backprop|gradcheck|broadcast|stride|view|DDP|LoRA|adapter|continuous batching|prefix cache|copy on write/i
const simpleSignals = /基本|概览|角色|命名|标量|向量|矩阵|shape|安装|配置|getter setter|可选参数|stop tokens|temperature|top-k|top-p/i
const highValueSignals = /对象|属性|闭包|异常|async|并发|类型|泛型|narrow|模块|SSR|hydration|数据获取|Agent|tool|middleware|state|reducer|checkpoint|attention|token|训练|autograd|Module|CUDA|distributed|compile|PagedAttention|scheduler|LoRA|QLoRA/i
const foundationSignals = /基础|基本|对象|名称|值|shape|标量|向量|矩阵|消息|模型|State|Tensor|响应式|运行时|低秩/i

function assessLesson(trackId: TrackId, moduleOrder: number, title: string) {
  let difficulty: LessonDifficulty = '中等'
  if (expertSignals.test(title)) difficulty = '专家'
  else if (difficultSignals.test(title)) difficulty = '困难'
  else if (simpleSignals.test(title)) difficulty = '简单'

  const systemicTrack = ['langgraph', 'deepagents', 'vllm', 'torch'].includes(trackId)
  if (systemicTrack && moduleOrder >= 8 && difficulty === '中等') difficulty = '困难'

  const learningValueScore = (highValueSignals.test(title) ? 5 : foundationSignals.test(title) ? 4 : moduleOrder <= 2 ? 4 : 3) as 1 | 2 | 3 | 4 | 5
  const learningValue: LearningValue = learningValueScore === 5
    ? '高频核心'
    : learningValueScore === 4
      ? '基础必修'
      : moduleOrder >= 8
        ? '进阶关键'
        : '专项拓展'
  const estimatedMinutes = difficulty === '简单' ? 25 : difficulty === '中等' ? 45 : difficulty === '困难' ? 70 : 100
  const granularity: LessonGranularity = difficulty === '简单'
    ? '合并基础课'
    : difficulty === '专家'
      ? '拆分专题'
      : '单点精讲'
  const difficultyReason = difficulty === '简单'
    ? '核心规则较少，可通过一个最小实验直接观察，适合与相邻基础概念合并学习。'
    : difficulty === '中等'
      ? '需要同时掌握公开契约、一个主要失败边界和对应实现路径。'
      : difficulty === '困难'
        ? '涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。'
        : '横跨运行时、编译器或分布式系统边界，必须拆成多个积木并完成源码级复现。'
  return { difficulty, difficultyReason, learningValue, learningValueScore, estimatedMinutes, granularity }
}

function materialize(track: Omit<Track, 'lessons'> & { units: UnitSeed[] }): Track {
  let lessonOrder = 0
  return {
    ...track,
    lessons: track.units.flatMap((section, sectionIndex) => section.topics.map((topic, topicIndex) => ({
      ...assessLesson(track.id, sectionIndex + 1, topic.title),
      ...topic,
      id: `${track.id}-${String(sectionIndex + 1).padStart(2, '0')}-${String(topicIndex + 1).padStart(2, '0')}`,
      order: ++lessonOrder,
      title: topic.title,
      module: section.title,
      moduleOrder: sectionIndex + 1,
      objective: `${section.goal} 本节将聚焦「${topic.title}」，要求你能给出机制解释、最小反例与工程取舍。`,
      practice: `${section.lab} 本题任务：围绕「${topic.title}」写出一个最小可运行实现，并补齐至少三个边界用例。`,
      interview: `${section.interview} 请结合「${topic.title}」用“结论 → 机制 → 证据 → 取舍”四步作答。`,
      docs: track.docs,
      source: track.source,
      why: `「${topic.title}」并非孤立 API。它位于「${section.title}」的设计边界上：${section.goal} 你需要解释这个抽象替代了什么更脆弱的写法，以及它在复杂系统中换来了什么可维护性、可观测性或性能收益。`,
      sourceFocus: sourceFocus(track.id, sectionIndex + 1, topic.title),
      rebuild: `先只保留「${topic.title}」的最小接口和状态；再实现成功路径；随后加入一个明确的失败路径与测试；最后对照上游实现，记录你遗漏的一条不变量。`,
      interviewSource: interviewSources[track.id] || interviewSources.python
    })))
  }
}

const sourceMaps: Record<string, string[]> = {
  python: ['Include/object.h 与 Objects/object.c', 'Objects/typeobject.c', 'Objects/funcobject.c', 'Objects/genobject.c 与 Python/ceval.c', 'Python/errors.c 与 Lib/contextlib.py', 'Lib/importlib 与 Python/import.c', 'Lib/typing.py', 'Lib/asyncio/tasks.py', 'Python/specialize.c', 'Python/bytecodes.c'],
  typescript: ['src/compiler/parser.ts', 'src/compiler/checker.ts', 'src/compiler/checker.ts', 'src/compiler/checker.ts', 'src/compiler/types.ts', 'src/compiler/transformers', 'src/compiler/moduleNameResolver.ts', 'src/compiler/commandLineParser.ts', 'src/compiler/declarationEmitter.ts', 'src/compiler/program.ts'],
  langgraph: ['libs/langgraph/langgraph/graph', 'libs/langgraph/langgraph/graph/message.py', 'libs/langgraph/langgraph/graph/state.py', 'libs/checkpoint', 'libs/langgraph/langgraph/pregel', 'libs/langgraph/langgraph/types.py', 'libs/langgraph/langgraph/store', 'libs/langgraph/langgraph/pregel', 'libs/langgraph/tests', 'libs/langgraph/docs'],
  langchain: ['libs/core/langchain_core/messages', 'libs/core/langchain_core/language_models', 'libs/core/langchain_core/prompts', 'libs/core/langchain_core/tools', 'libs/langchain/langchain/agents', 'libs/langchain/langchain/agents/middleware', 'libs/core/langchain_core/runnables', 'libs/langchain/langchain/agents/structured_output', 'libs/langchain/tests', 'libs/core/langchain_core'],
  deepagents: ['libs/deepagents/deepagents', 'libs/deepagents/deepagents/middleware', 'libs/deepagents/deepagents/backends', 'libs/deepagents/deepagents/subagents'],
  vllm: ['vllm/core/scheduler.py', 'vllm/v1/core/kv_cache_manager.py', 'vllm/attention', 'vllm/engine', 'vllm/entrypoints/openai', 'vllm/config'],
  lora: ['src/peft/tuners/lora', 'src/peft/mapping.py', 'src/peft/utils', 'src/peft/tuners', 'src/peft/tests'],
  nuxt: ['packages/nuxt/src/app', 'packages/nuxt/src/core', 'packages/kit/src', 'packages/nitro'],
  transformer: ['src/transformers/models', 'src/transformers/trainer.py', 'src/transformers/generation'],
  torch: ['torch/csrc/autograd', 'aten/src/ATen', 'torch/_dynamo', 'torch/nn']
}
const interviewSources: Record<string, string> = {
  python: 'https://www.nowcoder.com/discuss/518591631864446976',
  typescript: 'https://www.nowcoder.com/discuss/517852889394446336',
  langchain: 'https://www.nowcoder.com/discuss/comment/22623788',
  langgraph: 'https://www.nowcoder.com/discuss/882573284426932224',
  deepagents: 'https://www.nowcoder.com/discuss/comment/22623788',
  vllm: 'https://www.nowcoder.com/discuss/882573284426932224',
  lora: 'https://www.nowcoder.com/discuss/769275190441148416',
  nuxt: 'https://www.nowcoder.com/discuss/422469',
  transformer: 'https://www.nowcoder.com/discuss/769275190441148416',
  torch: 'https://www.nowcoder.com/discuss/769275190441148416'
}
function sourceFocus(trackId: string, moduleOrder: number, title: string) {
  const path = sourceMaps[trackId]?.[moduleOrder - 1] || '仓库根目录与 tests'
  return `从 ${path} 开始，先搜索 “${title}” 或相邻公开 API；优先阅读测试，再阅读调用点，最后进入核心实现。`
}

const advancedTracks: Array<Omit<Track, 'lessons'> & { units: UnitSeed[] }> = [
  {
    id: 'langchain', name: 'LangChain', symbol: 'LC', color: '#7655e8', description: '模型、消息、工具、Agent、Middleware 与从零复现。', docs: 'https://docs.langchain.com/oss/python/langchain/overview', source: 'https://github.com/langchain-ai/langchain', units: [
      unit('01 · Core 抽象与消息契约', '建立 Message、Model、Prompt、Runnable 的最小抽象，并理解为什么它们可组合。', '手写 BaseMessage、ChatModel 和可串联 Runnable。', '为什么消息对象比裸字符串更适合 Agent 系统？', '消息角色与 content blocks|BaseMessage 不变量|ChatModel 输入输出|Prompt 变量绑定|Runnable invoke|batch 与 stream|config 传播|callback 事件|序列化边界|错误语义|同步异步双接口|最小核心复现'),
      unit('02 · Provider 与模型适配层', '让业务代码依赖统一模型接口，而非供应商 payload。', '实现一个 OpenAI-compatible adapter 与 fake model。', '适配层是抽象泄漏还是长期成本控制？', 'provider capability|模型参数映射|token usage|stream chunk 标准化|tool binding|structured output|rate limit|fallback model|模型路由|mock provider|integration contract|adapter 测试'),
      unit('03 · Prompt、Output 与结构化结果', '将 prompt 视为版本化程序，并用 schema 约束可消费结果。', '实现 template、parser、repair loop。', '何时应让 provider 原生结构化输出，何时走 tool strategy？', 'template rendering|chat prompt|partial variables|few shot|output parser|JSON schema|Pydantic schema|parse retry|format injection|prompt version|prompt test|rebuild parser'),
      unit('04 · Tool 系统与执行器', '从 callable、schema、权限到运行时执行重建工具系统。', '实现 tool decorator、参数校验、超时与错误包装。', 'tool description 为什么是系统行为的一部分？', 'tool contract|docstring schema|argument coercion|sync async tool|tool error|timeout|retry policy|idempotency|permission gate|tool registry|parallel calls|tool executor'),
      unit('05 · Agent Loop 从零实现', '手写 “模型决定工具，工具回写消息，直到结束” 的核心循环。', '实现最小 ReAct/tool-calling loop 并处理无限循环。', '标准 loop 的停止条件和预算应在哪里？', 'agent state|tool call message|observation append|stop condition|max iterations|token budget|retry classification|parallel tool calls|dynamic tool filter|error recovery|trace record|loop rebuild'),
      unit('06 · Middleware 与横切能力', '将日志、重试、限额、安全与模型选择从业务节点剥离。', '实现 before/after/wrap_model/wrap_tool hooks。', '为什么 middleware 比在 agent 内塞 if/else 更可维护？', 'hook ordering|request context|response transform|tool wrapping|model selection|rate limit|PII redaction|HITL middleware|summarization|fallback|cost guard|custom middleware'),
      unit('07 · Memory、Context 与压缩', '区分消息历史、工作记忆、长期记忆与外部检索。', '实现 token budget 下的摘要压缩策略。', '摘要会损失信息，为什么还要压缩？', 'short term state|trim policy|summarization|memory store|retrieval memory|namespace|user isolation|context ordering|lost in middle|token accounting|memory evaluation|context rebuild'),
      unit('08 · RAG 与检索抽象', '把 document、splitter、embedding、retriever、reranker 组织为可评测管线。', '重建一个带引用和混合检索的最小 RAG。', '为什么 RAG 的主要失败常发生在检索而非生成？', 'document model|loader boundary|chunking variants|embedding interface|vector store|hybrid search|metadata filter|reranker|query transform|citation|offline eval|RAG rebuild'),
      unit('09 · 测试、追踪与评测', '让非确定性 Agent 仍拥有可回归的工程质量门。', '使用 fake model 写 unit test，再写 trajectory eval。', 'Agent 测试为什么不能只断言最终文本？', 'fake chat model|unit boundary|integration test|record replay|trajectory eval|tool sequence|LLM judge bias|golden dataset|trace schema|cost metric|latency metric|release gate'),
      unit('10 · 手撸 LangChain 架构', '把核心包切成可替换、可测试、可观测的边界。', '完成 mini-langchain：model、prompt、tool、agent、middleware、tests。', '哪些部分必须抽象，哪些部分应留给业务？', 'package layout|public API|dependency direction|plugin registry|configuration|error taxonomy|sync async|serialization|tracing|testing matrix|compatibility|architecture review')
    ]
  },
  {
    id: 'deepagents', name: 'Deep Agents', symbol: 'DA', color: '#b35ee5', description: '规划、文件系统、上下文管理、子代理与受控执行。', docs: 'https://docs.langchain.com/oss/python/deepagents/overview', source: 'https://github.com/langchain-ai/deepagents', units: [
      unit('01 · Harness 定位与边界', '理解 Harness 在 framework 与 runtime 之上补齐了什么。', '比较最小 LangChain agent 与 Deep Agent 的状态表面。', '何时 harness 会过度设计？', 'framework runtime harness|opinionated defaults|todo loop|filesystem tools|context management|subagent tool|permission surface|model agnostic|cost tradeoff|selection guide'),
      unit('02 · Todo、规划与任务分解', '将规划从 prompt 习惯提升为可审计状态。', '复现 write_todos 并实现依赖与重排。', 'todo 有什么比单段 CoT 更工程化？', 'task schema|dependency graph|progress update|replan|failure state|priority|budget|plan visibility|tool feedback|completion criteria|planner rebuild'),
      unit('03 · 文件系统与 Backend', '通过后端协议隔离临时上下文、持久资料与真实主机。', '实现一个内存 VFS 和路径权限判定。', '为什么 agent 文件系统必须虚拟化？', 'StateBackend|FilesystemBackend|StoreBackend|CompositeBackend|path routing|virtual files|read write edit|glob grep|image read|backend protocol|backend rebuild'),
      unit('04 · Shell、Sandbox 与权限', '把 execute 工具放进最小权限、安全审计与人工批准框架。', '设计命令 allowlist 和危险操作审批矩阵。', 'LocalShellBackend 为什么只能用于受控环境？', 'sandbox boundary|shell policy|egress control|path allowlist|command allowlist|secret redaction|human approval|audit log|resource limit|kill switch|threat model|secure rebuild'),
      unit('05 · 子代理与上下文隔离', '让专长代理解决上下文污染，而非制造协调地狱。', '实现 researcher/coder/reviewer 子代理合同。', '何时 subagent 应同步，何时并行？', 'task tool|subagent schema|context quarantine|specialized prompt|result contract|delegation policy|parallelism|cancellation|aggregation|conflict resolution|trace hierarchy|subagent rebuild'),
      unit('06 · 上下文压缩与 Memory', '理解 eviction、summary、filesystem offload 的组合。', '构建长任务的上下文预算模拟器。', '把结果落盘为何比一直塞在 messages 更可靠？', 'context pressure|message eviction|auto summary|artifact offload|file references|memory store|retrieval|compaction loss|budget policy|long task|context eval|memory rebuild'),
      unit('07 · Skill 与可复用工作流', '把能力沉淀为显式、可版本化的 instructions 和工具组合。', '设计一个可测试的代码评审 skill。', 'skill 与 prompt 模板的区别在哪里？', 'skill manifest|instruction scope|tool binding|artifact contract|versioning|skill discovery|dependency|test fixture|security review|quality rubric|distribution|skill rebuild'),
      unit('08 · 生产治理与复现', '将权限、trace、成本、回放、评估联结为 Agent 操作系统。', '为一个 coding agent 制定上线 gate。', '如何证明 agent 的成功不是偶然？', 'trace replay|policy eval|cost quota|latency budget|incident response|audit trail|rollback|human override|test scenario|red team|release gate|harness rebuild')
    ]
  },
  {
    id: 'vllm', name: 'vLLM', symbol: 'vL', color: '#f36b53', description: 'PagedAttention、调度、KV Cache 与 OpenAI-compatible serving。', docs: 'https://docs.vllm.ai/', source: 'https://github.com/vllm-project/vllm', units: [
      unit('01 · 推理服务的性能模型', '从 prefill/decode、吞吐/延迟、显存/带宽建立服务决策模型。', '计算不同请求形态下的 token 吞吐预算。', '为什么 decode 常常受 memory bandwidth 限制？', 'prefill decode|TTFT TPOT|batching tradeoff|GPU occupancy|memory bandwidth|request shape|SLO|queueing|throughput metric|capacity model|service baseline'),
      unit('02 · PagedAttention 与 KV Cache', '理解 KV cache 的块化管理为何能降低碎片与浪费。', '手写 block table 模拟器并测算浪费率。', 'PagedAttention 借鉴了虚拟内存的什么思想？', 'KV cache layout|block size|block table|logical physical block|fragmentation|sharing|copy on write|prefix cache|eviction|cache metric|paged attention rebuild'),
      unit('03 · Scheduler 与 Continuous Batching', '让请求在 token 级调度中平衡吞吐、延迟与公平。', '实现简化 scheduler，比较 FCFS 与 token budget。', 'continuous batching 和 static batching 的根本差异？', 'request states|waiting running|token budget|prefill scheduling|decode scheduling|preemption|fairness|chunked prefill|priority|admission control|scheduler rebuild'),
      unit('04 · Engine、Executor 与并行', '追踪 engine 从请求到 model runner，再到 worker 的执行路径。', '搭建离线 engine 与单机 API server 对照。', 'tensor parallel 为什么会带来通信瓶颈？', 'LLMEngine|AsyncLLMEngine|model runner|executor|worker|tensor parallel|pipeline parallel|Ray backend|collective comm|failure handling|engine rebuild'),
      unit('05 · OpenAI API、Streaming 与工具调用', '对齐协议、SSE、取消、usage 与错误语义。', '实现一个兼容 chat completions 的最小代理。', 'OpenAI-compatible 不等于行为完全一致，差异在哪里？', 'chat completions|responses semantics|SSE chunks|stream cancellation|sampling params|logprobs|tool calls|structured output|error codes|usage|API contract|server rebuild'),
      unit('06 · Sampling 与推理质量', '理解 sampling 配置会怎样改变并发、cache 与输出分布。', '实现 temperature/top-p/beam 的小型采样器。', '为什么不同 decoding 策略需要不同服务预算？', 'temperature|top-k|top-p|min-p|beam search|best of|stop tokens|seed|logit bias|guided decoding|sampling test|sampler rebuild'),
      unit('07 · LoRA、多 LoRA 与量化', '把 adapter 加载和 quantized base model 纳入 serving 资源模型。', '配置 multi-LoRA 路由与隔离测试。', '多 LoRA 如何影响 cache、调度和显存？', 'LoRA request|adapter cache|multi LoRA|rank limit|quantization formats|AWQ GPTQ|FP8 KV|accuracy tradeoff|hot swap|tenant isolation|metrics|serving rebuild'),
      unit('08 · 观测、调优与生产故障', '从指标到 profile 诊断排队、cache、kernel 和通信瓶颈。', '针对 TTFT 变差完成一次假想事故复盘。', '先调 batch、cache 还是模型并行？', 'Prometheus metrics|TTFT spike|queue depth|cache hit rate|GPU utilization|profiling|trace|load test|autoscaling|OOM recovery|incident runbook|production rebuild')
    ]
  },
  {
    id: 'lora', name: 'LoRA · PEFT', symbol: 'Lo', color: '#d76e91', description: '低秩适配、PEFT、QLoRA、adapter 生命周期与训练诊断。', docs: 'https://huggingface.co/docs/peft/main/conceptual_guides/lora', source: 'https://github.com/huggingface/peft', units: [
      unit('01 · 低秩更新的数学与动机', '从 ΔW=BA 的秩约束理解为什么冻结 base 仍能适配任务。', '用 SVD 对比全量更新与低秩近似。', 'rank deficiency 与 LoRA 有什么关系？', 'full fine tune cost|low rank matrix|BA decomposition|rank r|scaling alpha|frozen base|parameter count|gradient path|SVD intuition|inference merge|math rebuild'),
      unit('02 · Adapter 注入与目标层', '理解 target_modules 决定了适配能力、参数量和风险。', '向 attention q/v 与 MLP 层分别注入 LoRA。', '为什么常从 attention projection 开始？', 'Linear wrapper|target modules|qkv projection|MLP targets|module name matching|fan in fan out|bias modes|weight tying|adapter naming|injection test|module rebuild'),
      unit('03 · 初始化、缩放与优化', '从零初始化和 alpha/r 缩放理解训练稳定性。', '比较不同 rank、alpha、dropout 的收敛曲线。', 'B 初始化为零为什么保持初始等价？', 'A Kaiming init|B zero init|alpha scaling|RSLoRA|dropout|learning rate|weight decay|gradient norm|rank sweep|seed variance|optimizer rebuild'),
      unit('04 · PEFT 框架与训练循环', '复现 config、wrap、state_dict、trainer 之间的边界。', '手写 mini PeftModel 与 adapter-only checkpoint。', 'adapter checkpoint 为什么不含完整 base 权重？', 'LoraConfig|get_peft_model|PeftModel|trainable params|save adapter|load adapter|state dict keys|merge unload|multiple adapters|trainer integration|framework rebuild'),
      unit('05 · QLoRA 与内存预算', '分离量化 base、adapter 权重、optimizer state 和 activation memory。', '为给定 GPU 估算 QLoRA 可训练上下文长度。', '4-bit base 为什么仍能反向训练 adapter？', 'NF4|double quantization|compute dtype|paged optimizer|memory accounting|activation checkpoint|sequence packing|gradient accumulation|LoftQ|quality tradeoff|QLoRA rebuild'),
      unit('06 · Adapter 合并、路由与服务', '处理 merge、weighted merge、hotswap 与多租户 adapter 生命周期。', '实现 adapter router 和安全回退。', '什么时候不能 merge adapter？', 'merge adapter|unmerge|weighted merge|adapter composition|hotswap|multi tenant|versioning|base compatibility|serving cache|rollback|router rebuild'),
      unit('07 · LoRA 变体与选择', '比较 AdaLoRA、DoRA、LoRA+、LoRA-FA 的问题假设。', '为资源受限任务设计 variant 选择实验。', '变体什么时候是必要的，什么时候是复杂度税？', 'AdaLoRA rank allocation|DoRA magnitude|LoRA plus LR|LoRA FA memory|RSLoRA|PiSSA|OFT comparison|evaluation design|ablation|selection matrix|variant rebuild'),
      unit('08 · 数据、评测与失败诊断', '让 adapter 训练在数据质量、遗忘、过拟合和任务漂移下可解释。', '完成一次 LoRA 失效的诊断报告。', 'loss 降了但业务效果差，先查哪里？', 'instruction format|data leakage|eval split|catastrophic forgetting|overfit signals|hallucination eval|rank underfit|target mismatch|base mismatch|safety regression|diagnostic rebuild')
    ]
  }
]

export const tracks: Track[] = [...Object.values(catalogue), ...advancedTracks].map(materialize)
export const getTrack = (id: string) => tracks.find(track => track.id === id)
export const getLesson = (trackId: string, lessonId: string) => getTrack(trackId)?.lessons.find(lesson => lesson.id === lessonId)
