---
lesson: "torch-02-07"
track: "torch"
decision: "读完正文仍难以在脑中排出「三道门的先后顺序」：叶子检查在 forward 瞬间失败，重叠断言在进入 kernel 前失败，版本比对却要等到 backward 才失败。这是一条有明确阶段的时间线，而不是一组并列规则，因此用 flow 逐阶段推进一次 add_ 调用，让每道门的输入、判据和报错文本同时可见。"
---

## 视觉实验

### 让一次 add_ 依次穿过三道门

id: "torch-02-07-inplace-gates"
kind: "flow"
placement: "chapter:1"
summary: "把 x.add_(y) 拆成五个阶段推进：autograd 叶子裁决、ATen 自重叠检测、跨张量重叠断言、版本号递增、backward 时的版本比对，观察每一阶段各自看什么数据、失败时抛出哪一句错误文本。"
caption: "方框是检查点，右侧读数是该阶段真正读取的字段（is_leaf / strides / storage 区间 / _version）；图中省略了 dispatch 与 kernel 内部，最终判定仍以源码断言与示例中的错误文本为准。"
actionLabel: "推进到下一道门"

#### 步骤

- 叶子裁决 | check_inplace 读 requires_grad 与 is_leaf，命中时抛「a leaf Variable that requires grad」，视图另有「a view of」前缀。
- 自重叠 | has_internal_overlap 只扫 strides，找 size>1 且 stride==0 的维；查不出来时返回 TooHard 并放行。
- 跨张量 | assert_no_overlap 比较左右值的 storage 指针与数据区间，错误文本以 input tensor 开头。
- 版本递增 | 写入完成后 storage 上的版本计数器加一，所有视图与 detach 结果同步看到新版本号。
- 反向比对 | backward 逐个核对 saved tensor 的版本，不一致时报出「is at version 1; expected version 0」。

#### 观察重点

- 推进到「自重叠」前先预测：把 expand 换成 as_strided((2,3),(1,1)) 后，这一步会走 Yes 还是 TooHard 分支。
- 用课程示例逐条核对五种错误文本的归属，特别确认 detach 之后版本号仍然递增这一读数。
