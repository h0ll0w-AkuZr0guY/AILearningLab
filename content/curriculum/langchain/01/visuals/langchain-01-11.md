---
lesson: "langchain-01-11"
track: "langchain"
decision: "读完双接口正文后，学习者仍难以沿同一个输入追踪同步入口、异步入口、线程池回退、原生 afunc 与取消后的资源状态，因此用 flow 逐步并置这些路径。"
---

## 视觉实验

### 让同一个 Runnable 穿过同步与异步入口

id: "langchain-01-11-sync-async-flow"
kind: "flow"
placement: "chapter:2"
summary: "逐步观察同一个输入如何经过 invoke、ainvoke、executor 回退或原生 afunc，并在失败与取消处保留资源边界。"
caption: "蓝色表示当前执行路径，橙色表示同步函数被放入 executor 的兼容层，紫色表示原生异步函数；视觉不把 await 取消解释成已经发生的外部写入被撤销，验证入口是固定 commit 的 Runnable 与 RunnableLambda 实现和测试。"
actionLabel: "推进双接口路径"

#### 步骤

- 同步入口 | `invoke` 直接调用同步函数，输入沿单线程合同得到完整输出。
- 线程池回退 | 只有同步函数的实例由 `ainvoke` 通过 executor 执行，结果可被 await，但函数本身仍是阻塞实现。
- 原生异步 | 同时提供 `afunc` 时，`ainvoke` 选择原生协程，避免把异步 I/O 伪装成线程池兼容。
- 组合等待 | sequence 的下一步只在前一步完成后接收输出；异步链对每一步 await，而不是提前读取协程对象。
- 失败与取消 | 异常沿调用者返回；取消等待只停止等待关系，已经发生的资源写入仍需由幂等、事务或补偿验证。

#### 观察重点

- 每一步前先预测当前路径是同步、executor 回退还是原生异步，以及输出合同是否改变。
- 用 `06_sync_async.py` 的正常/失败断言和固定源码行区间验证：可 await 不等于原生非阻塞，取消也不等于撤销副作用。
