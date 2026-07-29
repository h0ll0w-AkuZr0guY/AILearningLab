"""教学版 apply_writes：调度完成顺序不能决定 reducer 输入顺序。"""

from dataclasses import dataclass


@dataclass(frozen=True)
class TaskWrites:
    path: tuple[str | int, ...]
    value: str


def apply_writes(tasks: list[TaskWrites]) -> str:
    ordered = sorted(tasks, key=lambda task: tuple(map(str, task.path[:3])))
    # 字符串连接故意选择非交换 reducer，便于暴露顺序差异。
    return " > ".join(task.value for task in ordered)


finished_in_race_order = [
    TaskWrites(("pull", 2), "B"),
    TaskWrites(("pull", 1), "A"),
    TaskWrites(("pull", 3), "C"),
]

assert apply_writes(finished_in_race_order) == "A > B > C"

# 外部随机结果必须先记录，再作为确定输入进入控制流。
event_log = {"route-choice": "manual-review"}
replayed_route = event_log["route-choice"]
assert replayed_route == "manual-review"
print({"reduced": apply_writes(finished_in_race_order), "route": replayed_route})
