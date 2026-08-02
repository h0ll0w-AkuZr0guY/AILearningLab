---
lesson: "python-05-03"
track: "python"
decision: "构建环境与运行环境必须分开，流程实验按输入、产物、安装和导入四段验证。"
---

## 视觉实验

### 发布流水线

id: "python-05-03-mechanism"
kind: "flow"
placement: "chapter:2"
summary: "让源码经过隔离进入 wheel 与运行环境 视觉中的每个阶段都能回到正文、源码和断言验证，适用于本课而不是装饰性动画。"
caption: "视觉只表达 Python 3.14 / CPython v3.14.6 的教学模型；精确语义和性能结论回到官方章节、固定源码与示例断言。"
actionLabel: "推进发布流水线"

#### 步骤

- 输入 | venv 提供隔离解释器和 site-packages，pyproject 描述构建系统，wheel 是可安装产物，三者解决不同阶段。 的最小输入和初始状态。
- 模型 | 区分源码树、构建环境、wheel 元数据和运行环境；构建输入可记录、产物可检查、安装后 import 不依赖源码偶然状态。 中的当前不变量和所有权。
- 主路径 | EnvBuilder.create 组织目录和脚本，PEP 517 backend 从 pyproject 生成 wheel，安装器按 metadata 写入环境。 对照源码入口推进一次。
- 失败 | 把当前解释器当构建环境、把 editable 当发布物或遗漏动态依赖，会导致干净环境失败。 注入失败并记录传播或回滚。
- 边界 | 发布构建 wheel 并在干净 venv 安装；开发期 editable 需增加构建产物验收。 识别工程和版本取舍。

#### 观察重点

- 下一步前预测哪个量会改变、哪个不变量必须保持，再用示例正常断言核对。
- 指出视觉简化可能失真的平台、并发、资源或版本边界，回到源码和官方文档验证。
