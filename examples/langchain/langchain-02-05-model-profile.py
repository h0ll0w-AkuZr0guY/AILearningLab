import warnings


def choose(profile: dict[str, object] | None, required: str) -> str:
    value = profile.get(required) if profile else None
    if value is True:
        return "use"
    if value is False:
        return "fallback"
    return "unknown"


assert choose({"tool_calling": True}, "tool_calling") == "use"
assert choose({"tool_calling": False}, "tool_calling") == "fallback"
assert choose({}, "tool_calling") == "unknown"
assert choose(None, "tool_calling") == "unknown"

with warnings.catch_warnings(record=True) as caught:
    warnings.simplefilter("always")
    profile = {"tool_calling": True, "future_flag": True}
    unknown = set(profile) - {"tool_calling"}
    if unknown:
        warnings.warn(f"unknown profile keys: {sorted(unknown)}")
    assert caught and "future_flag" in str(caught[0].message)

print("model profile negotiation: ok")
