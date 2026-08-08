from dataclasses import dataclass


@dataclass(frozen=True)
class FakeModel:
    provider: str
    model: str


REGISTRY = {
    "openai": lambda model: FakeModel("openai", model),
    "anthropic": lambda model: FakeModel("anthropic", model),
}


def init_chat_model(model: str, provider: str | None = None) -> FakeModel:
    if provider is None and ":" in model:
        prefix, model = model.split(":", 1)
        provider = prefix if prefix in REGISTRY else None
    if provider is None:
        provider = "openai" if model.startswith("gpt-") else None
    if provider is None or provider not in REGISTRY:
        raise ValueError("provider cannot be selected")
    return REGISTRY[provider](model)


assert init_chat_model("openai:demo") == FakeModel("openai", "demo")
assert init_chat_model("demo", "anthropic").provider == "anthropic"
try:
    init_chat_model("mystery")
except ValueError:
    pass
else:
    raise AssertionError("unknown provider must fail")
print("provider selection: ok")
