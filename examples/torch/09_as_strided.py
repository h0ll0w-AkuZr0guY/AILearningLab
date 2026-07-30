import torch


base = torch.arange(6.0, requires_grad=True)
windows = torch.as_strided(base, size=(4, 3), stride=(1, 1))

assert windows.untyped_storage().data_ptr() == base.untyped_storage().data_ptr()
assert torch.equal(windows[1], torch.tensor([1.0, 2.0, 3.0]))
windows.sum().backward()
assert torch.equal(base.grad, torch.tensor([1.0, 2.0, 3.0, 3.0, 2.0, 1.0]))

try:
    torch.as_strided(base, size=(2, 2), stride=(10, 1))
except RuntimeError:
    pass
else:
    raise AssertionError('越界地址必须被拒绝')
