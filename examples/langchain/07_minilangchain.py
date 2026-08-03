import asyncio
from collections.abc import Awaitable, Callable, Iterable


class Step:
    def __init__(
        self,
        function: Callable[[object], object],
        async_function: Callable[[object], Awaitable[object]] | None = None,
    ) -> None:
        self.function = function
        self.async_function = async_function

    def invoke(self, value: object) -> object:
        return self.function(value)

    async def ainvoke(self, value: object) -> object:
        if self.async_function is not None:
            return await self.async_function(value)
        return self.function(value)

    def stream(self, value: object) -> Iterable[object]:
        yield self.invoke(value)


class Sequence:
    def __init__(self, *steps: Step | Callable[[object], object]) -> None:
        self.steps = tuple(
            step if isinstance(step, Step) else Step(step) for step in steps
        )

    def invoke(self, value: object) -> object:
        for step in self.steps:
            value = step.invoke(value)
        return value

    async def ainvoke(self, value: object) -> object:
        for step in self.steps:
            value = await step.ainvoke(value)
        return value

    def batch(
        self, values: list[object], return_exceptions: bool = False
    ) -> list[object]:
        outputs: list[object] = []
        for value in values:
            try:
                outputs.append(self.invoke(value))
            except Exception as error:
                if not return_exceptions:
                    raise
                outputs.append(error)
        return outputs

    def stream(self, value: object) -> Iterable[object]:
        yield self.invoke(value)


async def async_add_one(value: object) -> object:
    await asyncio.sleep(0)
    return int(value) + 1


pipeline = Sequence(
    Step(str.strip),
    Step(int, async_add_one),
    Step(lambda value: int(value) * 2),
)
assert pipeline.invoke(" 20 ") == 40
assert asyncio.run(pipeline.ainvoke(" 20 ")) == 42
assert pipeline.batch([" 1 ", " 2 "]) == [2, 4]
assert list(pipeline.stream(" 3 ")) == [6]

failed = pipeline.batch([" 4 ", "oops", " 5 "], return_exceptions=True)
assert failed[0] == 8 and isinstance(failed[1], ValueError) and failed[2] == 10

try:
    pipeline.batch([" 4 ", "oops"])
except ValueError:
    pass
else:
    raise AssertionError("默认 batch 必须传播第一个失败")

print("mini LangChain core: ok")
