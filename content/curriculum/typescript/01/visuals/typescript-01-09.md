---
lesson: "typescript-01-09"
track: "typescript"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 沿时间线推演「Promise resolution、thenable assimilation 与 Job queue」

id: "typescript-01-09-main"
kind: "flow"
placement: "chapter:3"
summary: "Promise 有 pending、fulfilled、rejected 三种内部状态，但“resolved”不是第四种状态。resolve(anotherPromise) 后，当前 promise 已被锁定为跟随 anotherPromise，后续 reject 无效，却可能继续 pending 到另一个 promise settle。把 resolved 等同于 fulfilled 会误判超时、监控状态和多次调用竞态。"
caption: "箭头表达本课讨论的因果与执行顺序，不承诺真实墙钟时长；并行、失败和回退分支仍以源码与可运行实验为准。"
actionLabel: "播放执行流程"

#### 步骤

- resolve/reject 共享  | resolve/reject 共享 AlreadyResolved Record，第一次调用锁定 promise 命运。
- self-resolution 以  | self-resolution 以 TypeError reject；primitive 直接 fulfill；object 只读取一次 then。
- then getter 抛错变 re | then getter 抛错变 rejection，非 callable then 让 object 作为普通 fulfillment value。
- callable then 被封装为 | callable then 被封装为 NewPromiseResolveThenableJob，再由 host 排入 Promise Job 队列。
- then reaction 创建新  | then reaction 创建新 capability，handler 返回值通过新 resolve 再次执行 resolution procedure。

#### 观察重点

- 把 resolved 当作 fulfilled，无法解释 resolve(pendingPromise) 后仍等待却拒绝二次 reject。
- 为 resolve/reject 分别保存 Boolean，导致二者都可能胜出。
