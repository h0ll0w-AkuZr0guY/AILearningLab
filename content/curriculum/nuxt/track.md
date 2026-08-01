---
id: "nuxt"
order: 4
name: "Nuxt"
symbol: "N"
color: "#2acb95"
description: "Vue 响应式、SSR、Nitro、质量与静态部署。"
docs: "https://nuxt.com/docs/"
source: "https://github.com/nuxt/nuxt"
interviewSource: "https://www.nowcoder.com/discuss/422469"
---

# Nuxt 课程路线

模块和课题从同级编号目录自动加载。调整课程结构时修改对应模块的 `catalog.md`，不要在这里复制课题清单。

## 大纲审计与优化方向（2026-08-01）

完整评估见 docs/CURRICULUM_AUDIT_2026-08-01.md #8。

**优化目标**：110→~54课；主线「Vue响应式内核 + 同构渲染 + 手撸 mini-Nuxt」。

| 模块变化 | 关键动作 |
|---|---|
| 合并01+02 → Vue响应式+编译(10课) | proxy/track/trigger→template→render→patch一条线 |
| 合并03+04 → 生命周期+SSR(8课) | Nuxt app/plugin/SSR/hydration/同构边界 |
| 合并05+06 → 路由+数据(8课) | 文件路由/params/useFetch/useAsyncData/dedupe |
| 保持07 Server/Nitro(6课)、08模块插件(5课) | 核心内容 |
| 合并09+10 → 性能+部署(6课) | bundle/waterfall/preset/static generation |
| 保持11面试实战(5课) | 架构决策题 |
| 新增 "手撸 mini-Nuxt"(6课) | 响应式系统/VNode/renderer/SSR串/pages路由五步积木 |
