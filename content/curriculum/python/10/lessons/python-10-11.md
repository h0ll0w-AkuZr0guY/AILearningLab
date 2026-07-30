---
id: "python-10-11"
track: "python"
title: "端到端源码改造：新增可观测优化并回归"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "Python Developer’s Guide · Development workflow"
url: "https://devguide.python.org/getting-started/fixing-issues/"

可合并的解释器修改需要问题定义、最小补丁、NEWS/文档判断、针对性测试、生成文件更新以及完整回归，而非只在本机样例成功。

## 真实源码

repo: "python/cpython"
file: "Python/bytecodes.c · Tools/cases_generator · Lib/test/test_dis.py"
symbol: "generated instruction workflow"
language: "c"
url: "https://github.com/python/cpython/blob/main/Python/bytecodes.c"

### 逐段讲解

- 项目选择“可观测而低风险”的教学改造：为 mini VM 加入专门化统计，或在个人 CPython 分支给现有内部路径增加受控诊断。不要凭课程直接发明公共语法或改变稳定行为。
- 先固定基线：语义测试、dis/统计快照和 release benchmark。修改设计源文件后运行对应 regeneration，检查生成 diff 只包含预期变化。
- 验证分三层：最小行为与失败测试、相关 stdlib 测试、完整 test suite；性能声明还要用 release/PGO 合理配置、多次运行和真实 workload。

### 源码节选

```c
# 一个可审计实验单，而非“改完能跑”的截图
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
}
```

## 导读

“能读源码”最终要表现为能在不破坏边界的情况下改变源码。完整任务从假设开始：哪条路径为什么慢或难以观测，哪些输入会受益，哪些可观察语义必须保持。没有这个合同，新增 opcode、cache 或语法很容易成为只对一段 demo 有效的复杂化。

推荐第一项真实改造选择内部诊断、错误信息、测试覆盖或现有优化的小修，而不是立刻新增语言语法。语法变化横跨 grammar、AST、symtable、codegen、解释器、ast/unparse、文档、工具与兼容政策；它适合作为架构地图练习，却未必是合理上游贡献。成熟工程师会同时评估“可以实现”和“值得维护”。

回归报告应能让另一位开发者复现：版本 SHA、构建参数、生成命令、测试选择、平台、基线/变体原始数据、失败样例和未覆盖风险。性能提升若只出现在 pydebug、一次计时或特制输入中，证据不足；功能补丁若没有负路径与重入测试，同样不足。

## 核心机制

- 行为合同先枚举正常、边界、异常、动态修改和重入路径，再决定实现。
- generated file diff 应由官方工具产生并与设计源一起提交。
- reference ownership 每个分支都要标注 new/borrowed/stolen，并测试错误清理。
- 性能补丁要区分 warmup、steady state、code size、memory、冷启动和多态退化。
- bisectable 小提交让失败可定位；同时修改十个层次会让审查失去证据。

## 常见误区

- 只写 happy path，在 descriptor、异常、subclass 或 mutation 下改变语义。
- 在 pydebug 上宣称性能收益，或只展示最小值而无方差与 workload。
- 把新增复杂度藏进生成代码，没有设计说明、失效策略和维护成本评估。

## 可运行示例

```python
# 用 Python 层先建立语义 oracle，再进入 C 源码
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
assert after_mutation == 7
```

## 搭积木复现

### 写一页设计合同

明确目标、非目标、语言语义、不变量、受益 workload、退化 workload、版本范围和回滚方式。

### 建立黑盒 oracle

在未修改解释器上保存所有正常与失败结果；加入 descriptor、重入、动态 mutation、subclass 和异常路径。

### 沿生成链实现

只改设计源，运行官方 regeneration，审查生成 diff；C 路径逐分支配平引用并在 pydebug/ASAN 下运行。

### 做分层验收

先目标测试，再相关模块，最后完整 suite；release 构建运行统计严谨的 benchmark，并报告无收益/退化情形。

### 完成架构复盘

画出本次改动穿过的 token/AST/symtable/CFG/code/frame 层，解释哪些层完全无需修改以及为什么。

## 自检

### 问题

为什么“新增一条 Python 语法并成功执行”仍不足以证明源码改造完成？

### 站内答案

语言特性还要覆盖错误诊断、AST 公开结构、名称作用域、字节码栈效果、异常和调试位置、unparse/工具、文档、版本兼容与完整回归；生成文件也必须来自正确设计源。一次 happy-path 执行只证明穿过了一条路径，无法证明其余实现不变量与生态合同。
