import ast, tokenize
from io import StringIO
tokens = list(tokenize.generate_tokens(StringIO("x = 1\n").readline))
assert any(token.string == "x" for token in tokens)
assert isinstance(ast.parse("x = 1").body[0], ast.Assign)
try: ast.parse("x =")
except SyntaxError as error: assert error.lineno == 1
else: raise AssertionError("错误源码必须带位置")
