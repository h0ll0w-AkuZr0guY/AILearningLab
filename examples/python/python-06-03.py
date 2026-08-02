import asyncio
async def fail(): raise ValueError("bad")
async def ok(): await asyncio.sleep(0); return 7
async def main():
    try:
        async with asyncio.TaskGroup() as group:
            group.create_task(fail()); group.create_task(ok())
    except* ValueError as errors: assert len(errors.exceptions) == 1
    results = await asyncio.gather(ok(), fail(), return_exceptions=True)
    assert results[0] == 7 and isinstance(results[1], ValueError)
asyncio.run(main())
