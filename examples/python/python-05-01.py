import importlib.util, sys, tempfile
from pathlib import Path
with tempfile.TemporaryDirectory() as root:
    path = Path(root) / "sample_mod.py"; path.write_text("value=41\n")
    spec = importlib.util.spec_from_file_location("sample_mod", path)
    module = importlib.util.module_from_spec(spec); sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    assert module.value + 1 == 42 and sys.modules["sample_mod"] is module
    del sys.modules["sample_mod"]
