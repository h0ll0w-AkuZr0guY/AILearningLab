import asyncio
from contextlib import asynccontextmanager
events = []
@asynccontextmanager
async def resource():
    events.append("open")
    try: yield "handle"
    finally: events.append("close")
async def main():
    async with resource() as value: assert value == "handle"
    assert events == ["open", "close"]
asyncio.run(main())
