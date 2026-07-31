---
lesson: "typescript-01-03"
track: "typescript"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 展开「可达性 GC、WeakRef 与 FinalizationRegistry」的节点与依赖

id: "typescript-01-03-main"
kind: "graph"
placement: "chapter:2"
summary: "JavaScript 的对象不会因为“离开某个花括号”立刻释放。垃圾回收器从一组 roots 出发，沿强引用边寻找仍可到达的对象；未被证明存活的对象才成为回收候选。闭包、事件监听器、缓存 Map、定时器回调、DOM/原生绑定都可能形成根到对象的路径。循环本身不是泄漏，只要整环与 roots 断开，tracing collector 仍能回收。"
caption: "节点和连线表示依赖关系与当前可观察阶段；真实图中的条件边、并行合并、失败与重放必须回到源码逐项核对。"
actionLabel: "推进节点状态"

#### 步骤

- collector 从 roots  | collector 从 roots 出发把强可达对象加入 marking worklist，并扫描到传递闭包。
- 增量/并发阶段允许 mutator  | 增量/并发阶段允许 mutator 继续修改图，写屏障维护三色不变量并发布新增标记工作。
- 分代 GC 用 remembered | 分代 GC 用 remembered set 记录 old-to-young 边，缩小频繁 young collection 的扫描集合。
- WeakMap/ephemeron  | WeakMap/ephemeron 在 key 已由其他路径存活时才标记 value，并迭代到固定点。
- WeakRef 成功 deref 的 | WeakRef 成功 deref 的目标在当前同步 job 内 kept alive；FinalizationRegistry cleanup 由 host 机会式调度。

#### 观察重点

- 把循环引用等同于泄漏，忽略 tracing GC 能回收与 roots 断开的整张子图。
- 认为把变量设为 null 一定释放内存，或认为函数 return 后闭包捕获必然消失。
