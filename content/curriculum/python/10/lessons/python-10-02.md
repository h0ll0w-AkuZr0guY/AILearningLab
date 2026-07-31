---
id: "python-10-02"
track: "python"
title: "tokenizer：编码、缩进与 token 流"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-10-02.md"
---

## 官方入口

title: "Python Language Reference · Lexical analysis"
url: "https://docs.python.org/3/reference/lexical_analysis.html"

词法规则定义编码、物理行与逻辑行、缩进、标识符、字面量和操作符；实现细节位于 Parser/tokenizer 与 Parser/lexer。

## 真实源码

repo: "python/cpython"
file: "Parser/tokenizer/file_tokenizer.c · Parser/lexer/lexer.c"
symbol: "_PyTokenizer_Get"
language: "c"
url: "https://github.com/python/cpython/blob/main/Parser/lexer/lexer.c"

### 逐段讲解

- 文件读取层先处理 BOM、coding cookie、通用换行和 UTF-8 验证，再把字节缓冲交给 lexer；源码位置仍要维护行号和 UTF-8 字节偏移。
- lexer 用 tok_state 保存 cur/inp/end、括号层级、缩进栈和 f-string 模式栈。INDENT/DEDENT 是比较当前行首列数和栈顶后合成的 token，源码里没有对应字符。
- 括号内部换行、反斜杠续行和交互式输入会改变 NEWLINE/ENDMARKER 的产生；词法器因此是带上下文状态机，无法简化成一次正则扫描。

### 源码节选

```c
/* 教学化摘录：真实实现还处理 tab/空格歧义和错误位置 */
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
return lex_regular_token(tok);
```

## 导读

tokenizer 的职责不是理解“这是一条 if 语句”，而是把字符流切成带类型与位置的 token 流，例如 NAME、NUMBER、COLON、NEWLINE、INDENT。parser 之后只和 token 打交道，于是编码错误、tab 混用、字符串未闭合等问题可以在更靠前的阶段给出精确诊断。

Python 的缩进具有语法意义，却不存在花括号字符。词法器维护一个严格递增的缩进列栈。新逻辑行的列数大于栈顶时发出 INDENT；小于栈顶时持续弹栈并发出一个或多个 DEDENT；若列数不等于任何历史层级则报错。括号内的视觉缩进不参与这套栈，因为括号开启了隐式续行。

编码也是词法语义的一部分。文件层在最初两行探测 BOM 和 coding cookie，规范化换行并验证 UTF-8。位置字段通常以 UTF-8 字节偏移表达，这解释了含中文源码时 col_offset 与用户眼中的字符列数可能不同。

## 核心机制

- 物理行来自输入设备，逻辑行可由括号、反斜杠或多行字符串跨越多个物理行。
- paren level 大于零时，普通换行通常不产生终结语句的 NEWLINE。
- pending INDENT/DEDENT 允许一次扫描状态变化在后续调用中逐个返回 token。
- soft keyword 先保持 NAME，交给 parser 在特定语法位置解释，避免全局保留字破坏兼容性。
- f-string 需要独立模式栈，因为文本区、表达式区、格式说明区具有不同的转义和括号规则。

## 常见误区

- 用 split 或一个大正则实现 Python tokenizer，遗漏字符串、注释、续行和 f-string 状态。
- 把可见空格数量当作缩进列，忽略 tab 展开和 TabError。
- 把 AST 的字符位置直接当作 Python 字符串索引，遇到非 ASCII 源码切片错误。

## 可运行示例

```python
import io
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
# 缩进块开始/结束由 INDENT、DEDENT 表示。
```

## 搭积木复现

### 先做可视化扫描器

使用标准库 tokenize 打印 type/string/start/end/line，建立输入到 token 的金标准。

### 复现缩进栈

只支持 NAME、冒号、换行和空格，先让嵌套块正确产生 INDENT/DEDENT，再加入空行与注释。

### 加入逻辑行

维护括号层级，使括号内换行不终止语句；再处理反斜杠和 EOF 隐式换行。

### 差分测试

把自制 token 类型序列与 tokenize 对比，覆盖中文标识符、tab 混用、空文件、未闭合字符串和嵌套 f-string。

## 自检

### 问题

为什么 INDENT/DEDENT 更适合由 tokenizer 产生，而不是让 parser 直接数空格？

### 站内答案

缩进依赖物理行、tab 展开、括号层级、空行、注释和续行，这些都是词法器已经维护的字符级状态。将其压缩为 INDENT/DEDENT 后，语法规则可以像处理花括号一样处理 block，不必在每条 compound statement 里重复字符扫描逻辑，同时错误位置也更集中。
