---
lesson: "python-07-05"
track: "python"
decision: "原始字节码、cache、guard、deopt 的变化必须随参数即时显示。"
---

## 视觉实验

### 特化状态

id: "python-07-05-mechanism"
kind: "playground"
placement: "chapter:2"
summary: "切换热身和类型稳定性观察 specialization 视觉中的每个阶段都能回到正文、源码和断言验证，适用于本课而不是装饰性动画。"
caption: "视觉只表达 Python 3.14 / CPython v3.14.6 的教学模型；精确语义和性能结论回到官方章节、固定源码与示例断言。"
actionLabel: "推进特化状态"

#### 步骤

- 输入 | 自适应解释器给常见操作安装 inline cache，guard 失败时 deopt；GIL/free-threaded 改变并行边界但不消除数据竞争。 的最小输入和初始状态。
- 模型 | 性能分源码、字节码、特化状态、锁和硬件五层；优化结论要有 dis/计时和正确性测试。 中的当前不变量和所有权。
- 主路径 | specialize 根据类型和操作数写缓存，guard 失败回退通用指令，下一轮可重新热身。 对照源码入口推进一次。
- 失败 | 把 cache 当永久优化、把 GIL 当复合操作原子、跨构建直接比单线程速度，会藏掉 deopt 和竞态。 注入失败并记录传播或回滚。
- 边界 | 先 dis(adaptive=True) 再隔离测量；CPU 并行选择进程或确认 free-threaded 扩展兼容。 识别工程和版本取舍。

#### 观察重点

- 下一步前预测哪个量会改变、哪个不变量必须保持，再用示例正常断言核对。
- 指出视觉简化可能失真的平台、并发、资源或版本边界，回到源码和官方文档验证。
