import inspect
def inner(value): return value + 1
def outer(value):
    frame = inspect.currentframe(); assert frame.f_code.co_name == "outer"
    return inner(value)
assert outer(41) == 42 and outer.__code__.co_argcount == 1
