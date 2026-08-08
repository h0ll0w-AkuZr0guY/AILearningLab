from dataclasses import dataclass, field


@dataclass
class Message:
    content: str
    response_metadata: dict[str, object] = field(default_factory=dict)


@dataclass
class Generation:
    message: Message


@dataclass
class ChatResult:
    generations: list[Generation]
    llm_output: dict[str, object] | None = None


def invoke(text: str) -> Message:
    result = ChatResult(
        [Generation(Message(f"echo:{text}"))],
        {"provider": "fake", "usage": {"input": len(text)}},
    )
    message = result.generations[0].message
    message.response_metadata = {**(result.llm_output or {}), **message.response_metadata}
    return message


answer = invoke("hello")
assert answer.content == "echo:hello"
assert answer.response_metadata["usage"] == {"input": 5}
print("ChatResult projection: ok")
