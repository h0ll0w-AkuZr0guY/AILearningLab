---
lesson: "torch-02-04"
track: "torch"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 把「ellipsis None」落到可见张量

id: "torch-02-04-main"
kind: "tensor"
placement: "chapter:2"
summary: "`...`和`None`很短，却是深度学习代码中控制 rank 的两个精确工具。前者意思是“这里填满足以覆盖其余未指定维度的冒号”，后者意思是“在这里插入一个长度为一的轴”。它们改的是坐标系，不是数值。"
caption: "格子按阶段追踪 shape、数值、stride、storage 或计算边界；精确结论必须继续用维度、数值和断言验证。"
actionLabel: "播放张量变化"

#### 步骤

- ellipsis 吸收剩余未指定输入 | ellipsis 吸收剩余未指定输入维。
- None 以 unsqueeze 插 | None 以 unsqueeze 插入 size=1 输出维。
- 两者通常不复制 Storage | 两者通常不复制 Storage。
- 它们与高级 index 混用时，基础 | 它们与高级 index 混用时，基础处理先完成。
- ellipsis 让位置相对末端稳定 | ellipsis 让位置相对末端稳定，不能让业务 axis 语义自动正确。

#### 观察重点

- 把 ... 当作固定数量的冒号。
- 把 None 当作新增数据。
