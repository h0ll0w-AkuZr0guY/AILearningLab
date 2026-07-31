---
lesson: "torch-01-03"
track: "torch"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 把「shape、numel、dtype、device 与 layout：张量合同的正交坐标」落到可见张量

id: "torch-01-03-main"
kind: "tensor"
placement: "chapter:2"
summary: "shape、numel、dtype、device、layout 常被并排打印，于是容易被当成一组“描述信息”。它们分别回答五个问题：坐标域多大、逻辑元素多少、每个元素怎样编码、数据/计算位于何处、整体用哪类结构组织。将它们当作正交坐标，可以更准确判断某个转换是否只改元数据、是否复制、是否支持。"
caption: "格子按阶段追踪 shape、数值、stride、storage 或计算边界；精确结论必须继续用维度、数值和断言验证。"
actionLabel: "播放张量变化"

#### 步骤

- shape 给出各维逻辑范围，num | shape 给出各维逻辑范围，numel 通常缓存 sizes 乘积。
- dtype 决定元素编码、items | dtype 决定元素编码、itemsize、类型提升与 kernel 能力。
- device 决定地址空间、allo | device 决定地址空间、allocator、执行后端与迁移语义。
- layout 选择 strided、 | layout 选择 strided、sparse 等结构族，memory_format 是 strided 内的排列选择。
- meta Tensor 允许只有抽象 | meta Tensor 允许只有抽象属性而没有普通数据。

#### 观察重点

- shape 相同就认为 Tensor 可互换，忽略 dtype、device、layout 与轴语义。
- 用 numel×itemsize 估算所有 view/sparse 的真实 Storage。
