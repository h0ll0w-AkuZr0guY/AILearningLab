"""python-01-01：在当前 CPython 中观察 PyObject 头部。"""

import ctypes
import sys


assert sys.implementation.name == "cpython", "本实验只解释 CPython 布局"


class PyObjectHead(ctypes.Structure):
    _fields_ = [("ob_refcnt", ctypes.c_ssize_t), ("ob_type", ctypes.c_void_p)]


def head_of(obj):
    return PyObjectHead.from_address(id(obj))


items = [1, 2]
before = head_of(items).ob_refcnt
alias = items
after = head_of(items).ob_refcnt
assert after == before + 1
assert head_of(items).ob_type == id(list)
assert ctypes.cast(id(items), ctypes.py_object).value is items

try:
    type(items)(1, 2)
    raise AssertionError("list() 不应接受两个位置参数")
except TypeError:
    pass

print("python-01-01 assertions passed")
