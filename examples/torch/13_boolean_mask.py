import torch

x = torch.arange(24).reshape(2, 3, 4)
mask = torch.tensor([[True, False, True], [False, True, False]])
y = x[mask]
assert y.shape == (3, 4) and torch.equal(y[1], x[0, 2])
assert y.untyped_storage().data_ptr() != x.untyped_storage().data_ptr()
