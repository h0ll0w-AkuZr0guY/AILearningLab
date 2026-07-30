---
id: "python-09-03"
track: "python"
title: "dict 紧凑布局、探测序列与哈希冲突"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "C API · Dictionary Objects"
url: "https://docs.python.org/3/c-api/dict.html"

CPython dict 是开放寻址哈希表；现代紧凑布局分离稀疏索引与按插入顺序排列的 entries。

## 真实源码

repo: "python/cpython"
file: "Objects/dictobject.c"
symbol: "do_lookup"
language: "c"
url: "https://github.com/python/cpython/blob/main/Objects/dictobject.c"

### 逐段讲解

- 先以 hash & mask 选择槽；槽保存 entry index、EMPTY 或 DUMMY，不直接保存完整键值。
- hash 相同还要比较键身份/相等；比较可执行 Python 代码并改动 dict，因此实现必须在回调后复查版本与 entry。
- 冲突通过 perturb 探测新的槽，表必须保留可用空槽，装载率过高时 resize。

### 源码节选

```c
static Py_ALWAYS_INLINE Py_ssize_t
do_lookup(PyDictObject *mp, PyDictKeysObject *dk, PyObject *key,
          Py_hash_t hash, check_lookup_func check_lookup)
{
    size_t mask = DK_MASK(dk);
    size_t perturb = hash;
    size_t i = (size_t)hash & mask;

    for (;;) {
        Py_ssize_t index = dictkeys_get_index(dk, i);
        if (index >= 0) {
            int cmp = check_lookup(mp, dk, ep0, index, key, hash);
            if (cmp < 0 || cmp > 0)
                return cmp ? index : DKIX_ERROR;
        }
        else if (index == DKIX_EMPTY) {
            return DKIX_EMPTY;               // 只有从未使用槽能终止未命中
        }
        perturb >>= PERTURB_SHIFT;
        i = mask & (i * 5 + perturb + 1);    // 打散相同初始槽的探测路径
    }
}
```

## 导读

紧凑 dict 用 indices 做稀疏探测表，用 entries 顺序保存 hash/key/value。迭代 entries 自然保持插入顺序，indices 可选择 1/2/4/8 字节宽度，避免每个空槽都携带大 entry。

删除不能简单写 EMPTY，否则会截断其他冲突键的探测链，所以留下 DUMMY；大量删除会增加探测并触发重建。哈希相等不代表键相等，最终仍调用 equality，且该调用可能抛异常或重入修改表。

## 核心机制

- 可哈希键要求生命周期内 hash 稳定，且相等键 hash 相同。
- 身份相同可跳过昂贵 equality。
- resize 同时控制 usable fraction 与 DUMMY 累积。
- split table 可让同类实例共享 keys 布局，仅分离 values。

## 常见误区

- 自定义 __eq__ 相等却给不同 hash，使同一逻辑键并存。
- __hash__/__eq__ 依赖可变字段，插入后键“失踪”。
- 用攻击者可控昂贵 equality 对象作大 dict 键，形成 CPU DoS。

## 可运行示例

```python
class Key:
    comparisons = 0
    def __init__(self, value):
        self.value = value
    def __hash__(self):
        return 1                       # 故意制造所有键初始冲突
    def __eq__(self, other):
        type(self).comparisons += 1
        return isinstance(other, Key) and self.value == other.value

mapping = {Key(i): i for i in range(100)}
Key.comparisons = 0
assert mapping[Key(99)] == 99
assert Key.comparisons > 1             # 平均 O(1) 假设已被破坏
```

## 搭积木复现

### 实现开放寻址

indices + entries，区分 EMPTY/DUMMY，按 hash/equality 查找。

### 加入扰动与 resize

统计 load factor、平均 probe、p99 probe 和 DUMMY 比例。

### 测试可重入比较

__eq__ 中修改 mapping，验证版本检查或安全重试策略。

## 自检

### 问题

dict 删除槽为什么要保留 DUMMY，而不能直接变成 EMPTY？

### 站内答案

冲突键可能沿探测链越过该槽存放。查找看到 EMPTY 会断定后面不可能有目标并提前终止；DUMMY 表示此处可插入但查找必须继续，保持现有探测链可达。
