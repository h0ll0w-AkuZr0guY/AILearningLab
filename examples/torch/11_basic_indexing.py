import torch

x = torch.arange(15).reshape(3, 5)
y = x[1, 1:5:2]
assert y.tolist() == [6, 8]
assert y.untyped_storage().data_ptr() == x.untyped_storage().data_ptr()
y[1] = -1
assert x[1, 3].item() == -1
