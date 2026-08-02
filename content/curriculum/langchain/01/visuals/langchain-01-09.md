---
lesson: "langchain-01-09"
track: "langchain"
decision: "读完序列化边界后，学习者仍难以观察一个 payload 何时是可恢复对象、何时只是用户字典，以及 allowlist 在哪一步阻止实例化，因此用 flow 展示 dump 与 load 的分叉。"
---

## 视觉实验

### 让 manifest 穿过 dump 与 load

id: "langchain-01-09-serialization-flow"
kind: "flow"
placement: "chapter:3"
summary: "推进可序列化 Prompt、含 lc 的普通用户数据和未知 class path，观察生成、转义、allowlist 拒绝与安全恢复的不同路径。"
caption: "构造对象的 id/kwargs 只是可验证配置，用户字典的 lc 字段会被 escape；图示不执行网络或 secret，真实安全边界以 load.py、官方 allowlist reference 和断言为准。"
actionLabel: "推进序列化边界"

#### 步骤

- 生成 manifest | Serializable 对象产生 type、id 和 kwargs，普通对象不自动获得可执行身份。
- 转义用户值 | 用户字典含 `lc` 时包进 `__lc_escaped__`，保持它仍是普通数据。
- 检查 allowlist | 未知 class path 在 reviver 前后均不能越过 allowlist，分支明确拒绝。
- 恢复安全类 | 显式允许的 Prompt 按 kwargs 重建，版本与来源仍需应用层校验。
- 观察风险 | 恶意 base URL 只作为数据被展示，不触发真实网络；manifest 不能被当成无害 JSON。

#### 观察重点

- 预测 payload 会进入“恢复对象”还是“普通字典”分支，尤其关注 escaped 优先级。
- 视觉省略 secrets、旧 namespace 映射和构造副作用，精确结论必须回到源码和安全测试。
