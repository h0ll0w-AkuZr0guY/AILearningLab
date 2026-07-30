---
id: "python-10-04"
track: "python"
title: "ASDL、AST 节点与源码位置"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "Python Library Reference · ast"
url: "https://docs.python.org/3/library/ast.html"

抽象语法树公开了编译器语法结构；具体节点由 Parser/Python.asdl 描述并生成 C/Python 表示。

## 真实源码

repo: "python/cpython"
file: "Parser/Python.asdl · Python/Python-ast.c"
symbol: "_PyAST_*"
language: "c"
url: "https://github.com/python/cpython/blob/main/Parser/Python.asdl"

### 逐段讲解

- ASDL 用 sum type 描述 stmt、expr 等联合类型，用 product 字段描述每种节点携带的孩子和属性；星号字段代表序列，问号代表可选。
- 生成器把 schema 转为 C enum/union、构造函数、visitor 支持和 Python ast 类，减少手写节点布局与遍历样板。
- AST 对象通常由 arena 批量管理；源码位置从 grammar action 传入，lineno 为 1 基，col_offset/end_col_offset 是 UTF-8 字节偏移。

### 源码节选

```c
-- Parser/Python.asdl 的教学摘录
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
node->v.BinOp.right = right;
```

## 导读

parse tree 会保留大量标点和语法推导细节，后续编译并不需要知道某对括号来自哪条产生式。AST 把这些表面差异折叠成语义节点。例如 a + (b) 和 a + b 都可成为 BinOp(Name, Add, Name)，让符号分析与代码生成围绕稳定结构工作。

ASDL 是 AST 的“数据模型源码”。它像一份代数数据类型声明：expr 可以是 BinOp、Call、Name 等分支，每一支拥有固定字段。生成 C 布局的好处在于 schema、构造器、Python 暴露类型和遍历信息保持一致；代价是修改后必须重新生成并更新所有 pattern matching/visitor。

位置并非装饰信息。SyntaxError、traceback、coverage、debugger、source segment、格式化和 IDE 都依赖它。Python 将列偏移定义为 UTF-8 字节偏移，使 parser C 层可以直接关联编码后的源码缓冲；在 Python 字符串上切片前需要转换。

## 核心机制

- stmt*、expr* 在 C 层通常映射为 asdl_seq，并由 arena 持有。
- ctx 区分 Name/Attribute/Subscript 被 Load、Store 或 Del，后续决定读写 opcode。
- ast.Load 等 singleton operator 节点复用对象，修改它可能影响同一树的其他位置。
- ast.fix_missing_locations 只能从父节点补近似位置，无法恢复真实 token 边界。
- compile(ast_obj, ...) 会先验证字段和上下文，不是任意拼装节点都能进入 codegen。

## 常见误区

- 用 ast.dump 看见结构后便忽略 Load/Store、keyword、type_ignores 和位置属性。
- NodeTransformer 返回新节点却不复制位置，导致报错、coverage 或 unparse 行为异常。
- 把具体 AST 布局当成跨版本稳定序列化协议。

## 可运行示例

```python
import ast

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
code = compile(ast.fix_missing_locations(tree), "<lesson>", "exec")
```

## 搭积木复现

### 画出 sum/product

选 Name、BinOp、Call 三种 expr，手写 tagged union，并说明 kind 与 union 字段必须同步。

### 实现小型 arena

把本轮 parse 的节点集中登记，成功或失败后统一释放；理解为何 AST 构造路径偏好区域生命周期。

### 做 round-trip

parse → dump → transform → fix location → compile → exec，验证语义和位置信息。

### 制造验证失败

将赋值目标 ctx 改成 Load 或遗漏必填字段，记录 compile 的失败层与错误信息。

## 自检

### 问题

为什么 CPython 不直接让编译器在完整 parse tree 上生成字节码？

### 站内答案

parse tree 含有为识别语法服务的标点和中间产生式，结构随 grammar 重写剧烈变化。AST 把多种表面写法归一成较稳定的语义节点，减少符号分析与 codegen 的分支，同时为工具提供可用接口。代价是必须精确保存上下文和源码位置，并维护 parse action 到 AST 的转换。
