---
lesson: "python-06-03"
track: "python"
decision: "兄弟取消和异常聚合是拓扑变化，图实验能同时显示首错边和最终 ExceptionGroup。"
---

## 视觉实验

### 并发任务图

id: "python-06-03-mechanism"
kind: "graph"
placement: "chapter:2"
summary: "让多个 Task 在首错与收敛阶段分叉 视觉中的每个阶段都能回到正文、源码和断言验证，适用于本课而不是装饰性动画。"
caption: "视觉只表达 Python 3.14 / CPython v3.14.6 的教学模型；精确语义和性能结论回到官方章节、固定源码与示例断言。"
actionLabel: "推进并发任务图"

#### 步骤

- 输入 | gather 按输入顺序返回结果，TaskGroup 首错时取消兄弟并退出时聚合异常；两者收敛合同不同。 的最小输入和初始状态。
- 模型 | 并发收敛由任务集合、失败、取消、结果排序组成；调用者明确选择全成全败或部分成功。 中的当前不变量和所有权。
- 主路径 | TaskGroup.__aexit__ 追踪 tasks、首错取消兄弟并构造 ExceptionGroup；gather 按 return_exceptions 选择传播。 对照源码入口推进一次。
- 失败 | 把 gather 顺序当完成顺序、吞 CancelledError 或用 return_exceptions 隐藏系统错误，会误导恢复策略。 注入失败并记录传播或回滚。
- 边界 | 独立查询可 gather 并逐项分类；资源联动优先 TaskGroup；关键错误保留树结构。 识别工程和版本取舍。

#### 观察重点

- 下一步前预测哪个量会改变、哪个不变量必须保持，再用示例正常断言核对。
- 指出视觉简化可能失真的平台、并发、资源或版本边界，回到源码和官方文档验证。
