---
lesson: "python-07-04"
track: "python"
decision: "分配点、对象存活和驻留页不能互推，状态实验能逐层标出边界。"
---

## 视觉实验

### 内存证据层

id: "python-07-04-mechanism"
kind: "state"
placement: "chapter:2"
summary: "观察分配、可达性和 RSS 三层读数 视觉中的每个阶段都能回到正文、源码和断言验证，适用于本课而不是装饰性动画。"
caption: "视觉只表达 Python 3.14 / CPython v3.14.6 的教学模型；精确语义和性能结论回到官方章节、固定源码与示例断言。"
actionLabel: "推进内存证据层"

#### 步骤

- 输入 | tracemalloc 追踪 Python 分配位置，gc 处理可达性，RSS 反映进程驻留页；三者回答不同问题。 的最小输入和初始状态。
- 模型 | 内存证据分为分配来源、可达性、解释器缓存和驻留四层；先声明问题再选工具。 中的当前不变量和所有权。
- 主路径 | tracemalloc_start 建立追踪表，snapshot/compare_to 比较 traceback；gc.get_objects 只覆盖可追踪对象。 对照源码入口推进一次。
- 失败 | 把 snapshot 当活对象数、del 后期待 RSS 立即下降、把 allocator 缓存当泄漏，都会误判。 注入失败并记录传播或回滚。
- 边界 | 先用 tracemalloc 定位，再用对象图/gc 验证，最后看 RSS 和部署指标；释放策略要实测。 识别工程和版本取舍。

#### 观察重点

- 下一步前预测哪个量会改变、哪个不变量必须保持，再用示例正常断言核对。
- 指出视觉简化可能失真的平台、并发、资源或版本边界，回到源码和官方文档验证。
