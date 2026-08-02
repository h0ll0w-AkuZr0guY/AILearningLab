---
lesson: "python-03-05"
track: "python"
decision: "多层生成器的异常回送和返回值靠流程节点才能避免把代理误解为普通循环。"
---

## 视觉实验

### 委派通道

id: "python-03-05-mechanism"
kind: "flow"
placement: "chapter:2"
summary: "看见 send、throw、close 穿过委派层 视觉中的每个阶段都能回到正文、源码和断言验证，适用于本课而不是装饰性动画。"
caption: "视觉只表达 Python 3.14 / CPython v3.14.6 的教学模型；精确语义和性能结论回到官方章节、固定源码与示例断言。"
actionLabel: "推进委派通道"

#### 步骤

- 输入 | yield from 会转交 next、send、throw、close，并把子生成器的 StopIteration.value 变成外层结果。 的最小输入和初始状态。
- 模型 | 委派是协议代理，contextmanager 是一次 yield 两侧的 enter/exit 合同；成功和异常都必须经过清理段。 中的当前不变量和所有权。
- 主路径 | YIELD_FROM 转交控制权，_GeneratorContextManager 在 enter 取一次 yield，在 exit 将异常 throw 回生成器。 对照源码入口推进一次。
- 失败 | 子迭代器缺少 throw/close、contextmanager 多次复用同一生成器或错误返回 True，都隐藏故障。 注入失败并记录传播或回滚。
- 边界 | 短资源用 contextmanager，复杂并发或所有权转移用类式管理器或 ExitStack。 识别工程和版本取舍。

#### 观察重点

- 下一步前预测哪个量会改变、哪个不变量必须保持，再用示例正常断言核对。
- 指出视觉简化可能失真的平台、并发、资源或版本边界，回到源码和官方文档验证。
