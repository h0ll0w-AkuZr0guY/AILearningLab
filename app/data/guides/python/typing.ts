import type { TopicGuide } from '../../topic-guides'

export const pythonTypingGuides: Record<string, TopicGuide> = {
  '注解求值：3.14 lazy scopes、annotationlib 与 future': {
    official: {
      title: 'Language reference · Annotations',
      url: 'https://docs.python.org/3/reference/compound_stmts.html#annotations',
      note: 'Python 3.14 默认在 annotation scope 中惰性求值；future annotations 则保存字符串，两种延迟模型的反射行为不同。'
    },
    overview: [
      '注解不会自动检查运行时值。3.14 起，定义函数/类时保存可稍后求值的信息，读取 __annotations__ 或 annotationlib 时才解析；这允许前向名称和类体名称，又把 NameError/副作用推迟到反射时。',
      'from __future__ import annotations 使用旧的字符串化延迟模型。框架不应手写 eval 字符串，应通过 annotationlib.get_annotations 或 typing.get_type_hints 选择 VALUE、FORWARDREF、STRING 等格式，并显式提供 namespace。'
    ],
    mechanisms: [
      'annotation scope 能访问包围作用域和类 namespace，但其惰性值可能在更晚时刻失败。',
      'typing.get_type_hints 会解析 forward references，并可合并类 MRO 注解、剥离部分 Annotated 元数据。',
      '__annotations__ 是运行时元数据，不会改变赋值与调用语义。',
      '插件读取注解必须考虑导入副作用、任意表达式与不可信代码。'
    ],
    pitfalls: [
      '假设所有版本 __annotations__ 都是类型对象或都是字符串。',
      '对不可信模块注解直接 eval，形成代码执行入口。',
      '装饰器在定义期强制读取 lazy annotation，使本可前向引用的名称过早失败。'
    ],
    example: `import annotationlib

class Node:
    parent: "Node | None"

def link(node: Node) -> list[Node]:
    return [node]

values = annotationlib.get_annotations(link, format=annotationlib.Format.VALUE)
strings = annotationlib.get_annotations(link, format=annotationlib.Format.STRING)
assert values["return"] == list[Node]
assert "list" in strings["return"]`,
    buildSteps: [
      { title: '建立版本矩阵', body: '比较 eager、future string 与 3.14 lazy 的定义期、读取期和值形态。' },
      { title: '封装反射入口', body: '统一用 annotationlib/typing helper，参数明确 format、globals、locals 与失败策略。' },
      { title: '延迟失败测试', body: '覆盖未定义前向名、类作用域名、重定义全局名与带副作用表达式。' }
    ],
    selfCheckQuestion: '3.14 的 lazy annotations 与 future annotations 都是延迟，为什么仍不能视为同一机制？',
    selfCheckAnswer: 'future 模式把源码表达式字符串化，稍后需重新解析并重建 namespace；3.14 lazy scope 保存可按格式求值的延迟对象，能更准确保留词法环境并支持 ForwardRef 输出。反射工具、错误时机和可观察值形态都不同。'
  },
  'TypeVar：约束、bound、default 与解算结果': {
    official: {
      title: 'typing.TypeVar',
      url: 'https://docs.python.org/3/library/typing.html#typing.TypeVar',
      note: 'constraints 限定离散候选并提升到成员类型；bound 接受上界子类型并保留推断出的具体类型；default 在未推断时使用。'
    },
    overview: [
      'TypeVar 表达多处类型之间的关系，不等于 Union。约束 TypeVar(str, bytes) 要求一次调用统一选择其中一个成员，子类通常提升为对应成员；bound=SupportsAbs 允许任意满足上界的具体类型并保留该具体类型。',
      'default 是调用点无法从参数推断类型实参时的后备值，不会放宽 bound/constraints。API 应先问需要“有限模式选择”还是“开放扩展的上界”，再决定约束或 bound。'
    ],
    mechanisms: [
      '同一 TypeVar 在参数与返回位置建立相关性。',
      'constraints 至少两个且不能与 bound 同时使用。',
      '显式类型实参与参数证据共同参与解算。',
      'Any 可能污染解算并把未知传播到返回值。'
    ],
    pitfalls: [
      '用 Union[T1,T2] 替代 constrained TypeVar，丢失输入输出同型关系。',
      'bound 写成具体实现类，阻断结构兼容扩展。',
      '为方便把 default=Any，掩盖调用点缺失的类型证据。'
    ],
    example: `from typing import TypeVar

AnyText = TypeVar("AnyText", str, bytes)
Comparable = TypeVar("Comparable", bound="SupportsLessThan")

def concat(left: AnyText, right: AnyText) -> AnyText:
    return left + right

assert concat("a", "b") == "ab"
assert concat(b"a", b"b") == b"ab"
# concat("a", b"b") 在静态检查中失败：一次调用无法选择同一约束成员。`,
    buildSteps: [
      { title: '写关系测试', body: '用 reveal_type 或 assert_type 证明返回类型随参数改变，而非只检查“能否通过”。' },
      { title: '比较三模型', body: '为同一 API 分别用 Union、constraints、bound，记录子类和混合参数推断差异。' },
      { title: '审计 Any', body: '对无注解依赖和 Any 输入加回归样例，防止返回契约静默退化。' }
    ],
    selfCheckQuestion: 'TypeVar("T", str, bytes) 与 T bound=str|bytes 的推断差异是什么？',
    selfCheckAnswer: 'constraints 从离散集合选择成员，str 子类输入通常被提升为 str；bound 接受上界之下的具体子类型，解算可保留子类。前者适合有限实现模式，后者适合开放的多态接口。'
  },
  '泛型函数推断、overload 与实现签名': {
    official: {
      title: 'Typing spec · Overload definitions',
      url: 'https://typing.python.org/en/latest/spec/overload.html',
      note: 'overload variants 描述调用者可见关系，实现签名负责运行时分派且需兼容所有 variants，但调用时通常不可见。'
    },
    overview: [
      '泛型调用从实参、上下文返回类型和约束收集候选，再求满足全部使用点的类型实参。overload 则先展开参数兼容性，按规范规则选择 variant；实现签名只检查实现能否覆盖所有分支，不给调用者兜底。',
      'overload 适合返回类型由参数字面量、参数组合或位置决定且普通 TypeVar 无法表达的 API。分支顺序要与运行时判断顺序一致，重叠分支必须返回兼容类型，否则静态选择与真实行为可能相反。'
    ],
    mechanisms: [
      'variant 只写 ...，紧跟单个运行时实现。',
      '实现参数应接受所有 variant 输入，返回应覆盖全部 variant 输出。',
      'Literal 可表达值依赖分支，TypeVar 更适合同型关系。',
      'Any 和 Union 参数会触发不确定匹配与联合返回规则。'
    ],
    pitfalls: [
      '加一个宽泛最后 variant 掩盖错误调用。',
      '静态 overload 顺序与运行时 isinstance 顺序不一致。',
      '实现签名通过却假设调用者能看到其更宽输入。'
    ],
    example: `from typing import Literal, overload

@overload
def decode(raw: bytes, *, text: Literal[False] = False) -> bytes: ...
@overload
def decode(raw: bytes, *, text: Literal[True]) -> str: ...

def decode(raw: bytes, *, text: bool = False) -> bytes | str:
    return raw.decode() if text else raw

assert decode(b"x") == b"x"
assert decode(b"x", text=True) == "x"`,
    buildSteps: [
      { title: '列调用矩阵', body: '先列每种参数组合与返回，再决定 TypeVar、Literal 或 overload。' },
      { title: '检查覆盖与重叠', body: '为每个 variant 找到运行时分支，并证明实现参数/返回兼容。' },
      { title: '锁定推断', body: '用 assert_type 覆盖 literals、普通 bool、Any、Union 与非法组合。' }
    ],
    selfCheckQuestion: '为什么 overload 的实现签名通常不作为调用者最后一个候选？',
    selfCheckAnswer: '实现签名是内部运行时容器，常被迫写得更宽以容纳全部分支；若公开参与匹配，错误调用会落到宽签名而失去静态检查。调用合同由 variants 定义，实现只需证明能兑现它们。'
  },
  'Protocol 结构子类型与 runtime_checkable 边界': {
    official: {
      title: 'typing specification · Protocols',
      url: 'https://typing.python.org/en/latest/spec/protocol.html',
      note: '显式 Protocol 定义结构合同；实现类无需继承。runtime_checkable 只提供有限的属性存在检查，不校验完整签名。'
    },
    overview: [
      'Protocol 把依赖方向从“继承某基类”改为“提供这些成员”。第三方类型可在不感知协议的情况下满足合同，特别适合端口、适配器和小接口。',
      '@runtime_checkable 仅让 isinstance/issubclass 做浅层成员存在判断，通常不验证参数类型、返回类型或属性可写性。它适合 feature detection，不可替代数据验证与静态 checker。'
    ],
    mechanisms: [
      '协议成员包括方法与带类型的 data attributes。',
      '可变属性使类型参数倾向不变，readonly property 可允许协变。',
      '显式继承 Protocol 的具体类仍需实现抽象成员才能实例化。',
      'runtime protocol 成员集合在类创建后冻结。'
    ],
    pitfalls: [
      '把巨大对象所有成员塞进一个 Protocol，造成结构耦合。',
      'isinstance(x, P) 通过后假定签名与泛型参数正确。',
      '协议声明可写字段却希望协变，破坏写入安全。'
    ],
    example: `from typing import Protocol, runtime_checkable

@runtime_checkable
class Reader(Protocol):
    def read(self, size: int = -1) -> bytes: ...

class SocketLike:
    def read(self, size=-1):
        return b"data"

reader: Reader = SocketLike()
assert reader.read(2) == b"data"
assert isinstance(reader, Reader)  # 只确认 read 存在，不证明其签名。`,
    buildSteps: [
      { title: '从消费者抽取', body: '只把调用方实际使用的成员放进协议，避免复制实现类完整 API。' },
      { title: '做正反实现', body: '一个隐式满足、一个缺成员、一个签名错误，用 checker 与 runtime check 对照。' },
      { title: '证明可变性', body: '把 attribute 分别声明为可写字段和只读 property，观察方差结论。' }
    ],
    selfCheckQuestion: 'runtime_checkable Protocol 的 isinstance 通过，为什么仍不能保证调用安全？',
    selfCheckAnswer: '运行时检查主要确认成员名称存在，不做完整类型签名、overload、泛型实参和可写性验证。对象可能有同名但参数完全不同的方法。静态兼容由 checker 证明，运行时输入仍需独立验证。'
  },
  'ABC 名义子类型、register 与 __subclasshook__': {
    official: {
      title: 'abc · Abstract Base Classes',
      url: 'https://docs.python.org/3/library/abc.html',
      note: 'ABC 可通过继承、register 虚拟注册或 __subclasshook__ 影响 issubclass；虚拟子类不会获得实现，也不进入 MRO。'
    },
    overview: [
      'ABC 同时提供名义合同与可复用实现。abstractmethod 阻止缺实现的名义子类实例化；register 把外部类声明为虚拟子类，只改变 issubclass/isinstance 结果，不注入方法。',
      '__subclasshook__ 可按类字典结构判断兼容，返回 True/False/NotImplemented。它是全局运行时语义，过宽规则会让不满足行为合同的类被永久视为子类。'
    ],
    mechanisms: [
      'abstractmethod 可与 property/classmethod 组合，装饰器顺序有要求。',
      'register 返回被注册类，可作装饰器。',
      '虚拟子类的 MRO 不包含 ABC，super 不会进入 ABC 实现。',
      'get_cache_token 可观察虚拟注册缓存失效。'
    ],
    pitfalls: [
      'register 后调用 ABC 提供的 concrete helper，虚拟类并未继承它。',
      '__subclasshook__ 只看一个同名属性就承诺复杂语义。',
      '用 ABC 强迫第三方模型继承，增加不必要依赖。'
    ],
    example: `from abc import ABC, abstractmethod

class Repository(ABC):
    @abstractmethod
    def get(self, key: str) -> object: ...

class LegacyRepo:
    def get(self, key):
        return key

Repository.register(LegacyRepo)
assert issubclass(LegacyRepo, Repository)
assert Repository not in LegacyRepo.__mro__`,
    buildSteps: [
      { title: '区分三条路径', body: '分别测试继承、register、subclasshook 的实例化、MRO、方法获取和 isinstance。' },
      { title: '约束 hook', body: '只对非常稳定且可用名称检查的协议返回 True，其余返回 NotImplemented。' },
      { title: '选择 ABC/Protocol', body: '需要共享实现或运行时注册选 ABC；仅静态消费合同优先小 Protocol。' }
    ],
    selfCheckQuestion: 'ABC.register 为什么不等价于继承？',
    selfCheckAnswer: 'register 只把类加入虚拟子类关系，使 isinstance/issubclass 为真；它不修改目标类 MRO、不会复制 concrete methods，也不执行 abstractmethod 完整性检查。它是一项运行时分类声明，而非实现复用机制。'
  },
  '协变、逆变、不变与可变性证明': {
    official: {
      title: 'Typing specification · Variance inference',
      url: 'https://typing.python.org/en/latest/spec/generics.html#variance-inference',
      note: '类型参数只用于输出可推断协变，只用于输入可推断逆变，同时读写通常不变；3.12 语法可由 checker 推断。'
    },
    overview: [
      '若 Cat <: Animal，Producer[Cat] 可替代 Producer[Animal]，这是协变；Consumer[Animal] 可替代 Consumer[Cat]，这是逆变。可读可写 Box[Cat] 不能当 Box[Animal]，否则调用者可能写入 Dog，所以保持不变。',
      '方差属于 generic type constructor，不是某个变量的属性。证明方法是把 T 出现位置按“数据流出/流入”追踪，并考虑 Callable 参数会反转一次位置。'
    ],
    mechanisms: [
      '不可变容器的读取接口常协变，可变容器通常不变。',
      '回调参数类型常逆变，返回类型协变。',
      '私有/Final 存储可帮助 checker 推断只读类协变。',
      'ParamSpec 与 TypeVarTuple 按规范保持不变。'
    ],
    pitfalls: [
      '背诵 list invariant 却不能构造写入反例。',
      '给可写 Protocol 强行声明 covariant。',
      '把子类关系方向直接复制到 Consumer，遗漏输入位置反转。'
    ],
    example: `from typing import Protocol

class Animal: ...
class Cat(Animal): ...

class Producer[T_co](Protocol):
    def produce(self) -> T_co: ...

class Consumer[T_contra](Protocol):
    def consume(self, value: T_contra) -> None: ...

def feed(source: Producer[Cat], sink: Consumer[Cat]) -> None:
    sink.consume(source.produce())

# Producer[Cat] 可用于需要 Producer[Animal] 的只读位置；
# Consumer[Animal] 可用于需要 Consumer[Cat] 的位置。`,
    buildSteps: [
      { title: '写替换反例', body: '对每个候选方差假设构造调用者允许的读写，找出是否能写入错误类型。' },
      { title: '标注正负位置', body: '返回为正、参数为负，嵌套 Callable 每穿过参数位置反转一次。' },
      { title: '用 checker 验证', body: '为 Producer、Consumer、Box 写合法/非法赋值样例并锁定诊断。' }
    ],
    selfCheckQuestion: '为什么 list[Cat] 不能赋给 list[Animal]，即使 Cat 是 Animal？',
    selfCheckAnswer: '接收 list[Animal] 的代码有权 append(Dog)。若实际对象是 list[Cat]，写入后再按 Cat 读取就不安全。读写接口让元素类型同时处于输出和输入位置，因此 list 必须不变。'
  },
  'ParamSpec、Concatenate 与装饰器签名': {
    official: {
      title: 'typing.ParamSpec',
      url: 'https://docs.python.org/3/library/typing.html#typing.ParamSpec',
      note: 'ParamSpec 转发完整 callable 参数形状；P.args/P.kwargs 只用于包装实现，Concatenate 表达在前端增加或移除位置参数。'
    },
    overview: [
      '普通 TypeVar 只能表示一个类型，无法保存 positional-only、keyword-only、默认值和名称组成的整个调用签名。ParamSpec 把这套参数列表作为一个变量，让装饰器返回与输入完全相同的 Callable[P,R]。',
      'Concatenate[Context,P] 表示包装器内部调用需要额外前缀参数，而对外隐藏或注入它。它只支持 Callable 的首参数位置，无法任意删除中间关键字参数。'
    ],
    mechanisms: [
      '实现体以 *args: P.args、**kwargs: P.kwargs 转发。',
      '返回值关系用独立 TypeVar R。',
      'functools.wraps 保运行时元数据，ParamSpec 保静态签名，两者职责不同。',
      '方法 descriptor 的 self 与 Concatenate 注入参数需分别建模。'
    ],
    pitfalls: [
      '用 Callable[..., R]，返回包装器后所有参数检查消失。',
      '只写 ParamSpec 却忘记 wraps，反射框架仍看到 inner。',
      '试图用 Concatenate 删除末尾或任意命名参数。'
    ],
    example: `from collections.abc import Callable
from functools import wraps
from typing import ParamSpec, TypeVar

P = ParamSpec("P")
R = TypeVar("R")

def traced(fn: Callable[P, R]) -> Callable[P, R]:
    @wraps(fn)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        print(fn.__qualname__, args, kwargs)
        return fn(*args, **kwargs)
    return wrapper`,
    buildSteps: [
      { title: '先保真转发', body: 'Callable[P,R] 到 Callable[P,R]，覆盖各类参数和非法调用。' },
      { title: '加入上下文', body: '用 Concatenate 注入 request/lock，明确它在公开签名内还是由装饰器隐藏。' },
      { title: '双重验收', body: 'checker 用 assert_type，运行时用 inspect.signature 与 __wrapped__。' }
    ],
    selfCheckQuestion: 'ParamSpec 与 functools.wraps 分别解决什么问题？',
    selfCheckAnswer: 'ParamSpec 让静态 checker 知道包装前后的完整参数关系；wraps 复制运行时名称、文档并设置 __wrapped__，让 inspect 等反射工具恢复原函数。只用其中一个都会在另一层丢失签名。'
  },
  'TypedDict：Required、NotRequired、ReadOnly 与演进': {
    official: {
      title: 'typing.TypedDict',
      url: 'https://docs.python.org/3/library/typing.html#typing.TypedDict',
      note: 'TypedDict 描述具有固定字符串键集合的 dict 静态形状；运行时仍是普通 dict，不做构造验证。'
    },
    overview: [
      'TypedDict 适合 JSON-like 边界：每个键有独立类型，Required/NotRequired 决定存在性，ReadOnly 限制静态写入。total=False 只改变默认必需性，不把 value 自动变成 Optional。',
      '结构兼容还需考虑额外键、必需性和可写性。可写字段会带来类型污染风险；只读消费者合同更容易接受字段更具体或含额外数据的 producer。'
    ],
    mechanisms: [
      '__required_keys__/__optional_keys__ 提供运行时元数据，但值仍未验证。',
      '键缺失与键存在且值 None 是两种合同。',
      'ReadOnly 是静态限制，不冻结运行时 dict。',
      'API 演进新增 NotRequired 键通常比新增 Required 键兼容。'
    ],
    pitfalls: [
      'isinstance(payload, MyTypedDict)，TypedDict 不支持这种运行时验证。',
      '用 Optional[T] 表示键可缺失。',
      '把外部未校验 JSON 直接 cast 成 TypedDict。'
    ],
    example: `from typing import NotRequired, ReadOnly, Required, TypedDict

class UserPayload(TypedDict, total=False):
    id: Required[ReadOnly[str]]
    display_name: str
    email: NotRequired[str | None]

payload: UserPayload = {"id": "u-1"}
payload["display_name"] = "Ada"
# payload["id"] = "u-2"  # 静态错误；运行时 dict 并不会阻止。`,
    buildSteps: [
      { title: '列存在性矩阵', body: '为每个键记录 required/optional、nullable、readonly，禁止三者混写。' },
      { title: '加运行时验证', body: '入口先 schema parser，验证后才返回 TypedDict；不要用 cast 冒充证据。' },
      { title: '模拟版本演进', body: '对新增/删除/改类型/改必需性写 producer-consumer 兼容测试。' }
    ],
    selfCheckQuestion: 'NotRequired[str] 与 Required[str | None] 有何本质区别？',
    selfCheckAnswer: '前者允许键完全缺失，但一旦存在必须是 str；后者要求键始终存在，值可以是 str 或 None。它们对应 JSON patch 与完整资源表示中不同的数据语义。'
  },
  'TypeGuard、TypeIs 与双分支收窄': {
    official: {
      title: 'typing.TypeIs',
      url: 'https://docs.python.org/3/library/typing.html#typing.TypeIs',
      note: 'TypeIs 的目标类型必须兼容输入，并在 true/false 两侧做交集/排除收窄；TypeGuard 主要只承诺 true 分支。'
    },
    overview: [
      '用户定义谓词让 checker 信任函数签名中的逻辑证明。TypeGuard 可把输入在真分支改成目标类型，甚至目标并非原类型的严格子类型；假分支通常不排除目标。TypeIs 更接近 isinstance，要求兼容并收窄两侧。',
      'checker 不会验证函数实现真的证明了声明。错误谓词等同于不安全 cast，会把运行时失败推迟到更远位置；谓词应小而纯，并用正反例测试。'
    ],
    mechanisms: [
      '收窄对象通常是首个显式参数，方法中是 self 后的参数。',
      'TypeIs true 分支取已有类型与目标交集，false 分支排除目标。',
      'TypeGuard 常用于 invariant 容器的更强承诺。',
      '谓词内部实现与声明的一致性由作者承担。'
    ],
    pitfalls: [
      '只检查 list 第一项就声明 TypeGuard[list[str]]。',
      '谓词修改被检查对象，引入检查后使用前的竞态。',
      '期望 TypeGuard false 分支自动得到补集。'
    ],
    example: `from typing import TypeIs

def is_str(value: object) -> TypeIs[str]:
    return isinstance(value, str)

def normalize(value: str | int) -> str:
    if is_str(value):
        return value.strip()  # value: str
    return str(value)         # value: int，false 分支也被收窄

assert normalize(" x ") == "x"
assert normalize(7) == "7"`,
    buildSteps: [
      { title: '写集合解释', body: '把输入类型视为集合，计算 true 的交集与 false 的差集。' },
      { title: '证明谓词', body: '为所有目标成员写正例，为相邻非成员写反例，禁止采样式检查。' },
      { title: '对照两种返回', body: '相同函数分别标 TypeGuard/TypeIs，用 reveal_type 比较两分支。' }
    ],
    selfCheckQuestion: '为什么错误的 TypeGuard/TypeIs 实现比普通 bool helper 更危险？',
    selfCheckAnswer: 'bool helper 只影响运行时分支；类型谓词还向 checker 提交证明，使后续代码省略检查并调用特定成员。checker 通常不验证函数体与承诺一致，错误声明会系统性制造虚假安全。'
  },
  'mypy、pyright 差异与类型回归测试': {
    official: {
      title: 'Typing specification · Conformance',
      url: 'https://typing.python.org/en/latest/spec/conformance.html',
      note: 'typing specification 定义共同语义，checker 仍可能在尚未规范化、配置、推断启发式和错误恢复上存在差异。'
    },
    overview: [
      '类型注解是一门由规范、typeshed、checker 版本和配置共同实现的语言。mypy 支持成熟插件生态与部分名义工作流，pyright 常更积极实现新规范并采用不同推断；“某工具通过”不自动意味着公共库对其他消费者稳定。',
      '类型回归测试应像运行时测试一样提交：正例必须通过，反例必须在指定位置失败，reveal_type/assert_type 锁定推断结果。公共库可用两个 checker 跑核心合同，工具专属行为则隔离并记录原因。'
    ],
    mechanisms: [
      'strict 是一组开关，不同工具同名模式细节不同。',
      'stub、py.typed、插件和配置搜索路径会改变结果。',
      'checker 升级应审阅诊断变化，不盲目批量 ignore。',
      '最小复现必须包含 Python 版本与完整配置。'
    ],
    pitfalls: [
      '用 # type: ignore 不带错误码，未来其他错误也被吞。',
      '只测试实现文件，不从消费者视角测试已发布 API。',
      '依赖 checker bug/启发式设计过度聪明的公共签名。'
    ],
    example: `from typing import assert_type

def first[T](items: list[T]) -> T:
    return items[0]

assert_type(first([1, 2]), int)
assert_type(first(["a"]), str)

# tests/typecheck/fail_first.py:
# first([])  # 需要上下文才能推断 T，期望 checker 给出明确诊断。
#
# CI:
# python -m mypy --strict src tests/typecheck/pass
# pyright --project pyrightconfig.json`,
    buildSteps: [
      { title: '固定环境', body: '锁 Python、mypy、pyright、typing_extensions 与配置文件。' },
      { title: '建立 pass/fail 样例', body: '正例断推断类型，反例按错误码/行号验收，避免只看退出码。' },
      { title: '管理差异', body: '先判断规范允许还是工具 bug，再最小化隔离，附 issue 与删除条件。' }
    ],
    selfCheckQuestion: '为什么类型测试不能只检查 checker 退出码为 0？',
    selfCheckAnswer: 'API 可能悄悄退化为 Any，checker 仍无错误退出；非法调用也可能因宽泛 overload 被接受。assert_type/reveal_type 锁定正向推断，独立 fail fixtures 锁定应拒绝的调用，二者共同验证合同。'
  }
}
