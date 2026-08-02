from __future__ import annotations
import inspect, sys
class Node: pass
def link(value: Node) -> list[Node]: return [value]
annotations = inspect.get_annotations(link, eval_str=False)
assert "Node" in str(annotations["value"])
assert annotations["return"] == "list[Node]"
if sys.version_info >= (3, 14):
    import annotationlib
    assert annotationlib.get_annotations(link, format=annotationlib.Format.STRING)
