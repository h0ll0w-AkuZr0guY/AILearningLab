import sys, tempfile
from pathlib import Path
events = []
def audit(event, args):
    if event == "open": events.append(event)
sys.addaudithook(audit)
with tempfile.TemporaryDirectory() as root:
    path = Path(root) / "trace.txt"; path.write_text("ok", encoding="utf-8")
    assert path.read_text(encoding="utf-8") == "ok"
assert "open" in events
