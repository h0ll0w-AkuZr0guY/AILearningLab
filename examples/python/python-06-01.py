import asyncio
async def main():
    events = []; loop = asyncio.get_running_loop()
    loop.call_soon(events.append, "ready")
    loop.call_later(0, events.append, "timer")
    await asyncio.sleep(0); await asyncio.sleep(0)
    assert "ready" in events and "timer" in events
    task = asyncio.create_task(asyncio.sleep(0, result=7))
    assert await task == 7
asyncio.run(main())
