---
lesson: "torch-01-08"
track: "torch"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 逐帧对比「expand 与 repeat：零 stride 广播和真实物化」的状态边界

id: "torch-01-08-main"
kind: "state"
placement: "chapter:2"
summary: "广播是“让一个标量或一行逻辑上出现在许多位置”，并不要求先把它复制成大矩阵。`expand`把原 size=1 的轴映射成 stride 0：无论该轴索引是 0 还是 999，地址增量都是 0。读操作因而廉价，地址重复却让写语义失去一一对应。"
caption: "左右状态卡只压缩本课的前态、现态与不变量；对象身份、生命周期或队列结论仍要用正文中的代码和源码分支验证。"
actionLabel: "播放状态变化"

#### 步骤

- expand 仅允许把 size=1 | expand 仅允许把 size=1 维扩张，新增前导维也可出现。
- 扩张维 stride=0，所有该维坐 | 扩张维 stride=0，所有该维坐标映射到同一地址。
- repeat 分配新 Storage | repeat 分配新 Storage；expand 保留原 Storage。
- 反向沿 expanded/singl | 反向沿 expanded/singleton 维求和，恢复原 shape。
- expand 扩张坐标域，零 str | expand 扩张坐标域，零 stride 让新坐标复用旧地址。

#### 观察重点

- 对 expanded view 原地向量化写。
- 把 `numel`增长误认为显存已经增长。
