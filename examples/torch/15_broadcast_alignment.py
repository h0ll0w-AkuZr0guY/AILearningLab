import torch

x = torch.ones(2, 3, 4, requires_grad=True)
bias = torch.arange(4.0, requires_grad=True)
(x + bias).sum().backward()
assert torch.equal(bias.grad, torch.full((4,), 6.0))
try:
    torch.ones(1, 3, 1).add_(torch.ones(3, 1, 7))
except RuntimeError:
    pass
else:
    raise AssertionError('in-place broadcast must not change the left shape')
