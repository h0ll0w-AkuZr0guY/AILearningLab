try:
    try: raise KeyError("missing")
    except KeyError as cause: raise RuntimeError("failed") from cause
except RuntimeError as error:
    assert isinstance(error.__cause__, KeyError)
try: raise ExceptionGroup("batch", [ValueError("a"), TypeError("b")])
except* ValueError as group: assert len(group.exceptions) == 1
except* TypeError as group: assert len(group.exceptions) == 1
