from collections import deque
items = [1, 2, 3]; items.append(4); assert items.pop(0) == 1
queue = deque([2, 3]); queue.appendleft(1); assert queue.popleft() == 1
assert {"a": 1}.get("missing") is None
assert {1, 1, 2} == {1, 2}
