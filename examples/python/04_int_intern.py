"""python-01-04：当前 CPython 的小整数缓存与显式字符串驻留。"""

import sys


assert sys.implementation.name == "cpython", "小整数范围是本课的 CPython 实现观察"

cached_a, cached_b = int("256"), int("256")
outside_a, outside_b = int("257"), int("257")
assert cached_a is cached_b
assert outside_a is not outside_b

left = "token:" + "alpha"
right = "".join(["token", ":alpha"])
assert left == right
assert sys.intern(left) is sys.intern(right)

try:
    sys.intern(42)
    raise AssertionError("sys.intern 只接受 str")
except TypeError:
    pass

print("python-01-04 assertions passed")
