import torch


def contract(tensor: torch.Tensor) -> tuple[object, ...]:
    return (
        tuple(tensor.shape),
        tensor.numel(),
        tensor.dtype,
        tensor.device.type,
        tensor.layout,
    )


dense = torch.zeros((2, 3), dtype=torch.float32)
meta = torch.empty((2, 3), device="meta")
sparse = torch.sparse_coo_tensor(
    indices=torch.tensor([[0, 1], [2, 0]]),
    values=torch.tensor([4.0, 5.0]),
    size=(2, 3),
)

assert contract(dense)[:2] == contract(meta)[:2] == ((2, 3), 6)
assert dense.layout == torch.strided
assert sparse.layout == torch.sparse_coo
assert sparse.to_dense()[0, 2].item() == 4.0
