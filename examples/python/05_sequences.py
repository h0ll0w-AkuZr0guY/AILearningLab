"""python-01-05：list 容量阶梯、tuple 槽位与失败边界。"""

import sys


items = []
sizes = []
for number in range(20):
    items.append(number)
    sizes.append(sys.getsizeof(items))

assert sizes[0] == sizes[3]
assert sizes[4] > sizes[3]
assert sizes[8] > sizes[7]
assert sys.getsizeof(tuple(range(100))) < sys.getsizeof(list(range(100)))

inner = [42]
record = (inner,)
inner.append(43)
assert record[0] == [42, 43]

try:
    hash([1, 2])
    raise AssertionError("list 是可变容器，不应可 hash")
except TypeError:
    pass

print("python-01-05 assertions passed")
