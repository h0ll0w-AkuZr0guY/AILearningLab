"""python-01-02：身份、相等与哈希的双向分派。"""


class Left:
    def __eq__(self, other):
        return NotImplemented if isinstance(other, Right) else True


class Right:
    def __eq__(self, other):
        return True if isinstance(other, Left) else NotImplemented


class EqualButUnhashable:
    def __eq__(self, other):
        return isinstance(other, EqualButUnhashable)


same = [1, 2]
alias = same
other = [1, 2]
assert alias is same and other is not same and other == same
assert Left() == Right()

mapping = {1: "integer"}
mapping[1.0] = "float"
assert len(mapping) == 1 and mapping[1] == "float"

try:
    hash(EqualButUnhashable())
    raise AssertionError("覆盖 __eq__ 而未定义 __hash__ 的实例不应可 hash")
except TypeError:
    pass

print("python-01-02 assertions passed")
