---
lesson: "torch-02-05"
track: "torch"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 把「broadcast alignment」落到可见张量

id: "torch-02-05-main"
kind: "tensor"
placement: "chapter:2"
summary: "broadcast 不是把小 tensor 真的复制很多份，而是为逐元素算子对齐坐标域。缺失前导维视为 1，size=1 维可以反复使用同一个逻辑元素；实现常以 zero stride 的 expand view 表达这种重复。输出算子是否分配，与输入是否被扩展是两回事。"
caption: "格子按阶段追踪 shape、数值、stride、storage 或计算边界；精确结论必须继续用维度、数值和断言验证。"
actionLabel: "播放张量变化"

#### 步骤

- 从尾维比较，相等、1 或缺失维可对齐 | 从尾维比较，相等、1 或缺失维可对齐。
- 扩展可由 size=1/zero-s | 扩展可由 size=1/zero-stride view 表示。
- backward 对被扩展维执行 r | backward 对被扩展维执行 reduce-to-shape。
- 原地左值不能因 broadcast  | 原地左值不能因 broadcast 改变 shape。
- broadcast 的方向固定从尾维 | broadcast 的方向固定从尾维开始；轴名决定应在哪一位置插入 1。

#### 观察重点

- 从左维对齐并误放 singleton。
- 把 expand 当成真实复制或当成可随意写的 buffer。
