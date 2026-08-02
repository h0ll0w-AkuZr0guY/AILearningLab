---
lesson: "python-03-02"
track: "python"
decision: "多个函数如何指向同一 cell 只能靠状态图直观看清，图把外层变量、cell、闭包和默认参数分开。"
---

## 视觉实验

### 闭包 cell

id: "python-03-02-mechanism"
kind: "state"
placement: "chapter:2"
summary: "看见闭包 cell 是共享容器还是快照 视觉中的每个阶段都能回到正文、源码和断言验证，适用于本课而不是装饰性动画。"
caption: "视觉只表达 Python 3.14 / CPython v3.14.6 的教学模型；精确语义和性能结论回到官方章节、固定源码与示例断言。"
actionLabel: "推进闭包 cell"

#### 步骤

- 输入 | 循环中生成的 lambda 常常都读到最后一个值，而默认参数却像定义时的快照。 的最小输入和初始状态。
- 模型 | 编译器把名称分成 local、free、cell，运行时由 closure tuple 与 freevar 对接；参数绑定还有位置、关键字和默认值阶段。 中的当前不变量和所有权。
- 主路径 | 外层变量建 cell，内层函数捕获 cell，调用时从 cell 读取；inspect.getclosurevars 与 __closure__ 可验证关系。 对照源码入口推进一次。
- 失败 | late binding 是多个函数共享 cell 的真实结果；混用可变默认值或错误修改 cell 会产生隐蔽共享。 注入失败并记录传播或回滚。
- 边界 | 需要共享状态时保留 cell，需要快照时用默认参数或工厂；签名越显式，装饰器和类型工具越稳。 识别工程和版本取舍。

#### 观察重点

- 下一步前预测哪个量会改变、哪个不变量必须保持，再用示例正常断言核对。
- 指出视觉简化可能失真的平台、并发、资源或版本边界，回到源码和官方文档验证。
