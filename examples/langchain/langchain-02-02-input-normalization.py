from dataclasses import dataclass


@dataclass(frozen=True)
class Message:
    role: str
    content: str


def convert(item: object) -> Message:
    if isinstance(item, Message):
        return item
    if isinstance(item, str):
        return Message("human", item)
    if isinstance(item, tuple) and len(item) == 2:
        return Message(str(item[0]), str(item[1]))
    if isinstance(item, dict) and ("role" in item or "type" in item) and "content" in item:
        return Message(str(item.get("role", item.get("type"))), str(item["content"]))
    raise ValueError("unsupported message representation")


def normalize(value: object) -> list[Message]:
    if isinstance(value, str):
        return [convert(value)]
    if isinstance(value, list):
        return [convert(item) for item in value]
    raise ValueError("input must be str or list")


assert normalize("hi") == [Message("human", "hi")]
assert normalize([("system", "brief")])[0].role == "system"
for bad in (42, [("user",)], [{"content": "missing role"}]):
    try:
        normalize(bad)
    except (TypeError, ValueError):
        pass
    else:
        raise AssertionError("invalid input must fail before provider")
print("input normalization: ok")
