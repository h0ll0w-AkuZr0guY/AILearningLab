---
id: "deepagents"
order: 8
name: "Deep Agents"
symbol: "DA"
color: "#b35ee5"
description: "规划、文件系统、上下文管理、子代理与受控执行。"
docs: "https://docs.langchain.com/oss/python/deepagents/overview"
source: "https://github.com/langchain-ai/deepagents"
interviewSource: "https://www.nowcoder.com/discuss/comment/22623788"
---

# Deep Agents 课程路线

模块和课题从同级编号目录自动加载。调整课程结构时修改对应模块的 `catalog.md`，不要在这里复制课题清单。

## 大纲审计与优化方向（2026-08-01）

完整评估见 docs/CURRICULUM_AUDIT_2026-08-01.md #9。

**优化目标**：92→~45课；主线「Agent运行时 + 手撸 mini-agent」。

| 模块变化 | 关键动作 |
|---|---|
| 合并01+02 → Agent基础(6课) | Harness定位/Todo/规划/任务分解 |
| 合并03+04 → Agent工具环境(8课) | 文件系统/Shell/Sandbox/权限 |
| 合并06+07 → Agent能力扩展(6课) | Memory/上下文压缩/Skill/可复用工作流 |
| 保持05子代理(6课)、08治理(5课) | 核心内容精简 |
| 新增 "手撸 mini-agent"(6课) | Todo引擎/工具调用/Sandbox/Memory/多代理编排五步积木 |
