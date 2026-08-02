---
lesson: "python-04-04"
track: "python"
decision: "coroutine、Future 和 async iterator 谁驱动谁，流程视觉能把暂停、完成和异常分开。"
---

## 视觉实验

### await 驱动

id: "python-04-04-mechanism"
kind: "flow"
placement: "chapter:2"
summary: "让 awaitable 经过驱动者、Future 与结果返回 视觉中的每个阶段都能回到正文、源码和断言验证，适用于本课而不是装饰性动画。"
caption: "视觉只表达 Python 3.14 / CPython v3.14.6 的教学模型；精确语义和性能结论回到官方章节、固定源码与示例断言。"
actionLabel: "推进await 驱动"

#### 步骤

- 输入 | await 先取得可迭代的入口，再把控制权交还驱动者；Future 完成后协程才从暂停点恢复，async for 另有协议。 的最小输入和初始状态。
- 模型 | 区分 coroutine、awaitable、Future 和 async iterator；每次暂停交还驱动者，结果或异常从同一暂停点回来。 中的当前不变量和所有权。
- 主路径 | coro_await 验证 __await__ 返回迭代器，Task 驱动迭代器；async for 以 __anext__ 和 StopAsyncIteration 结束。 对照源码入口推进一次。
- 失败 | await 非 awaitable、Future 跨 loop、async iterator 错抛 StopIteration 或忘 await，都会变成协议错误。 注入失败并记录传播或回滚。
- 边界 | 业务代码用 asyncio 高层 API；自定义 __await__ 只用于适配器，标注 Future 的 loop、取消和线程边界。 识别工程和版本取舍。

#### 观察重点

- 下一步前预测哪个量会改变、哪个不变量必须保持，再用示例正常断言核对。
- 指出视觉简化可能失真的平台、并发、资源或版本边界，回到源码和官方文档验证。
