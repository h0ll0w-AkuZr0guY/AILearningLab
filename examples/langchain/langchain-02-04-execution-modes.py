class FakeModel:
    def invoke(self, value: str) -> str:
        if value == "bad":
            raise ValueError("fake failure")
        return value.upper()

    def stream(self, value: str):
        for character in self.invoke(value):
            yield character

    def batch(self, values: list[str], return_exceptions: bool = False):
        outputs = []
        for value in values:
            try:
                outputs.append(self.invoke(value))
            except Exception as error:
                if not return_exceptions:
                    raise
                outputs.append(error)
        return outputs

    def batch_as_completed(self, values: list[str]):
        for index in reversed(range(len(values))):
            try:
                yield index, self.invoke(values[index])
            except Exception as error:
                yield index, error


model = FakeModel()
assert "".join(model.stream("ok")) == "OK"
assert model.batch(["a", "b"]) == ["A", "B"]
failed = model.batch(["a", "bad", "c"], return_exceptions=True)
assert failed[0] == "A" and isinstance(failed[1], ValueError) and failed[2] == "C"
completed = list(model.batch_as_completed(["a", "b"]))
assert [i for i, _ in completed] == [1, 0]
assert {i: result for i, result in completed} == {0: "A", 1: "B"}
print("execution modes: ok")
