import inspect
def make():
    value = "shared"
    def read(): return value
    return read
reader = make()
assert reader.__code__.co_freevars == ("value",)
assert inspect.getclosurevars(reader).nonlocals["value"] == "shared"
snapshots = [lambda i=i: i for i in range(3)]
late = [lambda: i for i in range(3)]
assert [f() for f in snapshots] == [0, 1, 2]
assert [f() for f in late] == [2, 2, 2]
