---
track: "lora"
id: "lora-04"
order: 4
title: "04 · PEFT 框架与训练循环"
goal: "复现 config、wrap、state_dict、trainer 之间的边界。"
lab: "手写 mini PeftModel 与 adapter-only checkpoint。"
interview: "adapter checkpoint 为什么不含完整 base 权重？"
officialScope: "https://huggingface.co/docs/peft/main/conceptual_guides/lora"
sourceScope: "src/peft/tuners"
planningStatus: established
---

# 04 · PEFT 框架与训练循环

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

## lora-04-01

title: "LoraConfig"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 70
granularity: "单点精讲"

## lora-04-02

title: "get_peft_model"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## lora-04-03

title: "PeftModel"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## lora-04-04

title: "trainable params"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## lora-04-05

title: "save adapter"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 70
granularity: "单点精讲"

## lora-04-06

title: "load adapter"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 70
granularity: "单点精讲"

## lora-04-07

title: "state dict keys"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 45
granularity: "单点精讲"

## lora-04-08

title: "merge unload"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## lora-04-09

title: "multiple adapters"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "涉及多个运行阶段或相互作用的不变量，需要借助反例和源码调用链建立心智模型。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 70
granularity: "单点精讲"

## lora-04-10

title: "trainer integration"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"

## lora-04-11

title: "framework rebuild"
status: pending
owner: ""
difficulty: "中等"
difficultyReason: "需要同时掌握公开契约、一个主要失败边界和对应实现路径。"
learningValue: "专项拓展"
learningValueScore: 3
estimatedMinutes: 45
granularity: "单点精讲"
