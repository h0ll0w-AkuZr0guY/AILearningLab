---
lesson: "python-05-04"
track: "python"
decision: "同一注解在不同读取格式下如何变化，参数化 playground 能直接显示求值与字符串边界。"
---

## 视觉实验

### 注解格式

id: "python-05-04-mechanism"
kind: "playground"
placement: "chapter:2"
summary: "切换 VALUE、FORWARDREF、STRING 格式 视觉中的每个阶段都能回到正文、源码和断言验证，适用于本课而不是装饰性动画。"
caption: "视觉只表达 Python 3.14 / CPython v3.14.6 的教学模型；精确语义和性能结论回到官方章节、固定源码与示例断言。"
actionLabel: "推进注解格式"

#### 步骤

- 输入 | Python 3.14 默认延迟求值注解，annotationlib 提供 VALUE、FORWARDREF、STRING；TypeVar/ParamSpec 是静态信息，不自动做运行时校验。 的最小输入和初始状态。
- 模型 | 注解分成存储、求值、格式和 checker 推断四层；访问者要明确选择格式，未解析前向引用不能假装是真类型。 中的当前不变量和所有权。
- 主路径 | get_annotations 根据格式选择 __annotations__ 或 __annotate__，必要时解析 ForwardRef；TypeVar/ParamSpec 由 typing 构造替换关系。 对照源码入口推进一次。
- 失败 | 导入期直接读未定义名、eval 不可信注解、把 ParamSpec 当运行时参数对象，都会产生 NameError 或安全风险。 注入失败并记录传播或回滚。
- 边界 | 运行时 introspection 用 annotationlib/inspect，静态 API 用 TypeVar/ParamSpec；校验需另用 validator。 识别工程和版本取舍。

#### 观察重点

- 下一步前预测哪个量会改变、哪个不变量必须保持，再用示例正常断言核对。
- 指出视觉简化可能失真的平台、并发、资源或版本边界，回到源码和官方文档验证。
