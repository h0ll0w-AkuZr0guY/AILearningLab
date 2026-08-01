import torch

base = torch.zeros(5)
duplicated = (torch.tensor([1, 1, 3]),)
values = torch.tensor([10., 20., 30.])

overwrite = base.clone().index_put_(duplicated, values, accumulate=False)
assert torch.equal(overwrite, torch.tensor([0., 20., 0., 30., 0.]))

accumulated = base.clone().index_put_(duplicated, values, accumulate=True)
assert torch.equal(accumulated, torch.tensor([0., 30., 0., 30., 0.]))

sugar = base.clone()
sugar[duplicated[0]] = values
assert torch.equal(sugar, overwrite)

shared = torch.arange(6.)
try:
    shared.index_put_((torch.tensor([0, 1]),), shared[2:4], accumulate=False)
except RuntimeError as error:
    assert 'single memory location' in str(error)
else:
    raise AssertionError('overlapping self and value must be rejected')

leaf = torch.zeros(4, requires_grad=True)
work = leaf.clone()
value = torch.ones(3, requires_grad=True)
work.index_put_((torch.tensor([0, 0, 2]),), value, accumulate=True)
work.sum().backward()
assert torch.equal(value.grad, torch.ones(3))
