import torch

try:
    torch.zeros(3).expand(2, 3).add_(1)
except RuntimeError as error:
    assert 'written-to tensor' in str(error)
else:
    raise AssertionError('zero-stride self overlap must be rejected')

sneaky = torch.zeros(4).as_strided((2, 3), (1, 1))
sneaky.add_(1)
assert torch.equal(sneaky, torch.tensor([[1., 2., 2.], [2., 2., 1.]]))

buffer = torch.arange(6.)
try:
    buffer[0:4].add_(buffer[2:6])
except RuntimeError as error:
    assert 'input tensor' in str(error)
else:
    raise AssertionError('overlapping operands must be rejected')

leaf = torch.zeros(3, requires_grad=True)
try:
    leaf.add_(1)
except RuntimeError as error:
    assert 'leaf Variable' in str(error)
else:
    raise AssertionError('in-place on a requires_grad leaf must be rejected')

with torch.no_grad():
    leaf.add_(1)
assert leaf._version == 1 and leaf.is_leaf and leaf.requires_grad

aliased = leaf.detach()
aliased.add_(1)
assert leaf._version == 2
assert torch.equal(leaf.detach(), torch.full((3,), 2.))

saved = torch.randn(3, requires_grad=True)
out = saved.exp()
out.add_(1)
try:
    out.sum().backward()
except RuntimeError as error:
    assert 'version 1; expected version 0' in str(error)
else:
    raise AssertionError('mutating a saved output must fail in backward')
