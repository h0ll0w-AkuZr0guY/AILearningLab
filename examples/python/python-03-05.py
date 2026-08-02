from contextlib import contextmanager
def leaf():
    value = yield "leaf-ready"
    return value + 1
def delegated():
    result = yield from leaf()
    return result * 2
g = delegated(); assert next(g) == "leaf-ready"
try: g.send(20)
except StopIteration as done: assert done.value == 42
else: raise AssertionError("委派返回值应进入 StopIteration")
events = []
@contextmanager
def resource():
    events.append("open")
    try: yield "handle"
    finally: events.append("close")
with resource() as handle: assert handle == "handle"
assert events == ["open", "close"]
