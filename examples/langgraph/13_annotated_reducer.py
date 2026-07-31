from operator import add

def reduce_many(current, writes):
    for write in writes:
        current = add(current, write)
    return current

assert reduce_many([], [["risk"], ["refund"]]) == ["risk", "refund"]
assert reduce_many(0, [2, 3]) == 5
try:
    reduce_many([], ["invalid"])
except TypeError:
    print("annotated reducer: ok")
else:
    raise AssertionError("invalid update must fail")
