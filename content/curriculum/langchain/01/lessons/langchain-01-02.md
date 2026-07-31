---
id: "langchain-01-02"
track: "langchain"
title: "BaseMessage 不变量"
depth: "deep"
visualIndex: "../visuals/langchain-01-02.md"
exampleLanguage: "python"
readingMinutes: 25
sourceMinutes: 8
practiceMinutes: 10
reviewMinutes: 2
---

## 官方入口

title: "LangChain Messages · Overview"
url: "https://docs.langchain.com/oss/python/langchain/messages#overview"

官方页面把 message 定义为 chat model 的输入和输出，并把 `SystemMessage`、`HumanMessage`、`AIMessage`、`ToolMessage` 作为不同对话参与者。它描述交换格式，不保证任意 `additional_kwargs` 可跨 provider 重用。

## 真实源码

repo: "langchain-ai/langchain"
file: "libs/core/langchain_core/messages/base.py"
symbol: "BaseMessage.__init__ / BaseMessage.text"
language: "python"
url: "https://github.com/langchain-ai/langchain/blob/01d8481ae3d457ec3751cbb0331ea3a4b720fa90/libs/core/langchain_core/messages/base.py#L93-L250"

### 逐段讲解

- 基类用 Pydantic 字段声明可序列化的数据合同，而非只存任意实例属性。
- `content` 接收字符串或块列表，子类通过稳定 `type` 区分身份。
- `additional_kwargs` 留给 provider 负载，`response_metadata` 留给响应事实，两者不应混写。
- `text` 只抽取文本块；图像、tool call 和 reasoning 不会被错误拼成给用户看的正文。

### 源码节选

```python
class BaseMessage(Serializable):
    content: str | list[str | dict[Any, Any]]
    additional_kwargs: dict[Any, Any] = Field(default_factory=dict)
    response_metadata: dict[Any, Any] = Field(default_factory=dict)
    type: str
    name: str | None = None
    id: str | None = Field(default=None, coerce_numbers_to_str=True)
    model_config = ConfigDict(extra="allow")

    def __init__(self, content=None, content_blocks=None, **kwargs):
        # 有 typed blocks 时以它为唯一 content 来源。
        if content_blocks is not None:
            super().__init__(content=content_blocks, **kwargs)
        else:
            super().__init__(content=content, **kwargs)

    @property
    def text(self) -> TextAccessor:
        if isinstance(self.content, str):
            text_value = self.content
        else:
            blocks = [b for b in self.content if isinstance(b, str) or b.get("type") == "text"]
            text_value = "".join(b if isinstance(b, str) else b["text"] for b in blocks)
        return TextAccessor(text_value)
```

## 导读

一次调用成功却不能重放，通常不是模型“随机”，而是消息对象把输入、输出、传输字段和展示字段混在一起。比如把 OpenAI 的 request id 写进 prompt，下一次就把观测数据重新发送；把 tool call 放在纯文本字段，执行器失去可信关联；把图片当 `text`，日志看似完整却无法再请求模型。BaseMessage 的价值是给这些信息划出不变量。

本课独立于上一课的角色与 block：上一课回答“有哪些货物”，本课回答“信封上哪些位置不能互换”。它也为模型调用准备输入边界，下一课会把合法消息序列交给 `ChatModel`。

## 分章正文

### 先分清四类数据

kicker: "01 · OBSERVE"

`content` 是模型应理解的语义载荷；`type` 是消息类型；`additional_kwargs` 是 provider 未被核心统一的协议数据；`response_metadata` 是模型返回的 token、headers、模型名等观察事实。四者的写入者与生命周期不同。把用量统计塞到 content，会污染下轮上下文；把用户指令塞到 metadata，则 provider 根本看不到。

一个实用检查是序列化再反序列化：内容、type、id 应保持；日志字段可脱敏但不能反向影响提示词；provider 私有字段只能由对应 adapter 消费。这个检查比“最终回答相同”更早暴露重放故障。

