import type { TopicGuide } from '../../topic-guides'

export const pythonExceptionGuides: Record<string, TopicGuide> = {
  '异常对象、traceback 链与处理器生命周期': {
    official: {
      title: 'Data model · Exceptions',
      url: 'https://docs.python.org/3/reference/datamodel.html#exceptions',
      note: 'traceback 由 tb_frame、tb_lasti、tb_lineno、tb_next 组成；异常对象通过 __traceback__ 持有传播路径。'
    },
    overview: [
      '异常不是一段打印文本。它是携带类型、参数、notes、显式原因、隐式上下文和 traceback 的对象；traceback 又逐帧指向 frame，frame 持有 locals 与 globals。保存一个异常，可能间接延长整条调用栈上大对象的生命周期。',
      '传播时，每离开一个 Python frame，运行时都会在 traceback 链加入节点。显示顺序通常从最外层调用到最内层失败点；对象链的遍历则由 __traceback__ 和 tb_next 提供结构化证据，可用于日志裁剪、错误分组和测试。',
      'except Exception as exc 结束后，名称 exc 会被自动删除，因为 exc → traceback → frame → locals → exc 会形成环。sys.exception() 保存当前处理器的异常，并在嵌套处理器结束后恢复外层异常。'
    ],
    mechanisms: [
      'BaseException.args 是构造参数元组；自定义异常应把稳定的机器字段另存为显式属性。',
      '__traceback__ 指向链头，每个节点关联一个 frame 和下一节点。',
      'add_note() 可追加补充上下文，不必改变异常类型或 message。',
      '处理器目标在退出时清除；若需长期保存，应提取必要字段并考虑 traceback.clear_frames。'
    ],
    pitfalls: [
      '把异常对象放进无限期缓存或队列，意外保留请求 frame 中的大张量、响应体和密钥。',
      '依赖 str(exc) 解析业务字段，message 改动就破坏调用方。',
      '记录 traceback 后再次无界拼接本地变量，造成敏感信息泄漏和日志爆炸。'
    ],
    example: `import sys
import traceback
import weakref

class Payload:
    pass

def fail():
    payload = Payload()
    watch = weakref.ref(payload)
    try:
        raise ValueError("invalid")
    except ValueError as exc:
        assert sys.exception() is exc
        frames = traceback.extract_tb(exc.__traceback__)
        assert frames[-1].name == "fail"
        return exc, watch

error, watch = fail()
assert watch() is not None          # traceback 的 frame 仍持有 payload
traceback.clear_frames(error.__traceback__)
del error                           # 生产代码也应释放最后的异常引用`,
    buildSteps: [
      { title: '画引用图', body: '从 exception.__traceback__ 走到 tb_frame.f_locals，再回到 exception，标出可能形成的环。' },
      { title: '实现结构化错误', body: '定义包含 code、resource_id、retryable 的异常，message 仅用于人读，测试读取显式字段。' },
      { title: '做保留实验', body: '用 weakref 观察局部大对象在保存异常前后何时可回收，并用 traceback.clear_frames 验证。' }
    ],
    selfCheckQuestion: '为什么 Python 会在 except 块结束时自动删除 as 绑定的异常名称？',
    selfCheckAnswer: '异常持有 traceback，traceback 持有当前 frame，frame.locals 若继续持有该异常名称就形成强引用环。自动删除缩短对象与整帧局部变量的保留时间；外部仍可显式保存异常，但此时必须承担 traceback 带来的内存与敏感信息成本。'
  },
  '异常匹配、层级设计与捕获边界': {
    official: {
      title: 'Compound statements · except clause',
      url: 'https://docs.python.org/3/reference/compound_stmts.html#except-clause',
      note: 'except 从上到下选择第一个类型匹配的处理器；匹配基于异常类的非虚基类层级。'
    },
    overview: [
      'except 处理的是类型合同。运行时按源码顺序寻找第一个匹配类或其子类的子句，因此宽泛处理器放在前面会使更具体分支永远不可达。异常层级决定调用者能以多粗或多细的粒度恢复。',
      '库应把“可重试”“调用参数错误”“外部依赖失败”“内部不变量损坏”等操作语义编码进类型层级或稳定字段。调用者捕获的是自己有能力处理的边界，无法恢复的异常应继续传播。',
      'Exception 排除了 KeyboardInterrupt、SystemExit、GeneratorExit 等进程或控制流信号；捕获 BaseException 通常只适用于必须清理后重新抛出的底层边界。'
    ],
    mechanisms: [
      '多个 except 按顺序只运行一个，匹配成功后不再尝试后续分支。',
      '元组可合并采用相同恢复策略的异常类型。',
      '自定义业务异常通常继承 Exception，并提供一个稳定根类供调用者做粗粒度处理。',
      '捕获范围应尽量包围会发生预期错误的最小语句，else 承载成功后可能另行失败的代码。'
    ],
    pitfalls: [
      'except Exception: pass 同时吞掉编程错误、依赖失败和数据损坏。',
      '先捕获 Exception 再写 ValueError 分支，后者永远到不了。',
      '为了统一接口把所有异常都改成同一个 message，丢失可重试性与原始 cause。'
    ],
    example: `class StorageError(Exception):
    """调用者可统一记录的存储层根异常。"""

class TransientStorageError(StorageError):
    retryable = True

class CorruptRecordError(StorageError):
    retryable = False

def policy(exc):
    if isinstance(exc, TransientStorageError):
        return "retry"
    if isinstance(exc, CorruptRecordError):
        return "quarantine"
    if isinstance(exc, StorageError):
        return "fail-request"
    raise exc

assert policy(TransientStorageError()) == "retry"
assert policy(CorruptRecordError()) == "quarantine"`,
    buildSteps: [
      { title: '列出恢复动作', body: '先列 retry、fallback、reject、abort-process，再让每类异常只映射到调用者确实能做的动作。' },
      { title: '设计层级', body: '建立稳定根类与少量操作性子类；变化频繁的细节放属性，不无限扩张类型树。' },
      { title: '审计捕获范围', body: '为每个 except 标注“为何能恢复”，删除只记录后继续执行的宽泛捕获。' }
    ],
    selfCheckQuestion: '为什么“只捕获你能处理的异常”比“所有边界都 except Exception”更可靠？',
    selfCheckAnswer: '捕获意味着当前层承诺能恢复、转换或补充信息。宽泛捕获会把程序错误与可预期业务失败混在一起，常导致损坏状态继续运行。让未知异常传播可保留失败可见性；清理应交给 finally/with，不需要以吞掉异常为代价。'
  },
  'raise、bare raise 与 traceback 保真': {
    official: {
      title: 'Simple statements · The raise statement',
      url: 'https://docs.python.org/3/reference/simple_stmts.html#the-raise-statement',
      note: '无参数 raise 重抛当前活动异常；raise exc 在当前位置再次抛对象，会把当前处理器位置加入 traceback。'
    },
    overview: [
      'bare raise 表示继续传播当前活动异常，保留原失败栈形状。raise exc 会执行一次新的 raise，把当前这一行加入 traceback；两者常打印出相似类型，却会改变定位根因时看到的路径。',
      '异常实例可被重复抛出，__traceback__ 会更新。Python 3.11 起，在 except 中修改活动异常 traceback 后执行 bare raise，会携带修改后的 traceback；这对框架裁剪内部栈有用，也容易掩盖证据。',
      '包装层如果不改变抽象，记录后应 bare raise；若跨架构边界翻译为领域异常，则用 raise NewError(...) from exc 保留因果链。'
    ],
    mechanisms: [
      'raise 只能在活动异常处理上下文重抛，否则 RuntimeError。',
      'raise SomeError 会按无参构造异常实例，通常显式实例更清楚。',
      'exc.with_traceback(tb) 返回同一个异常对象并设置 traceback。',
      'traceback 保真应通过测试 stack frame names，而不只断言异常类型。'
    ],
    pitfalls: [
      'except Exception as exc: raise exc，无意中增加包装层 frame 并干扰错误聚合签名。',
      '为了隐藏内部实现随意清空 traceback，导致线上无法定位根因。',
      '复用同一异常单例跨请求抛出，traceback 和 notes 互相污染。'
    ],
    example: `def origin():
    raise ValueError("bad")

def preserve():
    try:
        origin()
    except ValueError:
        raise

def reset_site():
    try:
        origin()
    except ValueError as exc:
        raise exc

def frame_names(call):
    try:
        call()
    except ValueError as exc:
        names = []
        tb = exc.__traceback__
        while tb:
            names.append(tb.tb_frame.f_code.co_name)
            tb = tb.tb_next
        return names

assert frame_names(preserve).count("preserve") == 1
assert frame_names(reset_site).count("reset_site") == 2`,
    buildSteps: [
      { title: '比较栈形状', body: '对 bare raise、raise exc、raise New from exc 分别收集 frame name 和 cause/context。' },
      { title: '制定包装规则', body: '同一抽象层 bare raise；跨边界翻译类型并 from；只补信息时优先 add_note。' },
      { title: '写回归断言', body: '断言根因类型、cause 和最内层业务 frame 均保留，防止重构破坏诊断链。' }
    ],
    selfCheckQuestion: 'except 中的 raise 与 raise exc 有何实际差别？',
    selfCheckAnswer: 'bare raise 继续当前传播，保留原 traceback 作为主要路径；raise exc 是在当前行重新执行一次抛出，会把处理器中的这一帧位置加入 traceback。若只是记录后继续失败，应 bare raise；若翻译抽象，则创建新异常并用 from 建立因果。'
  },
  '__context__、__cause__ 与 raise from': {
    official: {
      title: 'Exceptions · Exception context',
      url: 'https://docs.python.org/3/library/exceptions.html#exception-context',
      note: '处理异常期间再抛异常会设置 __context__；raise X from Y 设置显式 __cause__，from None 仅抑制默认上下文显示。'
    },
    overview: [
      '__context__ 记录“处理哪个异常时又发生了这个异常”，由运行时隐式设置；__cause__ 记录作者声明的直接原因，由 raise new from old 显式设置。默认渲染优先展示 cause，否则在未抑制时展示 context。',
      'raise DomainError(...) from exc 适合把数据库、HTTP、解析器异常翻译成稳定领域边界，同时让诊断工具仍能追到原始失败。from None 只设置 __suppress_context__ 隐藏默认打印，原 __context__ 对象仍可供程序检查。',
      '因果链应表达真正抽象关系。每一层都机械包装会产生“洋葱 traceback”，使最重要的业务语义被重复 message 淹没；同一层无法增加恢复信息时应直接传播。'
    ],
    mechanisms: [
      '处理器、finally 或 with 退出期间的新异常会得到隐式 __context__。',
      '显式 cause 决定默认显示文案为 direct cause，并设置 suppress_context。',
      'from None 隐藏低层噪声但不销毁 context 证据。',
      'traceback.print_exception(chain=True) 会按 cause/context 规则渲染整条链。'
    ],
    pitfalls: [
      '翻译异常时只复制 str(exc)，丢失类型、结构化字段与 traceback。',
      '对所有失败 from None，生产事故中再也看不到底层证据。',
      '把两个同时发生但无因果关系的错误硬串成 cause；并行多失败应使用 ExceptionGroup。'
    ],
    example: `class UserLookupError(Exception):
    def __init__(self, user_id):
        self.user_id = user_id
        super().__init__(f"cannot load user {user_id}")

def parse_user(raw, user_id):
    try:
        return int(raw)
    except ValueError as exc:
        raise UserLookupError(user_id) from exc

try:
    parse_user("NaN", "u-7")
except UserLookupError as error:
    assert isinstance(error.__cause__, ValueError)
    assert error.__context__ is error.__cause__
    assert error.__suppress_context__ is True
    assert error.user_id == "u-7"`,
    buildSteps: [
      { title: '区分关系', body: '为每次包装回答：新异常是否是低层失败的语义翻译？是则 cause；只是在处理期间失败则保留 context。' },
      { title: '实现领域边界', body: '保留稳定业务字段，用 from 原异常翻译 provider-specific 错误。' },
      { title: '测试渲染与对象图', body: '同时断言 __cause__/__context__/__suppress_context__，再检查面向用户的精简输出。' }
    ],
    selfCheckQuestion: 'raise X from None 是否真的删除了原始异常？',
    selfCheckAnswer: '没有。它把 __cause__ 设为 None 并开启 __suppress_context__，从而在默认未捕获异常输出中隐藏隐式上下文；原异常通常仍在 X.__context__ 中。该机制适合向用户隐藏无用实现细节，但日志或调试工具仍可按策略读取。'
  },
  'try/except/else/finally 的控制流矩阵': {
    official: {
      title: 'Compound statements · The try statement',
      url: 'https://docs.python.org/3/reference/compound_stmts.html#the-try-statement',
      note: 'else 只在 try 正常完成且未 return/break/continue 时执行；finally 在所有离开路径运行，并可覆盖保存的异常或返回。'
    },
    overview: [
      'try 语句管理的是“完成原因”：正常落下、return、break、continue、异常。finally 在离开前总会执行；若 finally 自己以 return、break、continue 或新异常完成，先前保存的完成原因会被覆盖。',
      'else 的价值是缩小捕获范围。把成功后的后处理放进 else，它抛出的异常不会被前面的 except 误认为 try 中预期失败；这比扩大 try 包住整个函数更能维持异常分类。',
      'finally 中 return 会静默丢弃 try 中的异常或返回值。Python 3.14 会对 finally 内的 return/break/continue 发出 SyntaxWarning，这反映其控制流风险，而非简单风格偏好。'
    ],
    mechanisms: [
      'except 只处理 try suite 抛出的匹配异常，处理器自身异常向外传播。',
      'else 需要 try 正常完成且未发生非局部跳转。',
      'finally 运行时保存先前完成原因，结束后恢复它，除非 finally 产生新的完成原因。',
      'finally 新异常会把先前异常设为 __context__。'
    ],
    pitfalls: [
      'finally return 覆盖业务返回或吞掉异常。',
      'try 范围过大，让 except ValueError 意外捕获成功后日志/序列化中的 ValueError。',
      '在 finally 中只在成功路径初始化的局部变量上清理，制造 UnboundLocalError 覆盖根因。'
    ],
    example: `events = []

def execute(fail=False):
    resource = None
    try:
        resource = "open"
        if fail:
            raise ValueError("work failed")
    except ValueError:
        events.append("handled")
        raise
    else:
        events.append("commit")
        return "ok"
    finally:
        if resource is not None:
            events.append("close")
        # 此处绝不能 return，否则 fail=True 的异常会被吞掉。

assert execute() == "ok"
assert events == ["commit", "close"]

events.clear()
try:
    execute(True)
except ValueError:
    pass
assert events == ["handled", "close"]`,
    buildSteps: [
      { title: '建立完成原因枚举', body: '用 NORMAL、RETURN、BREAK、CONTINUE、EXCEPTION 表示 try 离开方式，再描述 finally 覆盖规则。' },
      { title: '生成测试矩阵', body: '让 try 与 finally 分别选择五种完成原因，断言最终返回或异常，重点覆盖覆盖关系。' },
      { title: '重构真实事务', body: 'try 只包可能失败的操作，except 分类，else commit，finally 仅做幂等释放。' }
    ],
    selfCheckQuestion: 'finally 中 return 为什么能吞掉 try 中原本要传播的异常？',
    selfCheckAnswer: '解释器进入 finally 前会暂存 try 的完成原因。若 finally 正常结束，就恢复原异常或 return；若 finally 自己执行 return，它提供了更新、更晚的完成原因，旧异常被丢弃。清理代码应完成资源释放后自然落下，避免产生新的控制流。'
  },
  'ExceptionGroup、except* 与并发多失败': {
    official: {
      title: 'Compound statements · except* clause',
      url: 'https://docs.python.org/3/reference/compound_stmts.html#except-star-clause',
      note: '每个 except* 按类型递归拆分匹配与未匹配子组；处理完成后，未处理异常与处理器新异常会重新合并传播。'
    },
    overview: [
      '并发任务、批量校验和多资源清理可能同时产生多个彼此独立的失败。普通异常链只能表达顺序因果；ExceptionGroup 保存树形并列关系，同时保留每个叶子异常自己的 traceback。',
      'except* 不是从组里取第一个异常。它按类型递归分割整棵树，当前处理器获得保留原嵌套形状的匹配子组，剩余子组继续交给后续 except*；全部处理器结束后，未处理叶子与处理器新抛异常再合并。',
      '处理器中绑定的组是临时派生对象，修改它不会原地修改原组。要为叶子补 notes 或用 subgroup/split 构造新组，并把错误与任务标识、输入索引等结构化上下文关联。'
    ],
    mechanisms: [
      'ExceptionGroup 只能包含 Exception 子类；BaseExceptionGroup 可容纳取消、退出等 BaseException。',
      'subgroup(predicate) 保留匹配叶子及其必要父组结构；split 同时返回匹配和其余部分。',
      'except 与 except* 不能混用在同一个 try，except* 中不能 return/break/continue。',
      '裸异常若被匹配 except*，会临时包装为空消息的组，保持处理器变量类型一致。'
    ],
    pitfalls: [
      'except* Exception 后仅打印，吞掉多个任务失败。',
      '把 ExceptionGroup 当扁平 list，丢失子任务树与 traceback 分组。',
      '用 cause 链串联无因果的并行失败，让最后一个错误看似由前一个导致。'
    ],
    example: `def validate_all():
    errors = [
        ValueError("row 1: invalid age"),
        TypeError("row 2: expected text"),
        OSError("row 3: storage unavailable"),
    ]
    raise ExceptionGroup("batch validation", errors)

handled = []
try:
    validate_all()
except* (ValueError, TypeError) as group:
    handled.extend(type(exc).__name__ for exc in group.exceptions)
except* OSError as group:
    for exc in group.exceptions:
        exc.add_note("retry batch after storage recovery")
    handled.append("OSError")

assert set(handled) == {"ValueError", "TypeError", "OSError"}`,
    buildSteps: [
      { title: '实现树形 split', body: '定义 Leaf/Group，递归返回 matching/rest，并在子节点为空时裁掉父组。' },
      { title: '模拟 except*', body: '依次把 rest 交给类型处理器，收集处理器新异常，最后合并所有未处理分支。' },
      { title: '连接并发任务', body: '让每个异常携带 task_id note，验证 TaskGroup 多失败输出仍能定位各自产生点。' }
    ],
    selfCheckQuestion: '为什么 except* 处理器拿到的仍是 ExceptionGroup，而非一组扁平异常？',
    selfCheckAnswer: '原始嵌套结构通常对应任务树、批次或资源层级。递归分割并保留结构，才能维持每个失败所属上下文；扁平化会丢失父组语义。处理器因此接收只含匹配叶子的派生子组，未匹配树继续流向后续处理器。'
  },
  'with 展开、特殊方法查找与异常抑制': {
    official: {
      title: 'Compound statements · The with statement',
      url: 'https://docs.python.org/3/reference/compound_stmts.html#the-with-statement',
      note: '只要 __enter__ 成功返回，__exit__ 就必被调用；异常退出时 truthy 返回值抑制异常，多项 with 等价于嵌套。'
    },
    overview: [
      'with 把资源获取成功后的清理责任绑定到语法结构。运行时先从类型上取得 __enter__/__exit__，调用 enter；只有 enter 成功后才保证 exit。若 enter 进行了多步获取后失败，类本身必须回滚已经取得的部分资源。',
      '异常退出时，exit 接收 type、instance、traceback；truthy 返回值表示已处理并抑制异常。正常退出传入三个 None，exit 返回值被忽略。抑制属于强语义，应只覆盖上下文管理器明确能恢复的异常。',
      'with A(), B() 等价于嵌套：按 A→B 获取，按 B→A 释放。这个 LIFO 顺序与锁、事务、临时状态覆盖的依赖方向一致。'
    ],
    mechanisms: [
      '特殊方法通过 type(manager) 查找，实例上动态塞 __exit__ 不参与隐式协议。',
      'as 绑定失败也发生在 enter 成功之后，因此仍会调用 exit。',
      '多个 context manager 由左到右 enter、由右到左 exit。',
      '内层 exit 抑制异常后，外层 exit 会看到 None 三元组。'
    ],
    pitfalls: [
      '__exit__ 无条件 return True，吞掉 KeyboardInterrupt 之外的大量程序错误。',
      '__enter__ 获取资源 A 后获取 B 失败，却指望未进入成功的 with 自动调用 __exit__。',
      '错误假设 exit 从实例字典查找并试图运行时替换单个实例方法。'
    ],
    example: `events = []

class Resource:
    def __init__(self, name, suppress=()):
        self.name, self.suppress = name, suppress

    def __enter__(self):
        events.append(("enter", self.name))
        return self

    def __exit__(self, exc_type, exc, tb):
        events.append(("exit", self.name, exc_type))
        return exc_type is not None and issubclass(exc_type, self.suppress)

with Resource("outer"), Resource("inner", (ValueError,)):
    raise ValueError("handled by inner")

assert events[:2] == [("enter", "outer"), ("enter", "inner")]
assert events[2][1] == "inner"
assert events[3] == ("exit", "outer", None)`,
    buildSteps: [
      { title: '手工展开 with', body: '按官方等价代码实现 hit_except 与 exit(*sys.exc_info())，覆盖 as 赋值失败。' },
      { title: '验证嵌套顺序', body: '三个资源记录 enter/exit 与异常三元组，断言 LIFO 及内层抑制后外层看到 None。' },
      { title: '限制抑制范围', body: '只对白名单异常返回 True，其他异常记录必要信息后返回 False。' }
    ],
    selfCheckQuestion: '为什么 __enter__ 失败时 Python 不调用同一对象的 __exit__？',
    selfCheckAnswer: 'with 的清理保证从 enter 成功返回后才成立；enter 失败意味着对象尚未宣布完成可管理资源的建立，运行时无法知道哪些部分需要释放。多阶段 enter 必须在内部用 try/ExitStack 回滚已成功步骤，再把异常传播出去。'
  },
  'ExitStack：动态资源、部分获取与所有权转移': {
    official: {
      title: 'contextlib.ExitStack',
      url: 'https://docs.python.org/3/library/contextlib.html#contextlib.ExitStack',
      note: 'ExitStack 以 LIFO 保存退出回调，适合动态数量与可选资源；pop_all 可把待清理责任转移到新的 stack。'
    },
    source: {
      repo: 'python/cpython',
      file: 'Lib/contextlib.py',
      symbol: 'ExitStack.__exit__',
      language: 'python',
      url: 'https://github.com/python/cpython/blob/main/Lib/contextlib.py#L630',
      walkthrough: [
        '回调按 LIFO 弹出，以模拟真正嵌套的 with；每个回调都收到当前最新异常三元组。',
        '回调返回真值会清除当前异常，外层回调随后看到正常退出；回调自己抛新异常则成为新的当前异常。',
        '_fix_exception_context 修复人工调用回调时的因果链，使结果与词法嵌套 context manager 尽量一致。'
      ],
      code: `def __exit__(self, *exc_details):
    exc = exc_details[1]
    received_exc = exc is not None
    suppressed_exc = False
    pending_raise = False

    while self._exit_callbacks:
        is_sync, callback = self._exit_callbacks.pop()  # 后进先出
        try:
            details = (None, None, None) if exc is None else (
                type(exc), exc, exc.__traceback__)
            if callback(*details):
                suppressed_exc = True
                pending_raise = False
                exc = None                              # 外层看到已恢复
        except BaseException as new_exc:
            _fix_exception_context(new_exc, exc)
            pending_raise = True
            exc = new_exc                               # 新失败继续向外层清理传播

    if pending_raise:
        raise exc
    return received_exc and suppressed_exc`
    },
    overview: [
      '词法 with 适合资源数量在写代码时已知。ExitStack 把退出动作作为数据压栈，允许根据配置、循环和运行结果动态获取任意数量资源，同时保持与嵌套 with 相同的反向释放顺序。',
      'enter_context 先调用 cm.__enter__，成功后才压入 __exit__。因此第 N 个资源获取失败时，前 N-1 个已登记资源仍会在离开 stack 时回滚；这正是批量文件、连接和锁获取需要的部分成功语义。',
      'pop_all 把整组回调移动到新 stack，不执行它们。它表达明确的所有权转移：验证阶段临时拥有资源，全部成功后把关闭责任交给返回对象或更长生命周期的 owner。'
    ],
    mechanisms: [
      'callback(fn, *args) 只做无异常三元组的清理，不能抑制异常；push(exit) 可参与抑制。',
      '每个 exit 看到前一个内层 exit 处理后的最新异常。',
      'close 等价于以正常退出三元组立即展开 stack。',
      'pop_all 返回新 stack，原 stack 变空；遗失新 stack 会造成资源责任泄漏。'
    ],
    pitfalls: [
      '把 enter_context 与普通 cm.__enter__ 混用，后者成功后没有注册退出。',
      '用 callback 返回 True 期待抑制异常；普通 callback wrapper 的返回值会被忽略。',
      '调用 pop_all 后没有保存或关闭返回 stack。'
    ],
    example: `from contextlib import ExitStack
from io import StringIO

class NamedBuffer(StringIO):
    def __init__(self, name, events):
        super().__init__()
        self.name, self.events = name, events
    def close(self):
        self.events.append(("close", self.name))
        super().close()

events = []
with ExitStack() as stack:
    buffers = [
        stack.enter_context(NamedBuffer(name, events))
        for name in ("a", "b", "c")
    ]
    buffers[0].write("ready")

assert events == [("close", "c"), ("close", "b"), ("close", "a")]`,
    buildSteps: [
      { title: '实现回调栈', body: '先只支持 push 无参 cleanup，按 LIFO 展开并覆盖中途获取失败。' },
      { title: '加入异常状态', body: '让 exit 接收当前异常并可抑制或替换，外层回调必须看到更新后的状态。' },
      { title: '实现所有权转移', body: 'pop_all 原子移动回调 deque，测试旧 owner 不再关闭、新 owner 只关闭一次。' }
    ],
    selfCheckQuestion: 'ExitStack 为什么不能只保存一组 close 函数并在最后 reverse 调用？',
    selfCheckAnswer: '真正的 context manager exit 会收到当前异常并可能抑制或替换它；后续外层 exit 必须看到更新后的异常状态，还要维护正确 cause/context。简单 reverse close 只能做无条件清理，无法复现嵌套 with 的异常转换与所有权语义。'
  },
  'async with、取消与可靠异步清理': {
    official: {
      title: 'Data model · Asynchronous Context Managers',
      url: 'https://docs.python.org/3/reference/datamodel.html#asynchronous-context-managers',
      note: '__aenter__ 与 __aexit__ 都返回 awaitable；async with 保证 enter 成功后等待 exit，但任务取消也会进入清理路径。'
    },
    overview: [
      '异步资源的获取与释放可能需要网络往返，因此 __aenter__/__aexit__ 都可 await。async with 保留同步 with 的所有权和异常抑制语义，同时把两个边界交给事件循环调度。',
      '取消以 CancelledError 注入 task 当前 await 点。async with 会进入 __aexit__，但清理内部的 await 仍可能遭遇新的取消或超时。可靠设计应让释放幂等、限制耗时，并只在确有必要时由独立 task 或 shield 保护关键提交/回滚段。',
      'shield 只保护被等待操作本身，不会让外层 task 忘记取消；过度屏蔽会让停机和超时失效。资源 owner 还需决定等待清理完成、记录后台清理句柄或在超时后强制丢弃的策略。'
    ],
    mechanisms: [
      'async with EXPR as value 依次 await __aenter__、运行 body、await __aexit__。',
      '__aexit__ 收到 CancelledError 时也可清理，但通常应返回 False 让取消继续传播。',
      'AsyncExitStack 同一栈可登记同步与异步退出回调并按 LIFO await。',
      '清理失败可能替换原业务异常；关键系统可用 notes/ExceptionGroup 保存两个失败。'
    ],
    pitfalls: [
      '__aexit__ 捕获 BaseException 后 return True，无意中吞掉任务取消。',
      '整个业务块都 shield，导致上层取消合同失效。',
      '释放函数非幂等，取消重试或多 owner 竞争造成二次提交/关闭错误。'
    ],
    example: `import asyncio

class Lease:
    def __init__(self, events):
        self.events = events
        self.released = False

    async def __aenter__(self):
        self.events.append("acquired")
        return self

    async def release(self):
        if not self.released:               # 取消重试也安全
            await asyncio.sleep(0)
            self.released = True
            self.events.append("released")

    async def __aexit__(self, exc_type, exc, tb):
        await self.release()
        return False                         # 包括 CancelledError 在内均继续传播

async def worker(events):
    async with Lease(events):
        await asyncio.Event().wait()

async def demo():
    events = []
    task = asyncio.create_task(worker(events))
    await asyncio.sleep(0)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    assert events == ["acquired", "released"]

asyncio.run(demo())`,
    buildSteps: [
      { title: '展开 async with', body: '手写 await aenter 与 try/except/finally 中 await aexit，保留异常三元组和 suppression。' },
      { title: '注入取消', body: '分别在 acquire、body、release 的 await 点 cancel，断言资源状态和 CancelledError 是否继续传播。' },
      { title: '设计清理预算', body: '为 release 加幂等键、超时、有限 shield 与失败记录，明确超时后的 owner 决策。' }
    ],
    selfCheckQuestion: '为什么在 __aexit__ 中 await 清理并不自动保证清理一定完成？',
    selfCheckAnswer: '任务已处于取消传播路径，清理里的 await 仍是可暂停点，也可能收到后续取消、超时或自身异常。可靠性来自幂等释放、明确的清理时间预算和最小范围保护；shield 只能保护特定 awaitable 的执行，外层取消仍需被观察和传播。'
  }
}
