---
lesson: "torch-01-06"
track: "torch"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 逐帧对比「transpose、permute 与 movedim：只改维度解释的零拷贝重排」的状态边界

id: "torch-01-06-main"
kind: "state"
placement: "chapter:2"
summary: "卷积代码常把 NCHW 改写成 NHWC，注意力代码又在 batch、head、sequence、feature 之间换轴。若每次换名字都复制整块激活，带宽会先于算力成为瓶颈。普通 strided Tensor 的 transpose、permute 与 movedim 给出的承诺很克制：它们换坐标轴的解释，底层字节仍由同一个 Storage 持有。"
caption: "左右状态卡只压缩本课的前态、现态与不变量；对象身份、生命周期或队列结论仍要用正文中的代码和源码分支验证。"
actionLabel: "播放状态变化"

#### 步骤

- transpose 交换两项 siz | transpose 交换两项 size/stride；permute 对全部轴做双射排列。
- movedim 将指定轴移动到目标位 | movedim 将指定轴移动到目标位置，未指定轴保持相对次序。
- 普通 strided 输出通过 as | 普通 strided 输出通过 as_strided 共享 Storage，往往失去默认 contiguous。
- 下游 kernel 可以接受 str | 下游 kernel 可以接受 stride，也可能触发或要求物化。
- 轴排列必须作用于 size 和 st | 轴排列必须作用于 size 和 stride 两者；只检查输出 shape 不足以验证重排。

#### 观察重点

- 用 view 代替 permute，只改 shape 而没有同步坐标含义。
- 把 `data_ptr`不同的 slice 误判为没有共享 Storage。
