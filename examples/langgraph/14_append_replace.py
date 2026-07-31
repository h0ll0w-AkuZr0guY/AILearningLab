def last_value(writes):
    if len(writes) != 1: raise ValueError("INVALID_CONCURRENT_GRAPH_UPDATE")
    return writes[0]
def append(old, writes):
    return old + [item for write in writes for item in write]

assert last_value(["approved"]) == "approved"
assert append(["e1"], [["e2"], ["e3"]]) == ["e1", "e2", "e3"]
try: last_value(["approved", "rejected"])
except ValueError: print("append replace: ok")
else: raise AssertionError("concurrent replace must fail")
