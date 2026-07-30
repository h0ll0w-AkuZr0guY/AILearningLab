---
track: "{{TRACK_ID}}"
id: "{{MODULE_ID}}"
order: {{MODULE_ORDER}}
title: "{{MODULE_TITLE}}"
goal: "{{MODULE_GOAL}}"
lab: "{{MODULE_LAB}}"
interview: "{{MODULE_INTERVIEW}}"
officialScope: "{{OFFICIAL_DOCUMENT_SCOPE}}"
sourceScope: "{{UPSTREAM_SOURCE_SCOPE}}"
planningStatus: draft
---

# {{MODULE_TITLE}}

<!--
先核验官方文档的信息架构、上游仓库的包边界与核心调用链，再决定课题数量。
课题数量应由真实机制、源码路径和可独立验证的学习目标决定，不按固定模板凑数。
目录设计完成并经过审阅后，把 planningStatus 改为 established。
-->

## {{LESSON_ID}}

title: "{{LESSON_TITLE}}"
status: pending
owner: ""
difficulty: "困难"
difficultyReason: "{{WHY_THIS_DIFFICULTY_IS_REAL}}"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 120
granularity: "单点精讲"
