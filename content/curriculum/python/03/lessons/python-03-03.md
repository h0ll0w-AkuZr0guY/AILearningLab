---
id: "python-03-03"
track: "python"
title: "frame、fast locals 与局部变量同步"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "Data model · Frame objects"
url: "https://docs.python.org/3/reference/datamodel.html#frame-objects"

frame 表示一次执行状态，连接 code、globals、builtins、局部槽位、指令位置与调用链；locals 映射的写回语义受作用域和版本约束。

## 导读

每次函数调用都会获得一份 frame 执行状态。相同函数递归调用时共享 code 和 globals，却拥有独立参数、局部变量、指令位置和调用者链接，这些差异都由 frame 承载。

CPython 为优化函数局部访问，把编译期确定的名称放进连续 locals-plus 槽位，LOAD_FAST/STORE_FAST 直接按索引操作，而非每次查字典。f_locals 或 locals() 是面向反射的映射视图，不能简单等同于解释器热路径存储。

调试器、trace 和 exec 需要在槽位与映射之间建立一致语义。现代 Python 对优化作用域 locals 的写入行为逐步标准化，但业务代码仍不应靠修改 locals() 改写真实局部变量。

## 核心机制

- frame.f_code 指向共享 code，f_globals/f_builtins 提供名称解析环境。
- co_varnames 与 locals-plus 槽位索引对应，LOAD_FAST 避免哈希查找。
- 闭包 cell 也位于 frame 的 locals-plus 区域，但通过 LOAD_DEREF 访问。
- 生成器和协程暂停时保留 frame 状态，普通函数返回后 frame 通常可释放，traceback 可能继续持有它。

## 常见误区

- 在函数内修改 locals()["x"] 并期待后续 LOAD_FAST 读取新值。
- 长期保存 frame 或 traceback 做调试缓存，间接保留整个局部对象图造成泄漏。
- 把 CPython frame 私有布局当成跨版本扩展 ABI。

## 可运行示例

```python
import inspect

def snapshot(a, b):
    total = a + b
    frame = inspect.currentframe()
    assert frame is not None
    view = frame.f_locals
    return {
        "code": frame.f_code.co_name,
        "locals": dict(view),
        "last_instruction": frame.f_lasti,
    }

state = snapshot(2, 3)
assert state["locals"]["total"] == 5
assert state["code"] == "snapshot"
```

## 搭积木复现

### 比较递归 frame

递归调用同一函数，记录 f_code 身份相同、f_locals 和 f_lasti 各自独立。

### 对照 LOAD_FAST

用 dis 把 co_varnames 索引与局部变量指令对应，解释为何局部读取无需 dict。

### 复现 frame 泄漏

让异常 traceback 持有大对象，清理 traceback 后比较 weakref/tracemalloc，理解调试信息的所有权。

### 阅读 locals 同步入口

沿 frameobject.c 和内部 frame API 定位 locals 映射物化，不把某版本结构偏移写进实现。

## 自检

### 问题

为什么 CPython 不直接用普通 dict 保存和读取函数局部变量？

### 站内答案

局部名称在编译期已确定，连续槽位可用整数索引直接访问，避免每条 LOAD_FAST 做字符串哈希与字典探测。反射需要的 locals 映射可以按需物化或代理；代价是调试器和 exec 必须处理槽位与映射的一致性。
