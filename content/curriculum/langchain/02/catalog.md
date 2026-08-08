---
track: "langchain"
id: "langchain-02"
order: 2
title: "02 · Provider 与模型适配层"
goal: "让业务代码依赖统一模型接口，而非供应商 payload，并能解释适配层的输入、生成、流式和能力边界。"
lab: "用无网络 fake model 复现 provider 选择、输入归一化、ChatResult、stream/batch 和 capability profile。"
interview: "适配层怎样控制抽象泄漏、运行时切换和版本风险？"
officialScope: "https://docs.langchain.com/oss/python/langchain/models"
sourceScope: "libs/langchain_v1/langchain/chat_models、libs/core/langchain_core/language_models、libs/langchain_v1/tests/unit_tests/chat_models、libs/core/tests/unit_tests/language_models"
planningStatus: established
---

# 02 · Provider 与模型适配层

本模块把“不同供应商模型如何成为同一个 LangChain ChatModel”拆成五个独立不变量：构造时选择 provider，调用前归一化输入，provider 生成 `ChatResult`，运行时选择 stream/batch 路径，以及用能力画像约束上层策略。五课都可以用本地 fake model 运行，不要求真实 API key。

模块边界：provider-specific HTTP payload、鉴权和重试策略只作为适配器边界的例子，不逐一遍历供应商产品；工具循环留给后续 Agent 模块；本模块只解释统一接口怎样承接这些差异。

## langchain-02-01

title: "init_chat_model 与 provider 选择"
status: curated
difficulty: "中等"
difficultyReason: "需要同时追踪 provider:model 解析、延迟导入、依赖缺失和运行时可配置模型。"
learningValue: "基础必修"
learningValueScore: 5
estimatedMinutes: 45
granularity: "单点精讲"

## langchain-02-02

title: "BaseChatModel 输入归一化"
status: curated
difficulty: "中等"
difficultyReason: "同一 invoke 入口接受字符串、PromptValue 和消息列表，但转换失败发生在模型生成之前。"
learningValue: "基础必修"
learningValueScore: 5
estimatedMinutes: 45
granularity: "单点精讲"

## langchain-02-03

title: "_generate、ChatResult 与响应元数据"
status: curated
difficulty: "困难"
difficultyReason: "要区分 provider 实现的 ChatResult、统一 AIMessage 和缓存/流式路径补写的 metadata。"
learningValue: "基础必修"
learningValueScore: 5
estimatedMinutes: 50
granularity: "单点精讲"

## langchain-02-04

title: "stream、batch 与自动流式"
status: curated
difficulty: "困难"
difficultyReason: "同一个模型可能沿显式 stream、callback 触发的隐式流式、batch 或 invoke 回退分派。"
learningValue: "基础必修"
learningValueScore: 5
estimatedMinutes: 50
granularity: "单点精讲"

## langchain-02-05

title: "model profile 与能力协商"
status: curated
difficulty: "困难"
difficultyReason: "能力画像是 beta、字段可缺省且由 provider 包补充，上层策略必须按证据和边界选择。"
learningValue: "基础必修"
learningValueScore: 5
estimatedMinutes: 50
granularity: "单点精讲"
