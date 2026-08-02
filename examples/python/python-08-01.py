import ast, sys
tree = ast.parse("answer = 6 * 7"); compiled = compile(tree, "<workbench>", "exec")
namespace = {}; exec(compiled, namespace)
assert namespace["answer"] == 42 and sys.implementation.name == "cpython"
