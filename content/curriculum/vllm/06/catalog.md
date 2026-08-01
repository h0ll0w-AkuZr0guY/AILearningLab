---
track: "vllm"
id: "vllm-06"
order: 6
title: "06 · Sampling 与推理质量"
goal: "理解 sampling 配置会怎样改变并发、cache 与输出分布。"
lab: "实现 temperature/top-p/beam 的小型采样器。"
interview: "为什么不同 decoding 策略需要不同服务预算？"
officialScope: "https://docs.vllm.ai/"
sourceScope: "vllm/config"
planningStatus: draft
---

# 06 · Sampling 与推理质量

> ⚠️ 本模块处于草案阶段（`planningStatus: draft`）。当前没有固定课题列表；课题将在基于官方文档、真实上游源码与面试数据分析后确定，并在后续批次中认领与精写。模块目标与实验方向如下：

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

本模块的课题设计与精写计划见路线总纲 `track.md` 中的「大纲审计与优化方向」章节，以及 `docs/CURRICULUM_AUDIT_2026-08-01.md` 中对应路线的优化建议。
