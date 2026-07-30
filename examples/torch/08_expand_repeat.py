import torch


base = torch.tensor([[10.0], [20.0], [30.0]])
expanded = base.expand(3, 4)

assert expanded.stride() == (1, 0)
assert expanded.untyped_storage().data_ptr() == base.untyped_storage().data_ptr()
assert expanded[2, 0] == expanded[2, 3] == 30.0

owned = expanded.clone()
owned[2, 3] = -1
assert base[2, 0] == 30.0

repeated = base.repeat(1, 4)
assert repeated.untyped_storage().data_ptr() != base.untyped_storage().data_ptr()
assert torch.equal(repeated, expanded)
