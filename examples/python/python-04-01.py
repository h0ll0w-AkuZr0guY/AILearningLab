events = []
def run(kind):
    try:
        if kind == "error": raise ValueError("bad")
        if kind == "return": return "body"
    except ValueError:
        events.append("except"); return "handled"
    else:
        events.append("else"); return "ok"
    finally: events.append("finally")
assert run("ok") == "ok" and events == ["else", "finally"]
events.clear(); assert run("error") == "handled"
assert events == ["except", "finally"]
