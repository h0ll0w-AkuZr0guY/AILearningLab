---
track: "langchain"
id: "langchain-02"
order: 2
title: "02 · Provider 与模型适配层"
goal: "让业务代码依赖统一模型接口，而非供应商 payload。"
lab: "实现一个 OpenAI-compatible adapter 与 fake model。"
interview: "适配层是抽象泄漏还是长期成本控制？"
officialScope: "https://docs.langchain.com/oss/python/langchain/overview"
sourceScope: "libs/core/langchain_core/language_models"
planningStatus: draft
---

# 02 · Provider 与模型适配层

> ⚠️ 本模块处于草案阶段（`planningStatus: draft`）。当前没有固定课题列表；课题将在基于官方文档、真实上游源码与面试数据分析后确定，并在后续批次中认领与精写。模块目标与实验方向如下：

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

本模块的课题设计与精写计划见路线总纲 `track.md` 中的「大纲审计与优化方向」章节，以及 `docs/CURRICULUM_AUDIT_2026-08-01.md` 中对应路线的优化建议。
