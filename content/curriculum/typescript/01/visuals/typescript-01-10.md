---
lesson: "typescript-01-10"
track: "typescript"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 切换参数，观察「HTML event loop：task、microtask、render 与饥饿」

id: "typescript-01-10-main"
kind: "playground"
placement: "example"
component: "typescript-01-10/event-loop-queues"
summary: "浏览器主线程同时接收点击、网络完成、timer、脚本、DOM 变更和动画。event loop 是宿主协调这些工作的协议，不是一条装着所有回调的 JavaScript 数组。HTML 为一个 agent 关联 event loop；同一个 event loop 有一个或多个 task queues、一个 microtask queue、当前 task、渲染机会和若干 bookkeeping。event loop 也不必与某一条操作系统线"
caption: "控件改变可观察状态或运行结果；静态类型事实、JavaScript 运行时事实与宿主行为必须分别验证。"
actionLabel: "播放运行时切换"

#### 步骤

- 每个 agent 关联 event  | 每个 agent 关联 event loop；event loop 可能有多个 task queues 和一个独立 microtask queue。
- task source 保证同 so | task source 保证同 source 的相对顺序，宿主可在多个含 runnable task 的队列间选择。
- task run-to-comple | task run-to-completion 后执行 microtask checkpoint；checkpoint 防重入并持续排空到队列为空。
- Promise Job 与 queu | Promise Job 与 queueMicrotask 都进入微任务机制，但异常与返回值协议不同。
- window rendering o | window rendering opportunity 可以被跳过；rAF、style、layout、paint 属于渲染更新链路。

#### 观察重点

- 把多个 task sources 画成一条严格全局 FIFO，错误承诺 timer、消息和输入的跨 source 顺序。
- 把“宏任务”当成 HTML 正式分类，忽略 task source、runnable 条件和 document 生命周期。
