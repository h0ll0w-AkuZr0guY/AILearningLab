def conversation():
    try:
        incoming = yield "ready"
        yield incoming.upper()
    except ValueError:
        yield "recovered"
g = conversation()
assert next(g) == "ready"
assert g.send("ok") == "OK"
g = conversation(); next(g)
assert g.throw(ValueError("bad")) == "recovered"
g.close()
