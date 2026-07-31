---
lesson: "transformer-01-05"
track: "transformer"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 把「broadcast 规则」落到可见张量

id: "transformer-01-05-main"
kind: "tensor"
placement: "overview"
summary: "broadcast 让不同 shape 的张量在不真实复制数据的情况下参与逐元素运算。比较 shape 时从最后一维向前看，两条轴相等或其中一条为 1 才兼容。"
caption: "格子按阶段追踪 shape、数值、stride、storage 或计算边界；精确结论必须继续用维度、数值和断言验证。"
actionLabel: "播放张量变化"

#### 步骤

- broadcast 让不同 shap | broadcast 让不同 shape 的张量在不真实复制数据的情况下参与逐元素运算。比较 shape 时从最后一维向前看，两条轴相等或其中一条为 1 才兼容。
- 例如 [B,T,D] 加 [D] 时 | 例如 [B,T,D] 加 [D] 时，[D] 会被理解成 [1,1,D]，同一偏置应用到所有 batch 和 token。broadcast 改变的是索引规则，expand 得到的维度可能拥有 stride 0。
- 隐式 broadcast 很方便，也 | 隐式 broadcast 很方便，也容易掩盖轴写反。关键代码应先写 shape 断言，并在注释里写清哪条轴被扩展。

#### 观察重点

- 点击下一阶段前，先写下你预测的 shape、数值、状态或控制流变化。
- 图示结论必须能被本页可运行示例和至少一个失败用例验证。
