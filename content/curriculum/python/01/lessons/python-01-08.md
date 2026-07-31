---
id: "python-01-08"
track: "python"
title: "弱引用与 finalizer"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "weakref · Weak references"
url: "https://docs.python.org/3/library/weakref.html"

弱引用可以观察对象而不延长其生命周期；finalize 提供独立清理回调，并避免直接依赖 __del__ 的对象图细节。

## 导读

弱引用像通讯录里的地址：可以在对象活着时找到它，却不拥有“让它继续活着”的权利。缓存、观察者表和对象到元数据的映射因此能在对象消失时自动失效。

调用 weakref.ref 得到的结果必须先保存到局部变量再检查，因为另一个线程或回调可能在两次调用之间释放目标。WeakKeyDictionary 与 WeakValueDictionary 把这一语义封装成容器。

weakref.finalize 把清理函数与目标生命周期关联，同时让 finalizer 自身保持存活。回调不能强引用目标，否则闭包会反向延长目标生命周期，形成“永远等不到清理”的环。

## 核心机制

- 支持弱引用的类型需要提供 weakref slot；含 __slots__ 的类必须显式保留 __weakref__。
- 目标析构时弱引用被清空，并按实现规定触发回调；回调顺序不应承担业务正确性。
- finalize 只保证尽力清理，进程强制退出、崩溃或解释器关闭阶段仍有限制。
- 重要资源应优先用 with 显式释放，finalizer 只做遗忘关闭时的安全网。

## 常见误区

- 弱引用回调或 finalize 参数捕获目标对象，使目标通过回调再次被强引用。
- 先判断 ref() is not None，再次调用 ref() 使用，留下检查与使用之间的竞态窗口。
- 把数据库提交、支付等业务动作放在 finalizer 中，执行时机无法满足事务合同。

## 可运行示例

```python
import gc
import weakref

events = []

class Resource:
    pass

resource = Resource()
probe = weakref.ref(resource)
cleanup = weakref.finalize(resource, events.append, "released")

del resource
gc.collect()

assert probe() is None
assert events == ["released"]
assert not cleanup.alive
```

## 搭积木复现

### 实现不拥有对象的缓存

先用普通 dict 复现缓存延长生命周期，再换 WeakValueDictionary 验证条目自动消失。

### 设计安全回调

让回调只接收资源句柄或不可变标识，禁止闭包捕获目标对象本身。

### 加入显式释放

实现 close/context manager，并让 finalize 作为幂等后备路径；测试重复调用不会重复释放。

## 自检

### 问题

为什么资源类即使配置了 finalizer，仍应提供 close 或上下文管理器？

### 站内答案

finalizer 的执行取决于对象何时变得不可达以及解释器环境，无法保证事务所需的确定时机。close/with 把资源边界写进控制流，可测试且能及时释放；finalizer 只在调用者遗忘清理时提供幂等兜底。
