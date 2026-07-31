from dataclasses import dataclass, field

@dataclass(frozen=True)
class Message:
    role: str
    content: str | list[dict]
    metadata: dict = field(default_factory=dict)

def to_wire(message: Message) -> dict:
    if message.role not in {"system", "user", "assistant", "tool"}:
        raise ValueError("未知角色不能猜测映射")
    return {"role": message.role, "content": message.content}

text = Message("user", "请描述图像")
image = Message("user", [{"type": "text", "text": "描述"}, {"type": "image", "url": "https://example.test/a.png"}])
assert to_wire(text)["content"] == "请描述图像"
assert to_wire(image)["content"][1]["type"] == "image"
try:
    to_wire(Message("operator", "x"))
except ValueError:
    pass
else:
    raise AssertionError("角色错误必须可见")
print("message contract passed")
