import cProfile, io, pstats
def work(): return sum(i * i for i in range(100))
stream = io.StringIO(); profiler = cProfile.Profile(); profiler.enable()
assert work() == 328350; profiler.disable()
stats = pstats.Stats(profiler, stream=stream); stats.sort_stats("cumulative"); stats.print_stats()
assert stats.total_calls > 0 and "work" in stream.getvalue()
