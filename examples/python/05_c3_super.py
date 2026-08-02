"""Python 02-04：C3 MRO 与 super 的动态起点。"""


class Root:
    def chain(self): return ["Root"]
class Left(Root):
    def chain(self): return ["Left"] + super().chain()
class Right(Root):
    def chain(self): return ["Right"] + super().chain()
class Leaf(Left, Right):
    def chain(self): return ["Leaf"] + super().chain()


leaf = Leaf()
assert [cls.__name__ for cls in Leaf.__mro__] == ["Leaf", "Left", "Right", "Root", "object"]
assert leaf.chain() == ["Leaf", "Left", "Right", "Root"]
assert super(Left, leaf).chain() == ["Right", "Root"]
try:
    exec("class X: pass\nclass Y: pass\nclass A(X, Y): pass\nclass B(Y, X): pass\nclass Bad(A, B): pass\n")
    raise AssertionError("反序约束必须无法线性化")
except TypeError:
    pass
print("python-02-04 assertions passed")
