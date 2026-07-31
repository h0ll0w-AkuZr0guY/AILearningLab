---
lesson: "langgraph-02-03"
track: "langgraph"
decision: "并行 writer 与按字段归并的关系仅靠段落很容易被误读成 node 自己修改旧列表；分步 flow 直接显示两个 delta 在 barrier 后才进入 reducer。"
---

## 视觉实验

### 把两笔并行写入送进一个 reducer

id: "langgraph-02-03-reducer-flow"
kind: "flow"
placement: "chapter:3"
summary: "显示 fraud 与 policy 各自产生 tags delta，barrier 收集 writes 后由 add 依次归并，而不是任一 node 原地改共享列表。"
caption: "步骤表达课程的教学归并模型；实际 task 排序和异常处理以当前 binop.py、Pregel runtime 与离线断言为准。"
actionLabel: "推进归并流程"

#### 步骤

- 并行产生 delta | 两个 node 都只返回自己的标签列表，尚未修改共享 State。
- 收集字段写入 | 同一 super-step 结束后，tags channel 获得有序 values 序列。
- 逐项归并 | BinaryOperatorAggregate 用 add 把每个 list delta 合成为新的 tags 值。

#### 观察重点

- 预测两个 node 是否会在执行中看见彼此的标签。
- 思考把 add 换成字符串拼接时，调度顺序为何会进入业务语义。
