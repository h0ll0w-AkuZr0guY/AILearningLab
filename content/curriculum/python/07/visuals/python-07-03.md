---
lesson: "python-07-03"
track: "python"
decision: "cumulative、tottime 和 I/O 盲区是三个通道，流程图比排名表更能保留因果。"
---

## 视觉实验

### CPU 证据层

id: "python-07-03-mechanism"
kind: "flow"
placement: "chapter:2"
summary: "让热点经过调用图、采样栈与盲区判断 视觉中的每个阶段都能回到正文、源码和断言验证，适用于本课而不是装饰性动画。"
caption: "视觉只表达 Python 3.14 / CPython v3.14.6 的教学模型；精确语义和性能结论回到官方章节、固定源码与示例断言。"
actionLabel: "推进CPU 证据层"

#### 步骤

- 输入 | cProfile 记录调用次数和确定性耗时，采样 profiler 观察栈；I/O 和 C 扩展可能在两种图上呈现盲区。 的最小输入和初始状态。
- 模型 | 诊断分事件记录、栈采样、等待时间和归因证据；先定位热点与调用关系，再优化。 中的当前不变量和所有权。
- 主路径 | Profile 收集统计，pstats 按 cumulative/tottime 排序；采样工具按时间片聚合栈，flame graph 是展示。 对照源码入口推进一次。
- 失败 | 把 cumulative 当自身 CPU、把 cProfile 当 benchmark、只看 Python 栈忽略系统等待，会指错方向。 注入失败并记录传播或回滚。
- 边界 | 短请求用 cProfile，长服务用采样结合日志和系统指标；I/O 联动 async/系统证据。 识别工程和版本取舍。

#### 观察重点

- 下一步前预测哪个量会改变、哪个不变量必须保持，再用示例正常断言核对。
- 指出视觉简化可能失真的平台、并发、资源或版本边界，回到源码和官方文档验证。
