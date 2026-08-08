---
lesson: "langchain-02-05"
track: "langchain"
decision: "读完 profile 生命周期后仍难以把支持、不支持和未知三态与自动解析、显式覆盖、warning 的顺序联系起来，因此用 state 展示能力画像的生命周期。"
---

## 视觉实验

### 让能力画像经过三态决策

id: "langchain-02-05-profile-negotiation"
kind: "state"
placement: "chapter:3"
summary: "观察 profile 从缺失、自动解析或显式覆盖进入能力门，再分流到使用、回退或未知处理。"
caption: "画像只表达已登记能力，字段可缺省且 beta 格式可能变化；验证入口是固定 commit 的 `chat_models.py#L366-L431`、`model_profile.py#L13-L30`、`#L155-L183` 和测试。"
actionLabel: "推进能力协商"

#### 步骤

- 未知画像 | `profile=None`，模型仍可构造，但能力决策不能默认支持。
- 自动注入 | partner 的 `_resolve_model_profile` 尝试按模型标识加载画像。
- 显式覆盖 | 调用者提供 profile 时保留覆盖值，自动 resolver 不替换它。
- 字段审计 | unknown key 触发 warning，提示 core/provider package 可能版本错配。
- 三态门控 | `.get(required)` 得到 True 使用、False 回退、缺失进入保守 unknown 分支。

#### 观察重点

- 点击前预测：resolver 抛异常后，模型是否仍可创建；True、False、缺失是否走同一条路径。
- 用示例验证三态决策与 unknown key warning；不要把视觉画像当作真实 provider 能力证明。
