---
lesson: "python-02-05"
track: "python"
decision: "对象字段、弱引用和复制后的共享关系涉及多个对象与边，单靠文字难判断哪条引用保持存活；状态图让强边、弱边与 memo 的变化可观察。"
---

## 视觉实验

### 看见对象形状与复制后的引用边

id: "python-02-05-object-graph"
kind: "state"
placement: "chapter:5"
summary: "展示 slots 对象、其嵌套 list、weakref 与 shallow/deep copy 的强弱边，明确哪些对象在删除唯一强引用后可消失。"
caption: "图不承诺 CPython 内存字节布局；slots 行为以 type_new_slots 与官方数据模型为准，deepcopy memo 以 Lib/copy.py 为准。"
actionLabel: "推进对象图状态"

#### 步骤

- 固定字段 | slots 对象只接受声明字段；未声明动态名没有可写位置，weakref slot 是否存在单独标识。
- 弱观察 | weakref 指向目标但不增加强拥有边；保留强变量时 `ref()` 可取回目标。
- 浅复制 | 新外壳指向同一个嵌套 list，修改 list 会从两条外壳路径可见。
- 深复制与 memo | 新外壳和新 list 形成独立图；原图中重复边在新图中仍共同指向同一个 clone。
- 失去所有强边 | 删除最后一个强引用并收集后，weakref 返回空、WeakValueDictionary 移除键；资源关闭仍需显式协议。

#### 观察重点

- 区分“weakref 有指针”与“对象仍有强所有者”，不要把 callback 当资源管理器。
- 预测 shallow/deep 的 `is` 断言，并注意 memo 保留的是 clone 内部共享而非原对象身份。
