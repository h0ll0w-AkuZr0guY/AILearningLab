---
lesson: "python-08-03"
track: "python"
decision: "名称分类如何改变跳转和异常表，图实验能同时显示 scope 节点与生成产物。"
---

## 视觉实验

### 编译图

id: "python-08-03-mechanism"
kind: "graph"
placement: "chapter:2"
summary: "沿 scope、basic block 与 code object 生成边 视觉中的每个阶段都能回到正文、源码和断言验证，适用于本课而不是装饰性动画。"
caption: "视觉只表达 Python 3.14 / CPython v3.14.6 的教学模型；精确语义和性能结论回到官方章节、固定源码与示例断言。"
actionLabel: "推进编译图"

#### 步骤

- 输入 | symbol table 先分类 local/free/cell，编译器再建 basic block、修补跳转并生成 code object 与异常表。 的最小输入和初始状态。
- 模型 | 编译分名称分析、CFG、指令发射、跳转修补、code object 五阶段；自由变量必须有 cell/closure。 中的当前不变量和所有权。
- 主路径 | compiler_mod 递归编译 AST，管理 compiler_unit、basicblock 和 scope，组装 code、常量、名字和 exception table。 对照源码入口推进一次。
- 失败 | 把局部变量当字典、只看 dis 不看 scope、忽略 cell 或异常表，会解释错指令。 注入失败并记录传播或回滚。
- 边界 | 依赖 compile/ast/symtable/dis 公共观察面；改动前写 AST、scope 和反汇编回归。 识别工程和版本取舍。

#### 观察重点

- 下一步前预测哪个量会改变、哪个不变量必须保持，再用示例正常断言核对。
- 指出视觉简化可能失真的平台、并发、资源或版本边界，回到源码和官方文档验证。
