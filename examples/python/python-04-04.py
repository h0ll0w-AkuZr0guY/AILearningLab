import asyncio
class Answer:
    def __await__(self):
        yield from asyncio.sleep(0).__await__(); return 42
async def numbers():
    for n in range(3): yield n
async def main():
    assert await Answer() == 42
    result = []
    async for n in numbers(): result.append(n)
    assert result == [0, 1, 2]
asyncio.run(main())
