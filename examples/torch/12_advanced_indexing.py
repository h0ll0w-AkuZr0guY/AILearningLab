import torch

x = torch.arange(20).reshape(4, 5)
rows, cols = torch.tensor([[0], [2]]), torch.tensor([[1, 3, 4]])
y = x[rows, cols]
assert y.tolist() == [[1, 3, 4], [11, 13, 14]]
assert y.untyped_storage().data_ptr() != x.untyped_storage().data_ptr()
