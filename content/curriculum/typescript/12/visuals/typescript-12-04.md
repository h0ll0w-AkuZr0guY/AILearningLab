---
lesson: "typescript-12-04"
track: "typescript"
decision: "文字能列出候选、约束与代入，却难以让学习者看见一个 TypeVar 如何从多个实参位置收集证据、解决冲突并回填返回类型；静止 flow 展示完整的推断链。"
---

## 视觉实验

### 让 TypeVar 从调用点走到实例化结果

id: "typescript-12-04-main"
kind: "flow"
placement: "chapter:2"
summary: "观察 `pair<T>(left:T,right:T):T` 从占位 TypeVar 开始，收集候选、选择 same/union 策略、检查约束，最后把 T 代入返回类型。"
caption: "候选是从 source/target 结构关系中收集的证据，不是按文本替换最后一次出现的类型。flow 省略完整 inference priority、contextual typing、overload 与 no-infer 分支；验证入口是 v5.9.3 inferTypes/inferFromTypes。"
actionLabel: "推进泛型约束求解"

#### 步骤

- 模板 | 函数签名保存 `T` 占位符，参数与返回类型共享同一个 TypeVar 身份。
- 收集 | 调用 `pair("id", 3)`，两个参数位置分别向 T 写入 `string` 与 `number` 候选。
- 选择 | same 策略报告 conflict；union 策略把候选合并为 `string | number`，选择过程与遍历顺序解耦。
- 约束 | 若 T 有 `string` 上界，候选 `number` 进入 constraint-mismatch；无候选时才考虑 default。
- 实例化 | 将选定类型代入返回 Type AST，得到可验证结果；失败保持候选和原因，不能伪造返回值。

#### 观察重点

- 预测任务：同一个 T 的多个输入必须形成共同合同，最后一个候选不能覆盖先前证据。
- 证据任务：运行 `examples/typescript/typescript-12-04.mjs`，分别观察 same conflict、union result 与 constraint mismatch。

#### 交互边界

- 默认静止，单步、上一步、暂停、重置和键盘语义由通用渲染器实现；文字步骤承担窄屏替代。
- `prefers-reduced-motion` 下不自动播放，所有阶段仍可通过离散步骤复核。
