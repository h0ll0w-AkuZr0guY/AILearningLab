---
id: "python-05-03"
track: "python"
title: "raise、bare raise 与 traceback 保真"
depth: "foundation"
exampleLanguage: "python"
---

## 官方入口

title: "Simple statements · The raise statement"
url: "https://docs.python.org/3/reference/simple_stmts.html#the-raise-statement"

无参数 raise 重抛当前活动异常；raise exc 在当前位置再次抛对象，会把当前处理器位置加入 traceback。

## 导读

bare raise 表示继续传播当前活动异常，保留原失败栈形状。raise exc 会执行一次新的 raise，把当前这一行加入 traceback；两者常打印出相似类型，却会改变定位根因时看到的路径。

异常实例可被重复抛出，__traceback__ 会更新。Python 3.11 起，在 except 中修改活动异常 traceback 后执行 bare raise，会携带修改后的 traceback；这对框架裁剪内部栈有用，也容易掩盖证据。

包装层如果不改变抽象，记录后应 bare raise；若跨架构边界翻译为领域异常，则用 raise NewError(...) from exc 保留因果链。

## 核心机制

- raise 只能在活动异常处理上下文重抛，否则 RuntimeError。
- raise SomeError 会按无参构造异常实例，通常显式实例更清楚。
- exc.with_traceback(tb) 返回同一个异常对象并设置 traceback。
- traceback 保真应通过测试 stack frame names，而不只断言异常类型。

## 常见误区

- except Exception as exc: raise exc，无意中增加包装层 frame 并干扰错误聚合签名。
- 为了隐藏内部实现随意清空 traceback，导致线上无法定位根因。
- 复用同一异常单例跨请求抛出，traceback 和 notes 互相污染。

## 可运行示例

```python
def origin():
    raise ValueError("bad")

def preserve():
    try:
        origin()
    except ValueError:
        raise

def reset_site():
    try:
        origin()
    except ValueError as exc:
        raise exc

def frame_names(call):
    try:
        call()
    except ValueError as exc:
        names = []
        tb = exc.__traceback__
        while tb:
            names.append(tb.tb_frame.f_code.co_name)
            tb = tb.tb_next
        return names

assert frame_names(preserve).count("preserve") == 1
assert frame_names(reset_site).count("reset_site") == 2
```

## 搭积木复现

### 比较栈形状

对 bare raise、raise exc、raise New from exc 分别收集 frame name 和 cause/context。

### 制定包装规则

同一抽象层 bare raise；跨边界翻译类型并 from；只补信息时优先 add_note。

### 写回归断言

断言根因类型、cause 和最内层业务 frame 均保留，防止重构破坏诊断链。

## 自检

### 问题

except 中的 raise 与 raise exc 有何实际差别？

### 站内答案

bare raise 继续当前传播，保留原 traceback 作为主要路径；raise exc 是在当前行重新执行一次抛出，会把处理器中的这一帧位置加入 traceback。若只是记录后继续失败，应 bare raise；若翻译抽象，则创建新异常并用 from 建立因果。
