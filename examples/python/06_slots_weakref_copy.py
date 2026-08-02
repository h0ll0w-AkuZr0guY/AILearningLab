"""Python 02-05：slots、弱所有权与对象图复制。"""

import copy
import gc
import weakref


class Slotted:
    __slots__ = ("items", "__weakref__")
    def __init__(self, items): self.items = items


class NoWeak:
    __slots__ = ("x",)


obj = Slotted(["a"])
assert not hasattr(obj, "__dict__")
reference = weakref.ref(obj)
shallow = copy.copy(obj)
deep = copy.deepcopy(obj)
assert shallow.items is obj.items
assert deep.items == obj.items and deep.items is not obj.items
shared = []
graph_clone = copy.deepcopy([shared, shared])
assert graph_clone[0] is graph_clone[1]
assert graph_clone[0] is not shared
cache = weakref.WeakValueDictionary()
cache["obj"] = obj
del obj
gc.collect()
assert reference() is None
assert "obj" not in cache
try:
    weakref.ref(NoWeak())
    raise AssertionError("缺少 __weakref__ 必须失败")
except TypeError:
    pass
print("python-02-05 assertions passed")
