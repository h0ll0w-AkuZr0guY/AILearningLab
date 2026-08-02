---
lesson: "langchain-01-07"
track: "langchain"
decision: "读完 config 文字后，学习者仍难以观察业务值、可继承标签和不可继承运行身份如何沿同一调用树分开移动，因此用 state 视觉并置两条通道。"
---

## 视觉实验

### 分开业务值与调用配置

id: "langchain-01-07-config-state"
kind: "state"
placement: "chapter:3"
summary: "单步观察 ensure、merge、patch 和 child run，确认 value 发生转换时 config 只按字段规则传播，父 run id 不会复制给子 run。"
caption: "白色卡片是业务值，紫色卡片是 config；tags/metadata 可继承，run_name/run_id 属于当前身份，未知键进入 configurable。精确合并语义仍以 config.py 和断言为准。"
actionLabel: "推进 config 传播"

#### 步骤

- 原始调用 | value=3 与 root config 同时进入 Runnable，输入与控制面仍保持分离。
- 归一化 | 默认键补齐，未知 timeout 被放进 configurable，可变 tags/metadata 得到副本。
- 合并子项 | child 加入 parse tag 和 step metadata，业务值从字符串变成整数。
- 重置身份 | callback manager 被 patch，子 run 获得新 id，父 run_name 不被冒充。
- 验证边界 | 修改子配置不会改变父配置，敏感数据不进入 metadata 的展示面。

#### 观察重点

- 每一步预测哪一条通道变化，尤其区分 value 的变换与 tags 的传播。
- 视觉省略 contextvar 的线程/任务边界和完整 callback manager 类型，必须回到源码与跨任务实验验证。
