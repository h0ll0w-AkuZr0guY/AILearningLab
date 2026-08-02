import asyncio
from contextvars import ContextVar
request_id = ContextVar("request_id", default="missing")
def read_id(): return request_id.get()
async def main():
    request_id.set("req-7")
    assert await asyncio.to_thread(read_id) == "req-7"
asyncio.run(main())
