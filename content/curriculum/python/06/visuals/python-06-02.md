---
lesson: "python-06-02"
track: "python"
decision: "cancel 调用与异常到达不是同一时刻，状态图能显示四个可验证节点。"
---

## 视觉实验

### 取消生命周期

id: "python-06-02-mechanism"
kind: "state"
placement: "chapter:2"
summary: "观察取消请求、注入、清理和确认 视觉中的每个阶段都能回到正文、源码和断言验证，适用于本课而不是装饰性动画。"
caption: "视觉只表达 Python 3.14 / CPython v3.14.6 的教学模型；精确语义和性能结论回到官方章节、固定源码与示例断言。"
actionLabel: "推进取消生命周期"

#### 步骤

- 输入 | cancel 是在下一恢复点注入 CancelledError；timeout 在边界外转换为 TimeoutError，shield 只保护内部任务。 的最小输入和初始状态。
- 模型 | 取消分请求、注入、清理、传播、确认五态；清理必须可观察并最终结束，不能吞调用者意图。 中的当前不变量和所有权。
- 主路径 | Task.cancel 安排异常注入，__step 重新驱动协程；timeout 和 wait_for 在边界转换/传播取消。 对照源码入口推进一次。
- 失败 | 捕获后不重抛、在 timeout 内捕获 TimeoutError、把 shield 当后台持久化，都会泄漏。 注入失败并记录传播或回滚。
- 边界 | finally 做幂等清理；后台 task 保存显式引用；shield 只覆盖单个 await。 识别工程和版本取舍。

#### 观察重点

- 下一步前预测哪个量会改变、哪个不变量必须保持，再用示例正常断言核对。
- 指出视觉简化可能失真的平台、并发、资源或版本边界，回到源码和官方文档验证。
