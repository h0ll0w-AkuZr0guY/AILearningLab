---
track: "vllm"
id: "vllm-08"
order: 8
title: "08 · 观测、调优与生产故障"
goal: "从指标到 profile 诊断排队、cache、kernel 和通信瓶颈。"
lab: "针对 TTFT 变差完成一次假想事故复盘。"
interview: "先调 batch、cache 还是模型并行？"
officialScope: "https://docs.vllm.ai/"
sourceScope: "仓库根目录与 tests"
planningStatus: draft
---

# 08 · 观测、调优与生产故障

> ⚠️ 本模块处于草案阶段（`planningStatus: draft`）。当前没有固定课题列表；课题将在基于官方文档、真实上游源码与面试数据分析后确定，并在后续批次中认领与精写。模块目标与实验方向如下：

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

本模块的课题设计与精写计划见路线总纲 `track.md` 中的「大纲审计与优化方向」章节，以及 `docs/CURRICULUM_AUDIT_2026-08-01.md` 中对应路线的优化建议。
