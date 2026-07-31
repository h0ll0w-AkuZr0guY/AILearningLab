---
id: "python-02-03"
track: "python"
title: "__getattr__ 兜底与递归陷阱"
depth: "foundation"
exampleLanguage: "python"
visualIndex: "../visuals/python-02-03.md"
---

## 官方入口

title: "Data model · object.__getattr__"
url: "https://docs.python.org/3/reference/datamodel.html#object.__getattr__"

__getattr__ 仅在正常属性查找未找到名称时被调用。它应返回派生值或抛 AttributeError；赋值需要另行实现 __setattr__。

## 导读

__getattr__ 适合表达“缺失名称可以如何派生”，例如代理远端字段、兼容旧名称、按需加载或给配置提供受控默认值。已有字段不会经过它，因此它比重写所有访问的 __getattribute__ 风险小。

点号表达式调用 type(obj).__getattribute__；若它以 AttributeError 结束，slot 逻辑再寻找 __getattr__。直接写 object.__getattribute__(obj, name) 只运行主链，不会自动补兜底，这个差异常用于实现安全的代理。

兜底必须对未知名称继续抛 AttributeError。返回 None 会让 hasattr 误判属性存在，也会把拼写错误推迟到更远位置。代理还要维护 allowlist，避免把内部私有属性和权限边界一起转发。

## 核心机制

- __getattr__ 从类上作为特殊方法解析，不是先从实例字典读取同名 callable。
- 只有 AttributeError 表示“正常缺失”；其他异常通常应原样传播。
- 读取内部状态时调用 object.__getattribute__，避免再次触发代理兜底。
- hasattr 本质上尝试 getattr 并吞掉 AttributeError，因此兜底的异常纪律会改变反射结果。

## 常见误区

- 兜底中写 self._backend，而 _backend 尚未初始化，又进入 __getattr__ 造成递归。
- 对所有缺失名称返回占位值，让拼写错误、接口漂移和权限问题静默通过。
- 捕获 Exception 后统一转成 AttributeError，掩盖后端超时、解析错误等真实失败。

## 可运行示例

```python
class Config:
    def __init__(self, values):
        object.__setattr__(self, "_values", dict(values))

    def __getattr__(self, name):
        values = object.__getattribute__(self, "_values")
        if name.startswith("_"):
            raise AttributeError(name)
        try:
            return values[name]
        except KeyError:
            raise AttributeError(name) from None

config = Config({"timeout": 3})
assert config.timeout == 3
assert not hasattr(config, "tiemout")
```

## 搭积木复现

### 只代理一个公开名称

先允许 timeout，其他名称全部抛 AttributeError，建立最小安全边界。

### 保护内部读取

用 object.__getattribute__ 读取 _values，并测试构造尚未完成时也不会无限递归。

### 分类失败

KeyError 转成 AttributeError；后端连接错误保持原样，让调用者能区分缺失和系统故障。

## 自检

### 问题

为什么 __getattr__ 返回 None 作为“通用默认值”会破坏 Python 的反射协议？

### 站内答案

hasattr 和许多框架用 AttributeError 判断名称是否存在。返回 None 会把任意拼写都报告为存在，IDE、序列化和兼容检查失去可靠信号；更远的代码才会以 NoneType 错误失败，根因被隐藏。
