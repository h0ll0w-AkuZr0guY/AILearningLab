import torch


base = torch.arange(24, dtype=torch.float32).reshape(2, 3, 4)
transposed = base.transpose(1, 2)

try:
    transposed.view(2, 12)
except RuntimeError as error:
    assert "not compatible" in str(error)
else:
    raise AssertionError("跨越两个连续子空间的 view 应失败")

reshaped = transposed.reshape(2, 12)
assert reshaped.untyped_storage().data_ptr() != transposed.untyped_storage().data_ptr()
assert torch.equal(reshaped, transposed.contiguous().view(2, 12))

compatible = base.reshape(6, 4)
assert compatible.untyped_storage().data_ptr() == base.untyped_storage().data_ptr()
