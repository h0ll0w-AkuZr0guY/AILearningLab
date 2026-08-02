---
lesson: "python-04-05"
track: "python"
decision: "await 暂停、取消注入和 finally 清理是同一个状态机的不同出口，图能显示共同终点。"
---

## 视觉实验

### 异步资源

id: "python-04-05-mechanism"
kind: "state"
placement: "chapter:2"
summary: "观察异步资源从 acquire 到 aclose 视觉中的每个阶段都能回到正文、源码和断言验证，适用于本课而不是装饰性动画。"
caption: "视觉只表达 Python 3.14 / CPython v3.14.6 的教学模型；精确语义和性能结论回到官方章节、固定源码与示例断言。"
actionLabel: "推进异步资源"

#### 步骤

- 输入 | async with 的进入和退出都可 await；取消可能落在 await、yield 或 finally 中，aclose 必须把清理送回异步生成器。 的最小输入和初始状态。
- 模型 | 异步资源是 acquire await、使用 yield、release await 三阶段；取消也必须到达清理段，生产者不能无限快。 中的当前不变量和所有权。
- 主路径 | _AsyncGeneratorContextManager 在 enter/exit 驱动异步生成器，asyncgen hooks 和 aclose 负责终结，队列/信号量提供背压。 对照源码入口推进一次。
- 失败 | 吞掉 CancelledError、finally 再 yield、只关消费者不关生产者，会造成连接泄漏或取消后继续写入。 注入失败并记录传播或回滚。
- 边界 | 短资源用 asynccontextmanager，复杂流用显式 async iterator + aclose；取消只在边界转换为业务超时。 识别工程和版本取舍。

#### 观察重点

- 下一步前预测哪个量会改变、哪个不变量必须保持，再用示例正常断言核对。
- 指出视觉简化可能失真的平台、并发、资源或版本边界，回到源码和官方文档验证。
