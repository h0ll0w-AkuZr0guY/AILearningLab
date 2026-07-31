---
id: "python-10-03"
track: "python"
title: "PEG parser：回溯、memo、cut 与错误规则"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-10-03.md"
---

## 官方入口

title: "InternalDocs · Parser"
url: "https://github.com/python/cpython/blob/main/InternalDocs/parser.md"

CPython 使用 PEG parser generator；Grammar/python.gram 同时包含语法规则和构造 AST 的 C action。

## 真实源码

repo: "python/cpython"
file: "Grammar/python.gram · Parser/pegen.c"
symbol: "_PyPegen_is_memoized"
language: "c"
url: "https://github.com/python/cpython/blob/main/Parser/pegen.c"

### 逐段讲解

- PEG 的 choice 按书写顺序尝试，第一个成功分支获胜。失败分支把 mark 回退，因此规则顺序本身就是语言行为。
- memo 以“token 起点 + rule 类型”为键，缓存成功节点、失败结果和结束 mark；相同子问题不必因回溯重复解析，这就是 packrat 思路。
- cut 在已经识别出决定性前缀后禁止回退到同级备选，既减少搜索又改善错误；invalid_* 规则只在普通解析失败后的第二遍启用，用于生成更具体的 SyntaxError。

### 源码节选

```c
int
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
}
```

## 导读

PEG 把语法看作对 token 序列的识别表达式。与传统 CFG parser 的“多个产生式都可能成立”不同，有序选择 A | B 在 A 成功后不会再考虑 B。因此把更宽泛的规则放在前面，可能悄悄吞掉后面更精确的分支。阅读 python.gram 时，顺序、lookahead 和 cut 都必须当作控制流。

允许回溯会带来重复工作：同一个 token 位置的同一规则可能被许多上层分支反复调用。Pegen 把结果和消费到的位置挂在起始 token 的 memo 链上，命中后同时恢复 node 与 mark。左递归则需要种子结果逐步增长，直到无法消费更多 token，不能用普通递归直接展开。

错误质量与接受正确程序同等重要。普通规则优先保证语法定义清晰；若第一次失败，解析器可开启 invalid_* 规则再跑一遍，以识别“参数默认值顺序错误”等常见非法形态。cut 表示已经越过承诺点，后续失败应在当前结构内报告，避免回退后得到毫无关系的错误。

## 核心机制

- &e 和 !e 分别做正/负 lookahead，只检查而不消费 token。
- ~ cut 提交当前 alternative；它会影响接受路径和错误位置，应谨慎放置。
- &&e eager parse 在失败时立即抛 SyntaxError，适合语法必须出现的部分。
- grammar action 用捕获值和 EXTRA 宏构造带范围的 AST 节点。
- soft keyword 用双引号表示，只在该语法上下文匹配；普通 keyword 用单引号。

## 常见误区

- 把 PEG 的 | 当作无序集合，忽略前一分支对后一分支的遮蔽。
- 给所有规则无脑 memo，忽略缓存本身的内存和维护成本。
- 修改生成的 parser C 文件而非 Grammar/python.gram，重新生成后改动消失。

## 可运行示例

```python
# 教学版有序选择解析器：assignment 必须放在 name 前
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
assert statement(["x", "=", "1"], 0)[0] == ("assign", "x", "1")
```

## 搭积木复现

### 实现 mark 回退

每条 rule 接收 token index，失败返回 None 且不改变调用者位置；ordered choice 依次从同一 mark 尝试。

### 加入 memo

用 (rule_id, mark) 缓存 (node, end_mark)，同时缓存失败，统计规则真实执行次数。

### 加入 cut

让结果携带 committed 状态；cut 之后的失败直接向上传播，并为错误记录最远位置和期望 token。

### 对照 grammar

挑选 assignment 或 pattern matching 的一条真实规则，标出捕获、lookahead、cut、action 与 invalid 分支。

## 自检

### 问题

memoization 为什么不仅缓存 AST 节点，还必须缓存结束 mark，甚至缓存失败？

### 站内答案

parser 的结果同时包含“得到什么”和“消费到哪里”。只复用节点却不恢复结束位置会让上层从错误 token 继续；不缓存失败则每次回溯仍会重复证明同一规则在同一起点不能成立，最坏复杂度没有被消除。
