---
track: "vllm"
id: "vllm-04"
order: 4
title: "04 · Engine、Executor 与并行"
goal: "追踪 engine 从请求到 model runner，再到 worker 的执行路径。"
lab: "搭建离线 engine 与单机 API server 对照。"
interview: "tensor parallel 为什么会带来通信瓶颈？"
officialScope: "https://docs.vllm.ai/"
sourceScope: "vllm/engine"
planningStatus: draft
---

# 04 · Engine、Executor 与并行

> ⚠️ 本模块处于草案阶段（`planningStatus: draft`）。当前没有固定课题列表；课题将在基于官方文档、真实上游源码与面试数据分析后确定，并在后续批次中认领与精写。模块目标与实验方向如下：

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

本模块的课题设计与精写计划见路线总纲 `track.md` 中的「大纲审计与优化方向」章节，以及 `docs/CURRICULUM_AUDIT_2026-08-01.md` 中对应路线的优化建议。
