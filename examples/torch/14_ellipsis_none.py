import torch

x = torch.arange(24).reshape(2, 3, 4)
y = x[..., None, :]
assert y.shape == (2, 3, 1, 4)
assert y.untyped_storage().data_ptr() == x.untyped_storage().data_ptr()
assert torch.equal(x[..., -1], x[:, :, -1])
