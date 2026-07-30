import torch


base = torch.arange(12.0).reshape(3, 4)
transposed = base.transpose(0, 1)
packed = transposed.contiguous()

assert packed.is_contiguous()
assert packed.untyped_storage().data_ptr() != transposed.untyped_storage().data_ptr()
assert base.contiguous() is base

same = packed.to(device=packed.device, dtype=packed.dtype)
forced = packed.to(copy=True)
assert same is packed
assert forced.untyped_storage().data_ptr() != packed.untyped_storage().data_ptr()
assert torch.equal(forced, packed)
