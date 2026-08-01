---
lesson: "torch-02-08"
track: "torch"
decision: "读完正文仍难以在脑中同时握住「三个桶」和「一次不对称合并」这两层：同样是 float32 与 float64，换成零维张量结果就翻转。障碍不在规则文字，而在看不见每个操作数落进了哪个桶、以及最终那次 combine 读的是哪一侧。用 tensor 格子把三个桶并排摊开，逐个操作数投放并当场算出合并结果，才能把 rank 与 dtype 两个维度分开看。"
---

## 视觉实验

### 把操作数投进三个桶再合并

id: "torch-02-08-three-buckets"
kind: "tensor"
placement: "chapter:2"
summary: "并排列出 dimResult、zeroResult、wrappedResult 三个桶，把 float32 一维张量、float64 零维张量、Python 字面量 200 依次投入，观察每次投放改变哪一格，以及最后一次 combine_categories 为什么直接返回有维桶而忽略低优先桶的位宽。"
caption: "上排三格是三个桶的当前 ScalarType，下排是每一步的判据（dim()>0 / is_wrapped_number / 类别比较）；图中省略了 promoteTypes 的完整查找表，具体格子仍以 torch.promote_types 的返回值为准。"
actionLabel: "投放下一个操作数"

#### 步骤

- 空状态 | 三个桶都是 Undefined，此时 result_type 无定义，需要至少一个操作数才能求值。
- 投一维 | float32 一维张量因 dim()>0 落入 dimResult，这个桶从此拥有最高优先级。
- 投零维 | float64 零维张量既非 wrapped 也非有维，落入 zeroResult，位宽虽大但优先级低。
- 合并低桶 | 先算 combine(zeroResult, wrappedResult)，得到一个统一的低优先候选类型。
- 最终合并 | combine(dimResult, 低优先候选) 命中 isFloatingType(higher) 分支直接返回 float32，位宽在此完全不参与比较。

#### 观察重点

- 推进到「最终合并」前先预测：把零维的 float64 换成一维 float64，哪一个桶会变、结果会不会翻转成 float64。
- 用示例里的四条 torch.result_type 断言核对图中终态，再把 float32 换成 int32 重跑一遍，确认跨类别时低优先桶才重新获得发言权。
