def merge_versions(old, update):
    result = dict(old)
    for key, candidate in update.items():
        if candidate[0] < 0:
            raise ValueError("negative version")
        existing = result.get(key)
        if existing is None or candidate[0] > existing[0]:
            result[key] = candidate
        elif candidate[0] == existing[0] and candidate != existing:
            raise ValueError("same-version conflict")
    return result

base = {"order-7": (1, "pending")}
merged = merge_versions(base, {"order-7": (2, "approved")})
assert merge_versions(merged, {"order-7": (2, "approved")}) == merged
try:
    merge_versions(merged, {"order-7": (2, "rejected")})
except ValueError:
    print("custom reducer: ok")
else:
    raise AssertionError("conflict must fail")
