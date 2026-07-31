---
lesson: "langgraph-02-05"
track: "langgraph"
decision: "文字能列出结合律与幂等性，却难以让学习者看见同一批 update 被一次合并、拆成两批和重复提交时应如何收敛；状态流程把三个结果并置，方便逐步核对。"
---

## 视觉实验

### 比较一次合并、分批合并与冲突

id: "langgraph-02-05-version-merge"
kind: "state"
placement: "chapter:2"
summary: "以 order-7 的版本化状态为读数，逐步对比高版本更新、同更新重试与同版本不同 payload 的失败，强调 reducer 必须表达领域裁决。"
caption: "图中版本号和状态是可计算的教学数据；真正的 channel 调用顺序及 checkpoint 行为应回到 binop.py 和本课 Python 断言验证。"
actionLabel: "推进版本合并"

#### 步骤

- 初始记录 | order-7 为版本 1 pending，尚未存在任何工具更新。
- 高版本收敛 | approved 版本 2 写入后替代版本 1；相同写入重试不再改变结果。
- 平级冲突 | 版本 2 rejected 与 approved 内容不同，流程停在明确冲突而非任意覆盖。

#### 观察重点

- 预测把 approved 拆成两批提交后是否仍得到同一个状态。
- 区分“重复相同 update”与“同版本不同业务事实”。
