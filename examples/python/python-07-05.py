import dis
class Box: value = 42
def lookup(obj): return obj.value
box = Box()
for _ in range(1000): assert lookup(box) == 42
text = dis.Bytecode(lookup).dis()
assert "LOAD_ATTR" in text or "value" in text
