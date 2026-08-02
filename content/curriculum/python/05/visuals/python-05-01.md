---
lesson: "python-05-01"
track: "python"
decision: "预插入和失败删除的先后是导入最容易误读的部分，流程图把成功/异常路径并排。"
---

## 视觉实验

### 导入状态机

id: "python-05-01-mechanism"
kind: "flow"
placement: "chapter:2"
summary: "让模块从 spec 走到缓存与失败回滚 视觉中的每个阶段都能回到正文、源码和断言验证，适用于本课而不是装饰性动画。"
caption: "视觉只表达 Python 3.14 / CPython v3.14.6 的教学模型；精确语义和性能结论回到官方章节、固定源码与示例断言。"
actionLabel: "推进导入状态机"

#### 步骤

- 输入 | import 先查 sys.modules，再由 finder 产生 ModuleSpec，loader 创建并执行模块；执行前会预插入缓存。 的最小输入和初始状态。
- 模型 | 导入分成名称解析、spec、创建、缓存、exec、回滚六态；成功导入通常复用模块对象，失败要移除不完整缓存。 中的当前不变量和所有权。
- 主路径 | PyImport_ExecCodeModuleObject 完成 code 执行与模块属性设置，失败路径从 sys.modules 删除当前模块。 对照源码入口推进一次。
- 失败 | 循环依赖访问未绑定名称、错误 spec、loader 重复 exec 或手工写 sys.modules，会产生半初始化和幽灵模块。 注入失败并记录传播或回滚。
- 边界 | 普通业务用默认 import，插件才显式 finder/loader；必须记录 spec、缓存和回滚责任。 识别工程和版本取舍。

#### 观察重点

- 下一步前预测哪个量会改变、哪个不变量必须保持，再用示例正常断言核对。
- 指出视觉简化可能失真的平台、并发、资源或版本边界，回到源码和官方文档验证。
