import type { TopicGuide } from '../../topic-guides'

export const typescriptRuntimeGuides: Record<string, TopicGuide> = {
  'ECMAScript 值、规范 Reference 与相等算法': {
    official: {
      title: 'ECMAScript Language Specification · Types, Identity and Equality',
      url: 'https://tc39.es/ecma262/multipage/ecmascript-data-types-and-values.html#sec-ecmascript-language-types',
      note: 'ECMAScript 语言值包含 Undefined、Null、Boolean、String、Symbol、Number、BigInt 和 Object；Reference 是规范为了描述求值过程使用的内部记录，并不是可存进变量的 JavaScript 值。'
    },
    source: {
      repo: 'v8/v8',
      file: 'src/objects/objects.cc · src/objects/objects.h',
      symbol: 'Object::SameValue / Object::SameValueZero',
      language: 'cpp',
      url: 'https://chromium.googlesource.com/v8/v8/+/refs/heads/main/src/objects/objects.cc',
      walkthrough: [
        '入口先处理对象身份或立即数完全相同的最快路径；对象是否相等不会递归比较属性。',
        'Number 分支单独识别 NaN 和正负零，因为 IEEE-754 的普通 == 无法同时表达两套 ECMAScript 需求。',
        'String、BigInt 等无对象身份的值按内容语义比较；普通 Object、Symbol 等有身份值只在同一身份时相等。',
        'SameValueZero 与 SameValue 的唯一 Number 差异是把 +0 和 -0 视为同一个值，因此适合 Map、Set 与 includes 的键语义。'
      ],
      code: `// 依据 V8 Object::SameValue / SameValueZero 压缩的教学实现。
// 省略 Tagged/Smi/HeapNumber 等存储表示，只保留规范分派。
bool SameNumberValue(double left, double right) {
  if (std::isnan(left) && std::isnan(right)) return true; // NaN 与自身同值
  if (left == 0.0 && right == 0.0) {
    return std::signbit(left) == std::signbit(right);      // 区分 +0 / -0
  }
  return left == right;
}

bool SameNumberValueZero(double left, double right) {
  if (std::isnan(left) && std::isnan(right)) return true;
  return left == right;                                   // 合并 +0 / -0
}

bool SameValue(Tagged<Object> left, Tagged<Object> right) {
  if (left == right) return true;                          // 同一身份/立即数
  if (IsNumber(left) && IsNumber(right)) {
    return SameNumberValue(NumberValue(left), NumberValue(right));
  }
  if (IsString(left) && IsString(right)) {
    return StringEquals(left, right);                      // 字符串按 code unit
  }
  return false;                                           // 其余有身份值不同
}`
    },
    overview: [
      '“基本类型按值传递，对象按引用传递”只能当入门助记，继续推导就会误导。ECMAScript 的函数调用一律把一个语言值交给参数 binding。对象本身也是一个值，只是它具有不可描述、不可伪造的 identity，并且属性可变；把同一个对象值绑定给两个名称后，两边观察到同一身份上的修改。语言并没有一种名为 Reference 的对象指针值暴露给程序。',
      '规范里的 Reference 是求值器使用的临时记录，描述“某个 base 上名为 referencedName 的位置”，还携带 strict、thisValue 等信息。表达式 obj.x 先产生 Reference，GetValue 才读取属性值；赋值 obj.x = 1 则把 Reference 交给 PutValue。普通变量保存的是 GetValue 后的语言值，无法把 Reference 存进数组或作为参数传走。',
      'TypeScript 只在编译阶段为这些值建立静态近似，emit 后仍由 JavaScript 算法运行。类型相同不能推出对象相等，readonly 不能冻结对象身份上的状态，结构类型也不会让两个结构相同的对象获得同一 identity。掌握这层边界后，alias、Map key、React/Vue 更新、memoization 和不可变数据的许多问题会落到同一张图上。'
    ],
    chapters: [
      {
        title: '从“盒子”模型换成 binding 与 value',
        kicker: '01 · RUNTIME MODEL',
        paragraphs: [
          '执行 let a = object 时，运行时在当前 Environment Record 中找到 a 的 binding，并把 object 这个语言值写入 binding。随后 let b = a 会先对 a 的 Reference 执行 GetValue，再把得到的同一个对象值写进 b。这里没有复制对象的属性图，也没有把“变量 a 的地址”塞进 b。',
          '重新赋值 b = other 只改变 b 对应的 binding；修改 b.count 则通过对象 identity 找到同一对象并改属性。若 a 与 b 当前持有同一对象值，a.count 会观察到变化。两个行为之所以不同，根源在 binding 更新和对象内部状态更新是两类操作。',
          '字符串、数字等值没有可变 identity。对 string 做看似属性访问时，规范可以临时装箱以完成方法调用，但不会把原始 string 变成可修改对象。new String("x") 则真正创建 wrapper Object，它与原始 string 在 typeof、=== 和 identity 上都不同。'
        ],
        points: [
          '参数传递、返回值、解构与赋值都传递语言值；是否共享可变状态由这个值是否具有 identity 决定。',
          'const 限制 binding 再赋值，不冻结对象；Object.freeze 限制自有属性描述符，也不递归冻结整张对象图。',
          'TypeScript 的 readonly 主要是静态写入限制，经过 alias、类型断言或外部 JavaScript 仍可能修改运行时对象。'
        ],
        code: `const state = { count: 0 }
const alias = state

alias.count += 1
console.assert(state.count === 1) // 两个 binding 持有同一对象值

let current = state
current = { count: 100 }
console.assert(state.count === 1) // 只更新 current binding

const frozen = Object.freeze({ nested: { count: 0 } })
frozen.nested.count += 1          // freeze 是浅层
console.assert(frozen.nested.count === 1)`,
        language: 'typescript',
        takeaway: '不要问“对象是按值还是按引用传递”，先画出 binding 指向哪些语言值，再标出哪些值有 identity、哪些内部状态可变。'
      },
      {
        title: '规范 Reference 是求值过程，不是用户可见指针',
        kicker: '02 · SPECIFICATION TYPE',
        paragraphs: [
          '标识符 x、属性表达式 obj.x 和 super.x 的求值结果在规范算法中都可能是 Reference Record。它至少记录 [[Base]]、[[ReferencedName]]、[[Strict]]，某些形式还携带 [[ThisValue]]。GetValue 根据 base 是 Environment Record 还是对象，选择读取 binding 或执行对象 [[Get]]。',
          '调用表达式也利用 Reference 决定 this。obj.method() 中被调用表达式保留 base=obj，EvaluateCall 能把 obj 作为 thisValue；先执行 const fn = obj.method 会通过 GetValue 丢掉 base，随后 fn() 不再自动绑定 obj。这比“点号左边就是 this”更精确，因为 optional chaining、super 和 with 等路径都要经过 Reference 算法。',
          'JavaScript 不能返回“变量位置”让调用者在之后写回。return x 返回的是 GetValue(x)；若希望模拟引用参数，需要显式传入对象容器、getter/setter 对或回调。代理对象可以拦截属性内部方法，却仍不能把 lexical binding 变成用户可见指针。'
        ],
        code: `const meter = {
  value: 7,
  read() { return this.value }
}

console.assert(meter.read() === 7) // Reference 保留 base=meter

const detached = meter.read        // GetValue 后只剩 Function value
try {
  detached()                       // ESM/strict 下 this 为 undefined
} catch (error) {
  console.assert(error instanceof TypeError)
}

const rebound = detached.bind(meter)
console.assert(rebound() === 7)`,
        language: 'typescript',
        takeaway: 'Reference Record 解释了读取、赋值和调用之间的联系。它属于规范的抽象机器，不应被画成堆里可传递的指针对象。'
      },
      {
        title: '八类语言值与 TypeScript 类型的错位',
        kicker: '03 · LANGUAGE TYPES',
        paragraphs: [
          '规范层的语言类型是 Undefined、Null、Boolean、String、Symbol、Number、BigInt 和 Object。function、array、date、regexp 都属于 Object 的不同内部行为；typeof 的返回字符串又是历史兼容接口，例如 typeof null 为 "object"，它并不直接暴露这八类规范类型。',
          'TypeScript 的类型系统更丰富：union、intersection、literal、tuple、enum、never、unknown 等大多没有同名运行时分类。它们用于描述可能值集合或静态证明状态，emit 后通常消失。反向也存在差距：NaN、-0、property descriptor、realm、proxy internal slot 很难仅凭普通 TS 类型完整表达。',
          'number 表示 IEEE-754 binary64 数值集合，不存在独立 int/float 运行时类型。BigInt 是另一语言类型，Number 与 BigInt 的算术混用通常抛 TypeError。String 按 UTF-16 code unit 序列定义，视觉字符、Unicode code point 和 length 并非总是一一对应。'
        ],
        points: [
          '永远使用 string/number/boolean 描述 primitive，String/Number/Boolean 是 wrapper object 相关类型。',
          'typeof、instanceof、Array.isArray 和自定义 predicate 各观察不同证据，不能互换。',
          '跨 iframe/realm 时 instanceof 依赖构造器 identity，结构检查或 brand API 往往更合适。'
        ],
        code: `const primitive = "lab"
const boxed = new String("lab")

console.assert(typeof primitive === "string")
console.assert(typeof boxed === "object")
console.assert(primitive == boxed)       // coercion 后相等
console.assert(!(primitive === boxed))   // 类型不同，严格不等

console.assert(typeof null === "object") // 历史行为，不是规范类型真相
console.assert(0n === BigInt(0))
// 0n + 1 // TypeError: 不能混用 BigInt 与 Number`,
        language: 'typescript',
        takeaway: '静态类型名、typeof 标签和规范语言类型是三张不同地图。回答问题时先说明当前使用哪一层。'
      },
      {
        title: '===、Object.is 与 SameValueZero 的分工',
        kicker: '04 · EQUALITY',
        paragraphs: [
          '严格相等 === 使用 IsStrictlyEqual。不同语言类型直接 false；Number 中 NaN 与任何值都不相等，+0 与 -0 相等；对象仅比较 identity。它不执行 string/number 等类型强制转换，因此通常是业务判断的默认选择。',
          'Object.is 暴露 SameValue：NaN 与 NaN 为 true，+0 与 -0 为 false。它适合检测状态是否真的保持同一值，React 的依赖比较和一些 descriptor 不变量会关心这些边界。SameValueZero 则同时让 NaN 相等并合并正负零，Array.prototype.includes、Map 和 Set 使用这类键语义。',
          '宽松相等 == 调用 IsLooselyEqual，包含 Boolean、String、Number、BigInt、null/undefined 和对象转 primitive 的多分支转换。成熟代码可以在极窄意图下使用 x == null 同时匹配 null/undefined，但面试回答需要能写出转换路径，不能只说“== 会转换类型”。'
        ],
        code: `const rows = [
  ["NaN", NaN === NaN, Object.is(NaN, NaN), [NaN].includes(NaN)],
  ["+0/-0", +0 === -0, Object.is(+0, -0), new Set([+0, -0]).size === 1],
] as const

console.table(rows)

const first = { id: 1 }
const second = { id: 1 }
console.assert(!(first === second)) // 结构相同不改变 identity
console.assert(first === first)

console.assert(null == undefined)
console.assert(!(null === undefined))`,
        language: 'typescript',
        takeaway: '选择相等算法等于选择边界语义。把 NaN、正负零和对象 identity 写进测试，才能知道自己真正选了什么。'
      },
      {
        title: 'alias、不可变更新与 TypeScript 能力边界',
        kicker: '05 · ENGINEERING',
        paragraphs: [
          'alias 的风险来自多个组件持有同一有 identity 且可变的值。局部 mutation 本身不邪恶，问题在所有权不清：调用者是否还会读取，缓存是否以 identity 判断变化，异步任务是否共享，API 是否承诺不修改输入。所有权合同比“永远深拷贝”更可扩展。',
          '不可变更新创建新 identity，并在未变化子树上保留结构共享。它让 shallow equality 成为便宜的变化证据，适合状态管理和 memoization；代价是分配、短命对象、实现复杂度与误用浅拷贝。展开运算符只复制一层，嵌套对象仍共享 identity。',
          'TypeScript 可用 readonly、Readonly<T>、品牌类型和 API 边界减少误写，却无法监控运行时 JavaScript、反射和深层 alias。真正需要运行时不变量时，要配合冻结、封装、持久化数据结构或 defensive copy，并明确成本。'
        ],
        points: [
          '输入拥有权：borrow、consume、clone、share 四种意图应在命名、类型和文档中至少表达一种。',
          '缓存键：按 identity、稳定主键、内容 hash 或版本号选择，失败模式完全不同。',
          '更新证据：若框架以 Object.is/shallow equality 判断变化，原地 mutation 可能让真实变化不可见。'
        ],
        code: `type User = Readonly<{
  id: string
  profile: Readonly<{ name: string; tags: readonly string[] }>
}>

function rename(user: User, name: string): User {
  return {
    ...user,
    profile: { ...user.profile, name } // 只复制变化路径
  }
}

const before: User = {
  id: "u1",
  profile: { name: "旧名", tags: ["staff"] }
}
const after = rename(before, "新名")

console.assert(before !== after)
console.assert(before.profile !== after.profile)
console.assert(before.profile.tags === after.profile.tags) // 安全结构共享`,
        language: 'typescript',
        takeaway: '是否复制由所有权、变化检测与并发边界决定。readonly 提供静态护栏，运行时正确性仍要靠清晰协议和验证。'
      }
    ],
    mechanisms: [
      'Identifier/Property 求值先产生 Reference Record，GetValue/PutValue 再执行实际读写。',
      '赋值、参数和返回传递语言值；同一对象值写进多个 binding 后形成 alias。',
      '===、SameValue、SameValueZero 对 Number 特例不同，对普通 Object 都比较 identity。',
      'TypeScript 类型在 emit 后大多擦除，运行时仍按 ECMAScript 值和内部方法执行。',
      '不可变更新用新 identity 表示变化，通过结构共享控制复制成本。'
    ],
    pitfalls: [
      '画出“变量盒子里装对象指针”，随后误以为 JavaScript 能传递 lexical binding 的地址。',
      '用 JSON.stringify 比较对象，遗漏 undefined、Symbol、BigInt、循环、原型和 key 顺序语义。',
      '认为 const/readonly/Object.freeze 等价于深不可变，或认为结构类型相同就具有同一 identity。',
      '用 === 搜索 NaN，或没意识到 Map/Set 会把 +0 与 -0 当作同一键。'
    ],
    variants: [
      {
        title: '原地 mutation + 独占所有权',
        useWhen: '对象只在一个模块或事务内拥有，性能敏感，调用边界能证明没有外部 alias。',
        tradeoff: '分配少、代码直接；一旦所有权证明失效，缓存和并发观察者可能读到中间状态。',
        code: `function normalizeOwned(record: { count: number }) {
  record.count = Math.max(0, record.count)
  return record
}`,
        language: 'typescript'
      },
      {
        title: '浅不可变更新 + 结构共享',
        useWhen: 'UI/state store 使用 identity 判断变化，数据树大而每次只更新少量路径。',
        tradeoff: '变化证据清晰；必须逐层复制变化路径，漏一层仍会原地修改共享子对象。',
        code: `const next = {
  ...state,
  user: { ...state.user, name: "Ada" }
}`,
        language: 'typescript'
      },
      {
        title: '运行时深冻结/持久化结构',
        useWhen: '跨插件、租户或不可信边界，需要运行时阻止写入或提供强版本快照。',
        tradeoff: '护栏更强，但递归冻结、proxy 或持久化节点带来 CPU、内存和调试成本。'
      }
    ],
    studyPlan: {
      readingMinutes: 25,
      sourceMinutes: 20,
      practiceMinutes: 35,
      reviewMinutes: 10
    },
    example: `type EqualityRow = {
  label: string
  strict: boolean
  sameValue: boolean
  sameValueZero: boolean
}

const sameValueZero = (left: unknown, right: unknown) =>
  left === right || (left !== left && right !== right)

const cases: Array<[string, unknown, unknown]> = [
  ["NaN", NaN, NaN],
  ["zero", +0, -0],
  ["same object", (() => { const x = {}; return x })(), null],
]

const shared = { value: 1 }
cases[2] = ["same object", shared, shared]
cases.push(["same shape", { value: 1 }, { value: 1 }])

const report: EqualityRow[] = cases.map(([label, left, right]) => ({
  label,
  strict: left === right,
  sameValue: Object.is(left, right),
  sameValueZero: sameValueZero(left, right),
}))

console.table(report)
console.assert(report.find(row => row.label === "NaN")?.sameValueZero)
console.assert(!report.find(row => row.label === "same shape")?.strict)`,
    buildSteps: [
      { title: '积木 1：画 binding/value 图', body: '为赋值、参数、返回和属性修改各画一次图，只允许出现 Environment binding、语言值、对象 identity 与属性边，不画“神秘引用盒子”。' },
      { title: '积木 2：实现三种相等', body: '实现 strictlyEqual、sameValue 和 sameValueZero 的教学版，至少覆盖不同类型、NaN、正负零、String 与 Object identity。' },
      { title: '积木 3：建立 alias 反例', body: '写一个看似 readonly 的嵌套对象，通过另一条 alias 修改它；分别尝试 shallow copy、deep freeze 和结构共享修复。' },
      { title: '积木 4：读取 V8 分派', body: '在 Object::SameValue/SameValueZero 中标出 pointer/identity fast path、Number、String 与 fallback，并说明哪些是引擎表示、哪些是规范语义。' },
      { title: '积木 5：做 API 所有权设计', body: '为一个 normalize 函数分别设计 mutate-owned、copy-on-write 和 defensive-copy 三版，写下调用合同、复杂度与错误用法。' }
    ],
    selfCheckQuestion: '既然对象常被描述为“引用类型”，为什么说 JavaScript 参数仍然按值传递？这两句话怎样同时成立而不矛盾？',
    selfCheckAnswer: '调用时复制到参数 binding 的是一个 ECMAScript 语言值。若该值是 Object，它携带唯一 identity，复制这个值不会复制对象属性图，因此形参和实参随后持有同一对象值，属性 mutation 彼此可见；给形参重新赋另一个对象只改变形参 binding。规范 Reference Record 则是求值器内部描述位置的临时记录，不是被复制进参数的语言值。'
  },
  'Property Key、Descriptor、内部方法与对象形状': {
    official: {
      title: 'ECMAScript Language Specification · Object Internal Methods and Property Descriptors',
      url: 'https://tc39.es/ecma262/multipage/ecmascript-data-types-and-values.html#sec-object-internal-methods-and-internal-slots',
      note: '规范用 Property Key、Property Descriptor 与 [[GetOwnProperty]]、[[DefineOwnProperty]]、[[Get]]、[[Set]] 等内部方法描述对象行为。内部方法是语义接口，不要求引擎按相同的数据结构实现；普通对象、Proxy、数组、TypedArray 与模块命名空间可使用不同算法，但必须守住共同不变量。'
    },
    source: {
      repo: 'v8/v8',
      file: 'src/objects/js-objects.cc',
      symbol: 'JSReceiver::DefineOwnProperty / OrdinaryDefineOwnProperty',
      language: 'cpp',
      url: 'https://github.com/v8/v8/blob/main/src/objects/js-objects.cc',
      walkthrough: [
        'JSReceiver::DefineOwnProperty 先按接收者种类分派：Array、Proxy、TypedArray、ModuleNamespace 等 exotic object 各自进入专用实现，普通对象才走 OrdinaryDefineOwnProperty。',
        '普通路径构造只查 own property 的 LookupIterator，读取当前 descriptor；读取动作可能触发 interceptor 或 accessor 并改变对象 Map，因此真实源码会重启 iterator。',
        '引擎随后读取对象是否 extensible，把目标属性、当前 descriptor、新 descriptor 与 shouldThrow 一起交给 ValidateAndApplyPropertyDescriptor。',
        'ValidateAndApplyPropertyDescriptor 对照规范处理“属性不存在”“不可配置”“data/accessor 互转”“writable 从 true 降为 false”等状态迁移，再选择创建字段、改常量或重配 backing store。',
        'LookupIterator、Map transition 与 properties/elements backing store 是 V8 的实现层；Property Descriptor 与内部方法不变量属于 ECMAScript 语义层，阅读时要把两层分别标色。'
      ],
      code: `// 摘自 V8 src/objects/js-objects.cc 的主分派，删去少量低频分支并补充中文注释。
// 函数签名、分派顺序和 Ordinary 路径来自真实上游实现。
Maybe<bool> JSReceiver::DefineOwnProperty(
    Isolate* isolate,
    DirectHandle<JSReceiver> object,
    DirectHandle<Object> key,
    PropertyDescriptor* desc,
    Maybe<ShouldThrow> should_throw) {
  if (IsJSArray(*object)) {
    // 数组还要维护 length 与整数索引之间的规范约束。
    return JSArray::DefineOwnProperty(
        isolate, Cast<JSArray>(object), key, desc, should_throw);
  }
  if (IsJSProxy(*object)) {
    // Proxy trap 的返回值仍需经过 target invariant 校验。
    return JSProxy::DefineOwnProperty(
        isolate, Cast<JSProxy>(object), key, desc, should_throw);
  }
  if (IsJSTypedArray(*object)) {
    // TypedArray 的 canonical numeric index 有越界、detached buffer 等规则。
    return JSTypedArray::DefineOwnProperty(
        isolate, Cast<JSTypedArray>(object), key, desc, should_throw);
  }
  if (IsJSModuleNamespace(*object)) {
    // 模块命名空间暴露 live binding，descriptor 行为不能按普通对象处理。
    return JSModuleNamespace::DefineOwnProperty(
        isolate, Cast<JSModuleNamespace>(object), key, desc, should_throw);
  }

  // 普通对象进入规范 OrdinaryDefineOwnProperty 路径。
  return OrdinaryDefineOwnProperty(
      isolate, Cast<JSObject>(object), key, desc, should_throw);
}

Maybe<bool> JSReceiver::OrdinaryDefineOwnProperty(
    Isolate* isolate,
    DirectHandle<JSObject> object,
    const PropertyKey& key,
    PropertyDescriptor* desc,
    Maybe<ShouldThrow> should_throw) {
  LookupIterator it(isolate, object, key, LookupIterator::OWN);

  PropertyDescriptor current;
  MAYBE_RETURN(GetOwnPropertyDescriptor(&it, &current), Nothing<bool>());

  // 上一步可能运行 interceptor/accessor 并改变对象形状，所以重新定位。
  it.Restart();
  bool extensible = JSObject::IsExtensible(isolate, object);

  return ValidateAndApplyPropertyDescriptor(
      isolate, &it, extensible, desc, &current, should_throw, {});
}`
    },
    overview: [
      'JavaScript 对象可先理解成“Property Key 到 property record 的映射”，但 property record 不只保存值。数据属性还保存 writable、enumerable、configurable；访问器属性保存 get、set、enumerable、configurable。obj.x = 1、Object.defineProperty、对象字面量、class field 看起来都在“加属性”，它们选择的默认 attributes 和触发的内部方法并不完全相同。',
      '规范中的 [[Get]]、[[Set]]、[[DefineOwnProperty]] 是多态语义接口。普通对象沿原型链读写，数组还要守住 length，TypedArray 要解释整数索引，Proxy 把操作交给 trap 后继续验证不变量。把对象简单等同于 HashMap 会遗漏 getter 的 this、原型 setter、不可配置属性和 exotic object；把 V8 HiddenClass 当作规范概念，又会把某个引擎的优化策略误认成语言保证。',
      'V8 为常见对象建立 Map（工程文章常称 HiddenClass）和 DescriptorArray。相同属性、相同添加顺序的对象通常能共享形状，优化器可据此把“按名字查属性”缩成“检查 Map 后按固定 offset 读值”。频繁增删、稀疏索引或特殊 descriptor 可能切换到 dictionary 表示。这个变化通常不改变 JavaScript 可观察语义，却会改变内存、inline cache 和热路径性能。'
    ],
    chapters: [
      {
        title: 'Property Key 只有 String 与 Symbol',
        kicker: '01 · KEY NORMALIZATION',
        paragraphs: [
          '对象属性键的规范类型只有 String 和 Symbol。obj[1] 中的 1 会经 ToPropertyKey 变成字符串 "1"；obj[true] 变成 "true"；普通对象作为 key 会先 ToPrimitive，再常常得到 "[object Object]"。Symbol 不做字符串化，因此可创建不会与普通字符串冲突的属性键。Map 则直接以语言值为键，数字 1 与字符串 "1" 是两个键，对象键也按 identity 区分。',
          'Property access 的语法形式不会改变最终 key：obj.name 直接给出字符串 "name"，obj[expr] 先计算 expr 再 ToPropertyKey。private field 的 #name 属于 Private Name/PrivateElement 机制，不是 Property Key，Reflect.ownKeys、Proxy ownKeys trap 与普通属性枚举都看不到它。',
          '常见枚举顺序要拆成三组理解：符合 array index 定义的字符串键先按数值升序，其余字符串通常按创建顺序，Symbol 再按创建顺序。Object.keys 还会过滤不可枚举与 Symbol；Reflect.ownKeys 返回 own string 和 Symbol；for...in 还涉及原型链和重复键过滤。依赖“对象就是插入顺序字典”会在整数样式 key 上出错。'
        ],
        points: [
          'Record 风格、键固定的数据适合普通对象；任意值做键、频繁增删或需要 size/迭代协议时优先考虑 Map。',
          'Object.hasOwn(obj, key) 检查 own property；key in obj 同时检查原型链；读取 obj[key] 无法区分“不存在”和“存在且值为 undefined”。',
          'Symbol.for 使用全局 symbol registry，Symbol("x") 每次创建新 identity；两者都不同于字符串 "Symbol(x)"。'
        ],
        code: `const objectKey = { id: 1 }
const record: Record<PropertyKey, unknown> = {}

record[1] = "number becomes string"
record["1"] = "same property"
record[objectKey as unknown as PropertyKey] = "coerced object key"

const token = Symbol("token")
record[token] = 42

console.assert(Reflect.ownKeys(record).includes("1"))
console.assert(Reflect.ownKeys(record).includes("[object Object]"))
console.assert(Reflect.ownKeys(record).includes(token))

const orderProbe = { b: 1, 10: "ten", 2: "two", a: 2 }
console.log(Reflect.ownKeys(orderProbe)) // ["2", "10", "b", "a"]`,
        language: 'typescript',
        takeaway: '看到方括号先问 ToPropertyKey 产生什么；需要保留任意值 identity 时，普通对象和 Map 解决的是两类问题。'
      },
      {
        title: 'Descriptor 是带“字段是否存在”状态的记录',
        kicker: '02 · PROPERTY DESCRIPTOR',
        paragraphs: [
          'Property Descriptor 不是一个只有六个固定字段的普通业务对象。规范记录要区分字段缺席与字段存在且值为 false/undefined。例如 Object.defineProperty(target, "x", { value: 1 }) 中 writable、enumerable、configurable 均缺席，Create/Validate 算法为新属性补成 false；对象字面量 { x: 1 } 创建的数据属性则默认三者为 true。',
          'Data descriptor 使用 [[Value]] 与 [[Writable]]，accessor descriptor 使用 [[Get]] 与 [[Set]]。一个 descriptor 不能同时是 data 与 accessor，{ value: 1, get() {} } 会抛 TypeError。仅含 enumerable/configurable 的 generic descriptor 可更新两类属性的公共 attributes，而不主动改变其 data/accessor 种类。',
          'Object.getOwnPropertyDescriptor 把内部记录 reify 成普通对象；Object.defineProperty 再通过 ToPropertyDescriptor 把输入普通对象转回规范记录。转换会读取 value、writable、get、set 等属性，因此输入若有 getter 或 Proxy，这一步本身就能执行用户代码。工程上不要把不可信 descriptor 输入当作无副作用的 JSON。'
        ],
        code: `const target = {}

Object.defineProperty(target, "hidden", { value: 1 })
const hidden = Object.getOwnPropertyDescriptor(target, "hidden")!
console.assert(hidden.writable === false)
console.assert(hidden.enumerable === false)
console.assert(hidden.configurable === false)

const literal = { visible: 1 }
const visible = Object.getOwnPropertyDescriptor(literal, "visible")!
console.assert(visible.writable && visible.enumerable && visible.configurable)

let backing = 0
Object.defineProperty(target, "score", {
  get() { return backing },
  set(value: number) { backing = Math.max(0, value) },
  enumerable: true,
  configurable: true
})`,
        language: 'typescript',
        takeaway: '写 defineProperty 时要逐个写明 attributes；缺省值不是对象字面量的默认值，字段缺席也不是字段等于 undefined。'
      },
      {
        title: '内部方法把“对象操作”定义成多态协议',
        kicker: '03 · INTERNAL METHODS',
        paragraphs: [
          '表达式 obj[key] 不等价于直接查一张表。规范会执行 ToObject/ToPropertyKey，再调用 obj.[[Get]](key, receiver)。普通 [[Get]] 先取 own descriptor：数据属性返回 [[Value]]；访问器属性调用 getter；own 不存在则沿 [[GetPrototypeOf]] 继续找，同时保留最初的 receiver。',
          '赋值 obj[key] = value 调用 [[Set]]。若原型上找到 writable data property，最终可能在 receiver 上创建 own property；若找到 setter，则以 receiver 为 this 调用；若遇到 non-writable data 或没有 setter 的 accessor，严格模式抛 TypeError，非严格脚本可能静默失败。Object.defineProperty 则直接调用 [[DefineOwnProperty]]，不会走 setter。',
          '这种协议解释了 Proxy 为什么能拦截 get、set、defineProperty、ownKeys 等不同动作，也解释了 trap 之间必须互相一致。Reflect 系列函数接近内部方法的显式入口，返回值与异常策略通常比 Object API 更适合写底层转发代码。后续 Receiver 专题会单独推导 getter、setter、super 与 Proxy 的 this 传播。'
        ],
        points: [
          'obj.x = v、Reflect.set(obj, "x", v) 与 Object.defineProperty(obj, "x", {value:v}) 语义不同，尤其在原型 setter 与不可写属性上。',
          'Object.create(null) 没有 Object.prototype，适合纯字符串字典，但仍要处理 Property Key 强制转换与 descriptor。',
          '内部 slot 不是属性，无法由 obj["[[Map]]"] 读取，也不参与 Proxy property trap。'
        ],
        code: `const events: string[] = []
const proto = {
  set value(next: number) {
    events.push(\`setter:\${next}:this=\${this === child ? "child" : "other"}\`)
  }
}
const child = Object.create(proto)

child.value = 3 // [[Set]] 找到原型 setter，以 child 作为 receiver
Object.defineProperty(child, "value", {
  value: 4,
  writable: true,
  configurable: true
})               // [[DefineOwnProperty]]，不调用 setter

console.assert(events.length === 1)
console.assert(Object.hasOwn(child, "value"))
console.assert(child.value === 4)`,
        language: 'typescript',
        takeaway: '遇到属性问题先写出调用的是 [[Get]]、[[Set]] 还是 [[DefineOwnProperty]]，再分析 own descriptor、prototype 与 receiver。'
      },
      {
        title: 'ValidateAndApply 是 descriptor 的状态机',
        kicker: '04 · INVARIANT',
        paragraphs: [
          'configurable=false 的含义比“不能 delete”更强：属性通常不能切换 data/accessor 种类，enumerable 不能改变，configurable 不能恢复 true。non-configurable data property 若 writable=true，还允许更新 value，并允许单向降成 writable=false；一旦 writable=false，value 只能以 SameValue 保持不变。',
          '对象 non-extensible 时不能创建新 own property，但仍可在规则允许范围内更新已有属性。Object.preventExtensions 只关闭新增；seal 在此基础上把全部 own property 设为 non-configurable；freeze 还把数据属性设为 non-writable。它们都不递归，也不让 getter 停止返回变化值。',
          'Proxy 的 defineProperty/getOwnPropertyDescriptor/ownKeys trap 不能撒破坏不变量的谎。若 target 有 non-configurable property，trap 不能报告它不存在；target 不可扩展时不能凭空报告新 key。规范在 trap 返回后检查 target descriptor，并在不一致时抛 TypeError，这也是“元编程能力”仍需要安全边界的原因。'
        ],
        code: `const state = {}
Object.defineProperty(state, "version", {
  value: 1,
  writable: true,
  enumerable: true,
  configurable: false
})

Object.defineProperty(state, "version", { value: 2 })        // 合法
Object.defineProperty(state, "version", { writable: false }) // 合法的单向收紧

for (const change of [
  () => Object.defineProperty(state, "version", { value: 3 }),
  () => Object.defineProperty(state, "version", { configurable: true }),
  () => Object.defineProperty(state, "version", { get: () => 2 }),
]) {
  try {
    change()
    console.assert(false, "应违反 non-configurable invariant")
  } catch (error) {
    console.assert(error instanceof TypeError)
  }
}`,
        language: 'typescript',
        takeaway: '把 descriptor 变化画成有方向的状态图：许多属性可以从宽松收紧，却不能从已公开的强保证重新放宽。'
      },
      {
        title: 'V8 Map/HiddenClass 把名字查找变成形状检查',
        kicker: '05 · OBJECT SHAPE',
        paragraphs: [
          'ECMAScript 没有 HiddenClass 这个可观察概念。V8 的 Map 保存对象的形状元数据，例如原型、实例大小、property 数量和 DescriptorArray。对象按相同顺序添加相同 named properties 时，通常沿相同 transition tree 到达同一 Map；属性值可以不同，形状仍可共享。',
          '优化后的 property load 常被理解为两步：先检查 receiver 的 Map 是否是预期形状，再从已知 field offset 读取。单一形状是 monomorphic；少量形状可做 polymorphic inline cache；形状过多可能 megamorphic，代码退回更通用的 lookup。确切阈值属于引擎版本细节，课程只依赖“稳定形状给优化器更强证据”这一原则。',
          '构造阶段统一初始化字段能减少形状分叉。即便某字段暂时没有值，也可设为 undefined，让同类实例沿同一添加顺序。反复 delete 属性、根据输入随机添加字段、用同一热函数处理许多互不相关形状，会降低共享与 inline cache 命中；但性能结论仍应通过真实 workload、V8 trace/CPU profile 验证。'
        ],
        code: `type Point = { x: number; y: number; label: string | undefined }

function stablePoint(x: number, y: number, label?: string): Point {
  // 所有实例以相同顺序建立相同字段。
  return { x, y, label }
}

function unstablePoint(flag: boolean) {
  const point: Record<string, unknown> = {}
  if (flag) {
    point.x = 1
    point.y = 2
  } else {
    point.y = 2
    point.x = 1 // 属性集合相同，transition 路径仍可能不同
  }
  return point
}

const points = Array.from({ length: 10_000 }, (_, i) => stablePoint(i, i))
console.assert(points.every(point => point.label === undefined))`,
        language: 'typescript',
        takeaway: '形状是优化器的运行时证明，不是类型声明。TypeScript interface 相同不保证 V8 Map 相同，Map 相同也不要求属性值类型永远相同。'
      },
      {
        title: 'named properties、elements 与 dictionary 是不同存储域',
        kicker: '06 · STORAGE',
        paragraphs: [
          'V8 通常把整数索引属性放进 elements backing store，把其他 named properties 放进 in-object fields 或 properties store。DescriptorArray 记录 named property 的名称、attributes 与位置；elements 则按 PACKED/HOLEY、SMI/double/object 等 element kind 优化连续访问。数组既可同时拥有 elements，也可拥有普通 named property。',
          'in-object property 直接占实例空间，访问链最短；超出预留空间的 fast property 可放入独立 properties store；大量动态增删时可能退化为 self-contained dictionary，key、value 和 attributes 放在字典条目中。dictionary 更适合变化，却通常失去基于共享 DescriptorArray 的快速 offset 访问。',
          '稀疏大索引数组可能使用 dictionary elements；给数组索引定义特殊 non-configurable descriptor 也需要能保存每个元素的 attributes。孔洞 hole 与值 undefined 不同：hole 表示 own property 不存在，某些数组算法会跳过它，读取时还可能继续查原型链。'
        ],
        points: [
          '不要用 delete arr[i] 表示紧凑删除；它留下 hole。需要重排长度时用 splice，需要字典语义时用 Map。',
          'arr["0"] 与 arr[0] 命中同一 Property Key，但 arr["01"] 通常不是 array index。',
          'elements kind 会随写入值与孔洞发生迁移，具体优化会变；算法正确性不得依赖 V8 当前表示。'
        ],
        code: `const values = [10, 20, 30]
delete values[1]

console.assert(values.length === 3)
console.assert(!Object.hasOwn(values, 1))
console.assert(values[1] === undefined)

values.meta = "named property" // TypeScript 默认不允许，运行时对象可以拥有
console.log(Reflect.ownKeys(values))

const sparse: unknown[] = []
sparse[100_000] = "far"
console.assert(sparse.length === 100_001)
console.assert(Object.keys(sparse).length === 1)`,
        language: 'typescript',
        takeaway: '“属性值为 undefined”和“该 key 没有 own property”必须用 Object.hasOwn/descriptor 区分；数组 length 也不能代表实际元素数量。'
      },
      {
        title: '用 descriptor 设计 API，而不是炫技',
        kicker: '07 · ENGINEERING DESIGN',
        paragraphs: [
          'descriptor 最有价值的场景是表达运行时契约：库可把内部版本标记设为 non-enumerable，避免序列化泄漏；可用 accessor 校验写入或维持派生值；可把不应被插件替换的能力设为 non-configurable。每增加一个特殊 attribute，也增加调试和用户认知成本，公共 API 必须在文档与类型中说明。',
          'TypeScript 的 mapped type 能描述 readonly/optional，却不能精确表示 enumerable/configurable，也不能证明对象在运行时已 freeze。若框架依赖 descriptor，应该提供创建函数和运行时断言，例如读取 getOwnPropertyDescriptor 验证，而不是只导出一个看似 readonly 的 interface。',
          '性能设计先从数据模型开始：固定 schema 的实体用 class/工厂统一字段；用户扩展数据放进独立 extras Map，避免污染核心实例形状；高频读取与低频动态 metadata 分开。最后用 benchmark 和 profiler 验证，不能把“不要 delete”“总按同一顺序赋值”变成脱离场景的仪式。'
        ],
        code: `const INTERNAL = Symbol("reviewlab.internal")

type Course = {
  id: string
  title: string
  readonly createdAt: number
  [INTERNAL]?: { revision: number }
}

function createCourse(id: string, title: string): Course {
  const course = { id, title } as Course
  Object.defineProperties(course, {
    createdAt: {
      value: Date.now(),
      writable: false,
      enumerable: true,
      configurable: false
    },
    [INTERNAL]: {
      value: { revision: 0 },
      writable: false,
      enumerable: false,
      configurable: false
    }
  })
  return course
}

const course = createCourse("ts-01", "对象模型")
console.assert(JSON.stringify(course).includes("createdAt"))
console.assert(!JSON.stringify(course).includes("revision"))`,
        language: 'typescript',
        takeaway: '类型负责静态使用体验，descriptor 负责运行时属性合同，shape 负责引擎实现效率。三层可以协作，但没有一层自动替代另一层。'
      }
    ],
    mechanisms: [
      '属性语法先把输入转换为 String/Symbol Property Key，再选择 [[Get]]、[[Set]]、[[DefineOwnProperty]] 等内部方法。',
      '内部方法读取 own descriptor、原型与 receiver；普通对象和 exotic object 可使用不同算法。',
      'ValidateAndApplyPropertyDescriptor 把 extensible、current descriptor 与 requested descriptor 组合成合法或失败的状态迁移。',
      'V8 用 Map/DescriptorArray 表示常见 named property 形状，用 elements store 处理整数索引，并在动态变化时选择 dictionary。',
      '优化器以 Map check 等运行时证据加速固定 offset 访问；TypeScript 静态结构类型不直接决定引擎形状。'
    ],
    pitfalls: [
      '认为 Object.defineProperty 省略 attributes 等同于对象字面量默认值；实际新属性缺省为 false。',
      '把 Property Descriptor 的字段缺席与字段值 undefined 混为一谈，导致 data/accessor 分类或更新语义错误。',
      '把 interface/class 名称当成 HiddenClass，或把 V8 Map 当作跨浏览器规范保证。',
      '只比较 obj[key] === undefined 判断属性不存在，遗漏 own undefined、原型属性与 getter。',
      '看到动态对象慢就盲目改写；没有 profile、shape trace 和真实输入分布，优化结论无法成立。'
    ],
    variants: [
      {
        title: '固定字段工厂或 class',
        useWhen: '领域实体字段集合稳定、实例多、热函数反复读取同一组属性。',
        tradeoff: '字段顺序与形状更可预测；可选扩展字段容易膨胀核心实例，版本演进需保持初始化纪律。',
        code: `class Job {
  status: "queued" | "running" | "done"
  result: unknown

  constructor(
    readonly id: string,
    readonly createdAt: number
  ) {
    this.status = "queued"
    this.result = undefined
  }
}`,
        language: 'typescript'
      },
      {
        title: '核心对象 + extras Map',
        useWhen: '核心读取路径固定，但插件、租户或实验字段高度动态。',
        tradeoff: '核心 shape 稳定，任意值键与增删清楚；访问扩展数据多一次 Map lookup，序列化需显式转换。',
        code: `type Entity = {
  id: string
  extras: Map<PropertyKey, unknown>
}

const entity: Entity = { id: "e1", extras: new Map() }
entity.extras.set(Symbol.for("trace"), { sampled: true })`,
        language: 'typescript'
      },
      {
        title: 'Object.create(null) 字符串字典',
        useWhen: '只接收 String/Symbol key，需要对象反射 API 或 JSON 风格输出，又不需要 Object.prototype。',
        tradeoff: '避免原型键冲突且比普通对象语义更纯；仍会发生 ToPropertyKey，缺少 Map.size 和任意对象 identity 键。',
        code: `const counts: Record<string, number> = Object.create(null)
counts["constructor"] = 1
counts["__proto__"] = 2
console.assert(Object.getPrototypeOf(counts) === null)`,
        language: 'typescript'
      }
    ],
    studyPlan: {
      readingMinutes: 40,
      sourceMinutes: 30,
      practiceMinutes: 50,
      reviewMinutes: 15
    },
    exampleLanguage: 'typescript',
    example: `type DescriptorKind = "data" | "accessor" | "generic"

function descriptorKind(descriptor: PropertyDescriptor): DescriptorKind {
  const data = "value" in descriptor || "writable" in descriptor
  const accessor = "get" in descriptor || "set" in descriptor
  if (data && accessor) throw new TypeError("descriptor 不能同时是 data 与 accessor")
  if (data) return "data"
  if (accessor) return "accessor"
  return "generic"
}

function defineChecked(
  target: object,
  key: PropertyKey,
  descriptor: PropertyDescriptor
): void {
  descriptorKind(descriptor)
  const current = Object.getOwnPropertyDescriptor(target, key)

  if (current && !current.configurable) {
    if (descriptor.configurable === true) {
      throw new TypeError("不可配置属性不能恢复 configurable")
    }
    if ("enumerable" in descriptor &&
        descriptor.enumerable !== current.enumerable) {
      throw new TypeError("不可配置属性不能改变 enumerable")
    }
  }

  Object.defineProperty(target, key, descriptor)
}

const model = {}
defineChecked(model, "id", {
  value: "m1",
  writable: false,
  enumerable: true,
  configurable: false
})

console.assert(Object.keys(model).includes("id"))
console.assert(Reflect.set(model, "id", "m2") === false)
console.assert(Object.getOwnPropertyDescriptor(model, "id")?.value === "m1")`,
    buildSteps: [
      { title: '积木 1：实现 ToPropertyKey 探针', body: '收集 number、boolean、object、Symbol、整数样式字符串与普通字符串作为 key，输出 Reflect.ownKeys，并解释每个最终键和值覆盖行为。' },
      { title: '积木 2：实现 descriptor 分类器', body: '区分字段缺席，完成 data/accessor/generic 分类；对同时包含 value 与 get 的输入抛出 TypeError，并写出表格测试。' },
      { title: '积木 3：复现不可配置状态机', body: '先只实现 configurable/enumerable/data-accessor 互转和 writable 单向收紧，再补 SameValue 对 NaN 与正负零的边界。' },
      { title: '积木 4：写 OrdinaryGet 教学版', body: '用 getOwnPropertyDescriptor 与 getPrototypeOf 递归实现数据属性、getter 和原型查找；显式携带 receiver，暂不处理 Proxy 与 private field。' },
      { title: '积木 5：对照 V8 分派源码', body: '把 JSReceiver::DefineOwnProperty 的 Array、Proxy、TypedArray、ModuleNamespace 与 Ordinary 五条路径标在调用图上，写明每个分支多维护的一项不变量。' },
      { title: '积木 6：观察形状与字典退化', body: '构造同顺序、异顺序、频繁 delete 和稀疏索引四组对象，在 Node/V8 调试环境使用 %DebugPrint 或 trace 工具观察 Map/properties/elements；基准必须预热并记录运行时版本。' }
    ],
    selfCheckQuestion: '为什么 Object.defineProperty(obj, "x", { value: 1 }) 得到的属性与 obj.x = 1 不同？如果 x 已在原型上定义了 setter，两种写法又会发生什么？',
    selfCheckAnswer: 'defineProperty 直接请求 obj.[[DefineOwnProperty]] 创建 own data property。对新属性，descriptor 中缺席的 writable、enumerable、configurable 被补为 false；它不会沿原型链调用 setter。赋值表达式调用 [[Set]]：普通路径会检查 own/prototype descriptor，若原型上是 setter，就以最初的 receiver（obj）作为 this 调用 setter，通常不会自动创建 own x；若最终创建普通 own data property，其 writable、enumerable、configurable 通常为 true。两者必须分别测试 own descriptor 与 setter 副作用。'
  }
}
