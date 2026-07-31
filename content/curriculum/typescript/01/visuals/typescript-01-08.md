---
lesson: "typescript-01-08"
track: "typescript"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 切换参数，观察「getter、setter、Proxy、Reflect 与 Receiver」

id: "typescript-01-08-main"
kind: "playground"
placement: "example"
summary: "读取 obj.x 看似只有对象和键，规范内部却携带三个角色：Receiver 是最初发起读取的对象，holder 是当前查找到 descriptor 的对象，descriptor 决定返回存储值还是调用 getter。若 x 在 Parent.prototype 上是 getter，而读取 child.x，holder 是 Parent.prototype，getter 的 this 仍是 child。这个分离支撑继承、super、Re"
caption: "控件改变可观察状态或运行结果；静态类型事实、JavaScript 运行时事实与宿主行为必须分别验证。"
actionLabel: "播放运行时切换"

#### 步骤

- descriptor 决定数据读取、 | descriptor 决定数据读取、getter 调用、setter 调用和属性可重配置边界。
- OrdinaryGet/Set 沿  | OrdinaryGet/Set 沿 holder/prototype 查规则，同时把最初 Receiver 传给 accessor 或最终存储。
- Reflect.get/set 显式 | Reflect.get/set 显式暴露 Receiver 并返回内部方法结果，适合透明转发。
- Proxy internal met | Proxy internal methods 先检查 revocation，再选择 trap 或目标默认路径。
- trap 结果经过 invarian | trap 结果经过 invariants 校验，不能与 target 的不可配置事实冲突。

#### 观察重点

- 认为 getter 的 this 是 descriptor 所在 prototype，而不是最初 Receiver。
- 在 get trap 中写 target[key] 丢失 Receiver，导致继承 getter 和 super-like 读取错误。
