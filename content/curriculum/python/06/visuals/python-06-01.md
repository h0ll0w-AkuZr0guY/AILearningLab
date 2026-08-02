---
lesson: "python-06-01"
track: "python"
decision: "一轮 loop 如何移动队列难用静态文字呈现，流程视觉显示入队来源和协作式让出点。"
---

## 视觉实验

### 事件循环轮询

id: "python-06-01-mechanism"
kind: "flow"
placement: "chapter:2"
summary: "推进一轮 ready、timer、I/O 与 Task 恢复 视觉中的每个阶段都能回到正文、源码和断言验证，适用于本课而不是装饰性动画。"
caption: "视觉只表达 Python 3.14 / CPython v3.14.6 的教学模型；精确语义和性能结论回到官方章节、固定源码与示例断言。"
actionLabel: "推进事件循环轮询"

#### 步骤

- 输入 | 事件循环一次轮询处理 ready、到期 timer 和 I/O；Task 由 Future 完成事件驱动，运行中的 Python 代码不会被抢占。 的最小输入和初始状态。
- 模型 | loop 有 ready、scheduled、I/O、stopping 四类状态；任务只有 await 交还控制权时才给其他任务机会。 中的当前不变量和所有权。
- 主路径 | _run_once 计算 timeout、选择器事件、移动 timer、运行 ready 批次；Task 以 Future 回调重新入队。 对照源码入口推进一次。
- 失败 | 循环中阻塞 CPU、创建 task 不保存引用或把 call_later 当硬实时，会造成延迟和任务消失。 注入失败并记录传播或回滚。
- 边界 | I/O 用 Task 和明确超时，CPU 移到线程/进程；公平性靠切小步和测量，不靠猜 sleep。 识别工程和版本取舍。

#### 观察重点

- 下一步前预测哪个量会改变、哪个不变量必须保持，再用示例正常断言核对。
- 指出视觉简化可能失真的平台、并发、资源或版本边界，回到源码和官方文档验证。
