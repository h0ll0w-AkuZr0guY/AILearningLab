import torch

assert torch.result_type(
    torch.tensor([1.], dtype=torch.float32),
    torch.tensor(1., dtype=torch.float64)
) is torch.float32
assert torch.result_type(
    torch.tensor([1.], dtype=torch.float32),
    torch.tensor([1.], dtype=torch.float64)
) is torch.float64
assert torch.result_type(
    torch.tensor([1], dtype=torch.int32),
    torch.tensor(1., dtype=torch.float64)
) is torch.float64
assert torch.result_type(
    torch.tensor([1], dtype=torch.int32), torch.tensor(1)
) is torch.int32

assert torch.promote_types(torch.uint8, torch.int8) is torch.int16
assert torch.promote_types(torch.float16, torch.bfloat16) is torch.float32

overflowed = torch.tensor([1], dtype=torch.int8) + 200
assert overflowed.dtype is torch.int8
assert overflowed.tolist() == [-55]
assert torch.isinf(torch.tensor([1.], dtype=torch.float16) + 1e5).item()

assert (torch.tensor([1.], dtype=torch.float32) + 1j).dtype is torch.complex64
assert (torch.tensor([1]) / torch.tensor([2])).dtype is torch.float32

assert torch.can_cast(torch.float64, torch.float32) is True
assert torch.can_cast(torch.float32, torch.int64) is False
try:
    torch.tensor([1]).add_(1.5)
except RuntimeError as error:
    assert "can't be cast to the desired output type Long" in str(error)
else:
    raise AssertionError('an integer left value must reject a float result')
