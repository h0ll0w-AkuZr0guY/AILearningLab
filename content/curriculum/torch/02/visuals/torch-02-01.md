---
lesson: "torch-02-01"
track: "torch"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 逐帧对比「basic indexing」的状态边界

id: "torch-02-01-main"
kind: "state"
placement: "chapter:2"
summary: "`x[1, 2:5:2]`看起来像从数组里“拿出值”，更准确的模型是一台坐标变换器：整数把一条坐标固定，slice 缩小坐标域并可能放大 stride。输出因此能继续引用 x 的 Storage。这个模型能预测写传播、连续性和窗口为何会钉住大 buffer。"
caption: "左右状态卡只压缩本课的前态、现态与不变量；对象身份、生命周期或队列结论仍要用正文中的代码和源码分支验证。"
actionLabel: "播放状态变化"

#### 步骤

- 整数索引固定坐标、增加 offset | 整数索引固定坐标、增加 offset 并删除维度。
- slice 保留维度，按 step  | slice 保留维度，按 step 更新 size/stride/offset。
- 无 tensor index 时返回 | 无 tensor index 时返回 alias；高级索引才需要 gather。
- 非连续 view 仍可供许多算子消费 | 非连续 view 仍可供许多算子消费，是否物化由下游决定。
- 基本索引改写几何，不收集元素 | 基本索引改写几何，不收集元素；地址公式是别名事实的最小证明。

#### 观察重点

- 把 size=1 slice 当成 integer select。
- 用 `data_ptr()`不同断言 slice 不共享 storage。
