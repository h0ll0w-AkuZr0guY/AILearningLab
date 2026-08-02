---
lesson: "python-04-03"
track: "python"
decision: "部分获取失败时哪些资源已被拥有，状态图比线性代码更能显出责任边界。"
---

## 视觉实验

### 退出栈

id: "python-04-03-mechanism"
kind: "state"
placement: "chapter:2"
summary: "观察资源获取、注册与逆序释放 视觉中的每个阶段都能回到正文、源码和断言验证，适用于本课而不是装饰性动画。"
caption: "视觉只表达 Python 3.14 / CPython v3.14.6 的教学模型；精确语义和性能结论回到官方章节、固定源码与示例断言。"
actionLabel: "推进退出栈"

#### 步骤

- 输入 | with 隐式包住 enter、body 和 exit；ExitStack 以逆序管理动态资源，并允许转移清理责任。 的最小输入和初始状态。
- 模型 | 资源合同是 acquire、use、release 三阶段；__exit__ 返回 True 才抑制异常，退出栈不是资源所有权本身。 中的当前不变量和所有权。
- 主路径 | 编译器产生 WITH_EXCEPT_START/cleanup 路径，ExitStack 对已注册 callbacks 逆序执行，部分获取失败只清理已成功资源。 对照源码入口推进一次。
- 失败 | 第二个资源获取前未注册第一个、错误返回 True 或 pop_all 后忘 close，都会泄漏或责任错位。 注入失败并记录传播或回滚。
- 边界 | 固定数量用 with，动态数量用 ExitStack；所有权跨函数转移要明确一次且仅一次关闭。 识别工程和版本取舍。

#### 观察重点

- 下一步前预测哪个量会改变、哪个不变量必须保持，再用示例正常断言核对。
- 指出视觉简化可能失真的平台、并发、资源或版本边界，回到源码和官方文档验证。
