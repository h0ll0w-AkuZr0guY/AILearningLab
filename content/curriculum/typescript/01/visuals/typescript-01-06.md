---
lesson: "typescript-01-06"
track: "typescript"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 切换参数，观察「this、arrow、call/apply/bind、new 与 super」

id: "typescript-01-06-main"
kind: "playground"
placement: "example"
summary: "JavaScript 的 this 不是函数定义处某个普通局部变量，也不是永远指向“拥有该函数的对象”。更准确的推导从调用表达式开始：obj.method() 求值时保留一个包含 base=obj 的 Reference Record；EvaluateCall 从这个 Reference 取出函数值，同时把 base 作为 thisValue。const f = obj.method; f() 先执行 GetValue 丢掉 Refer"
caption: "控件改变可观察状态或运行结果；静态类型事实、JavaScript 运行时事实与宿主行为必须分别验证。"
actionLabel: "播放运行时切换"

#### 步骤

- EvaluateCall 从 pro | EvaluateCall 从 property Reference 的 base 取得 thisValue；提前 GetValue 会丢失这个 receiver 线索。
- OrdinaryCallBindTh | OrdinaryCallBindThis 根据 lexical、strict、global 三种 [[ThisMode]] 初始化 Function Environment 的 this binding。
- arrow 不创建自己的 this、 | arrow 不创建自己的 this、arguments、super 或 new.target binding，而是沿词法环境解析。
- Bound Function [[C | Bound Function [[Call]] 使用 [[BoundThis]] 并前置 [[BoundArguments]]；重复 bind 不能覆盖内层 this。
- [[Construct]] 传递 N | [[Construct]] 传递 NewTarget、创建或取得实例并应用构造返回规则；bound constructor 忽略 [[BoundThis]]。

#### 观察重点

- 背诵“谁调用 this 就是谁”，却无法解释 detached method、(0, obj.m)()、strict/sloppy 与 getter 返回函数。
- 认为 arrow 创建时复制 this 值；它实际沿词法环境解析同一个 this binding。
