"""一次性 Prompt 变量绑定与消息历史展开合同。"""

import string
from dataclasses import dataclass


@dataclass(frozen=True)
class MessageTemplate:
    role: str
    text: str


def fields(template: str) -> list[str]:
    return [
        name
        for _, name, _, _ in string.Formatter().parse(template)
        if name is not None
    ]


class MiniChatPrompt:
    def __init__(self, nodes: list[object], partial: dict[str, object] | None = None):
        self.nodes = nodes
        self.partial = dict(partial or {})

    def format_messages(self, **values: object) -> list[dict[str, object]]:
        env = self.partial | values
        result: list[dict[str, object]] = []
        for node in self.nodes:
            if isinstance(node, tuple) and node[0] == "history":
                history = env.get(node[1], [])
                if not isinstance(history, list):
                    raise ValueError("history 必须是消息列表")
                result.extend(history)
                continue
            if not isinstance(node, MessageTemplate):
                raise ValueError(f"未知模板节点: {node!r}")
            missing = [name for name in fields(node.text) if name not in env]
            if missing:
                raise KeyError(f"缺失变量: {missing}")
            result.append(
                {"role": node.role, "content": node.text.format_map(env)}
            )
        return result


prompt = MiniChatPrompt(
    [
        MessageTemplate("system", "你是 {product} 的审阅员"),
        ("history", "history"),
        MessageTemplate("human", "审阅：{text}"),
    ],
    partial={"product": "AILearningLab"},
)
messages = prompt.format_messages(
    history=[
        {"role": "ai", "content": "请提供文本", "tool_call_id": "call-1"},
        {"role": "tool", "content": "已读取", "tool_call_id": "call-1"},
    ],
    text="保留用户输入里的 {unknown}",
)
assert [message["role"] for message in messages] == [
    "system",
    "ai",
    "tool",
    "human",
]
assert str(messages[-1]["content"]).endswith("{unknown}")

try:
    prompt.format_messages(history="一段字符串", text="x")
except ValueError:
    pass
else:
    raise AssertionError("坏历史必须在模型调用前失败")

print("prompt binding contract: ok")
