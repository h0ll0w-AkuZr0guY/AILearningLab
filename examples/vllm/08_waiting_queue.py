"""vllm-01-08 等待队列：FCFS 与 priority 队列、回队语义（离线合同实验）。

复刻 vllm/v1/core/sched/request_queue.py v0.26.0 的
FCFSRequestQueue（deque）与 PriorityRequestQueue（heap）语义：
- FCFS：add 尾部进 / pop 头部出 / prepend 头部回 / extendleft 顺序反转
- priority：按 (priority, arrival, id) 全序，回队按字段重插
运行：python 08_waiting_queue.py
"""

import heapq
from collections import deque


class FCFSQueue:
    """复刻 FCFSRequestQueue 语义（deque）。"""

    def __init__(self) -> None:
        self._q: deque[str] = deque()

    def add(self, item: str) -> None:
        self._q.append(item)

    def pop(self) -> str:
        return self._q.popleft()

    def prepend(self, item: str) -> None:
        self._q.appendleft(item)

    def prepend_all(self, items: list[str]) -> None:
        self._q.extendleft(items)      # 注意：顺序反转（与上游一致）

    def peek(self) -> str:
        return self._q[0]

    def __len__(self) -> int:
        return len(self._q)


class PriorityQueue:
    """复刻 PriorityRequestQueue 语义：priority -> arrival -> id。"""

    def __init__(self) -> None:
        self._heap: list[tuple[int, float, str]] = []

    def add(self, priority: int, arrival: float, item: str) -> None:
        heapq.heappush(self._heap, (priority, arrival, item))

    def pop(self) -> str:
        return heapq.heappop(self._heap)[2]

    def peek(self) -> str:
        return self._heap[0][2]

    def __len__(self) -> int:
        return len(self._heap)


def main() -> None:
    # 断言 1：FCFS 顺序严格由到达决定
    fcfs = FCFSQueue()
    for r in ["r1", "r2", "r3"]:
        fcfs.add(r)
    assert [fcfs.pop() for _ in range(3)] == ["r1", "r2", "r3"]

    # 断言 2：priority 顺序由字段决定（priority -> arrival）
    pq = PriorityQueue()
    pq.add(priority=1, arrival=0.0, item="low-priority-early")
    pq.add(priority=0, arrival=5.0, item="high-priority-late")
    pq.add(priority=0, arrival=3.0, item="high-priority-earlier")
    assert pq.pop() == "high-priority-earlier"
    assert pq.pop() == "high-priority-late"
    assert pq.pop() == "low-priority-early"

    # 断言 3：抢占回队——FCFS 回队头
    fcfs2 = FCFSQueue()
    for r in ["a", "b", "c"]:
        fcfs2.add(r)
    fcfs2.pop()
    fcfs2.prepend("a")                              # a 被抢占回队头
    assert fcfs2.pop() == "a"

    # 断言 4：priority 回队按字段重插，arrival 保持初始值
    pq2 = PriorityQueue()
    pq2.add(priority=0, arrival=1.0, item="x")
    pq2.add(priority=0, arrival=2.0, item="y")
    pq2.add(priority=0, arrival=3.0, item="z")
    pq2.pop()
    pq2.add(priority=0, arrival=1.0, item="x")      # 按原 arrival 重插
    assert pq2.pop() == "x"

    # 断言 5：低优先级被高优先级越过（饥饿风险）
    pq3 = PriorityQueue()
    pq3.add(priority=5, arrival=0.0, item="old-low")
    pq3.add(priority=0, arrival=1.0, item="new-high")
    assert pq3.pop() == "new-high"
    assert pq3.pop() == "old-low"

    # 断言 6：extendleft 顺序反转
    fcfs3 = FCFSQueue()
    for r in ["p", "q"]:
        fcfs3.add(r)
    fcfs3.prepend_all(["p", "q"])
    assert fcfs3.pop() == "q", "extendleft 顺序反转：先 pop 出 q"
    assert fcfs3.pop() == "p"

    print("vllm-01-08 waiting queue: 全部断言通过")


if __name__ == "__main__":
    main()
