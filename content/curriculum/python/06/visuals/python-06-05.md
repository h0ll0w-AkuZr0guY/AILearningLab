---
lesson: "python-06-05"
track: "python"
decision: "共享内存、上下文复制和序列化同时存在时，节点图能显示数据与取消边界。"
---

## 视觉实验

### 跨界所有权

id: "python-06-05-mechanism"
kind: "graph"
placement: "chapter:2"
summary: "比较 loop、thread、process 三种执行边界 视觉中的每个阶段都能回到正文、源码和断言验证，适用于本课而不是装饰性动画。"
caption: "视觉只表达 Python 3.14 / CPython v3.14.6 的教学模型；精确语义和性能结论回到官方章节、固定源码与示例断言。"
actionLabel: "推进跨界所有权"

#### 步骤

- 输入 | to_thread 把阻塞函数移到线程并复制 Context；线程共享地址空间，进程通过序列化传值，GIL/free-threaded 决定 CPU 边界。 的最小输入和初始状态。
- 模型 | loop、thread、process 三层分别标记共享内存、ContextVar、取消和复制；每次跨界都明确所有权。 中的当前不变量和所有权。
- 主路径 | to_thread 用 copy_context 和 executor 提交 callable，结果以 Future 回到 loop；multiprocessing 通过 pickle/共享机制传值。 对照源码入口推进一次。
- 失败 | 取消 await 不会停止已运行线程，ContextVar 不是全局变量，跨进程传锁和文件会失败。 注入失败并记录传播或回滚。
- 边界 | I/O 用 to_thread，CPU 在有 GIL 构建中用进程；free-threaded 仍需显式同步。 识别工程和版本取舍。

#### 观察重点

- 下一步前预测哪个量会改变、哪个不变量必须保持，再用示例正常断言核对。
- 指出视觉简化可能失真的平台、并发、资源或版本边界，回到源码和官方文档验证。
