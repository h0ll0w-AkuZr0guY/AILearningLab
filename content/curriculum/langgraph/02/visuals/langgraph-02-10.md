---
lesson: "langgraph-02-10"
track: "langgraph"
decision: "读者容易把所有失败都叫 validation error；流程图能让图定义、payload 形状和业务拒绝在不同阶段停止并显示不同处置。"
---

## 视觉实验

### 让订单穿过三层校验

id: "langgraph-02-10-validation-layers"
kind: "flow"
placement: "chapter:1"
summary: "以同名 channel 冲突、字符串金额和超额度订单为三个分支，观察各自的失败位置、错误主体和下一步。"
caption: "错误类别和 amount/limit 是可计算教学读数；真实 schema 支持范围应回到 Graph API 文档与 state.py 源码验证。"
actionLabel: "推进校验层级"

#### 步骤

- 建图检查 | 不兼容 reducer 使 builder 在启动时失败，用户请求尚未进入。
- 形状检查 | amount 为字符串时指出字段错误，禁止进入业务路由。
- 业务判断 | 正整数但超额度时产生 limit_exceeded，可进入人工审核而非伪造类型错误。

#### 观察重点

- 预测超额度订单会不会被 shape validator 当作格式错误拒绝。
- 用示例断言核对字符串 amount 是否有机会进入 validate_business。
