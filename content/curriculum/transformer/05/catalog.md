---
track: "transformer"
id: "transformer-05"
order: 5
title: "05 · Transformer Block 细节"
goal: "把 residual、norm、MLP、dropout 看作训练稳定性的系统。"
lab: "搭一个可切换 Pre-LN/Post-LN 的 block 对照实验。"
interview: "Pre-LN 为什么更易训练深层网络？"
officialScope: "https://pytorch.org/docs/stable/generated/torch.nn.MultiheadAttention.html"
sourceScope: "仓库根目录与 tests"
planningStatus: draft
---

# 05 · Transformer Block 细节

> ⚠️ 本模块处于草案阶段（`planningStatus: draft`）。当前没有固定课题列表；课题将在基于官方文档、真实上游源码与面试数据分析后确定，并在后续批次中认领与精写。模块目标与实验方向如下：

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

本模块的课题设计与精写计划见路线总纲 `track.md` 中的「大纲审计与优化方向」章节，以及 `docs/CURRICULUM_AUDIT_2026-08-01.md` 中对应路线的优化建议。
