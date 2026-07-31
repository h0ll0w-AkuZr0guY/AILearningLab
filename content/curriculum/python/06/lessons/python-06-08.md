---
id: "python-06-08"
track: "python"
title: "循环导入、半初始化模块与依赖方向"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "The import system · Loading"
url: "https://docs.python.org/3/reference/import.html#loading"

模块执行前已进入 sys.modules；循环方会得到同一半初始化对象，只有此前执行过的名称可见。

## 导读

循环导入的表现取决于时间线。A 预缓存并执行，导入 B；B 取得半初始化 A。import A 只需要对象身份可能成功，from A import later_name 则会在 A 尚未执行到绑定点时报错。

局部 import 能延迟读取到调用期，偶尔是合理的可选依赖策略，但只移动环发生时间。根治方法通常是反转依赖、抽取共同合同、使用依赖注入或让注册发生在显式 bootstrap 阶段。

## 核心机制

- 同线程递归导入依赖预插入避免死循环。
- 父包 spec 记录 uninitialized_submodules，改善部分初始化诊断。
- 模块顶层定义顺序影响环中可见属性。
- 类型注解可用 TYPE_CHECKING、前向引用和延迟求值减少运行时环。

## 常见误区

- 通过调整两行 import 顺序“修好”，下一次新增顶层副作用又复发。
- 把所有 import 移入函数，隐藏架构双向依赖和冷路径延迟。
- 在模块顶层读取对方注册表并立即派生常量，使初始化顺序成为隐式配置。

## 可运行示例

```python
# 用两个内存模块模拟时间线：
import sys
import types

a = types.ModuleType("a")
sys.modules["a"] = a
a.early = "ready"            # A 已执行到这里

b = types.ModuleType("b")
sys.modules["b"] = b
b.seen_a = sys.modules["a"]  # B 的 import a 成功
assert b.seen_a.early == "ready"
assert not hasattr(b.seen_a, "late")

a.late = "now-ready"         # A 恢复后才完成绑定
assert b.seen_a.late == "now-ready"

del sys.modules["a"], sys.modules["b"]
```

## 搭积木复现

### 画执行时间线

按预缓存、逐条绑定、进入对方模块、返回继续执行标记每个名字何时出现。

### 区分身份与属性

测试 import peer 与 from peer import value 在半初始化窗口的差异。

### 消除方向环

抽取 protocol/events 到第三模块，或由 composition root 在两边创建后完成连接。

## 自检

### 问题

为什么循环导入中 import peer 可能成功，from peer import name 却失败？

### 站内答案

peer 模块对象已在执行前预插入 sys.modules，所以前者能取得同一对象；name 只有执行到相应赋值语句后才进入 peer.__dict__。循环路径在更早时刻访问该属性，就得到 partially initialized module 相关错误。
