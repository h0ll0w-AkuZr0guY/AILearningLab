import timeit
samples = timeit.repeat("sum(range(20))", repeat=5, number=1000)
assert len(samples) == 5 and min(samples) >= 0
assert timeit.timeit(lambda: sum(range(20)), number=100) >= 0
