import type { TrackId } from './curriculum'
import { pythonAttributeGuides } from './guides/python/attributes'
import { pythonFunctionGuides } from './guides/python/functions'
import { pythonIterationGuides } from './guides/python/iteration'
import { pythonExceptionGuides } from './guides/python/exceptions'
import { pythonImportGuides } from './guides/python/imports'
import { pythonTypingGuides } from './guides/python/typing'
import { pythonAsyncioGuides } from './guides/python/asyncio'
import { pythonPerformanceGuides } from './guides/python/performance'
import { pythonCpythonGuides } from './guides/python/cpython'
import { typescriptRuntimeGuides } from './guides/typescript/runtime'
import { typescriptGcGuides } from './guides/typescript/gc'
import { typescriptContextGuides } from './guides/typescript/contexts'
import { typescriptClosureGuides } from './guides/typescript/closures'
import { typescriptThisBindingGuides } from './guides/typescript/this-binding'
import { typescriptClassGuides } from './guides/typescript/classes'
import { typescriptAccessorProxyGuides } from './guides/typescript/accessors-proxy'
import { typescriptPromiseGuides } from './guides/typescript/promises'
import { typescriptEventLoopGuides } from './guides/typescript/event-loop'
import { typescriptModuleGuides } from './guides/typescript/modules'
import { langGraphRuntimeGuides } from './guides/langgraph/runtime'

export interface GuideChapter {
  title: string
  kicker?: string
  paragraphs: string[]
  points?: string[]
  code?: string
  language?: string
  takeaway?: string
}

export interface GuideVariant {
  title: string
  useWhen: string
  tradeoff: string
  code?: string
  language?: string
}

export interface GuideStudyPlan {
  readingMinutes: number
  sourceMinutes: number
  practiceMinutes: number
  reviewMinutes: number
}

export interface TopicGuide {
  official?: {
    title: string
    url: string
    note: string
  }
  source?: {
    repo: string
    file: string
    symbol: string
    language: string
    code: string
    walkthrough: string[]
    url: string
  }
  overview: string[]
  chapters?: GuideChapter[]
  mechanisms: string[]
  pitfalls: string[]
  variants?: GuideVariant[]
  studyPlan?: GuideStudyPlan
  exampleLanguage?: string
  example: string
  buildSteps: Array<{ title: string; body: string; code?: string }>
  selfCheckQuestion: string
  selfCheckAnswer: string
}

