---
id: "python-02-07"
track: "python"
title: "C3 线性化手算与冲突检测"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-02-07.md"
---

## 官方入口

title: "Method Resolution Order · C3 algorithm"
url: "https://docs.python.org/3/howto/mro.html#the-c3-method-resolution-order"

C3 线性化同时保持局部父类顺序与单调性。merge 每轮只能选择不出现在任何其他序列 tail 中的 head；无候选说明继承约束冲突。

## 导读

多继承要把图变成一条确定的属性查找序列。C3 给出 L[C] = C + merge(L[B1], ..., L[Bn], [B1, ..., Bn])。最后那条直接父类列表用于保留类声明中的局部优先顺序。

merge 每轮查看各序列 head，候选若出现在任何其他序列 tail 中就不能选，因为选择它会让某个本应更早的类被越过。选中合法 head 后，把它从所有序列头删除并继续。

单调性保证：若 A 在父类的 MRO 中先于 B，派生类不能突然让 B 跑到 A 前面。无合法 head 时，Python 在类创建阶段抛 TypeError，拒绝一个无法同时满足约束的继承图。

## 核心机制

- 单继承自然得到 [Child, Parent, ..., object]，C3 的价值主要体现在 diamond 与多父类约束组合。
- 局部优先级来自 class C(A, B) 中 A 必须先于 B。
- 每个父类已有的线性化作为不可破坏的顺序约束参与 merge。
- __mro__ 服务所有属性查找，MRO 并不只决定 method。

## 常见误区

- 用深度优先搜索解释 Python 3 MRO，在复杂 diamond 中得出不单调顺序。
- merge 时只看第一个列表的 head，合法候选可能来自后续列表。
- 为了让冲突类“能创建”而机械交换父类顺序，没有审视继承是否表达了矛盾职责。

## 可运行示例

```python
def c3_merge(sequences):
    sequences = [list(seq) for seq in sequences if seq]
    result = []
    while sequences:
        candidate = next(
            (seq[0] for seq in sequences
             if all(seq[0] not in other[1:] for other in sequences)),
            None,
        )
        if candidate is None:
            raise TypeError("继承约束冲突：没有合法 head")
        result.append(candidate)
        sequences = [
            ([item for item in seq if item is not candidate])
            for seq in sequences
        ]
        sequences = [seq for seq in sequences if seq]
    return result

def linearize(cls):
    if not cls.__bases__:
        return [cls]
    return [cls, *c3_merge([
        *(linearize(base) for base in cls.__bases__),
        list(cls.__bases__),
    ])]
```

## 搭积木复现

### 从 diamond 手算

列出每个父类 MRO 和直接父类表，每轮圈出合法 head，并与 __mro__ 对照。

### 实现 merge

候选必须不在任意 tail 中；选中后只从序列头移除，保留剩余约束。

### 制造次序冲突

构造 A(X,Y)、B(Y,X)、C(A,B)，验证无合法候选并解释冲突来自哪两条约束。

### 审查继承设计

把冲突图改成组合或显式委托，而非只调整父类顺序，说明职责边界为何更清楚。

## 自检

### 问题

C3 为什么要求候选 head 不能出现在任何其他序列的 tail 中？

### 站内答案

出现在 tail 表示另一条已有约束要求该序列前面的类先于候选。此时提前选择候选会破坏父类已有 MRO 或直接父类顺序。只有不在任何 tail 的 head 才能在不违反全部偏序约束的前提下成为下一项。
