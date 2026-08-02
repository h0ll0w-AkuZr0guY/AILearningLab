---
lesson: "python-05-05"
track: "python"
decision: "行为兼容和数据键约束同时出现时，图实验比单段注释更能看清替换条件。"
---

## 视觉实验

### 结构契约

id: "python-05-05-mechanism"
kind: "graph"
placement: "chapter:2"
summary: "沿行为、schema 与类型收窄的证据边 视觉中的每个阶段都能回到正文、源码和断言验证，适用于本课而不是装饰性动画。"
caption: "视觉只表达 Python 3.14 / CPython v3.14.6 的教学模型；精确语义和性能结论回到官方章节、固定源码与示例断言。"
actionLabel: "推进结构契约"

#### 步骤

- 输入 | Protocol 用结构描述行为，TypedDict 描述字典键，variance 和 TypeIs 限制 checker 能否安全收窄。 的最小输入和初始状态。
- 模型 | API 契约分行为结构、数据结构、读写方差和控制流收窄；可变容器不能凭只读关系任意协变。 中的当前不变量和所有权。
- 主路径 | typing.Protocol 创建协议元数据，TypedDict 记录 required/optional，checker 根据 TypeVar/TypeIs 推导分支。 对照源码入口推进一次。
- 失败 | isinstance 不代表静态兼容，list 协变会破坏写安全，错误 TypeIs 会放行错误分支。 注入失败并记录传播或回滚。
- 边界 | 只读输入用协变接口；TypedDict 适合 schema，Protocol 适合行为；CI 固定 checker 版本。 识别工程和版本取舍。

#### 观察重点

- 下一步前预测哪个量会改变、哪个不变量必须保持，再用示例正常断言核对。
- 指出视觉简化可能失真的平台、并发、资源或版本边界，回到源码和官方文档验证。
