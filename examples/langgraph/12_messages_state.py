def add_messages(left, right):
    merged = [dict(item) for item in left]
    index = {item["id"]: i for i, item in enumerate(merged)}
    for item in right:
        if "id" not in item:
            raise ValueError("message id required")
        if item["id"] in index:
            merged[index[item["id"]]] = dict(item)
        else:
            index[item["id"]] = len(merged)
            merged.append(dict(item))
    return merged

result = add_messages([{"id": "a", "text": "draft"}], [{"id": "a", "text": "final"}, {"id": "b", "text": "tool"}])
assert result == [{"id": "a", "text": "final"}, {"id": "b", "text": "tool"}]
try:
    add_messages(result, [{"text": "missing"}])
except ValueError:
    print("messages state: ok")
else:
    raise AssertionError("missing id must fail")
