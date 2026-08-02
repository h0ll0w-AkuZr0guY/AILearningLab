import importlib.util
assert importlib.util.resolve_name("..core", "pkg.sub") == "pkg.core"
assert importlib.util.resolve_name(".models", "pkg") == "pkg.models"
try: importlib.util.resolve_name("...bad", "pkg")
except ImportError: pass
else: raise AssertionError("越过顶层必须失败")
