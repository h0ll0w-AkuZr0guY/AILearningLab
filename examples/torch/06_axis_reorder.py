import torch


base = torch.arange(24).reshape(2, 3, 4)
permuted = base.permute(0, 2, 1)

assert permuted.shape == (2, 4, 3)
assert permuted.stride() == (12, 1, 4)
assert permuted.untyped_storage().data_ptr() == base.untyped_storage().data_ptr()
assert permuted[1, 3, 2] == base[1, 2, 3]

moved = torch.movedim(base, 1, -1)
assert torch.equal(moved, permuted)
assert not permuted.is_contiguous()
