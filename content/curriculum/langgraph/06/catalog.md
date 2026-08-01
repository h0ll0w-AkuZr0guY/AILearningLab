---
track: "langgraph"
id: "langgraph-06"
order: 6
title: "06 · 持久化与耐久执行"
goal: "为可恢复执行定义 checkpoint、副作用边界和幂等策略。"
lab: "实现订单查询工作流的 crash-resume 测试。"
interview: "重放时怎样避免重复支付？"
officialScope: "https://docs.langchain.com/oss/python/langgraph/overview"
sourceScope: "libs/langgraph/langgraph/types.py"
planningStatus: draft
---

# 06 · 持久化与耐久执行

> ⚠️ 本模块处于草案阶段（`planningStatus: draft`）。当前没有固定课题列表；课题将在基于官方文档、真实上游源码与面试数据分析后确定，并在后续批次中认领与精写。模块目标与实验方向如下：

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

本模块的课题设计与精写计划见路线总纲 `track.md` 中的「大纲审计与优化方向」章节，以及 `docs/CURRICULUM_AUDIT_2026-08-01.md` 中对应路线的优化建议。