const pythonObjectGuides: Record<string, TopicGuide> = {
  'PyObject 头部与 ob_type': {
    official: {
      title: 'CPython source · Include/object.h · PyObject',
      url: 'https://github.com/python/cpython/blob/main/Include/object.h',
      note: 'CPython 的普通对象都以 PyObject 头部开场。头部保存引用计数和类型指针；变长对象再通过 PyVarObject 增加 ob_size。'
    },
    overview: [
      'Python 层看到的 int、list、函数和类实例形态各异，CPython 的 C 代码却需要一种共同入口。PyObject 就是这个共同前缀：任何对象指针都可以先被当作 PyObject*，读取引用计数和运行时类型，再由类型对象决定后续操作。',
      'PyObject 不是完整对象。它更像快递箱统一贴在最前面的标签，箱子后面才是 PyLongObject、PyListObject 等类型自己的字段。C 代码依赖“共同头部必须位于偏移 0”这一布局契约完成安全的向上转型。',
      'ob_type 指向 PyTypeObject。加法、属性读取、迭代和释放等行为并不直接写在每个对象头里，而是通过类型对象中的 slot 分派。这个设计让数据布局和行为表分离，也解释了 type(x) 为什么是运行时机制的一部分。'
    ],
    mechanisms: [
      'PyObject_HEAD 展开后提供 ob_refcnt 与 ob_type；调试构建可能在头部加入额外追踪字段。',
      'Py_TYPE(obj) 读取 ob_type，Py_SET_TYPE 只应用于受控初始化或底层实现，业务扩展不应随意改写类型指针。',
      '具体对象结构体把 PyObject 或 PyVarObject 放在首字段，因此 PyObject* 能指向所有内建对象。',
      '操作从公开 C API 进入后，通常先取 Py_TYPE，再调用 nb_add、tp_getattro、tp_iter 等类型槽。'
    ],
    pitfalls: [
      '把 PyObject 当成 Python 对象全部内存。它只描述共同头部，具体值可能内联在后续字段，也可能指向另一块存储。',
      '认为 ob_type 等同于类名字符串。它指向完整的类型对象，类型对象自身也有类型，最终形成 metaclass 链。',
      '根据某个 CPython 版本的私有字段做二进制假设。稳定 ABI、limited API 与源码内部布局的兼容承诺不同。'
    ],
    example: `import ctypes

class PyObjectHead(ctypes.Structure):
    _fields_ = [
        ("ob_refcnt", ctypes.c_ssize_t),
        ("ob_type", ctypes.c_void_p),
    ]

value = []
head = PyObjectHead.from_address(id(value))

# id(value) 在 CPython 中就是对象首地址；ob_type 指回 list 类型对象。
assert head.ob_type == id(list)
assert head.ob_refcnt >= 1
print({"address": hex(id(value)), "type": hex(head.ob_type)})`,
    buildSteps: [
      { title: '画出共同头部', body: '先只保留 refcount 和 type pointer，明确它们解决生命周期与行为分派两个不同问题。' },
      { title: '观察真实对象地址', body: '用 ctypes 只读映射 id(obj) 所在内存，比较 list、dict、自定义实例的 ob_type。不要写入这些字段。' },
      { title: '沿类型槽继续追踪', body: '从 Py_TYPE(obj) 进入 PyTypeObject，选择 tp_getattro 或 tp_dealloc 追踪一次完整分派。' }
    ],
    selfCheckQuestion: '如果每种对象都没有共同的 PyObject 头部，Py_DECREF 和 Py_TYPE 这类通用 C API 将被迫怎样设计？',
    selfCheckAnswer: '它们要么接收带标签的联合体，要么为每种对象生成独立入口，并在调用前保存额外的类型信息。共同前缀让所有对象都能以 PyObject* 进入通用生命周期和分派代码；代价是 CPython 扩展必须严格遵守布局与引用所有权约定。'
  },
  '身份、相等与哈希契约': {
    official: {
      title: 'Data model · Objects, values and types',
      url: 'https://docs.python.org/3/reference/datamodel.html#objects-values-and-types',
      note: '身份在对象创建后保持不变；is 比较身份，== 调用富比较协议；可哈希对象还必须保证相等对象拥有相同哈希值。'
    },
    overview: [
      'is 回答“是否为同一个对象”，== 回答“两个对象是否按某种领域规则相等”。前者在 CPython 中近似比较地址，后者会进入 __eq__ 协议，因此可以执行用户代码、返回 NotImplemented，甚至产生非 bool 的中间结果。',
      '字典和集合先用 hash 缩小候选槽位，再用身份或相等判断确认键。由此得到一条不可破坏的契约：a == b 为真时，hash(a) 必须等于 hash(b)。反方向不成立，哈希冲突是正常情况。',
      '可变对象通常不可哈希，因为对象进入 dict 后若参与哈希的字段发生变化，查找将沿新哈希前往另一组槽位，原条目会像“丢失”一样留在旧位置。'
    ],
    mechanisms: [
      'is 不调用魔术方法，适合 None、哨兵对象和缓存对象的身份判断。',
      'a == b 先尝试左操作数的富比较；遇到子类优先级或 NotImplemented 时可能尝试右侧反射路径。',
      'object.__eq__ 的默认行为建立在身份上；值对象通常覆盖 __eq__ 并同步定义 __hash__。',
      'dict 查找组合使用哈希、探测序列和相等比较；哈希相同只意味着需要进一步比较。'
    ],
    pitfalls: [
      '用 is 比较整数或字符串值。缓存和驻留会让它在部分运行中“碰巧正确”，换构造方式或解释器就失败。',
      '只覆盖 __eq__ 而沿用不一致的 __hash__。Python 对普通类会主动把 __hash__ 设为 None，避免产生损坏的键。',
      '认为 == 必定返回 bool。NumPy、PyTorch 等对象会返回逐元素结果，放进 if 时可能抛出“truth value ambiguous”。'
    ],
    example: `class UserKey:
    def __init__(self, tenant: str, user_id: int):
        self.tenant = tenant
        self.user_id = user_id

    def __eq__(self, other):
        if not isinstance(other, UserKey):
            return NotImplemented
        return (self.tenant, self.user_id) == (other.tenant, other.user_id)

    def __hash__(self):
        # 与 __eq__ 使用完全相同的不可变字段。
        return hash((self.tenant, self.user_id))

a = UserKey("acme", 7)
b = UserKey("acme", 7)
assert a is not b
assert a == b
assert hash(a) == hash(b)
assert {a: "cached"}[b] == "cached"`,
    buildSteps: [
      { title: '区分两个问题', body: '用两个内容相同的对象分别验证 is 与 ==，再加入单例哨兵验证身份判断的合理场景。' },
      { title: '实现 NotImplemented 路径', body: '让 __eq__ 对不支持的类型返回 NotImplemented，观察 Python 如何尝试另一侧并最终产生 False。' },
      { title: '把对象放进 dict', body: '让 __eq__ 与 __hash__ 共用同一组不可变字段，再故意修改字段复现键失联问题。' }
    ],
    selfCheckQuestion: '为什么“哈希值相同”不能推出对象相等，而“对象相等”必须推出哈希值相同？',
    selfCheckAnswer: '哈希空间有限，无限多的对象必然会碰撞，所以相同哈希只用于筛选候选；dict 仍需调用相等协议确认。相等对象若产生不同哈希，会被放入不同探测起点，容器将无法用一个等价键找到已有条目，因此 Python 要求相等蕴含同哈希。'
  },
  '名称绑定与 rebinding': {
    official: {
      title: 'Execution model · Naming and binding',
      url: 'https://docs.python.org/3/reference/executionmodel.html#naming-and-binding',
      note: '赋值语句把名称绑定到对象；重新赋值只改变当前命名空间里的绑定，不会把旧对象原地改造成新值。'
    },
    overview: [
      'Python 名称可以理解为命名空间字典中的键，值是对象引用。执行 x = expression 时，解释器先求 expression 得到对象，再让当前作用域中的 x 指向它。赋值没有“把值塞进固定变量格子”的复制语义。',
      'rebind 改变的是名称到对象的边，不会影响其他名称。mutation 改变的是对象自身，所有指向该对象的名称都会观察到变化。区分这两种操作，是理解函数参数、闭包和共享状态的地基。',
      '作用域决定绑定写到哪里。函数内赋值默认创建局部名称；global 与 nonlocal 改变编译器对名称的分类，并分别指向模块命名空间或最近的闭包 cell。'
    ],
    mechanisms: [
      '右侧表达式先求值，左侧 target 随后执行绑定；多重赋值也遵循先计算后绑定。',
      '局部名称通常编译为 LOAD_FAST/STORE_FAST，全局名称走 LOAD_GLOBAL，闭包变量走 LOAD_DEREF/STORE_DEREF。',
      'del x 删除绑定并减少一次引用，不保证对象立即销毁，因为其他名称或容器可能仍持有它。',
      '参数传递创建新的局部名称并绑定到调用者提供的同一对象，这常被称为 call by sharing。'
    ],
    pitfalls: [
      '把参数重新赋值误认为能替换调用者的变量。函数只改变自己的局部绑定。',
      '把 += 一概视为原地修改。list.__iadd__ 常修改原对象，tuple.__iadd__ 实际会创建新 tuple 并重新绑定。',
      '在函数中读取后再给同名变量赋值，忽略编译期局部变量判定，触发 UnboundLocalError。'
    ],
    example: `def rebind_and_mutate(items):
    alias = items
    items.append("shared")     # 修改同一个 list
    items = ["new"]           # 只重绑局部名称
    return alias, items

original = []
alias, local = rebind_and_mutate(original)

assert original == ["shared"]
assert alias is original
assert local == ["new"]
assert local is not original`,
    buildSteps: [
      { title: '画名称到对象的箭头', body: '分别画出函数调用前、append 后、局部重绑定后的对象图，不使用“变量里装着值”的说法。' },
      { title: '对照字节码', body: '用 dis.dis 比较局部、global 与 nonlocal 的 LOAD/STORE 指令，确认作用域在编译阶段已经分类。' },
      { title: '加入可变与不可变对象', body: '用 list、tuple 各运行一次 +=，同时记录 id，解释协议为什么产生不同可观察行为。' }
    ],
    selfCheckQuestion: '函数执行 parameter = new_value 后，为什么调用者的同名变量不变，而 parameter.append(...) 却可能被调用者观察到？',
    selfCheckAnswer: '调用时参数只是新的局部名称，它与调用者名称暂时指向同一对象。重新赋值只改局部命名空间中的那条边；append 修改共同指向的对象，所以其他引用也能观察到。'
  },
  '可变对象的别名风险': {
    official: {
      title: 'Programming FAQ · Shared objects and defaults',
      url: 'https://docs.python.org/3/faq/programming.html#why-are-default-values-shared-between-objects',
      note: '多个名称或容器槽位可以引用同一个可变对象；修改通过所有别名可见，重复引用与复制边界必须显式设计。'
    },
    overview: [
      'alias 表示两条或更多引用指向同一对象。别名本身很常见，缓存、对象图和依赖注入都依赖它；风险来自代码把“共享”误认成“独占”，于是一个局部修改跨越了模块边界。',
      '最隐蔽的别名来自容器构造和默认值：[[0] * 3] * 4 复制的是内层 list 引用；函数默认参数在定义时只创建一次；浅拷贝只复制外层容器。三者都可能让看似独立的槽位共享内部对象。',
      '工程上要先定义所有权：谁可以修改、修改是否需要复制、何时冻结。只要所有权合同模糊，随意 deep copy 也只能暂时掩盖问题，并可能破坏对象身份或共享缓存。'
    ],
    mechanisms: [
      '容器保存对象引用，不内联递归复制对象。',
      '序列乘法复制元素引用，因此可变元素会在多个位置共享。',
      '浅拷贝创建新外壳并复用内部引用；深拷贝用 memo 保留图结构并避免无限递归。',
      '不可变视图、copy-on-write、冻结 dataclass 和清晰的 mutation API 都是在管理所有权。'
    ],
    pitfalls: [
      '用 is 判断“内容是否共享”却只检查最外层容器，遗漏内部节点。',
      '在 API 边界无条件 deep copy，造成高成本，并让本应共享的身份对象失去一致性。',
      '返回内部可变容器本身，让调用者绕过类的不变量直接修改状态。'
    ],
    example: `rows = [[0] * 3] * 2
rows[0][1] = 9
assert rows == [[0, 9, 0], [0, 9, 0]]
assert rows[0] is rows[1]

# 正确地为每一行创建新对象。
independent = [[0] * 3 for _ in range(2)]
independent[0][1] = 9
assert independent == [[0, 9, 0], [0, 0, 0]]
assert independent[0] is not independent[1]`,
    buildSteps: [
      { title: '制造共享', body: '分别用赋值、序列乘法、浅拷贝建立别名，画出每种方式复制了哪一层。' },
      { title: '写所有权测试', body: '除内容断言外加入 is 断言，明确哪些节点必须共享、哪些节点必须独立。' },
      { title: '封装修改入口', body: '让对象只暴露 copy-on-write 或返回不可变快照的 API，验证外部无法绕过不变量。' }
    ],
    selfCheckQuestion: '为什么浅拷贝有时完全足够，有时却像没有复制？',
    selfCheckAnswer: '浅拷贝只保证外层容器独立。如果内部元素不可变，或合同允许共享内部对象，它已经足够；若调用者会修改内部可变节点，两份外壳仍会观察到同一变化。是否足够取决于对象图中哪一层拥有修改权。'
  },
  '小整数缓存与字符串驻留': {
    official: {
      title: 'Data model · Identity is an implementation detail',
      url: 'https://docs.python.org/3/reference/datamodel.html#objects-values-and-types',
      note: '不可变值可以复用已有对象，但缓存范围和驻留策略属于实现细节；值语义应使用 ==，不能依赖 is。'
    },
    overview: [
      '不可变对象无法被原地改成另一个值，所以解释器可以安全复用常见对象。CPython 会预创建一段小整数对象，编译器和运行时也可能驻留满足条件的字符串，以减少分配并加速部分字典查找。',
      '缓存与驻留解决的是性能问题，不是语言层身份承诺。相同源码常量可能在同一 code object 中被合并，运行时拼接得到的同值字符串却可能是新对象；交互式环境、优化级别和解释器版本也会改变现象。',
      'sys.intern 提供显式字符串驻留。它适合大量重复标识符，并让比较在哈希相等后更快命中身份；普通业务文本使用它反而可能延长对象生命周期并增加全局表压力。'
    ],
    mechanisms: [
      '小整数对象在解释器生命周期内预创建，常见范围属于 CPython 配置和实现细节。',
      '编译期常量折叠可以让同一 code object 的等值常量共享对象。',
      '字符串驻留表以内容查找规范对象，sys.intern 返回表中的共享实例。',
      '== 仍然表达值语义；is 只用于 None、显式单例和调用者明确要求的身份合同。'
    ],
    pitfalls: [
      '把某次 REPL 中 a is b 的结果写进业务条件，代码在文件、函数或另一 Python 实现中改变。',
      '认为所有短字符串都会自动驻留。包含空格、动态构造和跨 code object 的行为可能不同。',
      '对高基数临时文本滥用 sys.intern，节省的比较成本小于驻留表带来的常驻内存。'
    ],
    example: `import sys

left = "".join(["tenant", "_", "id"])
right = "tenant_id"

assert left == right
# 动态构造是否自动共享身份不能作为合同。

interned_left = sys.intern(left)
interned_right = sys.intern(right)
assert interned_left is interned_right`,
    buildSteps: [
      { title: '分离语言保证与实现现象', body: '先写只依赖 == 的正确程序，再把 is 实验放在诊断代码中，避免测试锁死实现细节。' },
      { title: '改变构造位置', body: '比较源码常量、运行时 join、函数返回值与 sys.intern，在不同位置记录 id。' },
      { title: '估算驻留收益', body: '构造重复标识符与高基数文本两组数据，比较内存和相等比较次数，决定是否值得显式驻留。' }
    ],
    selfCheckQuestion: '为什么“小整数 is 比较经常成功”反而是一道危险的面试题？',
    selfCheckAnswer: '它容易把 CPython 当前缓存现象误讲成 Python 语言语义。正确答案必须区分值相等、对象身份和实现优化，并指出任何需要判断数值相等的程序都应使用 ==。'
  },
  '引用计数的增减时机': {
    official: {
      title: 'C API · Reference counting',
      url: 'https://docs.python.org/3/c-api/refcounting.html',
      note: 'CPython 用强引用维持大多数对象的生命周期。new、borrowed、stolen reference 描述所有权转移，引用计数数值本身并不是稳定业务接口。'
    },
    overview: [
      '引用计数记录当前有多少个强引用承担“让对象继续存活”的责任。创建拥有型引用时执行 INCREF，释放所有权时执行 DECREF；计数到零会同步进入类型的析构路径，因此 DECREF 可能立即执行任意 Python 清理逻辑。',
      'C API 文档中的 new reference 表示调用者获得一份必须释放的所有权，borrowed reference 表示临时观察且不能擅自 DECREF，stolen reference 表示被调用函数接管了调用者的那一份。它们描述责任流转，比记某个时刻的 ob_refcnt 数字重要得多。',
      '现代 CPython 还存在 immortal objects、延迟或合并引用计数等优化空间，所以 sys.getrefcount 适合做实验，不能用于业务分支。正确的扩展代码应按所有权合同配平引用，而非期待一个固定计数。'
    ],
    mechanisms: [
      '名称、容器槽位、frame 和部分缓存都可能持有强引用；删除一个名称只释放其中一份。',
      'Py_DECREF 计数到零后调用 tp_dealloc，析构又可能递归释放其他对象。',
      'borrowed reference 的有效期受来源对象约束，期间若执行可能删除来源的代码，必须先转成 owned reference。',
      '引用泄漏来自少 DECREF，use-after-free 常来自多 DECREF 或借用引用跨越有效期。'
    ],
    pitfalls: [
      '把 sys.getrefcount(x) 当作真实计数，忽略函数参数本身临时增加的一次引用。',
      '在 DECREF 之后继续读取对象字段，忘记 DECREF 可能已经触发释放和任意析构代码。',
      '认为有引用计数就不需要循环 GC。闭环中的每个对象计数都可能大于零。'
    ],
    example: `import sys

value = []
baseline = sys.getrefcount(value)

alias = value
assert sys.getrefcount(value) == baseline + 1

holder = [value]
assert sys.getrefcount(value) == baseline + 2

del alias
holder.clear()
assert sys.getrefcount(value) == baseline`,
    buildSteps: [
      { title: '画所有权账本', body: '把名称、容器和临时参数逐一列为强引用来源，只记录增减事件，不依赖某个绝对计数。' },
      { title: '模拟 new 与 borrowed', body: '写一个小型对象池，用 acquire/release 表示 owned reference，用只读 lookup 表示 borrowed reference。' },
      { title: '加入析构重入', body: '让 __del__ 修改另一容器，观察为什么底层代码必须在 DECREF 前先把自身状态调整为一致。' }
    ],
    selfCheckQuestion: '为什么 Py_DECREF 不能被理解为一次纯粹的整数减法？',
    selfCheckAnswer: '计数减到零时它会进入 tp_dealloc，继而运行弱引用回调、finalizer 或递归释放成员；这些路径可能执行用户代码并重新进入当前系统。因此调用 DECREF 前必须让数据结构处于可重入的一致状态，之后也不能再使用可能已释放的指针。'
  },
  '分代 GC 与循环检测': {
    official: {
      title: 'gc · Garbage Collector interface',
      url: 'https://docs.python.org/3/library/gc.html',
      note: '循环 GC 是引用计数的补充，只追踪可能参与引用环的容器对象，并通过代际策略减少扫描成本。'
    },
    overview: [
      '引用环让每个对象都至少被环内另一个对象引用，即使程序已无法从根访问它们，引用计数也不会归零。循环 GC 周期性检查“可能成环”的追踪对象，识别只剩内部引用的孤岛。',
      '核心思想类似做账：先把对象当前引用计数复制为 gc_refs，再减去候选集合内部的引用。仍有外部引用的节点是可达根，从这些根传播即可保留整个可达子图；剩余节点属于不可达环。',
      '代际假设认为大多数对象寿命短。新对象更频繁被检查，存活对象逐步进入扫描频率更低的老年代。具体代数和阈值会随 CPython 版本演进，课程关注可达性算法与成本模型。'
    ],
    mechanisms: [
      '只有实现 traverse/clear 协议的容器类型才参与循环检测，纯数字等原子对象无需追踪。',
      'tp_traverse 枚举对象指向的 PyObject 边，GC 用它构造候选子图的内部引用关系。',
      '不可达对象若带 finalizer，现代 CPython 按 PEP 442 处理安全终结，再尝试打破引用环。',
      '频繁手动 gc.collect 可能把全局扫描成本放进请求热路径，诊断应先看分配率和代际统计。'
    ],
    pitfalls: [
      '把 GC 暂停等同于所有 Python 对象回收。多数无环对象仍由引用计数立即释放。',
      '看到内存不回落就认定对象未释放，忽略 pymalloc、系统 allocator 和 RSS 回收策略。',
      '用对象数量替代可达性分析，遗漏 callback、全局缓存和 traceback 对对象图的真实持有。'
    ],
    example: `import gc
import weakref

class Node:
    def __init__(self):
        self.peer = None

left, right = Node(), Node()
left.peer, right.peer = right, left
probe = weakref.ref(left)

del left, right
assert probe() is not None       # 环仍让引用计数大于零
gc.collect()
assert probe() is None`,
    buildSteps: [
      { title: '构造最小引用环', body: '用两个节点互相引用，并用 weakref 观察对象是否存活，避免观察变量本身增加强引用。' },
      { title: '手写候选扣减算法', body: '为小型有向图保存 external_count，减去集合内部边后，从正计数节点传播可达性。' },
      { title: '对照 gc 统计', body: '使用 gc.get_stats、gc.get_referrers 和 tracemalloc 区分不可达环、仍可达缓存与 allocator 保留。' }
    ],
    selfCheckQuestion: '循环 GC 为什么不能简单地回收“引用计数长期不变”的对象？',
    selfCheckAnswer: '长期不变不代表不可达，模块单例、缓存和仍在使用的对象都可能稳定存在。GC 必须判断候选子图是否仍有集合外引用，并从这些外部根传播可达性；只有没有外部进入边的孤岛才可回收。'
  },
  '弱引用与 finalizer': {
    official: {
      title: 'weakref · Weak references',
      url: 'https://docs.python.org/3/library/weakref.html',
      note: '弱引用可以观察对象而不延长其生命周期；finalize 提供独立清理回调，并避免直接依赖 __del__ 的对象图细节。'
    },
    overview: [
      '弱引用像通讯录里的地址：可以在对象活着时找到它，却不拥有“让它继续活着”的权利。缓存、观察者表和对象到元数据的映射因此能在对象消失时自动失效。',
      '调用 weakref.ref 得到的结果必须先保存到局部变量再检查，因为另一个线程或回调可能在两次调用之间释放目标。WeakKeyDictionary 与 WeakValueDictionary 把这一语义封装成容器。',
      'weakref.finalize 把清理函数与目标生命周期关联，同时让 finalizer 自身保持存活。回调不能强引用目标，否则闭包会反向延长目标生命周期，形成“永远等不到清理”的环。'
    ],
    mechanisms: [
      '支持弱引用的类型需要提供 weakref slot；含 __slots__ 的类必须显式保留 __weakref__。',
      '目标析构时弱引用被清空，并按实现规定触发回调；回调顺序不应承担业务正确性。',
      'finalize 只保证尽力清理，进程强制退出、崩溃或解释器关闭阶段仍有限制。',
      '重要资源应优先用 with 显式释放，finalizer 只做遗忘关闭时的安全网。'
    ],
    pitfalls: [
      '弱引用回调或 finalize 参数捕获目标对象，使目标通过回调再次被强引用。',
      '先判断 ref() is not None，再次调用 ref() 使用，留下检查与使用之间的竞态窗口。',
      '把数据库提交、支付等业务动作放在 finalizer 中，执行时机无法满足事务合同。'
    ],
    example: `import gc
import weakref

events = []

class Resource:
    pass

resource = Resource()
probe = weakref.ref(resource)
cleanup = weakref.finalize(resource, events.append, "released")

del resource
gc.collect()

assert probe() is None
assert events == ["released"]
assert not cleanup.alive`,
    buildSteps: [
      { title: '实现不拥有对象的缓存', body: '先用普通 dict 复现缓存延长生命周期，再换 WeakValueDictionary 验证条目自动消失。' },
      { title: '设计安全回调', body: '让回调只接收资源句柄或不可变标识，禁止闭包捕获目标对象本身。' },
      { title: '加入显式释放', body: '实现 close/context manager，并让 finalize 作为幂等后备路径；测试重复调用不会重复释放。' }
    ],
    selfCheckQuestion: '为什么资源类即使配置了 finalizer，仍应提供 close 或上下文管理器？',
    selfCheckAnswer: 'finalizer 的执行取决于对象何时变得不可达以及解释器环境，无法保证事务所需的确定时机。close/with 把资源边界写进控制流，可测试且能及时释放；finalizer 只在调用者遗忘清理时提供幂等兜底。'
  },
  '浅拷贝、深拷贝与图': {
    official: {
      title: 'copy · Shallow and deep copy operations',
      url: 'https://docs.python.org/3/library/copy.html',
      note: '浅拷贝创建新的外层容器并复用内部对象；深拷贝递归复制，同时使用 memo 处理循环并保留共享关系。'
    },
    overview: [
      '复制对象时真正的问题是“对象图哪些边应共享，哪些节点应独立”。浅拷贝只新建根节点并复制出边；深拷贝递归创建后代，但并非把每条路径都复制成独立树。',
      'deepcopy 的 memo 以原对象身份记录已创建副本。它同时解决两个问题：遇到环时不会无限递归；多个路径指向同一原节点时，副本中仍指向同一个副本节点，保留别名拓扑。',
      '类可以通过 __copy__、__deepcopy__ 或序列化协议定义边界。数据库连接、线程锁和共享缓存通常不应被复制；值对象、配置快照和可变聚合根则可能需要定制复制。'
    ],
    mechanisms: [
      'copy.copy 优先调用类型协议，然后按类型分发表创建外壳。',
      'copy.deepcopy 在递归前后维护 memo，并把 memo 继续传给子对象。',
      '不可变原子对象通常直接返回自身，这仍符合深拷贝的“安全独立修改”目标。',
      '自定义 __deepcopy__ 应尽早把新对象放入 memo，再复制字段以支持自引用。'
    ],
    pitfalls: [
      '把 deepcopy 当作隔离所有外部状态的万能事务，复制了不应复制的句柄或昂贵模型。',
      '自定义 __deepcopy__ 忘记传 memo，导致共享关系丢失或环递归。',
      '只比较副本内容相等，没有用 is 断言验证目标层级的独立与共享合同。'
    ],
    example: `import copy

shared = {"tokens": []}
graph = {"left": shared, "right": shared}
clone = copy.deepcopy(graph)

assert clone is not graph
assert clone["left"] is clone["right"]   # 保留原图中的共享
assert clone["left"] is not shared       # 与原图隔离

clone["left"]["tokens"].append("x")
assert shared["tokens"] == []`,
    buildSteps: [
      { title: '先画对象图', body: '构造共享节点和环，明确目标副本应保留哪些内部别名，再选择 shallow 或 deep。' },
      { title: '手写 memo deepcopy', body: '实现 list/dict 两种节点；创建空副本后立刻写入 memo，再递归填充。' },
      { title: '为领域对象定制', body: '让不可复制资源继续共享或显式报错，让业务可变状态独立，并用身份断言验证合同。' }
    ],
    selfCheckQuestion: '为什么正确的深拷贝仍可能让副本中的两个字段指向同一个对象？',
    selfCheckAnswer: '深拷贝的目标是与原图隔离，同时保持原图拓扑。若原对象的两个字段共享同一节点，memo 会让它们在副本中共享同一个新节点；若分别复制成两个节点，反而改变了原有别名语义。'
  },
  '__slots__ 的布局影响': {
    official: {
      title: 'Data model · __slots__',
      url: 'https://docs.python.org/3/reference/datamodel.html#slots',
      note: '__slots__ 为指定属性创建 member descriptor，并通常省去每实例 __dict__；它改变布局、继承和弱引用能力。'
    },
    overview: [
      '普通实例把动态属性放进实例字典，灵活但每个实例需要字典相关存储。__slots__ 在类创建时声明固定字段，类型系统为每个字段安装 member descriptor，值存放在实例布局的固定偏移。',
      '节省多少内存取决于实例数量、字段数、继承和 Python 版本。slots 的主要语义是限制动态属性表面；性能提升属于需要基准验证的副作用，不能只比较 sys.getsizeof(instance) 而漏掉普通实例的 __dict__。',
      '继承会让布局变复杂：子类未声明 slots 会重新获得 __dict__；多继承中多个非空 slots 基类可能发生布局冲突；需要弱引用时还要把 __weakref__ 放进 slots。'
    ],
    mechanisms: [
      '类创建阶段把 slot 名称转换为 descriptor，descriptor 按固定 offset 读写实例内存。',
      '没有 __dict__ 时，未声明属性赋值会抛 AttributeError。',
      '声明 "__dict__" 可恢复动态属性，声明 "__weakref__" 可恢复弱引用支持。',
      'dataclass(slots=True) 会生成 slots 类，但继承、pickle 和框架反射仍需测试。'
    ],
    pitfalls: [
      '用 slots 代替输入校验或真正的不可变性；已有 slot 字段仍可被重新赋值。',
      '只量实例本体大小就宣称节省比例，遗漏普通类的字典、共享 key 与分配器粒度。',
      '在大量依赖 __dict__ 的序列化、ORM 或调试工具中启用 slots，却没有兼容测试。'
    ],
    example: `class Point:
    __slots__ = ("x", "y", "__weakref__")

    def __init__(self, x, y):
        self.x = x
        self.y = y

point = Point(1, 2)
assert not hasattr(point, "__dict__")

try:
    point.label = "origin"
except AttributeError:
    pass
else:
    raise AssertionError("未声明字段不应被创建")`,
    buildSteps: [
      { title: '比较两种布局', body: '创建字段相同的普通类和 slots 类，同时统计实例、__dict__ 与批量分配后的 tracemalloc 差值。' },
      { title: '观察 descriptor', body: '检查 Point.__dict__["x"]，调用其 __get__/__set__，理解 slot 仍然走属性协议。' },
      { title: '覆盖继承边界', body: '分别测试 slots 子类、普通子类、多继承、weakref 和 pickle，记录你的框架真正支持哪些组合。' }
    ],
    selfCheckQuestion: '__slots__ 为什么既是内存布局选择，也是公共 API 选择？',
    selfCheckAnswer: '它把任意动态属性改成预声明字段，影响反射、序列化、继承和扩展能力；调用者过去能附加的元数据可能直接失败。因此启用 slots 需要把节省的实际数据与失去的扩展表面一起评估。'
  },
  '对象生命周期实验': {
    official: {
      title: 'Data model · Object finalization',
      url: 'https://docs.python.org/3/reference/datamodel.html#object.__del__',
      note: '对象生命周期由创建、强引用所有权、可达性、终结与内存释放共同构成；__del__ 时机和解释器关闭环境存在限制。'
    },
    overview: [
      '生命周期实验的目标不是背“引用计数归零就销毁”，而是把创建、别名、容器持有、引用环、弱引用通知、finalizer 和 allocator 行为放到同一时间线。每一步都应有可观察证据。',
      '__del__ 表示对象终结钩子，不等同于内存已经归还操作系统。对象还可能在 __del__ 中复活；CPython 会确保同一对象的 finalizer 不被重复执行，但复活后的真实状态需要谨慎设计。',
      '生产诊断要分层：weakref 判断对象是否仍存活，gc 工具分析引用图，tracemalloc 追踪 Python 分配栈，RSS 则还受 pymalloc 与系统分配器影响。单看任务管理器无法判定 Python 泄漏。'
    ],
    mechanisms: [
      '构造完成后，强引用图决定对象可达性；引用计数处理无环释放，GC 补充处理不可达环。',
      '弱引用和 finalize 提供不拥有对象的观察点，适合记录终结事件。',
      '__del__ 可能在任意触发最后一次 DECREF 的线程和代码位置运行，不能依赖完整模块全局环境。',
      '对象释放后内存可回到 Python allocator 的池中复用，未必立刻让进程 RSS 下降。'
    ],
    pitfalls: [
      '在实验变量中保存被测对象或 traceback，观察代码本身让对象继续存活。',
      '用 sleep 等待析构而不控制引用图，得到依赖实现和调度的脆弱测试。',
      '把 RSS 不降直接归因于泄漏，没有检查对象数量、快照差分和 allocator 缓存。'
    ],
    example: `import gc
import weakref

timeline = []

class Probe:
    def __del__(self):
        timeline.append("finalized")

obj = Probe()
watch = weakref.ref(obj)
timeline.append("created")

del obj
gc.collect()

assert watch() is None
assert timeline == ["created", "finalized"]`,
    buildSteps: [
      { title: '建立事件时间线', body: '记录 created、alias added、container removed、finalized，并让断言描述顺序而非打印后凭感觉判断。' },
      { title: '加入环与复活', body: '分别测试普通对象、引用环、__del__ 复活，比较 weakref 与 gc.collect 的观察结果。' },
      { title: '加入内存证据', body: '用 tracemalloc 快照差分定位分配栈，再与对象存活数量和 RSS 对照，区分泄漏与 allocator 保留。' }
    ],
    selfCheckQuestion: '为什么“对象已经被回收”和“进程内存立即下降”是两个不同命题？',
    selfCheckAnswer: '对象回收表示其生命周期结束、存储可被复用；CPython 的 pymalloc 和系统 allocator 常把释放块留在池或 arena 中服务后续分配，未必马上归还操作系统。应使用 weakref、对象图和 tracemalloc 判断存活，再单独分析 RSS。'
  }
}

export const topicGuides: Partial<Record<TrackId, Record<string, TopicGuide>>> = {
  python: {
    ...pythonObjectGuides,
    ...pythonAttributeGuides,
    ...pythonFunctionGuides,
    ...pythonIterationGuides,
    ...pythonExceptionGuides,
    ...pythonImportGuides,
    ...pythonTypingGuides,
    ...pythonAsyncioGuides,
    ...pythonPerformanceGuides,
    ...pythonCpythonGuides
  },
  typescript: {
    ...typescriptRuntimeGuides,
    ...typescriptGcGuides,
    ...typescriptContextGuides,
    ...typescriptClosureGuides,
    ...typescriptThisBindingGuides,
    ...typescriptClassGuides,
    ...typescriptAccessorProxyGuides,
    ...typescriptPromiseGuides,
    ...typescriptEventLoopGuides,
    ...typescriptModuleGuides
  },
  langgraph: {
    ...langGraphRuntimeGuides
  }
}

export const getTopicGuide = (trackId: TrackId, title: string) => topicGuides[trackId]?.[title]
