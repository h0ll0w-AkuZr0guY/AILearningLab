from functools import wraps
from inspect import signature
def traced(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs): return fn(*args, **kwargs)
    return wrapper
@traced
def greet(name: str) -> str: return "hi " + name
assert greet("Ada") == "hi Ada"
assert greet.__wrapped__.__name__ == "greet"
assert str(signature(greet)) == "(name: str) -> str"
try: greet()
except TypeError: pass
else: raise AssertionError("包装器应保留参数失败")
