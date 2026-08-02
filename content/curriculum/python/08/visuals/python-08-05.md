---
lesson: "python-08-05"
track: "python"
decision: "参数改变类型分布后，generic、specialized、deopt 三种状态必须即时可见。"
---

## 视觉实验

### 自适应状态

id: "python-08-05-mechanism"
kind: "playground"
placement: "chapter:2"
summary: "切换类型稳定性观察 specialization 与 deopt 视觉中的每个阶段都能回到正文、源码和断言验证，适用于本课而不是装饰性动画。"
caption: "视觉只表达 Python 3.14 / CPython v3.14.6 的教学模型；精确语义和性能结论回到官方章节、固定源码与示例断言。"
actionLabel: "推进自适应状态"

#### 步骤

- 输入 | 热身收集类型信息并写入 inline cache，guard 失败回通用路径；cache 不是正确性来源。 的最小输入和初始状态。
- 模型 | 优化状态为 generic、warm、specialized、deoptimized 四态；guard 失败必须语义等价回退。 中的当前不变量和所有权。
- 主路径 | _Py_Specialize_LoadAttr 根据 type version/tag 选择入口，缓存记录 guard，失效时清理或降级。 对照源码入口推进一次。
- 失败 | 一次运行下结论、把 specialized opcode 当固定字节码、修改类后忽略 version tag，都会误判。 注入失败并记录传播或回滚。
- 边界 | 用 dis(adaptive=True, show_caches=True) 观察，再比较热身和稳定段；类型多变时监控 deopt。 识别工程和版本取舍。

#### 观察重点

- 下一步前预测哪个量会改变、哪个不变量必须保持，再用示例正常断言核对。
- 指出视觉简化可能失真的平台、并发、资源或版本边界，回到源码和官方文档验证。
