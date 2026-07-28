import type { TopicGuide } from '../../topic-guides'

export const pythonAttributeGuides: Record<string, TopicGuide> = {
  '实例字典、类字典与查找入口': {
    official: {
      title: 'Data model · Custom classes',
      url: 'https://docs.python.org/3/reference/datamodel.html#custom-classes',
      note: '类对象和通常的实例分别拥有命名空间。属性表达式不会简单地把两个字典合并，而是进入类型定义的属性访问协议。'
    },
    overview: [
      '普通实例的 __dict__ 保存这个实例独有的动态属性，类的 __dict__ 保存由类体创建的属性、函数和 descriptor。类字典实际由 mappingproxy 暴露只读视图，修改类属性应通过 setattr(cls, name, value) 进入类型协议。',
      '读取 obj.name 时，解释器以 type(obj) 为起点查 MRO，并同时考虑 descriptor 与实例字典；写入 obj.name 通常落到实例字典，但 data descriptor 或自定义 __setattr__ 可以截获它。由此可见，“先查实例再查类”只是缺少 descriptor 时的近似说法。',
      '同名实例字段会 shadow 普通类变量和 non-data descriptor，却压不过 data descriptor。课程后续会把这张优先级表逐项实现；这一节先建立两个命名空间和同名遮蔽的可观察模型。'
    ],
    mechanisms: [
      'class 语句先执行类体形成临时 namespace，再由 metaclass 创建类对象。',
      'C.__dict__ 是 mappingproxy，反映真实类字典但阻止绕过 type.__setattr__ 直接写入。',
      '普通实例在布局允许时持有 __dict__；slots 实例可能完全没有实例字典。',
      '类属性更新会使类型查找缓存失效，现有实例下次读取可立即观察到新值。'
    ],
    pitfalls: [
      '直接写 C.__dict__["x"]，忽略 mappingproxy 只读且类修改需要使内部缓存失效。',
      '把 obj.x = value 误认为会修改 C.x；普通赋值会在实例字典创建同名遮蔽项。',
      '使用 vars(obj) 作为所有对象通用接口，忽略 slots、C 扩展对象和代理对象可能没有 __dict__。'
    ],
    example: `class Service:
    timeout = 10

first = Service()
second = Service()

first.timeout = 3
assert first.__dict__ == {"timeout": 3}
assert second.__dict__ == {}
assert first.timeout == 3
assert second.timeout == 10

Service.timeout = 20
assert first.timeout == 3       # 实例字段继续遮蔽
assert second.timeout == 20     # 仍从类字典读取`,
    buildSteps: [
      { title: '画出两个命名空间', body: '分别列出 Service.__dict__、first.__dict__、second.__dict__，在每次赋值后更新名称到对象的边。' },
      { title: '制造同名 shadowing', body: '先读类变量，再写实例变量，最后修改类变量；用三个断言解释可见范围。' },
      { title: '引入 slots 反例', body: '创建无 __dict__ 的 slots 类，验证固定字段仍通过 descriptor 工作，实例字典并非属性系统的必需部件。' }
    ],
    selfCheckQuestion: '为什么修改 Service.timeout 能影响尚未写入 timeout 的所有实例，却不会覆盖 first.timeout？',
    selfCheckAnswer: '未写入的实例没有同名实例项，读取会继续走到类字典；first 已在自己的字典中建立遮蔽项，普通类变量属于 non-data 路径，实例项优先。若类上放的是 data descriptor，优先级会反过来。'
  },
  'object.__getattribute__ 完整查找链': {
    official: {
      title: 'Descriptor Guide · Invocation from an instance',
      url: 'https://docs.python.org/3/howto/descriptor.html#invocation-from-an-instance',
      note: 'object.__getattribute__ 实现实例属性读取主链：data descriptor、实例字典、non-data descriptor、普通类变量，全部失败后才由点号表达式触发 __getattr__。'
    },
    source: {
      repo: 'python/cpython',
      file: 'Objects/object.c',
      symbol: '_PyObject_GenericGetAttrWithDict',
      language: 'c',
      code: `PyObject *
_PyObject_GenericGetAttrWithDict(
    PyObject *obj, PyObject *name, PyObject *dict, int suppress)
{
    PyTypeObject *tp = Py_TYPE(obj);
    PyObject *descr = NULL;
    PyObject *res = NULL;
    descrgetfunc f = NULL;

    // ① 先沿类型 MRO 查找类属性，并取得其 tp_descr_get。
    _PyType_LookupStackRefAndVersion(tp, name, &cref.ref);
    descr = PyStackRef_AsPyObjectBorrow(cref.ref);
    if (descr != NULL) {
        f = Py_TYPE(descr)->tp_descr_get;
        // ② data descriptor 拥有最高读取优先级。
        if (f != NULL && PyDescr_IsData(descr)) {
            res = f(descr, obj, (PyObject *)Py_TYPE(obj));
            goto done;
        }
    }

    // ③ 随后读取实例字典或 inline values。
    if (dict != NULL && PyDict_GetItemRef(dict, name, &res) != 0) {
        goto done;
    }

    // ④ 实例未命中时才调用 non-data descriptor。
    if (f != NULL) {
        res = f(descr, obj, (PyObject *)Py_TYPE(obj));
        goto done;
    }
    // ⑤ 最后返回普通类变量，否则构造 AttributeError。
}`,
      walkthrough: [
        '上游源码先从类型和 MRO 找类属性，descriptor 判定早于实例字典。',
        'PyDescr_IsData 决定最高优先级分支，和课程手写版的 is_data 完全对应。',
        '实例存储在新版本中可能是 inline values、managed dict 或传统 dict pointer，属于同一语义的多种布局优化。',
        'non-data descriptor 被刻意放在实例字典之后，普通类变量则是最后一个成功分支。'
      ],
      url: 'https://github.com/python/cpython/blob/main/Objects/object.c#L1767-L1890'
    },
    overview: [
      '每一次 obj.name 都先进入 type(obj) 的 tp_getattro 槽，普通 Python 类通常落到 PyObject_GenericGetAttr。它先沿 MRO 找类属性，并检查该属性的类型是否提供 __get__、__set__ 或 __delete__，然后才决定实例字典和类属性谁优先。',
      '最容易漏掉的细节是 descriptor 身份由“类属性对象的类型”决定。某个对象拥有名为 __get__ 的实例字段并不够；协议查找会在 type(descriptor) 上寻找特殊方法，避免 descriptor 自身的实例属性再次触发无限元协议。',
      '__getattribute__ 必须对所有名称运行，包括读取 helper、__dict__ 和 __class__。自定义实现若用 self.__dict__ 继续取值，会再次进入自己，形成递归；安全做法是调用 object.__getattribute__(self, name) 获取原始基础能力。'
    ],
    mechanisms: [
      'find_name_in_mro(type(obj), name) 返回首个类字典命中，并受 C3 线性化顺序约束。',
      '命中对象的类型若定义 __get__ 且还定义 __set__ 或 __delete__，它是 data descriptor，优先于实例字典。',
      '无 data descriptor 时检查实例字典；随后调用 non-data descriptor.__get__ 或直接返回类变量。',
      '主链抛出 AttributeError 后，点号和 getattr 才查找类上的 __getattr__；直接调用 object.__getattribute__ 不包含该兜底。'
    ],
    pitfalls: [
      '在自定义 __getattribute__ 中使用 getattr(self, name) 或 self.__dict__，无限递归直到 RecursionError。',
      '把 descriptor 判定写成 hasattr(cls_var, "__get__")，与 CPython 的特殊方法类型查找语义不一致。',
      '吞掉属性内部执行产生的所有 AttributeError，并错误地交给 __getattr__，掩盖真实业务 bug。'
    ],
    example: `def find_in_mro(cls, name, missing):
    for base in cls.__mro__:
        if name in vars(base):
            return vars(base)[name]
    return missing

def object_getattribute(obj, name):
    missing = object()
    obj_type = type(obj)
    class_value = find_in_mro(obj_type, name, missing)
    descriptor_type = type(class_value)
    descriptor_get = getattr(descriptor_type, "__get__", missing)

    is_data = descriptor_get is not missing and (
        hasattr(descriptor_type, "__set__")
        or hasattr(descriptor_type, "__delete__")
    )
    if is_data:
        return descriptor_get(class_value, obj, obj_type)

    namespace = vars(obj)
    if name in namespace:
        return namespace[name]

    if descriptor_get is not missing:
        return descriptor_get(class_value, obj, obj_type)
    if class_value is not missing:
        return class_value
    raise AttributeError(name)`,
    buildSteps: [
      { title: '只实现 MRO 查找', body: '先写 find_in_mro 并验证多继承的首个命中，暂不加入 descriptor。' },
      { title: '加入 data descriptor 分支', body: '从 type(class_value) 读取协议方法，把最高优先级分支放到实例字典之前。' },
      { title: '补齐实例与 non-data 分支', body: '加入实例字典、non-data descriptor、普通类变量和 AttributeError，逐个构造测试。' },
      { title: '与内建结果差分测试', body: '对普通字段、property、函数、cached_property 和缺失字段同时调用模拟器与 getattr，比较结果和异常类型。' }
    ],
    selfCheckQuestion: '为什么 data descriptor 的判断要查看 type(class_value)，而不是 class_value 自己的实例字典？',
    selfCheckAnswer: 'Python 的特殊方法通常隐式从类型上解析，descriptor 协议也遵循这一规则。这样协议行为由 descriptor 类稳定定义，不会因某个 descriptor 实例动态塞入 __get__ 而改变解释器分派，也避免协议查找递归进入同一属性系统。'
  },
  '__getattr__ 兜底与递归陷阱': {
    official: {
      title: 'Data model · object.__getattr__',
      url: 'https://docs.python.org/3/reference/datamodel.html#object.__getattr__',
      note: '__getattr__ 仅在正常属性查找未找到名称时被调用。它应返回派生值或抛 AttributeError；赋值需要另行实现 __setattr__。'
    },
    overview: [
      '__getattr__ 适合表达“缺失名称可以如何派生”，例如代理远端字段、兼容旧名称、按需加载或给配置提供受控默认值。已有字段不会经过它，因此它比重写所有访问的 __getattribute__ 风险小。',
      '点号表达式调用 type(obj).__getattribute__；若它以 AttributeError 结束，slot 逻辑再寻找 __getattr__。直接写 object.__getattribute__(obj, name) 只运行主链，不会自动补兜底，这个差异常用于实现安全的代理。',
      '兜底必须对未知名称继续抛 AttributeError。返回 None 会让 hasattr 误判属性存在，也会把拼写错误推迟到更远位置。代理还要维护 allowlist，避免把内部私有属性和权限边界一起转发。'
    ],
    mechanisms: [
      '__getattr__ 从类上作为特殊方法解析，不是先从实例字典读取同名 callable。',
      '只有 AttributeError 表示“正常缺失”；其他异常通常应原样传播。',
      '读取内部状态时调用 object.__getattribute__，避免再次触发代理兜底。',
      'hasattr 本质上尝试 getattr 并吞掉 AttributeError，因此兜底的异常纪律会改变反射结果。'
    ],
    pitfalls: [
      '兜底中写 self._backend，而 _backend 尚未初始化，又进入 __getattr__ 造成递归。',
      '对所有缺失名称返回占位值，让拼写错误、接口漂移和权限问题静默通过。',
      '捕获 Exception 后统一转成 AttributeError，掩盖后端超时、解析错误等真实失败。'
    ],
    example: `class Config:
    def __init__(self, values):
        object.__setattr__(self, "_values", dict(values))

    def __getattr__(self, name):
        values = object.__getattribute__(self, "_values")
        if name.startswith("_"):
            raise AttributeError(name)
        try:
            return values[name]
        except KeyError:
            raise AttributeError(name) from None

config = Config({"timeout": 3})
assert config.timeout == 3
assert not hasattr(config, "tiemout")`,
    buildSteps: [
      { title: '只代理一个公开名称', body: '先允许 timeout，其他名称全部抛 AttributeError，建立最小安全边界。' },
      { title: '保护内部读取', body: '用 object.__getattribute__ 读取 _values，并测试构造尚未完成时也不会无限递归。' },
      { title: '分类失败', body: 'KeyError 转成 AttributeError；后端连接错误保持原样，让调用者能区分缺失和系统故障。' }
    ],
    selfCheckQuestion: '为什么 __getattr__ 返回 None 作为“通用默认值”会破坏 Python 的反射协议？',
    selfCheckAnswer: 'hasattr 和许多框架用 AttributeError 判断名称是否存在。返回 None 会把任意拼写都报告为存在，IDE、序列化和兼容检查失去可靠信号；更远的代码才会以 NoneType 错误失败，根因被隐藏。'
  },
  'data 与 non-data descriptor 优先级': {
    official: {
      title: 'Descriptor Guide · Summary of invocation logic',
      url: 'https://docs.python.org/3/howto/descriptor.html#summary-of-invocation-logic',
      note: '定义 __set__ 或 __delete__ 的 descriptor 属于 data descriptor，优先于实例字典；只定义 __get__ 的 non-data descriptor 可以被实例同名项遮蔽。'
    },
    overview: [
      'descriptor 是放在类字典中的对象，它通过 __get__、__set__、__delete__ 接管另一个对象的属性。优先级差异是有意设计：property、验证字段等 data descriptor 必须守住写入和读取不变量；函数、cached_property 等 non-data descriptor 则允许实例缓存或覆盖。',
      'data 的判定不取决于 __set__ 是否真的允许赋值。只要 descriptor 类型定义 __set__，即使实现总是抛 AttributeError，它仍压过实例字典，这正是只读 property 能阻止同名实例字段绕过的原因。',
      'cached_property 反向利用 non-data 规则：第一次 __get__ 计算结果并写入实例字典，下一次实例字典在 descriptor 之前命中，从此不再执行 descriptor。'
    ],
    mechanisms: [
      '__get__(descriptor, instance, owner) 在实例访问时接收对象，在类访问时 instance 通常为 None。',
      '__set__ 或 __delete__ 任意存在即可获得 data descriptor 优先级。',
      '实例字典位于 data descriptor 之后、non-data descriptor 之前。',
      'descriptor 必须定义在类或其 MRO 上；把 descriptor 对象塞进实例字典不会自动调用协议。'
    ],
    pitfalls: [
      '认为只读 descriptor 只需 __get__，结果被实例字典轻易遮蔽；应提供抛 AttributeError 的 __set__。',
      '在 __get__ 内用 instance.public_name 读取自身，重新触发同一 descriptor。',
      '把 descriptor 存在每个实例里，既浪费内存又没有协议调用效果。'
    ],
    example: `class Positive:
    def __set_name__(self, owner, name):
        self.storage_name = f"_{name}"

    def __get__(self, instance, owner=None):
        if instance is None:
            return self
        return instance.__dict__[self.storage_name]

    def __set__(self, instance, value):
        if value <= 0:
            raise ValueError("必须为正数")
        instance.__dict__[self.storage_name] = value

class Product:
    price = Positive()

item = Product()
item.price = 12
item.__dict__["price"] = -1       # 尝试同名绕过
assert item.price == 12           # data descriptor 仍然优先`,
    buildSteps: [
      { title: '实现 non-data 版本', body: '只写 __get__，在实例字典放入同名值，确认它能遮蔽 descriptor。' },
      { title: '增加 __set__ 升级为 data', body: '即使 __set__ 只抛错，实例同名项也不再优先；用完全相同的测试对比。' },
      { title: '复现 cached_property', body: 'non-data __get__ 首次计算后写入公开名称，让后续读取直接走实例字典。' }
    ],
    selfCheckQuestion: '为什么“定义一个永远抛错的 __set__”仍会改变读取优先级？',
    selfCheckAnswer: '解释器按 descriptor 类型是否提供写入协议分类，而不预执行其业务逻辑。存在 __set__ 表示这个字段希望统一控制写边界，因此读取也必须优先经过 descriptor，避免调用者向实例字典塞入同名值绕过只读或验证合同。'
  },
  '函数 descriptor、绑定方法与 self 注入': {
    official: {
      title: 'Descriptor Guide · Functions and methods',
      url: 'https://docs.python.org/3/howto/descriptor.html#functions-and-methods',
      note: '函数是 non-data descriptor。通过实例读取函数时，function.__get__ 返回绑定了实例的 method；通过类读取时返回原函数。'
    },
    source: {
      repo: 'python/cpython',
      file: 'Objects/funcobject.c',
      symbol: 'func_descr_get',
      language: 'c',
      code: `/* 把函数绑定到对象。生产实现的核心只有这个分支。 */
static PyObject *
func_descr_get(PyObject *func, PyObject *obj, PyObject *type)
{
    // 通过类访问 C.method 时，不绑定任何实例。
    if (obj == Py_None || obj == NULL) {
        return Py_NewRef(func);
    }
    // 通过实例访问 obj.method 时，创建保存 func 与 obj 的 method。
    return PyMethod_New(func, obj);
}`,
      walkthrough: [
        '类访问直接返回原函数的新引用，因此仍由调用者显式传入实例。',
        '实例访问调用 PyMethod_New；method 对象内部保存 __func__ 和 __self__。',
        '该类型只提供 tp_descr_get、没有 tp_descr_set，所以函数属于 non-data descriptor。',
        '绑定语义与调用优化分离；后续 vectorcall 只改变成本，不改变 self 注入合同。'
      ],
      url: 'https://github.com/python/cpython/blob/main/Objects/funcobject.c#L1178-L1190'
    },
    overview: [
      '类体中的 def 创建普通函数对象并把它存入类字典。函数类型实现 __get__，所以 obj.method 会临时产生绑定方法，内部保存 __func__ 与 __self__；调用绑定方法时，__self__ 被自动放到参数列表最前面。',
      'self 并不是语法关键字，也没有在函数定义阶段神秘注入。C.method(obj, arg) 与 obj.method(arg) 的核心调用目标相同，差别只在前者由调用者显式给实例，后者由 descriptor 返回的 MethodType 预绑定。',
      '函数属于 non-data descriptor，因此实例可以用同名属性遮蔽方法。框架若依赖实例方法不可替换，需要显式限制实例字典、使用 data descriptor 或在调用前从类型读取函数。'
    ],
    mechanisms: [
      'C.__dict__["method"] 是 function；C.method 通常仍是 function，因为 __get__(None, C) 返回自身。',
      'obj.method 是 method 对象，obj.method.__self__ is obj，obj.method.__func__ is C.__dict__["method"]。',
      '每次属性读取可以创建新的 method 包装对象，因此 obj.method is obj.method 通常为 False。',
      'method 调用走 vectorcall 等优化路径，但语义上等价于 function(instance, *args, **kwargs)。'
    ],
    pitfalls: [
      '把 obj.method 保存为长期 callback，意外让 method 通过 __self__ 延长实例生命周期。',
      '比较两次 obj.method 的身份判断监听器是否相同，忽略包装对象可重复创建。',
      '给实例写入同名非 callable 值，后续方法调用变成运行时 TypeError。'
    ],
    example: `from types import MethodType

class Greeter:
    def greet(self, name):
        return f"{id(self)}:{name}"

obj = Greeter()
function = Greeter.__dict__["greet"]
bound = obj.greet

assert bound.__self__ is obj
assert bound.__func__ is function
assert bound("Ada") == function(obj, "Ada")
assert isinstance(bound, MethodType)`,
    buildSteps: [
      { title: '拆开 function 与 method', body: '同时打印类字典原函数、类访问结果和实例访问结果，比较类型、__func__、__self__。' },
      { title: '手写 Function.__get__', body: '返回 MethodType(self, obj)，并处理 obj is None；用自定义 descriptor 复现绑定。' },
      { title: '验证生命周期', body: '保存 bound method 后删除原实例名称，用 weakref 证明 __self__ 仍持有实例；再比较 weak method 方案。' }
    ],
    selfCheckQuestion: '为什么 obj.method(arg) 能自动传入 self，而 obj.__dict__ 中通常找不到 method？',
    selfCheckAnswer: 'method 位于类字典，是实现 __get__ 的函数 descriptor。object.__getattribute__ 在实例字典未命中后调用 function.__get__(obj, type(obj))，得到保存 obj 的绑定方法；调用它时绑定对象作为第一个参数传给原函数。'
  },
  'classmethod 与 staticmethod descriptor': {
    official: {
      title: 'Descriptor Guide · Kinds of methods',
      url: 'https://docs.python.org/3/howto/descriptor.html#kinds-of-methods',
      note: 'staticmethod 读取时返回底层 callable 而不绑定参数；classmethod 读取时把实际访问类绑定为第一个参数。'
    },
    source: {
      repo: 'python/cpython',
      file: 'Objects/funcobject.c',
      symbol: 'cm_descr_get / sm_descr_get',
      language: 'c',
      code: `static PyObject *
cm_descr_get(PyObject *self, PyObject *obj, PyObject *type)
{
    classmethod *cm = (classmethod *)self;
    if (type == NULL) {
        type = (PyObject *)Py_TYPE(obj);
    }
    // classmethod 把实际 owner 绑定成第一个参数。
    return PyMethod_New(cm->cm_callable, type);
}

static PyObject *
sm_descr_get(PyObject *self, PyObject *obj, PyObject *type)
{
    staticmethod *sm = (staticmethod *)self;
    // staticmethod 忽略 obj 与 type，原样返回 callable。
    return Py_NewRef(sm->sm_callable);
}`,
      walkthrough: [
        '两个包装器的区别完整集中在 __get__ 对返回 callable 的处理。',
        'classmethod 复用 PyMethod_New，只是 __self__ 从实例换成了实际访问类。',
        'staticmethod 既不绑定实例也不绑定类，类和实例参数在读取时都被忽略。',
        '源码没有“静态方法调用协议”；它们仍然是 descriptor 属性查找。'
      ],
      url: 'https://github.com/python/cpython/blob/main/Objects/funcobject.c#L1353-L1360'
    },
    overview: [
      'staticmethod 和 classmethod 都是放入类字典的包装 descriptor。staticmethod 的 __get__ 忽略 instance 与 owner，直接返回底层函数；classmethod 则把 owner 绑定给函数，所以无论通过类还是实例访问，第一个参数都是实际类。',
      'classmethod 适合替代构造器和多态工厂，因为子类调用 Base.from_config 时绑定的是子类，返回 cls(...) 可以保持派生类型。staticmethod 适合逻辑上归属于类、却完全不需要实例和类状态的纯函数。',
      '两者都不等同于 Java 式静态成员。Python 仍先对类属性执行 descriptor 协议，继承和覆盖也由 MRO 控制。模块级函数往往比为了“组织名字”而滥用 staticmethod 更直接。'
    ],
    mechanisms: [
      '装饰器在类体执行时接收 function，返回 staticmethod/classmethod 包装对象。',
      'classmethod.__get__ 产生以 owner 为 __self__ 的绑定方法。',
      '通过子类访问 inherited classmethod 时 owner 是子类，实现虚拟构造器。',
      '包装对象的 __wrapped__、元数据传播和装饰器组合顺序会影响反射工具。'
    ],
    pitfalls: [
      '替代构造器硬编码 Base(...)，使子类调用仍返回基类，破坏多态。',
      'staticmethod 内偷偷读取全局可变状态，却因名字“static”被误认为纯函数。',
      '任意叠加 property、classmethod 和自定义装饰器，忽略 descriptor 只对类字典最终对象生效。'
    ],
    example: `class Endpoint:
    scheme = "https"

    def __init__(self, host):
        self.host = host

    @classmethod
    def from_url(cls, url):
        scheme, host = url.split("://", 1)
        if scheme != cls.scheme:
            raise ValueError("scheme 不匹配")
        return cls(host)

    @staticmethod
    def normalize_host(host):
        return host.strip().lower()

class InternalEndpoint(Endpoint):
    pass

result = InternalEndpoint.from_url("https://API.LOCAL")
assert type(result) is InternalEndpoint
assert Endpoint.normalize_host(" API.LOCAL ") == "api.local"`,
    buildSteps: [
      { title: '写绑定矩阵', body: '比较普通函数、staticmethod、classmethod 经类访问和实例访问后的 __self__ 与调用参数。' },
      { title: '实现两个纯 Python descriptor', body: 'StaticMethod.__get__ 返回 self.f；ClassMethod.__get__ 返回 MethodType(self.f, owner)。' },
      { title: '用子类检验工厂', body: '子类调用替代构造器，断言返回子类；这比只测试基类更能证明 classmethod 的价值。' }
    ],
    selfCheckQuestion: '为什么 classmethod 替代构造器应调用 cls(...)，而不应写死定义它的基类？',
    selfCheckAnswer: 'descriptor 绑定的 owner 会随访问类变化，子类调用时 cls 就是子类。写 cls(...) 才能把继承带来的多态延伸到对象创建；写死基类会丢失子类字段、验证和返回类型。'
  },
  'C3 线性化手算与冲突检测': {
    official: {
      title: 'Method Resolution Order · C3 algorithm',
      url: 'https://docs.python.org/3/howto/mro.html#the-c3-method-resolution-order',
      note: 'C3 线性化同时保持局部父类顺序与单调性。merge 每轮只能选择不出现在任何其他序列 tail 中的 head；无候选说明继承约束冲突。'
    },
    overview: [
      '多继承要把图变成一条确定的属性查找序列。C3 给出 L[C] = C + merge(L[B1], ..., L[Bn], [B1, ..., Bn])。最后那条直接父类列表用于保留类声明中的局部优先顺序。',
      'merge 每轮查看各序列 head，候选若出现在任何其他序列 tail 中就不能选，因为选择它会让某个本应更早的类被越过。选中合法 head 后，把它从所有序列头删除并继续。',
      '单调性保证：若 A 在父类的 MRO 中先于 B，派生类不能突然让 B 跑到 A 前面。无合法 head 时，Python 在类创建阶段抛 TypeError，拒绝一个无法同时满足约束的继承图。'
    ],
    mechanisms: [
      '单继承自然得到 [Child, Parent, ..., object]，C3 的价值主要体现在 diamond 与多父类约束组合。',
      '局部优先级来自 class C(A, B) 中 A 必须先于 B。',
      '每个父类已有的线性化作为不可破坏的顺序约束参与 merge。',
      '__mro__ 服务所有属性查找，MRO 并不只决定 method。'
    ],
    pitfalls: [
      '用深度优先搜索解释 Python 3 MRO，在复杂 diamond 中得出不单调顺序。',
      'merge 时只看第一个列表的 head，合法候选可能来自后续列表。',
      '为了让冲突类“能创建”而机械交换父类顺序，没有审视继承是否表达了矛盾职责。'
    ],
    example: `def c3_merge(sequences):
    sequences = [list(seq) for seq in sequences if seq]
    result = []
    while sequences:
        candidate = next(
            (seq[0] for seq in sequences
             if all(seq[0] not in other[1:] for other in sequences)),
            None,
        )
        if candidate is None:
            raise TypeError("继承约束冲突：没有合法 head")
        result.append(candidate)
        sequences = [
            ([item for item in seq if item is not candidate])
            for seq in sequences
        ]
        sequences = [seq for seq in sequences if seq]
    return result

def linearize(cls):
    if not cls.__bases__:
        return [cls]
    return [cls, *c3_merge([
        *(linearize(base) for base in cls.__bases__),
        list(cls.__bases__),
    ])]`,
    buildSteps: [
      { title: '从 diamond 手算', body: '列出每个父类 MRO 和直接父类表，每轮圈出合法 head，并与 __mro__ 对照。' },
      { title: '实现 merge', body: '候选必须不在任意 tail 中；选中后只从序列头移除，保留剩余约束。' },
      { title: '制造次序冲突', body: '构造 A(X,Y)、B(Y,X)、C(A,B)，验证无合法候选并解释冲突来自哪两条约束。' },
      { title: '审查继承设计', body: '把冲突图改成组合或显式委托，而非只调整父类顺序，说明职责边界为何更清楚。' }
    ],
    selfCheckQuestion: 'C3 为什么要求候选 head 不能出现在任何其他序列的 tail 中？',
    selfCheckAnswer: '出现在 tail 表示另一条已有约束要求该序列前面的类先于候选。此时提前选择候选会破坏父类已有 MRO 或直接父类顺序。只有不在任何 tail 的 head 才能在不违反全部偏序约束的前提下成为下一项。'
  },
  'super() 与 cooperative inheritance': {
    official: {
      title: 'Built-in functions · super',
      url: 'https://docs.python.org/3/library/functions.html#super',
      note: 'super(type, obj) 从 obj 的 MRO 中 type 之后的位置继续属性查找；零参数 super 由编译器提供当前类和第一个参数。'
    },
    source: {
      repo: 'python/cpython',
      file: 'Objects/typeobject.c',
      symbol: 'super_getattro',
      language: 'c',
      code: `static PyObject *
super_getattro(PyObject *self, PyObject *name)
{
    superobject *su = superobject_CAST(self);

    // super.__class__ 描述代理自身，而不是 su->obj 的实际类型。
    if (PyUnicode_Check(name) &&
        PyUnicode_GET_LENGTH(name) == 9 &&
        _PyUnicode_Equal(name, &_Py_ID(__class__)))
    {
        return PyObject_GenericGetAttr(self, name);
    }

    // 其余名称从 su->type 之后，在 su->obj_type 的 MRO 中继续。
    return do_super_lookup(
        su, su->type, su->obj, su->obj_type, name, NULL);
}`,
      walkthrough: [
        'superobject 同时保存起点 type、绑定 obj 和实际 obj_type，三者缺一不可。',
        '真正的下一站由 do_super_lookup 根据实际 MRO 计算，并非编译期固定父类。',
        '找到属性后仍会执行 descriptor 绑定，所以方法最终继续绑定原实例。',
        '__class__ 单独走普通属性路径，避免代理把绑定对象的类冒充为自身类型。'
      ],
      url: 'https://github.com/python/cpython/blob/main/Objects/typeobject.c#L11754-L11767'
    },
    overview: [
      'super 不是“调用父类”的缩写。它创建一个代理，记住当前起点类和绑定对象，然后沿绑定对象实际类型的 MRO 从起点之后继续搜索。diamond 中同一祖先因此只会在一条 cooperative 链上执行一次。',
      '零参数 super() 依赖编译器创建的 __class__ cell 和函数第一个参数。把包含 super() 的方法随意复制到另一个类、嵌套函数或缺少实例参数的位置，可能破坏隐式上下文。',
      'cooperative inheritance 要求链上的实现使用兼容签名、消费自己负责的参数、把剩余参数继续传给 super，并确保终点能接受它们。任何一层硬编码某个基类，都会绕开 MRO 中其他参与者。'
    ],
    mechanisms: [
      'super(Current, obj).name 在 type(obj).__mro__ 找到 Current，随后从下一项开始。',
      '找到 descriptor 后仍调用其 __get__，并把原实例绑定给返回方法。',
      '类方法中的 super() 绑定类而非实例，同样沿实际 cls 的 MRO 工作。',
      '改变父类列表会改变 cooperative 调用顺序，因此每层应只承担局部职责。'
    ],
    pitfalls: [
      '写 Base.__init__(self) 硬跳到固定父类，让 diamond 的另一条分支被跳过或祖先执行两次。',
      '多继承各层签名不兼容，某层漏传或重复消费关键字参数。',
      '认为 super().method 一定来自直接父类，调试时忽略对象实际类型和完整 MRO。'
    ],
    example: `class Root:
    def render(self, **options):
        assert not options
        return ["root"]

class Audit(Root):
    def render(self, *, audit=False, **options):
        result = super().render(**options)
        return ["audit"] + result if audit else result

class Cache(Root):
    def render(self, *, cache=False, **options):
        result = super().render(**options)
        return ["cache"] + result if cache else result

class Service(Audit, Cache):
    pass

assert Service.__mro__ == (Service, Audit, Cache, Root, object)
assert Service().render(audit=True, cache=True) == ["audit", "cache", "root"]`,
    buildSteps: [
      { title: '先打印完整 MRO', body: '在写 super 调用前列出实际子类 MRO，预测每一层下一站，拒绝只说“父类”。' },
      { title: '统一关键字合同', body: '每层只消费自己的 keyword-only 参数，其余 **options 原样转发，根节点断言没有遗留。' },
      { title: '制造硬编码反例', body: '把一层 super 改成固定 Base.method，记录哪条分支被跳过或重复执行。' }
    ],
    selfCheckQuestion: '在 Service(Audit, Cache) 中，Audit 里的 super().render 为什么会进入 Cache，而非 Audit 的语法父类 Root？',
    selfCheckAnswer: 'super 以 Audit 为 MRO 起点，并使用 self 的实际类型 Service。Service.__mro__ 中 Audit 后一项是 Cache，所以查找进入 Cache；这种动态下一站正是 cooperative diamond 能让每层恰好执行一次的基础。'
  },
  '__set_name__ 与声明式字段收集': {
    official: {
      title: 'Descriptor Guide · Automatic name notification',
      url: 'https://docs.python.org/3/howto/descriptor.html#automatic-name-notification',
      note: 'type 创建类时会扫描类命名空间，对定义 __set_name__ 的属性调用 descriptor.__set_name__(owner, name)。类创建后再赋值需要手动通知。'
    },
    source: {
      repo: 'python/cpython',
      file: 'Objects/typeobject.c',
      symbol: 'type_new_set_names',
      language: 'c',
      code: `static int
type_new_set_names(PyTypeObject *type)
{
    PyObject *dict = lookup_tp_dict(type);
    // 回调可能修改类字典，所以先复制稳定快照再迭代。
    PyObject *names_to_set = PyDict_Copy(dict);
    if (names_to_set == NULL) {
        return -1;
    }

    Py_ssize_t i = 0;
    PyObject *key, *value;
    while (PyDict_Next(names_to_set, &i, &key, &value)) {
        // 特殊方法从 value 的类型解析。
        PyObject *set_name = _PyObject_LookupSpecial(
            value, &_Py_ID(__set_name__));
        if (set_name == NULL) {
            if (PyErr_Occurred()) goto error;
            continue;
        }
        // descriptor.__set_name__(owner, attribute_name)
        PyObject *res = PyObject_CallFunctionObjArgs(
            set_name, type, key, NULL);
        Py_DECREF(set_name);
        if (res == NULL) goto error;
        Py_DECREF(res);
    }
    Py_DECREF(names_to_set);
    return 0;
error:
    Py_DECREF(names_to_set);
    return -1;
}`,
      walkthrough: [
        '复制类字典不是多余开销：__set_name__ 是用户回调，可能重入并修改原字典。',
        '_PyObject_LookupSpecial 从 descriptor 类型解析协议，与其他特殊方法保持一致。',
        '回调参数正是新建 owner 和类字典中的 key，descriptor 构造阶段无需提前知道名称。',
        '任一回调失败会终止类创建并附加说明，避免产生部分初始化的声明式模型。'
      ],
      url: 'https://github.com/python/cpython/blob/main/Objects/typeobject.c#L11368-L11410'
    },
    overview: [
      'descriptor 在类体执行时只是一个对象，构造函数并不知道自己最终被赋给哪个属性。type.__new__ 完成类对象后调用 __set_name__(owner, name)，让字段获得公开名称、私有存储名和所属模型。',
      'ORM、验证框架和序列化器常用这一回调收集声明式字段。可靠实现不能直接修改继承来的共享 registry；子类应复制基类字段表，再加入当前类字段，避免一个子类污染兄弟类。',
      '__set_name__ 只对类创建时命名空间中的对象自动运行。后续执行 Model.new_field = Field() 会经过 type.__setattr__，但不会自动补调 __set_name__；动态框架必须显式调用或集中提供注册 API。'
    ],
    mechanisms: [
      '类体按准备好的 namespace 执行，descriptor 对象先以普通值形式进入 namespace。',
      'metaclass 创建 owner 后遍历 namespace，调用 type(attribute).__set_name__ 对应协议。',
      '同一个 descriptor 实例若复用于多个类或名称，其内部 owner/name 可能被后一次覆盖，应禁止或保存多映射。',
      '字段 registry 的继承策略应在 __init_subclass__ 或 metaclass 中显式定义。'
    ],
    pitfalls: [
      '多个字段共用同一个 descriptor 实例，storage_name 被最后一个名称覆盖。',
      '子类直接 append 到基类共享 _fields，导致兄弟类相互看见不属于自己的字段。',
      '运行时 setattr 添加 Field 后期待自动初始化，直到首次读取才暴露缺失 storage_name。'
    ],
    example: `class Field:
    def __set_name__(self, owner, name):
        self.public_name = name
        self.storage_name = f"_{name}"

    def __get__(self, instance, owner=None):
        if instance is None:
            return self
        return getattr(instance, self.storage_name)

    def __set__(self, instance, value):
        if value is None:
            raise ValueError(f"{self.public_name} 不能为空")
        setattr(instance, self.storage_name, value)

class User:
    name = Field()

user = User()
user.name = "Ada"
assert user._name == "Ada"
assert User.name.public_name == "name"`,
    buildSteps: [
      { title: '先记录名称', body: 'Field.__init__ 不接收字段名，完全依赖 __set_name__ 建立 public/storage 两个名称。' },
      { title: '收集字段表', body: '在 __init_subclass__ 中复制所有基类 registry，再扫描 cls.__dict__ 加入本类 Field。' },
      { title: '支持动态注册', body: '提供 add_field(cls, name, field)，内部先 setattr 再显式 field.__set_name__，并更新 registry。' },
      { title: '验证继承隔离', body: '创建两个兄弟子类分别添加字段，断言基类和另一兄弟的字段表未被污染。' }
    ],
    selfCheckQuestion: '为什么 Python 不在 descriptor.__init__ 时把属性名传进去？',
    selfCheckAnswer: 'descriptor 构造发生在类体求值阶段，它只是右侧表达式的结果，尚不知道最终赋值目标，甚至可能被条件逻辑、别名或 metaclass 处理。类 namespace 完成后，type 才同时掌握 owner 与 name，因此 __set_name__ 是更稳定的通知时机。'
  }
}
