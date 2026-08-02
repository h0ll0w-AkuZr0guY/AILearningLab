---
lesson: "python-02-01"
track: "python"
decision: "学习者读完属性优先级文字仍难追踪同名字段在哪一站被消费；用可暂停流程呈现候选、异常与回退，比继续堆叠术语更可验证。"
---

## 视觉实验

### 让一次 `obj.name` 穿过默认读取链

id: "python-02-01-lookup-flow"
kind: "flow"
placement: "chapter:2"
summary: "按 object.c 的顺序显示类树候选、实例存储、non-data getter 与 AttributeError 回退；每步都标示该名字是否已被消费。"
caption: "教学流程省略 CPython 的 inline values 与 managed dict 分支；优先级证据见 Objects/object.c L1841-L1924，回退见 Objects/typeobject.c L10412-L10425。"
actionLabel: "推进属性读取"

#### 步骤

- MRO 类查找 | 在 `type(obj).__mro__` 中发现同名类项；若它是 data descriptor，本步立即返回。
- 实例存储 | 没有 data descriptor 时检查实例值；命中则返回，普通类项和 non-data getter 尚未执行。
- 类项或失败 | 实例未命中时执行 non-data `__get__` 或返回普通类值；全缺失则形成 `AttributeError`。
- 回退钩子 | 仅前一步是 `AttributeError` 时调用 `__getattr__`；它返回值或再次抛错。

#### 观察重点

- 预测同名实例字段在 data descriptor 与普通类字段两种情形下会在哪一步获胜。
- 注意视觉中的“实例存储”是协议模型；slots、inline values 与 managed dict 的物理布局不在图中承诺。
