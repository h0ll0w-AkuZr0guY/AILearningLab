---
lesson: "transformer-01-03"
track: "transformer"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 沿时间线推演「einsum 记号」

id: "transformer-01-03-main"
kind: "flow"
placement: "overview"
summary: "einsum 用字母给每条轴命名，再声明哪些轴保留、哪些轴求和。它把 transpose、broadcast、multiply 和 sum 合在一个可检查的字符串中。"
caption: "箭头表达本课讨论的因果与执行顺序，不承诺真实墙钟时长；并行、失败和回退分支仍以源码与可运行实验为准。"
actionLabel: "播放执行流程"

#### 步骤

- einsum 用字母给每条轴命名，再 | einsum 用字母给每条轴命名，再声明哪些轴保留、哪些轴求和。它把 transpose、broadcast、multiply 和 sum 合在一个可检查的字符串中。
- 公式 "btd,dh->bth" 表 | 公式 "btd,dh->bth" 表示：输入分别拥有 [batch,time,dimension] 与 [dimension,hidden]，d 同时出现但没有出现在输出中，所以沿 d 求和；b、t、h 被保留。
- einsum 更接近数学推导，但过长 | einsum 更接近数学推导，但过长表达式会降低可读性。工程中应让字母与 shape 注释对应，并用普通 matmul 版本作为测试基准。

#### 观察重点

- 点击下一阶段前，先写下你预测的 shape、数值、状态或控制流变化。
- 图示结论必须能被本页可运行示例和至少一个失败用例验证。
