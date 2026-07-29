"""教学版循环保护：业务停机、步数预算和部分结果各司其职。"""

from dataclasses import dataclass, field


class OutOfSteps(RuntimeError):
    pass


@dataclass
class SearchState:
    query: str
    evidence: list[str] = field(default_factory=list)
    status: str = "searching"


def run(state: SearchState, recursion_limit: int) -> SearchState:
    for step in range(recursion_limit):
        remaining = recursion_limit - step

        # 业务停机条件：证据达到质量门槛。
        if len(state.evidence) >= 2:
            state.status = "complete"
            return state

        # 生产降级：预留一步整理当前证据，避免只抛异常。
        if remaining <= 1:
            state.status = "partial"
            return state

        state.evidence.append(f"evidence-{step + 1}")

    raise OutOfSteps("loop exhausted without a semantic stop")


complete = run(SearchState("checkpoint"), recursion_limit=5)
partial = run(SearchState("checkpoint"), recursion_limit=2)

assert complete.status == "complete"
assert partial.status == "partial"
assert partial.evidence == ["evidence-1"]
print({"complete": complete, "partial": partial})
