import torch


base = torch.arange(15).reshape(3, 5)
window = base[:, 1:5:2]

assert window.shape == (3, 2)
assert window.stride() == (5, 2)
assert window.storage_offset() == 1
assert window.untyped_storage().data_ptr() == base.untyped_storage().data_ptr()
window[2, 1] = -1
assert base[2, 3] == -1

row = base.select(0, 1)
assert row.shape == (5,)
assert row.storage_offset() == 5
assert base.narrow(1, -2, 2).shape == (3, 2)

gathered = base[[0, 2]]
assert gathered.untyped_storage().data_ptr() != base.untyped_storage().data_ptr()
