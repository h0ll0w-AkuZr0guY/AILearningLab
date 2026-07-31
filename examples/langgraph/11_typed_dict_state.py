from typing_extensions import NotRequired, TypedDict

class State(TypedDict):
    ticket_id: str
    intent: NotRequired[str]
    answer: NotRequired[str]

FIELDS = {"ticket_id", "intent", "answer"}
def apply(state: State, update: dict[str, str]) -> State:
    unknown = set(update) - FIELDS
    if unknown:
        raise KeyError(unknown)
    return {**state, **update}

state: State = {"ticket_id": "T-7"}
state = apply(state, {"intent": "refund"})
assert state["ticket_id"] == "T-7" and state["intent"] == "refund"
try:
    apply(state, {"client": "forbidden"})
except KeyError:
    print("typed dict state: ok")
else:
    raise AssertionError("unknown key must fail")
