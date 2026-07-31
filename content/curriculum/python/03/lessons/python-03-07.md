---
id: "python-03-07"
track: "python"
title: "装饰器求值、应用顺序与带参装饰器"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "Function definitions · Decorators"
url: "https://docs.python.org/3/reference/compound_stmts.html#function-definitions"

decorator expressions 在定义函数时由上到下求值；得到的 callable 在函数创建后由下到上嵌套应用。

## 导读

装饰器包含两个时间轴。`@factory(arg)` 表达式在 def 所在作用域立即求值，用于准备 decorator；函数对象创建后，最靠近 def 的 decorator 先接收函数，返回值再交给上一层。

@outer @inner def f 等价于 f = outer(inner(f))，但原函数不会先临时绑定到 f。带参装饰器因此有三层调用：factory(config) 在定义期，decorator(function) 在定义期，wrapper(*args) 在每次调用期。

装饰器可以返回任意对象，函数名称最终绑定的是返回值。缓存、注册和权限装饰器若在导入期产生副作用，要考虑重复导入、测试隔离和进程启动顺序。

## 核心机制

- 表达式求值顺序自上而下，应用顺序自下而上；两者不能混为一个顺序。
- 闭包装饰器把配置保存在 factory 创建的 cell 中。
- 类装饰器和 callable object 也可作为 decorator，返回值无需是 function。
- 定义期注册表修改属于 import side effect，应设计幂等键与冲突检测。

## 常见误区

- 只背 outer(inner(f))，却在有副作用 factory 时预测错求值日志顺序。
- decorator 在模块导入期连接网络或读取不可控环境，测试和 CLI 启动变脆弱。
- 同一函数被重复注册时静默覆盖，reload 后路由表行为不确定。

## 可运行示例

```python
events = []

def factory(name):
    events.append(f"evaluate:{name}")
    def decorate(fn):
        events.append(f"apply:{name}")
        def wrapper(*args, **kwargs):
            events.append(f"call:{name}")
            return fn(*args, **kwargs)
        return wrapper
    return decorate

@factory("outer")
@factory("inner")
def work():
    return "ok"

assert events == [
    "evaluate:outer", "evaluate:inner",
    "apply:inner", "apply:outer",
]
assert work() == "ok"
assert events[-2:] == ["call:outer", "call:inner"]
```

## 搭积木复现

### 记录三阶段事件

分别记录 factory 求值、decorator 应用和 wrapper 调用，禁止只靠记忆判断顺序。

### 展开等价赋值

手写 decorators = [outer, inner] 与反向应用，比较日志和最终返回对象。

### 实现幂等注册器

用稳定 key 注册函数，重复同对象允许、冲突对象报错，并为 reload 写测试。

## 自检

### 问题

为什么多个装饰器的“表达式求值顺序”和“应用顺序”方向相反？

### 站内答案

解释器先按源码从上到下求值每个 decorator expression，保存 callable；函数对象创建后要构成 outer(inner(function))，所以必须从最靠近 def 的 inner 开始向外折叠。
