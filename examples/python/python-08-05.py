import dis
class Box: value = 1
def read(box): return box.value
box = Box()
for _ in range(2000): read(box)
text = dis.Bytecode(read, adaptive=True, show_caches=True).dis()
assert "LOAD_ATTR" in text or "value" in text
