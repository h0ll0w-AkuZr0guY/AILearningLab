import asyncio
async def main():
    queue = asyncio.Queue(maxsize=1); await queue.put("work")
    assert queue.full()
    async def consume():
        item = await queue.get()
        try: assert item == "work"
        finally: queue.task_done()
    worker = asyncio.create_task(consume()); await queue.join(); await worker
    assert queue.empty()
asyncio.run(main())
