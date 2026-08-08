---
lesson: "langchain-02-01"
track: "langchain"
decision: "读完第三章后仍难以同时追踪 provider 前缀、延迟构造和运行时配置如何改变最终模型，因此用静止默认 flow 展示选择器的五个离散阶段。"
---

## 视觉实验

### 让一个模型名穿过 provider 选择器

id: "langchain-02-01-provider-selection"
kind: "flow"
placement: "chapter:3"
summary: "观察同一个模型请求如何从字符串变成规范化 provider，再决定固定构造或延迟构造；它把源码中的 `_parse_model` 与 `_ConfigurableModel._model` 变成可回指的阶段。"
caption: "每一步只表达选择与构造边界，不表示真实 HTTP 请求、依赖安装或模型可用性；验证入口是固定 commit 的 `base.py#L230-L247`、`#L619-L647`、`#L711-L716` 和上游 provider 测试。"
actionLabel: "推进 provider 选择"

#### 步骤

- 输入请求 | `openai:demo`、`model_provider=None` 和默认参数进入统一初始化入口。
- 拆分前缀 | `_parse_model` 把 provider=`openai` 与 model=`demo` 分离，原始前缀不再传给 creator。
- 规范化 | provider 名经过大小写和连字符规范化，随后进入 creator 查找。
- 延迟配置 | 没有固定 model 时，`_ConfigurableModel` 保存默认值与 configurable 字段，不假装已有具体模型。
- 实例落地 | `invoke(configurable={model, model_provider})` 才沿 helper 构造具体 ChatModel；失败会暴露 provider/依赖边界。

#### 观察重点

- 每一步前先预测：当前对象是字符串、规范化请求、Runnable 外壳还是具体模型。
- 用本课示例验证未知 provider、无法推断模型和运行时选择；不要把视觉阶段当成网络成功证据。
