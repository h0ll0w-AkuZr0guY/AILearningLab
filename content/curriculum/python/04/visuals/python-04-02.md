---
lesson: "python-04-02"
track: "python"
decision: "context 链与 ExceptionGroup 树的拓扑不同，图实验能让 except* 的拆分和合并可见。"
---

## 视觉实验

### 异常树

id: "python-04-02-mechanism"
kind: "graph"
placement: "chapter:2"
summary: "沿异常因果链和异常组子树分流 视觉中的每个阶段都能回到正文、源码和断言验证，适用于本课而不是装饰性动画。"
caption: "视觉只表达 Python 3.14 / CPython v3.14.6 的教学模型；精确语义和性能结论回到官方章节、固定源码与示例断言。"
actionLabel: "推进异常树"

#### 步骤

- 输入 | 隐式 context 记录处理期间的新异常，raise from 设置 cause，ExceptionGroup 保存多个独立失败。 的最小输入和初始状态。
- 模型 | 异常可以是因果链，也可以是可拆分的异常树；cause、context 和 suppress 是诊断元数据。 中的当前不变量和所有权。
- 主路径 | 异常对象保存 cause、context、traceback 和 group children；except* 匹配子树后重新合并未处理部分。 对照源码入口推进一次。
- 失败 | raise from None 丢根因、except* 假定顺序或把 ExceptionGroup 当 list 逐个 pop，会丢失失败证据。 注入失败并记录传播或回滚。
- 边界 | 单一错误用显式 cause，批量任务用 ExceptionGroup；日志保留树结构，不只取第一个异常。 识别工程和版本取舍。

#### 观察重点

- 下一步前预测哪个量会改变、哪个不变量必须保持，再用示例正常断言核对。
- 指出视觉简化可能失真的平台、并发、资源或版本边界，回到源码和官方文档验证。
