---
lesson: "python-04-01"
track: "python"
decision: "else、finally 和异常匹配不是一条线，流程图能显式显示四种出口如何竞争。"
---

## 视觉实验

### 异常展开

id: "python-04-01-mechanism"
kind: "flow"
placement: "chapter:2"
summary: "让异常或 return 穿过 try 完成矩阵 视觉中的每个阶段都能回到正文、源码和断言验证，适用于本课而不是装饰性动画。"
caption: "视觉只表达 Python 3.14 / CPython v3.14.6 的教学模型；精确语义和性能结论回到官方章节、固定源码与示例断言。"
actionLabel: "推进异常展开"

#### 步骤

- 输入 | try 的 except、else、finally 与 return、break、raise 会竞争同一个离开路径。 的最小输入和初始状态。
- 模型 | 异常是携带 traceback 的非局部控制流；body、handler、else、cleanup 四阶段必须分别标记。 中的当前不变量和所有权。
- 主路径 | 解释器展开 block 栈、定位 handler、设置 traceback，再进入 finally；finally 的新 return/raise 可以替换旧结果。 对照源码入口推进一次。
- 失败 | finally 中 return 会吞异常，except 过宽会破坏分类，else 不能替代 finally。 注入失败并记录传播或回滚。
- 边界 | 恢复动作放 except，finally 只做无条件清理；测试成功、匹配、未匹配和退出竞争。 识别工程和版本取舍。

#### 观察重点

- 下一步前预测哪个量会改变、哪个不变量必须保持，再用示例正常断言核对。
- 指出视觉简化可能失真的平台、并发、资源或版本边界，回到源码和官方文档验证。
