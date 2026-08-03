import asyncio
from collections.abc import Awaitable, Callable


class DualRunnable:
    def __init__(
        self,
        sync: Callable[[int], int] | None = None,
        async_fn: Callable[[int], Awaitable[int]] | None = None,
    ) -> None:
        self.sync = sync
        self.async_fn = async_fn

    def invoke(self, value: int) -> int:
        if self.sync is None:
            raise TypeError("同步入口不能调用 coroutine-only 步骤")
        return self.sync(value)

    async def ainvoke(self, value: int) -> int:
        if self.async_fn is not None:
            return await self.async_fn(value)
        if self.sync is None:
            raise TypeError("步骤没有可执行实现")
        return await asyncio.to_thread(self.sync, value)


async def native_double(value: int) -> int:
    await asyncio.sleep(0)
    return value * 2


async def main() -> None:
    both = DualRunnable(lambda value: value + 1, native_double)
    assert both.invoke(3) == 4
    assert await both.ainvoke(3) == 6

    sync_only = DualRunnable(lambda value: value + 1)
    assert await sync_only.ainvoke(3) == 4

    async_only = DualRunnable(async_fn=native_double)
    try:
        async_only.invoke(3)
    except TypeError:
        pass
    else:
        raise AssertionError("coroutine-only 步骤必须拒绝同步入口")

    def fail(_: int) -> int:
        raise ValueError("bad input")

    try:
        await DualRunnable(fail).ainvoke(1)
    except ValueError as error:
        assert str(error) == "bad input"
    else:
        raise AssertionError("异常不能被异步桥接吞掉")


asyncio.run(main())
print("sync/async contract: ok")
