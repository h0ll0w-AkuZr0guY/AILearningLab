"""python-01-03：引用计数、循环与显式 GC 诊断。"""

import gc
import sys
import weakref


class Node:
    pass


item = [42]
before = sys.getrefcount(item)
alias = item
assert sys.getrefcount(item) == before + 1

left, right = Node(), Node()
left.other, right.other = right, left
observed = weakref.ref(left)
del left, right
gc.collect()
assert observed() is None

thresholds = gc.get_threshold()
assert len(thresholds) == 3 and all(isinstance(value, int) for value in thresholds)

try:
    weakref.ref([])
    raise AssertionError("list 不支持弱引用，应该有明确的失败路径")
except TypeError:
    pass

print("python-01-03 assertions passed")
