---
track: "typescript"
id: "typescript-07"
order: 7
title: "07 · 模块解析与打包边界"
goal: "让 source、declaration、exports 条件与运行时解析保持一致。"
lab: "配置双 ESM/CJS 包并写出类型测试。"
interview: "verbatimModuleSyntax 解决了什么错配？"
officialScope: "https://www.typescriptlang.org/docs/"
sourceScope: "src/compiler/moduleNameResolver.ts"
planningStatus: draft
---

# 07 · 模块解析与打包边界

> ⚠️ 本模块处于草案阶段（`planningStatus: draft`）。当前没有固定课题列表；课题将在基于官方文档、真实上游源码与面试数据分析后确定，并在后续批次中认领与精写。模块目标与实验方向如下：

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

本模块的课题设计与精写计划见路线总纲 `track.md` 中的「大纲审计与优化方向」章节，以及 `docs/CURRICULUM_AUDIT_2026-08-01.md` 中对应路线的优化建议。
