---
lesson: "python-02-04"
track: "python"
decision: "C3 的尾部约束和 super 的动态起点仅用列表文字不易手推；图形化合并序列能显示候选何时被阻塞并连接到一次协作调用链。"
---

## 视觉实验

### 合并菱形继承并沿 MRO 继续

id: "python-02-04-c3-graph"
kind: "graph"
placement: "chapter:2"
summary: "展示 Leaf(Left, Right) 的三条输入序列、每一步合法候选和 `super(Left, leaf)` 从 MRO 中间继续的箭头。"
caption: "候选不得位于任一其他序列尾部的证据在 Objects/typeobject.c L3297-L3320；图只覆盖默认 C3，不表示元类自定义 mro。"
actionLabel: "推进 C3 合并"

#### 步骤

- 初始化序列 | 展开 `[Left, Root, object]`、`[Right, Root, object]` 与直接基类 `[Left, Right]`。
- 选择 Left | Left 不在其他尾部，加入结果；Root 因仍在 Right 的尾部而不能抢先。
- 选择 Right 与 Root | Right 成为合法头，之后 Root、object 依次进入，得到 Leaf 的完整 MRO。
- 动态继续 | `super(Left, leaf)` 定位 Left 后，从 Right 开始查找，不把 Left 的直接父类写死。

#### 观察重点

- 在每次推进前判断当前候选是否出现于任何尾部。
- 注意图描述逻辑线性化；多 slots 父类的物理布局限制是下一课另一条失败路径。
