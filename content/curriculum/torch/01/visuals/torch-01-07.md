---
lesson: "torch-01-07"
track: "torch"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 把「slice、select 与 narrow：storage_offset 和步长切片」落到可见张量

id: "torch-01-07-main"
kind: "tensor"
placement: "chapter:2"
summary: "切片的关键并非“取出一些元素”，而是把一个逻辑坐标域缩小后仍嵌入原来的地址公式。`x[:, 1:4:2]`保留第 0 维 stride，把第 1 维 stride 乘以 2，并把第一个合法位置写进 storage_offset；因此它通常无 copy，却很容易产生洞与非连续布局。"
caption: "格子按阶段追踪 shape、数值、stride、storage 或计算边界；精确结论必须继续用维度、数值和断言验证。"
actionLabel: "播放张量变化"

#### 步骤

- narrow 通过 slice 统一 | narrow 通过 slice 统一实现，并先规范化负 start 与边界。
- step slice 将该维 str | step slice 将该维 stride 乘 step，起点贡献写入 storage_offset。
- select 删除固定维度 | select 删除固定维度；narrow 保留维度但缩小 size。
- basic indexing 通常可 | basic indexing 通常可表示为 view，advanced indexing 的读取是 gather copy。
- offset 是起点，stride  | offset 是起点，stride 是每步跨度，二者共同定义 slice 的物理窗口。

#### 观察重点

- 认为 slice 的 numel 等于占用或保留的 Storage 字节。
- 把 basic 与 advanced indexing 的读取别名混为一谈。
