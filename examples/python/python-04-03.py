from contextlib import ExitStack
events = []
class Resource:
    def __enter__(self): events.append("enter"); return self
    def __exit__(self, exc_type, exc, tb):
        events.append(exc_type.__name__ if exc_type else "ok"); return False
try:
    with Resource(): events.append("body"); raise ValueError("bad")
except ValueError: pass
assert events == ["enter", "body", "ValueError"]
events.clear()
with ExitStack() as stack:
    stack.enter_context(Resource()); stack.enter_context(Resource())
assert events == ["enter", "enter", "ok", "ok"]
