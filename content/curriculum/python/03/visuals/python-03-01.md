---
lesson: "python-03-01"
track: "python"
decision: "共享 globals、隔离 locals 与暂停 frame 难以同时追踪，流图把定义、绑定、执行、返回放在同一条线上。"
---

## 视觉实验

### 函数环境

id: "python-03-01-mechanism"
kind: "flow"
placement: "chapter:2"
summary: "追踪函数从定义到返回的两层环境 视觉中的每个阶段都能回到正文、源码和断言验证，适用于本课而不是装饰性动画。"
caption: "视觉只表达 Python 3.14 / CPython v3.14.6 的教学模型；精确语义和性能结论回到官方章节、固定源码与示例断言。"
actionLabel: "推进函数环境"

#### 步骤

- 输入 | 函数定义保存 code、globals 和 defaults，调用才创建隔离的 frame 与 locals。 的最小输入和初始状态。
- 模型 | 函数是 code 加定义环境的对象；每次调用是新的 frame，defaults 在定义期固定而局部槽在调用期隔离。 中的当前不变量和所有权。
- 主路径 | 参数绑定后 frame 取得指令并运行到 return 或异常；inspect、dis 和 sys._getframe 只能观察公开部分。 对照源码入口推进一次。
- 失败 | 不要把 f_locals 写回当作可靠赋值，也不要把 code object 当作完整闭包；递归、生成器和 tracing 会改变 frame 的观察时机。 注入失败并记录传播或回滚。
- 边界 | 显式上下文参数更易测试；tracing 能取证但有额外开销，globals 共享状态要写清责任。 识别工程和版本取舍。

#### 观察重点

- 下一步前预测哪个量会改变、哪个不变量必须保持，再用示例正常断言核对。
- 指出视觉简化可能失真的平台、并发、资源或版本边界，回到源码和官方文档验证。
