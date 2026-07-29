"""教学版 pending writes：同一轮成功任务在恢复时不重复执行。"""

from dataclasses import dataclass, field
from typing import Callable


@dataclass
class Store:
    pending: dict[str, dict[str, str]] = field(default_factory=dict)

    def put_writes(self, task_id: str, writes: dict[str, str]) -> None:
        # 同一 task_id 覆盖旧尝试，模拟任务级耐久写入。
        self.pending[task_id] = dict(writes)


calls = {"profile": 0, "risk": 0}


def profile() -> dict[str, str]:
    calls["profile"] += 1
    return {"profile": "vip"}


def risk() -> dict[str, str]:
    calls["risk"] += 1
    if calls["risk"] == 1:
        raise RuntimeError("temporary")
    return {"risk": "low"}


tasks: dict[str, Callable[[], dict[str, str]]] = {
    "task-profile": profile,
    "task-risk": risk,
}
store = Store()

for task_id, task in tasks.items():
    try:
        store.put_writes(task_id, task())
    except RuntimeError:
        pass

# 恢复只执行没有成功 pending write 的任务。
for task_id, task in tasks.items():
    if task_id not in store.pending:
        store.put_writes(task_id, task())

state = {}
for writes in store.pending.values():
    state.update(writes)

assert state == {"profile": "vip", "risk": "low"}
assert calls == {"profile": 1, "risk": 2}
print({"state": state, "calls": calls})
