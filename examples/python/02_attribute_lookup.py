"""Python 02-01：属性读取入口、回退与递归失败。"""


class TraceProfile:
    plan = "class-plan"
    def __init__(self):
        object.__setattr__(self, "_reads", [])
        self.plan = "instance-plan"
    def __getattribute__(self, name):
        if name != "_reads":
            object.__getattribute__(self, "_reads").append(name)
        return object.__getattribute__(self, name)
    def __getattr__(self, name):
        if name == "legacy_plan":
            return self.plan
        raise AttributeError(name)


class BadTrace:
    def __getattribute__(self, name):
        return getattr(self, name)


profile = TraceProfile()
assert profile.plan == "instance-plan"
assert profile.legacy_plan == "instance-plan"
assert profile._reads[:2] == ["plan", "legacy_plan"]
try:
    profile.unknown
    raise AssertionError("未知字段必须保留 AttributeError")
except AttributeError:
    pass
try:
    BadTrace().anything
    raise AssertionError("递归入口必须失败")
except RecursionError:
    pass
print("python-02-01 assertions passed")
