from typing import Protocol, TypedDict, runtime_checkable
class Row(TypedDict): name: str
@runtime_checkable
class Reader(Protocol):
    def read(self) -> Row: ...
class MemoryReader:
    def read(self) -> Row: return {"name": "Ada"}
reader = MemoryReader()
assert isinstance(reader, Reader)
assert reader.read()["name"] == "Ada"
