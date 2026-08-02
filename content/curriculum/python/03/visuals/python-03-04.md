---
lesson: "python-03-04"
track: "python"
decision: "frame 在 yield 后仍存活、异常从哪一帧进入，状态图能给出比代码阅读更直接的证据。"
---

## 视觉实验

### 生成器状态机

id: "python-03-04-mechanism"
kind: "state"
placement: "chapter:2"
summary: "推进生成器的暂停与恢复 视觉中的每个阶段都能回到正文、源码和断言验证，适用于本课而不是装饰性动画。"
caption: "视觉只表达 Python 3.14 / CPython v3.14.6 的教学模型；精确语义和性能结论回到官方章节、固定源码与示例断言。"
actionLabel: "推进生成器状态机"

#### 步骤

- 输入 | 调用生成器函数只得到暂停对象；next、send、throw 和 close 才把不同信号送回 yield 点。 的最小输入和初始状态。
- 模型 | 生成器是带 frame、指令位置和状态位的迭代器；yield 保存 locals，StopIteration.value 是返回通道，GeneratorExit 是关闭协议。 中的当前不变量和所有权。
- 主路径 | gen_send_ex 恢复 frame，按值或待注入异常运行到下一次 yield、return 或异常。 对照源码入口推进一次。
- 失败 | 第一次 send 非 None 会失败；finally 中再次 yield、吞掉 GeneratorExit 或忽略 close 会破坏资源合同。 注入失败并记录传播或回滚。
- 边界 | 只读流用 yield，双向协程才用 send/throw；外部资源在 finally 关闭，不依赖对象回收。 识别工程和版本取舍。

#### 观察重点

- 下一步前预测哪个量会改变、哪个不变量必须保持，再用示例正常断言核对。
- 指出视觉简化可能失真的平台、并发、资源或版本边界，回到源码和官方文档验证。
