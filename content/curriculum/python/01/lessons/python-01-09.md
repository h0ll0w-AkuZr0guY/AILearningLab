---
id: "python-01-09"
track: "python"
title: "浅拷贝、深拷贝与图"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-01-09.md"
---

## 官方入口

title: "copy · Shallow and deep copy operations"
url: "https://docs.python.org/3/library/copy.html"

浅拷贝创建新的外层容器并复用内部对象；深拷贝递归复制，同时使用 memo 处理循环并保留共享关系。

## 导读

复制对象时真正的问题是“对象图哪些边应共享，哪些节点应独立”。浅拷贝只新建根节点并复制出边；深拷贝递归创建后代，但并非把每条路径都复制成独立树。

deepcopy 的 memo 以原对象身份记录已创建副本。它同时解决两个问题：遇到环时不会无限递归；多个路径指向同一原节点时，副本中仍指向同一个副本节点，保留别名拓扑。

类可以通过 __copy__、__deepcopy__ 或序列化协议定义边界。数据库连接、线程锁和共享缓存通常不应被复制；值对象、配置快照和可变聚合根则可能需要定制复制。

## 核心机制

- copy.copy 优先调用类型协议，然后按类型分发表创建外壳。
- copy.deepcopy 在递归前后维护 memo，并把 memo 继续传给子对象。
- 不可变原子对象通常直接返回自身，这仍符合深拷贝的“安全独立修改”目标。
- 自定义 __deepcopy__ 应尽早把新对象放入 memo，再复制字段以支持自引用。

## 常见误区

- 把 deepcopy 当作隔离所有外部状态的万能事务，复制了不应复制的句柄或昂贵模型。
- 自定义 __deepcopy__ 忘记传 memo，导致共享关系丢失或环递归。
- 只比较副本内容相等，没有用 is 断言验证目标层级的独立与共享合同。

## 可运行示例

```python
import copy

shared = {"tokens": []}
graph = {"left": shared, "right": shared}
clone = copy.deepcopy(graph)

assert clone is not graph
assert clone["left"] is clone["right"]   # 保留原图中的共享
assert clone["left"] is not shared       # 与原图隔离

clone["left"]["tokens"].append("x")
assert shared["tokens"] == []
```

## 搭积木复现

### 先画对象图

构造共享节点和环，明确目标副本应保留哪些内部别名，再选择 shallow 或 deep。

### 手写 memo deepcopy

实现 list/dict 两种节点；创建空副本后立刻写入 memo，再递归填充。

### 为领域对象定制

让不可复制资源继续共享或显式报错，让业务可变状态独立，并用身份断言验证合同。

## 自检

### 问题

为什么正确的深拷贝仍可能让副本中的两个字段指向同一个对象？

### 站内答案

深拷贝的目标是与原图隔离，同时保持原图拓扑。若原对象的两个字段共享同一节点，memo 会让它们在副本中共享同一个新节点；若分别复制成两个节点，反而改变了原有别名语义。
