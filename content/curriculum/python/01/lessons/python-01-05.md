---
id: "python-01-05"
track: "python"
title: "小整数缓存与字符串驻留"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "Data model · Identity is an implementation detail"
url: "https://docs.python.org/3/reference/datamodel.html#objects-values-and-types"

不可变值可以复用已有对象，但缓存范围和驻留策略属于实现细节；值语义应使用 ==，不能依赖 is。

## 导读

不可变对象无法被原地改成另一个值，所以解释器可以安全复用常见对象。CPython 会预创建一段小整数对象，编译器和运行时也可能驻留满足条件的字符串，以减少分配并加速部分字典查找。

缓存与驻留解决的是性能问题，不是语言层身份承诺。相同源码常量可能在同一 code object 中被合并，运行时拼接得到的同值字符串却可能是新对象；交互式环境、优化级别和解释器版本也会改变现象。

sys.intern 提供显式字符串驻留。它适合大量重复标识符，并让比较在哈希相等后更快命中身份；普通业务文本使用它反而可能延长对象生命周期并增加全局表压力。

## 核心机制

- 小整数对象在解释器生命周期内预创建，常见范围属于 CPython 配置和实现细节。
- 编译期常量折叠可以让同一 code object 的等值常量共享对象。
- 字符串驻留表以内容查找规范对象，sys.intern 返回表中的共享实例。
- == 仍然表达值语义；is 只用于 None、显式单例和调用者明确要求的身份合同。

## 常见误区

- 把某次 REPL 中 a is b 的结果写进业务条件，代码在文件、函数或另一 Python 实现中改变。
- 认为所有短字符串都会自动驻留。包含空格、动态构造和跨 code object 的行为可能不同。
- 对高基数临时文本滥用 sys.intern，节省的比较成本小于驻留表带来的常驻内存。

## 可运行示例

```python
import sys

left = "".join(["tenant", "_", "id"])
right = "tenant_id"

assert left == right
# 动态构造是否自动共享身份不能作为合同。

interned_left = sys.intern(left)
interned_right = sys.intern(right)
assert interned_left is interned_right
```

## 搭积木复现

### 分离语言保证与实现现象

先写只依赖 == 的正确程序，再把 is 实验放在诊断代码中，避免测试锁死实现细节。

### 改变构造位置

比较源码常量、运行时 join、函数返回值与 sys.intern，在不同位置记录 id。

### 估算驻留收益

构造重复标识符与高基数文本两组数据，比较内存和相等比较次数，决定是否值得显式驻留。

## 自检

### 问题

为什么“小整数 is 比较经常成功”反而是一道危险的面试题？

### 站内答案

它容易把 CPython 当前缓存现象误讲成 Python 语言语义。正确答案必须区分值相等、对象身份和实现优化，并指出任何需要判断数值相等的程序都应使用 ==。
