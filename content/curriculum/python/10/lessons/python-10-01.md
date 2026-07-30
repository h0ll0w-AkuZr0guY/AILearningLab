---
id: "python-10-01"
track: "python"
title: "仓库地图、pydebug 构建与测试定位"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "Python Developer’s Guide · Setup and building"
url: "https://devguide.python.org/getting-started/setup-building/"

开发者指南要求源码开发优先使用 pydebug 构建；它会打开额外断言和一致性检查，性能测量则应换回 release 构建。

## 真实源码

repo: "python/cpython"
file: "README.rst · Makefile.pre.in · PCbuild/build.bat"
symbol: "CPython development build"
language: "bash"
url: "https://github.com/python/cpython"

### 逐段讲解

- Grammar 描述语言语法，Parser 把源码转成 AST，Python 放编译器和解释器核心，Objects 实现内建对象，Include 暴露公开或内部 C 头文件。
- pydebug 构建打开 Py_DEBUG 及大量 assert，能更早暴露引用所有权、对象状态和解释器不变量错误；它的时序不能代表发布版性能。
- 修改 C 文件后必须重新编译；修改 Lib 下纯 Python 文件通常可由工作树中的解释器直接加载。测试先跑最窄用例，再扩大到相关测试文件和完整 test suite。

### 源码节选

```bash
# Unix / WSL：源码树内构建，不需要安装到系统
git clone https://github.com/python/cpython.git
cd cpython
./configure --with-pydebug
make -j4
./python -m test test_compile -v

# Windows：先由脚本拉取依赖并建立 Debug x64
PCbuild\build.bat -c Debug -p x64
PCbuild\amd64\python_d.exe -m test test_compile -v
```

## 导读

阅读大型源码的第一步是建立“问题到目录”的映射。语法接受不接受，先看 Grammar/python.gram 与 Parser；名称为什么被判成 free variable，看 Python/symtable.c；某个语句发出什么指令，看 Python/codegen.c；指令怎样执行，看 Python/bytecodes.c 及生成的 cases；list、dict、function 等对象行为则从 Objects 进入。

源码树中的不少 C 文件是生成产物或依赖生成产物。直接改 generated_cases.c.h 往往会在下一次 regeneration 时丢失，正确入口可能是 Python/bytecodes.c 和 Tools/cases_generator。学习时要区分“设计源文件、生成器、生成结果”，这也是大型编译器项目常见的维护边界。

源码阅读必须有可观察闭环：找到入口，写最小 Python 样例，使用 ast/dis/symtable 观察中间结果，在 Debug 构建下设置断点，修改一处行为，跑最窄测试。只在网页上浏览函数名很容易形成虚假的理解感。

## 核心机制

- Programs/python.c 提供可执行程序入口，初始化和命令行主流程继续进入 Modules/main.c 与 Python/pylifecycle.c。
- Include/cpython 与 Include/internal 的兼容承诺不同；后者是解释器内部接口，不应被普通扩展依赖。
- Lib/test 既是回归保护，也是最精确的行为合同；搜索错误消息和公开 API 名称常比从根目录顺读更快。
- Tools/scripts、Argument Clinic、PEG generator、cases generator 会生成重复而易错的样板代码。
- Debug、ASAN、UBSAN、refleak、GDB/lldb 分别回答不同问题，不应拿单一工具替代完整证据链。

## 常见误区

- 在系统 python 上运行测试，误以为验证了刚编译的解释器。
- 直接修改自动生成文件，却没有找到生成源和 regeneration 命令。
- 一次运行整个测试套件后才定位问题，反馈周期过长且日志噪声巨大。

## 可运行示例

```python
from pathlib import Path

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
    print(f"{question:8} -> {path}")
```

## 搭积木复现

### 固定研究版本

记录 commit SHA 与分支。课程链接指向 main 便于阅读，实验报告必须注明实际版本，因为解释器内部布局会快速变化。

### 建立 Debug 闭环

编译 pydebug，确认执行的是源码树里的 ./python 或 python_d.exe，并跑一个最窄测试。

### 从行为反查入口

先写十行以内的复现，再用 rg 搜错误文本、测试名、opcode 或 C API 符号；沿调用者向内收缩。

### 记录生成边界

为每个修改点写下设计源、生成命令、生成产物与对应测试，避免在派生文件上累积补丁。

## 自检

### 问题

为什么 CPython 开发推荐 pydebug，而性能基准又不能使用它？

### 站内答案

pydebug 用额外断言、引用和对象一致性检查换取更早、更明确的失败，适合证明修改没有破坏内部不变量；这些检查本身增加开销并改变代码布局与时序，所以它不能代表用户运行的 release 构建。正确流程是 Debug 找错、Release 测性能，并确保两者运行相同语义测试。
