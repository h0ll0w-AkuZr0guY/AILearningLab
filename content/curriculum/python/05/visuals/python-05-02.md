---
lesson: "python-05-02"
track: "python"
decision: "多个路径如何合成 namespace package 不是一条线，图实验把父包、子模块和循环方向显式化。"
---

## 视觉实验

### 包搜索树

id: "python-05-02-mechanism"
kind: "graph"
placement: "chapter:2"
summary: "观察包、父包与 namespace 搜索路径的边 视觉中的每个阶段都能回到正文、源码和断言验证，适用于本课而不是装饰性动画。"
caption: "视觉只表达 Python 3.14 / CPython v3.14.6 的教学模型；精确语义和性能结论回到官方章节、固定源码与示例断言。"
actionLabel: "推进包搜索树"

#### 步骤

- 输入 | __package__、__path__ 和模块名共同决定相对导入；脚本运行和模块运行的包上下文不同。 的最小输入和初始状态。
- 模型 | 包是名称树和搜索路径集合；spec.parent、submodule_search_locations 和 __package__ 共同确定边界。 中的当前不变量和所有权。
- 主路径 | _find_and_load_unlocked 先找父包，再沿名称树定位子模块；namespace package 可合并多目录但没有单一 __file__。 对照源码入口推进一次。
- 失败 | 直接执行 package/mod.py 缺包上下文，路径顺序改变 namespace 发现，循环依赖暴露半初始化属性。 注入失败并记录传播或回滚。
- 边界 | CLI 用 python -m 保留包上下文；namespace 适合分布式插件，普通包更易测试和打包。 识别工程和版本取舍。

#### 观察重点

- 下一步前预测哪个量会改变、哪个不变量必须保持，再用示例正常断言核对。
- 指出视觉简化可能失真的平台、并发、资源或版本边界，回到源码和官方文档验证。
