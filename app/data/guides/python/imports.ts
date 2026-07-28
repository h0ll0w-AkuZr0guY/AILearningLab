import type { TopicGuide } from '../../topic-guides'

export const pythonImportGuides: Record<string, TopicGuide> = {
  'import 语句、模块对象与名称绑定': {
    official: {
      title: 'The import system · The import statement',
      url: 'https://docs.python.org/3/reference/import.html#the-import-statement',
      note: 'import 先查找并初始化模块，再决定在当前作用域绑定顶层包、子模块或被导出的属性。'
    },
    overview: [
      'import 同时做两件事：保证目标模块对象已被找到和加载，再在当前 namespace 建立绑定。import pkg.sub 通常绑定 pkg；from pkg import sub 绑定 sub；import pkg.sub as alias 则把目标子模块绑定给 alias。',
      '模块是普通对象，执行模块代码就是向 module.__dict__ 写入名称。一次成功加载后，其他导入通常复用同一 sys.modules 对象，因此模块级可变状态拥有进程级共享范围。'
    ],
    mechanisms: [
      '__import__ 返回值为兼容语义常是顶层包，importlib.import_module 返回指定模块。',
      'from x import name 优先读取 x.name，必要时还可能尝试加载 x.name 子模块。',
      '模块代码从上到下执行，函数体只定义不调用，装饰器与类体则在导入期运行。',
      '__all__ 只影响 from module import *，不形成权限边界。'
    ],
    pitfalls: [
      '在模块顶层进行网络连接、启动线程或读取不可用配置，使导入变成不可控副作用。',
      '认为 import pkg.sub 后局部名称 sub 自动存在。',
      '把模块单例当作跨进程共享状态；每个解释器进程有独立 sys.modules。'
    ],
    example: `import importlib
import xml.etree.ElementTree

assert "xml.etree.ElementTree" in __import__("sys").modules
assert xml.__name__ == "xml"              # import pkg.sub 绑定顶层 pkg

ET = importlib.import_module("xml.etree.ElementTree")
assert ET.__name__ == "xml.etree.ElementTree"
assert ET is xml.etree.ElementTree

from xml.etree import ElementTree as BoundET
assert BoundET is ET`,
    buildSteps: [
      { title: '记录绑定表', body: '对四种 import 语法列出实际加载名与局部绑定名，用 globals() 断言。' },
      { title: '实现 mini import statement', body: '把 resolve/load 与 bind 两阶段分成独立函数，禁止混成一个路径查找函数。' },
      { title: '审计顶层副作用', body: '列出每个模块导入期执行的 I/O、注册和全局实例化，把重操作移到显式初始化。' }
    ],
    selfCheckQuestion: '为什么 import a.b.c 后当前作用域通常只有 a，而 import a.b.c as cmod 会绑定 cmod？',
    selfCheckAnswer: '查找加载阶段都确保 a、a.b、a.b.c 存在；名称绑定阶段遵循语句形式。无 as 的点名 import 绑定顶层包，便于通过 a.b.c 访问；as 形式明确要求把完整目标模块对象绑定给别名。'
  },
  'sys.modules 缓存、预插入与失败回滚': {
    official: {
      title: 'The import system · The module cache',
      url: 'https://docs.python.org/3/reference/import.html#the-module-cache',
      note: 'sys.modules 是完全限定名到模块对象的缓存；加载器执行前先插入，失败时删除本次插入的条目。'
    },
    source: {
      repo: 'python/cpython',
      file: 'Lib/importlib/_bootstrap.py',
      symbol: '_load_unlocked',
      language: 'python',
      url: 'https://github.com/python/cpython/blob/main/Lib/importlib/_bootstrap.py#L893',
      walkthrough: [
        'module_from_spec 先建立对象和标准属性，spec._initializing 标记半初始化窗口。',
        'exec_module 前写入 sys.modules，递归导入同名模块才能拿到同一对象而非无限创建。',
        'exec_module 失败只删除该名称再重抛；成功后保留对象身份，并把条目移动到字典末尾。'
      ],
      code: `def _load_unlocked(spec):
    module = module_from_spec(spec)
    spec._initializing = True
    try:
        sys.modules[spec.name] = module       # 执行前预插入，打破递归创建
        try:
            if spec.loader is None:
                if spec.submodule_search_locations is None:
                    raise ImportError("missing loader", name=spec.name)
            else:
                spec.loader.exec_module(module)
        except:
            try:
                del sys.modules[spec.name]    # 本次加载失败不得留下坏缓存
            except KeyError:
                pass
            raise
        module = sys.modules.pop(spec.name)
        sys.modules[spec.name] = module
    finally:
        spec._initializing = False
    return module`
    },
    overview: [
      'sys.modules 的首要职责是身份稳定和避免重复执行。只要完全限定名存在，import 通常直接返回该对象；值为 None 则强制后续导入失败。删除缓存条目会触发新模块对象，但旧引用仍指向旧对象。',
      '执行前预插入产生“存在但未完成”的窗口。它是支持递归/循环导入的必要代价；spec._initializing 与专用错误信息帮助诊断访问了尚未设置的属性。执行失败必须回滚本次名称，否则半成品会永久伪装成成功模块。'
    ],
    mechanisms: [
      '缓存键是完整名，alias 只影响当前绑定，不改变 sys.modules 键。',
      '预插入发生在 exec_module 前，模块顶层可观察到自身条目。',
      '加载失败删除当前条目，副作用导入的其他模块仍保留。',
      '每个模块名有导入锁，避免多线程并发初始化同名模块。'
    ],
    pitfalls: [
      '直接替换 sys.modules[name] 后期待现存 from-import 引用同步更新。',
      '失败加载器忘记回滚缓存，使后续 import 返回不完整对象。',
      '测试删除大量 sys.modules 条目，破坏解释器内部共享类型身份。'
    ],
    example: `import importlib
import sys

first = importlib.import_module("fractions")
assert sys.modules["fractions"] is first

del sys.modules["fractions"]
second = importlib.import_module("fractions")

assert first is not second                   # 新缓存对象
assert first.Fraction is not second.Fraction # 旧引用没有重绑
assert sys.modules["fractions"] is second`,
    buildSteps: [
      { title: '实现缓存快路', body: '按完全限定名查询，存在时直接返回同一对象，并单独处理 None 哨兵。' },
      { title: '实现预插入与回滚', body: '创建 module 后先缓存，再 exec；用 try/except 只删除自己插入的失败条目。' },
      { title: '加入初始化状态与锁', body: '并发任务等待同名模块锁；循环请求可取得半初始化对象但诊断未定义属性。' }
    ],
    selfCheckQuestion: '为什么模块必须在 exec_module 之前放入 sys.modules？',
    selfCheckAnswer: '模块顶层可能直接或间接再次导入自己。若执行后才缓存，递归导入会不断创建并执行新对象；提前缓存让递归路径复用同一身份。代价是外部可能看到半初始化对象，所以失败要回滚，循环依赖还应避免过早访问属性。'
  },
  'sys.meta_path 与 MetaPathFinder': {
    official: {
      title: 'The import system · The meta path',
      url: 'https://docs.python.org/3/reference/import.html#the-meta-path',
      note: '未命中缓存后，import 依次询问 sys.meta_path 中 finder.find_spec(fullname, path, target)。'
    },
    source: {
      repo: 'python/cpython',
      file: 'Lib/importlib/_bootstrap.py',
      symbol: '_find_spec',
      language: 'python',
      url: 'https://github.com/python/cpython/blob/main/Lib/importlib/_bootstrap.py#L1192',
      walkthrough: [
        '先复制 meta_path，避免 finder 执行期间修改列表导致当前遍历视图漂移。',
        '每个 finder 返回 None 表示不负责，首个非 None ModuleSpec 胜出；顺序因此就是优先级。',
        'finder 执行可能间接完成模块加载，非 reload 情况要再次检查 sys.modules 并优先采用实际模块的 spec。'
      ],
      code: `def _find_spec(name, path, target=None):
    meta_path = list(sys.meta_path)
    is_reload = name in sys.modules

    for finder in meta_path:
        spec = finder.find_spec(name, path, target)
        if spec is not None:
            if not is_reload and name in sys.modules:
                module_spec = getattr(sys.modules[name], "__spec__", None)
                return module_spec or spec
            return spec
    return None`
    },
    overview: [
      'MetaPathFinder 是全局路由层，可处理内建、冻结、文件系统、zip、内存、远程或策略阻断模块。顶层导入 path=None；查找 package.child 时 path 是父包的 submodule_search_locations。',
      '返回 None 表示“我不处理”，抛 ModuleNotFoundError/ImportError 则终止搜索。自定义 finder 应只认领明确 namespace，并避免做昂贵网络请求拖慢所有 import。'
    ],
    mechanisms: [
      'finder 只负责产出 ModuleSpec，不应自行执行模块。',
      'target 主要用于 reload，允许 finder参考现有模块。',
      'sys.meta_path 顺序影响覆盖和安全策略。',
      'invalidate_caches 广播给支持该方法的 finder。'
    ],
    pitfalls: [
      '自定义 finder 对未知名称抛错，阻断后续标准 finder。',
      '把 finder 插到最前且拦截宽泛前缀，覆盖标准库或供应链模块。',
      'find_spec 内执行用户模块，破坏加载器的缓存与回滚责任。'
    ],
    example: `import importlib.abc
import importlib.util
import sys

SOURCES = {"memory_demo": "answer = 42"}

class MemoryLoader(importlib.abc.Loader):
    def exec_module(self, module):
        exec(SOURCES[module.__name__], module.__dict__)

class MemoryFinder(importlib.abc.MetaPathFinder):
    def find_spec(self, fullname, path, target=None):
        if fullname not in SOURCES:
            return None
        return importlib.util.spec_from_loader(fullname, MemoryLoader())

finder = MemoryFinder()
sys.meta_path.insert(0, finder)
try:
    import memory_demo
    assert memory_demo.answer == 42
finally:
    sys.meta_path.remove(finder)
    sys.modules.pop("memory_demo", None)`,
    buildSteps: [
      { title: '限制命名空间', body: 'finder 仅接受固定前缀或 registry 中的完整名，其他请求立即 None。' },
      { title: '只返回 spec', body: '把源码/字节获取状态放 loader_state，真正执行交给 loader。' },
      { title: '覆盖协议矩阵', body: '测试顶层 path=None、子模块 path、reload target、unknown name 和 invalidate。' }
    ],
    selfCheckQuestion: '自定义 MetaPathFinder 对不认识的模块名应返回 None 还是抛 ModuleNotFoundError？',
    selfCheckAnswer: '通常返回 None，让后续 finder 继续尝试；只有它明确拥有该 namespace 且确定目标无效时才应抛错终止。把“不负责”误写成“找不到”会使标准库和其他插件的导入被全局拦截。'
  },
  'PathFinder、sys.path_hooks 与 importer cache': {
    official: {
      title: 'The import system · The path based finder',
      url: 'https://docs.python.org/3/reference/import.html#the-path-based-finder',
      note: 'PathFinder 遍历 sys.path 或包 __path__，通过 path hooks 为每个路径条目创建并缓存 PathEntryFinder。'
    },
    source: {
      repo: 'python/cpython',
      file: 'Lib/importlib/_bootstrap_external.py',
      symbol: 'PathFinder._path_importer_cache',
      language: 'python',
      url: 'https://github.com/python/cpython/blob/main/Lib/importlib/_bootstrap_external.py#L1209',
      walkthrough: [
        '每个 path entry 先查询 sys.path_importer_cache，避免反复运行所有 path hooks。',
        '未命中时逐个调用 hook；hook 以 ImportError 表示“不支持这个路径格式”，首个成功 finder 被缓存。',
        '找不到 finder 也缓存 None；新增 hook 后需清理对应缓存或 invalidate_caches。'
      ],
      code: `@classmethod
def _path_importer_cache(cls, path):
    if path == "":
        path = os.getcwd()                    # 空串动态表示当前目录
    try:
        finder = sys.path_importer_cache[path]
    except KeyError:
        finder = cls._path_hooks(path)        # 依次尝试 sys.path_hooks
        sys.path_importer_cache[path] = finder # None 也缓存，避免反复探测
    return finder

@staticmethod
def _path_hooks(path):
    for hook in sys.path_hooks:
        try:
            return hook(path)
        except ImportError:                   # 这个 hook 不支持该路径
            continue
    return None`
    },
    overview: [
      'PathFinder 本身是 meta path finder，内部再把每个路径条目交给 PathEntryFinder。默认 FileFinder 根据目录内容和 suffix→loader 表决定 .py、.pyc、扩展模块或包如何产生 spec。',
      '这里至少有 sys.path、sys.path_importer_cache 与 FileFinder 目录缓存三层状态。动态创建文件、修改 hooks 或切换 cwd 后，“文件存在却导入不到”常是缓存未失效，而非语法问题。'
    ],
    mechanisms: [
      '顶层搜索 sys.path，子模块搜索 parent.__path__。',
      'path hook 接收单个条目并返回 finder，不支持时抛 ImportError。',
      'FileFinder 按目录 mtime 刷新文件名缓存，存在时间粒度竞态。',
      'importlib.invalidate_caches 通知 finder，并清理部分相对路径/None 缓存。'
    ],
    pitfalls: [
      '修改 sys.path_hooks 后不清 sys.path_importer_cache。',
      '并发创建模块文件后立刻 import，命中 FileFinder 的旧目录缓存。',
      '把应用工作目录依赖隐含在 sys.path[0]，换启动方式就导入不同包。'
    ],
    example: `import importlib
import sys
import tempfile
from pathlib import Path

with tempfile.TemporaryDirectory() as directory:
    sys.path.insert(0, directory)
    try:
        try:
            import generated_module
        except ModuleNotFoundError:
            pass

        Path(directory, "generated_module.py").write_text("value = 7", encoding="utf-8")
        importlib.invalidate_caches()
        import generated_module
        assert generated_module.value == 7
    finally:
        sys.path.remove(directory)
        sys.modules.pop("generated_module", None)`,
    buildSteps: [
      { title: '实现 path hook', body: '让 mem://name 条目映射到专属 PathEntryFinder，普通路径抛 ImportError。' },
      { title: '实现 importer cache', body: '缓存 finder 与 None，增加 invalidate 后重新运行 hooks 的测试。' },
      { title: '模拟目录缓存竞态', body: '先查找失败再创建模块，验证失效前后结果，并记录 cwd 空路径特殊语义。' }
    ],
    selfCheckQuestion: '为什么 sys.path_importer_cache 会缓存 None？',
    selfCheckAnswer: 'None 表示所有 path hook 都不支持该条目，缓存它能避免每次导入都重复运行整组 hooks。代价是后来安装新 hook 或让路径变得可识别时，旧 None 仍会阻断重新探测，因此必须清理该键或调用合适的缓存失效机制。'
  },
  'ModuleSpec、create_module 与 exec_module': {
    official: {
      title: 'importlib.machinery.ModuleSpec',
      url: 'https://docs.python.org/3/library/importlib.html#importlib.machinery.ModuleSpec',
      note: 'ModuleSpec 在 finder 与 loader 之间传递名称、loader、origin、包搜索位置和 loader_state。'
    },
    overview: [
      'ModuleSpec 是加载计划而非模块本体。finder 描述“由谁、从哪里、是否为包、携带什么私有状态”加载，import machinery 统一负责对象创建、标准属性、sys.modules 预插入、执行与失败回滚。',
      'create_module 可为扩展模块或代理模块自定义对象，返回 None 表示使用默认 ModuleType；exec_module 只初始化传入对象，不应私自换掉身份。拆开创建与执行让多阶段 C 扩展和子解释器拥有清晰生命周期。'
    ],
    mechanisms: [
      'submodule_search_locations 为 None 表示普通模块，为序列表示包，namespace package 可由多路径组成。',
      'module_from_spec 调 create_module 并设置 __spec__、__loader__、__package__ 等属性。',
      'exec_module 运行时对象已在 sys.modules，可支持递归导入。',
      'loader_state 可传递 finder 计算出的不可公开加载数据。'
    ],
    pitfalls: [
      'exec_module 新建另一个 module 并替换引用，破坏先拿到预插入对象的循环依赖方。',
      '用 __file__ 判断所有模块来源，内建与 namespace package 可能没有它。',
      '把 spec.origin 与 module.__file__ 当作自动同步字段，运行时修改一边不会更新另一边。'
    ],
    example: `import importlib.abc
import importlib.util
import sys

class ConfigLoader(importlib.abc.Loader):
    def create_module(self, spec):
        return None                           # 使用默认 ModuleType
    def exec_module(self, module):
        module.value = module.__spec__.loader_state["value"]

spec = importlib.util.spec_from_loader("config_demo", ConfigLoader())
spec.loader_state = {"value": 42}
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
try:
    spec.loader.exec_module(module)
    assert module.value == 42
    assert module.__spec__ is spec
finally:
    sys.modules.pop(spec.name, None)`,
    buildSteps: [
      { title: '定义加载计划', body: 'spec 保存 name、loader、origin、is_package 与 loader_state，禁止 finder 执行代码。' },
      { title: '统一 machinery', body: '按 create→标准属性→预缓存→exec→失败回滚实现加载器驱动。' },
      { title: '验证身份', body: '让 exec 期间递归取得 sys.modules[name]，断言与传入 module 是同一对象。' }
    ],
    selfCheckQuestion: '为什么现代 loader 分成 create_module 与 exec_module？',
    selfCheckAnswer: '创建负责对象身份和底层分配，执行负责初始化既有对象。import machinery 能在执行前统一设置属性并预插入缓存，循环导入看到稳定身份；C 扩展还能把模块创建与每个解释器的执行阶段分开，改善子解释器隔离。'
  },
  '普通包、__path__ 与 namespace package': {
    official: {
      title: 'The import system · Packages',
      url: 'https://docs.python.org/3/reference/import.html#packages',
      note: '包通过 __path__/spec.submodule_search_locations 提供子模块搜索位置；namespace package 可聚合多个路径且无 __init__.py。'
    },
    overview: [
      '普通包是执行 __init__.py 得到的模块，同时拥有 __path__ 供 PathFinder 查找子模块。导入 parent.child 时，搜索范围来自 parent.__path__，并在成功后把 child 模块设置为 parent.child 属性。',
      'namespace package 没有单一 __init__.py 和固定 origin，它把 sys.path 上多个同名目录贡献合并成搜索位置。这适合大型组织拆分发行包，也带来安装缺片、路径优先级和资源访问的额外诊断成本。'
    ],
    mechanisms: [
      'spec.submodule_search_locations 非 None 即表示 package。',
      '普通包先执行 __init__.py，再开始子模块加载。',
      'namespace path 会在父搜索路径变化时动态重算。',
      'importlib.resources 应替代拼接 __file__ 读取包资源。'
    ],
    pitfalls: [
      'namespace package 中依赖根 __init__.py 注册副作用，它根本不存在。',
      '手工覆盖 __path__ 导致其他发行包贡献的 namespace 部分消失。',
      '用当前工作目录拼资源路径，打包成 wheel/zip 后失效。'
    ],
    example: `import sys
import tempfile
from pathlib import Path

with tempfile.TemporaryDirectory() as left, tempfile.TemporaryDirectory() as right:
    Path(left, "shared_ns").mkdir()
    Path(right, "shared_ns").mkdir()
    Path(left, "shared_ns", "alpha.py").write_text("value='a'", encoding="utf-8")
    Path(right, "shared_ns", "beta.py").write_text("value='b'", encoding="utf-8")
    sys.path[:0] = [left, right]
    try:
        import shared_ns.alpha, shared_ns.beta
        assert set(shared_ns.__path__) == {
            str(Path(left, "shared_ns")), str(Path(right, "shared_ns"))
        }
    finally:
        del sys.path[:2]
        for name in list(sys.modules):
            if name == "shared_ns" or name.startswith("shared_ns."):
                del sys.modules[name]`,
    buildSteps: [
      { title: '比较两类 spec', body: '检查普通包与 namespace package 的 loader、origin、submodule_search_locations、__file__。' },
      { title: '实现路径聚合', body: '遍历父 path 收集所有同名目录；找到 __init__ 时按普通包优先规则返回。' },
      { title: '测试分片安装', body: '删除其中一个贡献目录，验证错误信息能指出缺失发行包而非笼统模块不存在。' }
    ],
    selfCheckQuestion: 'namespace package 为什么能跨多个 site-packages 目录组成一个包？',
    selfCheckAnswer: 'PathFinder 在父搜索路径的多个条目中收集同名目录贡献，并把它们组成 spec.submodule_search_locations；没有单一 __init__.py 被执行。后续子模块搜索遍历这组位置，因此不同 distribution 可以分别提供同一 namespace 下的子包。'
  },
  '绝对/相对导入、__package__ 与 __main__': {
    official: {
      title: 'The import system · Package relative imports',
      url: 'https://docs.python.org/3/reference/import.html#package-relative-imports',
      note: '显式相对导入由前导点和 __package__/__spec__.parent 解析；直接文件执行往往没有已知父包。'
    },
    overview: [
      'from . import sibling 的点不是文件系统“当前目录”，而是模块完整名中的包层级。一个点表示当前 package，两个点上升一层；解析依赖 __package__，现代实现通常由 __spec__.parent 初始化。',
      'python file.py 把文件作为 __main__ 直接执行，package 上下文通常为空；python -m pkg.file 先按导入系统找到 spec，再以 __main__ 执行，因此相对导入可用。入口设计应优先薄 __main__.py 或 console script。'
    ],
    mechanisms: [
      '绝对导入从顶层 sys.path 解析，不相对当前源文件。',
      '相对导入只允许 from 形式，level 来自点数。',
      '__name__ == "__main__" 与真实 spec.name 可以不同。',
      'runpy 与 -m 能保留包解析语义，同时提供入口身份。'
    ],
    pitfalls: [
      '把包内部文件直接运行，遇到 attempted relative import with no known parent package。',
      '通过修改 sys.path 修补入口，掩盖真实安装和包结构问题。',
      '模块既作库又在顶层执行大量 CLI 逻辑，导入测试时产生副作用。'
    ],
    example: `# 推荐目录：
# app/
#   __init__.py
#   __main__.py       -> from .cli import main; main()
#   cli.py            -> from .service import run
#   service.py
#
# 从项目安装环境执行：
#   python -m app
#
# 此时 __main__.__package__ == "app"，相对导入有稳定父包。

import importlib.util
spec = importlib.util.find_spec("xml.etree.ElementTree")
assert spec.name == "xml.etree.ElementTree"
assert spec.parent == "xml.etree"`,
    buildSteps: [
      { title: '打印执行身份', body: '分别 direct file 与 -m 运行，记录 __name__、__package__、__spec__、sys.path[0]。' },
      { title: '实现 resolve_name', body: '根据 package 片段与 level 裁剪父路径，覆盖越过顶层与空 package。' },
      { title: '重构入口', body: '业务逻辑放可导入模块，__main__.py 只解析参数并调用 main。' }
    ],
    selfCheckQuestion: '同一个文件用 python file.py 运行时相对导入失败，用 python -m pkg.file 却成功，根因是什么？',
    selfCheckAnswer: '直接执行只把文件命名为 __main__，通常没有包 spec/parent；-m 先通过 import machinery 找到 pkg.file 的 ModuleSpec，再以入口身份执行，__package__ 被设为 pkg。相对导入按模块身份解析，不按磁盘目录猜测。'
  },
  '循环导入、半初始化模块与依赖方向': {
    official: {
      title: 'The import system · Loading',
      url: 'https://docs.python.org/3/reference/import.html#loading',
      note: '模块执行前已进入 sys.modules；循环方会得到同一半初始化对象，只有此前执行过的名称可见。'
    },
    overview: [
      '循环导入的表现取决于时间线。A 预缓存并执行，导入 B；B 取得半初始化 A。import A 只需要对象身份可能成功，from A import later_name 则会在 A 尚未执行到绑定点时报错。',
      '局部 import 能延迟读取到调用期，偶尔是合理的可选依赖策略，但只移动环发生时间。根治方法通常是反转依赖、抽取共同合同、使用依赖注入或让注册发生在显式 bootstrap 阶段。'
    ],
    mechanisms: [
      '同线程递归导入依赖预插入避免死循环。',
      '父包 spec 记录 uninitialized_submodules，改善部分初始化诊断。',
      '模块顶层定义顺序影响环中可见属性。',
      '类型注解可用 TYPE_CHECKING、前向引用和延迟求值减少运行时环。'
    ],
    pitfalls: [
      '通过调整两行 import 顺序“修好”，下一次新增顶层副作用又复发。',
      '把所有 import 移入函数，隐藏架构双向依赖和冷路径延迟。',
      '在模块顶层读取对方注册表并立即派生常量，使初始化顺序成为隐式配置。'
    ],
    example: `# 用两个内存模块模拟时间线：
import sys
import types

a = types.ModuleType("a")
sys.modules["a"] = a
a.early = "ready"            # A 已执行到这里

b = types.ModuleType("b")
sys.modules["b"] = b
b.seen_a = sys.modules["a"]  # B 的 import a 成功
assert b.seen_a.early == "ready"
assert not hasattr(b.seen_a, "late")

a.late = "now-ready"         # A 恢复后才完成绑定
assert b.seen_a.late == "now-ready"

del sys.modules["a"], sys.modules["b"]`,
    buildSteps: [
      { title: '画执行时间线', body: '按预缓存、逐条绑定、进入对方模块、返回继续执行标记每个名字何时出现。' },
      { title: '区分身份与属性', body: '测试 import peer 与 from peer import value 在半初始化窗口的差异。' },
      { title: '消除方向环', body: '抽取 protocol/events 到第三模块，或由 composition root 在两边创建后完成连接。' }
    ],
    selfCheckQuestion: '为什么循环导入中 import peer 可能成功，from peer import name 却失败？',
    selfCheckAnswer: 'peer 模块对象已在执行前预插入 sys.modules，所以前者能取得同一对象；name 只有执行到相应赋值语句后才进入 peer.__dict__。循环路径在更早时刻访问该属性，就得到 partially initialized module 相关错误。'
  },
  'reload、from-import 快照与 monkey patch 可见性': {
    official: {
      title: 'importlib.reload',
      url: 'https://docs.python.org/3/library/importlib.html#importlib.reload',
      note: 'reload 重新执行模块代码并保留原模块字典；其他位置通过 from-import 或实例保存的引用不会自动重绑。'
    },
    overview: [
      'reload(module) 使用原 spec/loader 重新编译并执行代码，通常复用同一个模块对象和字典。新定义覆盖同名键，源码删除的旧键却可能继续残留，除非模块初始化显式清理。',
      '外部 from mod import C 保存的是当时对象引用；reload 后 mod.C 可能是新类，旧 C 与旧实例仍属于旧类。monkey patch 同样只影响后来通过被修改引用进行的查找，已复制或闭包捕获的对象不会追踪更新。'
    ],
    mechanisms: [
      'reload 不是清空进程状态，模块字典被保留以支持缓存惯例。',
      '外部模块 namespace 不会因 reload 自动重执行 from 语句。',
      '旧类实例的方法查找仍走旧 class object。',
      'C 扩展初始化和全局状态未必支持安全重复执行。'
    ],
    pitfalls: [
      '把 reload 当作生产热更新方案，形成同名多版本类与注册表。',
      '测试 monkey patch 定义处，却被测模块早已 from-import 复制依赖。',
      '源码删除变量后期待 reload 删除旧键。'
    ],
    example: `import importlib
import math

sqrt_snapshot = math.sqrt
original_module = math

math.sqrt = lambda value: "patched"
assert math.sqrt(9) == "patched"
assert sqrt_snapshot(9) == 3.0         # 已复制引用不跟随模块属性

importlib.reload(math)
assert math is original_module         # 模块身份通常复用
assert math.sqrt(9) == 3.0
assert sqrt_snapshot is not math.sqrt  # 外部快照仍是另一引用`,
    buildSteps: [
      { title: '画引用图', body: '分别标记 module.attr、from-import local、class instance、closure capture 指向哪个对象。' },
      { title: '做版本实验', body: '临时模块 v1/v2 reload 后比较模块、类、函数、实例身份与旧键残留。' },
      { title: '设计可替换依赖', body: '把 provider 作为参数或 registry 查询，避免不可控地 patch 被复制的全局引用。' }
    ],
    selfCheckQuestion: '为什么 reload 后旧实例通常不会变成新定义类的实例？',
    selfCheckAnswer: 'reload 在模块字典中把类名重绑到新 class object，但旧实例的 __class__ 仍指向旧 object，外部保存的旧类引用也不变。名称重绑不会遍历堆并重写所有已有引用，因此进程内会同时存在多个同名版本。'
  },
  'venv、site、sys.path 初始化与可重建环境': {
    official: {
      title: 'venv · How virtual environments work',
      url: 'https://docs.python.org/3/library/venv.html#how-venvs-work',
      note: 'venv 由 pyvenv.cfg 指向 base Python；sys.prefix 指向环境，sys.base_prefix 指向基础安装，激活主要修改 PATH。'
    },
    overview: [
      'venv 不是完整复制解释器。它用 pyvenv.cfg、环境解释器入口与独立 site-packages 在基础 Python 上建立隔离前缀；是否处于 venv 应比较 sys.prefix 与 sys.base_prefix，而非依赖可选的 VIRTUAL_ENV。',
      '解释器启动先构造核心 sys.path，再由 site 处理 site-packages、.pth 与 sitecustomize/usercustomize。激活脚本主要把环境 Scripts/bin 放到 PATH 前面；直接调用 .venv/Scripts/python 同样有效。',
      '脚本 shebang 与配置包含绝对路径，环境通常不可搬迁。可靠交付应保存锁定依赖、Python 版本与构建条件，随时删除并重建环境，而非归档整个 .venv。'
    ],
    mechanisms: [
      'pyvenv.cfg 的 home 指向 base 安装，include-system-site-packages 控制继承。',
      'sys.prefix/sys.exec_prefix 表示当前环境，base_* 表示基础解释器。',
      '.pth 文件可添加路径甚至执行 import 行，属于供应链审计面。',
      'PYTHONPATH、用户 site 与启动 flags 会改变隔离结果。'
    ],
    pitfalls: [
      '把 .venv 提交或复制到另一机器，绝对路径和二进制 ABI 失效。',
      '只看 shell prompt 判断环境，实际 python/pip 来自不同前缀。',
      '忽略 .pth/sitecustomize，排查 sys.path 污染时只看环境变量。'
    ],
    example: `import site
import sys

state = {
    "in_venv": sys.prefix != sys.base_prefix,
    "prefix": sys.prefix,
    "base_prefix": sys.base_prefix,
    "site_packages": site.getsitepackages(),
    "user_site_enabled": site.ENABLE_USER_SITE,
    "executable": sys.executable,
}

for key, value in state.items():
    print(f"{key}: {value}")

# 用 sys.executable -m pip 保证 pip 与当前解释器一致。`,
    buildSteps: [
      { title: '追踪路径来源', body: '打印 sys.path，每一项标注来自 executable、stdlib、PYTHONPATH、.pth、user site 或 venv site。' },
      { title: '验证工具一致性', body: '比较 sys.executable、python -m pip --version 与命令行 pip 所属前缀。' },
      { title: '做冷重建', body: '从空目录创建 venv、按锁文件安装、运行 smoke test，删除后重复以验证可重现。' }
    ],
    selfCheckQuestion: '为什么激活 venv 不是使用它的必要条件？',
    selfCheckAnswer: '激活主要修改 PATH 和提示符，让 python 命令解析到环境解释器；直接执行环境中的 python 路径同样会读取 pyvenv.cfg 并设置正确 prefix/site-packages。脚本的绝对 shebang 也可直接选择该解释器。'
  },
  'pyproject、build frontend/backend 与 wheel': {
    official: {
      title: 'PyPA · The Packaging Flow',
      url: 'https://packaging.python.org/en/latest/flow/',
      note: 'build frontend 读取 pyproject 的 build-system，在隔离环境调用声明的 backend hooks 生成 sdist/wheel；installer 选择兼容 wheel 并安装。'
    },
    overview: [
      'pyproject.toml 的 [build-system] 声明构建 backend 与构建依赖，[project] 提供标准核心元数据。pip/build 属于 frontend：创建隔离构建环境、安装 build-system.requires、调用 backend hook，而非假设项目必须使用 setuptools。',
      'sdist 是可重新构建的源码分发，wheel 是已构建安装归档。wheel 文件名标签描述 Python implementation、ABI 与 platform；纯 Python 常为 py3-none-any，含扩展的 wheel 只在匹配环境可安装。',
      '构建隔离解决“构建工具依赖污染用户环境”，却不自动保证可重复：动态版本、网络下载、未固定编译器和时间戳仍会改变产物。课程实践要检查 wheel 内容、METADATA、RECORD 与导入名/发行名差异。'
    ],
    mechanisms: [
      'frontend 调 get_requires_for_build_*、prepare_metadata_for_build_wheel、build_wheel 等 hooks。',
      'distribution name 用于索引安装，import package name 可以不同。',
      'wheel 安装主要解包文件并按 .data scheme 放置，同时验证 RECORD。',
      'src layout 减少在仓库根目录意外导入未安装源码的问题。'
    ],
    pitfalls: [
      '运行 python setup.py bdist_wheel，绕开标准 frontend 与隔离。',
      '只测试仓库根目录 import，发布 wheel 缺包仍未发现。',
      '把运行依赖放进 build-system.requires，或反过来遗漏构建插件。'
    ],
    example: `# pyproject.toml
[build-system]
requires = ["hatchling>=1.27"]
build-backend = "hatchling.build"

[project]
name = "review-lab-example"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = ["typing-extensions>=4.12"]

[tool.hatch.build.targets.wheel]
packages = ["src/review_lab_example"]

# 构建与验收：
# python -m build
# python -m zipfile -l dist/*.whl
# 在全新 venv 中 python -m pip install dist/*.whl，再从仓库外 import。`,
    buildSteps: [
      { title: '实现 mini frontend', body: '解析 build-system，创建隔离环境并通过 subprocess 调用 backend build_wheel，记录 hook 输入输出。' },
      { title: '审计 wheel', body: '把 wheel 当 zip 检查 package、dist-info/METADATA、WHEEL tags、RECORD 哈希。' },
      { title: '做安装态测试', body: '从空 venv、仓库目录之外安装 wheel，运行 import、CLI 和资源读取 smoke test。' }
    ],
    selfCheckQuestion: '为什么 pyproject.toml 中要区分 build frontend 与 build backend？',
    selfCheckAnswer: 'frontend 负责通用流程，如隔离环境、依赖安装、产物管理和用户界面；backend 负责项目如何从源码生成元数据与 wheel。协议分离让 pip/build 能驱动 setuptools、hatchling、flit 等实现，也让构建依赖不污染运行环境。'
  }
}
