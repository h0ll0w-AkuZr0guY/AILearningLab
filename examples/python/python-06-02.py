import asyncio
async def slow(cleaned):
    try: await asyncio.sleep(1)
    except asyncio.CancelledError:
        cleaned.append(True); raise
async def main():
    cleaned = []
    try:
        async with asyncio.timeout(0): await asyncio.sleep(1)
    except TimeoutError: pass
    task = asyncio.create_task(slow(cleaned)); await asyncio.sleep(0); task.cancel()
    try: await task
    except asyncio.CancelledError: pass
    assert cleaned == [True]
asyncio.run(main())
