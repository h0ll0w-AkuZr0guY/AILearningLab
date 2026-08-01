---
track: "torch"
id: "torch-05"
order: 5
title: "05 · nn.Module 与参数管理"
goal: "理解 module tree、parameter registration、state_dict 与 hooks。"
lab: "实现可序列化模块并写 state_dict 迁移。"
interview: "普通 Tensor 为什么不会自动被 optimizer 更新？"
officialScope: "https://pytorch.org/docs/stable/"
sourceScope: "仓库根目录与 tests"
planningStatus: draft
---

# 05 · nn.Module 与参数管理

> ⚠️ 本模块处于草案阶段（`planningStatus: draft`）。当前没有固定课题列表；课题将在基于官方文档、真实上游源码与面试数据分析后确定，并在后续批次中认领与精写。模块目标与实验方向如下：

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

本模块的课题设计与精写计划见路线总纲 `track.md` 中的「大纲审计与优化方向」章节，以及 `docs/CURRICULUM_AUDIT_2026-08-01.md` 中对应路线的优化建议。
