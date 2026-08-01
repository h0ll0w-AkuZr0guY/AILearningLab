---
id: "typescript"
order: 2
name: "TypeScript"
symbol: "TS"
color: "#1fa8d5"
description: "从 JavaScript 运行时到 TypeScript checker。"
docs: "https://www.typescriptlang.org/docs/"
source: "https://github.com/microsoft/TypeScript"
interviewSource: "https://www.nowcoder.com/discuss/517852889394446336"
---

# TypeScript 课程路线

模块和课题从同级编号目录自动加载。调整课程结构时修改对应模块的 `catalog.md`，不要在这里复制课题清单。

## 大纲审计与优化方向（2026-08-01）

完整评估见 docs/CURRICULUM_AUDIT_2026-08-01.md #1。

**核心问题**：模块01「JS运行时地基」13课全部专家/困难，在路线最前端造成极高认知壁垒；「由浅入深」完全反向。

**优化目标**：114→~65课；主线「类型系统核心 + 手撸 mini-checker」。

| 模块 | 变化 | 关键动作 |
|---|---|---|
| 01 运行时地基 | 13→5课 | 保留值/对象/闭包/this/event-loop作为最小JS心智模型；GC/ESM/Proxy/模块链移到后续模块 |
| 02 可赋值性 | 10→5课 | 合并协变逆变体系为1课；合并any/unknown/never/void为1课；删减readonly/可选独立课 |
| 03 控制流 | 10→4课 | 合并typeof/instanceof/in/truthiness为1课；删减assertion function/闭包收窄丢失 |
| 04 泛型 | 10→5课 | 合并conditional/infer/distributive为1课；保留keyof/mapped type为核心 |
| 05 函数签名 | 10→4课 | 合并签名类为1课，overload保留，参数体系合并，删除伪需求 |
| 06 类 | 10→3课 | 类型空间vs值空间1课；implements/abstract 1课；声明合并/enum代价 1课 |
| 07 模块解析 | 10→5课 | 保留核心5课，降级工程细节为附录 |
| 08 tsconfig | 10→3课 | strict家族→1课；编译边界→1课；性能诊断→1课 |
| 09 类型库 | 10→3课 | ambient/module/augmentation→1课；branding→1课；publish→1课 |
| 10+11 Compiler+面试 → 6课 | 手撸mini-checker实战 + 面试题 |

**手撸 mini-checker 终极产出**：用前9个模块的知识实现一个能检查类型不匹配/属性不存在/函数参数个数不对的小型checker。

**递进线路**：值/对象→类型兼容→窄化→泛型→函数→类→模块→工程→手撸checker
