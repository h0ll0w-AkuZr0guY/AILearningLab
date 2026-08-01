---
id: "torch"
order: 6
name: "PyTorch"
symbol: "⚡"
color: "#ec6756"
description: "Tensor 存储、Autograd、GPU、分布式与源码。"
docs: "https://pytorch.org/docs/stable/"
source: "https://github.com/pytorch/pytorch"
interviewSource: "https://www.nowcoder.com/discuss/769275190441148416"
---

# PyTorch 课程路线

模块和课题从同级编号目录自动加载。调整课程结构时修改对应模块的 `catalog.md`，不要在这里复制课题清单。

## 大纲审计与优化方向（2026-08-01）

完整评估见 docs/CURRICULUM_AUDIT_2026-08-01.md #3。

**优化目标**：120→~65课；主线「Tensor 内部模型 + 手撸 mini autograd」。

| 模块变化 | 关键动作 |
|---|---|
| 保留 01-02 不变 | 20课全部curated且质量高，作为 Tensor 地基 |
| 模块03-06 压缩 | 03 autograd图(10→5)、04自定义Function(10→5)、05 nn.Module(10→6)、06数据管线(10→5) |
| 模块07 CUDA/GPU(10→2) | 降为概述课，mini框架不依赖 |
| 模块08 分布式(10→1) | 降为概念介绍课 |
| 模块09 torch.compile(10→1) | 降为概念介绍课 |
| 模块10 源码扩展 | 保留3课核心(register op/dispatch key/autograd扩展) |
| 模块11 部署(10→1) | 降为概述 |
| 模块12 面试 | 保留5课核心问答 |
| 新增 模块13 "手撸 mini-torch"（6课） | autograd图/backward/custom Function/nn.Module参数管理/optimizer五步积木 |

**已curated 20课处理**：模块01/02保持原样；03-06后续精写时按新粒度拆分。
