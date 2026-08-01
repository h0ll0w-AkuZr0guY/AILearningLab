"""vllm-01-06 请求形状：字段如何决定调度账本（离线合同实验）。

复刻 vllm/v1/request.py v0.26.0 的 Request 形状语义：
- num_tokens_with_spec = prompt + generated + spec
- debt = num_tokens_with_spec - num_computed_tokens
- __lt__ 全序：priority -> arrival_time -> request_id
运行：python 06_request_shape.py
"""

import heapq
import time


class RequestShape:
    """最小请求形状模型：字段决定欠账与输出预算。"""

    def __init__(self, request_id: str, prompt_tokens: int,
                 max_tokens: int, priority: int = 0,
                 arrival: float | None = None):
        self.request_id = request_id
        self.prompt_tokens = prompt_tokens
        self.max_tokens = max_tokens
        self.priority = priority
        self.arrival = arrival if arrival is not None else time.time()
        self.generated = 0
        self.spec = 0
        self.computed = 0

    @property
    def num_tokens_with_spec(self) -> int:
        return self.prompt_tokens + self.generated + self.spec

    @property
    def debt(self) -> int:
        return self.num_tokens_with_spec - self.computed

    def step_decode(self) -> None:
        """模拟一次 decode：生成 1 个 token，KV 立即分配。"""
        assert self.debt == 0, "decode 前欠账应为 0（prefill 已完成）"
        self.generated += 1
        self.computed += 1

    def is_finished(self) -> bool:
        return self.generated >= self.max_tokens

    def __lt__(self, other: "RequestShape") -> bool:
        # 与 vllm/v1/request.py L329-341 同构：priority -> arrival -> id
        if self.priority != other.priority:
            return self.priority < other.priority
        if self.arrival != other.arrival:
            return self.arrival < other.arrival
        return self.request_id < other.request_id


def schedule_step(requests: list[RequestShape], budget: int) -> dict[str, int]:
    """统一预算模型推进一步；返回 {id: num_tokens}（简化：每请求 1 token）。"""
    out: dict[str, int] = {}
    remaining = budget
    for r in requests:
        if remaining <= 0:
            break
        out[r.request_id] = 1
        r.computed += 1
        remaining -= 1
    return out


def main() -> None:
    # 断言 1：请求形状决定欠账
    r = RequestShape("r1", prompt_tokens=2048, max_tokens=128)
    assert r.num_tokens_with_spec == 2048
    assert r.debt == 2048                       # 新请求欠整个 prompt
    r.computed = 1024
    assert r.debt == 1024                       # 切一块后欠账减半
    r.computed = 2048
    assert r.debt == 0                          # prefill 完成，转入 decode
    r.step_decode()
    assert r.generated == 1 and r.debt == 0
    assert not r.is_finished()
    for _ in range(127):
        r.step_decode()
    assert r.is_finished()                      # 正好 128 个输出

    # 断言 2：priority 排序（priority -> arrival -> id）
    a = RequestShape("a", 10, 10, priority=0, arrival=1.0)
    b = RequestShape("b", 10, 10, priority=1, arrival=0.0)   # 更早但优先级低
    c = RequestShape("c", 10, 10, priority=0, arrival=2.0)
    heap = [b, c, a]
    heapq.heapify(heap)
    order = [heapq.heappop(heap).request_id for _ in range(3)]
    assert order == ["a", "c", "b"], order     # priority 0 的 a、c 先于 b

    # 断言 3：同 priority 退化为 FCFS（按 arrival）
    d = RequestShape("d", 10, 10, priority=0, arrival=5.0)
    e = RequestShape("e", 10, 10, priority=0, arrival=3.0)
    f = RequestShape("f", 10, 10, priority=0, arrival=4.0)
    heap2 = [d, e, f]
    heapq.heapify(heap2)
    assert [heapq.heappop(heap2).request_id for _ in range(3)] == ["e", "f", "d"]

    # 断言 4：统一预算下长请求被切块
    long_req = RequestShape("long", 8192, 64)
    short_reqs = [RequestShape(f"s{i}", 10, 10) for i in range(8)]
    step = schedule_step([long_req] + short_reqs, budget=32)
    assert step["long"] == 1
    assert sum(step.values()) == 9                # 9 个请求各 1 token（简化）

    # 断言 5：max_tokens 是输出预算
    r2 = RequestShape("r2", 100, 5)
    r2.computed = 100                              # prefill 完成
    for _ in range(5):
        r2.step_decode()
    assert r2.is_finished() and r2.num_tokens_with_spec == 105   # 100 + 5

    print("vllm-01-06 request shape: 全部断言通过")


if __name__ == "__main__":
    main()
