import torch

torch.manual_seed(0)

A = torch.arange(6.).reshape(2, 3)
B = torch.arange(12.).reshape(3, 4)
assert torch.equal(torch.einsum('ij,jk->ik', A, B), A @ B)
assert torch.equal(torch.einsum('ij,jk', A, B), A @ B)
assert torch.einsum('ji', A).shape == (3, 2)

S = torch.arange(9.).reshape(3, 3)
assert torch.equal(torch.einsum('ii->i', S), S.diagonal())
assert torch.einsum('ii', S).item() == 12.0

X, Y = torch.randn(2, 3, 4), torch.randn(2, 4, 5)
assert torch.allclose(torch.einsum('...ij,...jk->...ik', X, Y), torch.bmm(X, Y))
assert torch.allclose(torch.einsum('bij,bjk->bik', X, Y), torch.bmm(X, Y))
assert torch.einsum(
    '...i,...i->...', torch.randn(2, 1, 3), torch.randn(1, 4, 3)
).shape == (2, 4)

assert torch.equal(torch.einsum(A, [0, 1], B, [1, 2], [0, 2]), A @ B)

try:
    torch.einsum('ij->ii', A)
except RuntimeError as error:
    assert 'output subscript i appears more than once' in str(error)
else:
    raise AssertionError('duplicated output subscripts must be rejected')

try:
    torch.einsum('ij,jk->ik', A, torch.zeros(5, 4))
except RuntimeError as error:
    assert 'does not broadcast with previously seen size 3' in str(error)
else:
    raise AssertionError('conflicting subscript sizes must be rejected')