#### 本章结论

消息不变量来自字段的责任分离，字段名相近不表示可以相互替代。

### type 与子类为何都要存在

kicker: "02 · MODEL"

Python 子类方便写 `HumanMessage`，网络和数据库却不会保存 Python 类型。稳定字符串 `type` 才能在 JSON 中恢复“这是一条 AIMessage，而非用户输入”。反例是用类名作持久化标签：重构包路径后旧会话无法读取。反例二是只存 role：tool message 还需要工具调用关联和工具特有字段，role 无法完整表达。

`id` 是可选但高价值的身份。它适合去重、trace 和 provider 回执，不适合当业务主键，更不能假设所有 provider 都生成。应用若需要 exactly-once 的外部动作，应单独生成业务 idempotency key。

#### 本章结论

子类提供本地行为，`type` 提供跨进程身份；二者协作而非竞争。

### content 的可读投影

kicker: "03 · SOURCE"

源码的 `text` 只拼接 string 与 `type == text` 的块，这看似小细节，却防止把二进制、思考块或工具参数展示给用户。它是投影而不是反序列化：`message.text` 适合 UI 摘要，不能再拿去重新构造原消息。若依赖 text 重放，多模态和 tool 调用已经丢失。

这解释了为什么教学代码也应写 `render_text(message)` 和 `to_provider(message)` 两个函数。前者允许忽略非文本，后者必须保留所有合法字段并检验 provider 能力。一个函数同时负责两件事，迟早会在“为了好看”时删掉协议数据。

#### 本章结论

显示视图是有损投影；可重放对象必须保留完整结构。

### 缺失与冲突输入

kicker: "04 · FAILURE"

当前构造器在给出 `content_blocks` 时以它为准，避免同时传两份内容产生不确定性。业务 wrapper 应更严格：要求 content 非空、每个块有 type、tool 结果有 call id、metadata 是 JSON 可编码的白名单。框架允许 `extra="allow"` 是兼容选择，不是邀请业务代码无限塞字段。

还要防止可变别名。若多个消息共享同一个 `additional_kwargs` 字典，后续给一条消息补 token 用量会污染另一条。Pydantic 的 default factory 避免默认字典共享；自定义 adapter 也要复制外部输入。测试应修改一条消息 metadata，再断言另一条保持原值。

#### 本章结论

宽松核心为生态兼容，产品边界仍要主动校验、复制和脱敏。

### 选择持久化合同

kicker: "05 · ENGINEERING"

变体 A 保存完整 `message_to_dict`，最利于调试和迁移，代价是必须加密、脱敏并处理 provider 私有字段。变体 B 只保存业务摘要，隐私成本低，代价是无法精确重放。变体 C 保存完整原始事件和一个版本化规范化投影，读取稍复杂，却最适合长期 agent。

上线前至少做四类测试：未知 type 失败、非文本 block 不进入 text、元数据不别名、序列化 round trip 保持 type。模型输出质量测试属于更高层，不能替代这些合同测试。监控只记录长度、类型和 token 数，避免把用户内容写进普通指标。

#### 本章结论

BaseMessage 的工程价值在可重放与可审计，关键成本是数据治理而非类继承。

### 版本迁移与重放证明

kicker: "06 · VERIFY"

消息存进数据库以后，BaseMessage 合同就成为长期数据格式。框架升级可能增加新的 content block、改变 provider 私有字段，应用也可能重命名业务属性。若只保存当前 Python 对象的 `repr`，将来既无法判断使用过哪版 schema，也无法可靠恢复子类。可迁移记录至少包含应用 schema version、稳定 message type、完整 content、受控元数据和创建时采用的 adapter 版本。

