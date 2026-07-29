"""教学版图迁移门禁：静态拓扑合法不等于存量线程可恢复。"""

from dataclasses import dataclass


@dataclass(frozen=True)
class StoredThread:
    thread_id: str
    next_nodes: tuple[str, ...]
    values: dict[str, object]


def validate_graph(nodes: set[str], edges: list[tuple[str, str]]) -> None:
    allowed = nodes | {"START", "END"}
    assert any(source == "START" for source, _ in edges)
    for source, target in edges:
        if source not in allowed or target not in allowed:
            raise ValueError(f"unknown endpoint: {source} -> {target}")


def migration_issues(nodes: set[str], required_keys: set[str], threads: list[StoredThread]) -> list[str]:
    issues: list[str] = []
    for thread in threads:
        missing_nodes = set(thread.next_nodes) - nodes
        missing_keys = required_keys - thread.values.keys()
        if missing_nodes:
            issues.append(f"{thread.thread_id}: missing nodes {sorted(missing_nodes)}")
        if missing_keys:
            issues.append(f"{thread.thread_id}: missing keys {sorted(missing_keys)}")
    return issues


new_nodes = {"draft_v2", "send"}
validate_graph(new_nodes, [("START", "draft_v2"), ("draft_v2", "send"), ("send", "END")])
parked = [StoredThread("t-1", ("draft",), {"text": "hello"})]
issues = migration_issues(new_nodes, {"text", "schema_version"}, parked)

assert issues == [
    "t-1: missing nodes ['draft']",
    "t-1: missing keys ['schema_version']",
]
print(issues)
