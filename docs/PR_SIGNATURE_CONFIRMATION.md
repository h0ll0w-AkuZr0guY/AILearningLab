# PR 前署名确认表

课程正文、视觉索引或课程规则进入 PR 前，必须先完成一次本表确认。署名取当前对话的真实运行身份，不得从仓库历史、上一批记录、模板示例、自动化默认值或某个“最新模型”推断。

## 使用规则

1. AI 先从当前会话/接口元数据读取产品与模型；能读取时原样记录，不做别名替换或版本猜测。
2. 若接口没有暴露可核验的模型标识，AI 必须暂停创建 PR，向用户展示下表并请求确认。用户确认后才可继续；没有确认不得填写新的 `ai`、创建 draft PR 或标记 ready。
3. 用户确认只对当前批次有效。下一批、下一次会话或换用不同模型时必须重新确认。
4. 用户确认不允许覆盖历史日志。纠正旧批次时，只能在相关课程日志顶部追加一条纠正记录，并说明原记录、证据范围和纠正 PR。
5. `human` 也必须由用户、认证 GitHub 身份或明确课程 owner 确认；不能把 AI 产品名写进 `human`。

## 待用户确认

提交 PR 前，AI 应把以下表格原样发给用户：

| 字段 | 待确认值 |
| --- | --- |
| 仓库/批次 | `<owner/repository> · <track> · <lesson-id 范围>` |
| human | `<真实发起者或课程 owner>` |
| ai 产品 | `<当前会话接口披露的产品>` |
| ai 模型 | `<当前会话接口披露的精确模型 id/名称>` |
| 课程日志写法 | ``<产品> · <模型>`` |
| 证据来源 | `<接口元数据 / 用户明确确认 / 两者>` |
| session id | `<当前会话 id；接口不可得时写“未暴露”>` |
| runtime model id | `<原样记录接口字段；不可得时写“未暴露”>` |
| 预计 PR | `<draft PR，尚未创建>` |
| 未修改范围 | `<明确列出不属于本批的课程和历史记录>` |

用户应明确回复“确认以上署名并允许创建 PR”，或直接改正某个字段。仅回复“可以提交 PR”而没有确认署名时，AI 仍不得继续。

## 本批确认记录

```markdown
batch: "<track + lesson ids>"
human: "<confirmed human>"
ai: "<confirmed product · model>"
source: "<runtime metadata | user confirmation>"
sessionId: "<session id or 未暴露>"
runtimeModelId: "<runtime model id or 未暴露>"
confirmedAt: "<YYYY-MM-DDTHH:mm:ss±hh:mm>"
confirmedBy: "<user / authenticated account>"
scope: "<files or lesson ids>"
```

确认记录应进入恢复文档或 PR 描述；课程 Markdown 只写最终署名，不把表单噪声放入正文。
