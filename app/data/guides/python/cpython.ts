import type { TopicGuide } from '../../topic-guides'

export const pythonCpythonGuides: Record<string, TopicGuide> = {
  '仓库地图、pydebug 构建与测试定位': {
    official: {
      title: 'Python Developer’s Guide · Setup and building',
      url: 'https://devguide.python.org/getting-started/setup-building/',
      note: '开发者指南要求源码开发优先使用 pydebug 构建；它会打开额外断言和一致性检查，性能测量则应换回 release 构建。'
    },
    source: {
      repo: 'python/cpython',
      file: 'README.rst · Makefile.pre.in · PCbuild/build.bat',
      symbol: 'CPython development build',
      language: 'bash',
      url: 'https://github.com/python/cpython',
      walkthrough: [
        'Grammar 描述语言语法，Parser 把源码转成 AST，Python 放编译器和解释器核心，Objects 实现内建对象，Include 暴露公开或内部 C 头文件。',
        'pydebug 构建打开 Py_DEBUG 及大量 assert，能更早暴露引用所有权、对象状态和解释器不变量错误；它的时序不能代表发布版性能。',
        '修改 C 文件后必须重新编译；修改 Lib 下纯 Python 文件通常可由工作树中的解释器直接加载。测试先跑最窄用例，再扩大到相关测试文件和完整 test suite。'
      ],
      code: `# Unix / WSL：源码树内构建，不需要安装到系统
git clone https://github.com/python/cpython.git
cd cpython
./configure --with-pydebug
make -j4
./python -m test test_compile -v

# Windows：先由脚本拉取依赖并建立 Debug x64
PCbuild\\build.bat -c Debug -p x64
PCbuild\\amd64\\python_d.exe -m test test_compile -v`
    },
    overview: [
      '阅读大型源码的第一步是建立“问题到目录”的映射。语法接受不接受，先看 Grammar/python.gram 与 Parser；名称为什么被判成 free variable，看 Python/symtable.c；某个语句发出什么指令，看 Python/codegen.c；指令怎样执行，看 Python/bytecodes.c 及生成的 cases；list、dict、function 等对象行为则从 Objects 进入。',
      '源码树中的不少 C 文件是生成产物或依赖生成产物。直接改 generated_cases.c.h 往往会在下一次 regeneration 时丢失，正确入口可能是 Python/bytecodes.c 和 Tools/cases_generator。学习时要区分“设计源文件、生成器、生成结果”，这也是大型编译器项目常见的维护边界。',
      '源码阅读必须有可观察闭环：找到入口，写最小 Python 样例，使用 ast/dis/symtable 观察中间结果，在 Debug 构建下设置断点，修改一处行为，跑最窄测试。只在网页上浏览函数名很容易形成虚假的理解感。'
    ],
    mechanisms: [
      'Programs/python.c 提供可执行程序入口，初始化和命令行主流程继续进入 Modules/main.c 与 Python/pylifecycle.c。',
      'Include/cpython 与 Include/internal 的兼容承诺不同；后者是解释器内部接口，不应被普通扩展依赖。',
      'Lib/test 既是回归保护，也是最精确的行为合同；搜索错误消息和公开 API 名称常比从根目录顺读更快。',
      'Tools/scripts、Argument Clinic、PEG generator、cases generator 会生成重复而易错的样板代码。',
      'Debug、ASAN、UBSAN、refleak、GDB/lldb 分别回答不同问题，不应拿单一工具替代完整证据链。'
    ],
    pitfalls: [
      '在系统 python 上运行测试，误以为验证了刚编译的解释器。',
      '直接修改自动生成文件，却没有找到生成源和 regeneration 命令。',
      '一次运行整个测试套件后才定位问题，反馈周期过长且日志噪声巨大。'
    ],
    example: `from pathlib import Path

ROOT = Path("cpython")
routes = {
    "语法": ROOT / "Grammar/python.gram",
    "词法": ROOT / "Parser/lexer/lexer.c",
    "名称分类": ROOT / "Python/symtable.c",
    "代码生成": ROOT / "Python/codegen.c",
    "指令定义": ROOT / "Python/bytecodes.c",
    "对象实现": ROOT / "Objects",
    "行为测试": ROOT / "Lib/test",
}

for question, path in routes.items():
    print(f"{question:8} -> {path}")`,
    buildSteps: [
      { title: '固定研究版本', body: '记录 commit SHA 与分支。课程链接指向 main 便于阅读，实验报告必须注明实际版本，因为解释器内部布局会快速变化。' },
      { title: '建立 Debug 闭环', body: '编译 pydebug，确认执行的是源码树里的 ./python 或 python_d.exe，并跑一个最窄测试。' },
      { title: '从行为反查入口', body: '先写十行以内的复现，再用 rg 搜错误文本、测试名、opcode 或 C API 符号；沿调用者向内收缩。' },
      { title: '记录生成边界', body: '为每个修改点写下设计源、生成命令、生成产物与对应测试，避免在派生文件上累积补丁。' }
    ],
    selfCheckQuestion: '为什么 CPython 开发推荐 pydebug，而性能基准又不能使用它？',
    selfCheckAnswer: 'pydebug 用额外断言、引用和对象一致性检查换取更早、更明确的失败，适合证明修改没有破坏内部不变量；这些检查本身增加开销并改变代码布局与时序，所以它不能代表用户运行的 release 构建。正确流程是 Debug 找错、Release 测性能，并确保两者运行相同语义测试。'
  },

  'tokenizer：编码、缩进与 token 流': {
    official: {
      title: 'Python Language Reference · Lexical analysis',
      url: 'https://docs.python.org/3/reference/lexical_analysis.html',
      note: '词法规则定义编码、物理行与逻辑行、缩进、标识符、字面量和操作符；实现细节位于 Parser/tokenizer 与 Parser/lexer。'
    },
    source: {
      repo: 'python/cpython',
      file: 'Parser/tokenizer/file_tokenizer.c · Parser/lexer/lexer.c',
      symbol: '_PyTokenizer_Get',
      language: 'c',
      url: 'https://github.com/python/cpython/blob/main/Parser/lexer/lexer.c',
      walkthrough: [
        '文件读取层先处理 BOM、coding cookie、通用换行和 UTF-8 验证，再把字节缓冲交给 lexer；源码位置仍要维护行号和 UTF-8 字节偏移。',
        'lexer 用 tok_state 保存 cur/inp/end、括号层级、缩进栈和 f-string 模式栈。INDENT/DEDENT 是比较当前行首列数和栈顶后合成的 token，源码里没有对应字符。',
        '括号内部换行、反斜杠续行和交互式输入会改变 NEWLINE/ENDMARKER 的产生；词法器因此是带上下文状态机，无法简化成一次正则扫描。'
      ],
      code: `/* 教学化摘录：真实实现还处理 tab/空格歧义和错误位置 */
if (at_beginning_of_line && tok->level == 0) {
    int col = measure_indentation(tok);     // 计算展开 tab 后的逻辑列
    int top = tok->indstack[tok->indent];

    if (col > top) {
        tok->indstack[++tok->indent] = col; // 推入新层级
        return INDENT;                      // 源码中没有这个字符
    }
    while (col < tok->indstack[tok->indent]) {
        tok->pendin--;                      // 可能要连续产生多个 DEDENT
        tok->indent--;
    }
}
return lex_regular_token(tok);`
    },
    overview: [
      'tokenizer 的职责不是理解“这是一条 if 语句”，而是把字符流切成带类型与位置的 token 流，例如 NAME、NUMBER、COLON、NEWLINE、INDENT。parser 之后只和 token 打交道，于是编码错误、tab 混用、字符串未闭合等问题可以在更靠前的阶段给出精确诊断。',
      'Python 的缩进具有语法意义，却不存在花括号字符。词法器维护一个严格递增的缩进列栈。新逻辑行的列数大于栈顶时发出 INDENT；小于栈顶时持续弹栈并发出一个或多个 DEDENT；若列数不等于任何历史层级则报错。括号内的视觉缩进不参与这套栈，因为括号开启了隐式续行。',
      '编码也是词法语义的一部分。文件层在最初两行探测 BOM 和 coding cookie，规范化换行并验证 UTF-8。位置字段通常以 UTF-8 字节偏移表达，这解释了含中文源码时 col_offset 与用户眼中的字符列数可能不同。'
    ],
    mechanisms: [
      '物理行来自输入设备，逻辑行可由括号、反斜杠或多行字符串跨越多个物理行。',
      'paren level 大于零时，普通换行通常不产生终结语句的 NEWLINE。',
      'pending INDENT/DEDENT 允许一次扫描状态变化在后续调用中逐个返回 token。',
      'soft keyword 先保持 NAME，交给 parser 在特定语法位置解释，避免全局保留字破坏兼容性。',
      'f-string 需要独立模式栈，因为文本区、表达式区、格式说明区具有不同的转义和括号规则。'
    ],
    pitfalls: [
      '用 split 或一个大正则实现 Python tokenizer，遗漏字符串、注释、续行和 f-string 状态。',
      '把可见空格数量当作缩进列，忽略 tab 展开和 TabError。',
      '把 AST 的字符位置直接当作 Python 字符串索引，遇到非 ASCII 源码切片错误。'
    ],
    example: `import io
import tokenize

source = """if ready:
    value = (
        1 + 2
    )
print(value)
"""

for token in tokenize.generate_tokens(io.StringIO(source).readline):
    if token.type not in {tokenize.ENCODING, tokenize.NL}:
        print(tokenize.tok_name[token.type], repr(token.string),
              token.start, token.end)

# 观察：括号内换行是 NL；语句结束是 NEWLINE；
# 缩进块开始/结束由 INDENT、DEDENT 表示。`,
    buildSteps: [
      { title: '先做可视化扫描器', body: '使用标准库 tokenize 打印 type/string/start/end/line，建立输入到 token 的金标准。' },
      { title: '复现缩进栈', body: '只支持 NAME、冒号、换行和空格，先让嵌套块正确产生 INDENT/DEDENT，再加入空行与注释。' },
      { title: '加入逻辑行', body: '维护括号层级，使括号内换行不终止语句；再处理反斜杠和 EOF 隐式换行。' },
      { title: '差分测试', body: '把自制 token 类型序列与 tokenize 对比，覆盖中文标识符、tab 混用、空文件、未闭合字符串和嵌套 f-string。' }
    ],
    selfCheckQuestion: '为什么 INDENT/DEDENT 更适合由 tokenizer 产生，而不是让 parser 直接数空格？',
    selfCheckAnswer: '缩进依赖物理行、tab 展开、括号层级、空行、注释和续行，这些都是词法器已经维护的字符级状态。将其压缩为 INDENT/DEDENT 后，语法规则可以像处理花括号一样处理 block，不必在每条 compound statement 里重复字符扫描逻辑，同时错误位置也更集中。'
  },

  'PEG parser：回溯、memo、cut 与错误规则': {
    official: {
      title: 'InternalDocs · Parser',
      url: 'https://github.com/python/cpython/blob/main/InternalDocs/parser.md',
      note: 'CPython 使用 PEG parser generator；Grammar/python.gram 同时包含语法规则和构造 AST 的 C action。'
    },
    source: {
      repo: 'python/cpython',
      file: 'Grammar/python.gram · Parser/pegen.c',
      symbol: '_PyPegen_is_memoized',
      language: 'c',
      url: 'https://github.com/python/cpython/blob/main/Parser/pegen.c',
      walkthrough: [
        'PEG 的 choice 按书写顺序尝试，第一个成功分支获胜。失败分支把 mark 回退，因此规则顺序本身就是语言行为。',
        'memo 以“token 起点 + rule 类型”为键，缓存成功节点、失败结果和结束 mark；相同子问题不必因回溯重复解析，这就是 packrat 思路。',
        'cut 在已经识别出决定性前缀后禁止回退到同级备选，既减少搜索又改善错误；invalid_* 规则只在普通解析失败后的第二遍启用，用于生成更具体的 SyntaxError。'
      ],
      code: `int
_PyPegen_is_memoized(Parser *p, int rule, void *result)
{
    if (p->mark == p->fill) {
        if (_PyPegen_fill_token(p) < 0) {
            p->error_indicator = 1;         // tokenizer 失败向上传播
            return -1;
        }
    }
    Token *start = p->tokens[p->mark];
    for (Memo *m = start->memo; m != NULL; m = m->next) {
        if (m->type == rule) {
            p->mark = m->mark;              // 恢复缓存的结束位置
            *(void **)result = m->node;      // NULL 也能表示“已知失败”
            return 1;
        }
    }
    return 0;                                // 调用生成规则并写入 memo
}`
    },
    overview: [
      'PEG 把语法看作对 token 序列的识别表达式。与传统 CFG parser 的“多个产生式都可能成立”不同，有序选择 A | B 在 A 成功后不会再考虑 B。因此把更宽泛的规则放在前面，可能悄悄吞掉后面更精确的分支。阅读 python.gram 时，顺序、lookahead 和 cut 都必须当作控制流。',
      '允许回溯会带来重复工作：同一个 token 位置的同一规则可能被许多上层分支反复调用。Pegen 把结果和消费到的位置挂在起始 token 的 memo 链上，命中后同时恢复 node 与 mark。左递归则需要种子结果逐步增长，直到无法消费更多 token，不能用普通递归直接展开。',
      '错误质量与接受正确程序同等重要。普通规则优先保证语法定义清晰；若第一次失败，解析器可开启 invalid_* 规则再跑一遍，以识别“参数默认值顺序错误”等常见非法形态。cut 表示已经越过承诺点，后续失败应在当前结构内报告，避免回退后得到毫无关系的错误。'
    ],
    mechanisms: [
      '&e 和 !e 分别做正/负 lookahead，只检查而不消费 token。',
      '~ cut 提交当前 alternative；它会影响接受路径和错误位置，应谨慎放置。',
      '&&e eager parse 在失败时立即抛 SyntaxError，适合语法必须出现的部分。',
      'grammar action 用捕获值和 EXTRA 宏构造带范围的 AST 节点。',
      'soft keyword 用双引号表示，只在该语法上下文匹配；普通 keyword 用单引号。'
    ],
    pitfalls: [
      '把 PEG 的 | 当作无序集合，忽略前一分支对后一分支的遮蔽。',
      '给所有规则无脑 memo，忽略缓存本身的内存和维护成本。',
      '修改生成的 parser C 文件而非 Grammar/python.gram，重新生成后改动消失。'
    ],
    example: `# 教学版有序选择解析器：assignment 必须放在 name 前
def parse_name(tokens, i):
    return (("name", tokens[i]), i + 1) if i < len(tokens) else None

def parse_assignment(tokens, i):
    if i + 2 < len(tokens) and tokens[i + 1] == "=":
        return (("assign", tokens[i], tokens[i + 2]), i + 3)
    return None

def ordered_choice(*rules):
    def parse(tokens, i):
        for rule in rules:
            if result := rule(tokens, i):
                return result
        return None
    return parse

statement = ordered_choice(parse_assignment, parse_name)
assert statement(["x", "=", "1"], 0)[0] == ("assign", "x", "1")`,
    buildSteps: [
      { title: '实现 mark 回退', body: '每条 rule 接收 token index，失败返回 None 且不改变调用者位置；ordered choice 依次从同一 mark 尝试。' },
      { title: '加入 memo', body: '用 (rule_id, mark) 缓存 (node, end_mark)，同时缓存失败，统计规则真实执行次数。' },
      { title: '加入 cut', body: '让结果携带 committed 状态；cut 之后的失败直接向上传播，并为错误记录最远位置和期望 token。' },
      { title: '对照 grammar', body: '挑选 assignment 或 pattern matching 的一条真实规则，标出捕获、lookahead、cut、action 与 invalid 分支。' }
    ],
    selfCheckQuestion: 'memoization 为什么不仅缓存 AST 节点，还必须缓存结束 mark，甚至缓存失败？',
    selfCheckAnswer: 'parser 的结果同时包含“得到什么”和“消费到哪里”。只复用节点却不恢复结束位置会让上层从错误 token 继续；不缓存失败则每次回溯仍会重复证明同一规则在同一起点不能成立，最坏复杂度没有被消除。'
  },

  'ASDL、AST 节点与源码位置': {
    official: {
      title: 'Python Library Reference · ast',
      url: 'https://docs.python.org/3/library/ast.html',
      note: '抽象语法树公开了编译器语法结构；具体节点由 Parser/Python.asdl 描述并生成 C/Python 表示。'
    },
    source: {
      repo: 'python/cpython',
      file: 'Parser/Python.asdl · Python/Python-ast.c',
      symbol: '_PyAST_*',
      language: 'c',
      url: 'https://github.com/python/cpython/blob/main/Parser/Python.asdl',
      walkthrough: [
        'ASDL 用 sum type 描述 stmt、expr 等联合类型，用 product 字段描述每种节点携带的孩子和属性；星号字段代表序列，问号代表可选。',
        '生成器把 schema 转为 C enum/union、构造函数、visitor 支持和 Python ast 类，减少手写节点布局与遍历样板。',
        'AST 对象通常由 arena 批量管理；源码位置从 grammar action 传入，lineno 为 1 基，col_offset/end_col_offset 是 UTF-8 字节偏移。'
      ],
      code: `-- Parser/Python.asdl 的教学摘录
expr =
    | BoolOp(boolop op, expr* values)
    | BinOp(expr left, operator op, expr right)
    | Name(identifier id, expr_context ctx)
    attributes (int lineno, int col_offset,
                int? end_lineno, int? end_col_offset)

/* 生成后的节点共享 expr_ty 指针，kind 决定 union 哪一支有效 */
node->kind = BinOp_kind;
node->v.BinOp.left = left;
node->v.BinOp.op = op;
node->v.BinOp.right = right;`
    },
    overview: [
      'parse tree 会保留大量标点和语法推导细节，后续编译并不需要知道某对括号来自哪条产生式。AST 把这些表面差异折叠成语义节点。例如 a + (b) 和 a + b 都可成为 BinOp(Name, Add, Name)，让符号分析与代码生成围绕稳定结构工作。',
      'ASDL 是 AST 的“数据模型源码”。它像一份代数数据类型声明：expr 可以是 BinOp、Call、Name 等分支，每一支拥有固定字段。生成 C 布局的好处在于 schema、构造器、Python 暴露类型和遍历信息保持一致；代价是修改后必须重新生成并更新所有 pattern matching/visitor。',
      '位置并非装饰信息。SyntaxError、traceback、coverage、debugger、source segment、格式化和 IDE 都依赖它。Python 将列偏移定义为 UTF-8 字节偏移，使 parser C 层可以直接关联编码后的源码缓冲；在 Python 字符串上切片前需要转换。'
    ],
    mechanisms: [
      'stmt*、expr* 在 C 层通常映射为 asdl_seq，并由 arena 持有。',
      'ctx 区分 Name/Attribute/Subscript 被 Load、Store 或 Del，后续决定读写 opcode。',
      'ast.Load 等 singleton operator 节点复用对象，修改它可能影响同一树的其他位置。',
      'ast.fix_missing_locations 只能从父节点补近似位置，无法恢复真实 token 边界。',
      'compile(ast_obj, ...) 会先验证字段和上下文，不是任意拼装节点都能进入 codegen。'
    ],
    pitfalls: [
      '用 ast.dump 看见结构后便忽略 Load/Store、keyword、type_ignores 和位置属性。',
      'NodeTransformer 返回新节点却不复制位置，导致报错、coverage 或 unparse 行为异常。',
      '把具体 AST 布局当成跨版本稳定序列化协议。'
    ],
    example: `import ast

source = "价格 = 数量 * 2"
tree = ast.parse(source)
assign = tree.body[0]
name = assign.targets[0]

print(ast.dump(tree, indent=2, include_attributes=True))
print(name.col_offset, name.end_col_offset)  # UTF-8 字节偏移
print(ast.get_source_segment(source, name)) # 正确处理位置

# 修改 AST 时保留位置，再让 compile 做结构验证。
replacement = ast.Constant(value=99)
ast.copy_location(replacement, assign.value)
assign.value = replacement
code = compile(ast.fix_missing_locations(tree), "<lesson>", "exec")`,
    buildSteps: [
      { title: '画出 sum/product', body: '选 Name、BinOp、Call 三种 expr，手写 tagged union，并说明 kind 与 union 字段必须同步。' },
      { title: '实现小型 arena', body: '把本轮 parse 的节点集中登记，成功或失败后统一释放；理解为何 AST 构造路径偏好区域生命周期。' },
      { title: '做 round-trip', body: 'parse → dump → transform → fix location → compile → exec，验证语义和位置信息。' },
      { title: '制造验证失败', body: '将赋值目标 ctx 改成 Load 或遗漏必填字段，记录 compile 的失败层与错误信息。' }
    ],
    selfCheckQuestion: '为什么 CPython 不直接让编译器在完整 parse tree 上生成字节码？',
    selfCheckAnswer: 'parse tree 含有为识别语法服务的标点和中间产生式，结构随 grammar 重写剧烈变化。AST 把多种表面写法归一成较稳定的语义节点，减少符号分析与 codegen 的分支，同时为工具提供可用接口。代价是必须精确保存上下文和源码位置，并维护 parse action 到 AST 的转换。'
  },

  'symbol table：local、global、free 与 cell': {
    official: {
      title: 'Execution model · Resolution of names',
      url: 'https://docs.python.org/3/reference/executionmodel.html#resolution-of-names',
      note: '语言参考定义名称绑定、global、nonlocal、class block 和 annotation scope；symtable 模块可观察编译器的名称分类结果。'
    },
    source: {
      repo: 'python/cpython',
      file: 'Python/symtable.c',
      symbol: 'analyze_name',
      language: 'c',
      url: 'https://github.com/python/cpython/blob/main/Python/symtable.c',
      walkthrough: [
        '第一遍 AST visitor 为每个 block 收集 DEF_LOCAL、USE、DEF_PARAM、DEF_GLOBAL、DEF_NONLOCAL 等 raw facts，并创建嵌套 block。',
        '第二遍把父级 bound/global/free 集合向下传播。某个子级把外层 local 当作 free 时，外层相应名称升级为 cell，以便 frame 共享同一个闭包槽。',
        '分类结果进入 ste_symbols，codegen 随后选择 LOAD_FAST、LOAD_GLOBAL、LOAD_DEREF、LOAD_NAME 等不同指令；它不是运行时临时搜索出来的。'
      ],
      code: `/* 教学化压缩：真实 analyze_name 还处理 type params/class 特例 */
if (flags & DEF_GLOBAL) {
    SET_SCOPE(scopes, name, GLOBAL_EXPLICIT);
    PySet_Add(global, name);                 // 子作用域也看到显式 global
    PySet_Discard(bound, name);
    return 1;
}
if (flags & DEF_NONLOCAL) {
    if (!PySet_Contains(bound, name))         // 外层函数没有可绑定名称
        return syntax_error("no binding for nonlocal");
    SET_SCOPE(scopes, name, FREE);
    PySet_Add(free, name);
    return 1;
}
if (flags & DEF_BOUND) {
    SET_SCOPE(scopes, name, LOCAL);
    PySet_Add(local, name);
    return 1;
}
if (PySet_Contains(bound, name)) {
    SET_SCOPE(scopes, name, FREE);            // 向外层报告闭包需求
    PySet_Add(free, name);
}`
    },
    overview: [
      'Python 函数内只要存在一次名称绑定，该名称通常就被整个 block 视为 local。这个决定在编译期完成，因此读取发生在赋值前会得到 UnboundLocalError，而不会动态回退到同名 global。symbol table 的核心任务是把“源码里出现了哪些定义和使用”转换成每个 block 的确定作用域。',
      '一次遍历不够。访问外层函数时还不知道深层子函数是否会捕获某个 local；访问子函数时又需要知道父层有哪些 bound 名称。因此实现先收集事实与 block 树，再自顶向下传播环境、自底向上汇报 free variables。父 block 的 local 被子 block 捕获后成为 cell，运行时 frame 才会为它创建可共享槽。',
      'class block 是重要反例：类体执行产生 namespace，但方法里的裸名称通常不会闭包捕获普通类属性；方法通过 global 或显式 __class__ cell 处理。comprehension、annotation scope、type parameter 等也会创建或调整隐式 block。资深回答应从具体版本的 symtable 结果验证，避免把 LEGB 口诀当作完整实现。'
    ],
    mechanisms: [
      'DEF_PARAM 与其他 local binding 冲突规则在收集阶段即可报 SyntaxError。',
      'global/nonlocal 必须先于同 block 对该名称的使用或绑定声明。',
      'FREE_CLASS 让方法访问的 free variable 与类 namespace 同名绑定正确共存。',
      '__class__ cell 由使用 zero-argument super 或 __class__ 的方法触发并由 class 构造阶段填充。',
      'CO_OPTIMIZED/CO_NEWLOCALS 与符号分类共同决定 frame 的 locals 表示和访问指令。'
    ],
    pitfalls: [
      '把 LEGB 理解为每次读取都从 local 查不到后继续查 global；已分类为 local 的读取不会这样回退。',
      '只分析函数嵌套，遗漏 class、comprehension、annotation 和 exec/import * 的特殊约束。',
      '用 locals() 修改字典期待稳定改变 optimized fast locals。'
    ],
    example: `import symtable

source = """
rate = 2
def outer(base):
    total = base
    def inner(value):
        nonlocal total
        total += value
        return total * rate
    return inner
"""

root = symtable.symtable(source, "<lesson>", "exec")
outer = root.lookup("outer").get_namespace()
inner = outer.lookup("inner").get_namespace()

for scope in (root, outer, inner):
    print("\\n", scope.get_name())
    for ident in scope.get_identifiers():
        s = scope.lookup(ident)
        print(ident, "local", s.is_local(), "free", s.is_free(),
              "global", s.is_global(), "nonlocal", s.is_nonlocal())`,
    buildSteps: [
      { title: '收集 raw facts', body: '遍历简化 AST，给每个 block 记录 def/use/param/global/nonlocal，先拒绝同 block 明显冲突。' },
      { title: '传播环境', body: '进入子函数时传入 bound/global 集合；将未本地绑定但命中 bound 的使用标记为 free。' },
      { title: '反向升级 cell', body: '子 block 返回 free 集合，父 block 若本地定义同名名称就将其升级为 cell，并从向上传播集合移除。' },
      { title: '映射 opcode', body: '对 local/global/free/cell 各生成一个最小函数，用 symtable 与 dis 验证分类和 LOAD/STORE 指令一致。' }
    ],
    selfCheckQuestion: '为什么 outer 的 local 只有在 inner 引用它时才需要成为 cell？',
    selfCheckAnswer: '普通 local 可以留在当前 frame 的快速局部槽中，生命周期不超过一次调用。被子函数捕获后，它必须在 outer 返回后继续存活，并让 outer 与所有闭包看到同一可变绑定；因此编译器用 cell 间接层承载该绑定。所有 local 都无条件装进 cell 会增加分配和间接访问成本。'
  },

  'compiler unit、basic block 与 CFG': {
    official: {
      title: 'InternalDocs · Compiler design',
      url: 'https://github.com/python/cpython/blob/main/InternalDocs/compiler.md',
      note: 'CPython 编译管线依次完成 AST、symbol table、指令序列/控制流图、优化和 assembly；内部文件名会随版本重构。'
    },
    source: {
      repo: 'python/cpython',
      file: 'Python/compile.c · Python/codegen.c · Python/flowgraph.c',
      symbol: '_PyAST_Compile',
      language: 'c',
      url: 'https://github.com/python/cpython/blob/main/Python/compile.c',
      walkthrough: [
        'compile.c 建立 compiler state 和嵌套 compiler unit；每个 function/class/comprehension 进入新 unit，拥有自己的常量、名称、locals、freevars 和 block。',
        'codegen visitor 把 AST 节点翻译为语义指令，控制结构创建 basic block 并连接跳转；此时很多操作数仍是名称/常量引用，不是最终紧凑整数。',
        'flowgraph 在 CFG 上删除不可达块、折叠跳转、传播行号、验证栈效果并处理异常边，最后才交给 assembler 布局。'
      ],
      code: `# 用 Python 复现“基本块 + 边”，帮助阅读 C 结构
class Block:
    def __init__(self, label):
        self.label = label
        self.instructions = []
        self.next = []       # fallthrough / conditional / exception edges

entry = Block("entry")
yes = Block("yes")
no = Block("no")
exit_ = Block("exit")

entry.instructions += [("LOAD_FAST", "flag"), ("POP_JUMP_IF_FALSE", no)]
entry.next += [yes, no]
yes.instructions += [("LOAD_CONST", 1), ("JUMP", exit_)]
yes.next += [exit_]
no.instructions += [("LOAD_CONST", 0)]
no.next += [exit_]
exit_.instructions += [("RETURN_VALUE", None)]`
    },
    overview: [
      'codegen 不应一边递归 AST 一边立刻写最终字节串。跳转目标尚未布局，异常区间尚未稳定，常量与名称索引还可去重，优化也需要看跨语句控制流。CPython 先生成可修改的指令和 basic block，再在 CFG 上完成全局约束，最后 assembly。',
      'basic block 是一段只有单入口、除末尾外没有跳转的线性指令。if、loop、try、match 会拆出多个 block，边表示 fallthrough、条件跳转、循环回边或异常控制流。栈式虚拟机还要求每条进入同一 block 的路径具有兼容栈深度，否则解释器不知道栈槽含义。',
      'compiler unit 对应一个独立 code object 候选，例如 module、function、lambda、class body 或 comprehension。进入 unit 时需要将 symbol table 给出的 locals/freevars/cellvars 映射到稳定索引，离开时把子 code object 作为常量装入父 unit。'
    ],
    mechanisms: [
      'VISIT 宏/visitor 按 AST 类型分派；表达式通常约定把一个结果压栈，语句约定保持入口栈平衡。',
      'jump target 先用 block identity 表示，避免提前猜测字节偏移。',
      '常量 key 要处理 1 与 True、-0.0 与 0.0 等“相等但类型/位模式不同”的边界。',
      '异常处理引入隐式边和 handler 栈深度，不能只看显式 jump。',
      'CFG optimizer 必须保持 traceback 行号、异常语义和可观测指令行为，而非只追求更短。'
    ],
    pitfalls: [
      '把 AST 节点和 opcode 一一对应；一个节点可能发出多块、多指令，也可能在优化后完全消失。',
      '只画正常控制流，遗漏异常边导致栈深度与资源清理推理错误。',
      '在 codegen 阶段写死最终 jump offset，之后插入 cache/extended arg 会让偏移失效。'
    ],
    example: `import ast
import dis

source = """
def choose(flag):
    if flag:
        return 1
    return 0
"""
tree = ast.parse(source)
code = compile(tree, "<lesson>", "exec")
fn_code = next(c for c in code.co_consts if hasattr(c, "co_code"))

for ins in dis.get_instructions(fn_code, show_caches=True):
    print(f"{ins.offset:>3}", ins.opname, ins.argrepr,
          "target" if ins.is_jump_target else "")`,
    buildSteps: [
      { title: '定义 IR 合同', body: '建立 Instruction(op, arg, location, target) 和 Block，明确表达式/语句对虚拟栈的净效果。' },
      { title: '翻译 if/while', body: '从 AST 发射 block 和 symbolic jump，不计算字节偏移；输出 DOT 或文本边表。' },
      { title: '做数据流分析', body: '从 entry 传播 stack depth，遇到同一 block 的不一致深度立即报编译错误。' },
      { title: '加入保守优化', body: '删除不可达 block、跳转穿透和常量条件折叠，每个优化前后都用真实 Python 结果和 dis 做差分。' }
    ],
    selfCheckQuestion: '为什么 basic block 适合作为 codegen 与 assembler 之间的中间表示？',
    selfCheckAnswer: '它保留了接近 opcode 的线性执行细节，同时把跳转表示为结构化边，便于在布局前做可达性、栈深度、异常区域和跳转优化。若直接写字节串，全局信息不完整；若一直停留在 AST，又难以表达栈效果和精确指令级控制流。'
  },

  'assembler、jump fixup、exception table 与 code object': {
    official: {
      title: 'Python Data Model · Code objects',
      url: 'https://docs.python.org/3/reference/datamodel.html#code-objects',
      note: 'code object 保存可执行字节码及常量、名称、变量、位置、异常表等不可变元数据；它不携带函数 globals/defaults/closure。'
    },
    source: {
      repo: 'python/cpython',
      file: 'Python/assemble.c · Objects/codeobject.c',
      symbol: '_PyAssemble_MakeCodeObject',
      language: 'c',
      url: 'https://github.com/python/cpython/blob/main/Python/assemble.c',
      walkthrough: [
        'assembler 先确定 block 顺序与每条指令大小，再把 symbolic jump target 转成相对或绝对单位；若参数超过单字节，需要 EXTENDED_ARG，指令变长又会反过来改变跳转。',
        '跳转 offset 和 EXTENDED_ARG 通过重复计算达到固定点。inline cache entries 也占 code units，反汇编时必须依赖当前 opcode metadata 正确跨过。',
        '最终同时编码 co_code、co_consts、co_names、localsplus、line table 和 exception table，再验证栈深度与结构不变量后构造不可变 PyCodeObject。'
      ],
      code: `def encode_oparg(opcode: int, arg: int) -> list[tuple[int, int]]:
    """教学版 EXTENDED_ARG：从高位到低位输出 8-bit 片段。"""
    parts = [arg & 0xFF]
    arg >>= 8
    while arg:
        parts.append(arg & 0xFF)
        arg >>= 8
    encoded = [(144, byte) for byte in reversed(parts[1:])]  # EXTENDED_ARG
    encoded.append((opcode, parts[0]))
    return encoded

assert len(encode_oparg(100, 7)) == 1
assert len(encode_oparg(100, 70_000)) == 3`,
    },
    overview: [
      'assembly 是把“可移动的指令图”冻结为“按地址排列的 code units”。难点来自自引用：jump 参数取决于目标和当前地址，参数变大可能需要 EXTENDED_ARG，使当前指令变长，又推动后续地址变化。实现会反复计算 offset/size，直到不再改变。',
      '现代 CPython 把异常处理区间编码进 exception table。正常执行路径无需每次进入 try 都维护显式 block 栈；抛异常时，解释器根据当前 instruction offset 查 handler、目标栈深度和 lasti 标志。所谓 zero-cost 指正常不抛时移除了维护开销，抛出与查表仍有成本。',
      'code object 是编译产物，不等于 function。它拥有 co_consts、co_names、co_varnames/freevars/cellvars、co_code 和调试表，却没有特定 globals 字典、默认参数或 closure cell 值。同一个 code object 可与不同环境组合成多个函数。'
    ],
    mechanisms: [
      '常量、名称和 localsplus 通过表索引压缩到 oparg。',
      'line table 用紧凑编码表达 instruction range 到源码位置的变化。',
      'exception table 编码 start、length、target、stack depth 等字段，并按执行偏移查找。',
      'co_stacksize 来自 CFG 数据流最大值，直接决定 frame value stack 容量。',
      'marshal/pyc 可序列化 code object，但内部格式随 Python 版本变化，不是长期协议。'
    ],
    pitfalls: [
      '假设一条 opcode 固定占两个字节，忽略 EXTENDED_ARG、cache entries 和版本变化。',
      '把 try 的低正常路径成本误讲成异常处理“免费”。',
      '修改 co_code 字节却不更新跳转、栈深度、行表和异常表。'
    ],
    example: `import dis

def guarded(value):
    try:
        return 10 // value
    except ZeroDivisionError:
        return 0

code = guarded.__code__
print("stack", code.co_stacksize)
print("consts", code.co_consts)
print("names", code.co_names)
dis.dis(guarded, show_caches=True)

# 3.11+ dis 输出末尾会展示 ExceptionTable；
# 对比 try 外的同一除法，观察正常路径指令差异。`,
    buildSteps: [
      { title: '先排线性块', body: '为每个 block 决定顺序，计算不含 jump fixup 时的初始 offset。' },
      { title: '迭代 jump size', body: '计算目标差值与 EXTENDED_ARG 数；只要任一指令长度变化就重新布局，直到固定点。' },
      { title: '编码辅助表', body: '为位置和异常区间设计 delta/varint 编码，并写独立 encode/decode round-trip 测试。' },
      { title: '构造 mini code object', body: '保存 instructions、consts、names、stacksize 与 location map，用自己的 stack VM 执行，再与 CPython dis 对照。' }
    ],
    selfCheckQuestion: '为什么 jump offset 不能在 codegen 第一次遇到跳转时一次算完？',
    selfCheckAnswer: '当时目标 block 可能尚未布局，前方指令也可能因 EXTENDED_ARG、inline cache 或优化改变长度。更关键的是跳转参数本身变大后会使跳转指令变长，从而继续推动地址。先用 symbolic target，统一布局并迭代到固定点，才能得到自洽偏移。'
  },

  'interpreter frame、dispatch loop 与 eval breaker': {
    official: {
      title: 'InternalDocs · The bytecode interpreter',
      url: 'https://github.com/python/cpython/blob/main/InternalDocs/interpreter.md',
      note: '当前解释器指令由 Python/bytecodes.c 定义并生成 dispatch cases；构建可选择传统 switch/computed goto 或 tail-call interpreter。'
    },
    source: {
      repo: 'python/cpython',
      file: 'Include/internal/pycore_frame.h · Python/bytecodes.c · Python/ceval.c',
      symbol: '_PyEval_EvalFrameDefault',
      language: 'c',
      url: 'https://github.com/python/cpython/blob/main/Python/ceval.c',
      walkthrough: [
        'interpreter frame 把 code、globals/builtins、previous frame、instruction pointer 与 localsplus/value stack 放在紧凑内部结构中；需要反射时才物化用户可见 PyFrameObject。',
        'dispatch loop 取当前 code unit、解码 opcode/oparg、移动 instruction pointer，再进入由 bytecodes.c 生成的语义 case。多数 case 用栈输入/输出 DSL 描述，生成器同时得到栈效果与多种解释器实现。',
        'eval breaker 是低频事件聚合点。pending calls、signal、GC、线程切换等不应让每条热点指令承担昂贵检查，解释器在后向跳转/调用等安全点统一处理。'
      ],
      code: `# 教学版 stack VM，对应“取指、解码、执行、推进”
def evaluate(code, consts):
    stack = []
    ip = 0
    while True:
        op, arg = code[ip]
        ip += 1
        if op == "LOAD_CONST":
            stack.append(consts[arg])
        elif op == "ADD":
            right = stack.pop()
            left = stack.pop()
            stack.append(left + right)
        elif op == "JUMP_BACKWARD":
            ip -= arg
            # CPython 会在部分安全点检查 eval breaker
        elif op == "RETURN_VALUE":
            return stack.pop()

assert evaluate([("LOAD_CONST", 0), ("LOAD_CONST", 1),
                 ("ADD", 0), ("RETURN_VALUE", 0)], [20, 22]) == 42`,
    },
    overview: [
      'frame 是一次执行的状态快照：正在运行哪个 code object、下一条指令在哪里、局部变量/闭包/临时值在哪、调用者是谁。现代内部 _PyInterpreterFrame 追求紧凑和低分配，只有 traceback、sys._getframe、debugger 等需要时才绑定或物化 PyFrameObject。把二者混为一谈会误判每次函数调用的分配成本。',
      '解释器是栈机。LOAD_FAST 把 local 槽压栈，BINARY_OP 取出操作数并压入结果，RETURN_VALUE 弹出返回值。源码中的 bytecodes DSL 是权威语义入口，generated_cases 是派生结果；不同构建可以用 computed goto、switch 或 tail calls 分派，但 Python 可观察语义应一致。',
      '信号、pending call、异步异常、线程调度和周期性 GC 需要及时响应，又不能让每条 opcode 都执行一串慢检查。eval breaker 把多个条件压成快速标志，并在已选择的安全点进入慢路径。这是一种常见系统设计：热点只检查摘要，冷路径再解析具体事件。'
    ],
    mechanisms: [
      'localsplus 连续保存 fast locals、cell/free 和 value stack，索引由 code object 元数据解释。',
      'stack pointer 必须与每条指令声明的输入/输出效果严格一致，异常路径也要恢复到 handler 指定深度。',
      'frame owner 区分 thread、generator 等所有权状态，决定暂停/返回后的生命周期。',
      'RESUME 是 tracing、specialization 和 generator resume 等状态的显式汇合点。',
      'tail-call interpreter 指 C 函数/标签之间的尾调用分派，并非 Python 语言的尾递归优化。'
    ],
    pitfalls: [
      '把 PyFrameObject 当作每次调用都完整堆分配的执行帧。',
      '直接阅读 generated_cases 却忽略它由 bytecodes.c 生成，难以理解 DSL 与版本差异。',
      '认为 GIL 或 eval breaker 会在每条字节码后固定切换线程。'
    ],
    example: `import dis
import sys

def add_then_double(left, right):
    total = left + right
    frame = sys._getframe()
    assert frame.f_code is add_then_double.__code__
    return total * 2

print(add_then_double.__code__.co_varnames)
for ins in dis.get_instructions(add_then_double, show_caches=True):
    print(ins.offset, ins.opname, ins.argrepr)

# 将 dis 的栈效果逐条手算，再对照 co_stacksize；
# 注意 sys._getframe 主动让 frame 进入可观察路径。`,
    buildSteps: [
      { title: '实现四指令 VM', body: '从 LOAD_CONST、LOAD_LOCAL、BINARY_ADD、RETURN 开始，显示打印 ip 与 stack 前后状态。' },
      { title: '加入 frame', body: '把 code/locals/stack/ip 封装进 Frame，CALL 创建子 frame，RETURN 将结果压回父 frame。' },
      { title: '加入异常展开', body: '维护简化 exception table；指令失败时按 ip 查 handler、截断 stack 并跳转。' },
      { title: '加入 breaker', body: '用一个 bitset 汇总 cancel/signal/gc 请求，只在 backward jump 和 call 边界处理，测量逐指令检查与摘要检查差异。' }
    ],
    selfCheckQuestion: 'tail-call interpreter 为什么与“Python 自动尾递归优化”没有关系？',
    selfCheckAnswer: '它改变的是解释器 C 实现中 opcode handler 之间的分派方式，让编译器更好布局和优化 handler；Python 函数调用仍会创建解释器 frame，并保留 traceback、递归限制和可观察栈语义。用户写的尾递归不会因此被消除。'
  },

  'vectorcall：参数数组、关键字名称与绑定': {
    official: {
      title: 'Python/C API · Call Protocol',
      url: 'https://docs.python.org/3/c-api/call.html#the-vectorcall-protocol',
      note: 'vectorcall 让内部调用通过连续 PyObject* 参数数组传值，避免为每次调用先物化 positional tuple 与 keyword dict；协议自 Python 3.9 起公开。'
    },
    source: {
      repo: 'python/cpython',
      file: 'Objects/call.c · Objects/funcobject.c · Python/ceval.c',
      symbol: 'PyObject_Vectorcall',
      language: 'c',
      url: 'https://github.com/python/cpython/blob/main/Objects/call.c',
      walkthrough: [
        'tp_call 接收 args tuple 和 kwargs dict，通用却需要创建容器。vectorcall 接收 callable、PyObject* 连续数组、nargsf 和只含关键字名称的 kwnames tuple。',
        'args 前半段是 positional values，后半段按 kwnames 顺序放 keyword values；关键字名称和值分离，使调用点常量名称 tuple 可复用。',
        '支持 vectorcall 的类型通过 offset/函数指针暴露入口。调用辅助函数优先走 fast path，不支持时才回落到传统协议；callee 仍必须执行完整参数绑定和错误检查。'
      ],
      code: `/* f(10, scale=2) 的概念布局 */
PyObject *values[2] = {ten, two};             // 先位置值，再关键字值
PyObject *kwnames = PyTuple_Pack(1, name_scale);

PyObject *result = PyObject_Vectorcall(
    callable,
    values,
    1,                                        // 位置参数数量，不含关键字值
    kwnames
);

/* nargsf 可能携带 PY_VECTORCALL_ARGUMENTS_OFFSET 标志；
   必须用 PyVectorcall_NARGS(nargsf) 提取真实位置参数数。 */`
    },
    overview: [
      '函数调用看似一条 CALL 指令，背后却要完成 callable 检查、参数传输、关键字匹配、默认值填充、*args/**kwargs 收集、frame 创建和错误格式化。传统 tp_call 把位置参数封成 tuple、关键字封成 dict，适合作为稳定通用边界；解释器内部大量短调用会为这些临时容器付出显著成本。',
      'vectorcall 的核心是“借用调用方已有的连续栈布局”。值已经位于 evaluation stack，相邻内存可以直接作为 PyObject* 数组传给 callee；固定关键字名称通常来自 code object，可复用 kwnames tuple。省掉的是中间容器物化和哈希插入，Python 参数语义没有缩水。',
      '快速传输之后仍要绑定。positional-only 不接受同名 keyword，普通参数不能被重复赋值，keyword-only 必须按名匹配，多余值进入 *args/**kwargs 或触发 TypeError。真正的优化来自将常见无歧义路径内联、延迟构造可变容器，同时保留冷失败路径的准确错误。'
    ],
    mechanisms: [
      'nargsf 的低位/标志组合通过 PyVectorcall_NARGS 解码，不能直接当整数使用。',
      'PY_VECTORCALL_ARGUMENTS_OFFSET 允许 callee 临时使用 args[-1] scratch slot，前提是恢复原值。',
      'bound method fast path 可把 self 放进参数数组，避免创建临时 method object 或 tuple。',
      '重新赋值 type.__call__ 可能改变 vectorcall 支持，缓存 callable 能力时必须遵循类型版本机制。',
      'vectorcall 不替 callee 自动做 recursion control；需要递归保护的实现自行进入/离开检查。'
    ],
    pitfalls: [
      '把 vectorcall 说成完全绕过参数绑定；它只优化传输和常见调用路径。',
      '错误计算 positional count，把 keyword values 也算进 nargs。',
      '保存 borrowed args 指针到调用结束之后，造成悬垂引用或所有权错误。'
    ],
    example: `import inspect

def bind_like_python(a, /, b=2, *items, scale, **options):
    return a, b, items, scale, options

sig = inspect.signature(bind_like_python)
bound = sig.bind(10, 20, 30, scale=4, debug=True)
bound.apply_defaults()
print(bound.arguments)

cases = [
    lambda: bind_like_python(a=10, scale=2),       # positional-only
    lambda: bind_like_python(10, 20, b=30, scale=2), # duplicate
    lambda: bind_like_python(10),                  # missing kw-only
]
for call in cases:
    try:
        call()
    except TypeError as error:
        print(type(error).__name__, error)`,
    buildSteps: [
      { title: '画参数内存图', body: '对 f(1, 2, x=3, y=4) 标出 args 数组、nargs、kwnames 和每个引用的所有权。' },
      { title: '实现 binder', body: '用参数 kind 表驱动位置绑定、keyword 查找、默认值和 variadic 收集；每个失败分支写精确测试。' },
      { title: '比较物化成本', body: '实现 tuple/dict 协议与 array/kwnames 协议，统计临时容器和哈希插入次数，不只测一个纳秒数字。' },
      { title: '追踪真实调用', body: '从 CALL 指令到 _PyObject_VectorcallTstate，再到 Python function vectorcall/frame 初始化，画出 fast/slow 两条路径。' }
    ],
    selfCheckQuestion: 'vectorcall 的主要收益来自哪里，为什么它不会改变 Python 函数签名语义？',
    selfCheckAnswer: '收益来自复用调用点已有的连续值布局和可复用关键字名称，减少 tuple、dict 创建及关键字哈希插入。callee 仍根据同一签名表执行 positional-only、keyword-only、默认值、重复赋值和 variadic 规则，因此优化的是数据搬运与常见路径，不是语言合同。'
  },

  'specialization：counter、guard、cache 与 deopt': {
    official: {
      title: 'PEP 659 · Specializing Adaptive Interpreter',
      url: 'https://peps.python.org/pep-0659/',
      note: '自适应解释器先执行通用语义并收集反馈，再把稳定站点替换为带 guard/cache 的专用形式；假设失效时回退。当前实现细节以对应版本源码为准。'
    },
    source: {
      repo: 'python/cpython',
      file: 'Python/specialize.c · Python/bytecodes.c',
      symbol: '_Py_Specialize_*',
      language: 'c',
      url: 'https://github.com/python/cpython/blob/main/Python/specialize.c',
      walkthrough: [
        '可专门化站点先带 warmup/counter，避免冷代码立即支付分析和重写成本；达到阈值后检查实际对象类型与可缓存形状。',
        '成功时 inline cache 保存 type version、descriptor/index 或其他快速路径证据，执行时 guard 命中便跳过通用协议；cache 位于指令邻近 code units，提高局部性。',
        'guard miss 会计数、deopt 或重新专门化。所有 specialized opcode 必须与通用 opcode 可观察语义相同，异常、descriptor 和用户自定义 hook 都不能被错误绕过。'
      ],
      code: `# 教学版 inline cache，不修改真正 bytecode
MISS = object()

class AttrCache:
    def __init__(self):
        self.owner = None
        self.name = None
        self.slot = None

    def load(self, obj, name):
        # guard：类型与属性名仍是训练时的稳定形状
        if type(obj) is self.owner and name == self.name:
            value = self.slot(obj)
            if value is not MISS:
                return value

        # slow path：完整 getattr 保留 descriptor/__getattr__ 语义
        value = getattr(obj, name)
        if hasattr(obj, "__dict__") and name in obj.__dict__:
            self.owner, self.name = type(obj), name
            self.slot = lambda current: current.__dict__.get(name, MISS)
        return value`,
    },
    overview: [
      '动态语言的同一 LOAD_ATTR 可以遇到任意类型和自定义协议，通用实现必须检查很多分支；真实程序的单个调用站点却往往反复看见相同形状，例如循环里每次都是同一类实例字段。specialization 利用“全局动态、局部稳定”，为具体站点生成带假设的快捷路径。',
      'inline cache 保存证明快捷路径仍正确所需的最小证据，例如 type version、字典 index、keys version 或 callable 信息。guard 先验证证据，命中才直接取值；任何可能改变查找语义的事件都必须让版本变化或 guard 失败。缓存的是可撤销假设，不是把动态语义永久改成静态。',
      '为何需要 counter 与 deopt？冷站点的反馈不足，立即特化会浪费编译时间；多态站点在 A/B 类型间来回切换，反复重写会抖动。计数器控制观察窗口、失败退避和重试，deopt 回到永远正确的通用形式。这套状态机比“见一次类型就缓存”复杂，却是生产自适应系统的稳定性核心。'
    ],
    mechanisms: [
      'quickening 在 code object 可执行副本上调整指令/cache，原始语义和反汇编接口需保留可解释性。',
      'family 把 adaptive、specialized 与 instrumented 形式关联到同一基础 opcode。',
      'type/dict/function version tag 将许多失效事件折叠成整数 guard。',
      'megamorphic 站点应退避，避免 specialization thrashing 比通用路径更慢。',
      'dis(adaptive=True, show_caches=True) 可观察当前运行时状态，但 opcode 名和阈值不是稳定 API。'
    ],
    pitfalls: [
      '把 specialization 等同 JIT 机器码生成；CPython 这层首先是专用 bytecode 与 inline cache。',
      '缓存 obj.__dict__[name] 却忽略 data descriptor 优先级、__getattribute__ 和字典 keys 变化。',
      '在微基准中只测热态最好结果，不报告 warmup、deopt 和输入多态性。'
    ],
    example: `import dis

class Point:
    def __init__(self, x):
        self.x = x

def read_x(point):
    return point.x + 1

p = Point(10)
for _ in range(20_000):
    read_x(p)       # 让调用站点积累稳定反馈

dis.dis(read_x, adaptive=True, show_caches=True)

# 再传入拥有 property 或自定义 __getattribute__ 的对象，
# 观察语义仍正确，并比较 cache/deopt 状态（具体名称随版本变化）。`,
    buildSteps: [
      { title: '实现状态机', body: '为一个 LOAD_ATTR 站点实现 COLD → ADAPTIVE → SPECIALIZED → BACKOFF，记录执行、命中、miss 与 rewrite 次数。' },
      { title: '定义正确 guard', body: '先列出通用属性查找链，再证明缓存了哪些前提；若无法证明，就不要进入 fast path。' },
      { title: '加入失效', body: '修改实例字段、类 descriptor、__getattribute__ 或传入第二类型，确保 miss 后回到完整 getattr 而非返回旧值。' },
      { title: '设计多态实验', body: '比较单态、双态、megamorphic 输入的 warmup、命中率、总耗时和重写次数，解释何时优化反而亏损。' }
    ],
    selfCheckQuestion: 'inline cache 为什么必须保存 guard 证据，而不能只保存上一次查到的值或地址？',
    selfCheckAnswer: '属性、全局变量和调用目标会因实例/类字典修改、descriptor 替换、类型变化等事件改变。缓存结果只有在一组结构假设仍成立时才等价于通用语义；guard 用 version/type/index 等证据验证这些假设。没有 guard 的旧结果会把合法动态修改变成静默错误。'
  },

  '端到端源码改造：新增可观测优化并回归': {
    official: {
      title: 'Python Developer’s Guide · Development workflow',
      url: 'https://devguide.python.org/getting-started/fixing-issues/',
      note: '可合并的解释器修改需要问题定义、最小补丁、NEWS/文档判断、针对性测试、生成文件更新以及完整回归，而非只在本机样例成功。'
    },
    source: {
      repo: 'python/cpython',
      file: 'Python/bytecodes.c · Tools/cases_generator · Lib/test/test_dis.py',
      symbol: 'generated instruction workflow',
      language: 'c',
      url: 'https://github.com/python/cpython/blob/main/Python/bytecodes.c',
      walkthrough: [
        '项目选择“可观测而低风险”的教学改造：为 mini VM 加入专门化统计，或在个人 CPython 分支给现有内部路径增加受控诊断。不要凭课程直接发明公共语法或改变稳定行为。',
        '先固定基线：语义测试、dis/统计快照和 release benchmark。修改设计源文件后运行对应 regeneration，检查生成 diff 只包含预期变化。',
        '验证分三层：最小行为与失败测试、相关 stdlib 测试、完整 test suite；性能声明还要用 release/PGO 合理配置、多次运行和真实 workload。'
      ],
      code: `# 一个可审计实验单，而非“改完能跑”的截图
experiment = {
    "commit": "<固定 CPython SHA>",
    "hypothesis": "稳定 LOAD_ATTR 站点命中缓存后减少通用查找",
    "semantic_cases": [
        "普通实例字段", "data descriptor", "__getattribute__",
        "类属性替换后失效", "两种类型交替", "异常传播",
    ],
    "generated_from": "Python/bytecodes.c",
    "generated_outputs": ["Python/generated_cases.c.h"],
    "tests": [
        "./python -m test test_dis test_descr -j2",
        "./python -m test -j4",
    ],
    "benchmark_build": "release build; debug assertions disabled",
}`
    },
    overview: [
      '“能读源码”最终要表现为能在不破坏边界的情况下改变源码。完整任务从假设开始：哪条路径为什么慢或难以观测，哪些输入会受益，哪些可观察语义必须保持。没有这个合同，新增 opcode、cache 或语法很容易成为只对一段 demo 有效的复杂化。',
      '推荐第一项真实改造选择内部诊断、错误信息、测试覆盖或现有优化的小修，而不是立刻新增语言语法。语法变化横跨 grammar、AST、symtable、codegen、解释器、ast/unparse、文档、工具与兼容政策；它适合作为架构地图练习，却未必是合理上游贡献。成熟工程师会同时评估“可以实现”和“值得维护”。',
      '回归报告应能让另一位开发者复现：版本 SHA、构建参数、生成命令、测试选择、平台、基线/变体原始数据、失败样例和未覆盖风险。性能提升若只出现在 pydebug、一次计时或特制输入中，证据不足；功能补丁若没有负路径与重入测试，同样不足。'
    ],
    mechanisms: [
      '行为合同先枚举正常、边界、异常、动态修改和重入路径，再决定实现。',
      'generated file diff 应由官方工具产生并与设计源一起提交。',
      'reference ownership 每个分支都要标注 new/borrowed/stolen，并测试错误清理。',
      '性能补丁要区分 warmup、steady state、code size、memory、冷启动和多态退化。',
      'bisectable 小提交让失败可定位；同时修改十个层次会让审查失去证据。'
    ],
    pitfalls: [
      '只写 happy path，在 descriptor、异常、subclass 或 mutation 下改变语义。',
      '在 pydebug 上宣称性能收益，或只展示最小值而无方差与 workload。',
      '把新增复杂度藏进生成代码，没有设计说明、失效策略和维护成本评估。'
    ],
    example: `# 用 Python 层先建立语义 oracle，再进入 C 源码
class Descriptor:
    def __get__(self, obj, owner):
        if obj is None:
            return self
        return obj.payload * 10

class Record:
    field = Descriptor()
    def __init__(self, payload):
        self.payload = payload

def hot(record):
    return record.field

r = Record(3)
baseline = [hot(r) for _ in range(100)]
Record.field = 7             # 动态替换必须让旧假设失效
after_mutation = hot(r)

assert baseline == [30] * 100
assert after_mutation == 7`,
    buildSteps: [
      { title: '写一页设计合同', body: '明确目标、非目标、语言语义、不变量、受益 workload、退化 workload、版本范围和回滚方式。' },
      { title: '建立黑盒 oracle', body: '在未修改解释器上保存所有正常与失败结果；加入 descriptor、重入、动态 mutation、subclass 和异常路径。' },
      { title: '沿生成链实现', body: '只改设计源，运行官方 regeneration，审查生成 diff；C 路径逐分支配平引用并在 pydebug/ASAN 下运行。' },
      { title: '做分层验收', body: '先目标测试，再相关模块，最后完整 suite；release 构建运行统计严谨的 benchmark，并报告无收益/退化情形。' },
      { title: '完成架构复盘', body: '画出本次改动穿过的 token/AST/symtable/CFG/code/frame 层，解释哪些层完全无需修改以及为什么。' }
    ],
    selfCheckQuestion: '为什么“新增一条 Python 语法并成功执行”仍不足以证明源码改造完成？',
    selfCheckAnswer: '语言特性还要覆盖错误诊断、AST 公开结构、名称作用域、字节码栈效果、异常和调试位置、unparse/工具、文档、版本兼容与完整回归；生成文件也必须来自正确设计源。一次 happy-path 执行只证明穿过了一条路径，无法证明其余实现不变量与生态合同。'
  }
}
