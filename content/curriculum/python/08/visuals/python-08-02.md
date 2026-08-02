---
lesson: "python-08-02"
track: "python"
decision: "错误发生在哪一层需要流程分支才能看清，静态段落容易把 token 错误误认成 AST 错误。"
---

## 视觉实验

### 前端管线

id: "python-08-02-mechanism"
kind: "flow"
placement: "chapter:2"
summary: "让文本经过 token、PEG、AST 与错误位置 视觉中的每个阶段都能回到正文、源码和断言验证，适用于本课而不是装饰性动画。"
caption: "视觉只表达 Python 3.14 / CPython v3.14.6 的教学模型；精确语义和性能结论回到官方章节、固定源码与示例断言。"
actionLabel: "推进前端管线"

#### 步骤

- 输入 | tokenizer 处理字符、缩进和 token，PEG parser 按规则建树，AST 由 schema 约束；SyntaxError 位置是用户诊断合同。 的最小输入和初始状态。
- 模型 | 前端分字符流、token 流、语法树、AST 四层；错误尽早报告，AST 字段符合目标版本 schema。 中的当前不变量和所有权。
- 主路径 | parse_string_raw 驱动 pegen parser，成功转换 AST，失败保存 token 位置和 expected tokens。 对照源码入口推进一次。
- 失败 | 把 AST 当 CST、依赖旧节点字段、忽略 tab/space 和 error offset，会让工具升级后崩溃。 注入失败并记录传播或回滚。
- 边界 | 格式化和分析用 ast/tokenize 公共 API；内部调试固定 tag、保留最小源码和错误位置。 识别工程和版本取舍。

#### 观察重点

- 下一步前预测哪个量会改变、哪个不变量必须保持，再用示例正常断言核对。
- 指出视觉简化可能失真的平台、并发、资源或版本边界，回到源码和官方文档验证。
