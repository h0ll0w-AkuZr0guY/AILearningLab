"""ChatModel 输入归一化合同，不需要 API key 或第三方依赖。"""

from dataclasses import dataclass


@dataclass(frozen=True)
class PromptValue:
    messages: tuple[tuple[str, str], ...]


def normalize(value: object) -> PromptValue:
    """把公开便捷输入收敛到一种内部表示。"""
    if isinstance(value, PromptValue):
        return value
    if isinstance(value, str):
        return PromptValue((("human", value),))
    if isinstance(value, list):
        rows = tuple((str(role), str(content)) for role, content in value)
        if any(role not in {"system", "human", "ai", "tool"} for role, _ in rows):
            raise ValueError("未知消息角色")
        return PromptValue(rows)
    raise ValueError(f"非法输入类型: {type(value).__name__}")


class FakeChatModel:
    def __init__(self) -> None:
        self.calls = 0

    def invoke(self, value: object) -> dict[str, object]:
        prompt = normalize(value)
        self.calls += 1
        return {
            "type": "ai",
            "text": f"收到 {len(prompt.messages)} 条消息",
            "roles": [role for role, _ in prompt.messages],
        }


model = FakeChatModel()
assert model.invoke("你好")["roles"] == ["human"]
assert model.invoke(
    [("system", "只回答数字"), ("human", "1+1")]
)["roles"] == ["system", "human"]

try:
    model.invoke(42)
except ValueError as error:
    assert "非法输入类型" in str(error)
else:
    raise AssertionError("非法输入必须失败")

assert model.calls == 2, "归一化错误不能越过 provider 边界"
print("chat model contract: ok")
