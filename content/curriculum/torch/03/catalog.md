---
track: "torch"
id: "torch-03"
order: 3
title: "03 · Autograd 图与反向传播"
goal: "以 VJP、grad_fn、saved tensors 理解每轮动态计算图。"
lab: "画出一段计算的 autograd graph 并手推梯度。"
interview: "动态图为什么适合 Python 控制流？"
officialScope: "https://pytorch.org/docs/stable/"
sourceScope: "torch/_dynamo"
planningStatus: draft
---

# 03 · Autograd 图与反向传播

> ⚠️ 本模块处于草案阶段（`planningStatus: draft`）。当前没有固定课题列表；课题将在基于官方文档、真实上游源码与面试数据分析后确定，并在后续批次中认领与精写。模块目标与实验方向如下：

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

本模块的课题设计与精写计划见路线总纲 `track.md` 中的「大纲审计与优化方向」章节，以及 `docs/CURRICULUM_AUDIT_2026-08-01.md` 中对应路线的优化建议。
