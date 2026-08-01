---
track: "langgraph"
id: "langgraph-04"
order: 4
title: "04 · Checkpoint 与耐久执行"
goal: "把任务恢复建立在 checkpoint 和幂等副作用上。"
lab: "为支付审核图实现 crash-resume 演练。"
interview: "如何避免 resume 后重复产生副作用？"
officialScope: "https://docs.langchain.com/oss/python/langgraph/overview"
sourceScope: "libs/checkpoint"
planningStatus: draft
---

# 04 · Checkpoint 与耐久执行

> ⚠️ 本模块处于草案阶段（`planningStatus: draft`）。当前没有固定课题列表；课题将在基于官方文档、真实上游源码与面试数据分析后确定，并在后续批次中认领与精写。模块目标与实验方向如下：

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

本模块的课题设计与精写计划见路线总纲 `track.md` 中的「大纲审计与优化方向」章节，以及 `docs/CURRICULUM_AUDIT_2026-08-01.md` 中对应路线的优化建议。
