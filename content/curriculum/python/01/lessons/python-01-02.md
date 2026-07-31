---
id: "python-01-02"
track: "python"
title: "身份、相等与哈希契约"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-01-02.md"
---

## 官方入口

title: "Data model · Objects, values and types"
url: "https://docs.python.org/3/reference/datamodel.html#objects-values-and-types"

身份在对象创建后保持不变；is 比较身份，== 调用富比较协议；可哈希对象还必须保证相等对象拥有相同哈希值。

## 导读

is 回答“是否为同一个对象”，== 回答“两个对象是否按某种领域规则相等”。前者在 CPython 中近似比较地址，后者会进入 __eq__ 协议，因此可以执行用户代码、返回 NotImplemented，甚至产生非 bool 的中间结果。

字典和集合先用 hash 缩小候选槽位，再用身份或相等判断确认键。由此得到一条不可破坏的契约：a == b 为真时，hash(a) 必须等于 hash(b)。反方向不成立，哈希冲突是正常情况。

可变对象通常不可哈希，因为对象进入 dict 后若参与哈希的字段发生变化，查找将沿新哈希前往另一组槽位，原条目会像“丢失”一样留在旧位置。

## 核心机制

- is 不调用魔术方法，适合 None、哨兵对象和缓存对象的身份判断。
- a == b 先尝试左操作数的富比较；遇到子类优先级或 NotImplemented 时可能尝试右侧反射路径。
- object.__eq__ 的默认行为建立在身份上；值对象通常覆盖 __eq__ 并同步定义 __hash__。
- dict 查找组合使用哈希、探测序列和相等比较；哈希相同只意味着需要进一步比较。

## 常见误区

- 用 is 比较整数或字符串值。缓存和驻留会让它在部分运行中“碰巧正确”，换构造方式或解释器就失败。
- 只覆盖 __eq__ 而沿用不一致的 __hash__。Python 对普通类会主动把 __hash__ 设为 None，避免产生损坏的键。
- 认为 == 必定返回 bool。NumPy、PyTorch 等对象会返回逐元素结果，放进 if 时可能抛出“truth value ambiguous”。

## 可运行示例

```python
class UserKey:
    def __init__(self, tenant: str, user_id: int):
        self.tenant = tenant
        self.user_id = user_id

    def __eq__(self, other):
        if not isinstance(other, UserKey):
            return NotImplemented
        return (self.tenant, self.user_id) == (other.tenant, other.user_id)

    def __hash__(self):
        # 与 __eq__ 使用完全相同的不可变字段。
        return hash((self.tenant, self.user_id))

a = UserKey("acme", 7)
b = UserKey("acme", 7)
assert a is not b
assert a == b
assert hash(a) == hash(b)
assert {a: "cached"}[b] == "cached"
```

## 搭积木复现

### 区分两个问题

用两个内容相同的对象分别验证 is 与 ==，再加入单例哨兵验证身份判断的合理场景。

### 实现 NotImplemented 路径

让 __eq__ 对不支持的类型返回 NotImplemented，观察 Python 如何尝试另一侧并最终产生 False。

### 把对象放进 dict

让 __eq__ 与 __hash__ 共用同一组不可变字段，再故意修改字段复现键失联问题。

## 自检

### 问题

为什么“哈希值相同”不能推出对象相等，而“对象相等”必须推出哈希值相同？

### 站内答案

哈希空间有限，无限多的对象必然会碰撞，所以相同哈希只用于筛选候选；dict 仍需调用相等协议确认。相等对象若产生不同哈希，会被放入不同探测起点，容器将无法用一个等价键找到已有条目，因此 Python 要求相等蕴含同哈希。
