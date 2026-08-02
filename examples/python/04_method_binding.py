"""Python 02-03：函数描述器、三种方法与 __set_name__。"""


class Field:
    def __set_name__(self, owner, name): self.private_name = "_" + name
    def __get__(self, obj, owner=None): return self if obj is None else getattr(obj, self.private_name)
    def __set__(self, obj, value): setattr(obj, self.private_name, value)


class Token:
    code = Field()
    def __init__(self, text): self.text = text
    def show(self): return self.text
    @classmethod
    def parse(cls, text): return cls(text.strip())
    @staticmethod
    def normalize(text): return text.strip().lower()


class ChildToken(Token): pass


token = Token("ok"); token.code = "A"
assert token.show.__self__ is token
assert token.show.__func__ is Token.show
assert isinstance(ChildToken.parse(" x "), ChildToken)
assert Token.normalize(" X ") == "x"
token.show = lambda: "shadow"
assert token.show() == "shadow"
Token.extra = Field()
try:
    token.extra = "late"
    raise AssertionError("动态字段未经通知应失败")
except AttributeError:
    pass
Token.extra.__set_name__(Token, "extra")
token.extra = "late"
assert token.extra == "late"
try:
    Token.show()
    raise AssertionError("裸函数必须缺少 self")
except TypeError:
    pass
print("python-02-03 assertions passed")
