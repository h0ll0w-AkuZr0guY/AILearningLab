---
lesson: "python-02-02"
track: "python"
decision: "文字难以同时呈现类字典、实例字典与点号读取的同名但不同值；状态视觉能让 data/non-data 切换的优先级差异可逐步观察。"
---

## 视觉实验

### 让同名字段争夺一次读取权

id: "python-02-02-descriptor-state"
kind: "state"
placement: "chapter:2"
summary: "并排显示类字典 descriptor、实例字典 shadow 值和 `obj.field` 返回值，切换 data 与 non-data 时只改变优先级，不伪造存储。"
caption: "data 判定的源码证据是 PyDescr_IsData 的 `tp_descr_set` 检查；property 没有 setter 时仍由设置路径拒绝写入。"
actionLabel: "切换描述器状态"

#### 步骤

- 类变量登记 | 类字典放入只实现 `__get__` 的 descriptor，实例字典尚无同名值。
- 实例遮蔽 | 实例字典写入同名值；non-data descriptor 处于实例值之后，点号读取返回实例值。
- data 接管 | 为 descriptor 加入 `__set__` 槽；同一实例字典值仍存在，但点号读取改由 descriptor 的 `__get__` 返回。
- 只读失败 | `__set__` 抛 `AttributeError`；读取仍由 data descriptor 接管，不能静默创建公开同名字段。

#### 观察重点

- 比较“字典里仍有 shadow 值”和“点号结果改变”两件同时为真的事实。
- 观察 data 的判据是设置槽存在，不能把“setter 能成功”当成判据。
