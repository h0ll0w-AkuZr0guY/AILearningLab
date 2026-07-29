"""教学版 StateSnapshot：区分业务值、调度任务与 checkpoint 身份。"""

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class Task:
    task_id: str
    name: str
    error: str | None = None


@dataclass(frozen=True)
class Snapshot:
    values: dict[str, Any]
    next: tuple[str, ...]
    config: dict[str, dict[str, str]]
    metadata: dict[str, Any]
    tasks: tuple[Task, ...]

    def validate(self) -> None:
        scheduled = tuple(task.name for task in self.tasks if task.error is None)
        assert scheduled == self.next
        assert self.config["configurable"]["thread_id"]
        assert self.config["configurable"]["checkpoint_id"]


snapshot = Snapshot(
    values={"draft": "退款说明", "approved": False},
    next=("human_review",),
    config={
        "configurable": {
            "thread_id": "order-42",
            "checkpoint_id": "cp-0007",
        }
    },
    metadata={"source": "loop", "step": 3, "writes": {"draft": {"draft": "退款说明"}}},
    tasks=(Task("task-8", "human_review"),),
)
snapshot.validate()
assert "human_review" not in snapshot.values
print(snapshot)
