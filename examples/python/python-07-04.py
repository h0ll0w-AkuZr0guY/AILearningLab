import gc, tracemalloc
tracemalloc.start(); before = tracemalloc.take_snapshot()
objects = [{"value": i} for i in range(100)]
after = tracemalloc.take_snapshot()
assert after.compare_to(before, "lineno"); del objects; gc.collect(); tracemalloc.stop()
