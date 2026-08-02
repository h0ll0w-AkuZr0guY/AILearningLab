import sys
def add(x, y=1):
    frame = sys._getframe()
    assert frame.f_locals["x"] == x
    return x + y
assert add.__defaults__ == (1,)
assert add.__globals__ is globals()
assert add(2) == 3
try: add(1, 2, 3)
except TypeError: pass
else: raise AssertionError("参数绑定应拒绝多余实参")
