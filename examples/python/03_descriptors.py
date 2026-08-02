"""Python 02-02：data / non-data descriptor 的优先级。"""


class DataField:
    def __get__(self, obj, owner=None):
        return self if obj is None else "data"
    def __set__(self, obj, value):
        raise AttributeError("read-only")


class NonDataField:
    def __get__(self, obj, owner=None):
        return self if obj is None else "non-data"


class PositiveInt:
    def __set_name__(self, owner, name): self.private_name = "_" + name
    def __get__(self, obj, owner=None): return self if obj is None else getattr(obj, self.private_name)
    def __set__(self, obj, value):
        if type(value) is not int or value <= 0: raise ValueError("positive int required")
        setattr(obj, self.private_name, value)


class Sample:
    data = DataField()
    non_data = NonDataField()
    quantity = PositiveInt()
    @property
    def locked(self): return "locked"


sample = Sample()
sample.__dict__.update(data="instance-data", non_data="instance-non-data", locked="shadow")
sample.quantity = 2
other = Sample(); other.quantity = 3
assert sample.data == "data"
assert sample.non_data == "instance-non-data"
assert sample.locked == "locked"
assert (sample.quantity, other.quantity) == (2, 3)
try:
    sample.locked = "new"
    raise AssertionError("只读 property 应拒绝写入")
except AttributeError:
    pass
try:
    sample.quantity = 0
    raise AssertionError("校验 descriptor 应拒绝零")
except ValueError:
    pass
print("python-02-02 assertions passed")
