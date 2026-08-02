---
lesson: "python-08-04"
track: "python"
decision: "eval breaker 插入调用链的时刻只有时间线能清楚表达。"
---

## 视觉实验

### 调用路径

id: "python-08-04-mechanism"
kind: "flow"
placement: "chapter:2"
summary: "追踪调用穿过 frame、dispatch、breaker 与返回 视觉中的每个阶段都能回到正文、源码和断言验证，适用于本课而不是装饰性动画。"
caption: "视觉只表达 Python 3.14 / CPython v3.14.6 的教学模型；精确语义和性能结论回到官方章节、固定源码与示例断言。"
actionLabel: "推进调用路径"

#### 步骤

- 输入 | 调用进入 frame 后由指令分派到返回；eval breaker 让信号和监控在安全点介入，vectorcall 减少临时 tuple/dict。 的最小输入和初始状态。
- 模型 | 调用分参数布局、frame、dispatch、安全点、返回五层；优化只减少包装和分派，不改变结果。 中的当前不变量和所有权。
- 主路径 | _PyEval_EvalFrameDefault 读取指令、处理 opcode/异常/eval breaker；vectorcall 由公开 C 协议连接。 对照源码入口推进一次。
- 失败 | 把 Python frame 当 C 栈帧、把 breaker 当任意抢占、直接调用私有入口，会越过稳定 API。 注入失败并记录传播或回滚。
- 边界 | 普通代码用 callable/inspect/dis 观察；扩展按公开 vectorcall 协议实现并写 ABI 测试。 识别工程和版本取舍。

#### 观察重点

- 下一步前预测哪个量会改变、哪个不变量必须保持，再用示例正常断言核对。
- 指出视觉简化可能失真的平台、并发、资源或版本边界，回到源码和官方文档验证。
