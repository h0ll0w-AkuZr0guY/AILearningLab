import dis, symtable
source = "def outer(x):\n y=1\n def inner():\n  return x+y\n return inner\n"
table = symtable.symtable(source, "<memory>", "exec")
assert table.get_children()[0].get_name() == "outer"
namespace = {}; exec(compile(source, "<memory>", "exec"), namespace)
assert namespace["outer"](41)() == 42
print(dis.code_info(namespace["outer"]))
