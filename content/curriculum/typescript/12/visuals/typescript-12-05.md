---
lesson: "typescript-12-05"
track: "typescript"
decision: "文字能描述 Diagnostic 字段，却难以追踪一个 Node span 如何成为结构化错误、经过分阶段聚合并在无文件场景安全格式化；静止 flow 将定位、因果和输出连接起来。"
---

## 视觉实验

### 让一个类型失败变成可定位诊断

id: "typescript-12-05-main"
kind: "flow"
placement: "chapter:2"
summary: "观察 checker 关系失败如何保留 file/start/length/code/category，再经过诊断聚合、related information 和 formatter 变成可操作文本。"
caption: "messageText 只是结果的一部分；位置、码、类别与因果链让编辑器和回归测试能消费诊断。flow 对照 v5.9.3 的 error、Diagnostic、DiagnosticMessageChain 与 getPreEmitDiagnostics，省略 localization/watch 细节。"
actionLabel: "推进诊断生成与格式化"

#### 步骤

- 定位 | Node 提供 file、start、length，关系失败绑定到发生问题的源码范围。
- 结构化 | checker `error` 产生 Diagnostic，保存 code、category、messageText 与可选 relatedInformation。
- 聚合 | Program 按 config/options/syntax/global/semantic 阶段合并诊断，重复项按稳定 key 去重。
- 因果链 | related information 追加期望类型、实际类型或来源位置，主错误仍保持可定位。
- 格式化 | 有 file 时转成 line/column；无 file 的 detached diagnostic 使用 `<config>`/全局标签，不访问空 sourceFile。

#### 观察重点

- 预测任务：去掉 span 后仍可显示文字，却失去编辑器定位；去掉 code/category 后难以稳定聚合和回归。
- 证据任务：运行 `examples/typescript/typescript-12-05.mjs`，观察 semantic span、无文件诊断和重复 key 的断言。

#### 交互边界

- 默认静止；通用渲染器提供单步、暂停、重置、可键盘操作按钮和 aria-live 当前阶段。
- 文字步骤是完整替代说明，窄屏不依赖 hover，减弱动态偏好时保持静止与离散推进。