重放测试应使用“黄金会话”而非只测单条消息。准备一段 system、human、带 tool call 的 AIMessage、对应 ToolMessage 和最终 AIMessage，序列化后重新载入，逐项断言角色顺序、调用 id、内容块类型与原始值一致。随后把旧版本记录交给迁移器，验证迁移前后可发送语义等价。显示文本允许因 UI 优化略有变化，可发送结构则必须通过显式版本规则变化。

迁移时尤其要区分缺失字段和空字段。旧记录没有 `usage_metadata` 表示当时未采集，空字典可能表示已经采集但 provider 未返回；把二者统一成空值会让成本审计误判。相同问题也存在于 id：没有 provider id 不等于消息无业务身份。应用可以另外保存自己的 event_id，但不能回填成 provider id 后声称来自上游。

另一个高价值实验是确定性投影。对同一完整消息多次调用 `text`，结果应相同且不修改 content；向副本追加图像块后，text 保持原文本，完整块数量增加。这个断言证明 text 是纯投影。若渲染函数为了“清理”内容而原地删除未知块，后续重放便会依赖调用顺序，形成极难定位的数据损坏。

隐私删除也要围绕结构进行。用户请求删除时，应找到原始事件、规范化投影、向量索引、缓存和审计副本，而非只清空 UI 文本。可保留不可逆的计数与错误类别，但消息 id、tool artifact 和签名 URL 可能仍可关联个人，需要按数据地图处理。消息模型越结构化，定位这些派生数据越容易。

#### 本章结论

可重放要由带版本的结构和黄金会话证明；`repr`、UI 文本和一次成功调用都不足以承担长期数据合同。

## 核心机制

- `content`、`type`、provider payload 与响应观察数据承担不同责任。
- `type` 是跨进程序列化身份，类名只适合本地代码。
- `text` 有意忽略非文本 block，因此不能作为重放材料。
- 默认工厂和输入复制防止消息之间共享可变元数据。

## 常见误区

- 把 token usage 写进下一轮 prompt，造成模型看到无关账单。
- 用 `message.text` 存档，随后发现工具和图像不可恢复。
- 把 provider id 当业务幂等键，遇到重试就重复副作用。

## 实现变体

### 变体 A：严格业务 Message

useWhen: "单 provider、强合规且消息种类固定的服务。"
tradeoff: "错误早暴露；接入新 block 时需要明确升级 schema。"

### 变体 B：原始事件加规范化投影

useWhen: "多 provider、需回放和迁移的 Agent 平台。"
tradeoff: "兼容性与审计更强；需要版本、脱敏和迁移作业。"

## 可运行示例

```python
from dataclasses import dataclass, field
@dataclass
class Message:
    type: str; content: list[dict]; metadata: dict = field(default_factory=dict)
    @property
    def text(self): return "".join(x["text"] for x in self.content if x.get("type") == "text")
a = Message("human", [{"type":"text","text":"hi"}]); b = Message("human", [])
a.metadata["trace"] = "a"; assert b.metadata == {} and a.text == "hi"
```

## 搭积木复现

### 积木 1：声明四类字段

先写 content、type、payload、metadata，给每个字段一条责任说明。

### 积木 2：实现 text 投影

只选择 text block，并用图像块证明投影有损。

### 积木 3：加入稳定序列化

保存 `{type, data}`，round trip 后断言 type 与 id 不变。

### 积木 4：复制可变输入

修改一条 metadata，断言另一条消息不受影响。

### 积木 5：加入脱敏存储

对原始 payload 做字段白名单，再记录 schema version。

## 自检

### 问题

为何 `content_blocks` 与 `text` 应同时存在？怎样证明后者不能替代前者？

### 站内答案

结论是前者保存可发送的结构，后者提供给人阅读的文本投影。机制上，源码只选择 text block，因此图片、tool call、reasoning 均不在 `text` 中。用一条同时含文本和 tool call 的消息测试：断言 `text` 只等于文本，再序列化并检查 tool call id 仍在完整 content。工程上，UI 读 text，provider adapter 读 blocks；只有确认永远纯文本的短链路才可省去完整保存。
