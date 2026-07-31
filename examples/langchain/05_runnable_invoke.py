"""RunnableSequence 的值流、追踪和失败短路合同。"""

from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass
class Trace:
    events: list[str] = field(default_factory=list)


class Runnable:
    def __init__(self, name: str, function: Callable[[Any], Any]):
        self.name = name
        self.function = function

    def invoke(self, value: Any, config: dict[str, Any]) -> Any:
        trace: Trace = config["trace"]
        trace.events.append(f"start:{self.name}")
        try:
            result = self.function(value)
        except Exception:
            trace.events.append(f"error:{self.name}")
            raise
        trace.events.append(f"end:{self.name}")
        return result


class Sequence:
    def __init__(self, *steps: Runnable):
        self.steps = steps

    def invoke(self, value: Any, config: dict[str, Any]) -> Any:
        for step in self.steps:
            value = step.invoke(value, config)
        return value


pipeline = Sequence(
    Runnable("strip", str.strip),
    Runnable("parse", int),
    Runnable("double", lambda value: value * 2),
)

trace = Trace()
assert pipeline.invoke(" 21 ", {"trace": trace}) == 42
assert trace.events[-1] == "end:double"

failed = Trace()
try:
    pipeline.invoke("oops", {"trace": failed})
except ValueError:
    pass
else:
    raise AssertionError("解析错误必须继续抛出")

assert "error:parse" in failed.events
assert "start:double" not in failed.events, "失败后不得启动后续步骤"
print("runnable invoke contract: ok")
